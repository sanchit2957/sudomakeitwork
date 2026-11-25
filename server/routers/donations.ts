import express, { Request, Response, Router } from "express";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { donationTargets, donations, DonationTarget, Donation } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { INDIA_CENTER } from "../../shared/india-locations";

export const NO_PHONE_FALLBACK = "Contact number not listed — reach out via address";

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type NgoResult = {
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  scope?: "national" | "regional";
  distanceKm?: number;
  distance?: string;
};

export function getSeedNgos(): NgoResult[] {
  const possiblePaths = [
    path.resolve(process.cwd(), "server/data/indian_ngos.json"),
    path.resolve(process.cwd(), "data/indian_ngos.json"),
    new URL("../data/indian_ngos.json", import.meta.url).pathname,
  ];

  for (const filePath of possiblePaths) {
    try {
      if (existsSync(filePath)) {
        const raw = readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            name: String(item.name || "").trim(),
            address: String(item.address || "").trim(),
            phone: item.phone && String(item.phone).trim().length > 0 ? String(item.phone).trim() : NO_PHONE_FALLBACK,
            latitude: Number(item.latitude),
            longitude: Number(item.longitude),
            city: item.city ? String(item.city).trim() : undefined,
            state: item.state ? String(item.state).trim() : undefined,
            scope: item.scope === "national" ? "national" : "regional",
          }));
        }
      }
    } catch {
      // Continue to next path or in-memory fallback
    }
  }

  // Built-in Pan-India verified in-memory fallback
  return [
    {
      name: "Indian Red Cross Society (National HQ)",
      address: "1 Red Cross Road, Sansad Marg, New Delhi, Delhi 110001",
      phone: "+91 11 2371 6441",
      latitude: 28.6219,
      longitude: 77.2099,
      city: "New Delhi",
      state: "Delhi",
      scope: "national",
    },
    {
      name: "Goonj — National Disaster Relief & Rahat Hub",
      address: "J-93, Sarita Vihar, New Delhi, Delhi 110076",
      phone: "+91 11 4140 1216",
      latitude: 28.5326,
      longitude: 77.2721,
      city: "New Delhi",
      state: "Delhi",
      scope: "national",
    },
    {
      name: "SEEDS India (Disaster Resilience & Shelter Aid)",
      address: "15A Institutional Area, Sector IV, R.K. Puram, New Delhi, Delhi 110022",
      phone: "+91 11 2617 4272",
      latitude: 28.5473,
      longitude: 77.1945,
      city: "New Delhi",
      state: "Delhi",
      scope: "national",
    },
    {
      name: "Rapid Response India",
      address: "18/21, Perambur High Road, Jamalia, Chennai, Tamil Nadu 600012",
      phone: "+91 44 2662 4444",
      latitude: 13.1067,
      longitude: 80.2449,
      city: "Chennai",
      state: "Tamil Nadu",
      scope: "national",
    },
    {
      name: "Doctors For You — Emergency Medical Relief",
      address: "Flat 401, Sahayog CHS, Chembur East, Mumbai, Maharashtra 400071",
      phone: "+91 22 2520 5550",
      latitude: 19.0436,
      longitude: 72.9092,
      city: "Mumbai",
      state: "Maharashtra",
      scope: "national",
    },
    {
      name: "Khalsa Aid India — Humanitarian & Rescue Operations",
      address: "Nabha Road, Patiala, Punjab 147001",
      phone: "+91 175 230 0786",
      latitude: 30.3398,
      longitude: 76.3869,
      city: "Patiala",
      state: "Punjab",
      scope: "national",
    },
    {
      name: "Hemkunt Foundation — Disaster Oxygen & Rescue Relief",
      address: "Sector 45, Gurugram, Haryana 122003",
      phone: "+91 99906 91313",
      latitude: 28.4451,
      longitude: 77.0652,
      city: "Gurugram",
      state: "Haryana",
      scope: "national",
    },
  ];
}

/**
 * Queries LocationIQ Nearby API if LOCATIONIQ_API_KEY is configured.
 */
