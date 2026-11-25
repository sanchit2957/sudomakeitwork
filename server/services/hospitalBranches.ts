import { eq, inArray, or } from "drizzle-orm";
import { hospitalCaseNotifications, hospitals, hospitalStaffProfiles, incidents } from "../../drizzle/schema";
import { getDb, withDbTimeout } from "../db";
import { hasValidHospitalCapacity } from "../hospital.policy";
import { canEditHospitalResources } from "../hospital-registration.policy";
import { _memoryHospitalCaseNotifications, _memoryHospitals, _memoryHospitalStaffProfiles, nextHospitalId, writeAudit, type MemoryHospital } from "../rescue.db";
import { mapBranchStatusToDbStatus, normalizeHospitalBranch, type NormalizedHospitalBranch } from "./nearbyHospitals";

export type HospitalBranchInput = {
  organizationName: string;
  branchName: string;
  registrationId?: string | null;
  isPrimaryBranch?: boolean;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  latitude: number;
  longitude: number;
  specialties?: string[] | string;
  erTotal: number;
  erAvailable: number;
  icuTotal: number;
  icuAvailable: number;
  oxygenUnits?: number;
  bloodUnits?: number;
  ambulances?: number;
  supplies?: {
    food?: boolean;
    medicine?: boolean;
    water?: boolean;
    power?: boolean;
  };
  foodSupplyStatus?: "available" | "limited" | "critical" | "unavailable";
  medicineSupplyStatus?: "available" | "limited" | "critical" | "unavailable";
  waterSupplyStatus?: "available" | "limited" | "critical" | "unavailable";
  powerBackupStatus?: "available" | "limited" | "critical" | "unavailable";
  status?: "OPEN" | "LIMITED" | "FULL" | "CLOSED" | "open" | "limited" | "critical" | "closed";
};

function supplyBoolToEnum(
  explicitEnum: "available" | "limited" | "critical" | "unavailable" | undefined,
  boolVal: boolean | undefined,
  fallback: "available" | "limited" | "critical" | "unavailable" = "available"
): "available" | "limited" | "critical" | "unavailable" {
  if (explicitEnum) return explicitEnum;
  if (typeof boolVal === "boolean") return boolVal ? "available" : "unavailable";
  return fallback;
}

function normalizeSpecialtyString(specialties?: string[] | string): string {
  if (Array.isArray(specialties)) {
    const cleaned = specialties.map((s) => String(s).trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned.join(", ") : "Trauma & Emergency Care";
  }
  if (typeof specialties === "string" && specialties.trim()) {
    return specialties.trim();
  }
  return "Trauma & Emergency Care";
}

export function validateBranchCoordinatesAndPhone(input: Partial<HospitalBranchInput>) {
  if (input.latitude !== undefined) {
    if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
      throw new Error("Latitude must be a valid coordinate between -90 and 90.");
    }
  }
  if (input.longitude !== undefined) {
    if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
      throw new Error("Longitude must be a valid coordinate between -180 and 180.");
    }
  }
  if (input.phone !== undefined) {
    const digits = input.phone.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 15) {
      throw new Error("Please enter a valid emergency contact phone number.");
    }
  }
}

