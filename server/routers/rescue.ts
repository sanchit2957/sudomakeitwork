import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { floodZones, guestEmergencyRateLimits, hospitals, incidents, missions, notifications, pushSubscriptions, rescueProfiles, rescuerRegistrationRequests, shelters, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { notifyOwner } from "../_core/notification";
import { adminProcedure, operationalProcedure, protectedProcedure, publicProcedure, rescuerProcedure, router } from "../_core/trpc";
import {
  addIncidentEvent,
  getAnalytics,
  getAvailableRescuersNear,
  getIncidentByCode,
  getIncidentById,
  getIncidentTimeline,
  getMapLayers,
  listHospitals,
  listRescuerRegistrationRequests,
  getMissionForRescuer,
  getRescuerProfile,
  getRescuerRoster,
  listIncidents,
  listIncidentsForReporter,
  listMissionsForRescuer,
  listNotificationFeed,
  unreadNotificationCount,
  writeAudit,
} from "../rescue.db";
import { storagePut } from "../storage";
import { getGuestSosRateLimitDecision, isAllowedMissionTransition } from "../rescue.policy";
import { hasValidHospitalCapacity } from "../hospital.policy";
import { canRequestRescuerRegistration, requiresCallSign } from "../registration.policy";
import { sendRescuerPush } from "../push";

const incidentCode = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);
const severitySchema = z.enum(["critical", "high", "medium", "low"]);
const missionStatusSchema = z.enum(["pending", "dispatched", "resolved"]);
const hospitalStatusSchema = z.enum(["open", "limited", "critical", "closed"]);
const pointSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const hospitalInput = z.object({
  name: z.string().trim().min(2).max(180),
  address: z.string().trim().min(3).max(360),
  contactPhone: z.string().trim().max(32).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  totalEmergencyBeds: z.number().int().min(0).max(1_000_000),
  availableEmergencyBeds: z.number().int().min(0).max(1_000_000),
  totalIcuBeds: z.number().int().min(0).max(1_000_000),
  availableIcuBeds: z.number().int().min(0).max(1_000_000),
  oxygenCylinderCount: z.number().int().min(0).max(1_000_000),
  bloodUnitCount: z.number().int().min(0).max(1_000_000),
  ambulanceCount: z.number().int().min(0).max(1_000_000),
  status: hospitalStatusSchema,
});

async function database() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The operational database is unavailable." });
  return db;
}

function readEvidence(dataUrl?: string) {
  if (!dataUrl) return null;
  const matched = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!matched) throw new TRPCError({ code: "BAD_REQUEST", message: "Evidence must be a PNG, JPEG, or WebP image." });
  const bytes = Buffer.from(matched[2].replace(/\s/g, ""), "base64");
  if (bytes.byteLength > 1_500_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Evidence images must be 1.5 MB or smaller." });
  const extension = matched[1] === "image/png" ? "png" : matched[1] === "image/webp" ? "webp" : "jpg";
  return { bytes, contentType: matched[1], extension };
}

async function emitIncidentAlerts(incidentId: number, publicCode: string, locationLabel: string, severity: "critical" | "high" | "medium" | "low", latitude: number, longitude: number) {
  if (severity !== "critical" && severity !== "high") return;
  const db = await database();
  const nearbyRescuers = await getAvailableRescuersNear(latitude, longitude, 25);
  if (nearbyRescuers.length) {
    await db.insert(notifications).values(
      nearbyRescuers.map(({ user }) => ({
        recipientId: user.id,
        incidentId,
        type: "priority_incident" as const,
        title: `${severity === "critical" ? "Critical" : "High-priority"} SOS nearby`,
        body: `${publicCode} reported at ${locationLabel}. Review the operations board.`,
      })),
    );
    await sendRescuerPush(nearbyRescuers.map(({ user }) => user.id), {
      title: `${severity === "critical" ? "Critical" : "High-priority"} SOS nearby`,
      body: `${publicCode} reported at ${locationLabel}. Review the operations board.`,
      incidentId,
      url: "/responder/alerts",
    });
  }
  await notifyOwner({
    title: `${severity === "critical" ? "Critical" : "High-priority"} SOS: ${publicCode}`,
    content: `New SOS at ${locationLabel}. ${nearbyRescuers.length} nearby available rescuer(s) notified in-app.`,
  });
}

