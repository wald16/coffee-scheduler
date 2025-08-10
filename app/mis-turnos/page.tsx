import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import CalendarMyShifts from "@/components/CalendarMyShifts";

export default async function MisTurnosPage() {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    // El calendario se autogestiona (carga por mes vía /api/my-calendar)
    return (
        <div className="ig-container p-4 space-y-6">
            <h1 className="h1">Mis turnos</h1>
            <CalendarMyShifts />
        </div>
    );
}