export async function fetchLocationIqNgos(lat: number, lon: number): Promise<NgoResult[]> {
  const apiKey = process.env.LOCATIONIQ_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return [];
  }

  try {
    const url = `https://us1.locationiq.com/v1/nearby?key=${encodeURIComponent(apiKey)}&lat=${lat}&lon=${lon}&tag=ngo,social_facility,charity,community_centre&radius=50000&format=json`;
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "SahayEmergencyPlatform/2.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`[LocationIQ] Nearby API returned status ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: any) => {
      const name = item.namedetails?.name || item.name || item.display_name?.split(",")?.[0] || "Community Relief NGO";
      const address = item.display_name || item.address?.state || "India";
      const rawPhone = item.extratags?.phone || item.extratags?.["contact:phone"] || item.extratags?.telephone || "";
      const phone = rawPhone && String(rawPhone).trim().length > 0 ? String(rawPhone).trim() : NO_PHONE_FALLBACK;

      return {
        name: String(name).trim(),
        address: String(address).trim(),
        phone,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        city: item.address?.city || item.address?.town || undefined,
        state: item.address?.state || undefined,
        scope: "regional",
      };
    });
  } catch (error) {
    console.warn("[LocationIQ] Error fetching nearby NGOs:", error);
    return [];
  }
}

/**
 * Merges LocationIQ live results with verified Pan-India NGO dataset and sorts by distance.
 */
export async function getNearbyNgos(
  userLat: number,
  userLon: number,
  options?: { scope?: "national" | "regional" | "all" }
): Promise<NgoResult[]> {
  const seedList = getSeedNgos();
  const liveList = await fetchLocationIqNgos(userLat, userLon);

  const combinedMap = new Map<string, NgoResult>();

  // Add live results
  for (const item of liveList) {
    if (!item.name) continue;
    const key = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    combinedMap.set(key, item);
  }

  // Merge seed results (ensuring verified metadata like national scope is retained)
  for (const seed of seedList) {
    const key = seed.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!combinedMap.has(key)) {
      combinedMap.set(key, seed);
    }
  }

  const scopeFilter = options?.scope;
  const filtered = Array.from(combinedMap.values()).filter(ngo => {
    if (!scopeFilter || scopeFilter === "all") return true;
    return (ngo.scope || "regional") === scopeFilter;
  });

  // Calculate distance and format response
  const results: NgoResult[] = filtered.map(ngo => {
    const distanceKm = haversineDistanceKm(userLat, userLon, ngo.latitude, ngo.longitude);
    const distance = `${distanceKm.toFixed(1)} km away`;
    return {
      name: ngo.name,
      address: ngo.address,
      phone: ngo.phone || NO_PHONE_FALLBACK,
      latitude: ngo.latitude,
      longitude: ngo.longitude,
      city: ngo.city,
      state: ngo.state,
      scope: ngo.scope || "regional",
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      distance,
    };
  });

  results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return results;
}

export const initialDonationTargets: Omit<DonationTarget, "createdAt">[] = [
  {
    id: 1,
    type: "government",
    name: "National Disaster Response Fund (NDMA / PMNRF India)",
    description: "Official National Disaster Relief & Emergency Assistance Fund supporting NDRF deployment, flood mitigation, and multi-state rehabilitation.",
    latitude: 28.5706,
    longitude: 77.2219,
    upiId: "pmnrf@centralbank",
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=pmnrf@centralbank%26pn=PMNRF%20India%20Relief%26cu=INR",
    contactInfo: "NDMA National Control Room: 1078 / 011-26701728 | controlroom@ndma.gov.in",
    verified: true,
  },
  {
    id: 2,
    type: "ngo",
    name: "Indian Red Cross Society (National HQ)",
    description: "Pan-India humanitarian network providing emergency medical kits, blood banks, water purification units, and family relief parcels.",
    latitude: 28.6219,
    longitude: 77.2099,
    upiId: "ircsnhq@sbi",
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=ircsnhq@sbi%26pn=Indian%20Red%20Cross%20Society%26cu=INR",
    contactInfo: "1 Red Cross Road, New Delhi 110001 | 011-23716441 | relief@indianredcross.org",
    verified: true,
  },
  {
    id: 3,
    type: "ngo",
    name: "Goonj — Rahat Flood & Disaster Relief",
    description: "Leading nationwide NGO deploying essential family survival kits, clothing packages, dignity kits, and dry rations across India.",
    latitude: 28.5326,
    longitude: 77.2721,
    upiId: "goonjrelief@hdfcbank",
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=goonjrelief@hdfcbank%26pn=Goonj%20Rahat%20Relief%26cu=INR",
    contactInfo: "Sarita Vihar, New Delhi 110076 | 011-41401216 | mail@goonj.org",
    verified: true,
  },
  {
    id: 4,
    type: "ngo",
    name: "SEEDS India (Disaster Resilience & Shelter Aid)",
    description: "Pan-India disaster resilience organization delivering emergency shelters, WASH sanitation kits, and community response.",
    latitude: 28.5473,
    longitude: 77.1945,
    upiId: "seedsindia@icici",
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=seedsindia@icici%26pn=SEEDS%20India%20Relief%26cu=INR",
    contactInfo: "RK Puram, New Delhi | +91 11 2617 4272 | info@seedsindia.org",
    verified: true,
  },
  {
    id: 5,
    type: "ngo",
    name: "Doctors For You — Emergency Medical Relief",
    description: "Pan-India medical relief NGO deploying trauma doctors, mobile clinics, oxygen concentrators, and essential medicines.",
    latitude: 19.0436,
    longitude: 72.9092,
    upiId: "doctorsforyou@sbi",
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=doctorsforyou@sbi%26pn=Doctors%20For%20You%26cu=INR",
    contactInfo: "Chembur, Mumbai 400071 | +91 22 2520 5550 | info@doctorsforyou.org",
    verified: true,
  },
  {
    id: 6,
    type: "ngo",
    name: "Khalsa Aid India — Disaster Kitchens & Rescue",
    description: "Humanitarian foundation operating rescue boats, 24/7 community kitchens, drinking water tankers, and relief supply centres across India.",
    latitude: 30.3398,
    longitude: 76.3869,
    upiId: "khalsaaidindia@axisbank",
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=khalsaaidindia@axisbank%26pn=Khalsa%20Aid%20India%26cu=INR",
    contactInfo: "Patiala Hub, Punjab 147001 | india@khalsaaid.org",
    verified: true,
  },
];

