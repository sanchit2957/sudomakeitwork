import { describe, expect, it, beforeEach } from "vitest";
import {
  advanceIncidentDispatch,
  acceptMissionOffer,
  CITIZEN_TRIAGE_WINDOW_MS,
  RESPONDER_OFFER_WINDOW_MS,
  DISPATCH_RADIUS_TIERS_KM,
} from "./dispatch/dispatch";
import {
  findRankedMatchesForIncident,
  getRescuerCandidates,
} from "./dispatch/matching";
import { evaluateCapabilityScore } from "./dispatch/scoring";
import {
  _memoryHospitals,
  _memoryIncidents,
  _memoryMissionOffers,
  _memoryMissions,
  _memoryRescueProfiles,
  _memoryUsers,
  _memoryPostRescueCheckIns,
  listHospitals,
  setIncidentDestinationHospital,
  submitPostRescueCheckIn,
  getPostRescueCheckInByPublicCode,
  listPostRescueCheckIns,
} from "./rescue.db";

describe("Auto-Assignment, Hospital Panel, Live Tracking & Post-Rescue Check-in", () => {
  beforeEach(() => {
    _memoryIncidents.clear();
    _memoryMissionOffers.clear();
    _memoryMissions.clear();
    _memoryUsers.clear();
    _memoryRescueProfiles.clear();
    _memoryPostRescueCheckIns.clear();
  });

  describe("1. Timers & Radius Tier Constants", () => {
    it("configures 15-second citizen triage and 30-second responder offer countdown windows", () => {
      expect(CITIZEN_TRIAGE_WINDOW_MS).toBe(15_000);
      expect(RESPONDER_OFFER_WINDOW_MS).toBe(30_000);
      expect(DISPATCH_RADIUS_TIERS_KM).toEqual([15, 35, 75, 150, Infinity]);
    });
  });

  describe("2. Category and Capability Matching Priority", () => {
    it("evaluates capability and rescuer category match priority", () => {
      // Boat category for flood/trapped rescue
      const boatScore = evaluateCapabilityScore("rescue", [], { category: "boat" });
      expect(boatScore.compatible).toBe(true);
      expect(boatScore.capabilityScore).toBeGreaterThan(600);

      // Medical category for medical SOS
      const medicalScore = evaluateCapabilityScore("medical", [], { category: "medical" });
      expect(medicalScore.compatible).toBe(true);
      expect(medicalScore.capabilityScore).toBeGreaterThan(600);

      // Other / ground-team category
      const groundScore = evaluateCapabilityScore("emergency", [], { category: "ground-team" });
      expect(groundScore.compatible).toBe(true);
      expect(groundScore.capabilityScore).toBeGreaterThan(400);
    });
  });

  describe("3. Simultaneous Broadcast & Concurrency Race Resolution", () => {
    it("broadcasts offers simultaneously to all eligible nearby rescuers within 15s window", async () => {
      const now = new Date("2026-09-01T12:00:00.000Z");

      // Setup 2 rescuer users
      _memoryUsers.set("101", { id: 101, email: "rescuer1@test.org", name: "Rescuer 1", role: "rescuer", status: "active", createdAt: now, updatedAt: now });
      _memoryUsers.set("102", { id: 102, email: "rescuer2@test.org", name: "Rescuer 2", role: "rescuer", status: "active", createdAt: now, updatedAt: now });

      _memoryRescueProfiles.set(101, {
        id: 101,
        userId: 101,
        callSign: "Alpha-1",
        category: "medical",
        phone: "+919876543210",
        photoKey: null,
        photoUrl: null,
        contactSharing: "yes",
        locationSharing: "yes",
        availability: "available",
        lastLatitude: 26.15,
        lastLongitude: 91.75,
        locationUpdatedAt: now,
        updatedAt: now,
      });

      _memoryRescueProfiles.set(102, {
        id: 102,
        userId: 102,
        callSign: "Alpha-2",
        category: "medical",
        phone: "+919876543211",
        photoKey: null,
        photoUrl: null,
        contactSharing: "yes",
        locationSharing: "yes",
        availability: "available",
        lastLatitude: 26.16,
        lastLongitude: 91.76,
        locationUpdatedAt: now,
        updatedAt: now,
      });

      // Create an incident
      _memoryIncidents.set(501, {
        id: 501,
        publicCode: "SOS-MATCH01",
        reporterId: 1,
        contactName: "Victim A",
        locationLabel: "Guwahati Medical Circle",
        latitude: 26.155,
        longitude: 91.755,
        emergencyType: "medical",
        requestCategory: "medical",
        helpNeeds: "Urgent first aid",
        severity: "critical",
        peopleAffected: 2,
        notes: null,
        evidenceKey: null,
        evidenceUrl: null,
        voiceNoteKey: null,
        voiceNoteUrl: null,
        voiceNoteDurationSeconds: null,
        status: "pending",
        dispatchStatus: "matching",
        triageStartedAt: now,
        triageDeadlineAt: now,
        triageSelectedAt: now,
        matchingStartedAt: now,
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

      const result = await advanceIncidentDispatch(501, now);
      expect(result).not.toBeNull();
      expect(result?.status).toBe("offered");
      expect(result?.offers?.length).toBeGreaterThanOrEqual(2);

      const offers = Array.from(_memoryMissionOffers.values()).filter(o => o.incidentId === 501);
      expect(offers.length).toBeGreaterThanOrEqual(2);

      // Verify concurrent offer expiry
      const offer1 = offers.find(o => o.rescuerId === 101)!;
      const offer2 = offers.find(o => o.rescuerId === 102)!;
      expect(offer1.expiresAt.getTime()).toBe(now.getTime() + RESPONDER_OFFER_WINDOW_MS);

      // Concurrency race: Rescuer 102 accepts first
      const accepted = await acceptMissionOffer(offer2.id, 102, new Date(now.getTime() + 5000));
      expect(accepted.missionId).toBeDefined();

      // Other offer for Rescuer 101 automatically cancelled/expired
      const remainingOffer1 = Array.from(_memoryMissionOffers.values()).find(o => o.incidentId === 501 && o.rescuerId === 101);
      expect(remainingOffer1?.status).toBe("cancelled");
    });

    it("silently broadens search radius tier on zero acceptances without escalating to Command", async () => {
      const now = new Date("2026-09-01T12:00:00.000Z");

      // Rescuer far away (> 50 km)
      _memoryUsers.set("201", { id: 201, email: "far@test.org", name: "Far Rescuer", role: "rescuer", status: "active", createdAt: now, updatedAt: now });
      _memoryRescueProfiles.set(201, {
        id: 201,
        userId: 201,
        callSign: "Far-Team",
        category: "ground-team",
        phone: "+919876543220",
        photoKey: null,
        photoUrl: null,
        contactSharing: "yes",
        locationSharing: "yes",
        availability: "available",
        lastLatitude: 26.60,
        lastLongitude: 92.20,
        locationUpdatedAt: now,
        updatedAt: now,
      });

      _memoryIncidents.set(601, {
        id: 601,
        publicCode: "SOS-TIER001",
        reporterId: 1,
        contactName: "Victim B",
        locationLabel: "Guwahati Centre",
        latitude: 26.155,
        longitude: 91.755,
        emergencyType: "other",
        requestCategory: "emergency",
        helpNeeds: "General help",
        severity: "medium",
        peopleAffected: 1,
        notes: null,
        evidenceKey: null,
        evidenceUrl: null,
        voiceNoteKey: null,
        voiceNoteUrl: null,
        voiceNoteDurationSeconds: null,
        status: "pending",
        dispatchStatus: "matching",
        triageStartedAt: now,
        triageDeadlineAt: now,
        triageSelectedAt: now,
        matchingStartedAt: now,
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

      // Advance dispatch silently broadens tier from 15km to 75km and matches Far-Team!
      const result = await advanceIncidentDispatch(601, now);
      expect(result).not.toBeNull();
      expect(result?.status).toBe("offered");
      expect(result?.offers?.some(o => o.rescuerId === 201)).toBe(true);

      const inc = _memoryIncidents.get(601);
      expect(inc?.dispatchStatus).toBe("offered");
      expect(inc?.escalatedToCommandAt).toBeNull();
    });
  });

  describe("4. Hospital Data & Rescuer-Hospital Handoff", () => {
    it("returns all 6 hospital fields in listHospitals", async () => {
      const hospitals = await listHospitals();
      expect(hospitals.length).toBeGreaterThan(0);

      const gmch = hospitals.find(h => h.name.includes("GMCH")) || hospitals[0];
      expect(gmch.name).toBeDefined();
      expect(gmch.address).toBeDefined();
      expect(gmch.latitude).toBeDefined();
      expect(gmch.longitude).toBeDefined();
      expect(gmch.totalEmergencyBeds).toBeGreaterThan(0);
      expect(gmch.availableEmergencyBeds).toBeDefined();
      expect(gmch.totalIcuBeds).toBeGreaterThan(0);
      expect(gmch.availableIcuBeds).toBeDefined();
      expect(gmch.specialty).toBeDefined();
      expect(gmch.contactPhone).toBeDefined();
    });

    it("assigns destination hospital to incident and records handoff event", async () => {
      const now = new Date();
      _memoryIncidents.set(701, {
        id: 701,
        publicCode: "SOS-HOSP001",
        reporterId: 1,
        contactName: "Victim C",
        locationLabel: "Dispur Field",
        latitude: 26.14,
        longitude: 91.77,
        emergencyType: "medical",
        requestCategory: "medical",
        helpNeeds: "Trauma case",
        severity: "critical",
        peopleAffected: 1,
        notes: null,
        evidenceKey: null,
        evidenceUrl: null,
        voiceNoteKey: null,
        voiceNoteUrl: null,
        voiceNoteDurationSeconds: null,
        status: "dispatched",
        dispatchStatus: "assigned",
        triageStartedAt: now,
        triageDeadlineAt: now,
        triageSelectedAt: now,
        matchingStartedAt: now,
        matchingAttempts: 1,
        escalatedToCommandAt: null,
        assignedRescuerId: 101,
        destinationHospitalId: null,
        destinationHospitalName: null,
        dispatchedAt: now,
        resolvedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      const res = await setIncidentDestinationHospital(701, 1, 101);
      expect(res.success).toBe(true);
      expect(res.hospital.name).toContain("Gauhati Medical College");

      const inc = _memoryIncidents.get(701);
      expect(inc?.destinationHospitalId).toBe(1);
      expect(inc?.destinationHospitalName).toContain("Gauhati Medical College");
    });
  });

  describe("5. Post-Rescue Check-in", () => {
    it("submits and retrieves post-rescue check-in response", async () => {
      const checkIn = await submitPostRescueCheckIn({
        incidentId: 701,
        publicCode: "SOS-HOSP001",
        reporterId: 1,
        reliefCentreAllotted: "yes",
        helpCategory: "medical",
        notes: "Allotted Bed 4 at Camp A. Need ongoing insulin supply.",
      });

      expect(checkIn.id).toBeDefined();
      expect(checkIn.reliefCentreAllotted).toBe("yes");
      expect(checkIn.helpCategory).toBe("medical");
      expect(checkIn.notes).toContain("insulin");

      const retrieved = await getPostRescueCheckInByPublicCode("SOS-HOSP001");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.reliefCentreAllotted).toBe("yes");
      expect(retrieved?.helpCategory).toBe("medical");
    });

    it("lists post-rescue records and respects 24-hour retention window", async () => {
      // Recent record (1 hour ago)
      const recent = await submitPostRescueCheckIn({
        incidentId: 702,
        publicCode: "SOS-RECENT01",
        reporterId: 1,
        reliefCentreAllotted: "yes",
        helpCategory: "evacuation",
        notes: "Family evacuated safely to relief camp.",
      });

      // Older record (25 hours ago - expired)
      const expiredId = _memoryPostRescueCheckIns.size + 1;
      _memoryPostRescueCheckIns.set(expiredId, {
        id: expiredId,
        incidentId: 703,
        publicCode: "SOS-OLD01",
        reporterId: 1,
        reliefCentreAllotted: "no",
        helpCategory: "other",
        notes: "Old checkin",
        submittedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      });

      const records = await listPostRescueCheckIns(24);
      expect(records.some(r => r.publicCode === "SOS-RECENT01")).toBe(true);
      expect(records.some(r => r.publicCode === "SOS-OLD01")).toBe(false);
    });
  });
});
