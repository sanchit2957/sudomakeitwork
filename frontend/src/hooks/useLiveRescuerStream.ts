/**
 * useLiveRescuerStream
 * React hook connecting the citizen tracking page to the real-time SSE stream.
 * Features:
 * - Single EventSource per publicCode, no duplicate connections
 * - Automatic reconnection with exponential backoff
 * - Connection health tracking + stale detection
 * - Graceful fallback to tRPC polling when SSE is unavailable
 * - Malformed event filtering
 * - Complete cleanup on unmount / code change
 */

import { useEffect, useRef, useState, useCallback } from "react";

/** Threshold (ms) beyond which a rescuer location is considered stale */
export const LIVE_LOCATION_STALE_THRESHOLD_MS = 90_000;

/** Distance threshold (km) below which rescuer is considered "Arriving" */
export const ARRIVING_DISTANCE_KM = 0.5;

export interface LiveRoute {
  distanceKm: number;
  distanceText: string;
  durationMinutes: number;
  etaText: string;
  isApproximate: boolean;
  /** Leaflet [lat, lng] pairs for polyline */
  coordinates: [number, number][];
}

export interface LiveRescuerState {
  callSign: string;
  name: string | null;
  photoUrl: string | null;
  phone: string | null;
  locationStatus: "live" | "paused" | "off";
  latitude: number;
  longitude: number;
  updatedAt: Date;
}

export type SseConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface UseLiveRescuerStreamResult {
  rescuer: LiveRescuerState | null;
  route: LiveRoute | null;
  incidentStatus: "pending" | "dispatched" | "resolved" | null;
  connectionStatus: SseConnectionStatus;
  lastEventAt: Date | null;
  /** True when GPS data is older than LIVE_LOCATION_STALE_THRESHOLD_MS */
  isStale: boolean;
  /** Drives fallback tRPC polling interval (null = SSE is healthy, 4000 = use fallback) */
  pollingIntervalMs: number | null;
}

function validateLiveRescuerData(data: unknown): data is {
  type: string;
  publicCode: string;
  incidentStatus: string;
  rescuer: {
    callSign: string;
    name: string | null;
    photoUrl: string | null;
    phone: string | null;
    locationStatus: string;
    latitude: number;
    longitude: number;
    updatedAt: string;
  } | null;
  route: {
    distanceKm: number;
    distanceText: string;
    durationMinutes: number;
    etaText: string;
    isApproximate: boolean;
    coordinates: [number, number][];
  } | null;
} {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (typeof d.type !== "string") return false;
  if (typeof d.publicCode !== "string") return false;
  return true;
}

