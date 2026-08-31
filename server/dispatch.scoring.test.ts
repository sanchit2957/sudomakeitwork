import { describe, expect, it } from "vitest";
import {
  calculateHaversineDistanceKm,
  evaluateCapabilityScore,
  scoreCandidate,
  type RescuerCandidate,
  type IncidentDispatchTarget,
} from "./dispatch/scoring";

describe("Automated Dispatch Scoring Engine", () => {
  describe("Haversine Distance Calculation", () => {
    it("returns 0 km for identical coordinates", () => {
      const dist = calculateHaversineDistanceKm(26.1445, 91.7362, 26.1445, 91.7362);
      expect(dist).toBe(0);
    });

    it("accurately calculates distance between Guwahati and Dispur (~6 km)", () => {
      // Guwahati: 26.1445, 91.7362 -> Dispur: 26.1307, 91.7900
      const dist = calculateHaversineDistanceKm(26.1445, 91.7362, 26.1307, 91.7900);
      expect(dist).toBeGreaterThan(5);
      expect(dist).toBeLessThan(7);
    });
  });

  describe("Capability Matching Rules", () => {
    it("gives 1000 base capability points for matching medical capability on medical SOS", () => {
      const res = evaluateCapabilityScore("medical", [
        { capability: "medical", priority: 1, active: "yes" },
      ]);
      expect(res.compatible).toBe(true);
      expect(res.capabilityScore).toBe(1000);
    });

    it("gives 0 capability score for rescuer without medical capability on medical SOS", () => {
      const res = evaluateCapabilityScore("medical", [
        { capability: "flood_rescue", priority: 1, active: "yes" },
        { capability: "general_emergency", priority: 1, active: "yes" },
      ]);
      expect(res.compatible).toBe(false);
      expect(res.capabilityScore).toBe(0);
    });

    it("gives 1000 base capability points for flood_rescue or trapped_rescue on rescue SOS", () => {
      const resFlood = evaluateCapabilityScore("rescue", [
        { capability: "flood_rescue", priority: 1, active: "yes" },
      ]);
      const resTrapped = evaluateCapabilityScore("rescue", [
        { capability: "trapped_rescue", priority: 1, active: "yes" },
      ]);
      expect(resFlood.compatible).toBe(true);
      expect(resFlood.capabilityScore).toBe(1000);
      expect(resTrapped.compatible).toBe(true);
      expect(resTrapped.capabilityScore).toBe(1000);
    });

    it("gives 800 capability points for evacuation and 500 for general_emergency on rescue SOS", () => {
      const resEvac = evaluateCapabilityScore("rescue", [
        { capability: "evacuation", priority: 1, active: "yes" },
      ]);
      const resGen = evaluateCapabilityScore("rescue", [
        { capability: "general_emergency", priority: 1, active: "yes" },
      ]);
      expect(resEvac.capabilityScore).toBe(800);
      expect(resGen.capabilityScore).toBe(500);
    });

    it("gives 1000 base points for general_emergency capability on emergency SOS", () => {
      const resGen = evaluateCapabilityScore("emergency", [
        { capability: "general_emergency", priority: 1, active: "yes" },
      ]);
      expect(resGen.capabilityScore).toBe(1000);
    });
  });

  describe("Strict Capability Priority over Distance", () => {
    const now = new Date();
    const target: IncidentDispatchTarget = {
      id: 101,
      latitude: 26.1445,
      longitude: 91.7362,
      emergencyType: "medical",
      requestCategory: "medical",
      severity: "critical",
      peopleAffected: 2,
    };

    it("strictly scores a qualified medical responder 5 km away higher than an unqualified general responder 0.5 km away", () => {
      // Qualified medical responder 5 km away (lat offset ~0.045)
      const qualifiedMedicalResponder: RescuerCandidate = {
        user: { id: 10, name: "Dr. Partha", role: "rescuer", status: "active" },
        profile: {
          callSign: "MED-ALPHA",
          availability: "available",
          lastLatitude: 26.1895,
          lastLongitude: 91.7362,
          locationUpdatedAt: now,
        },
        capabilities: [{ capability: "medical", priority: 1, active: "yes" }],
        activeMissionsCount: 0,
      };

      // Unqualified general responder 0.5 km away (lat offset ~0.0045)
      const unqualifiedGeneralResponder: RescuerCandidate = {
        user: { id: 20, name: "General Patrol", role: "rescuer", status: "active" },
        profile: {
          callSign: "PATROL-01",
          availability: "available",
          lastLatitude: 26.1490,
          lastLongitude: 91.7362,
          locationUpdatedAt: now,
        },
        capabilities: [{ capability: "general_emergency", priority: 1, active: "yes" }],
        activeMissionsCount: 0,
      };

      const matchMedical = scoreCandidate(qualifiedMedicalResponder, target, now);
      const matchGeneral = scoreCandidate(unqualifiedGeneralResponder, target, now);

      expect(matchMedical.isEligible).toBe(true);
      expect(matchGeneral.isEligible).toBe(false);
      expect(matchMedical.score).toBeGreaterThan(matchGeneral.score);
      expect(matchMedical.breakdown.capabilityScore).toBe(1000);
      expect(matchGeneral.breakdown.capabilityScore).toBe(0);
    });
  });

  describe("Deterministic Scoring & Distance Weighting", () => {
    const now = new Date();
    const target: IncidentDispatchTarget = {
      id: 102,
      latitude: 26.1445,
      longitude: 91.7362,
      emergencyType: "flood",
      requestCategory: "rescue",
      severity: "high",
      peopleAffected: 4,
    };

    it("gives higher total score to closer candidate when capabilities are equal", () => {
      const unitClose: RescuerCandidate = {
        user: { id: 30, name: "Rescuer Close", role: "rescuer", status: "active" },
        profile: {
          callSign: "BOAT-A",
          availability: "available",
          lastLatitude: 26.1545, // ~1.1 km
          lastLongitude: 91.7362,
          locationUpdatedAt: now,
        },
        capabilities: [{ capability: "flood_rescue", priority: 1, active: "yes" }],
        activeMissionsCount: 0,
      };

      const unitFar: RescuerCandidate = {
        user: { id: 31, name: "Rescuer Far", role: "rescuer", status: "active" },
        profile: {
          callSign: "BOAT-B",
          availability: "available",
          lastLatitude: 26.1845, // ~4.4 km
          lastLongitude: 91.7362,
          locationUpdatedAt: now,
        },
        capabilities: [{ capability: "flood_rescue", priority: 1, active: "yes" }],
        activeMissionsCount: 0,
      };

      const scoreClose = scoreCandidate(unitClose, target, now);
      const scoreFar = scoreCandidate(unitFar, target, now);

      expect(scoreClose.isEligible).toBe(true);
      expect(scoreFar.isEligible).toBe(true);
      expect(scoreClose.score).toBeGreaterThan(scoreFar.score);
      expect(scoreClose.distanceKm).toBeLessThan(scoreFar.distanceKm);
    });
  });
});
