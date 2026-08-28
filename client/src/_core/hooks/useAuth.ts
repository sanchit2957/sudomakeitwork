import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
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
    }) => {
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
    }) => {
      const res = await registerMutation.mutateAsync(params);
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

  const logout = useCallback(async () => {
    try {
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
      loading: meQuery.isLoading && !effectiveUser,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(effectiveUser),
    };
  }, [meQuery.data, meQuery.isLoading, meQuery.isFetching, meQuery.error]);

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
    updateProfile,
    logout,
  };
}
