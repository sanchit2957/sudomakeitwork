import { startLogin } from "@/const";
import {
  type PortalId,
  broadcastPortalAuthEvent,
  clearNativePortalToken,
  getCurrentPortal,
  getPortalForPath,
  setNativePortalToken,
  subscribeSamePortalAuthEvents,
} from "@/lib/portalAuth";
import { usePortalConnectionStatus } from "@/hooks/usePortalStream";
import { trpc } from "@/lib/trpc";
import { isRoleAllowedInPortal } from "@shared/const";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";
import {
  isSupabaseConfigured,
  supabase,
  supabaseSendOtp,
  supabaseSignOut,
  supabaseVerifyOtp,
  getSupabaseSession,
} from "@/lib/supabase";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
  portalOverride?: PortalId;
};

// Helper for client session token persistence strictly for native mobile bearer authorization, scoped by portal
function storeNativeTokenIfPresent(portal: PortalId, sessionToken?: string) {
  if (sessionToken && typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    setNativePortalToken(portal, sessionToken);
  }
}

// Global state for access code revocation modal (scoped per portal so revoking one never affects another)
type RevokedDetail = { isOpen: boolean; role?: string | null; portal?: PortalId; adminContactNumber: string };
let _globalRevokedDetail: RevokedDetail = {
  isOpen: false,
  role: null,
  portal: undefined,
  adminContactNumber: "+91-361-2237011",
};
const _revocationListeners = new Set<(detail: RevokedDetail) => void>();

// In-flight login promises keyed by portal to avoid cross-portal collisions
const _inFlightLoginPromises = new Map<PortalId, Promise<any>>();

function notifyRevocationListeners(detail: RevokedDetail) {
  _globalRevokedDetail = detail;
  _revocationListeners.forEach(listener => listener(detail));
}

