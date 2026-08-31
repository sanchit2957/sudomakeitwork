import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  auditLogs,
  floodZones,
  hospitals,
  incidentMessages,
  incidentEvents,
  incidents,
  missions,
  notifications,
  rescueProfiles,
  rescuerRegistrationRequests,
  shelters,
  users,
} from "../drizzle/schema";
import { getDb, withDbTimeout, _memoryUsers } from "./db";
export { _memoryUsers };

export interface MemoryShelter {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity: number;
  occupancy: number;
  status: "open" | "limited" | "closed";
  createdBy: number | null;
  updatedAt: Date;
}

export interface MemoryHospital {
  id: number;
  name: string;
  address: string;
  contactPhone: string | null;
  latitude: number;
  longitude: number;
  totalEmergencyBeds: number;
  availableEmergencyBeds: number;
  totalIcuBeds: number;
  availableIcuBeds: number;
  oxygenCylinderCount: number;
  bloodUnitCount: number;
  ambulanceCount: number;
  foodSupplyStatus: "available" | "limited" | "critical" | "unavailable";
  medicineSupplyStatus: "available" | "limited" | "critical" | "unavailable";
  waterSupplyStatus: "available" | "limited" | "critical" | "unavailable";
  powerBackupStatus: "available" | "limited" | "critical" | "unavailable";
  status: "open" | "limited" | "critical" | "closed";
  updatedBy: number | null;
  updatedAt: Date;
}

export interface MemoryFloodZone {
  id: number;
  name: string;
  severity: "critical" | "high" | "medium" | "low";
  polygonJson: string;
  active: "yes" | "no";
  createdBy: number | null;
  updatedAt: Date;
}

