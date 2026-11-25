/**
 * MULTI-PORTAL REAL-TIME SERVER-SENT EVENTS (SSE) HUB
 * Manages completely independent live SSE connections across all four LifeLink portals:
 * - citizen
 * - rescuer
 * - hospital
 * - admin
 *
 * Security & Isolation Guarantees:
 * - Authenticates strictly using the requested portal's own cookie/JWT
 * - Disconnecting, logging out, or closing an SSE stream in one portal never
 *   touches or terminates SSE connections in other portals or other users' tabs
 * - Strict per-user filtering prevents cross-user data leakage on Citizen/Rescuer channels
 */

import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import {
  PORTAL_IDS,
  type PortalId,
  isRoleAllowedInPortal,
  normalizePortalId,
} from "@shared/const";
import { isOriginAllowed, normalizeOrigin } from "../_core/cors";
import { sdk } from "../_core/sdk";
import { getRoleCodeVersion } from "../db";

export type PortalSseEventType =
  | "connected"
  | "incident_update"
  | "mission_offer"
  | "hospital_update"
  | "shelter_update"
  | "safety_request_update"
  | "post_rescue_update"
  | "chat_message"
  | "user_update"
  | "access_code_revoked";

export interface PortalRealtimeBroadcast {
  type: Exclude<PortalSseEventType, "connected">;
  portals: PortalId[];
  /** When set, only clients matching one of these user IDs receive the event (plus admin if admin is in portals unless restrictAdminToTargets is true). */
  targetUserIds?: number[];
  /** Optional SOS public code filter (e.g. for tracking page chat updates). */
  publicCode?: string;
  action?: string;
  data?: Record<string, unknown>;
}

interface SseClient {
  id: string;
  portal: PortalId;
  userId: number | null;
  role: string | null;
  trackingCode: string | null;
  res: Response;
  heartbeatTimer: NodeJS.Timeout;
  connectedAt: number;
}

const MAX_TOTAL_SSE_CLIENTS = 2000;
const MAX_CLIENTS_PER_PORTAL_USER = 20;
const HEARTBEAT_INTERVAL_MS = 15_000;

const clientsByPortal: Record<PortalId, Set<SseClient>> = {
  citizen: new Set(),
  rescuer: new Set(),
  hospital: new Set(),
  admin: new Set(),
};

export const portalStreamRouter = Router();

function getTotalSseClients(): number {
  let total = 0;
  for (const portal of PORTAL_IDS) {
    total += clientsByPortal[portal].size;
  }
  return total;
}

function getUserPortalClientCount(portal: PortalId, userId: number): number {
  let count = 0;
  clientsByPortal[portal].forEach(client => {
    if (client.userId === userId) count++;
  });
  return count;
}

function removeClient(client: SseClient): void {
  clearInterval(client.heartbeatTimer);
  clientsByPortal[client.portal].delete(client);
}

function writeSseFrame(client: SseClient, eventName: PortalSseEventType, payload: unknown): boolean {
  try {
    const serialized = JSON.stringify(payload);
    client.res.write(`event: ${eventName}\ndata: ${serialized}\n\n`);
    return true;
  } catch {
    removeClient(client);
    return false;
  }
}

