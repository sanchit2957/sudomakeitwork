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
let _lastSuccessfulConnection: Date | null = null;
let _lastSuccessfulQuery: Date | null = null;
let _consecutiveFailures = 0;
let _lastDbError: string | null = null;
let _lastDbErrorCode: string | null = null;

export interface PoolLifecycleCounters {
  connectionsCreated: number;
  connectionsDestroyed: number;
  connectionErrors: number;
  poolResets: number;
  queriesExecuted: number;
  queriesFailed: number;
  staleRetries: number;
}

export const _poolCounters: PoolLifecycleCounters = {
  connectionsCreated: 0,
  connectionsDestroyed: 0,
  connectionErrors: 0,
  poolResets: 0,
  queriesExecuted: 0,
  queriesFailed: 0,
  staleRetries: 0,
};

export interface SafeDbErrorInfo {
  code: string;
  errno?: number;
  sqlState?: string;
  message: string;
}

export function extractSafeDbError(error: any): SafeDbErrorInfo {
  const target = error?.cause || error;
  const rawMsg = target?.message || error?.message || "Unknown database error";
  // Strict sanitization: Never expose DB credentials or connection strings
  const sanitizedMsg = String(rawMsg)
    .replace(/:\/\/([^:@]+):([^@]+)@/g, "://$1:***@")
    .replace(/password=[^;&\s]+/gi, "password=***");

  let code = "UNKNOWN_DB_ERROR";
  if (target?.code) {
    code = String(target.code);
  } else if (error?.code) {
    code = String(error.code);
  } else if (rawMsg.includes("timed out") || rawMsg.includes("DATABASE_TIMEOUT")) {
    code = "DATABASE_TIMEOUT";
  }

  return {
    code,
    errno: typeof target?.errno === "number" ? target.errno : (typeof error?.errno === "number" ? error.errno : undefined),
    sqlState: target?.sqlState || error?.sqlState || undefined,
    message: sanitizedMsg,
  };
}

export function isDbCircuitBroken(): boolean {
  return Date.now() < _dbCircuitBrokenUntil;
}

export function recordDbSuccess() {
  _dbCircuitBrokenUntil = 0;
  _consecutiveFailures = 0;
  _lastSuccessfulQuery = new Date();
  _lastSuccessfulConnection = new Date();
  _lastDbError = null;
  _lastDbErrorCode = null;
  _poolCounters.queriesExecuted++;
}

export function recordDbFailure(error?: any, operationName?: string) {
  _consecutiveFailures++;
  _poolCounters.connectionErrors++;
  _poolCounters.queriesFailed++;

  const safe = extractSafeDbError(error);
  _lastDbErrorCode = safe.code;
  _lastDbError = `${safe.code}${safe.errno !== undefined ? `:${safe.errno}` : ""}: ${safe.message}`;
  _dbCircuitBrokenUntil = Date.now() + 15000; // 15s circuit breaker

  const now = Date.now();
  if (now - _lastDbWarnTime > 5000) {
    _lastDbWarnTime = now;
    console.warn(`[Database] MySQL failure in "${operationName || 'query'}": code=${safe.code} errno=${safe.errno ?? 'N/A'} sqlState=${safe.sqlState ?? 'N/A'} message="${safe.message}" (consecutive failures: ${_consecutiveFailures})`);
  }

  // Graceful auto-healing: Do not reset pool on transient 1-2 stale socket drops.
  // Only reset when persistent 5+ failures occur, preventing connection storm cycles.
  if (_consecutiveFailures >= 5 && _pool) {
    _poolCounters.poolResets++;
    console.warn(`[Database] Auto-healing: Resetting corrupted pool after ${_consecutiveFailures} consecutive failures (last code: ${safe.code})`);
    _pool.end().catch(() => {});
    _pool = null;
    _db = null;
  }
}

