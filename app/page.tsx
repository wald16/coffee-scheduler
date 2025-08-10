import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "admin") redirect("/admin");
    redirect("/mis-turnos");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-6 text-center space-y-4">
        <h1 className="text-xl font-semibold text-black">Organizador de horarios y francos</h1>
        <p className="text-sm text-gray-600">Iniciá sesión para ver tus turnos o gestionar el panel de admin.</p>
        <div className="flex justify-center gap-2">
          <Link href="/auth/login" className="px-4 py-2 rounded-full bg-black text-white">Iniciar sesión</Link>
          <Link href="/auth/signup" className="px-4 py-2 rounded-full border text-black">Crear cuenta</Link>
        </div>
      </div>
    </main>
  );
}
