import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: Request) {
    try {
        const { employee_id, date, start_time, end_time } = await req.json();
        if (!employee_id || !date || !start_time || !end_time) {
            return NextResponse.json({ error: "employee_id, date, start_time, end_time requeridos" }, { status: 400 });
        }
        if (start_time >= end_time) {
            return NextResponse.json({ error: "La hora de inicio debe ser menor a la de fin" }, { status: 400 });
        }

        const supa = createServiceClient();

        // si es franco, bloqueamos
        const off = await supa
            .from("days_off")
            .select("date")
            .eq("employee_id", employee_id)
            .eq("date", date)
            .maybeSingle();

        if (off.data) {
            return NextResponse.json({ error: "Ese día es franco. Quitá el franco para asignar horario." }, { status: 400 });
        }

        // upsert por (employee_id, date)
        const { error } = await supa
            .from("shifts")
            .upsert({ employee_id, date, start_time, end_time }, { onConflict: "employee_id,date" });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { employee_id, date } = await req.json();
        if (!employee_id || !date) {
            return NextResponse.json({ error: "employee_id y date requeridos" }, { status: 400 });
        }
        const supa = createServiceClient();
        const { error } = await supa
            .from("shifts")
            .delete()
            .eq("employee_id", employee_id)
            .eq("date", date);

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
    }
}