export async function withDbTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 4000,
  operationName: string = "db_operation"
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err: any = new Error(`[DATABASE_TIMEOUT] ${operationName} timed out after ${timeoutMs}ms`);
      err.code = "ETIMEDOUT";
      reject(err);
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    recordDbSuccess();
    return result;
  } catch (err: any) {
    recordDbFailure(err, operationName);
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function planRoleSync(role: InsertUser["role"] | undefined, isProjectOwner: boolean) {
  if (role !== undefined) return { insertRole: role, updateRole: role };
  if (isProjectOwner) return { insertRole: "admin" as const, updateRole: undefined };
  return { insertRole: undefined, updateRole: undefined };
}

export function createDatabasePool(connectionUri: string): mysql.Pool {
  const isRemoteOrTiDB = connectionUri.includes("tidbcloud.com") || connectionUri.includes("ssl=") || !connectionUri.includes("localhost");
  const pool = mysql.createPool({
    uri: connectionUri,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 2,
    idleTimeout: 15000,
    connectTimeout: 5000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 5000,
    queueLimit: 20,
    ssl: isRemoteOrTiDB ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
  });

  _poolCounters.connectionsCreated++;
  return pool;
}

export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string; code?: string }> {
  const db = await getDb();
  if (!db || !_pool) {
    return { ok: false, latencyMs: 0, error: "Database pool not initialized or circuit broken", code: "NO_POOL" };
  }
  const start = performance.now();
  try {
    const conn = await withDbTimeout(_pool.getConnection(), 2500, "ping_getConnection");
    try {
      await withDbTimeout(conn.query("SELECT 1"), 2000, "ping_query");
      const latencyMs = Math.round((performance.now() - start) * 10) / 10;
      recordDbSuccess();
      return { ok: true, latencyMs };
    } finally {
      conn.release();
    }
  } catch (err: any) {
    recordDbFailure(err, "pingDatabase");
    const safe = extractSafeDbError(err);
    return {
      ok: false,
      latencyMs: Math.round((performance.now() - start) * 10) / 10,
      error: safe.message,
      code: safe.code,
    };
  }
}

export function getDatabasePoolMetrics() {
  if (!_pool) {
    return {
      status: "disconnected",
      totalConnections: 0,
      freeConnections: 0,
      queuedRequests: 0,
      consecutiveFailures: _consecutiveFailures,
      lastSuccessfulQuery: _lastSuccessfulQuery,
      lastSuccessfulConnection: _lastSuccessfulConnection,
      lastError: _lastDbError,
      lastErrorCode: _lastDbErrorCode,
      counters: { ..._poolCounters },
    };
  }
  const poolInternal = (_pool as any).pool;
  return {
    status: isDbCircuitBroken() ? "circuit_broken" : "connected",
    totalConnections: poolInternal?._allConnections?.length ?? 0,
    freeConnections: poolInternal?._freeConnections?.length ?? 0,
    queuedRequests: poolInternal?._connectionQueue?.length ?? 0,
    consecutiveFailures: _consecutiveFailures,
    lastSuccessfulQuery: _lastSuccessfulQuery,
    lastSuccessfulConnection: _lastSuccessfulConnection,
    lastError: _lastDbError,
    lastErrorCode: _lastDbErrorCode,
    counters: { ..._poolCounters },
  };
}

