import mysql from "mysql2/promise";
import { and, eq, or } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { emergencyContacts, EmergencyContact, InsertEmergencyContact, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword } from "./auth.password";

let _pool: mysql.Pool | null = null;
let _db: MySql2Database<any> | null = null;
let _dbCircuitBrokenUntil = 0;
let _lastDbWarnTime = 0;

export function isDbCircuitBroken(): boolean {
  return Date.now() < _dbCircuitBrokenUntil;
}

export function recordDbFailure(error?: any) {
  _dbCircuitBrokenUntil = Date.now() + 30000; // Open circuit breaker for 30s
  _db = null;
  const now = Date.now();
  if (now - _lastDbWarnTime > 60000) {
    _lastDbWarnTime = now;
    const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "connection error";
    console.warn(`[Database] MySQL unavailable (${msg}), switching to fast in-memory store for 30s.`);
  }
}

export function planRoleSync(role: InsertUser["role"] | undefined, isProjectOwner: boolean) {
  if (role !== undefined) return { insertRole: role, updateRole: role };
  if (isProjectOwner) return { insertRole: "admin" as const, updateRole: undefined };
  return { insertRole: undefined, updateRole: undefined };
}

export function createDatabasePool(connectionUri: string): mysql.Pool {
  const isRemoteOrTiDB = connectionUri.includes("tidbcloud.com") || connectionUri.includes("ssl=") || !connectionUri.includes("localhost");
  return mysql.createPool({
    uri: connectionUri,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 4,
    idleTimeout: 30000,
    connectTimeout: 2500,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    queueLimit: 10,
  });
}

// Lazily create the drizzle instance so local tooling can run without a DB or with a local DB.
export async function getDb() {
  if (isDbCircuitBroken() && process.env.NODE_ENV !== "production") {
    return null;
  }

  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl || dbUrl === "" || dbUrl.includes("HOST")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("The operational database is disconnected. Cannot safely process request.");
    }
    return null;
  }

  if (!_db) {
    try {
      if (!_pool) {
        _pool = createDatabasePool(dbUrl);
      }
      _db = drizzle(_pool);
    } catch (error) {
      recordDbFailure(error);
      if (process.env.NODE_ENV === "production") {
        throw new Error("The operational database is disconnected. Cannot safely process request.");
      }
      _db = null;
    }
  }

  if (!_db && process.env.NODE_ENV === "production") {
    throw new Error("The operational database is disconnected. Cannot safely process request.");
  }

  return _db;
}

// Default development seed accounts with salted scrypt hashed passwords
const defaultAdminHash = hashPassword("admin");
const defaultRescuerHash = hashPassword("rescuer");
const defaultMedicalHash = hashPassword("medical");
const defaultCitizenHash = hashPassword("citizen");

