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
 * Registers REST API endpoints for n8n status checking and escalation event reporting.
 */
export function registerN8nRoutes(app: Express) {
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
        escalationLevel: refreshed?.escalationLevel ?? 0,
        automationStatus: refreshed?.automationStatus ?? "active",
      });
    } catch (err: any) {
      console.error("[REST API] Error recording automation event:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
