import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function MisTurnosPage() {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const { data: shifts } = await supabase
        .from("shifts")
        .select("id,date,start_time,end_time,notes")
        .eq("employee_id", user.id)
        .order("date", { ascending: true });

    const { data: daysOff } = await supabase
        .from("days_off")
        .select("date")
        .eq("employee_id", user.id)
        .order("date");

    return (
        <div className="ig-container p-4 space-y-6">
            <h1 className="h1">Mis turnos</h1>

            <section className="ig-card ig-section">
                <h2 className="h2">Próximos turnos</h2>
                {!shifts?.length && <p style={{ color: "var(--ig-text-dim)" }} className="text-sm">Sin turnos asignados.</p>}
                <ul>
                    {shifts?.map((s) => (
                        <li key={s.id} className="ig-list-item">
                            <div>
                                <div className="font-semibold">{new Date(s.date).toLocaleDateString()}</div>
                                <div className="text-sm" style={{ color: "var(--ig-text-dim)" }}>
                                    {s.start_time} — {s.end_time}{s.notes ? ` · ${s.notes}` : ""}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="ig-card ig-section">
                <h2 className="h2">Mis francos</h2>
                {!daysOff?.length && <p className="text-sm" style={{ color: "var(--ig-text-dim)" }}>Sin francos cargados.</p>}
                <div className="flex flex-wrap gap-2">
                    {daysOff?.map((d, i) => (
                        <span key={i} className="ig-badge">{new Date(d.date).toLocaleDateString()}</span>
                    ))}
                </div>
            </section>
        </div>
    );
}
