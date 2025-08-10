"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function parseHashParams(hash: string) {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const out: Record<string, string> = {};
  q.forEach((v, k) => (out[k] = v));
  return out;
}

export default function ConfirmPage() {
  const sp = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supabase = createClient();

      // 1) Hash tokens (/#access_token=...&refresh_token=...&type=invite)
      if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
        const h = parseHashParams(window.location.hash);
        const access_token = h["access_token"];
        const refresh_token = h["refresh_token"];
        const type = h["type"]; // invite | recovery | magiclink | signup

        if (!access_token || !refresh_token) {
          alert("Link inválido"); return;
        }
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) { alert(error.message); return; }

        // limpiar hash para no dejar tokens en la URL
        window.history.replaceState({}, "", window.location.pathname);

        if (type === "invite") router.replace("/auth/update-password");
        else router.replace("/");
        return;
      }

      // 2) Nuevo formato (?code=...)
      const code = sp.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.search);
        if (error) { alert(error.message); return; }
        if (sp.get("type") === "invite") router.replace("/auth/update-password");
        else router.replace("/");
        return;
      }

      // 3) Legacy (?token_hash=...&type=invite|signup|recovery|magiclink)
      const token_hash = sp.get("token_hash");
      const type = sp.get("type") as "invite" | "signup" | "recovery" | "magiclink" | null;
      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type });
        if (error) { alert(error.message); return; }
        if (type === "invite") router.replace("/auth/update-password");
        else router.replace("/");
        return;
      }

      alert("Enlace inválido o expirado.");
    })();
  }, [router, sp]);

  return null;
}
