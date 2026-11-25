import "dotenv/config";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import {
  donationTargets,
  floodZones,
  hospitals,
  hospitalStaffProfiles,
  rescueProfiles,
  rescuerCapabilities,
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
      openId: "user-citizen-xavier",
      name: "Xavier",
      email: "xavi@yahoo.com",
      rawPassword: getInitialSeedPassword("user", "xavier123"),
      role: "user" as const,
      loginMethod: "platform-login",
    },
    {
      openId: "user-admin",
      name: "Superadmin",
      email: "admin@assamrescue.gov.in",
      rawPassword: getInitialSeedPassword("admin", "admin"),
      role: "admin" as const,
      loginMethod: "platform-login",
    },
    {
      openId: "user-rescuer-medical",
      name: "Dr. Rupam Hazarika",
      email: "rescuer.medical@assamrescue.gov.in",
      rawPassword: getInitialSeedPassword("rescuer", "Medic@2026Assam"),
      role: "rescuer" as const,
      loginMethod: "platform-login",
      callSign: "SDRF-MEDIC-01",
      category: "medical" as const,
      phone: "+91 94350 11221",
      lat: 26.1558,
      lng: 91.7645,
      capabilities: [
        { capability: "medical" as const, priority: 1 },
        { capability: "general_emergency" as const, priority: 2 },
      ],
    },
    {
      openId: "user-rescuer-boat",
      name: "Commander Bikram Kalita",
      email: "rescuer.boat@assamrescue.gov.in",
      rawPassword: getInitialSeedPassword("rescuer", "Boat@2026Assam"),
      role: "rescuer" as const,
      loginMethod: "platform-login",
      callSign: "NDRF-BOAT-01",
      category: "boat" as const,
      phone: "+91 94350 22332",
      lat: 26.1850,
      lng: 91.7450,
      capabilities: [
        { capability: "flood_rescue" as const, priority: 1 },
        { capability: "evacuation" as const, priority: 2 },
      ],
    },
    {
      openId: "user-rescuer-ground",
      name: "Inspector Debajit Bora",
      email: "rescuer.ground@assamrescue.gov.in",
      rawPassword: getInitialSeedPassword("rescuer", "Ground@2026Assam"),
      role: "rescuer" as const,
      loginMethod: "platform-login",
      callSign: "QRF-GROUND-01",
      category: "ground-team" as const,
      phone: "+91 94350 33443",
      lat: 26.1400,
      lng: 91.7900,
      capabilities: [
        { capability: "trapped_rescue" as const, priority: 1 },
        { capability: "evacuation" as const, priority: 2 },
      ],
    },
  ];

  const userIdMap: Record<string, number> = {};

  for (const item of demoUsers) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, item.email))
      .limit(1);

    let uid: number;
    if (existing.length > 0) {
      uid = existing[0].id;
      userIdMap[item.email] = uid;
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
      uid = insertRes.insertId;
      userIdMap[item.email] = uid;
      result.usersSeeded++;
      console.log(`[Seed] Seeded user: ${item.email} (Role: ${item.role})`);
    }

    if (item.role === "rescuer" && "callSign" in item) {
      const existingProf = await db
        .select()
        .from(rescueProfiles)
        .where(eq(rescueProfiles.userId, uid))
        .limit(1);

      if (!existingProf.length) {
        await db.insert(rescueProfiles).values({
          userId: uid,
          callSign: item.callSign,
          phone: item.phone,
          category: item.category,
          availability: "available",
          contactSharing: "yes",
          locationSharing: "yes",
          lastLatitude: item.lat,
          lastLongitude: item.lng,
          locationUpdatedAt: new Date(),
          updatedAt: new Date(),
        });
        result.rescueProfilesSeeded++;
        console.log(`[Seed] Seeded rescue profile for: ${item.name} (${item.callSign})`);
      }

      if ("capabilities" in item && Array.isArray(item.capabilities)) {
        for (const cap of item.capabilities) {
          const existingCap = await db
            .select()
            .from(rescuerCapabilities)
            .where(eq(rescuerCapabilities.rescuerId, uid))
            .limit(10);
          if (!existingCap.some(c => c.capability === cap.capability)) {
            await db.insert(rescuerCapabilities).values({
              rescuerId: uid,
              capability: cap.capability,
              priority: cap.priority,
              active: "yes",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      }
    }
  }

  const adminId = userIdMap["admin@assamrescue.gov.in"];

  // 3. Hospitals (Multi-tenant self-registration — no hardcoded legacy hospitals seeded)
  const primaryHospitalId: number | null = null;

  // 4. Shelters (Idempotent Pan-India emergency relief camps)
  const initialShelters = [
    {
      name: "Delhi Yamuna Bank Relief Camp",
      address: "Akshardham Mayur Vihar Relief Sector, New Delhi, Delhi 110091",
      latitude: 28.6127,
      longitude: 77.2773,
      capacity: 600,
      occupancy: 120,
      status: "open" as const,
      createdBy: adminId || null,
    },
    {
      name: "Mumbai Mithi River Civic Shelter",
      address: "BKC MMRDA Ground, Bandra East, Mumbai, Maharashtra 400051",
      latitude: 19.0652,
      longitude: 72.8681,
      capacity: 550,
      occupancy: 180,
      status: "open" as const,
      createdBy: adminId || null,
    },
    {
      name: "Chennai Adyar Coastal Relief Hub",
      address: "Anna University Civic Hall, Guindy, Chennai, Tamil Nadu 600025",
      latitude: 13.0108,
      longitude: 80.2354,
      capacity: 450,
      occupancy: 90,
      status: "open" as const,
      createdBy: adminId || null,
    },
    {
      name: "Guwahati North-East Relief Camp",
      address: "Khanapara Ground, GS Road, Guwahati, Assam 781022",
      latitude: 26.1264,
      longitude: 91.7992,
      capacity: 500,
      occupancy: 140,
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

  // 6. Flood Zones (Idempotent Pan-India weather hazard watch sectors)
  const initialFloodZones = [
    {
      name: "North-East Brahmaputra High Water Watch Sector",
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

  // 7. Donation Targets (Idempotent Pan-India official funds & NGOs)
  const initialTargets = [
    {
      type: "government" as const,
      name: "National Disaster Response Fund (NDMA / PMNRF India)",
      description: "Official National Disaster Relief & Emergency Assistance Fund supporting NDRF deployment, cyclone shelters, flood mitigation, and multi-state rehabilitation.",
      latitude: 28.5706,
      longitude: 77.2219,
      upiId: "pmnrf@centralbank",
      qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=pmnrf@centralbank%26pn=PMNRF%20India%20Relief%26cu=INR",
      contactInfo: "NDMA National Control Room: 1078 / 011-26701728 | controlroom@ndma.gov.in",
      verified: true,
    },
    {
      type: "ngo" as const,
      name: "Indian Red Cross Society (National HQ)",
      description: "Pan-India humanitarian network providing emergency medical kits, blood banks, water purification units, shelter tents, and family relief parcels.",
      latitude: 28.6219,
      longitude: 77.2099,
      upiId: "ircsnhq@sbi",
      qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=ircsnhq@sbi%26pn=Indian%20Red%20Cross%20Society%26cu=INR",
      contactInfo: "1 Red Cross Road, New Delhi 110001 | 011-23716441 | relief@indianredcross.org",
      verified: true,
    },
    {
      type: "ngo" as const,
      name: "Goonj — Rahat Flood & Disaster Relief",
      description: "Nationwide NGO mobilizing family survival kits, dry ration, hygiene & dignity essentials, tarpaulins, and grassroots rehabilitation across Indian states.",
      latitude: 28.5326,
      longitude: 77.2721,
      upiId: "goonjrelief@hdfcbank",
      qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=goonjrelief@hdfcbank%26pn=Goonj%20Rahat%20Relief%26cu=INR",
      contactInfo: "Sarita Vihar, New Delhi 110076 | 011-41401216 | mail@goonj.org",
      verified: true,
    },
    {
      type: "ngo" as const,
      name: "SEEDS India (Sustainable Environment & Ecological Development Society)",
      description: "National disaster resilience organization delivering emergency transitional shelters, WASH sanitation kits, and community early warning support across India.",
      latitude: 28.5473,
      longitude: 77.1945,
      upiId: "seedsindia@icici",
      qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=seedsindia@icici%26pn=SEEDS%20India%20Relief%26cu=INR",
      contactInfo: "RK Puram, New Delhi | +91 11 2617 4272 | info@seedsindia.org",
      verified: true,
    },
    {
      type: "ngo" as const,
      name: "Doctors For You — Emergency Medical Relief",
      description: "Pan-India medical NGO deploying trauma doctors, mobile clinics, oxygen concentrators, and essential medicines into disaster-hit zones.",
      latitude: 19.0436,
      longitude: 72.9092,
      upiId: "doctorsforyou@sbi",
      qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=doctorsforyou@sbi%26pn=Doctors%20For%20You%26cu=INR",
      contactInfo: "Chembur, Mumbai 400071 | +91 22 2520 5550 | info@doctorsforyou.org",
      verified: true,
    },
    {
      type: "ngo" as const,
      name: "Khalsa Aid India — Disaster Kitchens & Rescue",
      description: "Humanitarian relief network operating 24/7 langar kitchens, rescue boats, drinking water tankers, and medical aid across India.",
      latitude: 30.3398,
      longitude: 76.3869,
      upiId: "khalsaaidindia@axisbank",
      qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=khalsaaidindia@axisbank%26pn=Khalsa%20Aid%20India%26cu=INR",
      contactInfo: "Patiala Hub, Punjab 147001 | india@khalsaaid.org",
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
