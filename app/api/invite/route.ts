// /app/api/invite/route.ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service"; // uses SERVICE_ROLE key

export async function POST(req: Request) {
    try {
        const { email, full_name, role } = await req.json();

        if (!email) {
            return NextResponse.json({ error: "Email requerido" }, { status: 400 });
        }
        const supa = createServiceClient();
        const origin =
            process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
        // Send invite email and create auth user
        const { data, error } = await supa.auth.admin.inviteUserByEmail(email, {
            data: { full_name, role: role ?? "employee" },
            redirectTo: `${origin}/auth/confirm?type=invite`,
        });
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        const user = data?.user;
        if (!user) {
            return NextResponse.json({ error: "No se creó el usuario" }, { status: 500 });
        }

        // Ensure profile row with role
        const { error: perr } = await supa
            .from("profiles")
            .upsert(
                { id: user.id, full_name: full_name ?? null, role: role ?? "employee" },
                { onConflict: "id" }
            );
        if (perr) {
            return NextResponse.json({ error: perr.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true, userId: user.id });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
    }
}
