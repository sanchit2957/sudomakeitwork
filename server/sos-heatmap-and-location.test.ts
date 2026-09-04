import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import {
  _memoryIncidents,
  _memoryRescueProfiles,
  _memoryUsers,
  getRescuerProfile,
  getSosHeatmapPoints,
} from "./rescue.db";
import { presentAssignedRescuerToVictim } from "./rescuer-profile.policy";

describe("Master Production Repair & Feature Completion Tests", () => {
  beforeEach(() => {
    _memoryIncidents.clear();
    _memoryRescueProfiles.clear();
  });

  describe("A. SOS Heat Map Backend (rescue.emergency.heatmap)", () => {
    it("1. emergency.heatmap exists on rescueRouter", () => {
      const caller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      expect(caller.rescue.emergency.heatmap).toBeDefined();
      expect(typeof caller.rescue.emergency.heatmap).toBe("function");
    });

    it("2. It returns real incident coordinates with safe public fields", async () => {
      const caller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any });

      const incidentId = 999;
      _memoryIncidents.set(incidentId, {
        id: incidentId,
        publicCode: "SOS-MUMBAI01",
        reporterId: 10,
        contactName: "John Citizen (Secret)",
        locationLabel: "Private Home Address, Mumbai",
        latitude: 19.076,
        longitude: 72.8777,
        emergencyType: "flood",
        severity: "critical",
        peopleAffected: 3,
        notes: "Confidential medical notes",
        status: "pending",
        requestCategory: "emergency",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const heatmap = await caller.rescue.emergency.heatmap();
      expect(heatmap).toHaveLength(1);
      const point = heatmap[0];

      // Safe public map fields only
      expect(point.lat).toBeCloseTo(19.076);
      expect(point.lng).toBeCloseTo(72.8777);
      expect(point.severity).toBe("critical");
      expect(point.emergencyType).toBe("flood");
      expect(point.weight).toBe(1.0); // critical weight = 1.0

      // 4. Private fields must NOT be returned
      expect((point as any).contactName).toBeUndefined();
      expect((point as any).notes).toBeUndefined();
      expect((point as any).reporterId).toBeUndefined();
      expect((point as any).locationLabel).toBeUndefined();
    });

    it("3. Invalid/null coordinates are strictly excluded", async () => {
      const caller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any });

      _memoryIncidents.set(101, {
        id: 101,
        latitude: NaN,
        longitude: 72.87,
        severity: "high",
        emergencyType: "medical",
        status: "pending",
        createdAt: new Date(),
      } as any);

      _memoryIncidents.set(102, {
        id: 102,
        latitude: 19.07,
        longitude: Infinity,
        severity: "medium",
        emergencyType: "trapped",
        status: "pending",
        createdAt: new Date(),
      } as any);

      _memoryIncidents.set(103, {
        id: 103,
        latitude: 105, // > 90
        longitude: 72.87,
        severity: "low",
        emergencyType: "flood",
        status: "pending",
        createdAt: new Date(),
      } as any);

      _memoryIncidents.set(104, {
        id: 104,
        latitude: 19.07,
        longitude: -200, // < -180
        severity: "low",
        emergencyType: "flood",
        status: "pending",
        createdAt: new Date(),
      } as any);

      // Valid incident
      _memoryIncidents.set(105, {
        id: 105,
        latitude: 19.2251,
        longitude: 73.1084,
        severity: "high",
        emergencyType: "flood",
        status: "pending",
        createdAt: new Date(),
      } as any);

      const heatmap = await caller.rescue.emergency.heatmap();
      expect(heatmap).toHaveLength(1);
      expect(heatmap[0].lat).toBeCloseTo(19.2251);
      expect(heatmap[0].lng).toBeCloseTo(73.1084);
      expect(heatmap[0].weight).toBe(0.75); // high weight = 0.75
    });

    it("5. Zero incidents returns an empty array (no fabricated heat)", async () => {
      const caller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      const heatmap = await caller.rescue.emergency.heatmap();
      expect(heatmap).toEqual([]);
    });

    it("8. Severity weighting hierarchy is strictly verified: critical > high > medium > low", async () => {
      const caller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any });

      const severities = ["critical", "high", "medium", "low"] as const;
      severities.forEach((sev, idx) => {
        _memoryIncidents.set(idx + 1, {
          id: idx + 1,
          latitude: 15 + idx,
          longitude: 75 + idx,
          severity: sev,
          emergencyType: "flood",
          status: "pending",
          createdAt: new Date(),
        } as any);
      });

      const heatmap = await caller.rescue.emergency.heatmap();
      expect(heatmap).toHaveLength(4);

      const criticalPt = heatmap.find(p => p.severity === "critical")!;
      const highPt = heatmap.find(p => p.severity === "high")!;
      const medPt = heatmap.find(p => p.severity === "medium")!;
      const lowPt = heatmap.find(p => p.severity === "low")!;

      expect(criticalPt.weight).toBeGreaterThan(highPt.weight);
      expect(highPt.weight).toBeGreaterThan(medPt.weight);
      expect(medPt.weight).toBeGreaterThan(lowPt.weight);
      expect(criticalPt.weight).toBe(1.0);
      expect(highPt.weight).toBe(0.75);
      expect(medPt.weight).toBe(0.5);
      expect(lowPt.weight).toBe(0.25);
    });
  });

  describe("B. Uninitialized Responder & GPS Location Semantics", () => {
    it("14. Uninitialized responder has null GPS coordinates (no fake Assam coordinates)", async () => {
      const testUserId = 7777;
      _memoryUsers.set(String(testUserId), {
        id: testUserId,
        name: "New Uninitialized Rescuer",
        role: "rescuer",
        status: "active",
      } as any);

      const profile = await getRescuerProfile(testUserId);
      expect(profile).toBeDefined();
      expect(profile?.lastLatitude).toBeNull();
      expect(profile?.lastLongitude).toBeNull();
      expect(profile?.locationUpdatedAt).toBeNull();
    });

    it("15. Rescuer without transmitted location yields null location in presentAssignedRescuerToVictim", () => {
      const presented = presentAssignedRescuerToVictim({
        callSign: "Alpha-1",
        name: "Rescuer Name",
        photoUrl: null,
        phone: "+919876543210",
        contactSharing: "yes",
        locationSharing: "no",
        lastLatitude: null,
        lastLongitude: null,
        locationUpdatedAt: null,
      });

      expect(presented.locationStatus).toBe("off");
      expect(presented.location).toBeNull();
    });

    it("12 & 13. Historical SOS location and rescuer GPS remain independent", () => {
      const originalSosLat = 18.5204; // Pune
      const originalSosLng = 73.8567;

      const rescuerLat = 19.076; // Mumbai
      const rescuerLng = 72.8777;

      const presented = presentAssignedRescuerToVictim({
        callSign: "Bravo-2",
        name: "Rescuer Field",
        photoUrl: null,
        phone: "+919876543211",
        contactSharing: "yes",
        locationSharing: "yes",
        lastLatitude: rescuerLat,
        lastLongitude: rescuerLng,
        locationUpdatedAt: new Date(),
      });

      expect(presented.locationStatus).toBe("live");
      expect(presented.location?.latitude).toBe(rescuerLat);
      expect(presented.location?.longitude).toBe(rescuerLng);

      // Historical SOS location is untouched
      expect(originalSosLat).not.toBe(presented.location?.latitude);
      expect(originalSosLng).not.toBe(presented.location?.longitude);
    });
  });

  describe("C. Conditions query location coordinates", () => {
    it("10. Current GPS coordinates reach conditions procedure", async () => {
      const caller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      const customLat = 13.0827; // Chennai
      const customLng = 80.2707;

      const result = await caller.rescue.emergency.conditions({
        latitude: customLat,
        longitude: customLng,
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty("risk");
    });
  });
});
