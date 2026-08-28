import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./env";

export function isServerSupabaseConfigured(): boolean {
  return Boolean(
    ENV.supabaseUrl &&
    (ENV.supabaseServiceRoleKey || ENV.supabaseAnonKey) &&
    ENV.supabaseUrl.trim() !== "" &&
    !ENV.supabaseUrl.includes("your-project-id")
  );
}

export const serverSupabase: SupabaseClient | null = isServerSupabaseConfigured()
  ? createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey || ENV.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export async function verifySupabaseToken(token: string) {
  if (!serverSupabase) {
    return null;
  }
  try {
    const { data: { user }, error } = await serverSupabase.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch (err) {
    console.warn("[Supabase] Token verification error:", err);
    return null;
  }
}
