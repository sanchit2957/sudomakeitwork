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
  it("calculates haversine distance correctly between Assam coordinates", () => {
    // Distance between Guwahati center (26.1445, 91.7362) and Dispur Secretariat (26.1433, 91.7898) is ~5.3 km
    const distKm = haversineDistanceKm(26.1445, 91.7362, 26.1433, 91.7898);
    expect(distKm).toBeGreaterThan(4);
    expect(distKm).toBeLessThan(7);
  });

  it("filters donation targets by type (ngo vs government)", async () => {
    const allTargets = await getAllDonationTargets();
    expect(allTargets.length).toBeGreaterThanOrEqual(6);

    const ngoTargets = await getAllDonationTargets("ngo");
    expect(ngoTargets.every(t => t.type === "ngo")).toBe(true);
    expect(ngoTargets.length).toBeGreaterThanOrEqual(3);

    const govtTargets = await getAllDonationTargets("government");
    expect(govtTargets.every(t => t.type === "government")).toBe(true);
    expect(govtTargets.length).toBeGreaterThanOrEqual(3);
  });

  it("retrieves a single donation target by ID with full payment info", async () => {
    const target = await getDonationTargetById(1);
    expect(target).not.toBeNull();
    expect(target?.name).toContain("ASDMA");
    expect(target?.upiId).toBe("asdmarelief@sbi");
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

  it("loads verified Assam NGO seed dataset correctly", () => {
    const seedNgos = getSeedNgos();
    expect(seedNgos.length).toBeGreaterThanOrEqual(10);
    expect(seedNgos.some(ngo => ngo.name.includes("Red Cross"))).toBe(true);
    expect(seedNgos.some(ngo => ngo.name.includes("Goonj"))).toBe(true);
    expect(seedNgos.some(ngo => ngo.name.includes("Brahmaputra"))).toBe(true);
    expect(seedNgos.every(ngo => ngo.name && ngo.address && ngo.phone && ngo.latitude && ngo.longitude)).toBe(true);
  });

  it("fetches nearby NGOs sorted by distance from user coordinates", async () => {
    // Guwahati user location
    const guwahatiLat = 26.1445;
    const guwahatiLon = 91.7362;

    const nearby = await getNearbyNgos(guwahatiLat, guwahatiLon);
    expect(nearby.length).toBeGreaterThanOrEqual(5);

    // Verify distance sorting
    for (let i = 0; i < nearby.length - 1; i++) {
      expect(nearby[i].distanceKm!).toBeLessThanOrEqual(nearby[i + 1].distanceKm!);
    }

    // Nearest NGO to Guwahati center should be within ~15 km
    expect(nearby[0].distanceKm).toBeLessThan(15);
    expect(nearby[0].distance).toContain("km away");
  });

  it("falls back to standard message when an NGO has no listed phone number", async () => {
    const seedNgos = getSeedNgos();
    const noPhoneNgo = seedNgos.find(ngo => ngo.phone === NO_PHONE_FALLBACK);
    expect(noPhoneNgo).toBeDefined();
    expect(noPhoneNgo?.phone).toBe("Contact number not listed — reach out via address");
  });
});