export const _memoryUsers: Map<string, any> = new Map([
  [
    "user-admin",
    {
      id: 1,
      openId: "user-admin",
      name: "Superadmin",
      email: "admin@assamrescue.gov.in",
      password: defaultAdminHash,
      role: "admin",
      status: "active",
      loginMethod: "platform-login",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  ],
  [
    "admin@assamrescue.gov.in",
    {
      id: 1,
      openId: "user-admin",
      name: "Superadmin",
      email: "admin@assamrescue.gov.in",
      password: defaultAdminHash,
      role: "admin",
      status: "active",
      loginMethod: "platform-login",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  ],
  [
    "user-rescuer",
    {
      id: 2,
      openId: "user-rescuer",
      name: "Inspector Barua",
      email: "rescuer@assamrescue.gov.in",
      password: defaultRescuerHash,
      role: "rescuer",
      status: "active",
      loginMethod: "platform-login",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  ],
  [
    "rescuer@assamrescue.gov.in",
    {
      id: 2,
      openId: "user-rescuer",
      name: "Inspector Barua",
      email: "rescuer@assamrescue.gov.in",
      password: defaultRescuerHash,
      role: "rescuer",
      status: "active",
      loginMethod: "platform-login",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  ],
  [
    "user-medical",
    {
      id: 3,
      openId: "user-medical",
      name: "Dr. Hazarika",
      email: "medical@assamrescue.gov.in",
      password: defaultMedicalHash,
      role: "hospital",
      status: "active",
      loginMethod: "platform-login",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  ],
  [
    "medical@assamrescue.gov.in",
    {
      id: 3,
      openId: "user-medical",
      name: "Dr. Hazarika",
      email: "medical@assamrescue.gov.in",
      password: defaultMedicalHash,
      role: "hospital",
      status: "active",
      loginMethod: "platform-login",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  ],
  [
    "user-citizen",
    {
      id: 4,
      openId: "user-citizen",
      name: "Anamika Das",
      email: "citizen@assamrescue.gov.in",
      password: defaultCitizenHash,
      role: "user",
      status: "active",
      loginMethod: "platform-login",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  ],
  [
    "citizen@assamrescue.gov.in",
    {
      id: 4,
      openId: "user-citizen",
      name: "Anamika Das",
      email: "citizen@assamrescue.gov.in",
      password: defaultCitizenHash,
      role: "user",
      status: "active",
      loginMethod: "platform-login",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  ],
]);

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (db) {
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
    if (user.status !== undefined) {
      values.status = user.status;
      updateSet.status = user.status;
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

    try {
      await db.insert(users).values(values).onDuplicateKeyUpdate({
        set: updateSet,
      });
    } catch (error: any) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database user update failed: ${(error as Error)?.message || "Unknown database error"}`);
      }
      recordDbFailure(error);
    }
  }

  // Update memory cache in non-production environments
  const existingMem = _memoryUsers.get(user.openId) || {};
  const merged = {
    id: existingMem.id || (_memoryUsers.size + 1),
    ...existingMem,
    ...user,
    role: user.role || existingMem.role || "user",
    status: user.status || existingMem.status || "active",
    lastSignedIn: user.lastSignedIn || new Date(),
    updatedAt: new Date(),
    createdAt: existingMem.createdAt || new Date(),
  };
  _memoryUsers.set(user.openId, merged);
  if (user.email) {
    _memoryUsers.set(user.email.toLowerCase(), merged);
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      if (result.length > 0) {
        const row = result[0];
        const normalizedRole = row.role === "medical" ? "hospital" : row.role;
        const mem = _memoryUsers.get(openId) || {};
        return {
          ...mem,
          ...row,
          role: (mem.role && mem.role !== "user") ? mem.role : normalizedRole,
          status: mem.status ? mem.status : (row.status || "active"),
        };
      }
      return null;
    } catch (error: any) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database user query failed: ${(error as Error)?.message || "Unknown database error"}`);
      }
      recordDbFailure(error);
    }
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Authoritative database is unavailable.");
  }
  const memUser = _memoryUsers.get(openId) || null;
  if (memUser) {
    if (memUser.role === "medical") memUser.role = "hospital";
    if (!memUser.status) memUser.status = "active";
  }
  return memUser;
}

export async function getUserByEmail(emailOrUsername: string) {
  const db = await getDb();
  if (db) {
    try {
      const result = await db
        .select()
        .from(users)
        .where(or(eq(users.email, emailOrUsername), eq(users.name, emailOrUsername)))
        .limit(1);
      if (result.length > 0) {
        const row = result[0];
        const normalizedRole = row.role === "medical" ? "hospital" : row.role;
        const mem = _memoryUsers.get(row.openId) || _memoryUsers.get(row.email?.toLowerCase() || "") || {};
        return {
          ...mem,
          ...row,
          role: (mem.role && mem.role !== "user") ? mem.role : normalizedRole,
          status: mem.status ? mem.status : (row.status || "active"),
        };
      }
      return null;
    } catch (error: any) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database user query failed: ${(error as Error)?.message || "Unknown database error"}`);
      }
      recordDbFailure(error);
    }
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Authoritative database is unavailable.");
  }
  const lower = emailOrUsername.toLowerCase();
  const memUser =
    _memoryUsers.get(lower) ||
    Array.from(_memoryUsers.values()).find(
      u => u.email?.toLowerCase() === lower || u.name?.toLowerCase() === lower || u.openId === `user-${lower}`
    ) ||
    null;
  if (memUser) {
    if (memUser.role === "medical") memUser.role = "hospital";
    if (!memUser.status) memUser.status = "active";
  }
  return memUser;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (db) {
    try {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (result.length > 0) {
        const row = result[0];
        const normalizedRole = row.role === "medical" ? "hospital" : row.role;
        const mem = _memoryUsers.get(row.openId) || _memoryUsers.get(row.email?.toLowerCase() || "") || {};
        return {
          ...mem,
          ...row,
          role: (mem.role && mem.role !== "user") ? mem.role : normalizedRole,
          status: mem.status ? mem.status : (row.status || "active"),
        };
      }
      return null;
    } catch (error: any) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database user query failed: ${(error as Error)?.message || "Unknown database error"}`);
      }
      recordDbFailure(error);
    }
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Authoritative database is unavailable.");
  }
  const memUser = Array.from(_memoryUsers.values()).find(u => u.id === id) || null;
  if (memUser) {
    if (memUser.role === "medical") memUser.role = "hospital";
    if (!memUser.status) memUser.status = "active";
  }
  return memUser;
}

export async function getAllUsers() {
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(users).orderBy(users.id);
      return rows.map(r => ({
        ...r,
        role: r.role === "medical" ? "hospital" : r.role,
        status: r.status || "active",
      }));
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database user query failed: ${(error as Error)?.message || "Unknown database error"}`);
      }
      recordDbFailure(error);
    }
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Authoritative database is unavailable.");
  }
  const seen = new Set<number>();
  const uniqueUsers: any[] = [];
  for (const u of Array.from(_memoryUsers.values())) {
    if (!seen.has(u.id)) {
      seen.add(u.id);
      uniqueUsers.push({
        ...u,
        role: u.role === "medical" ? "hospital" : (u.role || "user"),
        status: u.status || "active",
      });
    }
  }
  return uniqueUsers;
}

export async function ensureRescuerProfile(userId: number, callSign = "NDRF Boat 4") {
  const db = await getDb();
  if (db) {
    try {
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
      return;
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database rescuer profile failed: ${(error as Error)?.message || "Unknown database error"}`);
      }
      recordDbFailure(error);
    }
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Authoritative database is unavailable.");
  }
  // Register into rescue memory in development/test
  try {
    const { registerMemoryRescuerProfile } = await import("./rescue.db");
    registerMemoryRescuerProfile({
      userId,
      callSign,
      phone: "+91 94350 11223",
      contactSharing: "yes",
      locationSharing: "yes",
      availability: "available",
      lastLatitude: 26.1445,
      lastLongitude: 91.7362,
    });
  } catch {}
}

