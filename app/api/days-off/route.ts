import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST body:
 * {
 *   employee_id: string,
 *   date: "YYYY-MM-DD",
 *   on: boolean // true = set franco, false = remove
 * }
 */
export async function POST(req: Request) {
    try {
        const { employee_id, date, on } = await req.json();

        if (!employee_id || !date || typeof on !== "boolean") {
            return NextResponse.json({ error: "employee_id, date y on requeridos" }, { status: 400 });
        }

        const supa = createServiceClient();

        if (on) {
            const { error } = await supa
                .from("days_off")
                .insert({ employee_id, date });
            // ignore duplicate unique constraint if you have one
            if (error && !/duplicate|unique/i.test(error.message)) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
        } else {
            const { error } = await supa
                .from("days_off")
                .delete()
                .eq("employee_id", employee_id)
                .eq("date", date);
            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
    }
}
