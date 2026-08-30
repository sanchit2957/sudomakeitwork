import "dotenv/config";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import {
  donationTargets,
  floodZones,
  hospitals,
  hospitalStaffProfiles,
  rescueProfiles,
  shelters,
  users,
} from "../drizzle/schema";
import { hashPassword } from "./auth.password";
import { getDb } from "./db";

export interface SeedResult {
  usersSeeded: number;
  usersExisting: number;
  rescueProfilesSeeded: number;
  hospitalProfilesSeeded: number;
  hospitalsSeeded: number;
  sheltersSeeded: number;
  floodZonesSeeded: number;
  alreadyInitialized: boolean;
}

export function getInitialSeedPassword(role: "admin" | "rescuer" | "hospital" | "medical" | "user", defaultDev: string): string {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    return defaultDev;
  }
  if (role === "admin") {
    return process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(16).toString("hex");
  }
  if (role === "rescuer") {
    return process.env.RESCUER_INITIAL_PASSWORD || crypto.randomBytes(16).toString("hex");
  }
  if (role === "hospital" || role === "medical") {
    return process.env.HOSPITAL_INITIAL_PASSWORD || process.env.MEDICAL_INITIAL_PASSWORD || crypto.randomBytes(16).toString("hex");
  }
  return process.env.CITIZEN_INITIAL_PASSWORD || crypto.randomBytes(16).toString("hex");
}

