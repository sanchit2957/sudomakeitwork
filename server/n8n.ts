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
  emergencyType: string;
  requestCategory: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  reporterId: number | null;
  contactName: string | null;
  reporterPhone: string | null;
  peopleAffected: number;
  locationLabel: string;
  helpNeeds: string | null;
  helpNeeded: string;
  trackingUrl: string;
  notes: string | null;
  evidenceUrl: string | null;
  voiceNoteUrl: string | null;
  createdAt: string;
}

export interface TriggerN8nSosInput {
  id?: number;
  incidentId?: number;
  publicCode: string;
  severity: string;
  status?: string;
  emergencyType: string;
  requestCategory?: string;
  latitude: number;
  longitude: number;
  reporterId?: number | null;
  contactName?: string | null;
  reporterPhone?: string | null;
  peopleAffected: number;
  helpNeeds?: string | null;
  helpNeeded?: string | null;
  trackingUrl?: string | null;
  locationLabel: string;
  notes?: string | null;
  evidenceUrl?: string | null;
  voiceNoteUrl?: string | null;
  createdAt: Date | string;
}

/**
 * Resolves a non-empty, meaningful helpNeeded string for n8n automation.
 * Priority: 1. Explicit helpNeeds/helpNeeded -> 2. Category-based meaningful fallback.
 */
export function resolveHelpNeeded(
  helpNeeds?: string | null,
  emergencyType?: string,
  requestCategory?: string
): string {
  if (helpNeeds && typeof helpNeeds === "string" && helpNeeds.trim() !== "") {
    return helpNeeds.trim();
  }
  const type = (emergencyType || requestCategory || "").toLowerCase();
  switch (type) {
    case "medical":
      return "Medical assistance required";
    case "trapped":
      return "Rescue assistance required";
    case "flood":
      return "Flood rescue assistance required";
    case "evacuation":
      return "Evacuation assistance required";
    case "emergency":
    default:
      return "Emergency assistance required";
  }
}

/**
 * Formats emergencyType into human-readable uppercase title format.
 */
export function formatEmergencyType(emergencyType?: string): string {
  const type = (emergencyType || "").trim().toLowerCase();
  switch (type) {
    case "flood":
      return "FLOOD";
    case "medical":
      return "MEDICAL";
    case "trapped":
      return "TRAPPED";
    case "evacuation":
      return "EVACUATION";
    default:
      return "EMERGENCY";
  }
}

/**
 * Resolves a safe location label, falling back to readable GPS coordinates if missing.
 */
