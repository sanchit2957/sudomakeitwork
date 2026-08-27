import "dotenv/config";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import {
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

export function getInitialSeedPassword(role: "admin" | "rescuer" | "medical" | "user", defaultDev: string): string {
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
  if (role === "medical") {
    return process.env.MEDICAL_INITIAL_PASSWORD || crypto.randomBytes(16).toString("hex");
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
      openId: "user-rescuer",
      name: "Inspector Barua",
      email: "rescuer@assamrescue.gov.in",
      rawPassword: getInitialSeedPassword("rescuer", "rescuer"),
      role: "rescuer" as const,
      loginMethod: "platform-login",
    },
    {
      openId: "user-medical",
      name: "Dr. Hazarika",
      email: "medical@assamrescue.gov.in",
      rawPassword: getInitialSeedPassword("medical", "medical"),
      role: "medical" as const,
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
  const rescuerId = userIdMap["rescuer@assamrescue.gov.in"];
  const medicalId = userIdMap["medical@assamrescue.gov.in"];

  // 2. Rescuer Profile (Idempotent)
  if (rescuerId) {
    const existingProfile = await db
      .select()
      .from(rescueProfiles)
      .where(eq(rescueProfiles.userId, rescuerId))
      .limit(1);

    if (!existingProfile.length) {
      await db.insert(rescueProfiles).values({
        userId: rescuerId,
        callSign: "NDRF Boat 4",
        phone: "+91 94350 11223",
        contactSharing: "yes",
        locationSharing: "yes",
        availability: "available",
        lastLatitude: 26.1845,
        lastLongitude: 91.7462,
        locationUpdatedAt: new Date(),
      });
      result.rescueProfilesSeeded++;
      console.log(`[Seed] Seeded rescuer profile for user #${rescuerId}`);
    }
  }

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

  // 4. Medical Staff Profile Assignment (Idempotent)
  if (medicalId && primaryHospitalId) {
    const existingStaff = await db
      .select()
      .from(hospitalStaffProfiles)
      .where(eq(hospitalStaffProfiles.userId, medicalId))
      .limit(1);

    if (!existingStaff.length) {
      await db.insert(hospitalStaffProfiles).values({
        userId: medicalId,
        hospitalId: primaryHospitalId,
        designation: "Emergency Medical Coordinator",
      });
      result.hospitalProfilesSeeded++;
      console.log(`[Seed] Linked medical staff #${medicalId} to hospital #${primaryHospitalId}`);
    }
  }

  // 5. Shelters (Idempotent)
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