export function useAuth(options: UseAuthOptions = {}) {
  const {
    redirectOnUnauthenticated = false,
    redirectPath,
    portalOverride,
  } = options;
  const [location] = useLocation();
  const activePortal: PortalId =
    portalOverride ??
    getPortalForPath(
      location || (typeof window !== "undefined" ? window.location.pathname : "/")
    );
  const sseConnected = usePortalConnectionStatus(activePortal);
  const utils = trpc.useUtils();

  const [revokedModalState, setRevokedModalState] = useState(_globalRevokedDetail);

  useEffect(() => {
    const listener = (detail: RevokedDetail) => {
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

  const meQuery = trpc.auth.me.useQuery(
    { portal: activePortal },
    {
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  // Store last known user per portal so SPA navigation across portals never flickers another portal's session
  const [lastKnownByPortal, setLastKnownByPortal] = useState<Partial<Record<PortalId, any>>>(() => ({
    [activePortal]: meQuery.data ?? null,
  }));

  useEffect(() => {
    if (meQuery.data !== undefined) {
      setLastKnownByPortal(prev => ({
        ...prev,
        [activePortal]: meQuery.data,
      }));
    } else if (
      meQuery.error &&
      meQuery.error.data?.code === "UNAUTHORIZED"
    ) {
      setLastKnownByPortal(prev => ({
        ...prev,
        [activePortal]: null,
      }));
    }
  }, [activePortal, meQuery.data, meQuery.error]);

  // Synchronize auth state strictly across tabs of the SAME portal (never cross-portal)
  const activePortalRef = useRef(activePortal);
  activePortalRef.current = activePortal;
  useEffect(() => {
    return subscribeSamePortalAuthEvents(activePortal, (action) => {
      if (action === "logout") {
        setLastKnownByPortal(prev => ({ ...prev, [activePortal]: null }));
        utils.auth.me.setData({ portal: activePortal }, null);
      }
      void utils.auth.me.invalidate({ portal: activePortal });
    });
  }, [activePortal, utils]);

  const effectiveUser =
    meQuery.data !== undefined
      ? meQuery.data
      : lastKnownByPortal[activePortal] !== undefined
        ? lastKnownByPortal[activePortal]
        : null;
  const currentUser = effectiveUser;

  const isOperationalRole = Boolean(
    currentUser &&
      isRoleAllowedInPortal(currentUser.role, activePortal) &&
      (currentUser.role === "rescuer" ||
        currentUser.role === "hospital" ||
        currentUser.role === "medical")
  );

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: (_data, variables) => {
      const targetPortal = variables?.portal ?? activePortal;
      setLastKnownByPortal(prev => ({ ...prev, [targetPortal]: null }));
      utils.auth.me.setData({ portal: targetPortal }, null);
    },
  });

  const logout = useCallback(async (targetPortalOverride?: PortalId) => {
    const portalToLogout = targetPortalOverride ?? activePortalRef.current;
    try {
      if (portalToLogout === "citizen") {
        await supabaseSignOut();
      }
      await logoutMutation.mutateAsync({ portal: portalToLogout });
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      clearNativePortalToken(portalToLogout);
      setLastKnownByPortal(prev => ({ ...prev, [portalToLogout]: null }));
      utils.auth.me.setData({ portal: portalToLogout }, null);
      await utils.auth.me.invalidate({ portal: portalToLogout });
      broadcastPortalAuthEvent(portalToLogout, "logout");
    }
  }, [logoutMutation, utils]);

  // Fallback polling only when SSE stream is disconnected; SSE triggers immediate invalidation on code rotation
  const sessionVersionQuery = trpc.auth.checkSessionVersion.useQuery(
    { portal: activePortal },
    {
      refetchInterval: sseConnected ? false : 30000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      enabled: isOperationalRole,
      retry: false,
    }
  );

  useEffect(() => {
    if (sessionVersionQuery.data && sessionVersionQuery.data.valid === false && isOperationalRole) {
      const contactNum = sessionVersionQuery.data.adminContactNumber || "+91-361-2237011";
      const role = currentUser?.role;
      void logout(activePortal);
      notifyRevocationListeners({
        isOpen: true,
        role,
        portal: activePortal,
        adminContactNumber: contactNum,
      });
    }
  }, [sessionVersionQuery.data, isOperationalRole, currentUser?.role, activePortal, logout]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data, variables) => {
      const targetPortal = variables?.portal ?? activePortal;
      storeNativeTokenIfPresent(targetPortal, (data as any).sessionToken);
      setLastKnownByPortal(prev => ({ ...prev, [targetPortal]: data.user }));
      utils.auth.me.setData({ portal: targetPortal }, data.user as any);
      await utils.auth.me.invalidate({ portal: targetPortal });
      broadcastPortalAuthEvent(targetPortal, "login");
    },
    onError: (err) => {
      if (err.message.includes("ACCESS_CODE_REVOKED")) {
        void logout(activePortal);
        notifyRevocationListeners({
          isOpen: true,
          role: currentUser?.role,
          portal: activePortal,
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
      portal?: PortalId;
      governmentCode?: string;
      supabaseToken?: string;
      isNative?: boolean;
    }) => {
      const targetPortal = params.portal ?? activePortalRef.current;
      const existingPromise = _inFlightLoginPromises.get(targetPortal);
      if (existingPromise) {
        return existingPromise;
      }
      const promise = (async () => {
        try {
          const isNative = typeof params.isNative === "boolean" ? params.isNative : Capacitor.isNativePlatform();
          const res = await loginMutation.mutateAsync({
            ...params,
            portal: targetPortal,
            isNative,
          });
          storeNativeTokenIfPresent(targetPortal, (res as any).sessionToken);
          setLastKnownByPortal(prev => ({ ...prev, [targetPortal]: res.user }));
          utils.auth.me.setData({ portal: targetPortal }, res.user as any);
          await utils.auth.me.invalidate({ portal: targetPortal });
          broadcastPortalAuthEvent(targetPortal, "login");
          return res;
        } finally {
          _inFlightLoginPromises.delete(targetPortal);
        }
      })();
      _inFlightLoginPromises.set(targetPortal, promise);
      return promise;
    },
    [loginMutation, utils]
  );

  const loginAsRole = login;

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (data, variables) => {
      const targetPortal = variables?.portal ?? activePortal;
      storeNativeTokenIfPresent(targetPortal, (data as any).sessionToken);
      setLastKnownByPortal(prev => ({ ...prev, [targetPortal]: data.user }));
      utils.auth.me.setData({ portal: targetPortal }, data.user as any);
      await utils.auth.me.invalidate({ portal: targetPortal });
      broadcastPortalAuthEvent(targetPortal, "login");
    },
  });

  const register = useCallback(
    async (params: {
      name: string;
      email: string;
      password: string;
      role?: "user" | "rescuer" | "hospital" | "medical" | "admin";
      portal?: PortalId;
      governmentCode?: string;
      phone?: string;
      callSign?: string;
      supabaseUserId?: string;
      supabaseToken?: string;
      isNative?: boolean;
    }) => {
      const targetPortal = params.portal ?? activePortalRef.current;
      const isNative = typeof params.isNative === "boolean" ? params.isNative : Capacitor.isNativePlatform();
      const res = await registerMutation.mutateAsync({
        ...params,
        portal: targetPortal,
        isNative,
      });
      storeNativeTokenIfPresent(targetPortal, (res as any).sessionToken);
      setLastKnownByPortal(prev => ({ ...prev, [targetPortal]: res.user }));
      utils.auth.me.setData({ portal: targetPortal }, res.user as any);
      await utils.auth.me.invalidate({ portal: targetPortal });
      broadcastPortalAuthEvent(targetPortal, "login");
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
      return await login({
        email: params.email,
        password: "supabase-otp-verified",
        supabaseToken: sbToken,
        role: params.role ?? "user",
        portal: "citizen",
      });
    },
    [login]
  );

  // Listen for Supabase Magic Link redirect or Auth State Change strictly on Citizen portal
  useEffect(() => {
    if (activePortal !== "citizen") return;
    if (!isSupabaseConfigured() || !supabase) return;

    const handleSession = async (session: any) => {
      if (
        session?.access_token &&
        session?.user?.email &&
        !meQuery.data &&
        !_inFlightLoginPromises.has("citizen")
      ) {
        try {
          await login({
            email: session.user.email,
            password: "supabase-magic-link",
            supabaseToken: session.access_token,
            role: "user",
            portal: "citizen",
          });
          if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        } catch (e) {
          console.warn("[Supabase Auth] Magic link session sync note:", e);
        }
      }
    };

    (supabase.auth as any).getSession().then(({ data }: any) => {
      if (data?.session) {
        handleSession(data.session);
      }
    });

    const { data: authListener } = (supabase.auth as any).onAuthStateChange((_event: any, session: any) => {
      if (session) {
        handleSession(session);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [activePortal, login, meQuery.data]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading) return;
    if (effectiveUser) return;
    if (meQuery.error && meQuery.error.data?.code !== "UNAUTHORIZED") {
      return;
    }
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
    startLogin(redirectPath, getCurrentPortal());
  }, [redirectOnUnauthenticated, redirectPath, meQuery.isLoading, effectiveUser, meQuery.error]);

  const state = useMemo(() => {
    return {
      user: effectiveUser,
      portal: activePortal,
      loading: !initTimeoutReached && meQuery.isLoading && !effectiveUser,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(effectiveUser),
    };
  }, [effectiveUser, activePortal, meQuery.isLoading, meQuery.error, initTimeoutReached]);

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: async (data) => {
      if (data.user) {
        utils.auth.me.setData({ portal: activePortal }, data.user as any);
      }
      await utils.auth.me.invalidate({ portal: activePortal });
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
        setLastKnownByPortal(prev => ({ ...prev, [activePortal]: res.user }));
        utils.auth.me.setData({ portal: activePortal }, res.user as any);
      }
      await utils.auth.me.invalidate({ portal: activePortal });
      return res;
    },
    [activePortal, updateProfileMutation, utils]
  );

  const closeRevokedModal = useCallback(() => {
    notifyRevocationListeners({
      isOpen: false,
      role: null,
      portal: undefined,
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
