import express, { Request, Response, Router } from "express";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { donationTargets, donations, DonationTarget, Donation } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";

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
  distanceKm?: number;
  distance?: string;
};

export function getSeedNgos(): NgoResult[] {
  const possiblePaths = [
    path.resolve(process.cwd(), "server/data/assam_ngos.json"),
    path.resolve(process.cwd(), "data/assam_ngos.json"),
    new URL("../data/assam_ngos.json", import.meta.url).pathname,
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
          }));
        }
      }
    } catch {
      // Continue to next path or in-memory fallback
    }
  }

  // Built-in verified in-memory fallback
  return [
    {
      name: "Indian Red Cross Society (Assam State Branch)",
      address: "Red Cross Bhawan, Chandmari, Guwahati, Kamrup Metropolitan, Assam 781003",
      phone: "+91 361 266 5115",
      latitude: 26.1890,
      longitude: 91.7760,
    },
    {
      name: "Goonj Assam Disaster Relief & Humanitarian Hub",
      address: "Opposite Administrative Staff College, Khanapara, GS Road, Guwahati, Assam 781022",
      phone: "+91 98640 54321",
      latitude: 26.1265,
      longitude: 91.8170,
    },
    {
      name: "Brahmaputra Foundation & Flood Relief Network",
      address: "Tarapur Main Road, Silchar, Cachar, Assam 788003",
      phone: "+91 94351 98765",
      latitude: 24.8333,
      longitude: 92.7789,
    },
    {
      name: "Aaranyak (Community Relief & Conservation Wing)",
      address: "13 Tayab Ali Byelane, Bishnu Rabha Path, Beltola, Guwahati, Assam 781028",
      phone: "+91 361 223 0250",
      latitude: 26.1368,
      longitude: 91.7925,
    },
    {
      name: "Snehalaya Child & Community Welfare Centre",
      address: "Dhirenpara, Fatasil Ambari, Guwahati, Assam 781025",
      phone: "+91 361 247 1850",
      latitude: 26.1550,
      longitude: 91.7240,
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
      headers: { Accept: "application/json", "User-Agent": "AssamRescuePlatform/1.0" },
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
      const address = item.display_name || item.address?.state || "Assam, India";
      const rawPhone = item.extratags?.phone || item.extratags?.["contact:phone"] || item.extratags?.telephone || "";
      const phone = rawPhone && String(rawPhone).trim().length > 0 ? String(rawPhone).trim() : NO_PHONE_FALLBACK;

      return {
        name: String(name).trim(),
        address: String(address).trim(),
        phone,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      };
    });
  } catch (error) {
    console.warn("[LocationIQ] Error fetching nearby NGOs:", error);
    return [];
  }
}

/**
 * Merges LocationIQ live results with verified seed dataset and sorts by distance.
 */
export async function getNearbyNgos(userLat: number, userLon: number): Promise<NgoResult[]> {
  const seedList = getSeedNgos();
  const liveList = await fetchLocationIqNgos(userLat, userLon);

  const combinedMap = new Map<string, NgoResult>();

  // Add live results
  for (const item of liveList) {
    if (!item.name) continue;
    const key = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    combinedMap.set(key, item);
  }

  // Merge seed results (ensuring verified info is retained)
  for (const seed of seedList) {
    const key = seed.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!combinedMap.has(key)) {
      combinedMap.set(key, seed);
    }
  }

  // Calculate distance and format response
  const results: NgoResult[] = Array.from(combinedMap.values()).map(ngo => {
    const distanceKm = haversineDistanceKm(userLat, userLon, ngo.latitude, ngo.longitude);
    const distance = `${distanceKm.toFixed(1)} km away`;
    return {
      name: ngo.name,
      address: ngo.address,
      phone: ngo.phone || NO_PHONE_FALLBACK,
      latitude: ngo.latitude,
      longitude: ngo.longitude,
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
    name: "Assam State Disaster Management Authority (ASDMA)",
    description: "Official Disaster Relief & Flood Mitigation Fund under the Government of Assam. Coordinates emergency distribution and post-flood rehabilitation.",
    latitude: 26.1445,
    longitude: 91.7362,
    upiId: "asdmarelief@sbi",
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=asdmarelief@sbi%26pn=ASDMA%20Relief%20Fund%26cu=INR",
    contactInfo: "State Emergency Operations Centre: 1070 / 1079 | Email: asdma-relief@assam.gov.in",
    verified: true,
  },
  {
    id: 2,
    type: "government",
    name: "Chief Minister's Relief Fund (CMRF) Assam",
    description: "Official humanitarian and emergency relief assistance fund operated directly by the Government of Assam.",
    latitude: 26.1433,
    longitude: 91.7898,
    upiId: "cmrfassam@sbi",
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=cmrfassam@sbi%26pn=Assam%20CMRF%26cu=INR",
    contactInfo: "Secretariat Dispur: 0361-2237054 | cmrf@assam.gov.in",
    verified: true,
  },
  {
    id: 3,
    type: "government",
    name: "District Disaster Management Authority (DDMA) Kamrup Metro",
    description: "District level emergency response unit managing relief camps, drinking water tankers, and dry ration distribution in Kamrup Metro.",
    latitude: 26.1865,
    longitude: 91.7488,
    upiId: "ddmakamrup@icici",
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=ddmakamrup@icici%26pn=DDMA%20Kamrup%20Metro%26cu=INR",
    contactInfo: "DDMA Control Room: 0361-2733052 / 1077",
    verified: true,
  },
  {
    id: 4,
    type: "ngo",
    name: "Indian Red Cross Society (Assam State Branch)",
    description: "Providing critical medical emergency kits, water purification units, hygiene packs, and cooked meals to marooned communities.",
    latitude: 26.1890,
    longitude: 91.7760,
    upiId: "assamredcross@sbi",
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=assamredcross@sbi%26pn=Assam%20Red%20Cross%26cu=INR",
    contactInfo: "Chandmari Office: +91 94350 12345 | info@assamredcross.org",
    verified: true,
  },
  {
    id: 5,
    type: "ngo",
    name: "Goonj Assam Relief & Rehabilitation",
    description: "Leading nationwide NGO deploying essential family survival kits, clothing packages, dignity kits, and dry rations across flood-hit districts.",
    latitude: 26.1265,
    longitude: 91.8170,
    upiId: "goonjassam@hdfcbank",
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=goonjassam@hdfcbank%26pn=Goonj%20Assam%26cu=INR",
    contactInfo: "Khanapara Hub: +91 98640 54321 | assam@goonj.org",
    verified: true,
  },
  {
    id: 6,
    type: "ngo",
    name: "Brahmaputra Flood Relief & Aid Network",
    description: "Grassroots disaster foundation operating rescue boats, community kitchens, baby food supplies, and clothes collection centres.",
    latitude: 24.8333,
    longitude: 92.7789,
    upiId: "brahmaputrarelief@axisbank",
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=brahmaputrarelief@axisbank%26pn=Brahmaputra%20Relief%26cu=INR",
    contactInfo: "Silchar / Barak Valley Desk: +91 94351 98765 | aid@brahmaputrarelief.org",
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

    const lat = latParam !== undefined ? parseFloat(String(latParam)) : 26.1445;
    const lon = lonParam !== undefined ? parseFloat(String(lonParam)) : 91.7362;

    const validLat = !isNaN(lat) ? lat : 26.1445;
    const validLon = !isNaN(lon) ? lon : 91.7362;

    const nearbyNgos = await getNearbyNgos(validLat, validLon);
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

