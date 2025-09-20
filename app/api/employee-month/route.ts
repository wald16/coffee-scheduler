import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Body: { employee_id, start, end } con YYYY-MM-DD (LOCAL)
export async function POST(req: Request) {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "No auth" }, { status: 401 });

        const { employee_id, start, end } = await req.json();
        if (!employee_id || !start || !end) {
            return NextResponse.json({ error: "employee_id, start y end requeridos" }, { status: 400 });
        }

        // (opcional) verificar que quien llama sea admin
        const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (me?.role !== "admin") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

        const { data, error } = await supabase
            .from("shifts")
            .select("date,start_time,end_time")
            .eq("employee_id", employee_id)
            .gte("date", start)
            .lte("date", end)
            .order("date");

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ shifts: data ?? [] });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
    }
}
