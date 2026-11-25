import {
  PORTAL_HEADER_NAME,
  type PortalId,
  getPortalDashboardPath,
  getPortalForPath,
  getPortalLoginPath,
} from "@shared/portal";

export {
  PORTAL_HEADER_NAME,
  type PortalId,
  getPortalDashboardPath,
  getPortalForPath,
  getPortalLoginPath,
};

const PORTAL_AUTH_CHANNEL = "sahay-portal-auth-v1";
const TAB_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2, 10)}`;

export function getCurrentPortal(): PortalId {
  if (typeof window === "undefined") return "citizen";
  return getPortalForPath(window.location.pathname);
}

export function getPortalFetchHeaders(portal?: PortalId): Record<string, string> {
  return {
    [PORTAL_HEADER_NAME]: portal ?? getCurrentPortal(),
  };
}

export function portalFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  portalOverride?: PortalId
): Promise<Response> {
  const portal = portalOverride ?? getCurrentPortal();
  const headers = new Headers(init.headers);
  headers.set(PORTAL_HEADER_NAME, portal);
  return globalThis.fetch(input, {
    ...init,
    credentials: init.credentials ?? "include",
    headers,
  });
}

function getNativeTokenKey(portal: PortalId): string {
  return `app_native_bearer_token_${portal}`;
}

export function getNativePortalToken(portal: PortalId): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(getNativeTokenKey(portal));
  } catch {
    return null;
  }
}

export function setNativePortalToken(portal: PortalId, token?: string | null): void {
  if (!token || typeof window === "undefined") return;
  try {
    localStorage.setItem(getNativeTokenKey(portal), token);
  } catch {}
}

export function clearNativePortalToken(portal: PortalId): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getNativeTokenKey(portal));
  } catch {}
}

// Per-portal SSE connection status tracker in this browser tab
const sseStatusByPortal: Record<PortalId, boolean> = {
  citizen: false,
  rescuer: false,
  hospital: false,
  admin: false,
};

const sseStatusListeners = new Set<(portal: PortalId, connected: boolean) => void>();

export function setPortalStreamConnected(portal: PortalId, connected: boolean): void {
  if (sseStatusByPortal[portal] === connected) return;
  sseStatusByPortal[portal] = connected;
  sseStatusListeners.forEach((listener) => {
    try {
      listener(portal, connected);
    } catch {}
  });
}

export function isPortalStreamConnected(portal?: PortalId): boolean {
  const target = portal ?? getCurrentPortal();
  return sseStatusByPortal[target];
}

export function subscribePortalStreamStatus(
  listener: (portal: PortalId, connected: boolean) => void
): () => void {
  sseStatusListeners.add(listener);
  return () => {
    sseStatusListeners.delete(listener);
  };
}

export type PortalAuthBroadcastMessage = {
  portal: PortalId;
  action: "login" | "logout";
  tabId: string;
  timestamp: number;
};

export function broadcastPortalAuthEvent(portal: PortalId, action: "login" | "logout"): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(PORTAL_AUTH_CHANNEL);
    const payload: PortalAuthBroadcastMessage = {
      portal,
      action,
      tabId: TAB_ID,
      timestamp: Date.now(),
    };
    channel.postMessage(payload);
    channel.close();
  } catch {}
}

export function subscribeSamePortalAuthEvents(
  portal: PortalId,
  onEvent: (action: "login" | "logout") => void
): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(PORTAL_AUTH_CHANNEL);
    channel.onmessage = (event: MessageEvent<PortalAuthBroadcastMessage>) => {
      const msg = event?.data;
      if (!msg || msg.tabId === TAB_ID) return;
      // Strict portal isolation: ignore events belonging to other portals
      if (msg.portal !== portal) return;
      onEvent(msg.action);
    };
  } catch {
    return () => {};
  }
  return () => {
    try {
      channel?.close();
    } catch {}
  };
}
