import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";
import {
  addIncidentEvent,
  getIncidentByCode,
  getIncidentById,
  updateIncidentAutomationState,
  type MemoryIncident,
} from "./rescue.db";

export interface SosWebhookPayload {
  incidentId: number;
  publicCode: string;
  severity: string;
  status: string;
  emergencyType: string;
  latitude: number;
  longitude: number;
  peopleAffected: number;
  helpNeeded: string | null;
  locationLabel: string;
  createdAt: string | Date;
}

/**
 * Triggers the configured n8n SOS webhook asynchronously.
 * Safe and fail-safe: failures are logged clearly and do NOT fail the calling operation.
 */
export async function triggerN8nSosWebhook(incident: {
  id: number;
  publicCode: string;
  severity: string;
  status: string;
  emergencyType: string;
  latitude: number;
  longitude: number;
  peopleAffected: number;
  helpNeeds?: string | null;
  locationLabel: string;
  createdAt: Date | string;
}) {
  const webhookUrl = ENV.n8nSosWebhookUrl;
  if (!webhookUrl || webhookUrl.trim() === "") {
    console.log("[n8n Webhook] N8N_SOS_WEBHOOK_URL is not configured; skipping webhook dispatch.");
    return { success: false, reason: "NOT_CONFIGURED" };
  }

  const payload: SosWebhookPayload = {
    incidentId: incident.id,
    publicCode: incident.publicCode,
    severity: incident.severity,
    status: incident.status,
    emergencyType: incident.emergencyType,
    latitude: incident.latitude,
    longitude: incident.longitude,
    peopleAffected: incident.peopleAffected,
    helpNeeded: incident.helpNeeds ?? null,
    locationLabel: incident.locationLabel,
    createdAt: incident.createdAt instanceof Date ? incident.createdAt.toISOString() : incident.createdAt,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn(`[n8n Webhook] Webhook call returned status ${response.status} ${response.statusText}`);
      await addIncidentEvent(
        incident.id,
        null,
        "n8n_webhook_warning",
        "Automation webhook warning",
        `n8n webhook returned status ${response.status}`
      );
      return { success: false, status: response.status };
    }

    console.log(`[n8n Webhook] Successfully delivered SOS webhook payload for ${incident.publicCode} (ID ${incident.id})`);
    await addIncidentEvent(
      incident.id,
      null,
      "n8n_webhook_dispatched",
      "Automation webhook dispatched",
      `n8n webhook triggered for ${incident.publicCode}`
    );
    return { success: true };
  } catch (err: any) {
    console.error("[n8n Webhook] Failed to deliver SOS webhook payload:", err?.message || err);
    try {
      await addIncidentEvent(
        incident.id,
        null,
        "n8n_webhook_failed",
        "Automation webhook failed",
        `Delivery error: ${err?.message || "Unknown network error"}`
      );
    } catch {}
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Registers REST API endpoints for:
 * - Offline SOS delivery from Service Worker Background Sync
 * - n8n status checking and escalation event reporting
 */
export function registerN8nRoutes(app: Express) {
  // POST /api/sos/offline
  // Service Worker Background Sync endpoint — accepts an SOS payload and creates
  // an incident the same way the tRPC `rescue.emergency.create` mutation does,
  // but without requiring tRPC context (Service Workers can only use plain fetch).
  app.post("/api/sos/offline", async (req: Request, res: Response) => {
    try {
      const body = req.body;
      if (!body || !body.locationLabel || typeof body.latitude !== "number" || typeof body.longitude !== "number") {
        return res.status(400).json({ error: "Missing required SOS fields (locationLabel, latitude, longitude)." });
      }

      const emergencyType = ["flood", "medical", "trapped", "evacuation", "other"].includes(body.emergencyType)
        ? body.emergencyType
        : "flood";
      const severity = ["critical", "high", "medium", "low"].includes(body.severity)
        ? body.severity
        : "high";
      const peopleAffected = typeof body.peopleAffected === "number" && body.peopleAffected >= 1
        ? Math.min(body.peopleAffected, 500)
        : 1;

      // Generate a unique SOS code
      const { customAlphabet } = await import("nanoid");
      const generateCode = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);
      const publicCode = `SOS-${generateCode()}`;

      // Create the in-memory incident (same shape as the tRPC mutation)
      const { _memoryIncidents, addIncidentEvent } = await import("./rescue.db");

      const incidentId = _memoryIncidents.size + 1;
      const now = new Date();
      _memoryIncidents.set(incidentId, {
        id: incidentId,
        publicCode,
        reporterId: null, // Offline SOS may not have auth context
        contactName: typeof body.contactName === "string" ? body.contactName.slice(0, 160) : null,
        locationLabel: String(body.locationLabel).slice(0, 360),
        latitude: body.latitude,
        longitude: body.longitude,
        emergencyType,
        helpNeeds: null,
        severity,
        peopleAffected,
        notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : null,
        evidenceKey: null,
        evidenceUrl: null,
        voiceNoteKey: null,
        voiceNoteUrl: null,
        voiceNoteDurationSeconds: null,
        status: "pending",
        assignedRescuerId: null,
        dispatchedAt: null,
        resolvedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      await addIncidentEvent(
        incidentId,
        null,
        "sos_created",
        "Offline SOS received",
        "Queued on device during network outage. Delivered via Background Sync."
      );

      // Attempt database persistence (non-blocking, same pattern as tRPC route)
      try {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (db) {
          const { incidents: incidentsTable } = await import("../drizzle/schema");
          await db.insert(incidentsTable).values({
            publicCode,
            reporterId: null,
            contactName: typeof body.contactName === "string" ? body.contactName.slice(0, 160) : null,
            locationLabel: String(body.locationLabel).slice(0, 360),
            latitude: body.latitude,
            longitude: body.longitude,
            emergencyType,
            helpNeeds: null,
            severity,
            peopleAffected,
            notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : null,
            evidenceKey: null,
            evidenceUrl: null,
            voiceNoteKey: null,
            voiceNoteUrl: null,
            voiceNoteDurationSeconds: null,
            status: "pending",
          });
        }
      } catch (dbErr) {
        console.warn("[Offline SOS] Database persistence warning (in-memory copy exists):", dbErr);
      }

      // Fire the n8n webhook (same as the tRPC flow)
      void triggerN8nSosWebhook({
        id: incidentId,
        publicCode,
        severity,
        status: "pending",
        emergencyType,
        latitude: body.latitude,
        longitude: body.longitude,
        peopleAffected,
        locationLabel: String(body.locationLabel).slice(0, 360),
        createdAt: now,
      });

      console.log(`[Offline SOS] Delivered offline SOS ${publicCode} (incident ${incidentId})`);
      return res.status(201).json({ publicCode, incidentId, status: "pending" });
    } catch (err: any) {
      console.error("[Offline SOS] Error creating offline SOS:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/incidents/:incidentId/status
  // Supports numeric ID or SOS public code (e.g. SOS-XXXXXX)
  app.get("/api/incidents/:incidentId/status", async (req: Request, res: Response) => {
    try {
      const rawParam = req.params.incidentId ? req.params.incidentId.trim() : "";
      if (!rawParam) {
        return res.status(400).json({ error: "Missing incidentId parameter." });
      }

      let incident: MemoryIncident | null = null;
      if (/^\d+$/.test(rawParam)) {
        incident = await getIncidentById(parseInt(rawParam, 10));
      }

      if (!incident) {
        incident = await getIncidentByCode(rawParam.toUpperCase());
      }

      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }

      return res.json({
        incidentId: incident.id,
        publicCode: incident.publicCode,
        severity: incident.severity,
        status: incident.status,
        emergencyType: incident.emergencyType,
        peopleAffected: incident.peopleAffected,
        locationLabel: incident.locationLabel,
        latitude: incident.latitude,
        longitude: incident.longitude,
        escalationLevel: incident.escalationLevel ?? 0,
        lastEscalatedAt: incident.lastEscalatedAt ?? null,
        automationStatus: incident.automationStatus ?? "active",
        createdAt: incident.createdAt,
        updatedAt: incident.updatedAt,
        dispatchedAt: incident.dispatchedAt ?? null,
        resolvedAt: incident.resolvedAt ?? null,
      });
    } catch (err: any) {
      console.error("[REST API] Error retrieving incident status:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/incidents/:incidentId/automation-event
  // Allows n8n to log automation actions (e.g. primary_alert_sent, escalation_triggered)
  app.post("/api/incidents/:incidentId/automation-event", async (req: Request, res: Response) => {
    try {
      const rawParam = req.params.incidentId ? req.params.incidentId.trim() : "";
      if (!rawParam) {
        return res.status(400).json({ error: "Missing incidentId parameter." });
      }

      let incident: MemoryIncident | null = null;
      if (/^\d+$/.test(rawParam)) {
        incident = await getIncidentById(parseInt(rawParam, 10));
      }
      if (!incident) {
        incident = await getIncidentByCode(rawParam.toUpperCase());
      }
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }

      const { eventType, title, detail, escalationLevel, automationStatus } = req.body || {};
      const actualEventType = eventType ? String(eventType) : "automation_event";
      const eventTitle = title ? String(title) : `Automation: ${actualEventType}`;
      const eventDetail = detail ? String(detail) : null;

      await addIncidentEvent(incident.id, null, actualEventType, eventTitle, eventDetail);

      const updates: { escalationLevel?: number; lastEscalatedAt?: Date; automationStatus?: string } = {};
      if (typeof escalationLevel === "number") {
        updates.escalationLevel = escalationLevel;
        updates.lastEscalatedAt = new Date();
      }
      if (typeof automationStatus === "string") {
        updates.automationStatus = automationStatus;
      }

      if (Object.keys(updates).length > 0) {
        await updateIncidentAutomationState(incident.id, updates);
      }

      const refreshed = await getIncidentById(incident.id);

      return res.json({
        success: true,
        incidentId: incident.id,
        publicCode: incident.publicCode,
        status: refreshed?.status ?? incident.status,
        escalationLevel: (refreshed as any)?.escalationLevel ?? 0,
        automationStatus: (refreshed as any)?.automationStatus ?? "active",
      });
    } catch (err: any) {
      console.error("[REST API] Error recording automation event:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
