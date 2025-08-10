// /app/api/francos/route.ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Body:
// {
//   employee_id: string,
//   weekStart: "YYYY-MM-DD",
//   weekEnd:   "YYYY-MM-DD",
//   dates:     string[] // subset of those 7 days, e.g. ["2025-08-11","2025-08-13"]
// }
export async function POST(req: Request) {
    try {
        const { employee_id, weekStart, weekEnd, dates } = await req.json();

        if (!employee_id) {
            return NextResponse.json({ error: "employee_id requerido" }, { status: 400 });
        }
        if (!weekStart || !weekEnd) {
            return NextResponse.json({ error: "weekStart y weekEnd requeridos" }, { status: 400 });
        }
        if (!Array.isArray(dates)) {
            return NextResponse.json({ error: "dates debe ser un array" }, { status: 400 });
        }

        const supa = createServiceClient();

        // 1) Borrar los francos existentes de esa semana
        const del = await supa
            .from("days_off")
            .delete()
            .eq("employee_id", employee_id)
            .gte("date", weekStart)
            .lte("date", weekEnd);

        if (del.error) {
            return NextResponse.json({ error: del.error.message }, { status: 400 });
        }

        // 2) Insertar los nuevos (si hay)
        let inserted = 0;
        if (dates.length) {
            const ins = await supa.from("days_off").insert(
                dates.map((d: string) => ({ employee_id, date: d }))
            );
            if (ins.error) {
                return NextResponse.json({ error: ins.error.message }, { status: 400 });
            }
            inserted = dates.length;
        }

        return NextResponse.json({ ok: true, inserted });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
    }
}
