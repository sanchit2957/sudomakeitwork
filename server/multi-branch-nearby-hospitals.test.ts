import { beforeEach, describe, expect, it, vi } from "vitest";
import { _memoryHospitals, listHospitals } from "./rescue.db";
import {
  authorizeHospitalBranchMutation,
  createHospitalBranch,
  deleteHospitalBranch,
  getBranchesForOwner,
  updateHospitalBranch,
} from "./services/hospitalBranches";
import {
  discoverNearbyHospitals,
  isMatchingHospitalName,
} from "./services/nearbyHospitals";

describe("Multi-Branch Self-Service Hospital & Pan-India Nearby Discovery", () => {
  beforeEach(() => {
    _memoryHospitals.clear();
    vi.restoreAllMocks();
  });

  it("starts with zero hardcoded GMCH/AMCH legacy hospitals", async () => {
    const existing = await listHospitals();
    expect(existing.some(h => h.name.includes("GMCH") || h.name.includes("AMCH"))).toBe(false);
    expect(existing.length).toBe(0);
  });

  it("allows any Hospital Officer to register multiple branches in different cities and manage capacity", async () => {
    const ownerUserId = 901;

    const puneBranch = await createHospitalBranch(ownerUserId, {
      organizationName: "Sahyadri Metro Healthcare",
      branchName: "Pune Trauma Campus",
      registrationId: "IN-MH-HFR-101",
      isPrimaryBranch: true,
      address: "Deccan Gymkhana, Karve Road",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411004",
      phone: "+91 20 6721 3000",
      latitude: 18.5167,
      longitude: 73.8412,
      specialties: ["Trauma Care", "ICU & Critical Care"],
      erTotal: 40,
      erAvailable: 22,
      icuTotal: 15,
      icuAvailable: 6,
      oxygenUnits: 80,
      bloodUnits: 45,
      ambulances: 4,
      status: "OPEN",
    });

    const mumbaiBranch = await createHospitalBranch(ownerUserId, {
      organizationName: "Sahyadri Metro Healthcare",
      branchName: "Andheri East Emergency Wing",
      isPrimaryBranch: false,
      address: "Western Express Highway, Andheri East",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400069",
      phone: "+91 22 4000 9112",
      latitude: 19.1136,
      longitude: 72.8697,
      specialties: ["Emergency Medicine"],
      erTotal: 25,
      erAvailable: 12,
      icuTotal: 10,
      icuAvailable: 4,
      status: "OPEN",
    });

    const owned = await getBranchesForOwner(ownerUserId);
    expect(owned.length).toBe(2);
    expect(owned[0].isPrimaryBranch).toBe(true);
    expect(owned.some(b => b.city === "Pune")).toBe(true);
    expect(owned.some(b => b.city === "Mumbai")).toBe(true);

    // Other officers own 0 branches
    const otherOwned = await getBranchesForOwner(902);
    expect(otherOwned.length).toBe(0);

    // Non-owner cannot mutate Pune branch (FORBIDDEN)
    await expect(
      authorizeHospitalBranchMutation(puneBranch.id, {
        id: 902,
        role: "hospital",
      })
    ).rejects.toThrow(/FORBIDDEN/);

    // Admin can mutate any branch
    const adminAuthorized = await authorizeHospitalBranchMutation(puneBranch.id, {
      id: 1,
      role: "admin",
    });
    expect(adminAuthorized.id).toBe(puneBranch.id);

    // Owner updates Mumbai beds
    const updatedMumbai = await updateHospitalBranch(
      mumbaiBranch.id,
      { id: ownerUserId, role: "hospital" },
      { erAvailable: 8, status: "LIMITED" }
    );
    expect(updatedMumbai.erAvailable).toBe(8);
    expect(updatedMumbai.legacyStatus).toBe("limited");

    // Owner deletes Mumbai branch
    const del = await deleteHospitalBranch(mumbaiBranch.id, {
      id: ownerUserId,
      role: "hospital",
    });
    expect(del.success).toBe(true);
    expect((await getBranchesForOwner(ownerUserId)).length).toBe(1);
  });

  it("ranks SAHAY_VERIFIED before PUBLIC_DIRECTORY and deduplicates matching Overpass duplicates within 150m", async () => {
    const puneBranch = await createHospitalBranch(905, {
      organizationName: "Ruby Hall Emergency Centre",
      branchName: "Main Hospital",
      isPrimaryBranch: true,
      address: "40 Sassoon Road",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      phone: "+91 20 2616 3391",
      latitude: 18.5335,
      longitude: 73.8768,
      erTotal: 30,
      erAvailable: 14,
      icuTotal: 12,
      icuAvailable: 5,
      status: "OPEN",
    });

    // Register a distant hospital > 50 km away (Bengaluru)
    await createHospitalBranch(906, {
      organizationName: "Manipal Civic Hospital",
      branchName: "Old Airport Road",
      isPrimaryBranch: true,
      address: "98 HAL Old Airport Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560017",
      phone: "+91 80 2502 4444",
      latitude: 12.9589,
      longitude: 77.6489,
      erTotal: 50,
      erAvailable: 20,
      icuTotal: 15,
      icuAvailable: 7,
      status: "OPEN",
    });

    // Mock Overpass API returning 1 duplicate of Ruby Hall (~30m away) and 1 distinct Pune public hospital
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: "way",
            id: 111001,
            center: { lat: 18.5336, lon: 73.8769 },
            tags: {
              amenity: "hospital",
              name: "Ruby Hall Clinic",
              "addr:city": "Pune",
              phone: "+91 20 2616 3391",
            },
          },
          {
            type: "node",
            id: 222002,
            lat: 18.5284,
            lon: 73.8739,
            tags: {
              amenity: "hospital",
              name: "Sassoon General Hospital",
              "addr:street": "Station Road",
              "addr:city": "Pune",
              "addr:state": "Maharashtra",
            },
          },
        ],
      }),
    } as any);

    expect(isMatchingHospitalName(puneBranch.organizationName, "Ruby Hall Clinic")).toBe(true);

    const nearby = await discoverNearbyHospitals({
      lat: 18.529,
      lng: 73.874,
      radiusKm: 50,
      includePublicDirectory: true,
    });

    // Distant Bengaluru branch should be excluded in 50km radius discovery
    expect(nearby.hospitals.some(h => h.city === "Bengaluru")).toBe(false);
    // Duplicate Overpass "Ruby Hall Clinic" (~15m away) should be deduplicated
    expect(nearby.hospitals.filter(h => h.name.toLowerCase().includes("ruby"))).toHaveLength(1);
    // Tier 1 SAHAY_VERIFIED appears first, Tier 2 PUBLIC_DIRECTORY appears after
    expect(nearby.hospitals[0].source).toBe("SAHAY_VERIFIED");
    const publicHosp = nearby.hospitals.find(h => h.source === "PUBLIC_DIRECTORY");
    expect(publicHosp).toBeDefined();
    expect(publicHosp?.name).toBe("Sassoon General Hospital");

    // allRegistered returns both Pune and Bengaluru DB branches
    const allRegistered = await discoverNearbyHospitals({
      lat: 18.529,
      lng: 73.874,
      radiusKm: 50,
      allRegistered: true,
    });
    expect(allRegistered.hospitals.some(h => h.city === "Bengaluru")).toBe(true);
  });
});
