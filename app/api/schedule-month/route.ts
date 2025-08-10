import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ymdLocal, parseYmdLocal } from "@/lib/date";

// Body esperado:
// {
//   month: "YYYY-MM",        // p.ej. "2025-08"
//   start_time: "HH:MM",
//   end_time: "HH:MM",
//   employee_ids: string[],
//   overwrite: boolean
// }
export async function POST(req: Request) {
    try {
        const { month, start_time, end_time, employee_ids, overwrite } = await req.json();

        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
            return NextResponse.json({ error: "month requerido (YYYY-MM)" }, { status: 400 });
        }
        if (!start_time || !end_time) {
            return NextResponse.json({ error: "start_time y end_time requeridos" }, { status: 400 });
        }
        if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
            return NextResponse.json({ error: "employee_ids requerido" }, { status: 400 });
        }

        // bounds locales (primer día y último día del mes)
        const [y, m] = month.split("-").map(Number);
        const startDate = new Date(y, (m || 1) - 1, 1);
        const endDate = new Date(y, (m || 1), 0);
        const monthStart = ymdLocal(startDate);
        const monthEnd = ymdLocal(endDate);

        const supa = createServiceClient();

        // opcional: borrar turnos existentes del rango y empleados seleccionados
        if (overwrite) {
            const del = await supa
                .from("shifts")
                .delete()
                .in("employee_id", employee_ids)
                .gte("date", monthStart)
                .lte("date", monthEnd);
            if (del.error) return NextResponse.json({ error: del.error.message }, { status: 400 });
        }

        // Traer francos del mes para esos empleados
        const offs = await supa
            .from("days_off")
            .select("employee_id,date")
            .in("employee_id", employee_ids)
            .gte("date", monthStart)
            .lte("date", monthEnd);

        if (offs.error) return NextResponse.json({ error: offs.error.message }, { status: 400 });

        const offSet = new Set<string>((offs.data ?? []).map(o => `${o.employee_id}|${o.date}`));

        // Generar todas las fechas del mes (LOCAL)
        const days: string[] = [];
        {
            const s = parseYmdLocal(monthStart);
            const e = parseYmdLocal(monthEnd);
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                days.push(ymdLocal(d));
            }
        }

        // Crear filas omitiendo francos
        const rows: Array<{ employee_id: string; date: string; start_time: string; end_time: string; }> = [];
        for (const emp of employee_ids) {
            for (const d of days) {
                if (!offSet.has(`${emp}|${d}`)) {
                    rows.push({ employee_id: emp, date: d, start_time, end_time });
                }
            }
        }

        let inserted = 0;
        if (rows.length) {
            const ins = await supa.from("shifts").insert(rows);
            if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });
            inserted = rows.length;
        }

        return NextResponse.json({ ok: true, count: inserted, range: { start: monthStart, end: monthEnd } });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
    }
}
