import { useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/lib/apiConfig";
import {
  type PortalId,
  isPortalStreamConnected,
  setPortalStreamConnected,
  subscribePortalStreamStatus,
} from "@/lib/portalAuth";
import { trpc } from "@/lib/trpc";

export type PortalStreamStatus = "idle" | "connecting" | "connected" | "error";

export interface PortalStreamEventPayload {
  type: string;
  portal: PortalId;
  action?: string;
  publicCode?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

type ListenerEntry = {
  onEvent?: (payload: PortalStreamEventPayload) => void;
};

type ManagedStream = {
  key: string;
  portal: PortalId;
  trackingCode: string | null;
  es: EventSource | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  status: PortalStreamStatus;
  subscribers: Set<ListenerEntry>;
  statusListeners: Set<(status: PortalStreamStatus) => void>;
};

const managedStreams = new Map<string, ManagedStream>();

function getStreamKey(portal: PortalId, trackingCode?: string | null): string {
  return trackingCode ? `${portal}:${trackingCode}` : portal;
}

function updateManagedStatus(stream: ManagedStream, nextStatus: PortalStreamStatus) {
  stream.status = nextStatus;
  setPortalStreamConnected(stream.portal, nextStatus === "connected");
  stream.statusListeners.forEach((cb) => {
    try {
      cb(nextStatus);
    } catch {}
  });
}

function dispatchStreamEvent(stream: ManagedStream, eventType: string, rawData: string) {
  let parsed: PortalStreamEventPayload;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    parsed = { type: eventType, portal: stream.portal };
  }
  stream.subscribers.forEach((sub) => {
    try {
      sub.onEvent?.(parsed);
    } catch {}
  });
}

function closeManagedStream(stream: ManagedStream) {
  if (stream.reconnectTimer) {
    clearTimeout(stream.reconnectTimer);
    stream.reconnectTimer = null;
  }
  if (stream.es) {
    try {
      stream.es.close();
    } catch {}
    stream.es = null;
  }
  updateManagedStatus(stream, "idle");
}

function openManagedStream(stream: ManagedStream) {
  if (typeof EventSource === "undefined") return;
  if (stream.es) {
    try {
      stream.es.close();
    } catch {}
    stream.es = null;
  }

  const params = new URLSearchParams({ portal: stream.portal });
  if (stream.trackingCode) {
    params.set("code", stream.trackingCode);
  }
  const streamUrl = getApiUrl(`/api/realtime/stream?${params.toString()}`);
  updateManagedStatus(stream, "connecting");

  const es = new EventSource(streamUrl, { withCredentials: true });
  stream.es = es;

  es.addEventListener("connected", () => {
    stream.reconnectAttempts = 0;
    updateManagedStatus(stream, "connected");
  });

  const eventTypes = [
    "incident_update",
    "mission_offer",
    "hospital_update",
    "shelter_update",
    "safety_request_update",
    "post_rescue_update",
    "chat_message",
    "user_update",
    "access_code_revoked",
  ] as const;

  for (const eventType of eventTypes) {
    es.addEventListener(eventType, (evt: MessageEvent) => {
      dispatchStreamEvent(stream, eventType, evt.data);
    });
  }

  es.onerror = () => {
    updateManagedStatus(stream, "error");
    try {
      es.close();
    } catch {}
    stream.es = null;

    if (stream.subscribers.size === 0) return;

    const attempt = stream.reconnectAttempts++;
    const delayMs = Math.min(2000 * Math.pow(2, attempt), 30_000);
    stream.reconnectTimer = setTimeout(() => {
      if (stream.subscribers.size > 0 && !stream.es) {
        openManagedStream(stream);
      }
    }, delayMs);
  };
}

/**
 * Subscribe to the SSE connection status for a specific portal without opening a new EventSource.
 */
export function usePortalConnectionStatus(portal: PortalId): boolean {
  const [connected, setConnected] = useState(() => isPortalStreamConnected(portal));

  useEffect(() => {
    setConnected(isPortalStreamConnected(portal));
    return subscribePortalStreamStatus((changedPortal, isConnected) => {
      if (changedPortal === portal) {
        setConnected(isConnected);
      }
    });
  }, [portal]);

  return connected;
}

/**
 * Connects cleanly to the portal-scoped SSE stream (`/api/realtime/stream?portal=...`),
 * sharing a single EventSource per portal within the browser tab and invalidating only
 * that portal's queries when real-time updates arrive.
 */
export function usePortalStream(
  portal: PortalId,
  options?: {
    enabled?: boolean;
    trackingCode?: string | null;
    onAccessCodeRevoked?: (payload: PortalStreamEventPayload) => void;
    onCustomEvent?: (payload: PortalStreamEventPayload) => void;
  }
) {
  const enabled = options?.enabled ?? true;
  const trackingCode = options?.trackingCode ?? null;
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<PortalStreamStatus>(() =>
    isPortalStreamConnected(portal) ? "connected" : "idle"
  );

  const onAccessCodeRevokedRef = useRef(options?.onAccessCodeRevoked);
  onAccessCodeRevokedRef.current = options?.onAccessCodeRevoked;

  const onCustomEventRef = useRef(options?.onCustomEvent);
  onCustomEventRef.current = options?.onCustomEvent;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setStatus("idle");
      return;
    }

    const key = getStreamKey(portal, trackingCode);
    let stream = managedStreams.get(key);
    if (!stream) {
      stream = {
        key,
        portal,
        trackingCode,
        es: null,
        reconnectTimer: null,
        reconnectAttempts: 0,
        status: "idle",
        subscribers: new Set(),
        statusListeners: new Set(),
      };
      managedStreams.set(key, stream);
    }

    const handleEvent = (payload: PortalStreamEventPayload) => {
      onCustomEventRef.current?.(payload);

      switch (payload.type) {
        case "access_code_revoked":
          onAccessCodeRevokedRef.current?.(payload);
          void utils.auth.checkSessionVersion.invalidate({ portal });
          break;

        case "incident_update":
          if (portal === "admin") {
            void utils.rescue.operations.incidents.invalidate();
            void utils.rescue.operations.analytics.invalidate();
            void utils.rescue.operations.mapLayers.invalidate();
          } else if (portal === "hospital") {
            void utils.rescue.operations.hospitalCases.invalidate();
            void utils.rescue.operations.hospitalActivityTimeline.invalidate();
            void utils.rescue.operations.mapLayers.invalidate();
          } else if (portal === "rescuer") {
            void utils.rescue.rescuer.missions.invalidate();
            void utils.rescue.rescuer.activeOffer.invalidate();
            void utils.rescue.rescuer.notifications.invalidate();
            void utils.rescue.operations.mapLayers.invalidate();
          } else if (portal === "citizen") {
            if (payload.publicCode) {
              void utils.rescue.emergency.statusByCode.invalidate({
                publicCode: payload.publicCode,
              });
            }
            void utils.rescue.emergency.mine.invalidate();
          }
          break;

        case "mission_offer":
          if (portal === "rescuer") {
            void utils.rescue.rescuer.activeOffer.invalidate();
            void utils.rescue.rescuer.notifications.invalidate();
            void utils.rescue.rescuer.missions.invalidate();
          } else if (portal === "admin") {
            void utils.rescue.operations.incidents.invalidate();
            void utils.rescue.operations.rescueRoster.invalidate();
          }
          break;

        case "hospital_update":
          if (portal === "admin") {
            void utils.rescue.operations.hospitals.invalidate();
            void utils.rescue.operations.hospitalRegistrationRequests.invalidate();
            void utils.rescue.operations.mapLayers.invalidate();
            void utils.rescue.operations.hospitalCases.invalidate();
          } else if (portal === "hospital") {
            void utils.rescue.operations.hospitals.invalidate();
            void utils.rescue.operations.myBranches.invalidate();
            void utils.rescue.operations.myHospital.invalidate();
            void utils.rescue.operations.hospitalCases.invalidate();
            void utils.rescue.operations.hospitalActivityTimeline.invalidate();
            void utils.rescue.operations.mapLayers.invalidate();
          } else if (portal === "rescuer") {
            void utils.rescue.operations.mapLayers.invalidate();
          } else if (portal === "citizen") {
            void utils.rescue.safety.resources.invalidate();
            void utils.rescue.hospital.mine.invalidate();
          }
          break;

        case "shelter_update":
          if (portal === "admin" || portal === "hospital" || portal === "rescuer") {
            void utils.rescue.operations.mapLayers.invalidate();
          }
          if (portal === "citizen") {
            void utils.rescue.safety.resources.invalidate();
          }
          break;

        case "safety_request_update":
          if (portal === "admin" || portal === "hospital" || portal === "rescuer") {
            void utils.rescue.safety.queue.invalidate();
          }
          if (portal === "citizen") {
            void utils.rescue.safety.mine.invalidate();
          }
          break;

        case "post_rescue_update":
          if (portal === "admin") {
            void utils.rescue.operations.postRescueRecords.invalidate();
          }
          break;

        case "chat_message":
          if (portal === "citizen" && payload.publicCode) {
            void utils.rescue.emergency.chatByCode.invalidate({
              publicCode: payload.publicCode,
            });
          } else if (portal === "rescuer") {
            void utils.rescue.rescuer.missionMessages.invalidate();
          }
          break;

        case "user_update":
          if (portal === "admin") {
            void utils.rescue.operations.adminUsersList.invalidate();
            void utils.auth.listUsers.invalidate();
            void utils.rescue.operations.availableUsers.invalidate();
            void utils.rescue.operations.rescueRoster.invalidate();
            void utils.rescue.operations.rescuerRegistrationRequests.invalidate();
          }
          break;
      }
    };

    const entry: ListenerEntry = { onEvent: handleEvent };
    const statusCb = (next: PortalStreamStatus) => setStatus(next);

    stream.subscribers.add(entry);
    stream.statusListeners.add(statusCb);
    setStatus(stream.status);

    if (!stream.es && !stream.reconnectTimer) {
      openManagedStream(stream);
    }

    return () => {
      stream!.subscribers.delete(entry);
      stream!.statusListeners.delete(statusCb);
      if (stream!.subscribers.size === 0) {
        closeManagedStream(stream!);
        managedStreams.delete(key);
      }
    };
  }, [portal, trackingCode, enabled, utils]);

  return {
    status,
    connected: status === "connected",
  };
}
