"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function UpdatePasswordForm() {
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 6) return alert("La contraseña debe tener 6+ caracteres");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) return alert(error.message);
    router.replace("/");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        className="ig-input"
        type="password"
        placeholder="Nueva contraseña"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
      />
      <button className="ig-btn ig-btn--primary w-full" disabled={loading}>
        {loading ? "Guardando…" : "Guardar y entrar"}
      </button>
    </form>
  );
}
