"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return alert(error.message);
    router.replace("/");
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center">
      <div className="ig-container max-w-md w-full">
        <div className="ig-card ig-section">
          <h1 className="h1">Login</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ig-text-dim)" }}>
            Enter your email and password.
          </p>
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Email</label>
              <input className="ig-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Password</label>
              <input className="ig-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="ig-btn ig-btn--primary w-full" disabled={loading}>
              {loading ? "Loading…" : "Login"}
            </button>
          </form>
          <p className="text-sm mt-4" style={{ color: "var(--ig-text-dim)" }}>
            Don&apos;t have an account? <Link href="/auth/signup" className="underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