export const _memoryDonationTargets: DonationTarget[] = initialDonationTargets.map(t => ({
  ...t,
  createdAt: new Date(),
}));

export const _memoryDonations: Donation[] = [];
let nextDonationId = 1;

export async function getAllDonationTargets(typeFilter?: string): Promise<DonationTarget[]> {
  try {
    const db = await getDb();
    if (db) {
      const results = typeFilter && (typeFilter === "ngo" || typeFilter === "government")
        ? await db.select().from(donationTargets).where(eq(donationTargets.type, typeFilter as "ngo" | "government"))
        : await db.select().from(donationTargets);
      if (results && results.length > 0) {
        return results;
      }
    }
  } catch (error) {
    console.warn("[Donations] DB query failed, using in-memory store:", error);
  }

  if (typeFilter && (typeFilter === "ngo" || typeFilter === "government")) {
    return _memoryDonationTargets.filter(t => t.type === typeFilter);
  }
  return [..._memoryDonationTargets];
}

export async function getDonationTargetById(id: number): Promise<DonationTarget | null> {
  try {
    const db = await getDb();
    if (db) {
      const results = await db.select().from(donationTargets).where(eq(donationTargets.id, id));
      if (results && results.length > 0) {
        return results[0];
      }
    }
  } catch (error) {
    console.warn("[Donations] DB query target by ID failed, using in-memory store:", error);
  }

  return _memoryDonationTargets.find(t => t.id === id) || null;
}

export async function createDonation(data: {
  donorUserId?: number | null;
  targetId: number;
  donationType: "money" | "food" | "clothes";
  amount?: number | null;
  quantityDescription?: string | null;
  donationDate?: string | null;
  status?: string;
}): Promise<Donation> {
  const newDonation: Donation = {
    id: nextDonationId++,
    donorUserId: data.donorUserId ?? null,
    targetId: data.targetId,
    donationType: data.donationType,
    amount: data.amount ?? null,
    quantityDescription: data.quantityDescription ?? null,
    donationDate: data.donationDate ?? null,
    status: data.status || "completed",
    createdAt: new Date(),
  };

  try {
    const db = await getDb();
    if (db) {
      const inserted = await db.insert(donations).values({
        donorUserId: newDonation.donorUserId,
        targetId: newDonation.targetId,
        donationType: newDonation.donationType,
        amount: newDonation.amount,
        quantityDescription: newDonation.quantityDescription,
        donationDate: newDonation.donationDate,
        status: newDonation.status,
      });
      if (inserted && (inserted as any)[0]?.insertId) {
        newDonation.id = (inserted as any)[0].insertId;
      }
    }
  } catch (error) {
    console.warn("[Donations] DB insert failed, saved to in-memory store:", error);
  }

  _memoryDonations.push(newDonation);
  return newDonation;
}

export const donationRouter = Router();

