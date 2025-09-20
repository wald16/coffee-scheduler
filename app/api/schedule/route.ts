// /app/api/schedule/route.ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ymdLocal, parseYmdLocal } from "@/lib/date";

// Body:
// {
//   weekStart: "YYYY-MM-DD",
//   weekEnd:   "YYYY-MM-DD",
//   start_time: "HH:MM",
//   end_time:   "HH:MM",
//   employee_ids: string[],
//   overwrite: boolean
// }
export async function POST(req: Request) {
    try {
        const {
            weekStart,
            weekEnd,
            start_time,
            end_time,
            employee_ids,
            overwrite,
        } = await req.json();

        if (!weekStart || !weekEnd) {
            return NextResponse.json({ error: "weekStart y weekEnd requeridos" }, { status: 400 });
        }
        if (!start_time || !end_time) {
            return NextResponse.json({ error: "start_time y end_time requeridos" }, { status: 400 });
        }
        if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
            return NextResponse.json({ error: "employee_ids requerido" }, { status: 400 });
        }

        const supa = createServiceClient();

        // Overwrite: borrar turnos existentes en esa semana (inclusive)
        if (overwrite) {
            const del = await supa
                .from("shifts")
                .delete()
                .in("employee_id", employee_ids)
                .gte("date", weekStart)
                .lte("date", weekEnd);
            if (del.error) {
                return NextResponse.json({ error: del.error.message }, { status: 400 });
            }
        }

        // Francos de la semana para esos empleados
        const offs = await supa
            .from("days_off")
            .select("employee_id,date")
            .in("employee_id", employee_ids)
            .gte("date", weekStart)
            .lte("date", weekEnd);

        if (offs.error) {
            return NextResponse.json({ error: offs.error.message }, { status: 400 });
        }

        const offSet = new Set<string>((offs.data ?? []).map(o => `${o.employee_id}|${o.date}`));

        // Días de la semana [weekStart..weekEnd] en LOCAL
        const days: string[] = [];
        {
            const s = parseYmdLocal(weekStart);
            const e = parseYmdLocal(weekEnd);
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                days.push(ymdLocal(d));
            }
        }

        // Generar filas, saltando francos
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
            if (ins.error) {
                return NextResponse.json({ error: ins.error.message }, { status: 400 });
            }
            inserted = rows.length;
        }

        return NextResponse.json({ ok: true, count: inserted });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
    }
}
