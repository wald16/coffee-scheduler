import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createServiceClient } from "@/lib/supabase/service";
import { colorForPersonKey, excelArgbFromHslString } from "@/lib/color";

// ---------- helpers ----------
function addDaysLocal(ymd: string, n: number) {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setDate(dt.getDate() + n);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}
function headerLabel(ymd: string) {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(dt);
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${String(d).padStart(2, "0")}`;
}
const hhmm = (t?: string | null) => (t || "").slice(0, 5);

// slot rule: before 14:00 -> TM, else TT
const SLOT_CUTOFF = "14:00";
type Slot = "TM" | "TT";
function slotFromStart(start: string): Slot {
    return start < SLOT_CUTOFF ? "TM" : "TT";
}

// puesto: db value -> display + sort index
function displayPuesto(p?: string | null) {
    if (!p) return { label: "", order: 99 };
    const v = p.toLowerCase();
    if (v === "caja") return { label: "caja", order: 1 };
    if (v === "camarero" || v === "camarero/a") return { label: "camarero/a", order: 2 };
    if (v === "runner_bacha" || v === "runner/bacha") return { label: "runner/bacha", order: 3 };
    return { label: p, order: 98 };
}

// styles
const brown = "5B1E12";                // header/labels
const strongRed = "#ff0000";            // franco (iOS-like strong red)
const white = "FFFFFF";

const borderAll = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };

// ---------- route ----------
export async function POST(req: Request) {
    try {
        const { weekStart } = await req.json();
        if (!weekStart) {
            return NextResponse.json({ error: "weekStart requerido (YYYY-MM-DD)" }, { status: 400 });
        }
        const days = Array.from({ length: 7 }, (_, i) => addDaysLocal(weekStart, i));
        const weekEnd = days[6];

        const supa = createServiceClient();

        // Profiles (empleados)
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

        // Indexes
        type Emp = {
            id: string;
            name: string;
            puestoLabel: string;
            puestoOrder: number;
            colorHsl: string;
        };
        const emps: Emp[] = (profiles || []).map(p => {
            const disp = displayPuesto(p.job_role);
            return {
                id: p.id,
                name: (p.full_name || p.id).toString().toUpperCase(),
                puestoLabel: disp.label,
                puestoOrder: disp.order,
                colorHsl: colorForPersonKey(p.id),
            };
        });

        // off map
        const offSet = new Set<string>();
        (offs || []).forEach(o => offSet.add(`${o.employee_id}|${o.date}`));

        // shifts -> by emp, date, slot
        const byEmpDateSlot = new Map<string, Set<string>>(); // key: emp|date -> set('TM'|'TT')
        (shifts || []).forEach(s => {
            const start = hhmm(s.start_time);
            const slot = slotFromStart(start);
            const key = `${s.employee_id}|${s.date}`;
            if (!byEmpDateSlot.has(key)) byEmpDateSlot.set(key, new Set());
            byEmpDateSlot.get(key)!.add(slot);
        });

        // Which employees belong to TM block and TT block (at least one shift of that slot)
        function hasAnySlot(empId: string, slot: Slot) {
            for (const d of days) {
                const set = byEmpDateSlot.get(`${empId}|${d}`);
                if (set && set.has(slot)) return true;
            }
            return false;
        }

        const tmEmps = emps.filter(e => hasAnySlot(e.id, "TM"))
            .sort((a, b) => a.puestoOrder - b.puestoOrder || a.name.localeCompare(b.name));
        const ttEmps = emps.filter(e => hasAnySlot(e.id, "TT"))
            .sort((a, b) => a.puestoOrder - b.puestoOrder || a.name.localeCompare(b.name));

        // Workbook
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Semana");

        // Columns: A = label TM/TT (merged), B..H = días
        ws.columns = [{ header: "", key: "LBL", width: 10 }].concat(
            days.map(d => ({ header: headerLabel(d), key: d, width: 22 }))
        );

        // Header row (brown)
        const headerRow = ws.getRow(1);
        headerRow.height = 22;
        for (let c = 1; c <= days.length + 1; c++) {
            const cell = headerRow.getCell(c);
            cell.value = c === 1 ? "" : ws.getColumn(c).header;
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brown } };
            cell.font = { bold: true, color: { argb: white } };
            cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            cell.border = borderAll;
        }

        let rowPtr = 2;

        async function writeBlock(title: "TM" | "TT", rows: Emp[]) {
            if (rows.length === 0) return;
            const blockStart = rowPtr;

            for (const e of rows) {
                const row = ws.getRow(rowPtr++);
                row.height = 22;

                // Left label column A is filled later via merge
                const nameWithRole = (role: string) => `${e.name}${role ? ` (${role})` : ""}`;

                // Fill days
                days.forEach((d, idx) => {
                    const cell = row.getCell(2 + idx);
                    const off = offSet.has(`${e.id}|${d}`);
                    const set = byEmpDateSlot.get(`${e.id}|${d}`);
                    const hasSlot = set?.has(title) ?? false;

                    if (off) {
                        cell.value = "F";
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: strongRed } };
                        cell.font = { bold: true, color: { argb: white } };
                    } else if (hasSlot) {
                        const hsl = e.colorHsl;
                        const argb = excelArgbFromHslString(hsl);
                        cell.value = nameWithRole(e.puestoLabel);
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
                        cell.font = { bold: true, color: { argb: white } };
                    } else {
                        cell.value = "";
                    }
                    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
                    cell.border = borderAll;
                });

                // also border on col A per row (clean grid)
                const a = row.getCell(1);
                a.border = borderAll;
            }

            // Merge label column A for the whole block and style it
            ws.mergeCells(blockStart, 1, rowPtr - 1, 1);
            const labelCell = ws.getCell(blockStart, 1);
            labelCell.value = title;
            labelCell.alignment = { vertical: "middle", horizontal: "center" };
            labelCell.font = { bold: true, color: { argb: white } };
            labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brown } };
            labelCell.border = borderAll;

            // Spacer row (thin)
            const spacer = ws.getRow(rowPtr++);
            spacer.height = 6;
            for (let c = 1; c <= days.length + 1; c++) {
                spacer.getCell(c).border = borderAll;
            }
        }

        await writeBlock("TM", tmEmps);
        await writeBlock("TT", ttEmps);

        // Freeze header + label column
        ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

        const buffer = await wb.xlsx.writeBuffer();
        return new NextResponse(buffer as Buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename=semana_grid_${weekStart}.xlsx`,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
    }
}
