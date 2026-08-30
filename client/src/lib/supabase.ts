import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL ||
  "https://efolfdoisgxptcbawejp.supabase.co";

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_EjeAtAGh9DXQLNvuW4axKA_fjBg5hxy";

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.trim() !== "" &&
    supabaseAnonKey.trim() !== "" &&
    !supabaseUrl.includes("your-project-id")
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    })
  : null;

export async function supabaseSignIn(email: string, password: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function supabaseSignUp(email: string, password: string, metadata?: Record<string, any>) {
  if (!supabase) {
    throw new Error("Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });
  if (error) throw error;
  return data;
}

// Production site URL for magic link redirects
const PRODUCTION_SITE_URL = import.meta.env.VITE_SITE_URL || "https://assam-rescue-platform.onrender.com";

function getRedirectUrl(): string {
  if (typeof window === "undefined") return PRODUCTION_SITE_URL;
  const origin = window.location.origin;
  // If running on localhost, still redirect to production so magic links work
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return PRODUCTION_SITE_URL;
  }
  return origin;
}

export async function supabaseSendOtp(email: string, options?: { shouldCreateUser?: boolean; metadata?: Record<string, any>; emailRedirectTo?: string }) {
  if (!supabase) {
    throw new Error("Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  const emailRedirectTo = options?.emailRedirectTo || getRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: options?.shouldCreateUser ?? true,
      data: options?.metadata,
      emailRedirectTo,
    },
  });
  if (error) throw error;
  return data;
}

export async function supabaseVerifyOtp(email: string, token: string, type: "email" | "magiclink" | "signup" = "email") {
  if (!supabase) {
    throw new Error("Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  // Try with specified type first, with cascade fallbacks for magiclink and signup
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: type as any,
    });
    if (error) {
      const retry1 = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: "magiclink",
      });
      if (!retry1.error) return retry1.data;

      const retry2 = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: "signup",
      });
      if (!retry2.error) return retry2.data;

      throw error;
    }
    return data;
  } catch (err: any) {
    throw err;
  }
}

export async function supabaseResendOtp(email: string, type: "signup" | "email_change" = "signup") {
  if (!supabase) {
    throw new Error("Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  const { data, error } = await supabase.auth.resend({
    type,
    email: email.trim(),
  });
  if (error) throw error;
  return data;
}

export async function supabaseSignOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.warn("[Supabase] SignOut error:", error.message);
  }
}

export async function getSupabaseSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

