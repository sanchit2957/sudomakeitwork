/**
 * OFFLINE SOS HARDENING & IDEMPOTENCY TESTS
 * Validates:
 * 1. Offline SOS creation and validation
 * 2. Idempotent deduplication via offlineEventId
 * 3. Coordinate bounds validation
 * 4. Status endpoint privacy and sequential enumeration prevention
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { registerN8nRoutes } from "./n8n";

describe("Offline SOS Hardening & Status Privacy", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerN8nRoutes(app);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("creates an offline SOS with valid payload", async () => {
    const res = await fetch(`${baseUrl}/api/sos/offline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationLabel: "Silchar Medical College",
        latitude: 24.8333,
        longitude: 92.7789,
        emergencyType: "medical",
        severity: "critical",
        offlineEventId: "offline-evt-1001",
      }),
    });

    expect(res.status).toBe(201);
    const data: any = await res.json();
    expect(data.publicCode).toMatch(/^SOS-[A-Z0-9]{8}$/);
    expect(data.status).toBe("pending");
  });

  it("deduplicates identical offline SOS sync requests with the same offlineEventId", async () => {
    const eventId = "offline-evt-dedup-unique-123";

    const firstRes = await fetch(`${baseUrl}/api/sos/offline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationLabel: "Guwahati Flood Zone",
        latitude: 26.1445,
        longitude: 91.7362,
        emergencyType: "flood",
        offlineEventId: eventId,
      }),
    });

    expect(firstRes.status).toBe(201);
    const firstData: any = await firstRes.json();
    const originalCode = firstData.publicCode;
    const originalId = firstData.incidentId;

    // Second retry with the same eventId
    const retryRes = await fetch(`${baseUrl}/api/sos/offline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationLabel: "Guwahati Flood Zone",
        latitude: 26.1445,
        longitude: 91.7362,
        emergencyType: "flood",
        offlineEventId: eventId,
      }),
    });

    expect(retryRes.status).toBe(200);
    const retryData: any = await retryRes.json();
    expect(retryData.publicCode).toBe(originalCode);
    expect(retryData.incidentId).toBe(originalId);
    expect(retryData.deduplicated).toBe(true);
  });

  it("rejects offline SOS with invalid GPS coordinates", async () => {
    const res = await fetch(`${baseUrl}/api/sos/offline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationLabel: "Invalid Coordinates Test",
        latitude: 95.0, // Invalid latitude (> 90)
        longitude: 91.7362,
      }),
    });

    expect(res.status).toBe(400);
    const data: any = await res.json();
    expect(data.error).toContain("Invalid GPS coordinates");
  });

  it("rejects unauthorized public sequential numeric incident ID queries", async () => {
    const res = await fetch(`${baseUrl}/api/incidents/1/status`);
    expect(res.status).toBe(403);
    const data: any = await res.json();
    expect(data.error).toContain("Access denied");
  });

  it("allows public status queries when using publicCode format", async () => {
    // First create an incident
    const createRes = await fetch(`${baseUrl}/api/sos/offline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationLabel: "Public Code Test Location",
        latitude: 26.15,
        longitude: 91.75,
        offlineEventId: "public-code-test-evt",
      }),
    });

    const createData: any = await createRes.json();
    const publicCode = createData.publicCode;

    // Public query using publicCode
    const statusRes = await fetch(`${baseUrl}/api/incidents/${publicCode}/status`);
    expect(statusRes.status).toBe(200);
    const statusData: any = await statusRes.json();
    expect(statusData.publicCode).toBe(publicCode);
    expect(statusData.status).toBe("pending");
    // Verifies numeric internal incidentId is not leaked on publicCode route
    expect(statusData.incidentId).toBeUndefined();
  });
});
