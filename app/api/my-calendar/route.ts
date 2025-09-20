// /app/api/my-calendar/route.ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "No auth" }, { status: 401 });

        const { start, end } = await req.json();
        if (!start || !end) {
            return NextResponse.json({ error: "start y end requeridos (YYYY-MM-DD)" }, { status: 400 });
        }

        const { data: shifts, error: sErr } = await supabase
            .from("shifts")
            .select("id,date,start_time,end_time,notes")
            .eq("employee_id", user.id)
            .gte("date", start)
            .lte("date", end)
            .order("date", { ascending: true });

        if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

        const { data: daysOff, error: dErr } = await supabase
            .from("days_off")
            .select("date")
            .eq("employee_id", user.id)
            .gte("date", start)
            .lte("date", end)
            .order("date");

        if (dErr) return NextResponse.json({ error: dErr.message }, { status: 400 });

        return NextResponse.json({ shifts: shifts ?? [], daysOff: daysOff ?? [] });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
    }
}
