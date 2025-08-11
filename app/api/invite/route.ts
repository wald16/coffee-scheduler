// /app/api/invite/route.ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service"; // SERVICE_ROLE

type RawJobRole = "caja" | "camarero" | "camarero/a" | "runner_bacha" | "runner/bacha" | string;
type JobRole = "caja" | "camarero" | "runner_bacha";

// normaliza valores del puesto
function normalizeJobRole(v?: RawJobRole | null): JobRole {
    const s = (v || "").toString().trim().toLowerCase();
    if (s === "caja") return "caja";
    if (s === "camarero" || s === "camarero/a") return "camarero";
    if (s === "runner_bacha" || s === "runner/bacha") return "runner_bacha";
    // default razonable
    return "camarero";
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const email: string | undefined = body?.email;
        const full_name: string | undefined = body?.full_name;
        const role: "admin" | "employee" | undefined = body?.role ?? "employee"; // permisos
        const job_role: JobRole = normalizeJobRole(body?.job_role);               // puesto visible

        if (!email) {
            return NextResponse.json({ error: "Email requerido" }, { status: 400 });
        }

        const supa = createServiceClient();
        const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

        // 1) Crear usuario por invitación con metadata (incluye puesto)
        const { data, error } = await supa.auth.admin.inviteUserByEmail(email, {
            data: { full_name, role, job_role },
            redirectTo: `${origin}/auth/confirm?type=invite`,
        });
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        const user = data?.user;
        if (!user) {
            return NextResponse.json({ error: "No se creó el usuario" }, { status: 500 });
        }

        // 2) Asegurar fila en profiles (permisos + puesto)
        const { error: perr } = await supa
            .from("profiles")
            .upsert(
                {
                    id: user.id,
                    full_name: full_name ?? null,
                    role: role ?? "employee",  // admin/employee (permisos)
                    job_role,                  // caja/camarero/runner_bacha (puesto)
                },
                { onConflict: "id" }
            );

        if (perr) {
            return NextResponse.json({ error: perr.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true, userId: user.id, job_role });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
    }
}