export async function ensureHospitalStaffProfile(userId: number) {
  const db = await getDb();
  if (db) {
    try {
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
      return;
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database hospital staff profile failed: ${(error as Error)?.message || "Unknown database error"}`);
      }
      recordDbFailure(error);
    }
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Authoritative database is unavailable.");
  }
  try {
    const { registerMemoryHospitalStaffProfile } = await import("./rescue.db");
    registerMemoryHospitalStaffProfile({
      userId,
      hospitalId: 1,
      designation: "Emergency Medical Coordinator",
    });
  } catch {}
}

export const _memoryEmergencyContacts: Map<number, EmergencyContact> = new Map([
  [
    1,
    {
      id: 1,
      userId: 4, // citizen
      name: "Manashi Deka",
      relation: "Spouse",
      phone: "+91 94350 98765",
      alternatePhone: "+91 361 223344",
      isPrimary: "yes",
      notes: "Emergency contact for Guwahati residence.",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
]);

let _nextEmergencyContactId = 2;

export async function getEmergencyContactsByUserId(userId: number): Promise<EmergencyContact[]> {
  const db = await getDb();
  if (db) {
    try {
      return await db
        .select()
        .from(emergencyContacts)
        .where(eq(emergencyContacts.userId, userId));
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Failed to load emergency contacts: ${(error as Error)?.message}`);
      }
      recordDbFailure(error);
    }
  }
  return Array.from(_memoryEmergencyContacts.values()).filter(c => c.userId === userId);
}

export async function upsertEmergencyContact(
  contact: {
    id?: number;
    userId: number;
    name: string;
    relation: string;
    phone: string;
    alternatePhone?: string;
    isPrimary?: "yes" | "no";
    notes?: string;
  }
): Promise<EmergencyContact> {
  const db = await getDb();
  if (db) {
    try {
      if (contact.id) {
        await db
          .update(emergencyContacts)
          .set({
            name: contact.name,
            relation: contact.relation,
            phone: contact.phone,
            alternatePhone: contact.alternatePhone || null,
            isPrimary: contact.isPrimary || "no",
            notes: contact.notes || null,
            updatedAt: new Date(),
          })
          .where(and(eq(emergencyContacts.id, contact.id), eq(emergencyContacts.userId, contact.userId)));
        const updated = await db
          .select()
          .from(emergencyContacts)
          .where(eq(emergencyContacts.id, contact.id))
          .limit(1);
        if (updated.length > 0) return updated[0];
      } else {
        const [inserted] = await db.insert(emergencyContacts).values({
          userId: contact.userId,
          name: contact.name,
          relation: contact.relation,
          phone: contact.phone,
          alternatePhone: contact.alternatePhone || null,
          isPrimary: contact.isPrimary || "no",
          notes: contact.notes || null,
        });
        const created = await db
          .select()
          .from(emergencyContacts)
          .where(eq(emergencyContacts.id, inserted.insertId))
          .limit(1);
        if (created.length > 0) return created[0];
      }
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Failed to save emergency contact: ${(error as Error)?.message}`);
      }
      recordDbFailure(error);
    }
  }

  const id = contact.id || _nextEmergencyContactId++;
  const existing = _memoryEmergencyContacts.get(id);
  const record: EmergencyContact = {
    id,
    userId: contact.userId,
    name: contact.name,
    relation: contact.relation,
    phone: contact.phone,
    alternatePhone: contact.alternatePhone || null,
    isPrimary: contact.isPrimary || "no",
    notes: contact.notes || null,
    createdAt: existing?.createdAt || new Date(),
    updatedAt: new Date(),
  };
  _memoryEmergencyContacts.set(id, record);
  return record;
}

export async function deleteEmergencyContact(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (db) {
    try {
      await db
        .delete(emergencyContacts)
        .where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.userId, userId)));
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Failed to delete emergency contact: ${(error as Error)?.message}`);
      }
      recordDbFailure(error);
    }
  }
  const existing = _memoryEmergencyContacts.get(id);
  if (existing && existing.userId === userId) {
    _memoryEmergencyContacts.delete(id);
    return true;
  }
  return false;
}

