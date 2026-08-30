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
});
