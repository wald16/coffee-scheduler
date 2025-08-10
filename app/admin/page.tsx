import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { ymdLocal } from "@/lib/date";
import AdminUI from "./ui";

function monthBounds(date = new Date()) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start: ymdLocal(start), end: ymdLocal(end) };
}

export default async function AdminPage() {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "admin") redirect("/mis-turnos");

    const { data: employees } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .order("full_name", { ascending: true });

    const { start, end } = monthBounds();
    const { data: daysOff } = await supabase
        .from("days_off")
        .select("employee_id, date");

    return (
        <div className="ig-container p-4 space-y-6">
            <h1 className="h1">Panel Admin</h1>
            <AdminUI
                employees={employees ?? []}
                initialDaysOff={daysOff ?? []}
                monthStart={start}
                monthEnd={end}
            />
        </div>
    );
}