portalStreamRouter.get("/api/realtime/stream", async (req: Request, res: Response) => {
  const origin = req.headers.origin;
  if (origin && !isOriginAllowed(origin)) {
    res.status(403).json({ error: "Origin not allowed by CORS policy." });
    return;
  }

  const portal =
    normalizePortalId(req.query.portal) ?? sdk.resolveRequestPortal(req);
  if (!portal) {
    res.status(400).json({ error: "Missing or invalid portal parameter." });
    return;
  }

  let user = null;
  try {
    user = await sdk.authenticateRequestSafe(req, { portal });
  } catch (err) {
    console.error("[PortalSSE] Authentication DB error:", err);
    res.status(500).json({ error: "Authentication service temporarily unavailable." });
    return;
  }

  // Strictly enforce portal authorization for operational portals
  if (portal !== "citizen") {
    if (!user || user.status === "disabled" || !isRoleAllowedInPortal(user.role, portal)) {
      res.status(401).json({ error: `Authentication required for ${portal} portal.` });
      return;
    }
  } else if (user && user.status === "disabled") {
    res.status(403).json({ error: "Your account has been disabled." });
    return;
  }

  if (getTotalSseClients() >= MAX_TOTAL_SSE_CLIENTS) {
    res.status(503).json({ error: "Real-time stream capacity reached." });
    return;
  }

  if (user && getUserPortalClientCount(portal, user.id) >= MAX_CLIENTS_PER_PORTAL_USER) {
    // Evict oldest connection for this user on this portal only to avoid blocking multi-tab usage
    const oldest = Array.from(clientsByPortal[portal]).find(c => c.userId === user!.id);
    if (oldest) {
      removeClient(oldest);
      try {
        oldest.res.end();
      } catch {}
    }
  }

  const rawCode = typeof req.query.code === "string" ? req.query.code.trim().toUpperCase() : "";
  const trackingCode = /^SOS-[A-Z0-9]{8}$/.test(rawCode) ? rawCode : null;

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (origin && isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", normalizeOrigin(origin) || origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.flushHeaders?.();

  const clientId = randomUUID();
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(`: heartbeat ${portal}\n\n`);
    } catch {
      removeClient(client);
    }
  }, HEARTBEAT_INTERVAL_MS);

  const client: SseClient = {
    id: clientId,
    portal,
    userId: user?.id ?? null,
    role: user?.role ?? null,
    trackingCode,
    res,
    heartbeatTimer,
    connectedAt: Date.now(),
  };

  clientsByPortal[portal].add(client);

  writeSseFrame(client, "connected", {
    type: "connected",
    portal,
    clientId,
    authenticated: Boolean(user),
    userId: user?.id ?? null,
    role: user?.role ?? null,
    timestamp: new Date().toISOString(),
  });

  // Immediately verify codeVersion for operational roles without affecting other portals
  if (
    user &&
    (user.role === "rescuer" || user.role === "hospital" || user.role === "medical") &&
    user.loginMethod !== "test"
  ) {
    try {
      const roleToCheck = user.role === "medical" ? "hospital" : user.role;
      const currentVersion = await getRoleCodeVersion(roleToCheck);
      if (user.codeVersion !== undefined && user.codeVersion !== currentVersion) {
        writeSseFrame(client, "access_code_revoked", {
          type: "access_code_revoked",
          portal,
          role: user.role,
          currentVersion,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Non-fatal check
    }
  }

  const handleClose = () => {
    removeClient(client);
  };

  req.on("close", handleClose);
  res.on("close", handleClose);
});

/**
 * Broadcasts a live event cleanly to relevant independent portal SSE streams.
 * Prevents cross-user leakage on Citizen & Rescuer-private updates.
 */
export function broadcastPortalEvent(event: PortalRealtimeBroadcast): number {
  let delivered = 0;
  const timestamp = new Date().toISOString();
  const targetSet =
    event.targetUserIds && event.targetUserIds.length > 0
      ? new Set(event.targetUserIds)
      : null;

  for (const portal of event.portals) {
    const subscribers = clientsByPortal[portal];
    if (!subscribers || subscribers.size === 0) continue;

    for (const client of Array.from(subscribers)) {
      if (portal === "citizen") {
        // Citizen portal security: private events must only reach their owner or matching trackingCode
        const isPublicSignal =
          event.type === "hospital_update" || event.type === "shelter_update";

        if (!isPublicSignal) {
          const matchesUser = client.userId !== null && targetSet?.has(client.userId);
          const matchesCode =
            Boolean(event.publicCode) &&
            Boolean(client.trackingCode) &&
            client.trackingCode === event.publicCode;
          if (!matchesUser && !matchesCode) {
            continue;
          }
        }
      } else if (portal === "rescuer") {
        // Private offers / mission-specific events must only go to targeted rescuers
        if (targetSet && (client.userId === null || !targetSet.has(client.userId))) {
          continue;
        }
      } else if (portal === "hospital") {
        if (targetSet && client.role !== "admin" && (client.userId === null || !targetSet.has(client.userId))) {
          continue;
        }
      }
      // `admin` portal receives operational updates across the platform

      const ok = writeSseFrame(client, event.type, {
        type: event.type,
        portal,
        action: event.action,
        publicCode: event.publicCode,
        data: event.data,
        timestamp,
      });
      if (ok) delivered++;
    }
  }

  return delivered;
}

export function getPortalSseStats() {
  return {
    total: getTotalSseClients(),
    byPortal: {
      citizen: clientsByPortal.citizen.size,
      rescuer: clientsByPortal.rescuer.size,
      hospital: clientsByPortal.hospital.size,
      admin: clientsByPortal.admin.size,
    },
  };
}
