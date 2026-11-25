import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { clusterIncidentsDBSCAN } from "./dispatch/clustering";
import { calculateRoadRouteAndEta, findIntersectedFloodZones, parseFloodZonesForRouting, clearRouteCache } from "./routing/routing.service";
import { _memoryUsers } from "./rescue.db";

describe("Unified SAHAY Architecture Verification", () => {
  it("clusters nearby SOS incidents within 500m using DBSCAN while keeping distant ones separate", () => {
    const now = new Date();
    const incidents = [
      {
        id: 101,
        publicCode: "SOS-CLU00001",
        locationLabel: "Fancy Bazar Block A",
        latitude: 26.183,
        longitude: 91.741,
        severity: "high" as const,
        emergencyType: "flood",
        peopleAffected: 3,
        status: "pending",
        createdAt: now,
      },
      {
        id: 102,
        publicCode: "SOS-CLU00002",
        locationLabel: "Fancy Bazar Block B",
        latitude: 26.1842,
        longitude: 91.7421,
        severity: "critical" as const,
        emergencyType: "trapped",
        peopleAffected: 5,
        status: "pending",
        createdAt: new Date(now.getTime() + 5 * 60_000),
      },
      {
        id: 103,
        publicCode: "SOS-DIST0001",
        locationLabel: "Dispur Sector 5",
        latitude: 26.140,
        longitude: 91.790,
        severity: "medium" as const,
        emergencyType: "medical",
        peopleAffected: 1,
        status: "pending",
        createdAt: now,
      },
    ];

    const result = clusterIncidentsDBSCAN(incidents, { epsilonKm: 0.5, minPoints: 2 });
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].incidentCount).toBe(2);
    expect(result.clusters[0].totalPeopleAffected).toBe(8);
    expect(result.clusters[0].highestSeverity).toBe("critical");
    expect(result.clusters[0].publicCodes).toEqual(["SOS-CLU00001", "SOS-CLU00002"]);
    expect(result.unclusteredIncidentIds).toEqual([103]);
  });

  it("detects flood zone intersections and computes safe flood-aware detours", async () => {
    clearRouteCache();
    const floodPolygonJson = JSON.stringify([
      { lat: 26.170, lng: 91.740 },
      { lat: 26.170, lng: 91.760 },
      { lat: 26.180, lng: 91.760 },
      { lat: 26.180, lng: 91.740 },
    ]);

    const zones = parseFloodZonesForRouting([
      { name: "Submerged Highway Sector", severity: "critical", polygonJson: floodPolygonJson },
    ]);
    expect(zones).toHaveLength(1);

    // Direct line from (26.165, 91.750) to (26.185, 91.750) cuts right through the flood zone
    const directLine: [number, number][] = [
      [26.165, 91.750],
      [26.185, 91.750],
    ];
    const hits = findIntersectedFloodZones(directLine, zones);
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe("Submerged Highway Sector");

    // In offline/fallback mode or OSRM detour, route avoids the flood polygon with a detour waypoint
    const route = await calculateRoadRouteAndEta(
      { latitude: 26.165, longitude: 91.750 },
      { latitude: 26.185, longitude: 91.750 },
      { floodZones: zones }
    );
    expect(route.coordinates.length).toBeGreaterThanOrEqual(2);
    expect(route.floodAvoidance?.intersectedZones).toContain("Submerged Highway Sector");
    expect(route.floodAvoidance?.detourApplied).toBe(true);
    expect(route.floodAvoidance?.hazardWarning).toContain("Submerged Highway Sector");
  });

  it("includes voiceNoteUrl in statusByCode and exposes clusteredIncidents to Admin", async () => {
    const citizenUser = {
      id: 98101,
      openId: "citizen_unified_98101",
      name: "Asha Devi",
      email: "asha@example.com",
      password: "hash",
      loginMethod: "password",
      role: "user" as const,
      status: "active" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const adminUser = {
      id: 98102,
      openId: "admin_unified_98102",
      name: "Command Officer",
      email: "cmd@assamrescue.gov.in",
      password: "hash",
      loginMethod: "password",
      role: "admin" as const,
      status: "active" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    _memoryUsers.set(String(citizenUser.id), citizenUser);
    _memoryUsers.set(citizenUser.openId, citizenUser);
    _memoryUsers.set(String(adminUser.id), adminUser);
    _memoryUsers.set(adminUser.openId, adminUser);

    const citizenCaller = appRouter.createCaller({
      user: citizenUser,
      req: { protocol: "https", headers: {}, cookies: {} } as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
    });
    const adminCaller = appRouter.createCaller({
      user: adminUser,
      req: { protocol: "https", headers: {}, cookies: {} } as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
    });

    const tinyAudio = "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAA==";
    const sos = await citizenCaller.rescue.emergency.create({
      emergencyType: "flood",
      severity: "critical",
      peopleAffected: 2,
      locationLabel: "Guwahati Station North",
      latitude: 26.182,
      longitude: 91.751,
      voiceNoteDataUrl: tinyAudio,
      voiceNoteDurationSeconds: 4,
    });

    const tracking = await citizenCaller.rescue.emergency.statusByCode({ publicCode: sos.publicCode });
    expect(tracking.voiceNoteUrl).toBeTruthy();
    expect(tracking.voiceNoteDurationSeconds).toBe(4);

    // Create second nearby SOS to verify clustering endpoint
    await citizenCaller.rescue.emergency.create({
      emergencyType: "flood",
      severity: "high",
      peopleAffected: 1,
      locationLabel: "Guwahati Station East",
      latitude: 26.1825,
      longitude: 91.7515,
    });

    const clustered = await adminCaller.rescue.operations.clusteredIncidents({ epsilonKm: 0.5, minPoints: 2 });
    expect(clustered.clusters.length).toBeGreaterThanOrEqual(1);
    expect(clustered.clusters.some(c => c.publicCodes.includes(sos.publicCode))).toBe(true);
  });
});
