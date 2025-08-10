// app\auth\signup\page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function Signup() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false); const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm` // Or a special invite-complete page
      }
    });

    setLoading(false);

    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        alert("Este email ya fue invitado. Abrí el mail de invitación para confirmar y luego definí tu contraseña.");
        return;
      }

      router.replace("/auth/sign-up-success");
    }


    return (
      <div className="min-h-[calc(100vh-60px)] flex items-center">
        <div className="ig-container max-w-md w-full">
          <div className="ig-card ig-section">
            <h1 className="h1">Create account</h1>
            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Full name</label>
                <input className="ig-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Email</label>
                <input className="ig-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Password</label>
                <input className="ig-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <button className="ig-btn ig-btn--primary w-full" disabled={loading}>
                {loading ? "Loading…" : "Sign up"}
              </button>
            </form>
            <p className="text-sm mt-4" style={{ color: "var(--ig-text-dim)" }}>
              Already have an account? <Link href="/auth/login" className="underline">Log in</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }
