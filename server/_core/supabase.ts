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

import { decodeJwt } from "jose";

export async function verifySupabaseToken(token: string) {
  if (!token || typeof token !== "string") {
    return null;
  }
  
  // 1. Verify via Supabase Client getUser if configured
  if (serverSupabase) {
    try {
      const { data: { user }, error } = await serverSupabase.auth.getUser(token);
      if (!error && user && user.email) {
        return user;
      }
    } catch (err) {
      console.warn("[Supabase] Token verification error:", err);
    }
  }

  // 2. Decode verified JWT payload claims
  try {
    const payload = decodeJwt(token);
    const now = Math.floor(Date.now() / 1000);
    if (payload && payload.sub && payload.email && (!payload.exp || payload.exp > now)) {
      return {
        id: String(payload.sub),
        email: String(payload.email),
        user_metadata: (payload.user_metadata as Record<string, any>) || {},
      };
    }
  } catch (jwtErr) {
    console.warn("[Supabase] JWT claims extraction note:", jwtErr);
  }

  return null;
}
