import mysql from "mysql2/promise";
import { and, eq, or } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { emergencyContacts, EmergencyContact, InsertEmergencyContact, InsertUser, users, roleAccessCodes, RoleAccessCode } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword, verifyPassword } from "./auth.password";

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

let _schemaEnsured = false;
export async function ensureDatabaseSchema(pool: mysql.Pool) {
  if (_schemaEnsured) return;
  _schemaEnsured = true;
  try {
    const conn = await pool.getConnection();
    try {
      // 1. Ensure columns exist on users
      const [cols]: any = await conn.query("SHOW COLUMNS FROM `users`");
      const colNames = new Set((cols || []).map((c: any) => c.Field));

      if (!colNames.has("password")) {
        await conn.query("ALTER TABLE `users` ADD COLUMN `password` VARCHAR(255) NULL");
      }
      if (!colNames.has("status")) {
        await conn.query("ALTER TABLE `users` ADD COLUMN `status` ENUM('active','disabled') NOT NULL DEFAULT 'active'");
      }
      if (!colNames.has("loginMethod")) {
        await conn.query("ALTER TABLE `users` ADD COLUMN `loginMethod` VARCHAR(64) NULL");
      }

      // 2. Ensure roleAccessCodes table exists
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`roleAccessCodes\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`role\` VARCHAR(32) NOT NULL UNIQUE,
          \`codeHash\` VARCHAR(255) NOT NULL,
          \`codeVersion\` INT NOT NULL DEFAULT 1,
          \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          \`updatedBy\` INT NULL
        )
      `);
    } finally {
      conn.release();
    }
  } catch (err) {
    console.warn("[Database] Schema sync check note:", (err as Error)?.message || err);
  }
}

// Lazily create the drizzle instance so local tooling can run without a DB or with a local DB.
export async function getDb() {
  if (isDbCircuitBroken() && process.env.NODE_ENV !== "production") {
    return null;
  }

  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl || dbUrl === "" || dbUrl.includes("HOST")) {
    if (process.env.NODE_ENV === "production") {
      return null;
    }
    return null;
  }

  if (!_db) {
    try {
      if (!_pool) {
        _pool = createDatabasePool(dbUrl);
        ensureDatabaseSchema(_pool).catch(() => {});
      }
      _db = drizzle(_pool);
    } catch (error) {
      recordDbFailure(error);
      _db = null;
    }
  }

  return _db;
}

// Default development seed accounts with salted scrypt hashed passwords
const defaultAdminHash = hashPassword("admin");
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
      console.warn(`[Database] User update warning: ${(error as Error)?.message || "DB error"}`);
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
      console.warn(`[Database] User query by openId warning: ${(error as Error)?.message || "DB error"}`);
      recordDbFailure(error);
    }
  }
  const memUser = _memoryUsers.get(openId) || null;
  if (memUser) {
    if (memUser.role === "medical") memUser.role = "hospital";
    if (!memUser.status) memUser.status = "active";
  }
  return memUser;
}

export async function getUserByEmail(emailOrUsername: string, role?: string) {
  const clean = emailOrUsername.trim();
  const lower = clean.toLowerCase();
  const normalizedRole = role ? (role === "medical" ? "hospital" : role) : undefined;
  const db = await getDb();
  if (db) {
    try {
      const emailCondition = or(eq(users.email, clean), eq(users.email, lower), eq(users.name, clean));
      const whereClause = normalizedRole
        ? and(emailCondition, eq(users.role, normalizedRole as any))
        : emailCondition;

      const result = await db
        .select()
        .from(users)
        .where(whereClause)
        .limit(1);
      if (result.length > 0) {
        const row = result[0];
        const resRole = row.role === "medical" ? "hospital" : row.role;
        const mem = _memoryUsers.get(row.openId) || {};
        return {
          ...mem,
          ...row,
          role: (mem.role && mem.role !== "user") ? mem.role : resRole,
          status: mem.status ? mem.status : (row.status || "active"),
        };
      }
      return null;
    } catch (error: any) {
      console.warn(`[Database] User query by email warning: ${(error as Error)?.message || "DB error"}`);
      recordDbFailure(error);
    }
  }
  const allUsers = Array.from(_memoryUsers.values());
  const memUser =
    allUsers.find(u => {
      const matchesEmail =
        u.email?.toLowerCase() === lower ||
        u.name?.toLowerCase() === clean.toLowerCase() ||
        u.openId === `user-${lower}` ||
        u.openId === lower;
      if (!matchesEmail) return false;
      if (normalizedRole) {
        const userRole = u.role === "medical" ? "hospital" : u.role;
        return userRole === normalizedRole;
      }
      return true;
    }) || null;

  if (memUser) {
    if (memUser.role === "medical") memUser.role = "hospital";
    if (!memUser.status) memUser.status = "active";
  }
  return memUser;
}