async function enforceGuestSosRateLimit(guestKey: string) {
  const db = await database();
  const keyHash = createHash("sha256").update(guestKey).digest("hex");
  const existing = (await db.select().from(guestEmergencyRateLimits).where(eq(guestEmergencyRateLimits.keyHash, keyHash)).limit(1))[0];
  const now = new Date();
  if (!existing) {
    await db.insert(guestEmergencyRateLimits).values({ keyHash, windowStartedAt: now, requestCount: 1 });
    return;
  }
  const decision = getGuestSosRateLimitDecision(existing.requestCount, existing.windowStartedAt, now);
  if (decision.action === "reset") {
    await db.update(guestEmergencyRateLimits).set({ windowStartedAt: now, requestCount: 1 }).where(eq(guestEmergencyRateLimits.id, existing.id));
    return;
  }
  if (decision.action === "reject") {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many emergency reports from this device. Please contact emergency services if immediate danger persists." });
  }
  await db.update(guestEmergencyRateLimits).set({ requestCount: decision.requestCount }).where(eq(guestEmergencyRateLimits.id, existing.id));
}

export const rescueRouter = router({
  emergency: router({
    create: publicProcedure
      .input(z.object({
        contactName: z.string().trim().max(160).optional(),
        locationLabel: z.string().trim().min(3).max(360),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        emergencyType: z.enum(["flood", "medical", "trapped", "evacuation", "other"]),
        severity: severitySchema,
        peopleAffected: z.number().int().min(1).max(500),
        notes: z.string().trim().max(2000).optional(),
        evidenceDataUrl: z.string().max(2_100_000).optional(),
        guestKey: z.string().regex(/^[A-Za-z0-9_-]{24,160}$/).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await database();
        if (!ctx.user && !input.guestKey) throw new TRPCError({ code: "BAD_REQUEST", message: "Guest emergency mode requires a device key." });
        if (!ctx.user && input.guestKey) await enforceGuestSosRateLimit(input.guestKey);
        const publicCode = `SOS-${incidentCode()}`;
        const evidence = readEvidence(input.evidenceDataUrl);
        let uploadedEvidence: { key: string; url: string } | null = null;
        if (evidence) uploadedEvidence = await storagePut(`incidents/${publicCode}/evidence.${evidence.extension}`, evidence.bytes, evidence.contentType);
        const result = await db.insert(incidents).values({
          publicCode,
          reporterId: ctx.user?.id ?? null,
          contactName: input.contactName ?? null,
          locationLabel: input.locationLabel,
          latitude: input.latitude,
          longitude: input.longitude,
          emergencyType: input.emergencyType,
          severity: input.severity,
          peopleAffected: input.peopleAffected,
          notes: input.notes ?? null,
          evidenceKey: uploadedEvidence?.key ?? null,
          evidenceUrl: uploadedEvidence?.url ?? null,
          status: "pending",
        });
        const incidentId = Number(result[0].insertId);
        await addIncidentEvent(incidentId, ctx.user?.id ?? null, "sos_created", "SOS received", "Awaiting dispatch from the emergency operations team.");
        await writeAudit(ctx.user?.id ?? null, "incident.create", "incident", incidentId, `Created ${publicCode}`);
        await emitIncidentAlerts(incidentId, publicCode, input.locationLabel, input.severity, input.latitude, input.longitude);
        return { incidentId, publicCode, status: "pending" as const };
      }),
    statusByCode: publicProcedure.input(z.object({ publicCode: z.string().trim().toUpperCase().regex(/^SOS-[A-Z0-9]{8}$/) })).query(async ({ input }) => {
      const incident = await getIncidentByCode(input.publicCode);
      if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "No SOS request matches this tracking code." });
      const events = await getIncidentTimeline(incident.id);
      return {
        publicCode: incident.publicCode,
        status: incident.status,
        locationLabel: incident.locationLabel,
        severity: incident.severity,
        createdAt: incident.createdAt,
        dispatchedAt: incident.dispatchedAt,
        resolvedAt: incident.resolvedAt,
        events,
      };
    }),
    mine: protectedProcedure.query(({ ctx }) => listIncidentsForReporter(ctx.user.id)),
  }),

  operations: router({
    incidents: adminProcedure.input(z.object({ status: missionStatusSchema.optional() }).optional()).query(({ input }) => listIncidents(input?.status)),
    analytics: adminProcedure.query(() => getAnalytics()),
    mapLayers: operationalProcedure.query(({ ctx }) => getMapLayers(ctx.user.role !== "user")),
    hospitals: adminProcedure.query(() => listHospitals()),
    rescuerRegistrationRequests: adminProcedure.query(() => listRescuerRegistrationRequests()),
    rescueRoster: adminProcedure.query(() => getRescuerRoster()),
    availableUsers: adminProcedure.query(async () => {
      const db = await database();
      return db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).orderBy(users.name);
    }),
    promoteRescuer: adminProcedure.input(z.object({ userId: z.number().int().positive(), callSign: z.string().trim().min(2).max(96), phone: z.string().trim().max(32).optional() })).mutation(async ({ input, ctx }) => {
      const db = await database();
      const target = (await db.select().from(users).where(eq(users.id, input.userId)).limit(1))[0];
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      if (target.role === "admin") throw new TRPCError({ code: "BAD_REQUEST", message: "Administrators cannot be converted to rescuers." });
      await db.update(users).set({ role: "rescuer" }).where(eq(users.id, input.userId));
      const existing = await getRescuerProfile(input.userId);
      if (existing) await db.update(rescueProfiles).set({ callSign: input.callSign, phone: input.phone ?? null }).where(eq(rescueProfiles.userId, input.userId));
      else await db.insert(rescueProfiles).values({ userId: input.userId, callSign: input.callSign, phone: input.phone ?? null, availability: "available" });
      await writeAudit(ctx.user.id, "rescuer.promote", "user", input.userId, `Assigned call sign ${input.callSign}`);
      return { success: true };
    }),
    reviewRescuerRegistration: adminProcedure.input(z.object({ requestId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), callSign: z.string().trim().min(2).max(96).optional(), reviewNote: z.string().trim().max(1000).optional() })).mutation(async ({ input, ctx }) => {
      if (!requiresCallSign(input.decision, input.callSign)) throw new TRPCError({ code: "BAD_REQUEST", message: "A field call sign is required to approve a rescuer." });
      const db = await database();
      const request = (await db.select().from(rescuerRegistrationRequests).where(eq(rescuerRegistrationRequests.id, input.requestId)).limit(1))[0];
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Registration request not found." });
      if (request.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "This registration request has already been reviewed." });
      const reviewedAt = new Date();
      await db.update(rescuerRegistrationRequests).set({ status: input.decision, reviewedBy: ctx.user.id, reviewedAt, reviewNote: input.reviewNote ?? null }).where(eq(rescuerRegistrationRequests.id, request.id));
      if (input.decision === "approved") {
        await db.update(users).set({ role: "rescuer" }).where(eq(users.id, request.userId));
        const existing = await getRescuerProfile(request.userId);
        if (existing) await db.update(rescueProfiles).set({ callSign: input.callSign!, phone: request.phone ?? null, availability: "available" }).where(eq(rescueProfiles.userId, request.userId));
        else await db.insert(rescueProfiles).values({ userId: request.userId, callSign: input.callSign!, phone: request.phone ?? null, availability: "available" });
      }
      await writeAudit(ctx.user.id, `rescuerRegistration.${input.decision}`, "rescuerRegistration", request.id, input.callSign ?? input.reviewNote ?? null);
      return { success: true };
    }),
    assignMission: adminProcedure.input(z.object({ incidentId: z.number().int().positive(), rescuerId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const db = await database();
      const incident = await getIncidentById(input.incidentId);
      if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "SOS request not found." });
      if (incident.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending SOS requests can be assigned." });
      const rescuer = (await db.select().from(users).where(eq(users.id, input.rescuerId)).limit(1))[0];
      const profile = await getRescuerProfile(input.rescuerId);
      if (!rescuer || rescuer.role !== "rescuer" || !profile) throw new TRPCError({ code: "BAD_REQUEST", message: "Select an authorized rescuer." });
      if (profile.availability !== "available") throw new TRPCError({ code: "BAD_REQUEST", message: "Selected rescuer is not available." });
      const mission = await db.insert(missions).values({ incidentId: incident.id, rescuerId: input.rescuerId, assignedBy: ctx.user.id, status: "pending" });
      await db.update(incidents).set({ assignedRescuerId: input.rescuerId }).where(eq(incidents.id, incident.id));
      await db.update(rescueProfiles).set({ availability: "on_mission" }).where(eq(rescueProfiles.userId, input.rescuerId));
      await db.insert(notifications).values({ recipientId: input.rescuerId, incidentId: incident.id, type: "mission_assigned", title: `Mission assigned: ${incident.publicCode}`, body: `Proceed to ${incident.locationLabel} and update the mission status when dispatched.` });
      await sendRescuerPush([input.rescuerId], { title: `Mission assigned: ${incident.publicCode}`, body: `Proceed to ${incident.locationLabel} and update the mission status when dispatched.`, incidentId: incident.id, url: "/responder/alerts" });
      await addIncidentEvent(incident.id, ctx.user.id, "mission_assigned", "Rescue mission assigned", "A rescuer has been assigned and is preparing to deploy.");
      await writeAudit(ctx.user.id, "mission.assign", "incident", incident.id, `Assigned to user ${input.rescuerId}`);
      return { missionId: Number(mission[0].insertId) };
    }),
    addShelter: adminProcedure.input(z.object({ name: z.string().trim().min(2).max(180), address: z.string().trim().min(3).max(360), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), capacity: z.number().int().min(0).max(1_000_000), occupancy: z.number().int().min(0).max(1_000_000), status: z.enum(["open", "limited", "closed"]) })).mutation(async ({ input, ctx }) => {
      if (input.occupancy > input.capacity && input.capacity > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Occupancy cannot exceed capacity." });
      const db = await database();
      const result = await db.insert(shelters).values({ ...input, createdBy: ctx.user.id });
      await writeAudit(ctx.user.id, "shelter.create", "shelter", Number(result[0].insertId), input.name);
      return { id: Number(result[0].insertId) };
    }),
    updateShelter: adminProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(180), address: z.string().trim().min(3).max(360), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), capacity: z.number().int().min(0).max(1_000_000), occupancy: z.number().int().min(0).max(1_000_000), status: z.enum(["open", "limited", "closed"]) })).mutation(async ({ input, ctx }) => {
      if (input.occupancy > input.capacity && input.capacity > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Occupancy cannot exceed capacity." });
      const db = await database();
      const existing = (await db.select().from(shelters).where(eq(shelters.id, input.id)).limit(1))[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Shelter not found." });
      await db.update(shelters).set({ name: input.name, address: input.address, latitude: input.latitude, longitude: input.longitude, capacity: input.capacity, occupancy: input.occupancy, status: input.status }).where(eq(shelters.id, input.id));
      await writeAudit(ctx.user.id, "shelter.update", "shelter", input.id, input.name);
      return { success: true };
    }),
    addHospital: adminProcedure.input(hospitalInput).mutation(async ({ input, ctx }) => {
      if (!hasValidHospitalCapacity(input.totalEmergencyBeds, input.availableEmergencyBeds, input.totalIcuBeds, input.availableIcuBeds)) throw new TRPCError({ code: "BAD_REQUEST", message: "Available beds cannot exceed the declared hospital capacity." });
      const db = await database();
      const result = await db.insert(hospitals).values({ ...input, contactPhone: input.contactPhone ?? null, updatedBy: ctx.user.id });
      await writeAudit(ctx.user.id, "hospital.create", "hospital", Number(result[0].insertId), input.name);
      return { id: Number(result[0].insertId) };
    }),
    updateHospital: adminProcedure.input(hospitalInput.extend({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      if (!hasValidHospitalCapacity(input.totalEmergencyBeds, input.availableEmergencyBeds, input.totalIcuBeds, input.availableIcuBeds)) throw new TRPCError({ code: "BAD_REQUEST", message: "Available beds cannot exceed the declared hospital capacity." });
      const db = await database();
      const existing = (await db.select().from(hospitals).where(eq(hospitals.id, input.id)).limit(1))[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Hospital not found." });
      await db.update(hospitals).set({ ...input, contactPhone: input.contactPhone ?? null, updatedBy: ctx.user.id }).where(eq(hospitals.id, input.id));
      await writeAudit(ctx.user.id, "hospital.update", "hospital", input.id, input.name);
      return { success: true };
    }),
    addFloodZone: adminProcedure.input(z.object({ name: z.string().trim().min(2).max(180), severity: severitySchema, points: z.array(pointSchema).min(3).max(200) })).mutation(async ({ input, ctx }) => {
      const db = await database();
      const result = await db.insert(floodZones).values({ name: input.name, severity: input.severity, polygonJson: JSON.stringify(input.points), createdBy: ctx.user.id, active: "yes" });
      await writeAudit(ctx.user.id, "floodZone.create", "floodZone", Number(result[0].insertId), input.name);
      return { id: Number(result[0].insertId) };
    }),
  }),

  rescuer: router({
    requestRegistration: protectedProcedure.input(z.object({ phone: z.string().trim().max(32).optional(), note: z.string().trim().max(1000).optional() })).mutation(async ({ input, ctx }) => {
      if (!canRequestRescuerRegistration(ctx.user.role)) throw new TRPCError({ code: "BAD_REQUEST", message: ctx.user.role === "rescuer" ? "This account is already an authorized rescuer." : "Administrator accounts cannot request rescuer access." });
      const db = await database();
      const existing = (await db.select().from(rescuerRegistrationRequests).where(eq(rescuerRegistrationRequests.userId, ctx.user.id)).limit(1))[0];
      if (existing?.status === "pending") throw new TRPCError({ code: "CONFLICT", message: "Your rescuer registration is already awaiting administrator review." });
      if (existing) await db.update(rescuerRegistrationRequests).set({ phone: input.phone ?? null, note: input.note ?? null, status: "pending", reviewedBy: null, reviewedAt: null, reviewNote: null }).where(eq(rescuerRegistrationRequests.id, existing.id));
      else await db.insert(rescuerRegistrationRequests).values({ userId: ctx.user.id, phone: input.phone ?? null, note: input.note ?? null, status: "pending" });
      await writeAudit(ctx.user.id, "rescuerRegistration.request", "rescuerRegistration", existing?.id, input.note ?? null);
      return { success: true };
    }),
    profile: rescuerProcedure.query(({ ctx }) => getRescuerProfile(ctx.user.id)),
    missions: rescuerProcedure.query(({ ctx }) => listMissionsForRescuer(ctx.user.id)),
    notifications: rescuerProcedure.query(async ({ ctx }) => ({ items: await listNotificationFeed(ctx.user.id), unread: await unreadNotificationCount(ctx.user.id) })),
    pushConfig: rescuerProcedure.query(() => ({ enabled: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT), publicKey: process.env.VAPID_PUBLIC_KEY ?? null })),
    subscribePush: rescuerProcedure.input(z.object({ endpoint: z.string().url().max(4096), p256dh: z.string().min(20).max(512), auth: z.string().min(10).max(512) })).mutation(async ({ input, ctx }) => {
      const db = await database();
      const endpointHash = createHash("sha256").update(input.endpoint).digest("hex");
      await db.insert(pushSubscriptions).values({ userId: ctx.user.id, endpointHash, endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth }).onDuplicateKeyUpdate({ set: { userId: ctx.user.id, endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth, updatedAt: new Date() } });
      await writeAudit(ctx.user.id, "push.subscribe", "pushSubscription", endpointHash);
      return { success: true };
    }),
    setAvailability: rescuerProcedure.input(z.object({ availability: z.enum(["available", "on_mission", "off_duty"]), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional() })).mutation(async ({ input, ctx }) => {
      const db = await database();
      const profile = await getRescuerProfile(ctx.user.id);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Rescuer profile not found." });
      const hasOpenMission = (await listMissionsForRescuer(ctx.user.id)).some(({ mission }) => mission.status !== "resolved");
      if (hasOpenMission && input.availability === "off_duty") throw new TRPCError({ code: "BAD_REQUEST", message: "Resolve or hand off your active mission before going off duty." });
      await db.update(rescueProfiles).set({ availability: input.availability, lastLatitude: input.latitude ?? profile.lastLatitude, lastLongitude: input.longitude ?? profile.lastLongitude }).where(eq(rescueProfiles.userId, ctx.user.id));
      await writeAudit(ctx.user.id, "rescuer.availability", "rescueProfile", profile.id, input.availability);
      return { success: true };
    }),
    updateMission: rescuerProcedure.input(z.object({ missionId: z.number().int().positive(), status: z.enum(["dispatched", "resolved"]), notes: z.string().trim().max(2000).optional() })).mutation(async ({ input, ctx }) => {
      const db = await database();
      const mission = await getMissionForRescuer(input.missionId, ctx.user.id);
      if (!mission) throw new TRPCError({ code: "NOT_FOUND", message: "Assigned mission not found." });
      const allowed = isAllowedMissionTransition(mission.status, input.status);
      if (!allowed) throw new TRPCError({ code: "BAD_REQUEST", message: "Mission status must progress from Pending to Dispatched to Resolved." });
      const now = new Date();
      await db.update(missions).set({ status: input.status, notes: input.notes ?? mission.notes, ...(input.status === "dispatched" ? { dispatchedAt: now } : { resolvedAt: now }) }).where(eq(missions.id, mission.id));
      await db.update(incidents).set({ status: input.status, ...(input.status === "dispatched" ? { dispatchedAt: now } : { resolvedAt: now }) }).where(eq(incidents.id, mission.incidentId));
      if (input.status === "resolved") await db.update(rescueProfiles).set({ availability: "available" }).where(eq(rescueProfiles.userId, ctx.user.id));
      await addIncidentEvent(mission.incidentId, ctx.user.id, `mission_${input.status}`, input.status === "dispatched" ? "Rescuer dispatched" : "Rescue resolved", input.notes ?? null);
      await writeAudit(ctx.user.id, "mission.update", "mission", mission.id, input.status);
      return { success: true };
    }),
    markNotificationRead: rescuerProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const db = await database();
      await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, input.notificationId), eq(notifications.recipientId, ctx.user.id)));
      await writeAudit(ctx.user.id, "notification.read", "notification", input.notificationId);
      return { success: true };
    }),
  }),
});