export async function getBranchesForOwner(userId: number): Promise<NormalizedHospitalBranch[]> {
  try {
    const db = await getDb();
    if (db) {
      const ownedRows = await withDbTimeout(
        db.select().from(hospitals).where(eq(hospitals.ownerUserId, userId)),
        4000,
        "getBranchesForOwner_owned"
      );
      const staffLinks = await withDbTimeout(
        db.select().from(hospitalStaffProfiles).where(eq(hospitalStaffProfiles.userId, userId)),
        4000,
        "getBranchesForOwner_staff"
      );
      const linkedIds = staffLinks.map((s) => s.hospitalId).filter((id) => !ownedRows.some((r) => r.id === id));
      let linkedRows: any[] = [];
      if (linkedIds.length > 0) {
        linkedRows = await withDbTimeout(
          db.select().from(hospitals).where(inArray(hospitals.id, linkedIds)),
          4000,
          "getBranchesForOwner_linked"
        );
      }
      const combined = [...ownedRows, ...linkedRows];
      if (combined.length > 0) {
        combined.sort((a, b) => Number(Boolean(b.isPrimaryBranch)) - Number(Boolean(a.isPrimaryBranch)) || a.id - b.id);
        return combined.map(normalizeHospitalBranch);
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
  }

  // Memory fallback (dev/test without DB)
  const owned = Array.from(_memoryHospitals.values()).filter((h) => h.ownerUserId === userId);
  const staff = _memoryHospitalStaffProfiles.get(userId);
  if (staff) {
    const linked = _memoryHospitals.get(staff.hospitalId);
    if (linked && !owned.some((h) => h.id === linked.id)) {
      owned.push(linked);
    }
  }
  owned.sort((a, b) => Number(Boolean(b.isPrimaryBranch)) - Number(Boolean(a.isPrimaryBranch)) || a.id - b.id);
  return owned.map(normalizeHospitalBranch);
}

export async function getHospitalBranchById(branchId: number): Promise<NormalizedHospitalBranch | null> {
  try {
    const db = await getDb();
    if (db) {
      const rows = await withDbTimeout(db.select().from(hospitals).where(eq(hospitals.id, branchId)).limit(1), 4000, "getHospitalBranchById");
      if (rows.length > 0) return normalizeHospitalBranch(rows[0]);
      return null;
    }
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
  }
  const mem = _memoryHospitals.get(branchId);
  return mem ? normalizeHospitalBranch(mem) : null;
}

export async function createHospitalBranch(userId: number, input: HospitalBranchInput): Promise<NormalizedHospitalBranch> {
  validateBranchCoordinatesAndPhone(input);

  const orgName = input.organizationName.trim();
  const branchName = input.branchName.trim();
  const address = input.address.trim();
  const city = input.city.trim();
  const state = input.state.trim();
  const pincode = input.pincode.trim();
  const phone = input.phone.trim();
  if (!orgName || !branchName || !address || !city || !state || !pincode || !phone) {
    throw new Error("Organization name, branch name, address, city, state, pincode, and phone are required.");
  }

  const erTotal = Math.max(0, Math.trunc(Number(input.erTotal ?? 0)));
  const erAvailable = Math.max(0, Math.trunc(Number(input.erAvailable ?? 0)));
  const icuTotal = Math.max(0, Math.trunc(Number(input.icuTotal ?? 0)));
  const icuAvailable = Math.max(0, Math.trunc(Number(input.icuAvailable ?? 0)));
  if (!hasValidHospitalCapacity(erTotal, erAvailable, icuTotal, icuAvailable)) {
    throw new Error("Available ER/ICU beds cannot exceed total capacity and must be >= 0.");
  }

  const oxygenUnits = Math.max(0, Math.trunc(Number(input.oxygenUnits ?? 0)));
  const bloodUnits = Math.max(0, Math.trunc(Number(input.bloodUnits ?? 0)));
  const ambulances = Math.max(0, Math.trunc(Number(input.ambulances ?? 0)));

  const existingOwned = await getBranchesForOwner(userId);
  const isPrimaryBranch = existingOwned.length === 0 ? true : Boolean(input.isPrimaryBranch);
  const displayName = branchName.toLowerCase() === orgName.toLowerCase() ? orgName : `${orgName} — ${branchName}`;
  const fullAddress = [address, city, state, pincode].filter(Boolean).join(", ");
  const specialty = normalizeSpecialtyString(input.specialties);
  const dbStatus = mapBranchStatusToDbStatus(input.status || "OPEN");

  const foodSupplyStatus = supplyBoolToEnum(input.foodSupplyStatus, input.supplies?.food, "available");
  const medicineSupplyStatus = supplyBoolToEnum(input.medicineSupplyStatus, input.supplies?.medicine, "available");
  const waterSupplyStatus = supplyBoolToEnum(input.waterSupplyStatus, input.supplies?.water, "available");
  const powerBackupStatus = supplyBoolToEnum(input.powerBackupStatus, input.supplies?.power, "available");

  const insertData = {
    ownerUserId: userId,
    organizationName: orgName,
    branchName,
    registrationId: input.registrationId?.trim() || null,
    isPrimaryBranch,
    name: displayName.slice(0, 180),
    address: fullAddress.slice(0, 360),
    city: city.slice(0, 120),
    state: state.slice(0, 120),
    pincode: pincode.slice(0, 16),
    contactPhone: phone.slice(0, 32),
    specialty: specialty.slice(0, 180),
    latitude: Number(input.latitude),
    longitude: Number(input.longitude),
    totalEmergencyBeds: erTotal,
    availableEmergencyBeds: erAvailable,
    totalIcuBeds: icuTotal,
    availableIcuBeds: icuAvailable,
    oxygenCylinderCount: oxygenUnits,
    bloodUnitCount: bloodUnits,
    ambulanceCount: ambulances,
    foodSupplyStatus,
    medicineSupplyStatus,
    waterSupplyStatus,
    powerBackupStatus,
    status: dbStatus,
    isSahayVerified: true,
    updatedBy: userId,
  };

  let createdId = nextHospitalId();
  let createdRow: any = null;

  try {
    const db = await getDb();
    if (db) {
      const [res] = await withDbTimeout(db.insert(hospitals).values(insertData), 5000, "createHospitalBranch_insert");
      createdId = Number(res.insertId);
      const rows = await withDbTimeout(db.select().from(hospitals).where(eq(hospitals.id, createdId)).limit(1), 4000, "createHospitalBranch_fetch");
      createdRow = rows[0] ?? null;
    }
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
  }

  const now = new Date();
  const memRecord: MemoryHospital = {
    id: createdId,
    ...insertData,
    createdAt: createdRow?.createdAt ? new Date(createdRow.createdAt) : now,
    updatedAt: createdRow?.updatedAt ? new Date(createdRow.updatedAt) : now,
  };
  _memoryHospitals.set(createdId, memRecord);

  await writeAudit(userId, "hospital.branch.create", "hospital", createdId, `Registered branch: ${displayName} (${city}, ${state})`);

  return normalizeHospitalBranch(createdRow || memRecord);
}

export async function authorizeHospitalBranchMutation(
  branchId: number,
  actorUser: { id: number; role: string }
): Promise<NormalizedHospitalBranch> {
  const existing = await getHospitalBranchById(branchId);
  if (!existing) {
    throw new Error("NOT_FOUND: Hospital branch not found.");
  }

  let assignedHospitalId: number | null = null;
  try {
    const db = await getDb();
    if (db) {
      const staff = (await withDbTimeout(
        db.select().from(hospitalStaffProfiles).where(eq(hospitalStaffProfiles.userId, actorUser.id)).limit(1),
        4000,
        "authBranch_staff"
      ))[0];
      if (staff) assignedHospitalId = staff.hospitalId;
    }
  } catch {}
  if (!assignedHospitalId) {
    const memStaff = _memoryHospitalStaffProfiles.get(actorUser.id);
    if (memStaff) assignedHospitalId = memStaff.hospitalId;
  }

  const allowed = canEditHospitalResources(
    actorUser.role as any,
    assignedHospitalId,
    branchId,
    existing.ownerUserId,
    actorUser.id
  );
  if (!allowed) {
    throw new Error("FORBIDDEN: You do not own this hospital branch.");
  }
  return existing;
}

export async function updateHospitalBranch(
  branchId: number,
  actorUser: { id: number; role: string },
  input: Partial<HospitalBranchInput>
): Promise<NormalizedHospitalBranch> {
  const existing = await authorizeHospitalBranchMutation(branchId, actorUser);
  validateBranchCoordinatesAndPhone(input);

  const orgName = input.organizationName !== undefined ? input.organizationName.trim() : existing.organizationName;
  const branchName = input.branchName !== undefined ? input.branchName.trim() : existing.branchName;
  const erAvailable = input.erAvailable !== undefined ? Math.max(0, Math.trunc(Number(input.erAvailable))) : existing.erAvailable;
  const icuAvailable = input.icuAvailable !== undefined ? Math.max(0, Math.trunc(Number(input.icuAvailable))) : existing.icuAvailable;
  const erTotal = input.erTotal !== undefined ? Math.max(0, Math.trunc(Number(input.erTotal))) : Math.max(existing.erTotal, erAvailable);
  const icuTotal = input.icuTotal !== undefined ? Math.max(0, Math.trunc(Number(input.icuTotal))) : Math.max(existing.icuTotal, icuAvailable);

  if (!hasValidHospitalCapacity(erTotal, erAvailable, icuTotal, icuAvailable)) {
    throw new Error("Available ER/ICU beds cannot exceed total capacity and must be >= 0.");
  }

  const city = input.city !== undefined ? input.city.trim() : existing.city;
  const state = input.state !== undefined ? input.state.trim() : existing.state;
  const pincode = input.pincode !== undefined ? input.pincode.trim() : existing.pincode;
  const address = input.address !== undefined ? input.address.trim() : existing.address;
  const phone = input.phone !== undefined ? input.phone.trim() : existing.phone;

  const displayName = branchName.toLowerCase() === orgName.toLowerCase() ? orgName : `${orgName} — ${branchName}`;
  const specialty = input.specialties !== undefined ? normalizeSpecialtyString(input.specialties) : existing.specialty;
  const dbStatus = input.status !== undefined ? mapBranchStatusToDbStatus(input.status) : existing.legacyStatus;

  const foodSupplyStatus = supplyBoolToEnum(input.foodSupplyStatus, input.supplies?.food, existing.foodSupplyStatus);
  const medicineSupplyStatus = supplyBoolToEnum(input.medicineSupplyStatus, input.supplies?.medicine, existing.medicineSupplyStatus);
  const waterSupplyStatus = supplyBoolToEnum(input.waterSupplyStatus, input.supplies?.water, existing.waterSupplyStatus);
  const powerBackupStatus = supplyBoolToEnum(input.powerBackupStatus, input.supplies?.power, existing.powerBackupStatus);

  const updateFields = {
    organizationName: orgName.slice(0, 180),
    branchName: branchName.slice(0, 180),
    registrationId: input.registrationId !== undefined ? (input.registrationId?.trim() || null) : existing.registrationId,
    isPrimaryBranch: input.isPrimaryBranch !== undefined ? Boolean(input.isPrimaryBranch) : existing.isPrimaryBranch,
    name: displayName.slice(0, 180),
    address: address.slice(0, 360),
    city: city.slice(0, 120),
    state: state.slice(0, 120),
    pincode: pincode.slice(0, 16),
    contactPhone: phone ? phone.slice(0, 32) : null,
    specialty: specialty.slice(0, 180),
    latitude: input.latitude !== undefined ? Number(input.latitude) : existing.latitude,
    longitude: input.longitude !== undefined ? Number(input.longitude) : existing.longitude,
    totalEmergencyBeds: erTotal,
    availableEmergencyBeds: erAvailable,
    totalIcuBeds: icuTotal,
    availableIcuBeds: icuAvailable,
    oxygenCylinderCount: input.oxygenUnits !== undefined ? Math.max(0, Math.trunc(Number(input.oxygenUnits))) : existing.oxygenUnits,
    bloodUnitCount: input.bloodUnits !== undefined ? Math.max(0, Math.trunc(Number(input.bloodUnits))) : existing.bloodUnits,
    ambulanceCount: input.ambulances !== undefined ? Math.max(0, Math.trunc(Number(input.ambulances))) : existing.ambulances,
    foodSupplyStatus,
    medicineSupplyStatus,
    waterSupplyStatus,
    powerBackupStatus,
    status: dbStatus as "open" | "limited" | "critical" | "closed",
    updatedBy: actorUser.id,
  };

  let updatedRow: any = null;
  try {
    const db = await getDb();
    if (db) {
      await withDbTimeout(db.update(hospitals).set(updateFields).where(eq(hospitals.id, branchId)), 5000, "updateHospitalBranch");
      const rows = await withDbTimeout(db.select().from(hospitals).where(eq(hospitals.id, branchId)).limit(1), 4000, "updateHospitalBranch_fetch");
      updatedRow = rows[0] ?? null;
    }
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
  }

  const mem = _memoryHospitals.get(branchId);
  if (mem) {
    Object.assign(mem, updateFields, { updatedAt: new Date() });
  }

  await writeAudit(actorUser.id, "hospital.branch.update", "hospital", branchId, `Updated branch ${displayName}`);

  return normalizeHospitalBranch(updatedRow || mem || { ...existing, ...updateFields, id: branchId, updatedAt: new Date() });
}

export async function deleteHospitalBranch(
  branchId: number,
  actorUser: { id: number; role: string }
): Promise<{ success: boolean; deletedId: number }> {
  const existing = await authorizeHospitalBranchMutation(branchId, actorUser);

  try {
    const db = await getDb();
    if (db) {
      // Detach foreign-key dependents cleanly before removing branch
      await withDbTimeout(db.delete(hospitalStaffProfiles).where(eq(hospitalStaffProfiles.hospitalId, branchId)), 4000, "deleteBranch_staff");
      await withDbTimeout(db.delete(hospitalCaseNotifications).where(eq(hospitalCaseNotifications.hospitalId, branchId)), 4000, "deleteBranch_cases");
      await withDbTimeout(db.update(incidents).set({ destinationHospitalId: null }).where(eq(incidents.destinationHospitalId, branchId)), 4000, "deleteBranch_incidents");
      await withDbTimeout(db.delete(hospitals).where(eq(hospitals.id, branchId)), 4000, "deleteBranch_hospital");

      if (existing.isPrimaryBranch && existing.ownerUserId) {
        const remaining = await withDbTimeout(db.select().from(hospitals).where(eq(hospitals.ownerUserId, existing.ownerUserId)), 4000, "deleteBranch_remaining");
        if (remaining.length > 0 && !remaining.some((r) => r.isPrimaryBranch)) {
          await withDbTimeout(db.update(hospitals).set({ isPrimaryBranch: true }).where(eq(hospitals.id, remaining[0].id)), 4000, "deleteBranch_promote");
        }
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
  }

  _memoryHospitals.delete(branchId);
  for (const [k, v] of Array.from(_memoryHospitalCaseNotifications.entries())) {
    if (v.hospitalId === branchId) _memoryHospitalCaseNotifications.delete(k);
  }
  for (const [uid, sp] of Array.from(_memoryHospitalStaffProfiles.entries())) {
    if (sp.hospitalId === branchId) _memoryHospitalStaffProfiles.delete(uid);
  }
  if (existing.isPrimaryBranch && existing.ownerUserId) {
    const remainingMem = Array.from(_memoryHospitals.values()).filter((h) => h.ownerUserId === existing.ownerUserId);
    if (remainingMem.length > 0) remainingMem[0].isPrimaryBranch = true;
  }

  await writeAudit(actorUser.id, "hospital.branch.delete", "hospital", branchId, `Deleted branch ${existing.name}`);

  return { success: true, deletedId: branchId };
}