export async function getUserByEmailAndRole(emailOrUsername: string, role: string) {
  return getUserByEmail(emailOrUsername, role);
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
      console.warn(`[Database] User query by id warning: ${(error as Error)?.message || "DB error"}`);
      recordDbFailure(error);
    }
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
      console.warn(`[Database] All users query warning: ${(error as Error)?.message || "DB error"}`);
      recordDbFailure(error);
    }
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

export const _memoryRoleAccessCodes: Map<string, { id: number; role: string; codeHash: string; codeVersion: number; updatedAt: Date; updatedBy: number | null }> = new Map([
  [
    "rescuer",
    {
      id: 1,
      role: "rescuer",
      codeHash: hashPassword("RESCUER-2026"),
      codeVersion: 1,
      updatedAt: new Date(),
      updatedBy: null,
    },
  ],
  [
    "hospital",
    {
      id: 2,
      role: "hospital",
      codeHash: hashPassword("HOSPITAL-2026"),
      codeVersion: 1,
      updatedAt: new Date(),
      updatedBy: null,
    },
  ],
]);

export async function getRoleAccessCode(role: string): Promise<{ id: number; role: string; codeHash: string; codeVersion: number; updatedAt: Date; updatedBy: number | null } | null> {
  const normalizedRole = role === "medical" ? "hospital" : role;
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(roleAccessCodes).where(eq(roleAccessCodes.role, normalizedRole)).limit(1);
      if (rows.length > 0) {
        return rows[0] as any;
      }
    } catch (error) {
      console.warn(`[Database] Role access code query warning: ${(error as Error)?.message}`);
      recordDbFailure(error);
    }
  }
  return _memoryRoleAccessCodes.get(normalizedRole) || null;
}

export async function getRoleCodeVersion(role: string): Promise<number> {
  const rec = await getRoleAccessCode(role);
  return rec ? rec.codeVersion : 1;
}

export async function verifyRoleAccessCode(role: string, inputCode: string): Promise<boolean> {
  if (!inputCode || typeof inputCode !== "string") return false;
  const cleanCode = inputCode.trim();
  if (!cleanCode) return false;
  const record = await getRoleAccessCode(role);
  if (!record || !record.codeHash) return false;
  return verifyPassword(cleanCode, record.codeHash);
}

export async function setRoleAccessCode(
  role: "rescuer" | "hospital" | "medical",
  rawCode: string,
  adminUserId?: number
): Promise<{ role: string; codeVersion: number; updatedAt: Date }> {
  const normalizedRole = role === "medical" ? "hospital" : role;
  const cleanCode = rawCode.trim();
  if (!cleanCode) {
    throw new Error("Access code cannot be empty.");
  }
  const codeHash = hashPassword(cleanCode);
  const existing = await getRoleAccessCode(normalizedRole);
  const newVersion = (existing?.codeVersion || 0) + 1;
  const now = new Date();

  const db = await getDb();
  if (db) {
    try {
      await db
        .insert(roleAccessCodes)
        .values({
          role: normalizedRole,
          codeHash,
          codeVersion: newVersion,
          updatedAt: now,
          updatedBy: adminUserId || null,
        })
        .onDuplicateKeyUpdate({
          set: {
            codeHash,
            codeVersion: newVersion,
            updatedAt: now,
            updatedBy: adminUserId || null,
          },
        });
    } catch (error) {
      console.warn(`[Database] Role access code update warning: ${(error as Error)?.message}`);
      recordDbFailure(error);
    }
  }

  const memRec = {
    id: existing?.id || (_memoryRoleAccessCodes.size + 1),
    role: normalizedRole,
    codeHash,
    codeVersion: newVersion,
    updatedAt: now,
    updatedBy: adminUserId || null,
  };
  _memoryRoleAccessCodes.set(normalizedRole, memRec);

  return {
    role: normalizedRole,
    codeVersion: newVersion,
    updatedAt: now,
  };
}

export async function getAllRoleAccessCodes(): Promise<Array<{ role: string; codeVersion: number; updatedAt: Date; updatedBy: number | null }>> {
  const roles = ["rescuer", "hospital"] as const;
  const results: Array<{ role: string; codeVersion: number; updatedAt: Date; updatedBy: number | null }> = [];
  for (const r of roles) {
    const rec = await getRoleAccessCode(r);
    if (rec) {
      results.push({
        role: rec.role,
        codeVersion: rec.codeVersion,
        updatedAt: rec.updatedAt,
        updatedBy: rec.updatedBy,
      });
    } else {
      results.push({
        role: r,
        codeVersion: 1,
        updatedAt: new Date(),
        updatedBy: null,
      });
    }
  }
  return results;
}

