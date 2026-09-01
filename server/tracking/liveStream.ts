/**
 * REAL-TIME SERVER-SENT EVENTS (SSE) TRACKING HUB
 * Broadcasts live rescuer GPS coordinates, road route polylines, and calculated ETAs
 * to connected citizen tracking pages.
 * 
 * Production Features:
 * - Express SSE endpoint: GET /api/track/live-stream?code=<publicCode>
 * - Render / Reverse Proxy keep-alive heartbeats every 15s
 * - Safe client connection management & memory cleanup on disconnect
 * - Victim-safe data serialization
 */

import { Router, Request, Response } from "express";
import { getIncidentByCode, getActiveAssignedRescuerForIncident } from "../rescue.db";
import { presentAssignedRescuerToVictim } from "../rescuer-profile.policy";
import { calculateRoadRouteAndEta } from "../routing/routing.service";

export interface LiveTrackingPayload {
  type: "rescuer_location" | "eta_update" | "connected" | "mission_status";
  publicCode: string;
  incidentStatus: "pending" | "dispatched" | "resolved";
  rescuer: {
    callSign: string;
    name: string | null;
    photoUrl: string | null;
    phone: string | null;
    locationStatus: "live" | "paused" | "off";
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
  destinationHospital?: {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
  } | null;
  timestamp: string;
}

// Active SSE client connections: Map<publicCode, Set<Response>>
const activeSubscribers = new Map<string, Set<Response>>();

export const liveTrackingRouter = Router();

/**
 * Register SSE endpoint: GET /api/track/live-stream?code=SOS-XXXXXXXX
 */
liveTrackingRouter.get("/api/track/live-stream", async (req: Request, res: Response) => {
  const rawCode = req.query.code;
  const publicCode = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";

  // Validate format
  if (!/^SOS-[A-Z0-9]{8}$/.test(publicCode)) {
    res.status(400).json({ error: "Invalid or missing SOS tracking code." });
    return;
  }

  // Validate incident exists
  const incident = await getIncidentByCode(publicCode);
  if (!incident) {
    res.status(404).json({ error: "SOS request not found." });
    return;
  }

  // Set standard SSE HTTP headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable proxy buffering (Nginx, Render)

  // Explicit CORS header for SSE streams
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  res.flushHeaders?.();

  // Register client connection
  if (!activeSubscribers.has(publicCode)) {
    activeSubscribers.set(publicCode, new Set());
  }
  const clientSet = activeSubscribers.get(publicCode)!;
  clientSet.add(res);

  // Send initial connection acknowledgement and initial live state
  const assigned = await getActiveAssignedRescuerForIncident(incident.id);
  let initialPayload: LiveTrackingPayload = {
    type: "connected",
    publicCode,
    incidentStatus: incident.status,
    rescuer: null,
    route: null,
    timestamp: new Date().toISOString(),
  };

  if (assigned && assigned.profile) {
    const presented = presentAssignedRescuerToVictim({
      ...assigned.profile,
      name: assigned.user.name,
    });

    let routeInfo = null;
    if (presented.location) {
      const targetPoint = (incident as any).destinationHospitalId
        ? { latitude: (incident as any).destinationHospitalLatitude || incident.latitude, longitude: (incident as any).destinationHospitalLongitude || incident.longitude }
        : { latitude: incident.latitude, longitude: incident.longitude };

      const computed = await calculateRoadRouteAndEta(
        { latitude: presented.location.latitude, longitude: presented.location.longitude },
        targetPoint
      );

      routeInfo = {
        distanceKm: computed.distanceKm,
        distanceText: computed.distanceText,
        durationMinutes: computed.durationMinutes,
        etaText: computed.etaText,
        isApproximate: computed.isApproximate,
        coordinates: computed.coordinates,
      };
    }

    initialPayload = {
      type: "connected",
      publicCode,
      incidentStatus: incident.status,
      rescuer: {
        callSign: presented.callSign,
        name: presented.name,
        photoUrl: presented.photoUrl,
        phone: presented.phone,
        locationStatus: presented.locationStatus,
        latitude: presented.location?.latitude || 0,
        longitude: presented.location?.longitude || 0,
        updatedAt: presented.location?.updatedAt.toISOString() || new Date().toISOString(),
      },
      route: routeInfo,
      timestamp: new Date().toISOString(),
    };
  }

  // Send initial event
  res.write(`event: connected\ndata: ${JSON.stringify(initialPayload)}\n\n`);

  // Setup periodic 15-second heartbeat to prevent idle proxy disconnects
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeatInterval);
    }
  }, 15_000);

  // Handle client disconnect and resource cleanup
  req.on("close", () => {
    clearInterval(heartbeatInterval);
    const set = activeSubscribers.get(publicCode);
    if (set) {
      set.delete(res);
      if (set.size === 0) {
        activeSubscribers.delete(publicCode);
      }
    }
  });
});

/**
 * Broadcast live tracking update to all connected viewers of an incident.
 */
export function broadcastLiveTrackingUpdate(publicCode: string, payload: LiveTrackingPayload) {
  const subscribers = activeSubscribers.get(publicCode);
  if (!subscribers || subscribers.size === 0) return;

  const dataStr = JSON.stringify(payload);
  const message = `event: rescuer_location\ndata: ${dataStr}\n\n`;

  for (const client of Array.from(subscribers)) {
    try {
      client.write(message);
    } catch (err) {
      subscribers.delete(client);
    }
  }
}

/**
 * Broadcast mission status change (e.g. dispatched, arrived, resolved)
 */
export function broadcastMissionStatusUpdate(
  publicCode: string,
  status: "pending" | "dispatched" | "resolved",
  notes?: string
) {
  const subscribers = activeSubscribers.get(publicCode);
  if (!subscribers || subscribers.size === 0) return;

  const payload = {
    type: "mission_status",
    publicCode,
    incidentStatus: status,
    notes,
    timestamp: new Date().toISOString(),
  };

  const message = `event: mission_status\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const client of Array.from(subscribers)) {
    try {
      client.write(message);
    } catch (err) {
      subscribers.delete(client);
    }
  }
}

/**
 * Diagnostic count of active subscribers
 */
export function getActiveSseSubscriberCount(publicCode?: string): number {
  if (publicCode) {
    return activeSubscribers.get(publicCode)?.size || 0;
  }
  let total = 0;
  for (const set of Array.from(activeSubscribers.values())) {
    total += set.size;
  }
  return total;
}
