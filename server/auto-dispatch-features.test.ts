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
      _memoryUsers.set(101, { id: 101, email: "rescuer1@test.org", name: "Rescuer 1", role: "rescuer", status: "active", createdAt: now, updatedAt: now });
      _memoryUsers.set(102, { id: 102, email: "rescuer2@test.org", name: "Rescuer 2", role: "rescuer", status: "active", createdAt: now, updatedAt: now });

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
        contactPhone: "+919999999999",
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
        dispatchedAt: null,
        resolvedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      const result = await advanceIncidentDispatch(501, now);
      expect(result.status).toBe("offered");
      expect(result.offers?.length).toBeGreaterThanOrEqual(2);

      const offers = Array.from(_memoryMissionOffers.values()).filter(o => o.incidentId === 501);
      expect(offers.length).toBeGreaterThanOrEqual(2);

      const offer1 = offers.find(o => o.rescuerId === 101)!;
      const offer2 = offers.find(o => o.rescuerId === 102)!;

      // Rescuer 1 accepts first
      const acceptRes = await acceptMissionOffer(offer1.id, 101, new Date(now.getTime() + 2_000));
      expect(acceptRes.missionId).toBeDefined();

      const incident = _memoryIncidents.get(501);
      expect(incident?.status).toBe("dispatched");
      expect(incident?.assignedRescuerId).toBe(101);

      // Rescuer 2 attempts to accept later -> loses race and gets proper notice
      await expect(
        acceptMissionOffer(offer2.id, 102, new Date(now.getTime() + 3_000))
      ).rejects.toThrow(
        "This mission was already assigned to another responder. You may be matched to a nearby victim shortly."
      );
    });

    it("silently broadens search radius tier on zero acceptances without escalating to Command", async () => {
      const now = new Date("2026-09-01T12:00:00.000Z");

      // Rescuer far away (> 50 km)
      _memoryUsers.set(201, { id: 201, email: "far@test.org", name: "Far Rescuer", role: "rescuer", status: "active", createdAt: now, updatedAt: now });
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
        contactPhone: "+919999999998",
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
        dispatchedAt: null,
        resolvedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      // Advance dispatch silently broadens tier from 15km to 75km and matches Far-Team!
      const result = await advanceIncidentDispatch(601, now);
      expect(result.status).toBe("offered");
      expect(result.offers?.some(o => o.rescuerId === 201)).toBe(true);

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
        contactPhone: "+919999999997",
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
  });
});
