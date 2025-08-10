// lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr"; // o el que ya usabas

export async function createServerSupabase() {
  // si antes te pedía await, dejalo con await
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // 👇 Evita el crash cuando no se puede escribir cookies aquí
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // no-op en Server Components; se permitirá en Route Handlers / Server Actions
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options, expires: new Date(0) });
          } catch {
            // no-op
          }
        },
      },
    }
  );
}
