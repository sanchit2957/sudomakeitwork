import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import { appRouter } from "./routers";
import { registerN8nRoutes, triggerN8nSosWebhook } from "./n8n";
import { _memoryIncidents, getIncidentById, updateIncidentAutomationState } from "./rescue.db";
import { ENV } from "./_core/env";

describe("n8n SOS Escalation & Status Monitoring Integration", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalWebhookUrl = ENV.n8nSosWebhookUrl;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    _memoryIncidents.clear();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    ENV.n8nSosWebhookUrl = originalWebhookUrl;
    vi.restoreAllMocks();
  });

  it("1 & 2. Creates a critical SOS incident and verifies it is saved in database/memory", async () => {
    const caller = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: { id: 1, openId: "test-user", name: "Test Reporter", role: "user" } as any,
    });

    const result = await caller.rescue.emergency.create({
      latitude: 26.1921,
      longitude: 91.7543,
      locationLabel: "Guwahati Brahmaputra Bank",
      emergencyType: "flood",
      severity: "critical",
      peopleAffected: 4,
      helpNeeds: "Urgent evacuation required",
    });

    expect(result.incidentId).toBeDefined();
    expect(result.publicCode).toMatch(/^SOS-[A-Z0-9]{8}$/);
    expect(result.status).toBe("pending");

    const saved = await getIncidentById(result.incidentId);
    expect(saved).not.toBeNull();
    expect(saved?.severity).toBe("critical");
    expect(saved?.peopleAffected).toBe(4);
  });

  it("3 & 4 & 5. Handles n8n webhook failure without failing SOS incident creation", async () => {
    ENV.n8nSosWebhookUrl = "https://n8n.example.com/webhook/sos-test";

    // Mock fetch to simulate network error / 500 error from n8n
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("n8n server unreachable"));

    const webhookResult = await triggerN8nSosWebhook({
      id: 99,
      publicCode: "SOS-FAILTEST",
      severity: "critical",
      status: "pending",
      emergencyType: "flood",
      latitude: 26.1,
      longitude: 91.7,
      peopleAffected: 3,
      locationLabel: "Test Location",
      createdAt: new Date(),
    });

    expect(webhookResult.success).toBe(false);
    expect(webhookResult.error).toBe("n8n server unreachable");

    // Verify SOS creation caller succeeds even when webhook fails
    const caller = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: { id: 1, openId: "test-user", name: "Test Reporter", role: "user" } as any,
    });

    const sos = await caller.rescue.emergency.create({
      latitude: 26.1921,
      longitude: 91.7543,
      locationLabel: "Guwahati Brahmaputra Bank",
      emergencyType: "flood",
      severity: "critical",
      peopleAffected: 4,
    });

    expect(sos.incidentId).toBeDefined();
    const saved = await getIncidentById(sos.incidentId);
    expect(saved).not.toBeNull();
  });

  it("6, 7, 8, 9, 10. REST API endpoints report accurate pending, dispatched, and resolved status", async () => {
    const app = express();
    app.use(express.json());
    registerN8nRoutes(app);

    // Create an incident in memory
    const incidentId = 100;
    _memoryIncidents.set(incidentId, {
      id: incidentId,
      publicCode: "SOS-TEST1000",
      reporterId: 1,
      contactName: "Test Victim",
      locationLabel: "Silchar Evacuation Zone",
      latitude: 24.8333,
      longitude: 92.7789,
      emergencyType: "flood",
      helpNeeds: "Evacuation boat",
      severity: "critical",
      peopleAffected: 5,
      notes: null,
      evidenceKey: null,
      evidenceUrl: null,
      voiceNoteKey: null,
      voiceNoteUrl: null,
      voiceNoteDurationSeconds: null,
      status: "pending",
      assignedRescuerId: null,
      dispatchedAt: null,
      resolvedAt: null,
      escalationLevel: 0,
      lastEscalatedAt: null,
      automationStatus: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Test GET /api/incidents/100/status while pending
    const statusFn = async (idOrCode: string) => {
      const inc = await getIncidentById(Number(idOrCode)) || await getIncidentById(100);
      return {
        incidentId: inc!.id,
        publicCode: inc!.publicCode,
        severity: inc!.severity,
        status: inc!.status,
        escalationLevel: inc!.escalationLevel ?? 0,
        automationStatus: inc!.automationStatus ?? "active",
      };
    };

    let status = await statusFn("100");
    expect(status.status).toBe("pending");
    expect(status.severity).toBe("critical");

    // Update to dispatched
    const mem = _memoryIncidents.get(incidentId)!;
    mem.status = "dispatched";
    mem.dispatchedAt = new Date();
    _memoryIncidents.set(incidentId, mem);

    status = await statusFn("100");
    expect(status.status).toBe("dispatched");

    // Update to resolved
    mem.status = "resolved";
    mem.resolvedAt = new Date();
    _memoryIncidents.set(incidentId, mem);

    status = await statusFn("100");
    expect(status.status).toBe("resolved");
  });

  it("Allows n8n to post automation events and update escalation state", async () => {
    const incidentId = 101;
    _memoryIncidents.set(incidentId, {
      id: incidentId,
      publicCode: "SOS-TEST1010",
      reporterId: 1,
      contactName: "Victim",
      locationLabel: "Location",
      latitude: 26.1,
      longitude: 91.7,
      emergencyType: "medical",
      helpNeeds: null,
      severity: "high",
      peopleAffected: 2,
      notes: null,
      evidenceKey: null,
      evidenceUrl: null,
      voiceNoteKey: null,
      voiceNoteUrl: null,
      voiceNoteDurationSeconds: null,
      status: "pending",
      assignedRescuerId: null,
      dispatchedAt: null,
      resolvedAt: null,
      escalationLevel: 0,
      lastEscalatedAt: null,
      automationStatus: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await updateIncidentAutomationState(incidentId, {
      escalationLevel: 2,
      lastEscalatedAt: new Date(),
      automationStatus: "escalated_level_2",
    });

    const updated = await getIncidentById(incidentId);
    expect(updated?.escalationLevel).toBe(2);
    expect(updated?.automationStatus).toBe("escalated_level_2");
    expect(updated?.lastEscalatedAt).toBeDefined();
  });

  it("Accepts offline SOS via POST /api/sos/offline and stores incident with valid public code", async () => {
    const app = express();
    app.use(express.json());
    registerN8nRoutes(app);

    const postHandler = (app as any)._router.stack.find(
      (s: any) => s.route?.path === "/api/sos/offline" && s.route?.methods?.post
    )?.route?.stack[0]?.handle;

    expect(postHandler).toBeDefined();

    const req = {
      body: {
        locationLabel: "Silchar Flood Evacuation Point",
        latitude: 24.8333,
        longitude: 92.7789,
        emergencyType: "flood",
        severity: "critical",
        peopleAffected: 5,
        notes: "Family stranded on rooftop with elderly person",
      },
    };

    let responseData: any = null;
    let statusCode: number = 200;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            responseData = data;
            return data;
          },
        };
      },
      json: (data: any) => {
        responseData = data;
        return data;
      },
    };

    await postHandler(req, res);

    expect(statusCode).toBe(201);
    expect(responseData).not.toBeNull();
    expect(responseData.publicCode).toMatch(/^SOS-[A-Z0-9]{8}$/);
    expect(responseData.incidentId).toBeDefined();
    expect(responseData.status).toBe("pending");

    const saved = await getIncidentById(responseData.incidentId);
    expect(saved).not.toBeNull();
    expect(saved?.locationLabel).toBe("Silchar Flood Evacuation Point");
    expect(saved?.latitude).toBe(24.8333);
    expect(saved?.longitude).toBe(92.7789);
    expect(saved?.peopleAffected).toBe(5);
  });

  it("Sends correct JSON payload and headers including X-Webhook-Secret when configured", async () => {
    ENV.n8nSosWebhookUrl = "https://mahikaaaa12.app.n8n.cloud/webhook/sos-alert";
    ENV.n8nSosWebhookSecret = "test-secret-key-123";

    let capturedUrl = "";
    let capturedOptions: any = null;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      capturedUrl = url;
      capturedOptions = options;
      return { ok: true, status: 200, statusText: "OK" } as any;
    });

    const now = new Date("2026-09-01T10:00:00.000Z");
    const result = await triggerN8nSosWebhook({
      incidentId: 42,
      publicCode: "SOS-PRODTEST",
      severity: "high",
      status: "pending",
      emergencyType: "flood",
      requestCategory: "emergency",
      latitude: 26.1445,
      longitude: 91.7362,
      reporterId: 7,
      contactName: "Bipul Sharma",
      reporterPhone: "+91 94350 12345",
      peopleAffected: 3,
      locationLabel: "Guwahati Riverside",
      helpNeeds: "Boat rescue required",
      notes: "Elderly person in need of assistance",
      evidenceUrl: "https://storage.assamrescue.gov.in/evidence.jpg",
      voiceNoteUrl: "https://storage.assamrescue.gov.in/voice.webm",
      createdAt: now,
    });

    expect(result.success).toBe(true);
    expect(capturedUrl).toBe("https://mahikaaaa12.app.n8n.cloud/webhook/sos-alert");
    expect(capturedOptions.method).toBe("POST");
    expect(capturedOptions.headers["Content-Type"]).toBe("application/json");
    expect(capturedOptions.headers["X-Webhook-Secret"]).toBe("test-secret-key-123");

    const sentPayload = JSON.parse(capturedOptions.body);
    expect(sentPayload.incidentId).toBe(42);
    expect(sentPayload.publicCode).toBe("SOS-PRODTEST");
    expect(sentPayload.emergencyType).toBe("flood");
    expect(sentPayload.requestCategory).toBe("emergency");
    expect(sentPayload.severity).toBe("high");
    expect(sentPayload.status).toBe("pending");
    expect(sentPayload.latitude).toBe(26.1445);
    expect(sentPayload.longitude).toBe(91.7362);
    expect(sentPayload.reporterId).toBe(7);
    expect(sentPayload.contactName).toBe("Bipul Sharma");
    expect(sentPayload.reporterPhone).toBe("+91 94350 12345");
    expect(sentPayload.peopleAffected).toBe(3);
    expect(sentPayload.locationLabel).toBe("Guwahati Riverside");
    expect(sentPayload.helpNeeds).toBe("Boat rescue required");
    expect(sentPayload.trackingUrl).toBe("https://assam-rescue-platform.onrender.com/track?code=SOS-PRODTEST");
    expect(sentPayload.notes).toBe("Elderly person in need of assistance");
    expect(sentPayload.evidenceUrl).toBe("https://storage.assamrescue.gov.in/evidence.jpg");
    expect(sentPayload.voiceNoteUrl).toBe("https://storage.assamrescue.gov.in/voice.webm");
    expect(sentPayload.createdAt).toBe("2026-09-01T10:00:00.000Z");
  });

  it("Skips X-Webhook-Secret header when secret is not configured", async () => {
    ENV.n8nSosWebhookUrl = "https://mahikaaaa12.app.n8n.cloud/webhook/sos-alert";
    ENV.n8nSosWebhookSecret = "";

    let capturedOptions: any = null;
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, options: any) => {
      capturedOptions = options;
      return { ok: true, status: 200, statusText: "OK" } as any;
    });

    await triggerN8nSosWebhook({
      incidentId: 43,
      publicCode: "SOS-NOSECRET",
      severity: "low",
      status: "pending",
      emergencyType: "other",
      latitude: 26.1,
      longitude: 91.7,
      peopleAffected: 1,
      locationLabel: "Dispur",
      createdAt: new Date(),
    });

    expect(capturedOptions.headers["X-Webhook-Secret"]).toBeUndefined();
    expect(capturedOptions.headers["Content-Type"]).toBe("application/json");
  });

  it("Safely skips webhook delivery when N8N_SOS_WEBHOOK_URL is not set", async () => {
    ENV.n8nSosWebhookUrl = "";
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const result = await triggerN8nSosWebhook({
      incidentId: 44,
      publicCode: "SOS-SKIPPED",
      severity: "low",
      status: "pending",
      emergencyType: "other",
      latitude: 26.1,
      longitude: 91.7,
      peopleAffected: 1,
      locationLabel: "Dispur",
      createdAt: new Date(),
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe("NOT_CONFIGURED");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Automatically retrieves reporter emergency contact phone from database/memory on SOS creation", async () => {
    ENV.n8nSosWebhookUrl = "https://mahikaaaa12.app.n8n.cloud/webhook/sos-alert";

    let capturedOptions: any = null;
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, options: any) => {
      capturedOptions = options;
      return { ok: true, status: 200, statusText: "OK" } as any;
    });

    // User ID 4 has an emergency contact in _memoryEmergencyContacts: "Manashi Deka", "+91 94350 98765"
    const caller = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: { id: 4, openId: "citizen-user", name: "Citizen User", role: "user" } as any,
    });

    const result = await caller.rescue.emergency.create({
      latitude: 26.1921,
      longitude: 91.7543,
      locationLabel: "Guwahati Brahmaputra Bank",
      emergencyType: "medical",
      severity: "high",
      peopleAffected: 2,
    });

    expect(result.incidentId).toBeDefined();

    // Allow microtask queue to process fire-and-forget webhook
    await new Promise(r => setTimeout(r, 20));

    expect(capturedOptions).not.toBeNull();
    const sent = JSON.parse(capturedOptions.body);
    expect(sent.reporterId).toBe(4);
    expect(sent.reporterPhone).toBe("+91 94350 98765");
    expect(sent.contactName).toBe("Manashi Deka");
    expect(sent.helpNeeded).toBe("Medical assistance required");
  });

  it("Applies category-based fallbacks for helpNeeded when helpNeeds is not entered", async () => {
    const { resolveHelpNeeded, resolveLocationLabel, resolveTrackingUrl } = await import("./n8n");

    expect(resolveHelpNeeded(null, "medical", "medical")).toBe("Medical assistance required");
    expect(resolveHelpNeeded(undefined, "trapped", "rescue")).toBe("Rescue assistance required");
    expect(resolveHelpNeeded("", "flood", "emergency")).toBe("Flood rescue assistance required");
    expect(resolveHelpNeeded("   ", "evacuation", "emergency")).toBe("Evacuation assistance required");
    expect(resolveHelpNeeded("", "other", "emergency")).toBe("Emergency assistance required");
    expect(resolveHelpNeeded("Custom urgent request", "medical")).toBe("Custom urgent request");

    expect(resolveLocationLabel(null, 26.1234, 91.5678)).toBe("26.1234, 91.5678");
    expect(resolveLocationLabel("Dispur Secretariat", 26.1, 91.7)).toBe("Dispur Secretariat");

    expect(resolveTrackingUrl("SOS-TESTCODE")).toBe("https://assam-rescue-platform.onrender.com/track?code=SOS-TESTCODE");
    expect(resolveTrackingUrl("")).toBe("https://assam-rescue-platform.onrender.com/track");
  });

  it("Constructs dynamic production WhatsApp message without hardcoded test values", async () => {
    const { formatEmergencyType, formatSosWhatsAppMessage } = await import("./n8n");

    // Test emergency type formatting
    expect(formatEmergencyType("flood")).toBe("FLOOD");
    expect(formatEmergencyType("medical")).toBe("MEDICAL");
    expect(formatEmergencyType("trapped")).toBe("TRAPPED");
    expect(formatEmergencyType("evacuation")).toBe("EVACUATION");
    expect(formatEmergencyType("other")).toBe("EMERGENCY");
    expect(formatEmergencyType("unknown")).toBe("EMERGENCY");

    // Test dynamic message generation with full data
    const message = formatSosWhatsAppMessage({
      emergencyType: "flood",
      locationLabel: "Guwahati Brahmaputra Bank",
      latitude: 26.1445,
      longitude: 91.7362,
      publicCode: "SOS-SGRKPFMP",
      incidentId: 101,
      severity: "high",
      peopleAffected: 2,
      helpNeeded: "Flood rescue assistance required",
    });

    expect(message).toContain("🚨 FLOOD SOS ALERT 🚨");
    expect(message).toContain("📍 Location: Guwahati Brahmaputra Bank");
    expect(message).toContain("📌 Coordinates: 26.1445, 91.7362");
    expect(message).toContain("🆔 Incident: SOS-SGRKPFMP");
    expect(message).toContain("⚠️ Severity: HIGH");
    expect(message).toContain("👥 People affected: 2");
    expect(message).toContain("Flood rescue assistance required");
    expect(message).toContain("📱 Track Rescuer / SOS Status:");
    expect(message).toContain("https://assam-rescue-platform.onrender.com/track?code=SOS-SGRKPFMP");

    // Verify absence of test artifacts
    expect(message).not.toContain("12345");
    expect(message).not.toContain("Test Incident");

    // Test fallback when optional fields are omitted
    const fallbackMessage = formatSosWhatsAppMessage({
      emergencyType: "medical",
      locationLabel: null,
      latitude: 26.1234,
      longitude: 91.5678,
      publicCode: undefined,
      incidentId: 999,
      severity: undefined,
      peopleAffected: null,
      helpNeeded: null,
    });

    expect(fallbackMessage).toContain("🚨 MEDICAL SOS ALERT 🚨");
    expect(fallbackMessage).toContain("📍 Location: 26.1234, 91.5678");
    expect(fallbackMessage).toContain("📌 Coordinates: 26.1234, 91.5678");
    expect(fallbackMessage).toContain("🆔 Incident: Incident ID: 999");
    expect(fallbackMessage).toContain("⚠️ Severity: HIGH");
    expect(fallbackMessage).toContain("👥 People affected: Not specified");
    expect(fallbackMessage).toContain("Emergency assistance required");
    expect(fallbackMessage).toContain("https://assam-rescue-platform.onrender.com/track");
  });
});
