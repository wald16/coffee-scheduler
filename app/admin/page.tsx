import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import AdminClient from "./ui";

export default async function AdminPage() {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "admin") redirect("/mis-turnos");

    const { data: employees } = await supabase
        .from("profiles")
        .select("id,full_name,role")
        .order("full_name", { ascending: true });

    return (
        <div className="ig-container p-4 space-y-6">
            <AdminClient employees={employees ?? []} />
        </div>
    );
}
