import { describe, expect, it } from "vitest";
import {
  haversineDistanceKm,
  getAllDonationTargets,
  getDonationTargetById,
  createDonation,
  getSeedNgos,
  getNearbyNgos,
  NO_PHONE_FALLBACK,
  _memoryDonations,
} from "./routers/donations";

describe("Donation Features & Backend APIs", () => {
  it("calculates haversine distance correctly between Indian coordinates", () => {
    // Distance between Mumbai (19.0760, 72.8777) and Pune (18.5204, 73.8567) is ~120 km
    const distKm = haversineDistanceKm(19.0760, 72.8777, 18.5204, 73.8567);
    expect(distKm).toBeGreaterThan(100);
    expect(distKm).toBeLessThan(140);
  });

  it("filters donation targets by type (ngo vs government)", async () => {
    const allTargets = await getAllDonationTargets();
    expect(allTargets.length).toBeGreaterThanOrEqual(6);

    const ngoTargets = await getAllDonationTargets("ngo");
    expect(ngoTargets.every(t => t.type === "ngo")).toBe(true);
    expect(ngoTargets.length).toBeGreaterThanOrEqual(3);

    const govtTargets = await getAllDonationTargets("government");
    expect(govtTargets.every(t => t.type === "government")).toBe(true);
    expect(govtTargets.length).toBeGreaterThanOrEqual(1);
  });

  it("retrieves a single donation target by ID with full payment info", async () => {
    const target = await getDonationTargetById(1);
    expect(target).not.toBeNull();
    expect(target?.name).toContain("NDMA");
    expect(target?.upiId).toBe("pmnrf@centralbank");
    expect(target?.qrCodeUrl).toBeDefined();
    expect(target?.verified).toBe(true);
  });

  it("records money, food, and clothes donations successfully", async () => {
    const moneyDonation = await createDonation({
      targetId: 1,
      donationType: "money",
      amount: 1500,
      donorUserId: 12,
    });
    expect(moneyDonation.id).toBeDefined();
    expect(moneyDonation.amount).toBe(1500);
    expect(moneyDonation.donationType).toBe("money");

    const foodDonation = await createDonation({
      targetId: 4,
      donationType: "food",
      quantityDescription: "25 kg rice, 10 packets milk powder",
      donationDate: "2026-09-01",
      donorUserId: 12,
    });
    expect(foodDonation.quantityDescription).toContain("25 kg rice");
    expect(foodDonation.donationType).toBe("food");

    const clothesDonation = await createDonation({
      targetId: 5,
      donationType: "clothes",
      quantityDescription: "20 warm fleece blankets",
      donationDate: "2026-09-02",
      donorUserId: 12,
    });
    expect(clothesDonation.quantityDescription).toContain("blankets");
    expect(clothesDonation.donationType).toBe("clothes");
  });

  it("loads verified Pan-India NGO seed dataset correctly", () => {
    const seedNgos = getSeedNgos();
    expect(seedNgos.length).toBeGreaterThanOrEqual(15);
    expect(seedNgos.some(ngo => ngo.name.includes("Red Cross"))).toBe(true);
    expect(seedNgos.some(ngo => ngo.name.includes("Goonj"))).toBe(true);
    expect(seedNgos.some(ngo => ngo.name.includes("SEEDS India"))).toBe(true);
    expect(seedNgos.some(ngo => ngo.name.includes("Doctors For You"))).toBe(true);
    expect(seedNgos.some(ngo => ngo.name.includes("Khalsa Aid India"))).toBe(true);
    expect(seedNgos.every(ngo => ngo.name && ngo.address && ngo.phone && ngo.latitude && ngo.longitude)).toBe(true);
  });

  it("fetches nearby NGOs sorted by distance across any Indian city", async () => {
    // Mumbai user location
    const mumbaiLat = 19.0760;
    const mumbaiLon = 72.8777;

    const nearby = await getNearbyNgos(mumbaiLat, mumbaiLon);
    expect(nearby.length).toBeGreaterThanOrEqual(10);

    // Verify distance sorting
    for (let i = 0; i < nearby.length - 1; i++) {
      expect(nearby[i].distanceKm!).toBeLessThanOrEqual(nearby[i + 1].distanceKm!);
    }

    // Nearest NGO to Mumbai center should be within ~15 km
    expect(nearby[0].distanceKm).toBeLessThan(15);
    expect(nearby[0].distance).toContain("km away");

    // Scope filter works for national NGOs
    const nationalOnly = await getNearbyNgos(12.9716, 77.5946, { scope: "national" });
    expect(nationalOnly.length).toBeGreaterThanOrEqual(5);
    expect(nationalOnly.every(ngo => ngo.scope === "national")).toBe(true);
  });

  it("gracefully applies fallback phone label when an NGO entry omits phone", () => {
    expect(NO_PHONE_FALLBACK).toBe("Contact number not listed — reach out via address");
  });
});