export interface MemoryIncident {
  id: number;
  publicCode: string;
  reporterId: number | null;
  contactName: string | null;
  locationLabel: string;
  latitude: number;
  longitude: number;
  emergencyType: "flood" | "medical" | "trapped" | "evacuation" | "other";
  helpNeeds: string | null;
  severity: "critical" | "high" | "medium" | "low";
  peopleAffected: number;
  notes: string | null;
  evidenceKey: string | null;
  evidenceUrl: string | null;
  voiceNoteKey: string | null;
  voiceNoteUrl: string | null;
  voiceNoteDurationSeconds: number | null;
  status: "pending" | "dispatched" | "resolved";
  assignedRescuerId: number | null;
  dispatchedAt: Date | null;
  resolvedAt: Date | null;
  escalationLevel?: number;
  lastEscalatedAt?: Date | null;
  automationStatus?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryMission {
  id: number;
  incidentId: number;
  rescuerId: number;
  status: "pending" | "dispatched" | "resolved";
  assignedBy: number;
  assignedAt: Date;
  dispatchedAt: Date | null;
  resolvedAt: Date | null;
  notes: string | null;
  updatedAt: Date;
}

export interface MemoryIncidentEvent {
  id: number;
  incidentId: number;
  actorId: number | null;
  eventType: string;
  title: string;
  detail: string | null;
  createdAt: Date;
}

export interface MemoryIncidentMessage {
  id: number;
  incidentId: number;
  authorType: "victim" | "rescuer" | "operations";
  authorId: number | null;
  message: string;
  createdAt: Date;
}

export interface MemoryRescueProfile {
  id: number;
  userId: number;
  callSign: string;
  phone: string | null;
  photoKey: string | null;
  photoUrl: string | null;
  contactSharing: "yes" | "no";
  locationSharing: "yes" | "no";
  availability: "available" | "on_mission" | "off_duty";
  lastLatitude: number | null;
  lastLongitude: number | null;
  locationUpdatedAt: Date | null;
  updatedAt: Date;
}

export interface MemorySafetyRequest {
  id: number;
  requesterId: number;
  category: "shelter" | "food" | "medical" | "protection";
  peopleAffected: number;
  details: string | null;
  latitude: number;
  longitude: number;
  status: "new" | "acknowledged" | "resolved";
  reviewedBy: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryNotification {
  id: number;
  recipientId: number;
  incidentId: number | null;
  type: "mission_assigned" | "priority_incident" | "status_update";
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface MemoryAuditLog {
  id: number;
  actorId: number | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  detail: string | null;
  createdAt: Date;
}

export interface MemoryRescuerRequest {
  id: number;
  userId: number;
  phone: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  reviewedBy: number | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryHospitalRequest {
  id: number;
  userId: number;
  hospitalName: string;
  address: string;
  contactPhone: string;
  latitude: number;
  longitude: number;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  reviewedBy: number | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryHospitalStaffProfile {
  id: number;
  userId: number;
  hospitalId: number;
  designation: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryHospitalCaseNotification {
  id: number;
  incidentId: number;
  hospitalId: number;
  rescuerId: number;
  severity: "critical" | "high" | "medium" | "low";
  patientCount: number;
  estimatedArrivalMinutes: number;
  requiredDepartment: string;
  icuRequired: "yes" | "no";
  oxygenRequired: "yes" | "no";
  notes: string | null;
  status: "notified" | "acknowledged" | "preparing" | "ready" | "received" | "completed";
  hospitalNotes: string | null;
  acknowledgedAt: Date | null;
  receivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const _memoryHospitalCaseNotifications: Map<number, MemoryHospitalCaseNotification> = new Map();

export const _memoryShelters: Map<number, MemoryShelter> = new Map([
  [
    1,
    {
      id: 1,
      name: "Guwahati Central Relief Camp",
      address: "Khanapara Ground, GS Road, Guwahati, Assam 781022",
      latitude: 26.1264,
      longitude: 91.7992,
      capacity: 500,
      occupancy: 140,
      status: "open",
      createdBy: 1,
      updatedAt: new Date(),
    },
  ],
  [
    2,
    {
      id: 2,
      name: "Silchar Flood Evacuation Shelter",
      address: "DSA Ground, Club Road, Silchar, Assam 788001",
      latitude: 24.8333,
      longitude: 92.7789,
      capacity: 350,
      occupancy: 95,
      status: "open",
      createdBy: 1,
      updatedAt: new Date(),
    },
  ],
  [
    3,
    {
      id: 3,
      name: "Dibrugarh Community Disaster Camp",
      address: "Chowkidinghee Field, Dibrugarh, Assam 786001",
      latitude: 27.4728,
      longitude: 94.912,
      capacity: 400,
      occupancy: 210,
      status: "open",
      createdBy: 1,
      updatedAt: new Date(),
    },
  ],
]);

export const _memoryHospitals: Map<number, MemoryHospital> = new Map([
  [
    1,
    {
      id: 1,
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
      foodSupplyStatus: "available",
      medicineSupplyStatus: "available",
      waterSupplyStatus: "available",
      powerBackupStatus: "available",
      status: "open",
      updatedBy: 1,
      updatedAt: new Date(),
    },
  ],
  [
    2,
    {
      id: 2,
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
      foodSupplyStatus: "available",
      medicineSupplyStatus: "available",
      waterSupplyStatus: "available",
      powerBackupStatus: "available",
      status: "open",
      updatedBy: 1,
      updatedAt: new Date(),
    },
  ],
]);

export const _memoryFloodZones: Map<number, MemoryFloodZone> = new Map([
  [
    1,
    {
      id: 1,
      name: "Brahmaputra Basin - Guwahati High Risk Sector",
      severity: "critical",
      polygonJson: JSON.stringify([
        { lat: 26.185, lng: 91.72 },
        { lat: 26.2, lng: 91.75 },
        { lat: 26.175, lng: 91.8 },
        { lat: 26.155, lng: 91.76 },
      ]),
      active: "yes",
      createdBy: 1,
      updatedAt: new Date(),
    },
  ],
]);

export const _memoryRescueProfiles: Map<number, MemoryRescueProfile> = new Map();

export const _memoryIncidents: Map<number, MemoryIncident> = new Map([
  [
    1,
    {
      id: 1,
      publicCode: "SOS-AS892K1L",
      reporterId: 4,
      contactName: "Bhaben Sarma",
      locationLabel: "Brahmaputra Bank, Uzan Bazar, Guwahati",
      latitude: 26.1921,
      longitude: 91.7543,
      emergencyType: "flood",
      helpNeeds: "Boat rescue required, rising water level reaching roof",
      severity: "critical",
      peopleAffected: 4,
      notes: "Elderly person and child trapped on second floor",
      evidenceKey: null,
      evidenceUrl: null,
      voiceNoteKey: null,
      voiceNoteUrl: null,
      voiceNoteDurationSeconds: null,
      status: "pending",
      assignedRescuerId: null,
      dispatchedAt: null,
      resolvedAt: null,
      createdAt: new Date(Date.now() - 45 * 60 * 1000),
      updatedAt: new Date(),
    },
  ],
]);

export const _memoryMissions: Map<number, MemoryMission> = new Map();

export const _memoryIncidentEvents: MemoryIncidentEvent[] = [
  {
    id: 1,
    incidentId: 1,
    actorId: 4,
    eventType: "sos_created",
    title: "SOS received",
    detail: "Awaiting dispatch from the emergency operations team.",
    createdAt: new Date(Date.now() - 45 * 60 * 1000),
  },
];

export const _memoryIncidentMessages: MemoryIncidentMessage[] = [
  {
    id: 1,
    incidentId: 1,
    authorType: "victim",
    authorId: 4,
    message: "Water level is rising fast at our gate.",
    createdAt: new Date(Date.now() - 42 * 60 * 1000),
  },
];

export const _memorySafetyRequests: Map<number, MemorySafetyRequest> = new Map();
export const _memoryNotifications: MemoryNotification[] = [];
export const _memoryRescuerRequests: Map<number, MemoryRescuerRequest> = new Map();
export const _memoryHospitalRequests: Map<number, MemoryHospitalRequest> = new Map();
export const _memoryHospitalStaffProfiles: Map<number, MemoryHospitalStaffProfile> = new Map();
export const _memoryAuditLogs: MemoryAuditLog[] = [];

let _incidentIdSeq = 100;
let _missionIdSeq = 100;
let _safetyRequestIdSeq = 100;
let _shelterIdSeq = 100;
let _hospitalIdSeq = 100;
let _floodZoneIdSeq = 100;
let _rescuerRequestIdSeq = 100;
let _hospitalRequestIdSeq = 100;
let _hospitalStaffIdSeq = 100;
let _rescueProfileIdSeq = 100;

export function nextIncidentId(): number { return ++_incidentIdSeq; }
export function nextMissionId(): number { return ++_missionIdSeq; }
export function nextSafetyRequestId(): number { return ++_safetyRequestIdSeq; }
export function nextShelterId(): number { return ++_shelterIdSeq; }
export function nextHospitalId(): number { return ++_hospitalIdSeq; }
export function nextFloodZoneId(): number { return ++_floodZoneIdSeq; }
export function nextRescuerRequestId(): number { return ++_rescuerRequestIdSeq; }
export function nextHospitalRequestId(): number { return ++_hospitalRequestIdSeq; }
export function nextHospitalStaffId(): number { return ++_hospitalStaffIdSeq; }
export function nextRescueProfileId(): number { return ++_rescueProfileIdSeq; }

export function registerMemoryRescuerProfile(profile: Partial<MemoryRescueProfile> & { userId: number; callSign: string }) {
  const existing = _memoryRescueProfiles.get(profile.userId);
  _memoryRescueProfiles.set(profile.userId, {
    id: existing?.id || nextRescueProfileId(),
    userId: profile.userId,
    callSign: profile.callSign,
    phone: profile.phone ?? existing?.phone ?? null,
    photoKey: profile.photoKey ?? existing?.photoKey ?? null,
    photoUrl: profile.photoUrl ?? existing?.photoUrl ?? null,
    contactSharing: profile.contactSharing ?? existing?.contactSharing ?? "no",
    locationSharing: profile.locationSharing ?? existing?.locationSharing ?? "no",
    availability: profile.availability ?? existing?.availability ?? "available",
    lastLatitude: profile.lastLatitude ?? existing?.lastLatitude ?? null,
    lastLongitude: profile.lastLongitude ?? existing?.lastLongitude ?? null,
    locationUpdatedAt: profile.locationUpdatedAt ?? existing?.locationUpdatedAt ?? new Date(),
    updatedAt: new Date(),
  });
}

export function registerMemoryHospitalStaffProfile(profile: { userId: number; hospitalId: number; designation?: string | null }) {
  _memoryHospitalStaffProfiles.set(profile.userId, {
    id: _memoryHospitalStaffProfiles.size + 1,
    userId: profile.userId,
    hospitalId: profile.hospitalId,
    designation: profile.designation ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function database() {
  const db = await getDb();
  if (!db) throw new Error("The operational database is unavailable.");
  return db;
}

function failClosedInProduction(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    throw error instanceof Error ? error : new Error("Authoritative database operation failed in production.");
  }
}

export async function writeAudit(
  actorId: number | null,
  action: string,
  resourceType: string,
  resourceId?: string | number | null,
  detail?: string | null,
) {
  try {
    const db = await database();
    await withDbTimeout(
      db.insert(auditLogs).values({
        actorId,
        action,
        resourceType,
        resourceId: resourceId ? String(resourceId) : null,
        detail: detail ?? null,
      }),
      4000,
      "writeAudit"
    );
  } catch (error) {
    failClosedInProduction(error);
    _memoryAuditLogs.push({
      id: _memoryAuditLogs.length + 1,
      actorId,
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : null,
      detail: detail ?? null,
      createdAt: new Date(),
    });
  }
}

export async function addIncidentEvent(
  incidentId: number,
  actorId: number | null,
  eventType: string,
  title: string,
  detail?: string | null,
) {
  try {
    const db = await database();
    await withDbTimeout(
      db.insert(incidentEvents).values({ incidentId, actorId, eventType, title, detail: detail ?? null }),
      4000,
      "addIncidentEvent"
    );
  } catch (error) {
    failClosedInProduction(error);
    _memoryIncidentEvents.unshift({
      id: _memoryIncidentEvents.length + 1,
      incidentId,
      actorId,
      eventType,
      title,
      detail: detail ?? null,
      createdAt: new Date(),
    });
  }
}

export async function getIncidentById(id: number) {
  try {
    const db = await database();
    const row = (
      await withDbTimeout(
        db.select().from(incidents).where(eq(incidents.id, id)).limit(1),
        4000,
        "getIncidentById"
      )
    )[0];
    if (row) return row;
  } catch (error) {
    failClosedInProduction(error);
  }
  return _memoryIncidents.get(id) || null;
}

export async function getIncidentByCode(publicCode: string) {
  try {
    const db = await database();
    const row = (
      await withDbTimeout(
        db.select().from(incidents).where(eq(incidents.publicCode, publicCode)).limit(1),
        4000,
        "getIncidentByCode"
      )
    )[0];
    if (row) return row;
  } catch (error) {
    failClosedInProduction(error);
  }
  return Array.from(_memoryIncidents.values()).find(i => i.publicCode === publicCode) || null;
}

export async function getIncidentTimeline(incidentId: number) {
  try {
    const db = await database();
    return await withDbTimeout(
      db
        .select()
        .from(incidentEvents)
        .where(eq(incidentEvents.incidentId, incidentId))
        .orderBy(desc(incidentEvents.createdAt)),
      4000,
      "getIncidentTimeline"
    );
  } catch (error) {
    failClosedInProduction(error);
    return _memoryIncidentEvents
      .filter(e => e.incidentId === incidentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export async function getIncidentMessages(incidentId: number) {
  try {
    const db = await database();
    return await withDbTimeout(
      db.select().from(incidentMessages).where(eq(incidentMessages.incidentId, incidentId)).orderBy(incidentMessages.createdAt),
      4000,
      "getIncidentMessages"
    );
  } catch (error) {
    failClosedInProduction(error);
    return _memoryIncidentMessages
      .filter(m => m.incidentId === incidentId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}

export async function getActiveAssignedRescuerForIncident(incidentId: number) {
  try {
    const db = await database();
    return (
      await withDbTimeout(
        db
          .select({ user: users, profile: rescueProfiles })
          .from(missions)
          .innerJoin(users, eq(missions.rescuerId, users.id))
          .innerJoin(rescueProfiles, eq(users.id, rescueProfiles.userId))
          .where(and(eq(missions.incidentId, incidentId), inArray(missions.status, ["pending", "dispatched"])))
          .limit(1),
        4000,
        "getActiveAssignedRescuer"
      )
    )[0];
  } catch (error) {
    failClosedInProduction(error);
    const mission = Array.from(_memoryMissions.values()).find(
      m => m.incidentId === incidentId && (m.status === "pending" || m.status === "dispatched")
    );
    if (!mission) return null;
    const profile = _memoryRescueProfiles.get(mission.rescuerId);
    const user = Array.from(_memoryUsers.values()).find(u => u.id === mission.rescuerId);
    if (!profile || !user) return null;
    return { user, profile };
  }
}

export async function listIncidents(status?: "pending" | "dispatched" | "resolved") {
  try {
    const db = await database();
    const rows = await withDbTimeout(
      db
        .select({
          incident: incidents,
          rescuerName: users.name,
          rescuerId: users.id,
          rescuerCallSign: rescueProfiles.callSign,
        })
        .from(incidents)
        .leftJoin(users, eq(incidents.assignedRescuerId, users.id))
        .leftJoin(rescueProfiles, eq(users.id, rescueProfiles.userId))
        .where(status ? eq(incidents.status, status) : undefined)
        .orderBy(desc(incidents.createdAt)),
      4000,
      "listIncidents"
    );
    return rows;
  } catch (error) {
    failClosedInProduction(error);
    const list = Array.from(_memoryIncidents.values()).filter(i => !status || i.status === status);
    return list.map(incident => ({
      incident,
      rescuerName: incident.assignedRescuerId ? _memoryUsers.get(String(incident.assignedRescuerId))?.name || null : null,
      rescuerId: incident.assignedRescuerId,
      rescuerCallSign: incident.assignedRescuerId ? _memoryRescueProfiles.get(incident.assignedRescuerId)?.callSign || null : null,
    }));
  }
}

export async function listIncidentsForReporter(reporterId: number) {
  try {
    const db = await database();
    return await withDbTimeout(
      db.select().from(incidents).where(eq(incidents.reporterId, reporterId)).orderBy(desc(incidents.createdAt)),
      4000,
      "listIncidentsForReporter"
    );
  } catch (error) {
    failClosedInProduction(error);
    return Array.from(_memoryIncidents.values())
      .filter(i => i.reporterId === reporterId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export async function listMissionsForRescuer(rescuerId: number) {
  try {
    const db = await database();
    return await withDbTimeout(
      db
        .select({ mission: missions, incident: incidents })
        .from(missions)
        .innerJoin(incidents, eq(missions.incidentId, incidents.id))
        .where(eq(missions.rescuerId, rescuerId))
        .orderBy(desc(missions.assignedAt)),
      4000,
      "listMissionsForRescuer"
    );
  } catch (error) {
    failClosedInProduction(error);
    const userMissions = Array.from(_memoryMissions.values()).filter(m => m.rescuerId === rescuerId);
    return userMissions
      .map(mission => {
        const incident = _memoryIncidents.get(mission.incidentId);
        if (!incident) return null;
        return { mission, incident };
      })
      .filter((m): m is { mission: MemoryMission; incident: MemoryIncident } => m !== null);
  }
}

export async function getMissionForRescuer(missionId: number, rescuerId: number) {
  try {
    const db = await database();
    return (
      await withDbTimeout(
        db
          .select()
          .from(missions)
          .where(and(eq(missions.id, missionId), eq(missions.rescuerId, rescuerId)))
          .limit(1),
        4000,
        "getMissionForRescuer"
      )
    )[0];
  } catch (error) {
    failClosedInProduction(error);
    const mission = _memoryMissions.get(missionId);
    if (mission && mission.rescuerId === rescuerId) return mission;
    return null;
  }
}

export async function getRescuerRoster() {
  try {
    const db = await database();
    return await withDbTimeout(
      db
        .select({ user: users, profile: rescueProfiles })
        .from(rescueProfiles)
        .innerJoin(users, eq(rescueProfiles.userId, users.id))
        .orderBy(users.name),
      4000,
      "getRescuerRoster"
    );
  } catch (error) {
    failClosedInProduction(error);
    const roster: Array<{ user: any; profile: MemoryRescueProfile }> = [];
    const profiles = Array.from(_memoryRescueProfiles.values());
    for (const profile of profiles) {
      const user = Array.from(_memoryUsers.values()).find(u => u.id === profile.userId);
      if (user) roster.push({ user, profile });
    }
    return roster;
  }
}

export async function getRescuerProfile(userId: number) {
  try {
    const db = await database();
    if (db) {
      const res = (
        await withDbTimeout(
          db.select().from(rescueProfiles).where(eq(rescueProfiles.userId, userId)).limit(1),
          4000,
          "getRescuerProfile"
        )
      )[0];
      if (res) return res;
    }
  } catch (error) {
    failClosedInProduction(error);
  }
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  let profile = _memoryRescueProfiles.get(userId);
  if (!profile) {
    const user = Array.from(_memoryUsers.values()).find(u => u.id === userId);
    profile = {
      id: _memoryRescueProfiles.size + 1,
      userId,
      callSign: user?.name ? `${user.name} (Field Unit)` : `Rescuer #${userId}`,
      phone: null,
      photoKey: null,
      photoUrl: null,
      contactSharing: "no",
      locationSharing: "no",
      availability: "available",
      lastLatitude: 26.1445,
      lastLongitude: 91.7362,
      locationUpdatedAt: new Date(),
      updatedAt: new Date(),
    };
    _memoryRescueProfiles.set(userId, profile);
  }
  return profile;
}

export async function listRescuerRegistrationRequests() {
  try {
    const db = await database();
    return await withDbTimeout(
      db
        .select({ request: rescuerRegistrationRequests, user: users })
        .from(rescuerRegistrationRequests)
        .innerJoin(users, eq(rescuerRegistrationRequests.userId, users.id))
        .orderBy(desc(rescuerRegistrationRequests.createdAt)),
      4000,
      "listRescuerRegistrationRequests"
    );
  } catch (error) {
    failClosedInProduction(error);
    const requests: Array<{ request: MemoryRescuerRequest; user: any }> = [];
    const allReqs = Array.from(_memoryRescuerRequests.values());
    for (const request of allReqs) {
      const user = Array.from(_memoryUsers.values()).find(u => u.id === request.userId);
      if (user) requests.push({ request, user });
    }
    return requests;
  }
}

export async function listNotificationFeed(recipientId: number) {
  try {
    const db = await database();
    return await withDbTimeout(
      db
        .select()
        .from(notifications)
        .where(eq(notifications.recipientId, recipientId))
        .orderBy(desc(notifications.createdAt)),
      4000,
      "listNotificationFeed"
    );
  } catch (error) {
    failClosedInProduction(error);
    return _memoryNotifications.filter(n => n.recipientId === recipientId);
  }
}

export async function getMapLayers(includeOperational: boolean) {
  try {
    const db = await database();
    const [shelterRows, hospitalRows, zoneRows] = await withDbTimeout(
      Promise.all([
        db.select().from(shelters).orderBy(shelters.name),
        db.select().from(hospitals).orderBy(hospitals.name),
        db.select().from(floodZones).where(eq(floodZones.active, "yes")).orderBy(desc(floodZones.updatedAt)),
      ]),
      4000,
      "getMapLayers_public"
    );
    if (!includeOperational) return { shelters: shelterRows, hospitals: hospitalRows, floodZones: zoneRows, incidents: [], rescuers: [] };
    const [incidentRows, rescuerRows] = await withDbTimeout(
      Promise.all([
        db.select().from(incidents).where(inArray(incidents.status, ["pending", "dispatched"])),
        db
          .select({ user: users, profile: rescueProfiles })
          .from(rescueProfiles)
          .innerJoin(users, eq(rescueProfiles.userId, users.id))
          .where(and(eq(users.role, "rescuer"), inArray(rescueProfiles.availability, ["available", "on_mission"]))),
      ]),
      4000,
      "getMapLayers_operational"
    );
    return { shelters: shelterRows, hospitals: hospitalRows, floodZones: zoneRows, incidents: incidentRows, rescuers: rescuerRows };
  } catch (error) {
    failClosedInProduction(error);
    const sheltersList = Array.from(_memoryShelters.values());
    const hospitalsList = Array.from(_memoryHospitals.values());
    const floodZonesList = Array.from(_memoryFloodZones.values()).filter(z => z.active === "yes");
    if (!includeOperational) return { shelters: sheltersList, hospitals: hospitalsList, floodZones: floodZonesList, incidents: [], rescuers: [] };
    const incidentsList = Array.from(_memoryIncidents.values()).filter(i => i.status === "pending" || i.status === "dispatched");
    const rescuersList: Array<{ user: any; profile: MemoryRescueProfile }> = [];
    const profiles = Array.from(_memoryRescueProfiles.values());
    for (const profile of profiles) {
      const user = Array.from(_memoryUsers.values()).find(u => u.id === profile.userId);
      if (user) rescuersList.push({ user, profile });
    }
    return { shelters: sheltersList, hospitals: hospitalsList, floodZones: floodZonesList, incidents: incidentsList, rescuers: rescuersList };
  }
}

export async function listHospitals() {
  try {
    const db = await database();
    return await withDbTimeout(db.select().from(hospitals).orderBy(hospitals.name), 4000, "listHospitals");
  } catch (error) {
    failClosedInProduction(error);
    return Array.from(_memoryHospitals.values());
  }
}

export async function listShelters() {
  try {
    const db = await database();
    return await withDbTimeout(db.select().from(shelters).orderBy(shelters.name), 4000, "listShelters");
  } catch (error) {
    failClosedInProduction(error);
    return Array.from(_memoryShelters.values());
  }
}

export async function getAnalytics() {
  try {
    const db = await database();
    const [incidentRows, activeRescuerRows, missionRows] = await withDbTimeout(
      Promise.all([
        db.select({ id: incidents.id, status: incidents.status, createdAt: incidents.createdAt }).from(incidents),
        db.select({ id: rescueProfiles.id }).from(rescueProfiles).where(inArray(rescueProfiles.availability, ["available", "on_mission"])),
        db.select({ incidentId: missions.incidentId, dispatchedAt: missions.dispatchedAt }).from(missions),
      ]),
      4000,
      "getAnalytics"
    );
    const resolvedCases = incidentRows.filter(row => row.status === "resolved").length;
    const responseMinutes = missionRows
      .filter(row => row.dispatchedAt)
      .map(row => {
        const incident = incidentRows.find(candidate => candidate.id === row.incidentId);
        return incident ? (row.dispatchedAt!.getTime() - incident.createdAt.getTime()) / 60000 : null;
      })
      .filter((value): value is number => value !== null && value >= 0);
    const averageResponseMinutes = responseMinutes.length
      ? Math.round((responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length) * 10) / 10
      : null;
    return {
      totalIncidents: incidentRows.length,
      pendingIncidents: incidentRows.filter(row => row.status === "pending").length,
      activeIncidents: incidentRows.filter(row => row.status !== "resolved").length,
      resolvedCases,
      activeRescuers: activeRescuerRows.length,
      averageResponseMinutes,
    };
  } catch (error) {
    failClosedInProduction(error);
    const incidentRows = Array.from(_memoryIncidents.values());
    const activeRescuerRows = Array.from(_memoryRescueProfiles.values()).filter(p => p.availability !== "off_duty");
    return {
      totalIncidents: incidentRows.length,
      pendingIncidents: incidentRows.filter(r => r.status === "pending").length,
      activeIncidents: incidentRows.filter(r => r.status !== "resolved").length,
      resolvedCases: incidentRows.filter(r => r.status === "resolved").length,
      activeRescuers: activeRescuerRows.length,
      averageResponseMinutes: null,
    };
  }
}

export async function getAvailableRescuersNear(latitude: number, longitude: number, radiusKm: number) {
  let candidates: Array<{ user: any; profile: any }> = [];
  try {
    const db = await database();
    candidates = await withDbTimeout(
      db
        .select({ user: users, profile: rescueProfiles })
        .from(rescueProfiles)
        .innerJoin(users, eq(rescueProfiles.userId, users.id))
        .where(and(eq(users.role, "rescuer"), eq(rescueProfiles.availability, "available"))),
      4000,
      "getAvailableRescuersNear"
    );
  } catch (error) {
    failClosedInProduction(error);
    const profiles = Array.from(_memoryRescueProfiles.values());
    for (const profile of profiles) {
      if (profile.availability === "available") {
        const user = Array.from(_memoryUsers.values()).find(u => u.id === profile.userId && u.role === "rescuer");
        if (user) candidates.push({ user, profile });
      }
    }
  }
  const toRadians = (value: number) => (value * Math.PI) / 180;
  return candidates.filter(({ profile }) => {
    if (profile.lastLatitude === null || profile.lastLongitude === null) return false;
    const latDistance = toRadians(profile.lastLatitude - latitude);
    const lngDistance = toRadians(profile.lastLongitude - longitude);
    const formula = Math.sin(latDistance / 2) ** 2 + Math.cos(toRadians(latitude)) * Math.cos(toRadians(profile.lastLatitude)) * Math.sin(lngDistance / 2) ** 2;
    const distanceKm = 2 * 6371 * Math.asin(Math.sqrt(formula));
    return distanceKm <= radiusKm;
  });
}

export async function unreadNotificationCount(recipientId: number) {
  try {
    const db = await database();
    const result = await withDbTimeout(
      db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.recipientId, recipientId), isNull(notifications.readAt))),
      4000,
      "unreadNotificationCount"
    );
    return result.length;
  } catch (error) {
    failClosedInProduction(error);
    return _memoryNotifications.filter(n => n.recipientId === recipientId && !n.readAt).length;
  }
}

let _nextHospitalNotificationId = 1;

export async function createHospitalCaseNotification(data: {
  incidentId: number;
  hospitalId: number;
  rescuerId: number;
  severity: "critical" | "high" | "medium" | "low";
  patientCount: number;
  estimatedArrivalMinutes: number;
  requiredDepartment: string;
  icuRequired: "yes" | "no";
  oxygenRequired: "yes" | "no";
  notes?: string | null;
}) {
  try {
    const db = await database();
    const { hospitalCaseNotifications } = await import("../drizzle/schema");
    const [inserted] = await withDbTimeout(
      db.insert(hospitalCaseNotifications).values({
        incidentId: data.incidentId,
        hospitalId: data.hospitalId,
        rescuerId: data.rescuerId,
        severity: data.severity,
        patientCount: data.patientCount,
        estimatedArrivalMinutes: data.estimatedArrivalMinutes,
        requiredDepartment: data.requiredDepartment,
        icuRequired: data.icuRequired,
        oxygenRequired: data.oxygenRequired,
        notes: data.notes || null,
        status: "notified",
      }),
      4000,
      "createHospitalCaseNotification_insert"
    );
    const created = await withDbTimeout(
      db.select().from(hospitalCaseNotifications).where(eq(hospitalCaseNotifications.id, inserted.insertId)).limit(1),
      4000,
      "createHospitalCaseNotification_select"
    );
    if (created.length > 0) return created[0];
  } catch (error) {
    failClosedInProduction(error);
  }

  const id = _nextHospitalNotificationId++;
  const record: MemoryHospitalCaseNotification = {
    id,
    incidentId: data.incidentId,
    hospitalId: data.hospitalId,
    rescuerId: data.rescuerId,
    severity: data.severity,
    patientCount: data.patientCount,
    estimatedArrivalMinutes: data.estimatedArrivalMinutes,
    requiredDepartment: data.requiredDepartment,
    icuRequired: data.icuRequired,
    oxygenRequired: data.oxygenRequired,
    notes: data.notes || null,
    status: "notified",
    hospitalNotes: null,
    acknowledgedAt: null,
    receivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  _memoryHospitalCaseNotifications.set(id, record);
  return record;
}

export async function listHospitalCaseNotifications(hospitalId?: number | null) {
  try {
    const db = await database();
    const { hospitalCaseNotifications } = await import("../drizzle/schema");
    return await withDbTimeout(
      db
        .select({
          notification: hospitalCaseNotifications,
          incident: incidents,
          rescuer: { id: users.id, name: users.name },
        })
        .from(hospitalCaseNotifications)
        .innerJoin(incidents, eq(hospitalCaseNotifications.incidentId, incidents.id))
        .innerJoin(users, eq(hospitalCaseNotifications.rescuerId, users.id))
        .where(hospitalId ? eq(hospitalCaseNotifications.hospitalId, hospitalId) : undefined)
        .orderBy(desc(hospitalCaseNotifications.createdAt)),
      4000,
      "listHospitalCaseNotifications"
    );
  } catch (error) {
    failClosedInProduction(error);
    const list = Array.from(_memoryHospitalCaseNotifications.values())
      .filter(n => !hospitalId || n.hospitalId === hospitalId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return list.map(notification => {
      const incident = _memoryIncidents.get(notification.incidentId) || {
        id: notification.incidentId,
        publicCode: `CASE-${notification.incidentId}`,
        emergencyType: "flood",
        locationLabel: "Assam Rescue Sector",
        latitude: 26.1445,
        longitude: 91.7362,
        severity: notification.severity,
        peopleAffected: notification.patientCount,
        notes: notification.notes,
        status: "dispatched",
        createdAt: notification.createdAt,
      };
      const rescuerUser = Array.from(_memoryUsers.values()).find(u => u.id === notification.rescuerId) || {
        id: notification.rescuerId,
        name: "NDRF Field Unit",
      };
      const rescuerProfile = Array.from(_memoryRescueProfiles.values()).find(p => p.userId === notification.rescuerId);

      return {
        notification,
        incident,
        rescuer: {
          id: rescuerUser.id,
          name: rescuerUser.name,
          callSign: rescuerProfile?.callSign || "Field Rescuer",
        },
      };
    });
  }
}

export async function updateHospitalCaseStatus(
  notificationId: number,
  status: "notified" | "acknowledged" | "preparing" | "ready" | "received" | "completed",
  hospitalNotes?: string
) {
  try {
    const db = await database();
    const { hospitalCaseNotifications } = await import("../drizzle/schema");
    const updateValues: any = {
      status,
      updatedAt: new Date(),
    };
    if (hospitalNotes !== undefined) updateValues.hospitalNotes = hospitalNotes;
    if (status === "acknowledged") updateValues.acknowledgedAt = new Date();
    if (status === "received") updateValues.receivedAt = new Date();

    await db
      .update(hospitalCaseNotifications)
      .set(updateValues)
      .where(eq(hospitalCaseNotifications.id, notificationId));

    const updated = await db.select().from(hospitalCaseNotifications).where(eq(hospitalCaseNotifications.id, notificationId)).limit(1);
    if (updated.length > 0) return updated[0];
  } catch (error) {
    failClosedInProduction(error);
  }

  const existing = _memoryHospitalCaseNotifications.get(notificationId);
  if (existing) {
    existing.status = status;
    if (hospitalNotes !== undefined) existing.hospitalNotes = hospitalNotes;
    if (status === "acknowledged") existing.acknowledgedAt = new Date();
    if (status === "received") existing.receivedAt = new Date();
    existing.updatedAt = new Date();
    _memoryHospitalCaseNotifications.set(notificationId, existing);
    return existing;
  }
  return null;
}

export async function updateIncidentAutomationState(
  incidentId: number,
  updates: {
    escalationLevel?: number;
    lastEscalatedAt?: Date;
    automationStatus?: string;
  }
) {
  const now = new Date();
  try {
    const db = await database();
    const setValues: any = { updatedAt: now };
    if (updates.escalationLevel !== undefined) setValues.escalationLevel = updates.escalationLevel;
    if (updates.lastEscalatedAt !== undefined) setValues.lastEscalatedAt = updates.lastEscalatedAt;
    if (updates.automationStatus !== undefined) setValues.automationStatus = updates.automationStatus;

    await db.update(incidents).set(setValues).where(eq(incidents.id, incidentId));
  } catch (error) {
    failClosedInProduction(error);
  }

  const mem = _memoryIncidents.get(incidentId);
  if (mem) {
    if (updates.escalationLevel !== undefined) (mem as any).escalationLevel = updates.escalationLevel;
    if (updates.lastEscalatedAt !== undefined) (mem as any).lastEscalatedAt = updates.lastEscalatedAt;
    if (updates.automationStatus !== undefined) (mem as any).automationStatus = updates.automationStatus;
    mem.updatedAt = now;
    _memoryIncidents.set(incidentId, mem);
    return mem;
  }
  return null;
}

