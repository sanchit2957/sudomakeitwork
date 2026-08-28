import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { triggerPostAuthMicPermission } from "@/lib/micPermission";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isSupabaseConfigured,
  supabase,
  supabaseSendOtp,
  supabaseSignIn,
  supabaseSignOut,
  supabaseSignUp,
  supabaseVerifyOtp,
  getSupabaseSession,
} from "@/lib/supabase";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options: UseAuthOptions = {}) {
  const {
    redirectOnUnauthenticated = false,
    redirectPath = "/login",
  } = options;
  const utils = trpc.useUtils();

  const [initTimeoutReached, setInitTimeoutReached] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setInitTimeoutReached(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      if (data.sessionToken) {
        try {
          localStorage.setItem("app-runtime-session-token", data.sessionToken);
          localStorage.setItem("app-runtime-user-info", JSON.stringify(data.user));
        } catch {}
      }
      utils.auth.me.setData(undefined, data.user as any);
      await utils.auth.me.invalidate();
      void triggerPostAuthMicPermission();
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const login = useCallback(
    async (params: {
      email: string;
      password: string;
      supabaseToken?: string;
    }) => {
      if (isSupabaseConfigured() && !params.supabaseToken) {
        try {
          const sbRes = await supabaseSignIn(params.email, params.password);
          if (sbRes?.session?.access_token) {
            params.supabaseToken = sbRes.session.access_token;
          }
        } catch (sbErr) {
          console.warn("[Supabase Auth] Direct sign-in note:", sbErr);
        }
      }

      const res = await loginMutation.mutateAsync(params);
      if (res.sessionToken) {
        try {
          localStorage.setItem("app-runtime-session-token", res.sessionToken);
          localStorage.setItem("app-runtime-user-info", JSON.stringify(res.user));
        } catch {}
      }
      utils.auth.me.setData(undefined, res.user as any);
      await utils.auth.me.invalidate();
      return res;
    },
    [loginMutation, utils]
  );

  const loginAsRole = login;

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (data) => {
      if (data.sessionToken) {
        try {
          localStorage.setItem("app-runtime-session-token", data.sessionToken);
          localStorage.setItem("app-runtime-user-info", JSON.stringify(data.user));
        } catch {}
      }
      utils.auth.me.setData(undefined, data.user as any);
      await utils.auth.me.invalidate();
      void triggerPostAuthMicPermission();
    },
  });

  const register = useCallback(
    async (params: {
      name: string;
      email: string;
      password: string;
      role?: "user" | "rescuer" | "medical" | "admin";
      phone?: string;
      callSign?: string;
      supabaseUserId?: string;
      supabaseToken?: string;
    }) => {
      let sbUserId: string | undefined;
      let sbToken: string | undefined;

      if (isSupabaseConfigured()) {
        try {
          const sbRes = await supabaseSignUp(params.email, params.password, {
            name: params.name,
            phone: params.phone,
            role: params.role || "user",
          });
          if (sbRes?.user?.id) {
            sbUserId = sbRes.user.id;
          }
          if (sbRes?.session?.access_token) {
            sbToken = sbRes.session.access_token;
          }
        } catch (sbErr: any) {
          console.warn("[Supabase Auth] Direct sign-up note:", sbErr);
          throw new Error(sbErr?.message || "Supabase registration failed.");
        }
      }

      const res = await registerMutation.mutateAsync({
        ...params,
        supabaseUserId: sbUserId,
        supabaseToken: sbToken,
      });

      if (res.sessionToken) {
        try {
          localStorage.setItem("app-runtime-session-token", res.sessionToken);
          localStorage.setItem("app-runtime-user-info", JSON.stringify(res.user));
        } catch {}
      }
      utils.auth.me.setData(undefined, res.user as any);
      await utils.auth.me.invalidate();
      return res;
    },
    [registerMutation, utils]
  );

  const sendEmailOtp = useCallback(async (email: string, metadata?: Record<string, any>) => {
    return await supabaseSendOtp(email, { metadata });
  }, []);

  const verifyEmailOtp = useCallback(
    async (params: {
      email: string;
      token: string;
      name?: string;
      phone?: string;
      role?: "user" | "rescuer" | "hospital" | "medical" | "admin";
    }) => {
      const sbRes = await supabaseVerifyOtp(params.email, params.token, "email");
      let sbToken = sbRes?.session?.access_token;
      if (!sbToken) {
        const session = await getSupabaseSession();
        sbToken = session?.access_token;
      }
      const res = await loginMutation.mutateAsync({
        email: params.email,
        password: "supabase-otp-verified",
        supabaseToken: sbToken,
      });
      if (res.sessionToken) {
        try {
          localStorage.setItem("app-runtime-session-token", res.sessionToken);
          localStorage.setItem("app-runtime-user-info", JSON.stringify(res.user));
        } catch {}
      }
      utils.auth.me.setData(undefined, res.user as any);
      await utils.auth.me.invalidate();
      return res;
    },
    [loginMutation, utils]
  );

  const logout = useCallback(async () => {
    try {
      await supabaseSignOut();
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      try {
        localStorage.removeItem("app-runtime-session-token");
        localStorage.removeItem("app-runtime-user-info");
      } catch {}
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  // Listen for Supabase Magic Link redirect or Auth State Change
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;

    const handleSession = async (session: any) => {
      if (session?.access_token && session?.user?.email && !meQuery.data) {
        try {
          const res = await loginMutation.mutateAsync({
            email: session.user.email,
            password: "supabase-magic-link",
            supabaseToken: session.access_token,
          });
          if (res.sessionToken) {
            localStorage.setItem("app-runtime-session-token", res.sessionToken);
            localStorage.setItem("app-runtime-user-info", JSON.stringify(res.user));
          }
          utils.auth.me.setData(undefined, res.user as any);
          await utils.auth.me.invalidate();
          if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        } catch (e) {
          console.warn("[Supabase Auth] Magic link session sync note:", e);
        }
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        handleSession(data.session);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        handleSession(session);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [loginMutation, meQuery.data, utils]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading) return;
    if (meQuery.data) return;
    if (typeof window === "undefined") return;
    const pathname = window.location.pathname;
    if (
      pathname.startsWith("/login") ||
      pathname.startsWith("/admin/login") ||
      pathname.startsWith("/user/login") ||
      pathname.startsWith("/responder/login") ||
      pathname.startsWith("/hospital/login") ||
      pathname.startsWith("/medical/login")
    ) {
      return;
    }
    startLogin(redirectPath);
  }, [redirectOnUnauthenticated, redirectPath, meQuery.isLoading, meQuery.data]);

  const state = useMemo(() => {
    let effectiveUser = meQuery.data ?? null;
    if (!effectiveUser && typeof window !== "undefined") {
      try {
        const storedToken = localStorage.getItem("app-runtime-session-token");
        const storedUser = localStorage.getItem("app-runtime-user-info");
        if (storedToken && storedUser && (meQuery.isLoading || meQuery.isFetching)) {
          effectiveUser = JSON.parse(storedUser);
        }
      } catch {}
    }
    return {
      user: effectiveUser,
      loading: !initTimeoutReached && meQuery.isLoading && !effectiveUser,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(effectiveUser),
    };
  }, [meQuery.data, meQuery.isLoading, meQuery.isFetching, meQuery.error, initTimeoutReached]);

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: async (data) => {
      if (data.user) {
        try {
          localStorage.setItem("app-runtime-user-info", JSON.stringify(data.user));
        } catch {}
        utils.auth.me.setData(undefined, data.user as any);
      }
      await utils.auth.me.invalidate();
    },
  });

  const updateProfile = useCallback(
    async (params: {
      name?: string;
      phone?: string;
      emergencyContact?: string;
      bloodGroup?: string;
      medicalNotes?: string;
      homeDistrict?: string;
      address?: string;
      preferredLanguage?: string;
      safetyNotifications?: boolean;
    }) => {
      const res = await updateProfileMutation.mutateAsync(params);
      if (res.user) {
        try {
          localStorage.setItem("app-runtime-user-info", JSON.stringify(res.user));
        } catch {}
        utils.auth.me.setData(undefined, res.user as any);
      }
      await utils.auth.me.invalidate();
      return res;
    },
    [updateProfileMutation, utils]
  );

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    login,
    loginAsRole,
    register,
    sendEmailOtp,
    verifyEmailOtp,
    updateProfile,
    logout,
  };
}
