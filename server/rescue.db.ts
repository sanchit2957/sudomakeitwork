import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  auditLogs,
  floodZones,
  incidentEvents,
  incidents,
  missions,
  notifications,
  rescueProfiles,
  shelters,
  users,
} from "../drizzle/schema";
import { getDb } from "./db";

async function database() {
  const db = await getDb();
  if (!db) throw new Error("The operational database is unavailable.");
  return db;
}

export async function writeAudit(
  actorId: number | null,
  action: string,
  resourceType: string,
  resourceId?: string | number | null,
  detail?: string | null,
) {
  const db = await database();
  await db.insert(auditLogs).values({
    actorId,
    action,
    resourceType,
    resourceId: resourceId ? String(resourceId) : null,
    detail: detail ?? null,
  });
}

export async function addIncidentEvent(
  incidentId: number,
  actorId: number | null,
  eventType: string,
  title: string,
  detail?: string | null,
) {
  const db = await database();
  await db.insert(incidentEvents).values({ incidentId, actorId, eventType, title, detail: detail ?? null });
}

export async function getIncidentById(id: number) {
  const db = await database();
  return (await db.select().from(incidents).where(eq(incidents.id, id)).limit(1))[0];
}

export async function getIncidentByCode(publicCode: string) {
  const db = await database();
  return (await db.select().from(incidents).where(eq(incidents.publicCode, publicCode)).limit(1))[0];
}

export async function getIncidentTimeline(incidentId: number) {
  const db = await database();
  return db
    .select()
    .from(incidentEvents)
    .where(eq(incidentEvents.incidentId, incidentId))
    .orderBy(desc(incidentEvents.createdAt));
}

export async function listIncidents(status?: "pending" | "dispatched" | "resolved") {
  const db = await database();
  const rows = await db
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
    .orderBy(desc(incidents.createdAt));
  return rows;
}

export async function listIncidentsForReporter(reporterId: number) {
  const db = await database();
  return db.select().from(incidents).where(eq(incidents.reporterId, reporterId)).orderBy(desc(incidents.createdAt));
}

export async function listMissionsForRescuer(rescuerId: number) {
  const db = await database();
  return db
    .select({ mission: missions, incident: incidents })
    .from(missions)
    .innerJoin(incidents, eq(missions.incidentId, incidents.id))
    .where(eq(missions.rescuerId, rescuerId))
    .orderBy(desc(missions.assignedAt));
}

export async function getMissionForRescuer(missionId: number, rescuerId: number) {
  const db = await database();
  return (
    await db
      .select()
      .from(missions)
      .where(and(eq(missions.id, missionId), eq(missions.rescuerId, rescuerId)))
      .limit(1)
  )[0];
}

export async function getRescuerRoster() {
  const db = await database();
  return db
    .select({ user: users, profile: rescueProfiles })
    .from(rescueProfiles)
    .innerJoin(users, eq(rescueProfiles.userId, users.id))
    .orderBy(users.name);
}

export async function getRescuerProfile(userId: number) {
  const db = await database();
  return (await db.select().from(rescueProfiles).where(eq(rescueProfiles.userId, userId)).limit(1))[0];
}

export async function listNotificationFeed(recipientId: number) {
  const db = await database();
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, recipientId))
    .orderBy(desc(notifications.createdAt));
}

export async function getMapLayers(includeOperational: boolean) {
  const db = await database();
  const [shelterRows, zoneRows] = await Promise.all([
    db.select().from(shelters).orderBy(shelters.name),
    db.select().from(floodZones).where(eq(floodZones.active, "yes")).orderBy(desc(floodZones.updatedAt)),
  ]);
  if (!includeOperational) return { shelters: shelterRows, floodZones: zoneRows, incidents: [], rescuers: [] };
  const [incidentRows, rescuerRows] = await Promise.all([
    db.select().from(incidents).where(inArray(incidents.status, ["pending", "dispatched"])),
    db
      .select({ user: users, profile: rescueProfiles })
      .from(rescueProfiles)
      .innerJoin(users, eq(rescueProfiles.userId, users.id))
      .where(and(eq(users.role, "rescuer"), inArray(rescueProfiles.availability, ["available", "on_mission"]))),
  ]);
  return { shelters: shelterRows, floodZones: zoneRows, incidents: incidentRows, rescuers: rescuerRows };
}

export async function getAnalytics() {
  const db = await database();
  const [incidentRows, activeRescuerRows, missionRows] = await Promise.all([
    db.select().from(incidents),
    db.select().from(rescueProfiles).where(inArray(rescueProfiles.availability, ["available", "on_mission"])),
    db.select().from(missions),
  ]);
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
}

export async function getAvailableRescuersNear(latitude: number, longitude: number, radiusKm: number) {
  const db = await database();
  const candidates = await db
    .select({ user: users, profile: rescueProfiles })
    .from(rescueProfiles)
    .innerJoin(users, eq(rescueProfiles.userId, users.id))
    .where(and(eq(users.role, "rescuer"), eq(rescueProfiles.availability, "available")));
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
  const db = await database();
  const result = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.recipientId, recipientId), isNull(notifications.readAt)));
  return result.length;
}
