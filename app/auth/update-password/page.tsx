"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
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
    <div className="min-h-[60vh] flex items-center">
      <div className="ig-container max-w-md w-full">
        <div className="ig-card ig-section">
          <h1 className="h1">Definir contraseña</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ig-text-dim)" }}>
            Tu invitación fue aceptada. Define tu contraseña para continuar.
          </p>
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
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
        </div>
      </div>
    </div>
  );
}