export function resolveLocationLabel(
  locationLabel?: string | null,
  latitude?: number,
  longitude?: number
): string {
  if (locationLabel && typeof locationLabel === "string" && locationLabel.trim() !== "") {
    return locationLabel.trim();
  }
  if (typeof latitude === "number" && typeof longitude === "number") {
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
  return "Assam emergency coordinates";
}

/**
 * Resolves the authoritative public tracking URL for an incident.
 * Uses configured production APP_URL/RENDER_EXTERNAL_URL/ENV.appBaseUrl.
 */
export function resolveTrackingUrl(publicCode?: string): string {
  const base = (
    process.env.APP_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    ENV.appBaseUrl ||
    "https://assam-rescue-platform.onrender.com"
  ).replace(/\/+$/, "");

  if (publicCode && publicCode.trim() !== "") {
    return `${base}/track?code=${encodeURIComponent(publicCode.trim())}`;
  }
  return `${base}/track`;
}

/**
 * Constructs the canonical production WhatsApp SOS notification message.
 * Ensures all placeholders are replaced with real dynamic data from the incident.
 */
export function formatSosWhatsAppMessage(payload: {
  emergencyType?: string;
  locationLabel?: string | null;
  latitude: number;
  longitude: number;
  publicCode?: string;
  incidentId?: number;
  severity?: string;
  peopleAffected?: number | null;
  helpNeeded?: string | null;
  trackingUrl?: string | null;
}): string {
  const typeTitle = formatEmergencyType(payload.emergencyType);
  const location =
    payload.locationLabel && payload.locationLabel.trim() !== ""
      ? payload.locationLabel.trim()
      : `${Number(payload.latitude).toFixed(4)}, ${Number(payload.longitude).toFixed(4)}`;
  const coordinates = `${Number(payload.latitude).toFixed(4)}, ${Number(payload.longitude).toFixed(4)}`;
  const incidentIdent = payload.publicCode ? payload.publicCode : `Incident ID: ${payload.incidentId ?? "Unknown"}`;
  const severityStr = (payload.severity || "HIGH").toUpperCase();
  const peopleStr =
    typeof payload.peopleAffected === "number" && payload.peopleAffected >= 1
      ? `${payload.peopleAffected}`
      : "Not specified";
  const helpStr =
    payload.helpNeeded && payload.helpNeeded.trim() !== ""
      ? payload.helpNeeded.trim()
      : "Emergency assistance required";
  const trackingUrl = payload.trackingUrl || resolveTrackingUrl(payload.publicCode);

  return [
    `🚨 ${typeTitle} SOS ALERT 🚨`,
    "",
    "Immediate assistance is required.",
    "",
    `📍 Location: ${location}`,
    `📌 Coordinates: ${coordinates}`,
    `🆔 Incident: ${incidentIdent}`,
    `⚠️ Severity: ${severityStr}`,
    `👥 People affected: ${peopleStr}`,
    `📋 Help needed: ${helpStr}`,
    "",
    "📱 Track Rescuer / SOS Status:",
    trackingUrl,
    "",
    "Please respond as soon as possible.",
  ].join("\n");
}

/**
 * Triggers the configured n8n SOS webhook asynchronously.
 * Safe and fail-safe: failures are logged clearly and do NOT fail the calling operation.
 */
export async function triggerN8nSosWebhook(incident: TriggerN8nSosInput) {
  const webhookUrl = ENV.n8nSosWebhookUrl;
  if (!webhookUrl || webhookUrl.trim() === "") {
    console.log("[n8n Webhook] N8N_SOS_WEBHOOK_URL is not configured; skipping webhook dispatch.");
    return { success: false, reason: "NOT_CONFIGURED" };
  }

  const resolvedId = incident.incidentId ?? incident.id ?? 0;
  const reqCat =
    incident.requestCategory ??
    (incident.emergencyType === "medical" ? "medical" : incident.emergencyType === "trapped" ? "rescue" : "emergency");

  const helpText = incident.helpNeeds && incident.helpNeeds.trim() !== "" ? incident.helpNeeds.trim() : null;
  const helpNeeded = resolveHelpNeeded(incident.helpNeeds || incident.helpNeeded, incident.emergencyType, reqCat);
  const locationLabel = resolveLocationLabel(incident.locationLabel, incident.latitude, incident.longitude);
  const trackingUrl = incident.trackingUrl || resolveTrackingUrl(incident.publicCode);

  let resolvedPhone = incident.reporterPhone ?? null;
  let resolvedContactName = incident.contactName ?? null;

  // If reporterPhone is not supplied, securely look up the user's primary emergency contact
  if (!resolvedPhone && incident.reporterId) {
    try {
      const { getEmergencyContactsByUserId } = await import("./db");
      const userContacts = await getEmergencyContactsByUserId(incident.reporterId);
      if (userContacts && userContacts.length > 0) {
        const primary = userContacts.find(c => c.isPrimary === "yes") || userContacts[0];
        resolvedPhone = primary.phone || primary.alternatePhone || null;
        if (!resolvedContactName && primary.name) {
          resolvedContactName = primary.name;
        }
      }
    } catch (lookupErr) {
      console.warn("[n8n Webhook] Emergency contact lookup note:", lookupErr);
    }
  }

  const payload: SosWebhookPayload = {
    incidentId: resolvedId,
    publicCode: incident.publicCode,
    emergencyType: incident.emergencyType,
    requestCategory: reqCat,
    severity: incident.severity,
    status: incident.status ?? "pending",
    latitude: incident.latitude,
    longitude: incident.longitude,
    reporterId: incident.reporterId ?? null,
    contactName: resolvedContactName,
    reporterPhone: resolvedPhone,
    peopleAffected: incident.peopleAffected,
    locationLabel,
    helpNeeds: helpText,
    helpNeeded,
    trackingUrl,
    notes: incident.notes ?? null,
    evidenceUrl: incident.evidenceUrl ?? null,
    voiceNoteUrl: incident.voiceNoteUrl ?? null,
    createdAt: incident.createdAt instanceof Date ? incident.createdAt.toISOString() : String(incident.createdAt),
  };


  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const webhookSecret = ENV.n8nSosWebhookSecret || process.env.N8N_SOS_WEBHOOK_SECRET;
  if (webhookSecret && webhookSecret.trim() !== "") {
    headers["X-Webhook-Secret"] = webhookSecret.trim();
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      let safeErrorDetail = "";
      try {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          safeErrorDetail = parsed.message || parsed.error || text.slice(0, 200);
        } catch {
          safeErrorDetail = text.slice(0, 200);
        }
      } catch {}

      console.warn(
        `[n8n Webhook] Webhook returned status ${response.status} for ${incident.publicCode} (ID ${resolvedId}): ${safeErrorDetail}`
      );
      if (resolvedId > 0) {
        await addIncidentEvent(
          resolvedId,
          null,
          "n8n_webhook_warning",
          "Automation webhook warning",
          `n8n webhook returned status ${response.status}${safeErrorDetail ? `: ${safeErrorDetail}` : ""}`
        );
      }
      return { success: false, status: response.status, error: safeErrorDetail };
    }

    console.log(`[n8n Webhook] Successfully delivered SOS webhook payload for ${incident.publicCode} (ID ${resolvedId})`);
    if (resolvedId > 0) {
      await addIncidentEvent(
        resolvedId,
        null,
        "n8n_webhook_dispatched",
        "Automation webhook dispatched",
        `n8n webhook triggered for ${incident.publicCode}`
      );
    }
    return { success: true };
  } catch (err: any) {
    console.error("[n8n Webhook] Failed to deliver SOS webhook payload:", err?.message || err);
    try {
      if (resolvedId > 0) {
        await addIncidentEvent(
          resolvedId,
          null,
          "n8n_webhook_failed",
          "Automation webhook failed",
          `Delivery error: ${err?.message || "Unknown network error"}`
        );
      }
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
        requestCategory: emergencyType === "medical" ? "medical" : emergencyType === "trapped" ? "rescue" : "emergency",
        dispatchStatus: "triage_pending",
        triageStartedAt: now,
        triageDeadlineAt: new Date(now.getTime() + 10_000),
        triageSelectedAt: null,
        matchingStartedAt: null,
        matchingAttempts: 0,
        escalatedToCommandAt: null,
        assignedRescuerId: null,
        destinationHospitalId: null,
        destinationHospitalName: null,
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

      const defaultCategory: "medical" | "rescue" | "emergency" =
        emergencyType === "medical" ? "medical" : emergencyType === "trapped" ? "rescue" : "emergency";

      // Fire the n8n webhook (same as the tRPC flow)
      void triggerN8nSosWebhook({
        id: incidentId,
        publicCode,
        severity,
        status: "pending",
        emergencyType,
        requestCategory: defaultCategory,
        latitude: body.latitude,
        longitude: body.longitude,
        reporterId: null,
        contactName: typeof body.contactName === "string" ? body.contactName.slice(0, 160) : null,
        reporterPhone:
          typeof body.reporterPhone === "string"
            ? body.reporterPhone.slice(0, 32)
            : typeof body.phone === "string"
            ? body.phone.slice(0, 32)
            : null,
        peopleAffected,
        locationLabel: String(body.locationLabel).slice(0, 360),
        helpNeeds: typeof body.helpNeeds === "string" ? body.helpNeeds.slice(0, 1000) : null,
        helpNeeded: resolveHelpNeeded(body.helpNeeds || body.notes, emergencyType, defaultCategory),
        notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : null,
        evidenceUrl: null,
        voiceNoteUrl: null,
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
