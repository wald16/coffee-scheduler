// /app/auth/signout/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

export default function SignOut() {
    const router = useRouter();
    useEffect(() => {
        const supabase = createBrowserSupabase();
        supabase.auth.signOut().finally(() => router.replace("/auth/login"));
    }, [router]);
    return <p className="text-sm text-gray-600">Cerrando sesión…</p>;
}
