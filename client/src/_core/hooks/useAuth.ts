import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { triggerPostAuthMicPermission } from "@/lib/micPermission";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
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

// Helper for native Capacitor mobile client token isolation
function storeNativeTokenIfPresent(sessionToken?: string) {
  if (sessionToken && typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    try {
      localStorage.setItem("app_native_bearer_token", sessionToken);
    } catch {}
  }
}

// Global state for access code revocation modal
let _globalRevokedDetail: { isOpen: boolean; role?: string | null; adminContactNumber: string } = {
  isOpen: false,
  role: null,
  adminContactNumber: "+91-361-2237011",
};
const _revocationListeners = new Set<(detail: typeof _globalRevokedDetail) => void>();

function notifyRevocationListeners(detail: typeof _globalRevokedDetail) {
  _globalRevokedDetail = detail;
  _revocationListeners.forEach(listener => listener(detail));
}

export function useAuth(options: UseAuthOptions = {}) {
  const {
    redirectOnUnauthenticated = false,
    redirectPath = "/login",
  } = options;
  const utils = trpc.useUtils();

  const [revokedModalState, setRevokedModalState] = useState(_globalRevokedDetail);

  useEffect(() => {
    const listener = (detail: typeof _globalRevokedDetail) => {
      setRevokedModalState(detail);
    };
    _revocationListeners.add(listener);
    return () => {
      _revocationListeners.delete(listener);
    };
  }, []);

  const [initTimeoutReached, setInitTimeoutReached] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setInitTimeoutReached(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const currentUser = meQuery.data ?? null;
  const isOperationalRole = Boolean(
    currentUser &&
      (currentUser.role === "rescuer" ||
        currentUser.role === "hospital" ||
        currentUser.role === "medical")
  );

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

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
        localStorage.removeItem("app_native_bearer_token");
      } catch {}
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  // Periodic 30s session version check for operational roles
  const sessionVersionQuery = trpc.auth.checkSessionVersion.useQuery(undefined, {
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    enabled: isOperationalRole,
    retry: false,
  });

  useEffect(() => {
    if (sessionVersionQuery.data && sessionVersionQuery.data.valid === false && isOperationalRole) {
      const contactNum = sessionVersionQuery.data.adminContactNumber || "+91-361-2237011";
      const role = currentUser?.role;
      void logout();
      notifyRevocationListeners({
        isOpen: true,
        role,
        adminContactNumber: contactNum,
      });
    }
  }, [sessionVersionQuery.data, isOperationalRole, currentUser?.role, logout]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      storeNativeTokenIfPresent((data as any).sessionToken);
      utils.auth.me.setData(undefined, data.user as any);
      await utils.auth.me.invalidate();
      void triggerPostAuthMicPermission();
    },
    onError: (err) => {
      if (err.message.includes("ACCESS_CODE_REVOKED")) {
        void logout();
        notifyRevocationListeners({
          isOpen: true,
          role: currentUser?.role,
          adminContactNumber: "+91-361-2237011",
        });
      }
    }
  });

  const login = useCallback(
    async (params: {
      email: string;
      password: string;
      role?: "user" | "rescuer" | "hospital" | "medical" | "admin";
      governmentCode?: string;
      supabaseToken?: string;
    }) => {
      const res = await loginMutation.mutateAsync(params);
      storeNativeTokenIfPresent((res as any).sessionToken);
      utils.auth.me.setData(undefined, res.user as any);
      await utils.auth.me.invalidate();
      return res;
    },
    [loginMutation, utils]
  );

  const loginAsRole = login;

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (data) => {
      storeNativeTokenIfPresent((data as any).sessionToken);
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
      role?: "user" | "rescuer" | "hospital" | "medical" | "admin";
      governmentCode?: string;
      phone?: string;
      callSign?: string;
      supabaseUserId?: string;
      supabaseToken?: string;
    }) => {
      const res = await registerMutation.mutateAsync(params);
      storeNativeTokenIfPresent((res as any).sessionToken);
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
      storeNativeTokenIfPresent((res as any).sessionToken);
      utils.auth.me.setData(undefined, res.user as any);
      await utils.auth.me.invalidate();
      return res;
    },
    [loginMutation, utils]
  );

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
          storeNativeTokenIfPresent((res as any).sessionToken);
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
    // Authoritative user comes strictly from the server-side auth.me query
    const effectiveUser = meQuery.data ?? null;
    return {
      user: effectiveUser,
      loading: !initTimeoutReached && meQuery.isLoading && !effectiveUser,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(effectiveUser),
    };
  }, [meQuery.data, meQuery.isLoading, meQuery.error, initTimeoutReached]);

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: async (data) => {
      if (data.user) {
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

  const closeRevokedModal = useCallback(() => {
    notifyRevocationListeners({
      isOpen: false,
      role: null,
      adminContactNumber: _globalRevokedDetail.adminContactNumber,
    });
  }, []);

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
    revokedModalState,
    closeRevokedModal,
  };
}
