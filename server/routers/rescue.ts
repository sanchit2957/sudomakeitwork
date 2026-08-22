import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { floodZones, guestEmergencyRateLimits, hospitals, incidentMessages, incidents, missions, notifications, pushSubscriptions, rescueProfiles, rescuerRegistrationRequests, safetyAssistanceRequests, shelters, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { notifyOwner } from "../_core/notification";
import { getOfficialAssamRiverGauge } from "../assam-river-gauge";
import { adminProcedure, medicalOperationsProcedure, operationalProcedure, protectedProcedure, publicProcedure, rescuerProcedure, router } from "../_core/trpc";
import {
  addIncidentEvent,
  getActiveAssignedRescuerForIncident,
  getAnalytics,
  getIncidentMessages,
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
import { mayEditPostAlertDetails } from "../post-alert-details.policy";
import { mayShareLiveMissionLocation, presentAssignedRescuerToVictim } from "../rescuer-profile.policy";
import { canHandleSafetyAssistance, canTransitionSafetyAssistance, isSafetyRequestOwnedBy, visibleSafetyCategoriesForRole } from "../safety-assistance.policy";
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

function readProfilePhoto(dataUrl?: string | null) {
  if (!dataUrl) return null;
  const image = readEvidence(dataUrl);
  if (!image) return null;
  if (image.bytes.byteLength > 1_000_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Profile photos must be 1 MB or smaller." });
  return image;
}

function readVoiceNote(dataUrl?: string, durationSeconds?: number) {
  if (!dataUrl) return null;
  const matched = /^data:(audio\/(?:webm|ogg|mp4))(?:;codecs=[A-Za-z0-9._-]+)?;base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!matched) throw new TRPCError({ code: "BAD_REQUEST", message: "Voice notes must be recorded as WebM, OGG, or M4A audio." });
  const bytes = Buffer.from(matched[2].replace(/\s/g, ""), "base64");
  if (bytes.byteLength > 3_000_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Voice notes must be 3 MB or smaller." });
  if (!durationSeconds || durationSeconds < 1 || durationSeconds > 120) throw new TRPCError({ code: "BAD_REQUEST", message: "Voice notes must be between 1 second and 2 minutes." });
  const extension = matched[1] === "audio/ogg" ? "ogg" : matched[1] === "audio/mp4" ? "m4a" : "webm";
  return { bytes, contentType: matched[1], extension, durationSeconds };
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
    conditions: publicProcedure.input(z.object({ latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional() }).optional()).query(async ({ input }) => {
      const latitude = input?.latitude ?? 26.1445;
      const longitude = input?.longitude ?? 91.7362;
      const db = await database();
      const activeZones = await db.select({ id: floodZones.id, severity: floodZones.severity }).from(floodZones).where(eq(floodZones.active, "yes"));
      const river = await getOfficialAssamRiverGauge(latitude, longitude);
      try {
        const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
        endpoint.searchParams.set("latitude", String(latitude));
        endpoint.searchParams.set("longitude", String(longitude));
        endpoint.searchParams.set("current", "temperature_2m,precipitation,weather_code,wind_speed_10m");
        endpoint.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code,wind_speed_10m_max");
        endpoint.searchParams.set("past_days", "7");
        endpoint.searchParams.set("forecast_days", "7");
        endpoint.searchParams.set("timezone", "auto");
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(8_000), headers: { accept: "application/json" } });
        if (!response.ok) throw new Error(`Weather source responded ${response.status}`);
        const weather = await response.json() as { current?: { temperature_2m?: number; precipitation?: number; weather_code?: number; wind_speed_10m?: number }; daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[]; precipitation_sum?: number[]; weather_code?: number[]; wind_speed_10m_max?: number[] } };
        const rainChance = weather.daily?.precipitation_probability_max?.[0] ?? null;
        const rainAmount = weather.daily?.precipitation_sum?.[0] ?? null;
        const risk = rainChance !== null && (rainChance >= 80 || (rainAmount ?? 0) >= 40) ? "high" : rainChance !== null && (rainChance >= 50 || (rainAmount ?? 0) >= 15) ? "elevated" : "normal";
        const daily = weather.daily;
        const dailyRows = (daily?.time || []).map((date, index) => ({ date, temperatureHighC: daily?.temperature_2m_max?.[index] ?? null, temperatureLowC: daily?.temperature_2m_min?.[index] ?? null, rainChance: daily?.precipitation_probability_max?.[index] ?? null, rainMm: daily?.precipitation_sum?.[index] ?? null, windKmh: daily?.wind_speed_10m_max?.[index] ?? null, weatherCode: daily?.weather_code?.[index] ?? null }));
        const forecastDays = dailyRows.slice(-7);
        const trendDays = dailyRows.slice(0, Math.max(0, dailyRows.length - 7)).slice(-7);
        return { available: true, source: "Open-Meteo weather model", updatedAt: new Date(), risk, activeFloodZones: activeZones.length, current: { temperatureC: weather.current?.temperature_2m ?? null, precipitationMm: weather.current?.precipitation ?? null, windKmh: weather.current?.wind_speed_10m ?? null, weatherCode: weather.current?.weather_code ?? null }, forecast: { rainChance, rainAmountMm: rainAmount, days: forecastDays }, trend: { source: "Modelled daily weather history", days: trendDays }, river };
      } catch {
        return { available: false, source: "Weather source unavailable", updatedAt: new Date(), risk: "unknown" as const, activeFloodZones: activeZones.length, current: { temperatureC: null, precipitationMm: null, windKmh: null, weatherCode: null }, forecast: { rainChance: null, rainAmountMm: null }, river };
      }
    }),
    create: protectedProcedure
      .input(z.object({
        contactName: z.string().trim().max(160).optional(),
        locationLabel: z.string().trim().min(3).max(360),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        emergencyType: z.enum(["flood", "medical", "trapped", "evacuation", "other"]),
        helpNeeds: z.string().trim().max(1000).optional(),
        severity: severitySchema,
        peopleAffected: z.number().int().min(1).max(500),
        notes: z.string().trim().max(2000).optional(),
        evidenceDataUrl: z.string().max(2_100_000).optional(),
        voiceNoteDataUrl: z.string().max(4_200_000).optional(),
        voiceNoteDurationSeconds: z.number().int().min(1).max(120).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await database();
        const publicCode = `SOS-${incidentCode()}`;
        const evidence = readEvidence(input.evidenceDataUrl);
        const voiceNote = readVoiceNote(input.voiceNoteDataUrl, input.voiceNoteDurationSeconds);
        let uploadedEvidence: { key: string; url: string } | null = null;
        let uploadedVoiceNote: { key: string; url: string } | null = null;
        if (evidence) uploadedEvidence = await storagePut(`incidents/${publicCode}/evidence.${evidence.extension}`, evidence.bytes, evidence.contentType);
        if (voiceNote) uploadedVoiceNote = await storagePut(`incidents/${publicCode}/voice-note.${voiceNote.extension}`, voiceNote.bytes, voiceNote.contentType);
        const result = await db.insert(incidents).values({
          publicCode,
          reporterId: ctx.user.id,
          contactName: input.contactName ?? null,
          locationLabel: input.locationLabel,
          latitude: input.latitude,
          longitude: input.longitude,
          emergencyType: input.emergencyType,
          helpNeeds: input.helpNeeds ?? null,
          severity: input.severity,
          peopleAffected: input.peopleAffected,
          notes: input.notes ?? null,
          evidenceKey: uploadedEvidence?.key ?? null,
          evidenceUrl: uploadedEvidence?.url ?? null,
          voiceNoteKey: uploadedVoiceNote?.key ?? null,
          voiceNoteUrl: uploadedVoiceNote?.url ?? null,
          voiceNoteDurationSeconds: voiceNote?.durationSeconds ?? null,
          status: "pending",
        });
        const incidentId = Number(result[0].insertId);
        await addIncidentEvent(incidentId, ctx.user.id, "sos_created", "SOS received", "Awaiting dispatch from the emergency operations team.");
        await writeAudit(ctx.user.id, "incident.create", "incident", incidentId, `Created ${publicCode}`);
        await emitIncidentAlerts(incidentId, publicCode, input.locationLabel, input.severity, input.latitude, input.longitude);
        return { incidentId, publicCode, status: "pending" as const };
      }),
    statusByCode: publicProcedure.input(z.object({ publicCode: z.string().trim().toUpperCase().regex(/^SOS-[A-Z0-9]{8}$/) })).query(async ({ input }) => {
      const incident = await getIncidentByCode(input.publicCode);
      if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "No SOS request matches this tracking code." });
      const [events, assigned] = await Promise.all([getIncidentTimeline(incident.id), getActiveAssignedRescuerForIncident(incident.id)]);
      const profile = assigned?.profile;
      return {
        publicCode: incident.publicCode,
        status: incident.status,
        locationLabel: incident.locationLabel,
        severity: incident.severity,
        createdAt: incident.createdAt,
        dispatchedAt: incident.dispatchedAt,
        resolvedAt: incident.resolvedAt,
        events,
        assignedRescuer: !assigned || !profile ? null : presentAssignedRescuerToVictim({ ...profile, name: assigned.user.name }),
      };
    }),
    myDetailsByCode: protectedProcedure.input(z.object({ publicCode: z.string().trim().toUpperCase().regex(/^SOS-[A-Z0-9]{8}$/) })).query(async ({ input, ctx }) => {
      const incident = await getIncidentByCode(input.publicCode);
      if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "No SOS request matches this tracking code." });
      if (!mayEditPostAlertDetails(incident.reporterId, ctx.user.id, incident.status)) throw new TRPCError({ code: incident.reporterId !== ctx.user.id ? "FORBIDDEN" : "BAD_REQUEST", message: incident.reporterId !== ctx.user.id ? "Only the SOS reporter can view these request details." : "This SOS has already been resolved." });
      return { publicCode: incident.publicCode, status: incident.status, peopleAffected: incident.peopleAffected, emergencyType: incident.emergencyType, helpNeeds: incident.helpNeeds, notes: incident.notes, contactName: incident.contactName };
    }),
    updateMyDetails: protectedProcedure.input(z.object({ publicCode: z.string().trim().toUpperCase().regex(/^SOS-[A-Z0-9]{8}$/), peopleAffected: z.number().int().min(1).max(500), emergencyType: z.enum(["flood", "medical", "trapped", "evacuation", "other"]), helpNeeds: z.string().trim().max(1000).optional(), notes: z.string().trim().max(2000).optional(), contactName: z.string().trim().max(160).optional() })).mutation(async ({ input, ctx }) => {
      const incident = await getIncidentByCode(input.publicCode);
      if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "No SOS request matches this tracking code." });
      if (!mayEditPostAlertDetails(incident.reporterId, ctx.user.id, incident.status)) throw new TRPCError({ code: incident.reporterId !== ctx.user.id ? "FORBIDDEN" : "BAD_REQUEST", message: incident.reporterId !== ctx.user.id ? "Only the SOS reporter can update this request." : "This SOS has already been resolved." });
      const db = await database();
      await db.update(incidents).set({ peopleAffected: input.peopleAffected, emergencyType: input.emergencyType, helpNeeds: input.helpNeeds || null, notes: input.notes || null, contactName: input.contactName || null }).where(eq(incidents.id, incident.id));
      await addIncidentEvent(incident.id, ctx.user.id, "victim_details_updated", "Victim updated request details", "People count, help needs, or notes were added after SOS activation.");
      await writeAudit(ctx.user.id, "incident.update_details", "incident", incident.id, `Updated post-alert details for ${incident.publicCode}`);
      return { success: true };
    }),
    chatByCode: publicProcedure.input(z.object({ publicCode: z.string().trim().toUpperCase().regex(/^SOS-[A-Z0-9]{8}$/) })).query(async ({ input }) => {
      const incident = await getIncidentByCode(input.publicCode);
      if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "No SOS request matches this tracking code." });
      return getIncidentMessages(incident.id);
    }),
    sendChat: protectedProcedure.input(z.object({ publicCode: z.string().trim().toUpperCase().regex(/^SOS-[A-Z0-9]{8}$/), message: z.string().trim().min(1).max(500) })).mutation(async ({ input, ctx }) => {
      const incident = await getIncidentByCode(input.publicCode);
      if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "No SOS request matches this tracking code." });
      if (incident.reporterId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the SOS reporter can send a victim message." });
      if (incident.status === "resolved") throw new TRPCError({ code: "BAD_REQUEST", message: "This SOS has already been resolved." });
      const db = await database();
      const result = await db.insert(incidentMessages).values({ incidentId: incident.id, authorType: "victim", authorId: ctx.user.id, message: input.message });
      return { id: Number(result[0].insertId) };
    }),
    mine: protectedProcedure.query(({ ctx }) => listIncidentsForReporter(ctx.user.id)),
  }),

  safety: router({
    resources: publicProcedure.query(async () => {
      const db = await database();
      const [shelterRows, hospitalRows] = await Promise.all([
        db.select({ id: shelters.id, name: shelters.name, address: shelters.address, latitude: shelters.latitude, longitude: shelters.longitude, capacity: shelters.capacity, occupancy: shelters.occupancy, status: shelters.status }).from(shelters).where(and(eq(shelters.status, "open"))),
        db.select({ id: hospitals.id, name: hospitals.name, address: hospitals.address, latitude: hospitals.latitude, longitude: hospitals.longitude, totalEmergencyBeds: hospitals.totalEmergencyBeds, availableEmergencyBeds: hospitals.availableEmergencyBeds, totalIcuBeds: hospitals.totalIcuBeds, availableIcuBeds: hospitals.availableIcuBeds, oxygenCylinderCount: hospitals.oxygenCylinderCount, bloodUnitCount: hospitals.bloodUnitCount, ambulanceCount: hospitals.ambulanceCount, status: hospitals.status, updatedAt: hospitals.updatedAt }).from(hospitals).where(and(eq(hospitals.status, "open"))),
      ]);
      return { shelters: shelterRows, hospitals: hospitalRows };
    }),
    createRequest: protectedProcedure.input(z.object({ category: z.enum(["shelter", "food", "medical", "protection"]), peopleAffected: z.number().int().min(1).max(500), details: z.string().trim().max(1000).optional(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })).mutation(async ({ input, ctx }) => {
      const db = await database();
      const result = await db.insert(safetyAssistanceRequests).values({ requesterId: ctx.user.id, category: input.category, peopleAffected: input.peopleAffected, details: input.details || null, latitude: input.latitude, longitude: input.longitude });
      const requestId = Number(result[0].insertId);
      await writeAudit(ctx.user.id, "safety.request.create", "safetyAssistanceRequest", requestId, `Requested ${input.category} assistance`);
      return { id: requestId, status: "new" as const };
    }),
    mine: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      const rows = await db.select().from(safetyAssistanceRequests).where(eq(safetyAssistanceRequests.requesterId, ctx.user.id)).orderBy(desc(safetyAssistanceRequests.createdAt));
      return rows.filter(row => isSafetyRequestOwnedBy(row.requesterId, ctx.user.id));
    }),
    queue: operationalProcedure.query(async ({ ctx }) => {
      const db = await database();
      const categories = ctx.user.role === "user" ? [] : visibleSafetyCategoriesForRole(ctx.user.role);
      const where = categories.length === 1 ? and(eq(safetyAssistanceRequests.category, categories[0])) : undefined;
      return db.select({ id: safetyAssistanceRequests.id, category: safetyAssistanceRequests.category, peopleAffected: safetyAssistanceRequests.peopleAffected, details: safetyAssistanceRequests.details, latitude: safetyAssistanceRequests.latitude, longitude: safetyAssistanceRequests.longitude, status: safetyAssistanceRequests.status, createdAt: safetyAssistanceRequests.createdAt, requesterName: users.name }).from(safetyAssistanceRequests).leftJoin(users, eq(safetyAssistanceRequests.requesterId, users.id)).where(where).orderBy(desc(safetyAssistanceRequests.createdAt));
    }),
    updateStatus: operationalProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["acknowledged", "resolved"]) })).mutation(async ({ input, ctx }) => {
      const db = await database();
      const request = (await db.select().from(safetyAssistanceRequests).where(eq(safetyAssistanceRequests.id, input.id)).limit(1))[0];
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Safety assistance request not found." });
      if (ctx.user.role === "user" || !canHandleSafetyAssistance(ctx.user.role, request.category)) throw new TRPCError({ code: "FORBIDDEN", message: "This account cannot update that safety assistance request." });
      if (!canTransitionSafetyAssistance(request.status, input.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Safety assistance requests must be acknowledged before they can be resolved." });
      await db.update(safetyAssistanceRequests).set({ status: input.status, reviewedBy: ctx.user.id, reviewedAt: new Date() }).where(eq(safetyAssistanceRequests.id, input.id));
      await writeAudit(ctx.user.id, "safety.request.update", "safetyAssistanceRequest", input.id, `Marked ${input.status}`);
      return { success: true };
    }),
  }),

  operations: router({
    incidents: adminProcedure.input(z.object({ status: missionStatusSchema.optional() }).optional()).query(({ input }) => listIncidents(input?.status)),
    analytics: adminProcedure.query(() => getAnalytics()),
    mapLayers: operationalProcedure.query(({ ctx }) => getMapLayers(ctx.user.role !== "user")),
    hospitals: medicalOperationsProcedure.query(() => listHospitals()),
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
    promoteMedical: adminProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const db = await database();
      const target = (await db.select().from(users).where(eq(users.id, input.userId)).limit(1))[0];
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      if (target.role !== "user") throw new TRPCError({ code: "BAD_REQUEST", message: "Only a standard signed-in user can be authorized as medical staff." });
      await db.update(users).set({ role: "medical" }).where(eq(users.id, input.userId));
      await writeAudit(ctx.user.id, "medical.promote", "user", input.userId, "Authorized medical operations access");
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
      await db.update(rescueProfiles).set({ availability: "on_mission", locationSharing: "no", lastLatitude: null, lastLongitude: null, locationUpdatedAt: null }).where(eq(rescueProfiles.userId, input.rescuerId));
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
    addHospital: medicalOperationsProcedure.input(hospitalInput).mutation(async ({ input, ctx }) => {
      if (!hasValidHospitalCapacity(input.totalEmergencyBeds, input.availableEmergencyBeds, input.totalIcuBeds, input.availableIcuBeds)) throw new TRPCError({ code: "BAD_REQUEST", message: "Available beds cannot exceed the declared hospital capacity." });
      const db = await database();
      const result = await db.insert(hospitals).values({ ...input, contactPhone: input.contactPhone ?? null, updatedBy: ctx.user.id });
      await writeAudit(ctx.user.id, "hospital.create", "hospital", Number(result[0].insertId), input.name);
      return { id: Number(result[0].insertId) };
    }),
    updateHospital: medicalOperationsProcedure.input(hospitalInput.extend({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
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
      if (!canRequestRescuerRegistration(ctx.user.role)) throw new TRPCError({ code: "BAD_REQUEST", message: ctx.user.role === "rescuer" ? "This account is already an authorized rescuer." : ctx.user.role === "medical" ? "Medical staff accounts cannot request field-rescuer access." : "Administrator accounts cannot request rescuer access." });
      const db = await database();
      const existing = (await db.select().from(rescuerRegistrationRequests).where(eq(rescuerRegistrationRequests.userId, ctx.user.id)).limit(1))[0];
      if (existing?.status === "pending") throw new TRPCError({ code: "CONFLICT", message: "Your rescuer registration is already awaiting administrator review." });
      if (existing) await db.update(rescuerRegistrationRequests).set({ phone: input.phone ?? null, note: input.note ?? null, status: "pending", reviewedBy: null, reviewedAt: null, reviewNote: null }).where(eq(rescuerRegistrationRequests.id, existing.id));
      else await db.insert(rescuerRegistrationRequests).values({ userId: ctx.user.id, phone: input.phone ?? null, note: input.note ?? null, status: "pending" });
      await writeAudit(ctx.user.id, "rescuerRegistration.request", "rescuerRegistration", existing?.id, input.note ?? null);
      return { success: true };
    }),
    profile: rescuerProcedure.query(({ ctx }) => getRescuerProfile(ctx.user.id)),
    missionMessages: rescuerProcedure.input(z.object({ missionId: z.number().int().positive() })).query(async ({ input, ctx }) => {
      const mission = await getMissionForRescuer(input.missionId, ctx.user.id);
      if (!mission) throw new TRPCError({ code: "FORBIDDEN", message: "This mission is not assigned to your account." });
      return getIncidentMessages(mission.incidentId);
    }),
    sendMissionMessage: rescuerProcedure.input(z.object({ missionId: z.number().int().positive(), message: z.string().trim().min(1).max(500) })).mutation(async ({ input, ctx }) => {
      const mission = await getMissionForRescuer(input.missionId, ctx.user.id);
      if (!mission) throw new TRPCError({ code: "FORBIDDEN", message: "This mission is not assigned to your account." });
      if (mission.status === "resolved") throw new TRPCError({ code: "BAD_REQUEST", message: "This mission has already been resolved." });
      const db = await database();
      const result = await db.insert(incidentMessages).values({ incidentId: mission.incidentId, authorType: "rescuer", authorId: ctx.user.id, message: input.message });
      return { id: Number(result[0].insertId) };
    }),
    updateProfile: rescuerProcedure.input(z.object({
      phone: z.string().trim().max(32).nullable().optional(),
      contactSharing: z.enum(["yes", "no"]).optional(),
      photoDataUrl: z.string().max(1_500_000).nullable().optional(),
      clearPhoto: z.boolean().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await database();
      const profile = await getRescuerProfile(ctx.user.id);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Rescuer profile not found." });
      const resultingPhone = input.phone !== undefined ? input.phone : profile.phone;
      if (input.contactSharing === "yes" && !resultingPhone) throw new TRPCError({ code: "BAD_REQUEST", message: "Add a contact number before enabling assignment contact sharing." });
      const photo = readProfilePhoto(input.photoDataUrl);
      const uploaded = photo ? await storagePut(`rescuers/${ctx.user.id}/profile.${photo.extension}`, photo.bytes, photo.contentType) : null;
      await db.update(rescueProfiles).set({
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.contactSharing ? { contactSharing: input.contactSharing } : {}),
        ...(input.clearPhoto ? { photoKey: null, photoUrl: null } : {}),
        ...(uploaded ? { photoKey: uploaded.key, photoUrl: uploaded.url } : {}),
      }).where(eq(rescueProfiles.userId, ctx.user.id));
      await writeAudit(ctx.user.id, "rescuer.profile.update", "rescueProfile", profile.id, input.clearPhoto ? "Cleared profile photo" : uploaded ? "Updated profile photo" : "Updated profile sharing preferences");
      return { success: true };
    }),
    setLocationSharing: rescuerProcedure.input(z.object({ enabled: z.boolean() })).mutation(async ({ input, ctx }) => {
      const db = await database();
      const profile = await getRescuerProfile(ctx.user.id);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Rescuer profile not found." });
      const hasOpenMission = (await listMissionsForRescuer(ctx.user.id)).some(({ mission }) => mission.status !== "resolved");
      if (input.enabled && !mayShareLiveMissionLocation(hasOpenMission, input.enabled)) throw new TRPCError({ code: "BAD_REQUEST", message: "Live location can only be shared during an active assigned mission." });
      await db.update(rescueProfiles).set(input.enabled ? { locationSharing: "yes" } : { locationSharing: "no", lastLatitude: null, lastLongitude: null, locationUpdatedAt: null }).where(eq(rescueProfiles.userId, ctx.user.id));
      await writeAudit(ctx.user.id, "rescuer.locationSharing", "rescueProfile", profile.id, input.enabled ? "Enabled for active mission" : "Disabled and cleared");
      return { success: true };
    }),
    updateLiveLocation: rescuerProcedure.input(z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })).mutation(async ({ input, ctx }) => {
      const db = await database();
      const profile = await getRescuerProfile(ctx.user.id);
      if (!profile || profile.locationSharing !== "yes") throw new TRPCError({ code: "FORBIDDEN", message: "Enable live location sharing before sending a location update." });
      const hasOpenMission = (await listMissionsForRescuer(ctx.user.id)).some(({ mission }) => mission.status !== "resolved");
      if (!hasOpenMission) throw new TRPCError({ code: "FORBIDDEN", message: "Live location sharing is only available during an active assigned mission." });
      await db.update(rescueProfiles).set({ lastLatitude: input.latitude, lastLongitude: input.longitude, locationUpdatedAt: new Date() }).where(eq(rescueProfiles.userId, ctx.user.id));
      return { success: true };
    }),
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
      if (input.status === "resolved") await db.update(rescueProfiles).set({ availability: "available", locationSharing: "no", lastLatitude: null, lastLongitude: null, locationUpdatedAt: null }).where(eq(rescueProfiles.userId, ctx.user.id));
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