export function useLiveRescuerStream(publicCode: string | null): UseLiveRescuerStreamResult {
  const [rescuer, setRescuer] = useState<LiveRescuerState | null>(null);
  const [route, setRoute] = useState<LiveRoute | null>(null);
  const [incidentStatus, setIncidentStatus] = useState<"pending" | "dispatched" | "resolved" | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<SseConnectionStatus>("connecting");
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const clearStaleTimer = useCallback(() => {
    if (staleTimerRef.current) {
      clearInterval(staleTimerRef.current);
      staleTimerRef.current = null;
    }
  }, []);

  const startStaleDetection = useCallback(() => {
    clearStaleTimer();
    staleTimerRef.current = setInterval(() => {
      setLastEventAt(prev => {
        if (!prev) return prev;
        const age = Date.now() - prev.getTime();
        setIsStale(age > LIVE_LOCATION_STALE_THRESHOLD_MS);
        return prev;
      });
    }, 5_000);
  }, [clearStaleTimer]);

  const closeEventSource = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    clearStaleTimer();
  }, [clearStaleTimer]);

  const connect = useCallback(
    (code: string) => {
      closeEventSource();

      const url = `/api/track/live-stream?code=${encodeURIComponent(code)}`;
      setConnectionStatus("connecting");

      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;

      es.addEventListener("connected", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (!validateLiveRescuerData(data)) return;

          reconnectAttemptsRef.current = 0;
          setConnectionStatus("connected");
          setLastEventAt(new Date());
          setIsStale(false);

          if (data.incidentStatus) {
            setIncidentStatus(data.incidentStatus as "pending" | "dispatched" | "resolved");
          }

          if (data.rescuer) {
            const r = data.rescuer;
            if (
              typeof r.latitude === "number" &&
              typeof r.longitude === "number" &&
              !isNaN(r.latitude) &&
              !isNaN(r.longitude) &&
              r.latitude >= -90 &&
              r.latitude <= 90 &&
              r.longitude >= -180 &&
              r.longitude <= 180
            ) {
              setRescuer({
                callSign: r.callSign,
                name: r.name,
                photoUrl: r.photoUrl,
                phone: r.phone,
                locationStatus: r.locationStatus as "live" | "paused" | "off",
                latitude: r.latitude,
                longitude: r.longitude,
                updatedAt: new Date(r.updatedAt),
              });
            }
          }

          if (data.route) {
            setRoute(data.route as LiveRoute);
          }

          startStaleDetection();
        } catch {
          // Ignore malformed events
        }
      });

      es.addEventListener("rescuer_location", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (!validateLiveRescuerData(data)) return;
          if (!data.rescuer) return;

          const r = data.rescuer;
          // Validate coordinate bounds
          if (
            typeof r.latitude !== "number" ||
            typeof r.longitude !== "number" ||
            isNaN(r.latitude) ||
            isNaN(r.longitude) ||
            r.latitude < -90 ||
            r.latitude > 90 ||
            r.longitude < -180 ||
            r.longitude > 180
          ) {
            return;
          }

          setLastEventAt(new Date());
          setIsStale(false);

          if (data.incidentStatus) {
            setIncidentStatus(data.incidentStatus as "pending" | "dispatched" | "resolved");
          }

          setRescuer({
            callSign: r.callSign,
            name: r.name,
            photoUrl: r.photoUrl,
            phone: r.phone,
            locationStatus: r.locationStatus as "live" | "paused" | "off",
            latitude: r.latitude,
            longitude: r.longitude,
            updatedAt: new Date(r.updatedAt),
          });

          if (data.route) {
            setRoute(data.route as LiveRoute);
          }
        } catch {
          // Ignore malformed events
        }
      });

      es.addEventListener("mission_status", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.incidentStatus) {
            setIncidentStatus(data.incidentStatus as "pending" | "dispatched" | "resolved");
          }
          setLastEventAt(new Date());
          if (data.incidentStatus === "resolved") {
            closeEventSource();
            setConnectionStatus("disconnected");
            clearStaleTimer();
          }
        } catch {
          // Ignore malformed events
        }
      });

      es.onerror = () => {
        setConnectionStatus("error");
        es.close();
        esRef.current = null;

        // Exponential backoff: 2s, 4s, 8s, up to 30s
        const attempts = reconnectAttemptsRef.current;
        reconnectAttemptsRef.current = attempts + 1;
        const delay = Math.min(2000 * Math.pow(2, attempts), 30_000);

        reconnectTimerRef.current = setTimeout(() => {
          if (esRef.current === null) {
            connect(code);
          }
        }, delay);
      };
    },
    [closeEventSource, clearStaleTimer, startStaleDetection]
  );

  useEffect(() => {
    if (!publicCode || !/^SOS-[A-Z0-9]{8}$/.test(publicCode)) {
      closeEventSource();
      setConnectionStatus("disconnected");
      return;
    }

    reconnectAttemptsRef.current = 0;
    connect(publicCode);

    return () => {
      closeEventSource();
    };
  }, [publicCode, connect, closeEventSource]);

  // Polling interval: null when SSE is healthy, 4000ms when SSE is disconnected/error
  const pollingIntervalMs =
    connectionStatus === "connected" ? null : 4_000;

  return {
    rescuer,
    route,
    incidentStatus,
    connectionStatus,
    lastEventAt,
    isStale,
    pollingIntervalMs,
  };
}