let _schemaEnsured = false;
export async function ensureDatabaseSchema(pool: mysql.Pool) {
  if (_schemaEnsured) return;
  _schemaEnsured = true;
  try {
    const conn = await withDbTimeout(pool.getConnection(), 3000, "ensureSchema_getConnection");
    try {
      // 1. Ensure columns exist on users
      const [cols]: any = await withDbTimeout(conn.query("SHOW COLUMNS FROM `users`"), 3000, "ensureSchema_showCols");
      const colNames = new Set((cols || []).map((c: any) => c.Field));

      if (!colNames.has("password")) {
        await withDbTimeout(conn.query("ALTER TABLE `users` ADD COLUMN `password` VARCHAR(255) NULL"), 3000, "ensureSchema_alterPassword");
      }
      if (!colNames.has("status")) {
        await withDbTimeout(conn.query("ALTER TABLE `users` ADD COLUMN `status` ENUM('active','disabled') NOT NULL DEFAULT 'active'"), 3000, "ensureSchema_alterStatus");
      }
      if (!colNames.has("loginMethod")) {
        await withDbTimeout(conn.query("ALTER TABLE `users` ADD COLUMN `loginMethod` VARCHAR(64) NULL"), 3000, "ensureSchema_alterLoginMethod");
      }

      // 2. Ensure roleAccessCodes table exists
      await withDbTimeout(
        conn.query(`
          CREATE TABLE IF NOT EXISTS \`roleAccessCodes\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`role\` VARCHAR(32) NOT NULL UNIQUE,
            \`codeHash\` VARCHAR(255) NOT NULL,
            \`codeVersion\` INT NOT NULL DEFAULT 1,
            \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            \`updatedBy\` INT NULL
          )
        `),
        3000,
        "ensureSchema_createRoleAccessCodes"
      );
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
      throw new Error("The operational database is disconnected. Cannot safely process request.");
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
      await withDbTimeout(
        db.insert(users).values(values).onDuplicateKeyUpdate({
          set: updateSet,
        }),
        4000,
        "upsertUser"
      );
    } catch (error: any) {
      console.warn(`[Database] User update warning: ${(error as Error)?.message || "DB error"}`);
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
      const result = await withDbTimeout(
        db.select().from(users).where(eq(users.openId, openId)).limit(1),
        4000,
        "getUserByOpenId"
      );
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
  const isEmail = clean.includes("@");

  const db = await getDb();
  if (db) {
    try {
      // Fast path: Exact indexed email lookup
      const whereClause = isEmail
        ? (normalizedRole ? and(eq(users.email, lower), eq(users.role, normalizedRole as any)) : eq(users.email, lower))
        : (normalizedRole ? and(or(eq(users.email, lower), eq(users.name, clean)), eq(users.role, normalizedRole as any)) : or(eq(users.email, lower), eq(users.name, clean)));

      const result = await withDbTimeout(
        db.select().from(users).where(whereClause).limit(1),
        4000,
        "getUserByEmail"
      );
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
      console.warn(`[Database] User query by email error: ${(error as Error)?.message || "DB error"}`);
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
      const result = await withDbTimeout(
        db.select().from(users).where(eq(users.id, id)).limit(1),
        4000,
        "getUserById"
      );
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
      const rows = await withDbTimeout(
        db.select().from(users).orderBy(users.id),
        4000,
        "getAllUsers"
      );
      return rows.map(r => ({
        ...r,
        role: r.role === "medical" ? "hospital" : r.role,
        status: r.status || "active",
      }));
    } catch (error) {
      console.warn(`[Database] All users query warning: ${(error as Error)?.message || "DB error"}`);
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
      const existing = await withDbTimeout(
        db.select().from(rescueProfiles).where(eq(rescueProfiles.userId, userId)).limit(1),
        4000,
        "ensureRescuerProfile_check"
      );
      if (!existing.length) {
        await withDbTimeout(
          db.insert(rescueProfiles).values({
            userId,
            callSign,
            phone: "+91 94350 11223",
            contactSharing: "yes",
            locationSharing: "yes",
            availability: "available",
            lastLatitude: 26.1445,
            lastLongitude: 91.7362,
            locationUpdatedAt: new Date(),
          }),
          4000,
          "ensureRescuerProfile_insert"
        );
      }
      return;
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database rescuer profile failed: ${(error as Error)?.message || "Unknown database error"}`);
      }
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
      const existing = await withDbTimeout(
        db.select().from(hospitalStaffProfiles).where(eq(hospitalStaffProfiles.userId, userId)).limit(1),
        4000,
        "ensureHospitalStaffProfile_check"
      );
      if (!existing.length) {
        let hospitalList = await withDbTimeout(
          db.select().from(hospitals).limit(1),
          4000,
          "ensureHospitalStaffProfile_listHosp"
        );
        let hospitalId: number;
        if (!hospitalList.length) {
          const [newHospital] = await withDbTimeout(
            db.insert(hospitals).values({
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
            }),
            4000,
            "ensureHospitalStaffProfile_insertHosp"
          );
          hospitalId = newHospital.insertId;
        } else {
          hospitalId = hospitalList[0].id;
        }

        await withDbTimeout(
          db.insert(hospitalStaffProfiles).values({
            userId,
            hospitalId,
            designation: "Emergency Medical Coordinator",
          }),
          4000,
          "ensureHospitalStaffProfile_insertStaff"
        );
      }
      return;
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database hospital staff profile failed: ${(error as Error)?.message || "Unknown database error"}`);
      }
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
      return await withDbTimeout(
        db
          .select()
          .from(emergencyContacts)
          .where(eq(emergencyContacts.userId, userId)),
        4000,
        "getEmergencyContactsByUserId"
      );
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Failed to load emergency contacts: ${(error as Error)?.message}`);
      }
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
        await withDbTimeout(
          db
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
            .where(and(eq(emergencyContacts.id, contact.id), eq(emergencyContacts.userId, contact.userId))),
          4000,
          "updateEmergencyContact"
        );
        const updated = await withDbTimeout(
          db
            .select()
            .from(emergencyContacts)
            .where(eq(emergencyContacts.id, contact.id))
            .limit(1),
          4000,
          "getUpdatedEmergencyContact"
        );
        if (updated.length > 0) return updated[0];
      } else {
        const [inserted] = await withDbTimeout(
          db.insert(emergencyContacts).values({
            userId: contact.userId,
            name: contact.name,
            relation: contact.relation,
            phone: contact.phone,
            alternatePhone: contact.alternatePhone || null,
            isPrimary: contact.isPrimary || "no",
            notes: contact.notes || null,
          }),
          4000,
          "insertEmergencyContact"
        );
        const created = await withDbTimeout(
          db
            .select()
            .from(emergencyContacts)
            .where(eq(emergencyContacts.id, inserted.insertId))
            .limit(1),
          4000,
          "getCreatedEmergencyContact"
        );
        if (created.length > 0) return created[0];
      }
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Failed to save emergency contact: ${(error as Error)?.message}`);
      }
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
      await withDbTimeout(
        db
          .delete(emergencyContacts)
          .where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.userId, userId))),
        4000,
        "deleteEmergencyContact"
      );
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Failed to delete emergency contact: ${(error as Error)?.message}`);
      }
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
      const rows = await withDbTimeout(
        db.select().from(roleAccessCodes).where(eq(roleAccessCodes.role, normalizedRole)).limit(1),
        4000,
        "getRoleAccessCode"
      );
      if (rows.length > 0) {
        return rows[0] as any;
      }
    } catch (error) {
      console.warn(`[Database] Role access code query warning: ${(error as Error)?.message}`);
    }
  }
  return _memoryRoleAccessCodes.get(normalizedRole) || null;
}

const _roleCodeVersionCache = new Map<string, { version: number; cachedAt: number }>();

export async function getRoleCodeVersion(role: string): Promise<number> {
  const normalizedRole = role === "medical" ? "hospital" : role;
  const now = Date.now();
  const cached = _roleCodeVersionCache.get(normalizedRole);
  if (cached && now - cached.cachedAt < 10000) {
    return cached.version;
  }
  const rec = await getRoleAccessCode(normalizedRole);
  const version = rec ? rec.codeVersion : 1;
  _roleCodeVersionCache.set(normalizedRole, { version, cachedAt: now });
  return version;
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
  _roleCodeVersionCache.delete(normalizedRole);
  const codeHash = hashPassword(cleanCode);
  const existing = await getRoleAccessCode(normalizedRole);
  const newVersion = (existing?.codeVersion || 0) + 1;
  const now = new Date();

  const db = await getDb();
  if (db) {
    try {
      await withDbTimeout(
        db
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
          }),
        4000,
        "setRoleAccessCode"
      );
    } catch (error) {
      console.warn(`[Database] Role access code update warning: ${(error as Error)?.message}`);
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

export interface QueryPhaseTiming {
  iteration: number;
  acquireMs: number;
  execMs: number;
  releaseMs: number;
  totalMs: number;
  success: boolean;
  errorCode?: string;
}

export interface MetricSummary {
  count: number;
  failures: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p95Ms: number;
  errorCodes: string[];
}

function calculateSummary(timings: number[], errorCodes: string[]): MetricSummary {
  if (timings.length === 0) {
    return { count: 0, failures: errorCodes.length, minMs: 0, maxMs: 0, avgMs: 0, p95Ms: 0, errorCodes };
  }
  const sorted = [...timings].sort((a, b) => a - b);
  const minMs = Math.round(sorted[0] * 10) / 10;
  const maxMs = Math.round(sorted[sorted.length - 1] * 10) / 10;
  const avgMs = Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 10) / 10;
  const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95Ms = Math.round(sorted[p95Idx] * 10) / 10;
  return {
    count: timings.length,
    failures: errorCodes.length,
    minMs,
    maxMs,
    avgMs,
    p95Ms,
    errorCodes: Array.from(new Set(errorCodes)),
  };
}

export async function runDatabaseForensicBenchmark(): Promise<{
  timestamp: string;
  databaseConfigured: boolean;
  poolMetrics: any;
  sequentialSelect1: { summary: MetricSummary; phaseAverages: { acquireMs: number; execMs: number; releaseMs: number }; timings: QueryPhaseTiming[] };
  concurrentSelect1: { summary: MetricSummary; timings: QueryPhaseTiming[] };
  userLookup: { summary: MetricSummary; timings: number[] };
  emergencyContactsLookup: { summary: MetricSummary; timings: number[] };
}> {
  const db = await getDb();
  if (!db || !_pool) {
    const emptySummary: MetricSummary = { count: 0, failures: 0, minMs: 0, maxMs: 0, avgMs: 0, p95Ms: 0, errorCodes: ["NO_DATABASE_POOL"] };
    return {
      timestamp: new Date().toISOString(),
      databaseConfigured: false,
      poolMetrics: getDatabasePoolMetrics(),
      sequentialSelect1: { summary: emptySummary, phaseAverages: { acquireMs: 0, execMs: 0, releaseMs: 0 }, timings: [] },
      concurrentSelect1: { summary: emptySummary, timings: [] },
      userLookup: { summary: emptySummary, timings: [] },
      emergencyContactsLookup: { summary: emptySummary, timings: [] },
    };
  }

  // 1. 10 Sequential SELECT 1 queries with phased breakdown
  const seqTimings: QueryPhaseTiming[] = [];
  const seqTotals: number[] = [];
  const seqErrors: string[] = [];

  for (let i = 1; i <= 10; i++) {
    const t0 = performance.now();
    let acquireMs = 0;
    let execMs = 0;
    let releaseMs = 0;
    let success = false;
    let errorCode: string | undefined;

    try {
      const conn = await withDbTimeout(_pool.getConnection(), 3000, `bench_seq_acquire_${i}`);
      const t1 = performance.now();
      acquireMs = Math.round((t1 - t0) * 10) / 10;

      try {
        await withDbTimeout(conn.query("SELECT 1"), 3000, `bench_seq_query_${i}`);
        const t2 = performance.now();
        execMs = Math.round((t2 - t1) * 10) / 10;
        success = true;
      } finally {
        const t3 = performance.now();
        conn.release();
        releaseMs = Math.round((performance.now() - t3) * 10) / 10;
      }
    } catch (err: any) {
      const safe = extractSafeDbError(err);
      errorCode = safe.code;
      seqErrors.push(safe.code);
    }

    const totalMs = Math.round((performance.now() - t0) * 10) / 10;
    if (success) seqTotals.push(totalMs);
    seqTimings.push({ iteration: i, acquireMs, execMs, releaseMs, totalMs, success, errorCode });
  }

  const validAcquire = seqTimings.filter(t => t.success).map(t => t.acquireMs);
  const validExec = seqTimings.filter(t => t.success).map(t => t.execMs);
  const validRelease = seqTimings.filter(t => t.success).map(t => t.releaseMs);

  const phaseAverages = {
    acquireMs: validAcquire.length ? Math.round((validAcquire.reduce((a, b) => a + b, 0) / validAcquire.length) * 10) / 10 : 0,
    execMs: validExec.length ? Math.round((validExec.reduce((a, b) => a + b, 0) / validExec.length) * 10) / 10 : 0,
    releaseMs: validRelease.length ? Math.round((validRelease.reduce((a, b) => a + b, 0) / validRelease.length) * 10) / 10 : 0,
  };

  // 2. 10 Concurrent SELECT 1 queries
  const conTotals: number[] = [];
  const conErrors: string[] = [];
  const conTimings = await Promise.all(
    Array.from({ length: 10 }, async (_, idx) => {
      const iter = idx + 1;
      const t0 = performance.now();
      let acquireMs = 0;
      let execMs = 0;
      let releaseMs = 0;
      let success = false;
      let errorCode: string | undefined;

      try {
        const conn = await withDbTimeout(_pool!.getConnection(), 3500, `bench_con_acquire_${iter}`);
        const t1 = performance.now();
        acquireMs = Math.round((t1 - t0) * 10) / 10;

        try {
          await withDbTimeout(conn.query("SELECT 1"), 3000, `bench_con_query_${iter}`);
          const t2 = performance.now();
          execMs = Math.round((t2 - t1) * 10) / 10;
          success = true;
        } finally {
          const t3 = performance.now();
          conn.release();
          releaseMs = Math.round((performance.now() - t3) * 10) / 10;
        }
      } catch (err: any) {
        const safe = extractSafeDbError(err);
        errorCode = safe.code;
        conErrors.push(safe.code);
      }

      const totalMs = Math.round((performance.now() - t0) * 10) / 10;
      if (success) conTotals.push(totalMs);
      return { iteration: iter, acquireMs, execMs, releaseMs, totalMs, success, errorCode };
    })
  );

  // 3. 10 Sequential User Lookups by Email
  const userTotals: number[] = [];
  const userErrors: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const t0 = performance.now();
    try {
      await getUserByEmail("citizen@assamrescue.gov.in");
      userTotals.push(Math.round((performance.now() - t0) * 10) / 10);
    } catch (err: any) {
      userErrors.push(extractSafeDbError(err).code);
    }
  }

  // 4. 10 Sequential Emergency Contacts Lookups
  const ecTotals: number[] = [];
  const ecErrors: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const t0 = performance.now();
    try {
      await getEmergencyContactsByUserId(4);
      ecTotals.push(Math.round((performance.now() - t0) * 10) / 10);
    } catch (err: any) {
      ecErrors.push(extractSafeDbError(err).code);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    databaseConfigured: true,
    poolMetrics: getDatabasePoolMetrics(),
    sequentialSelect1: {
      summary: calculateSummary(seqTotals, seqErrors),
      phaseAverages,
      timings: seqTimings,
    },
    concurrentSelect1: {
      summary: calculateSummary(conTotals, conErrors),
      timings: conTimings,
    },
    userLookup: {
      summary: calculateSummary(userTotals, userErrors),
      timings: userTotals,
    },
    emergencyContactsLookup: {
      summary: calculateSummary(ecTotals, ecErrors),
      timings: ecTotals,
    },
  };
}