export async function seedDatabase(): Promise<SeedResult> {
  const db = await getDb();
  if (!db) {
    throw new Error("Cannot seed: Operational database is unavailable or DATABASE_URL is not set.");
  }

  const result: SeedResult = {
    usersSeeded: 0,
    usersExisting: 0,
    rescueProfilesSeeded: 0,
    hospitalProfilesSeeded: 0,
    hospitalsSeeded: 0,
    sheltersSeeded: 0,
    floodZonesSeeded: 0,
    alreadyInitialized: false,
  };

  console.log("[Seed] Starting idempotent database seed...");

  // 1. Defined standard seed users
  const demoUsers = [
    {
      openId: "user-admin",
      name: "Superadmin",
      email: "admin@assamrescue.gov.in",
      rawPassword: getInitialSeedPassword("admin", "admin"),
      role: "admin" as const,
      loginMethod: "platform-login",
    },
    {
      openId: "user-citizen",
      name: "Anamika Das",
      email: "citizen@assamrescue.gov.in",
      rawPassword: getInitialSeedPassword("user", "citizen"),
      role: "user" as const,
      loginMethod: "platform-login",
    },
  ];

  const userIdMap: Record<string, number> = {};

  for (const item of demoUsers) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, item.email))
      .limit(1);

    if (existing.length > 0) {
      userIdMap[item.email] = existing[0].id;
      result.usersExisting++;
      console.log(`[Seed] User already exists: ${item.email} (Role: ${existing[0].role})`);
    } else {
      const hashedPassword = hashPassword(item.rawPassword);
      const [insertRes] = await db.insert(users).values({
        openId: item.openId,
        name: item.name,
        email: item.email,
        password: hashedPassword,
        role: item.role,
        loginMethod: item.loginMethod,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });
      userIdMap[item.email] = insertRes.insertId;
      result.usersSeeded++;
      console.log(`[Seed] Seeded user: ${item.email} (Role: ${item.role})`);
    }
  }

  const adminId = userIdMap["admin@assamrescue.gov.in"];

  // 3. Hospitals (Idempotent)
  const initialHospitals = [
    {
      name: "Gauhati Medical College & Hospital (GMCH)",
      address: "Bhangagarh, Guwahati, Assam 781032",
      contactPhone: "+91 361 2529457",
      latitude: 26.1558,
      longitude: 91.7645,
      totalEmergencyBeds: 120,
      availableEmergencyBeds: 34,
      totalIcuBeds: 45,
      availableIcuBeds: 12,
      oxygenCylinderCount: 85,
      bloodUnitCount: 140,
      ambulanceCount: 14,
      foodSupplyStatus: "available" as const,
      medicineSupplyStatus: "available" as const,
      waterSupplyStatus: "available" as const,
      powerBackupStatus: "available" as const,
      status: "open" as const,
      updatedBy: adminId || null,
    },
    {
      name: "Assam Medical College & Hospital (AMCH)",
      address: "Barbari, Dibrugarh, Assam 786002",
      contactPhone: "+91 373 2300080",
      latitude: 27.4612,
      longitude: 94.9215,
      totalEmergencyBeds: 90,
      availableEmergencyBeds: 28,
      totalIcuBeds: 30,
      availableIcuBeds: 8,
      oxygenCylinderCount: 60,
      bloodUnitCount: 95,
      ambulanceCount: 10,
      foodSupplyStatus: "available" as const,
      medicineSupplyStatus: "available" as const,
      waterSupplyStatus: "available" as const,
      powerBackupStatus: "available" as const,
      status: "open" as const,
      updatedBy: adminId || null,
    },
  ];

  let primaryHospitalId: number | null = null;

  for (const h of initialHospitals) {
    const existing = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.name, h.name))
      .limit(1);

    if (existing.length > 0) {
      if (h.name.includes("GMCH")) primaryHospitalId = existing[0].id;
    } else {
      const [insertRes] = await db.insert(hospitals).values(h);
      result.hospitalsSeeded++;
      if (h.name.includes("GMCH")) primaryHospitalId = insertRes.insertId;
      console.log(`[Seed] Seeded hospital: ${h.name}`);
    }
  }

  // 4. Shelters (Idempotent)
  const initialShelters = [
    {
      name: "Guwahati Central Relief Camp",
      address: "Khanapara Ground, GS Road, Guwahati, Assam 781022",
      latitude: 26.1264,
      longitude: 91.7992,
      capacity: 500,
      occupancy: 140,
      status: "open" as const,
      createdBy: adminId || null,
    },
    {
      name: "Silchar Flood Evacuation Shelter",
      address: "DSA Ground, Club Road, Silchar, Assam 788001",
      latitude: 24.8333,
      longitude: 92.7789,
      capacity: 350,
      occupancy: 95,
      status: "open" as const,
      createdBy: adminId || null,
    },
    {
      name: "Dibrugarh Community Disaster Camp",
      address: "Chowkidinghee Field, Dibrugarh, Assam 786001",
      latitude: 27.4728,
      longitude: 94.912,
      capacity: 400,
      occupancy: 210,
      status: "open" as const,
      createdBy: adminId || null,
    },
  ];

  for (const s of initialShelters) {
    const existing = await db
      .select()
      .from(shelters)
      .where(eq(shelters.name, s.name))
      .limit(1);

    if (!existing.length) {
      await db.insert(shelters).values(s);
      result.sheltersSeeded++;
      console.log(`[Seed] Seeded shelter: ${s.name}`);
    }
  }

  // 6. Flood Zones (Idempotent)
  const initialFloodZones = [
    {
      name: "Brahmaputra Basin - Guwahati High Risk Sector",
      severity: "critical" as const,
      polygonJson: JSON.stringify([
        { lat: 26.185, lng: 91.72 },
        { lat: 26.2, lng: 91.75 },
        { lat: 26.175, lng: 91.8 },
        { lat: 26.155, lng: 91.76 },
      ]),
      active: "yes" as const,
      createdBy: adminId || null,
    },
  ];

  for (const z of initialFloodZones) {
    const existing = await db
      .select()
      .from(floodZones)
      .where(eq(floodZones.name, z.name))
      .limit(1);

    if (!existing.length) {
      await db.insert(floodZones).values(z);
      result.floodZonesSeeded++;
      console.log(`[Seed] Seeded flood zone: ${z.name}`);
    }
  }

  // 7. Donation Targets (Idempotent)
  const initialTargets = [
    {
      type: "government" as const,
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
      type: "government" as const,
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
      type: "government" as const,
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
      type: "ngo" as const,
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
      type: "ngo" as const,
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
      type: "ngo" as const,
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

  for (const t of initialTargets) {
    const existing = await db
      .select()
      .from(donationTargets)
      .where(eq(donationTargets.name, t.name))
      .limit(1);

    if (!existing.length) {
      await db.insert(donationTargets).values(t);
      console.log(`[Seed] Seeded donation target: ${t.name}`);
    }
  }

  result.alreadyInitialized = result.usersSeeded === 0 && result.hospitalsSeeded === 0;
  console.log(
    `[Seed] Completed. Users created: ${result.usersSeeded}, existing: ${result.usersExisting}, hospitals: ${result.hospitalsSeeded}, shelters: ${result.sheltersSeeded}`
  );
  return result;
}

// Direct execution entrypoint
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("seed.ts")) {
  seedDatabase()
    .then(res => {
      console.log("[Seed] Database seed completed successfully.");
      process.exit(0);
    })
    .catch(err => {
      console.error("[Seed] Error during seeding:", err.message);
      process.exit(1);
    });
}