// Primary Route: GET /donations/ngos/nearby?lat={lat}&lon={lon} & GET /ngos/nearby
const handleNearbyNgos = async (req: Request, res: Response) => {
  try {
    const latParam = req.query.lat ?? req.query.latitude;
    const lonParam = req.query.lon ?? req.query.lng ?? req.query.longitude;
    const scopeParam = typeof req.query.scope === "string" ? req.query.scope.toLowerCase() : undefined;

    const lat = latParam !== undefined ? parseFloat(String(latParam)) : INDIA_CENTER.lat;
    const lon = lonParam !== undefined ? parseFloat(String(lonParam)) : INDIA_CENTER.lng;

    const validLat = !isNaN(lat) ? lat : INDIA_CENTER.lat;
    const validLon = !isNaN(lon) ? lon : INDIA_CENTER.lng;
    const scope = scopeParam === "national" || scopeParam === "regional" || scopeParam === "all" ? scopeParam : "all";

    const nearbyNgos = await getNearbyNgos(validLat, validLon, { scope });
    res.json(nearbyNgos);
  } catch (error) {
    console.error("[Donations] Error resolving nearby NGOs:", error);
    res.status(500).json({ error: "Failed to fetch nearby NGOs" });
  }
};

donationRouter.get("/donations/ngos/nearby", handleNearbyNgos);
donationRouter.get("/ngos/nearby", handleNearbyNgos);

// GET /api/donation-targets?type=ngo|government&lat=&lng=
donationRouter.get("/donation-targets", async (req: Request, res: Response) => {
  try {
    const { type, lat, lng } = req.query;
    const typeStr = typeof type === "string" ? type.toLowerCase() : undefined;
    const targetList = await getAllDonationTargets(typeStr);

    const userLat = typeof lat === "string" ? parseFloat(lat) : typeof lat === "number" ? lat : null;
    const userLng = typeof lng === "string" ? parseFloat(lng) : typeof lng === "number" ? lng : null;

    const hasValidCoords = userLat !== null && !isNaN(userLat) && userLng !== null && !isNaN(userLng);

    const enriched = targetList.map(target => {
      let distanceKm: number | null = null;
      if (hasValidCoords) {
        distanceKm = haversineDistanceKm(userLat!, userLng!, target.latitude, target.longitude);
      }
      return {
        ...target,
        distanceKm: distanceKm !== null ? parseFloat(distanceKm.toFixed(2)) : null,
        distance: distanceKm !== null ? `${distanceKm.toFixed(1)} km away` : null,
      };
    });

    if (hasValidCoords) {
      enriched.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }

    res.json(enriched);
  } catch (error) {
    console.error("[Donations] Error fetching donation targets:", error);
    res.status(500).json({ error: "Failed to fetch donation targets" });
  }
});

// GET /api/donation-targets/:id
donationRouter.get("/donation-targets/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid target ID" });
      return;
    }

    const target = await getDonationTargetById(id);
    if (!target) {
      res.status(404).json({ error: "Donation target not found" });
      return;
    }

    res.json(target);
  } catch (error) {
    console.error("[Donations] Error fetching target profile:", error);
    res.status(500).json({ error: "Failed to fetch donation target profile" });
  }
});

// POST /api/donations
donationRouter.post("/donations", async (req: Request, res: Response) => {
  try {
    let donorUserId: number | null = null;
    try {
      const authUser = await sdk.authenticateRequest(req);
      if (authUser?.id) {
        donorUserId = authUser.id;
      }
    } catch {
      // Allow guest recording
    }

    const {
      target_id,
      targetId,
      donation_type,
      donationType,
      amount,
      quantity_description,
      quantityDescription,
      donation_date,
      donationDate,
      status,
      donor_user_id,
    } = req.body;

    const resolvedTargetId = parseInt(targetId || target_id, 10);
    const resolvedType = (donationType || donation_type || "money").toLowerCase();
    const resolvedQuantity = quantityDescription || quantity_description || null;
    const resolvedDate = donationDate || donation_date || new Date().toISOString().split("T")[0];
    const resolvedAmount = amount ? parseFloat(amount) : null;
    const resolvedDonorId = donorUserId || (donor_user_id ? parseInt(donor_user_id, 10) : null);

    if (isNaN(resolvedTargetId)) {
      res.status(400).json({ error: "Valid target_id is required" });
      return;
    }

    if (!["money", "food", "clothes"].includes(resolvedType)) {
      res.status(400).json({ error: "donation_type must be money, food, or clothes" });
      return;
    }

    const created = await createDonation({
      donorUserId: resolvedDonorId,
      targetId: resolvedTargetId,
      donationType: resolvedType as "money" | "food" | "clothes",
      amount: resolvedAmount,
      quantityDescription: resolvedQuantity,
      donationDate: resolvedDate,
      status: status || "completed",
    });

    res.status(201).json({
      success: true,
      donation: created,
    });
  } catch (error) {
    console.error("[Donations] Error recording donation:", error);
    res.status(500).json({ error: "Failed to record donation" });
  }
});

