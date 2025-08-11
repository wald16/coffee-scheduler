import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createServiceClient } from "@/lib/supabase/service";
import { colorForPersonKey, excelArgbFromHslString } from "@/lib/color";

// utils locales
function addDaysLocal(ymd: string, n: number) {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setDate(dt.getDate() + n);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}
function dayKey(ymd: string) {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    // Lunes..Domingo (es-AR)
    return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "2-digit" })
        .format(dt)
        .replace(/^\w/, c => c.toUpperCase()); // capitalizar
}
const hhmm = (t?: string | null) => (t || "").slice(0, 5);

export async function POST(req: Request) {
    try {
        const { weekStart, showHours = true, cutoff = "14:00" } = await req.json();
        if (!weekStart) return NextResponse.json({ error: "weekStart requerido (YYYY-MM-DD)" }, { status: 400 });

        const weekDays = Array.from({ length: 7 }, (_, i) => addDaysLocal(weekStart, i));
        const weekEnd = weekDays[6];

        const supa = createServiceClient();

        // Traer empleados (profiles)
        const { data: profiles, error: pErr } = await supa
            .from("profiles")
            .select("id, full_name, job_role")
            .order("full_name", { ascending: true });

        if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

        // Shifts de la semana
        const { data: shifts, error: sErr } = await supa
            .from("shifts")
            .select("employee_id, date, start_time, end_time")
            .gte("date", weekStart)
            .lte("date", weekEnd);

        if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

        // Francos de la semana
        const { data: offs, error: oErr } = await supa
            .from("days_off")
            .select("employee_id, date")
            .gte("date", weekStart)
            .lte("date", weekEnd);

        if (oErr) return NextResponse.json({ error: oErr.message }, { status: 400 });

        // Indexar: empleado -> { name, color, cells[date] = string | "F" | "" }
        type Row = { id: string; name: string; color: string; cells: Record<string, string> };
        const rows: Row[] = (profiles || []).map(p => ({
            id: p.id,
            name: (p.full_name || p.id).toString().toUpperCase(),
            color: colorForPersonKey(p.id),
            cells: Object.fromEntries(weekDays.map(d => [d, "" as string])),
        }));

        const rowById = new Map(rows.map(r => [r.id, r]));

        // aplicar francos
        (offs || []).forEach(o => {
            const r = rowById.get(o.employee_id);
            if (r && r.cells[o.date] !== undefined) r.cells[o.date] = "F";
        });

        // aplicar shifts (si hay franco, prioriza "F")
        (shifts || []).forEach(s => {
            const r = rowById.get(s.employee_id);
            if (!r) return;
            if (r.cells[s.date] === "F") return; // mantener franco
            const val = showHours ? `${hhmm(s.start_time)}–${hhmm(s.end_time)}` : (hhmm(s.start_time) < cutoff ? "TM" : "TT");
            r.cells[s.date] = val;
        });

        // Excel
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Semana");

        // Columnas: Empleado + 7 días
        ws.columns = [{ header: "Empleado", key: "EMP", width: 26 }].concat(
            weekDays.map((d) => ({ header: dayKey(d), key: d, width: 16 }))
        );

        // estilos header
        const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "5B1E12" } };
        const borderAll = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };

        ws.getRow(1).height = 22;
        for (let c = 1; c <= 8; c++) {
            const cell = ws.getRow(1).getCell(c);
            cell.fill = headerFill;
            cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.border = borderAll;
        }

        // filas por empleado
        rows.forEach((r, i) => {
            const row = ws.getRow(2 + i);
            row.getCell(1).value = r.name;
            row.getCell(1).border = borderAll;

            weekDays.forEach((d, idx) => {
                const v = r.cells[d] || "";
                const cell = row.getCell(2 + idx);
                cell.value = v;

                // estilos por estado
                if (v === "F") {
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF4D4F" } }; // rojo franco
                    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
                } else if (v) {
                    const argb = excelArgbFromHslString(r.color);
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } }; // color del empleado
                    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
                }
                cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
                cell.border = borderAll;
            });
        });

        // congelar encabezado y primera columna
        ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

        const buffer = await wb.xlsx.writeBuffer();
        return new NextResponse(buffer as Buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename=agenda_por_empleado_${weekStart}.xlsx`,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
    }
}
