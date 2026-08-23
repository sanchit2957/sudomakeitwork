import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export function planRoleSync(role: InsertUser["role"] | undefined, isProjectOwner: boolean) {
  if (role !== undefined) return { insertRole: role, updateRole: role };
  if (isProjectOwner) return { insertRole: "admin" as const, updateRole: undefined };
  return { insertRole: undefined, updateRole: undefined };
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "password", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    const rolePlan = planRoleSync(user.role, user.openId === ENV.ownerOpenId);
    if (rolePlan.insertRole !== undefined) values.role = rolePlan.insertRole;
    if (rolePlan.updateRole !== undefined) updateSet.role = rolePlan.updateRole;

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function ensureRescuerProfile(userId: number, callSign = "NDRF Boat 4") {
  const db = await getDb();
  if (!db) return;
  const { rescueProfiles } = await import("../drizzle/schema");
  const existing = await db.select().from(rescueProfiles).where(eq(rescueProfiles.userId, userId)).limit(1);
  if (!existing.length) {
    await db.insert(rescueProfiles).values({
      userId,
      callSign,
      phone: "+91 94350 11223",
      contactSharing: "yes",
      locationSharing: "yes",
      availability: "available",
      lastLatitude: 26.1445,
      lastLongitude: 91.7362,
      locationUpdatedAt: new Date(),
    });
  }
}

export async function ensureHospitalStaffProfile(userId: number) {
  const db = await getDb();
  if (!db) return;
  const { hospitalStaffProfiles, hospitals } = await import("../drizzle/schema");
  const existing = await db.select().from(hospitalStaffProfiles).where(eq(hospitalStaffProfiles.userId, userId)).limit(1);
  if (!existing.length) {
    let hospitalList = await db.select().from(hospitals).limit(1);
    let hospitalId: number;
    if (!hospitalList.length) {
      const [newHospital] = await db.insert(hospitals).values({
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
        status: "open",
      });
      hospitalId = newHospital.insertId;
    } else {
      hospitalId = hospitalList[0].id;
    }

    await db.insert(hospitalStaffProfiles).values({
      userId,
      hospitalId,
      designation: "Emergency Medical Coordinator",
    });
  }
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
