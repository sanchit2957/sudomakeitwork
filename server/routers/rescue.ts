import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { and, desc, eq, or } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import {
  auditLogs,
  floodZones,
  guestEmergencyRateLimits,
  hospitalCaseNotifications,
  hospitalRegistrationRequests,
  hospitalStaffProfiles,
  hospitals,
  incidentMessages,
  incidents,
  missions,
  notifications,
  pushSubscriptions,
  rescueProfiles,
  rescuerRegistrationRequests,
  safetyAssistanceRequests,
  shelters,
  users,
} from "../../drizzle/schema";
import { getDb, getEmergencyContactsByUserId, upsertEmergencyContact, deleteEmergencyContact, getUserByOpenId, getUserById, upsertUser, getAllUsers } from "../db";
import { notifyOwner } from "../_core/notification";
import { getOfficialAssamRiverGauge } from "../assam-river-gauge";
import { ASSAM_DISTRICT_LOCATIONS, getComprehensiveWeather, weatherProviderManager } from "../weather.service";
import {
  adminProcedure,
  medicalOperationsProcedure,
  operationalProcedure,
  protectedProcedure,
  publicProcedure,
  rescuerProcedure,
  router,
} from "../_core/trpc";
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
  createHospitalCaseNotification,
  listHospitalCaseNotifications,
  updateHospitalCaseStatus,
  writeAudit,
  nextIncidentId,
  nextMissionId,
  nextSafetyRequestId,
  nextShelterId,
  nextHospitalId,
  nextFloodZoneId,
  nextRescuerRequestId,
  nextHospitalRequestId,
  nextHospitalStaffId,
  nextRescueProfileId,
  _memoryIncidents,
  _memoryMissions,
  _memoryRescueProfiles,
  _memoryShelters,
  _memoryHospitals,
  _memoryFloodZones,
  _memorySafetyRequests,
  _memoryNotifications,
  _memoryAuditLogs,
  _memoryRescuerRequests,
  _memoryHospitalRequests,
  _memoryHospitalStaffProfiles,
  _memoryIncidentMessages,
  _memoryIncidentEvents,
  _memoryUsers,
} from "../rescue.db";
import { storagePut } from "../storage";
import { getGuestSosRateLimitDecision, isAllowedMissionTransition } from "../rescue.policy";
import { hasValidHospitalCapacity } from "../hospital.policy";
import { canEditHospitalResources, canRequestHospitalRegistration } from "../hospital-registration.policy";
import { canRequestRescuerRegistration, requiresCallSign } from "../registration.policy";
import { mayEditPostAlertDetails } from "../post-alert-details.policy";
import { presentAssignedRescuerToVictim } from "../rescuer-profile.policy";
import {
  canHandleSafetyAssistance,
  canTransitionSafetyAssistance,
  isSafetyRequestOwnedBy,
  visibleSafetyCategoriesForRole,
} from "../safety-assistance.policy";
import { sendRescuerPush } from "../push";

const incidentCode = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);
const severitySchema = z.enum(["critical", "high", "medium", "low"]);
const missionStatusSchema = z.enum(["pending", "dispatched", "resolved"]);
const hospitalStatusSchema = z.enum(["open", "limited", "critical", "closed"]);
const supplyStatusSchema = z.enum(["available", "limited", "critical", "unavailable"]);
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
  foodSupplyStatus: supplyStatusSchema.default("available"),
  medicineSupplyStatus: supplyStatusSchema.default("available"),
  waterSupplyStatus: supplyStatusSchema.default("available"),
  powerBackupStatus: supplyStatusSchema.default("available"),
  status: hospitalStatusSchema,
});
const hospitalRegistrationInput = z.object({
  hospitalName: z.string().trim().min(2).max(180),
  address: z.string().trim().min(3).max(360),
  contactPhone: z.string().trim().min(5).max(32),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  note: z.string().trim().max(1000).optional(),
});

const _memoryGuestRateLimits = new Map<string, { requestCount: number; windowStartedAt: Date }>();

async function database() {
  return await getDb();
}

function readEvidence(dataUrl?: string) {
  if (!dataUrl) return null;
  const matched = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!matched) throw new TRPCError({ code: "BAD_REQUEST", message: "Evidence must be a PNG, JPEG, or WebP image." });
  const bytes = Buffer.from(matched[2].replace(/\s/g, ""), "base64");
  if (bytes.byteLength > 1_500_000)
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Evidence images must be 1.5 MB or smaller." });
  const extension = matched[1] === "image/png" ? "png" : matched[1] === "image/webp" ? "webp" : "jpg";
  return { bytes, contentType: matched[1], extension };
}

function readProfilePhoto(dataUrl?: string | null) {
  if (!dataUrl) return null;
  const image = readEvidence(dataUrl);
  if (!image) return null;
  if (image.bytes.byteLength > 1_000_000)
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Profile photos must be 1 MB or smaller." });
  return image;
}

function readVoiceNote(dataUrl?: string, durationSeconds?: number) {
  if (!dataUrl) return null;
  const matched = /^data:(audio\/(?:webm|ogg|mp4))(?:;codecs=[A-Za-z0-9._-]+)?;base64,([A-Za-z0-9+/=\s]+)$/.exec(
    dataUrl
  );
  if (!matched)
    throw new TRPCError({ code: "BAD_REQUEST", message: "Voice notes must be recorded as WebM, OGG, or M4A audio." });
  const bytes = Buffer.from(matched[2].replace(/\s/g, ""), "base64");
  if (bytes.byteLength > 3_000_000)
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Voice notes must be 3 MB or smaller." });
  if (!durationSeconds || durationSeconds < 1 || durationSeconds > 120)
    throw new TRPCError({ code: "BAD_REQUEST", message: "Voice notes must be between 1 second and 2 minutes." });
  const extension = matched[1] === "audio/ogg" ? "ogg" : matched[1] === "audio/mp4" ? "m4a" : "webm";
  return { bytes, contentType: matched[1], extension, durationSeconds };
}

async function emitIncidentAlerts(
  incidentId: number,
  publicCode: string,
  locationLabel: string,
  severity: "critical" | "high" | "medium" | "low",
  latitude: number,
  longitude: number
) {
  if (severity !== "critical" && severity !== "high") return;
  const nearbyRescuers = await getAvailableRescuersNear(latitude, longitude, 25);
  if (nearbyRescuers.length) {
    const db = await database();
    if (db) {
      try {
        await db.insert(notifications).values(
          nearbyRescuers.map(({ user }) => ({
            recipientId: user.id,
            incidentId,
            type: "priority_incident" as const,
            title: `${severity === "critical" ? "Critical" : "High-priority"} SOS nearby`,
            body: `${publicCode} reported at ${locationLabel}. Review the operations board.`,
          }))
        );
      } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
    }
    for (const { user } of nearbyRescuers) {
      _memoryNotifications.push({
        id: _memoryNotifications.length + 1,
        recipientId: user.id,
        incidentId,
        type: "priority_incident",
        title: `${severity === "critical" ? "Critical" : "High-priority"} SOS nearby`,
        body: `${publicCode} reported at ${locationLabel}. Review the operations board.`,
        readAt: null,
        createdAt: new Date(),
      });
    }
    try {
      await sendRescuerPush(
        nearbyRescuers.map(({ user }) => user.id),
        {
          title: `${severity === "critical" ? "Critical" : "High-priority"} SOS nearby`,
          body: `${publicCode} reported at ${locationLabel}. Review the operations board.`,
          incidentId,
          url: "/responder/alerts",
        }
      );
    } catch (pushErr) {
      console.warn("[Alerts] Rescuer push notification skipped:", pushErr);
    }
  }
  try {
    await notifyOwner({
      title: `${severity === "critical" ? "Critical" : "High-priority"} SOS: ${publicCode}`,
      content: `New SOS at ${locationLabel}. ${nearbyRescuers.length} nearby available rescuer(s) notified in-app.`,
    });
  } catch (ownerErr) {
    console.warn("[Alerts] Owner notification skipped:", ownerErr);
  }
}

async function enforceGuestSosRateLimit(guestKey: string) {
  const keyHash = createHash("sha256").update(guestKey).digest("hex");
  const now = new Date();
  const db = await database();
  if (db) {
    try {
      const existing = (
        await db.select().from(guestEmergencyRateLimits).where(eq(guestEmergencyRateLimits.keyHash, keyHash)).limit(1)
      )[0];
      if (!existing) {
        await db.insert(guestEmergencyRateLimits).values({ keyHash, windowStartedAt: now, requestCount: 1 });
        return;
      }
      const decision = getGuestSosRateLimitDecision(existing.requestCount, existing.windowStartedAt, now);
      if (decision.action === "reset") {
        await db
          .update(guestEmergencyRateLimits)
          .set({ windowStartedAt: now, requestCount: 1 })
          .where(eq(guestEmergencyRateLimits.id, existing.id));
        return;
      }
      if (decision.action === "reject") {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "Too many emergency reports from this device. Please contact emergency services if immediate danger persists.",
        });
      }
      await db
        .update(guestEmergencyRateLimits)
        .set({ requestCount: decision.requestCount })
        .where(eq(guestEmergencyRateLimits.id, existing.id));
      return;
    } catch (err) {
      if (err instanceof TRPCError) throw err;
    }
  }

  // In-memory rate limiting fallback
  const memExisting = _memoryGuestRateLimits.get(keyHash);
  if (!memExisting) {
    _memoryGuestRateLimits.set(keyHash, { windowStartedAt: now, requestCount: 1 });
    return;
  }
  const decision = getGuestSosRateLimitDecision(memExisting.requestCount, memExisting.windowStartedAt, now);
  if (decision.action === "reset") {
    _memoryGuestRateLimits.set(keyHash, { windowStartedAt: now, requestCount: 1 });
    return;
  }
  if (decision.action === "reject") {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "Too many emergency reports from this device. Please contact emergency services if immediate danger persists.",
    });
  }
  _memoryGuestRateLimits.set(keyHash, { windowStartedAt: memExisting.windowStartedAt, requestCount: decision.requestCount });
}

const _conditionsCache = new Map<string, { timestamp: number; data: any }>();
const _conditionsInFlight = new Map<string, Promise<any>>();

export const rescueRouter = router({
  emergency: router({
    conditions: publicProcedure
      .input(
        z
          .object({
            latitude: z.number().min(-90).max(90).optional(),
            longitude: z.number().min(-180).max(180).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const latitude = input?.latitude ?? 26.1445;
        const longitude = input?.longitude ?? 91.7362;
        const cacheKey = `${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
        const now = Date.now();

        // 1. Check in-memory fresh cache (3 minutes)
        const cached = _conditionsCache.get(cacheKey);
        if (cached && now - cached.timestamp < 3 * 60 * 1000) {
          return cached.data;
        }

        // 2. Deduplicate concurrent in-flight requests for identical coordinates
        if (_conditionsInFlight.has(cacheKey)) {
          return await _conditionsInFlight.get(cacheKey)!;
        }

        const fetchPromise = (async () => {
          const db = await database();
          let activeZones: Array<{ id: number; severity: string }> = [];
          if (db) {
            try {
              activeZones = await db
                .select({ id: floodZones.id, severity: floodZones.severity })
                .from(floodZones)
                .where(eq(floodZones.active, "yes"));
            } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
          } else {
            activeZones = Array.from(_memoryFloodZones.values())
              .filter(z => z.active === "yes")
              .map(z => ({ id: z.id, severity: z.severity }));
          }
          const river = await getOfficialAssamRiverGauge(latitude, longitude);
          try {
            const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
            endpoint.searchParams.set("latitude", String(latitude));
            endpoint.searchParams.set("longitude", String(longitude));
            endpoint.searchParams.set("current", "temperature_2m,precipitation,weather_code,wind_speed_10m");
            endpoint.searchParams.set(
              "daily",
              "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code,wind_speed_10m_max"
            );
            endpoint.searchParams.set("past_days", "7");
            endpoint.searchParams.set("forecast_days", "7");
            endpoint.searchParams.set("timezone", "auto");
            const response = await fetch(endpoint, {
              signal: AbortSignal.timeout(6_000),
              headers: { accept: "application/json" },
            });
            if (!response.ok) throw new Error(`Weather source responded ${response.status}`);
            const weather = (await response.json()) as {
              current?: { temperature_2m?: number; precipitation?: number; weather_code?: number; wind_speed_10m?: number };
              daily?: {
                time?: string[];
                temperature_2m_max?: number[];
                temperature_2m_min?: number[];
                precipitation_probability_max?: number[];
                precipitation_sum?: number[];
                weather_code?: number[];
                wind_speed_10m_max?: number[];
              };
            };
            const rainChance = weather.daily?.precipitation_probability_max?.[0] ?? null;
            const rainAmount = weather.daily?.precipitation_sum?.[0] ?? null;
            const risk =
              rainChance !== null && (rainChance >= 80 || (rainAmount ?? 0) >= 40)
                ? "high"
                : rainChance !== null && (rainChance >= 50 || (rainAmount ?? 0) >= 15)
                ? "elevated"
                : "normal";
            const daily = weather.daily;
            const dailyRows = (daily?.time || []).map((date, index) => ({
              date,
              temperatureHighC: daily?.temperature_2m_max?.[index] ?? null,
              temperatureLowC: daily?.temperature_2m_min?.[index] ?? null,
              rainChance: daily?.precipitation_probability_max?.[index] ?? null,
              rainMm: daily?.precipitation_sum?.[index] ?? null,
              windKmh: daily?.wind_speed_10m_max?.[index] ?? null,
              weatherCode: daily?.weather_code?.[index] ?? null,
            }));
            const forecastDays = dailyRows.slice(-7);
            const trendDays = dailyRows.slice(0, Math.max(0, dailyRows.length - 7)).slice(-7);
            const result = {
              available: true,
              source: "Open-Meteo weather model",
              updatedAt: new Date(),
              risk,
              activeFloodZones: activeZones.length,
              current: {
                temperatureC: weather.current?.temperature_2m ?? null,
                precipitationMm: weather.current?.precipitation ?? null,
                windKmh: weather.current?.wind_speed_10m ?? null,
                weatherCode: weather.current?.weather_code ?? null,
              },
              forecast: { rainChance, rainAmountMm: rainAmount, days: forecastDays },
              trend: { source: "Modelled daily weather history", days: trendDays },
              river,
            };

            // Maintain bounded cache size (<= 50 locations)
            if (_conditionsCache.size > 50) {
              const oldestKey = _conditionsCache.keys().next().value;
              if (oldestKey) _conditionsCache.delete(oldestKey);
            }
            _conditionsCache.set(cacheKey, { timestamp: Date.now(), data: result });
            return result;
          } catch {
            const fallback = {
              available: false,
              source: "Weather source unavailable",
              updatedAt: new Date(),
              risk: "unknown" as const,
              activeFloodZones: activeZones.length,
              current: { temperatureC: null, precipitationMm: null, windKmh: null, weatherCode: null },
              forecast: { rainChance: null, rainAmountMm: null },
              river,
            };
            return fallback;
          }
        })();

        _conditionsInFlight.set(cacheKey, fetchPromise);
        try {
          return await fetchPromise;
        } finally {
          _conditionsInFlight.delete(cacheKey);
        }
      }),
    create: protectedProcedure
      .input(
        z.object({
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
        })
      )
      .mutation(async ({ input, ctx }) => {
        const publicCode = `SOS-${incidentCode()}`;
        const evidence = readEvidence(input.evidenceDataUrl);
        const voiceNote = readVoiceNote(input.voiceNoteDataUrl, input.voiceNoteDurationSeconds);
        let uploadedEvidence: { key: string; url: string } | null = null;
        let uploadedVoiceNote: { key: string; url: string } | null = null;
        if (evidence)
          uploadedEvidence = await storagePut(
            `incidents/${publicCode}/evidence.${evidence.extension}`,
            evidence.bytes,
            evidence.contentType
          );
        if (voiceNote)
          uploadedVoiceNote = await storagePut(
            `incidents/${publicCode}/voice-note.${voiceNote.extension}`,
            voiceNote.bytes,
            voiceNote.contentType
          );
        let incidentId = nextIncidentId();
        const db = await database();
        if (db) {
          try {
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
            if (result && (result[0] as any)?.insertId) {
              incidentId = (result[0] as any).insertId;
            }
          } catch (err) {
            if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' });
            const { recordDbFailure } = await import("../db");
            recordDbFailure(err);
          }
        }
        _memoryIncidents.set(incidentId, {
          id: incidentId,
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
          assignedRescuerId: null,
          dispatchedAt: null,
          resolvedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await addIncidentEvent(
          incidentId,
          ctx.user.id,
          "sos_created",
          "SOS received",
          "Awaiting dispatch from the emergency operations team."
        );
        await writeAudit(ctx.user.id, "incident.create", "incident", incidentId, `Created ${publicCode}`);
        await emitIncidentAlerts(
          incidentId,
          publicCode,
          input.locationLabel,
          input.severity,
          input.latitude,
          input.longitude
        );
        return { incidentId, publicCode, status: "pending" as const };
      }),
    statusByCode: publicProcedure
      .input(z.object({ publicCode: z.string().trim().toUpperCase().regex(/^SOS-[A-Z0-9]{8}$/) }))
      .query(async ({ input }) => {
        const incident = await getIncidentByCode(input.publicCode);
        if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "No SOS request matches this tracking code." });
        const [events, assigned] = await Promise.all([
          getIncidentTimeline(incident.id),
          getActiveAssignedRescuerForIncident(incident.id),
        ]);
        const profile = assigned?.profile;
        return {
          publicCode: incident.publicCode,
          status: incident.status,
          locationLabel: incident.locationLabel,
          latitude: incident.latitude,
          longitude: incident.longitude,
          severity: incident.severity,
          createdAt: incident.createdAt,
          dispatchedAt: incident.dispatchedAt,
          resolvedAt: incident.resolvedAt,
          events,
          assignedRescuer: !assigned || !profile ? null : { ...presentAssignedRescuerToVictim({ ...profile, name: assigned.user.name }), destination: { latitude: incident.latitude, longitude: incident.longitude } },
        };
      }),
    myDetailsByCode: protectedProcedure
      .input(z.object({ publicCode: z.string().trim().toUpperCase().regex(/^SOS-[A-Z0-9]{8}$/) }))
      .query(async ({ input, ctx }) => {
        const incident = await getIncidentByCode(input.publicCode);
        if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "No SOS request matches this tracking code." });
        if (!mayEditPostAlertDetails(incident.reporterId, ctx.user.id, incident.status))
          throw new TRPCError({
            code: incident.reporterId !== ctx.user.id ? "FORBIDDEN" : "BAD_REQUEST",
            message:
              incident.reporterId !== ctx.user.id
                ? "Only the SOS reporter can view these request details."
                : "This SOS has already been resolved.",
          });
        return {
          publicCode: incident.publicCode,
          status: incident.status,
          peopleAffected: incident.peopleAffected,
          emergencyType: incident.emergencyType,
          helpNeeds: incident.helpNeeds,
          notes: incident.notes,
          contactName: incident.contactName,
        };
      }),
    updateMyDetails: protectedProcedure
      .input(
        z.object({
          publicCode: z.string().trim().toUpperCase().regex(/^SOS-[A-Z0-9]{8}$/),
          peopleAffected: z.number().int().min(1).max(500),
          emergencyType: z.enum(["flood", "medical", "trapped", "evacuation", "other"]),
          helpNeeds: z.string().trim().max(1000).optional(),
          notes: z.string().trim().max(2000).optional(),
          contactName: z.string().trim().max(160).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const incident = await getIncidentByCode(input.publicCode);
        if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "No SOS request matches this tracking code." });
        if (!mayEditPostAlertDetails(incident.reporterId, ctx.user.id, incident.status))
          throw new TRPCError({
            code: incident.reporterId !== ctx.user.id ? "FORBIDDEN" : "BAD_REQUEST",
            message:
              incident.reporterId !== ctx.user.id
                ? "Only the SOS reporter can update this request."
                : "This SOS has already been resolved.",
          });
        const db = await database();
        if (db) {
          try {
            await db
              .update(incidents)
              .set({
                peopleAffected: input.peopleAffected,
                emergencyType: input.emergencyType,
                helpNeeds: input.helpNeeds || null,
                notes: input.notes || null,
                contactName: input.contactName || null,
              })
              .where(eq(incidents.id, incident.id));
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        const mem = _memoryIncidents.get(incident.id);
        if (mem) {
          mem.peopleAffected = input.peopleAffected;
          mem.emergencyType = input.emergencyType;
          mem.helpNeeds = input.helpNeeds || null;
          mem.notes = input.notes || null;
          mem.contactName = input.contactName || null;
          mem.updatedAt = new Date();
        }
        await addIncidentEvent(
          incident.id,
          ctx.user.id,
          "victim_details_updated",
          "Victim updated request details",
          "People count, help needs, or notes were added after SOS activation."
        );
        await writeAudit(
          ctx.user.id,
          "incident.update_details",
          "incident",
          incident.id,
          `Updated post-alert details for ${incident.publicCode}`
        );
        return { success: true };
      }),
    chatByCode: publicProcedure
      .input(z.object({ publicCode: z.string().trim().toUpperCase().regex(/^SOS-[A-Z0-9]{8}$/) }))
      .query(async ({ input }) => {
        const incident = await getIncidentByCode(input.publicCode);
        if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "No SOS request matches this tracking code." });
        return getIncidentMessages(incident.id);
      }),
    sendChat: protectedProcedure
      .input(
        z.object({
          publicCode: z.string().trim().toUpperCase().regex(/^SOS-[A-Z0-9]{8}$/),
          message: z.string().trim().min(1).max(500),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const incident = await getIncidentByCode(input.publicCode);
        if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "No SOS request matches this tracking code." });
        if (incident.reporterId !== ctx.user.id)
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the SOS reporter can send a victim message." });
        if (incident.status === "resolved")
          throw new TRPCError({ code: "BAD_REQUEST", message: "This SOS has already been resolved." });
        let messageId = _memoryIncidentMessages.length + 1;
        const db = await database();
        if (db) {
          try {
            const result = await db
              .insert(incidentMessages)
              .values({ incidentId: incident.id, authorType: "victim", authorId: ctx.user.id, message: input.message });
            messageId = Number(result[0].insertId);
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        _memoryIncidentMessages.push({
          id: messageId,
          incidentId: incident.id,
          authorType: "victim",
          authorId: ctx.user.id,
          message: input.message,
          createdAt: new Date(),
        });
        return { id: messageId };
      }),
    mine: protectedProcedure.query(({ ctx }) => listIncidentsForReporter(ctx.user.id)),
  }),

  safety: router({
    resources: publicProcedure.query(async () => {
      const db = await database();
      if (db) {
        try {
          const [shelterRows, hospitalRows] = await Promise.all([
            db
              .select({
                id: shelters.id,
                name: shelters.name,
                address: shelters.address,
                latitude: shelters.latitude,
                longitude: shelters.longitude,
                capacity: shelters.capacity,
                occupancy: shelters.occupancy,
                status: shelters.status,
              })
              .from(shelters)
              .where(and(eq(shelters.status, "open"))),
            db
              .select({
                id: hospitals.id,
                name: hospitals.name,
                address: hospitals.address,
                contactPhone: hospitals.contactPhone,
                latitude: hospitals.latitude,
                longitude: hospitals.longitude,
                totalEmergencyBeds: hospitals.totalEmergencyBeds,
                availableEmergencyBeds: hospitals.availableEmergencyBeds,
                totalIcuBeds: hospitals.totalIcuBeds,
                availableIcuBeds: hospitals.availableIcuBeds,
                oxygenCylinderCount: hospitals.oxygenCylinderCount,
                bloodUnitCount: hospitals.bloodUnitCount,
                ambulanceCount: hospitals.ambulanceCount,
                foodSupplyStatus: hospitals.foodSupplyStatus,
                medicineSupplyStatus: hospitals.medicineSupplyStatus,
                waterSupplyStatus: hospitals.waterSupplyStatus,
                powerBackupStatus: hospitals.powerBackupStatus,
                status: hospitals.status,
                updatedAt: hospitals.updatedAt,
              })
              .from(hospitals)
              .where(and(eq(hospitals.status, "open"))),
          ]);
          return { shelters: shelterRows, hospitals: hospitalRows };
        } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
      }
      return {
        shelters: Array.from(_memoryShelters.values()).filter(s => s.status === "open"),
        hospitals: Array.from(_memoryHospitals.values()).filter(h => h.status === "open"),
      };
    }),
    createRequest: protectedProcedure
      .input(
        z.object({
          category: z.enum(["shelter", "food", "medical", "protection"]),
          peopleAffected: z.number().int().min(1).max(500),
          details: z.string().trim().max(1000).optional(),
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        })
      )
      .mutation(async ({ input, ctx }) => {
        let requestId = _memorySafetyRequests.size + 1;
        const db = await database();
        if (db) {
          try {
            const result = await db.insert(safetyAssistanceRequests).values({
              requesterId: ctx.user.id,
              category: input.category,
              peopleAffected: input.peopleAffected,
              details: input.details || null,
              latitude: input.latitude,
              longitude: input.longitude,
            });
            requestId = Number(result[0].insertId);
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        _memorySafetyRequests.set(requestId, {
          id: requestId,
          requesterId: ctx.user.id,
          category: input.category,
          peopleAffected: input.peopleAffected,
          details: input.details || null,
          latitude: input.latitude,
          longitude: input.longitude,
          status: "new",
          reviewedBy: null,
          reviewedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await writeAudit(
          ctx.user.id,
          "safety.request.create",
          "safetyAssistanceRequest",
          requestId,
          `Requested ${input.category} assistance`
        );
        return { id: requestId, status: "new" as const };
      }),
    mine: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      if (db) {
        try {
          const rows = await db
            .select()
            .from(safetyAssistanceRequests)
            .where(eq(safetyAssistanceRequests.requesterId, ctx.user.id))
            .orderBy(desc(safetyAssistanceRequests.createdAt));
          return rows.filter(row => isSafetyRequestOwnedBy(row.requesterId, ctx.user.id));
        } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
      }
      return Array.from(_memorySafetyRequests.values())
        .filter(r => r.requesterId === ctx.user.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }),
    queue: operationalProcedure.query(async ({ ctx }) => {
      const db = await database();
      const categories = ctx.user.role === "user" ? [] : visibleSafetyCategoriesForRole(ctx.user.role);
      if (db) {
        try {
          const where = categories.length === 1 ? and(eq(safetyAssistanceRequests.category, categories[0])) : undefined;
          return await db
            .select({
              id: safetyAssistanceRequests.id,
              requesterId: safetyAssistanceRequests.requesterId,
              category: safetyAssistanceRequests.category,
              peopleAffected: safetyAssistanceRequests.peopleAffected,
              details: safetyAssistanceRequests.details,
              latitude: safetyAssistanceRequests.latitude,
              longitude: safetyAssistanceRequests.longitude,
              status: safetyAssistanceRequests.status,
              createdAt: safetyAssistanceRequests.createdAt,
              requesterName: users.name,
            })
            .from(safetyAssistanceRequests)
            .leftJoin(users, eq(safetyAssistanceRequests.requesterId, users.id))
            .where(where)
            .orderBy(desc(safetyAssistanceRequests.createdAt));
        } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
      }
      return Array.from(_memorySafetyRequests.values())
        .filter(r => categories.length === 0 || categories.includes(r.category))
        .map(r => ({
          id: r.id,
          requesterId: r.requesterId,
          category: r.category,
          peopleAffected: r.peopleAffected,
          details: r.details,
          latitude: r.latitude,
          longitude: r.longitude,
          status: r.status,
          createdAt: r.createdAt,
          requesterName: _memoryUsers.get(String(r.requesterId))?.name || "Citizen",
        }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }),
    updateStatus: operationalProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["acknowledged", "resolved"]) }))
      .mutation(async ({ input, ctx }) => {
        let request: any = _memorySafetyRequests.get(input.id);
        const db = await database();
        if (db) {
          try {
            const dbReq = (
              await db.select().from(safetyAssistanceRequests).where(eq(safetyAssistanceRequests.id, input.id)).limit(1)
            )[0];
            if (dbReq) request = dbReq;
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Safety assistance request not found." });
        if (ctx.user.role === "user" || !canHandleSafetyAssistance(ctx.user.role, request.category))
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This account cannot update that safety assistance request.",
          });
        if (!canTransitionSafetyAssistance(request.status, input.status))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Safety assistance requests must be acknowledged before they can be resolved.",
          });
        if (db) {
          try {
            await db
              .update(safetyAssistanceRequests)
              .set({ status: input.status, reviewedBy: ctx.user.id, reviewedAt: new Date() })
              .where(eq(safetyAssistanceRequests.id, input.id));
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        if (_memorySafetyRequests.has(input.id)) {
          const m = _memorySafetyRequests.get(input.id)!;
          m.status = input.status;
          m.reviewedBy = ctx.user.id;
          m.reviewedAt = new Date();
          m.updatedAt = new Date();
        }
        await writeAudit(
          ctx.user.id,
          "safety.request.update",
          "safetyAssistanceRequest",
          input.id,
          `Marked ${input.status}`
        );
        return { success: true };
      }),
  }),

  hospital: router({
    requestRegistration: protectedProcedure.input(hospitalRegistrationInput).mutation(async ({ input, ctx }) => {
      if (!canRequestHospitalRegistration(ctx.user.role))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            ctx.user.role === "hospital" || ctx.user.role === "medical"
              ? "This account is already authorized as hospital staff."
              : "Only a standard signed-in account can submit a hospital registration request.",
        });
      let existing: any = Array.from(_memoryHospitalRequests.values()).find(r => r.userId === ctx.user.id);
      const db = await database();
      if (db) {
        try {
          const dbExisting = (
            await db
              .select()
              .from(hospitalRegistrationRequests)
              .where(eq(hospitalRegistrationRequests.userId, ctx.user.id))
              .limit(1)
          )[0];
          if (dbExisting) existing = dbExisting;
        } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
      }
      if (existing?.status === "pending")
        throw new TRPCError({
          code: "CONFLICT",
          message: "This hospital registration is already awaiting administrator review.",
        });
      let reqId = existing?.id || _memoryHospitalRequests.size + 1;
      if (db) {
        try {
          if (existing?.id) {
            await db
              .update(hospitalRegistrationRequests)
              .set({
                ...input,
                note: input.note ?? null,
                status: "pending",
                reviewedBy: null,
                reviewedAt: null,
                reviewNote: null,
              })
              .where(eq(hospitalRegistrationRequests.id, existing.id));
          } else {
            const res = await db
              .insert(hospitalRegistrationRequests)
              .values({ userId: ctx.user.id, ...input, note: input.note ?? null, status: "pending" });
            reqId = Number(res[0].insertId);
          }
        } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
      }
      _memoryHospitalRequests.set(reqId, {
        id: reqId,
        userId: ctx.user.id,
        hospitalName: input.hospitalName,
        address: input.address,
        contactPhone: input.contactPhone,
        latitude: input.latitude,
        longitude: input.longitude,
        note: input.note ?? null,
        status: "pending",
        reviewedBy: null,
        reviewNote: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await writeAudit(
        ctx.user.id,
        "hospitalRegistration.request",
        "hospitalRegistration",
        reqId,
        input.hospitalName
      );
      return { status: "pending" as const };
    }),
    mine: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      if (db) {
        try {
          const res = (
            await db
              .select()
              .from(hospitalRegistrationRequests)
              .where(eq(hospitalRegistrationRequests.userId, ctx.user.id))
              .limit(1)
          )[0];
          if (res) return res;
        } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
      }
      return Array.from(_memoryHospitalRequests.values()).find(r => r.userId === ctx.user.id) ?? null;
    }),
  }),

  operations: router({
    incidents: adminProcedure
      .input(z.object({ status: missionStatusSchema.optional() }).optional())
      .query(({ input }) => listIncidents(input?.status)),
    analytics: adminProcedure.query(() => getAnalytics()),
    mapLayers: operationalProcedure.query(({ ctx }) => getMapLayers(ctx.user.role !== "user")),
    hospitals: medicalOperationsProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") return listHospitals();
      const db = await database();
      if (db) {
        try {
          const profile = (
            await db.select().from(hospitalStaffProfiles).where(eq(hospitalStaffProfiles.userId, ctx.user.id)).limit(1)
          )[0];
          if (!profile) return [];
          return await db.select().from(hospitals).where(eq(hospitals.id, profile.hospitalId));
        } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
      }
      const memProfile = _memoryHospitalStaffProfiles.get(ctx.user.id);
      if (!memProfile) return [];
      const memHosp = _memoryHospitals.get(memProfile.hospitalId);
      return memHosp ? [memHosp] : [];
    }),
    myHospital: medicalOperationsProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") return null;
      const db = await database();
      if (db) {
        try {
          const profile = (
            await db.select().from(hospitalStaffProfiles).where(eq(hospitalStaffProfiles.userId, ctx.user.id)).limit(1)
          )[0];
          if (!profile) return null;
          return (await db.select().from(hospitals).where(eq(hospitals.id, profile.hospitalId)).limit(1))[0] ?? null;
        } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
      }
      const memProfile = _memoryHospitalStaffProfiles.get(ctx.user.id);
      if (!memProfile) return null;
      return _memoryHospitals.get(memProfile.hospitalId) ?? null;
    }),
    myHospitalRegistration: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      if (db) {
        try {
          return (
            await db
              .select()
              .from(hospitalRegistrationRequests)
              .where(eq(hospitalRegistrationRequests.userId, ctx.user.id))
              .limit(1)
          )[0] ?? null;
        } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
      }
      return Array.from(_memoryHospitalRequests.values()).find(r => r.userId === ctx.user.id) ?? null;
    }),
    hospitalCases: medicalOperationsProcedure.query(async ({ ctx }) => {
      let hospitalId: number | null = null;
      if (ctx.user.role === "hospital" || ctx.user.role === "medical") {
        const db = await database();
        if (db) {
          try {
            const profile = (
              await db.select().from(hospitalStaffProfiles).where(eq(hospitalStaffProfiles.userId, ctx.user.id)).limit(1)
            )[0];
            if (profile) hospitalId = profile.hospitalId;
          } catch {}
        }
        if (!hospitalId) {
          const memProfile = _memoryHospitalStaffProfiles.get(ctx.user.id);
          if (memProfile) hospitalId = memProfile.hospitalId;
        }
      }

      if (!hospitalId && ctx.user.role === "admin") {
        // Admin sees all cases across all hospitals in a single indexed query
        return await listHospitalCaseNotifications(null);
      }

      if (!hospitalId) return [];
      return await listHospitalCaseNotifications(hospitalId);
    }),
    updateHospitalCaseStatus: medicalOperationsProcedure
      .input(
        z.object({
          notificationId: z.number().int().positive(),
          status: z.enum(["notified", "acknowledged", "preparing", "ready", "received", "completed"]),
          hospitalNotes: z.string().trim().max(1000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const updated = await updateHospitalCaseStatus(input.notificationId, input.status, input.hospitalNotes);
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Hospital notification record not found." });
        }

        const incident = await getIncidentById(updated.incidentId);
        const hospital = (await listHospitals()).find(h => h.id === updated.hospitalId);
        const hospitalName = hospital?.name || `Hospital #${updated.hospitalId}`;

        // Add incident timeline event
        const statusDescriptions: Record<string, string> = {
          acknowledged: "Acknowledged inbound emergency case",
          preparing: "Preparing ER & Trauma team",
          ready: "Confirmed ready to receive patient(s)",
          received: "Patient(s) received at triage",
          completed: "Emergency case admission finalized",
        };
        const description = statusDescriptions[input.status] || `Status updated to ${input.status}`;

        await addIncidentEvent(
          updated.incidentId,
          ctx.user.id,
          `hospital_${input.status}`,
          `${hospitalName}: ${description}`,
          input.hospitalNotes || undefined
        );

        await writeAudit(
          ctx.user.id,
          "hospital.caseStatus",
          "hospitalCaseNotification",
          input.notificationId,
          `Updated case status to ${input.status} (${hospitalName})`
        );

        return { success: true, notification: updated };
      }),
    sendHospitalCoordinationMessage: medicalOperationsProcedure
      .input(
        z.object({
          hospitalId: z.number().int().positive(),
          category: z.enum([
            "additional_ambulance",
            "icu_critical",
            "oxygen_low",
            "critical_cases_hold",
            "additional_staff",
            "hospital_offline",
            "general_assistance",
          ]),
          message: z.string().trim().min(5).max(1000),
          urgency: z.enum(["critical", "high", "normal"]).default("high"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const hospital = (await listHospitals()).find(h => h.id === input.hospitalId);
        const hospitalName = hospital?.name || `Hospital #${input.hospitalId}`;

        const categoryLabels: Record<string, string> = {
          additional_ambulance: "Request: Additional Ambulance Dispatch",
          icu_critical: "Alert: ICU Capacity Critically Low",
          oxygen_low: "Alert: Oxygen Supply Running Low",
          critical_cases_hold: "Notice: Unable to Accept New Critical Cases",
          additional_staff: "Request: Additional Medical Personnel",
          hospital_offline: "Notice: Facility Temporarily Offline",
          general_assistance: "State Assistance Coordination Request",
        };
        const title = `${categoryLabels[input.category] || "Hospital Alert"} — ${hospitalName}`;

        await writeAudit(
          ctx.user.id,
          "hospital.coordinationMessage",
          "hospital",
          input.hospitalId,
          `[${input.urgency.toUpperCase()}] ${title}: ${input.message}`
        );

        // Notify admins / operations
        const adminUsers = (await getAllUsers()).filter(u => u.role === "admin");
        for (const admin of adminUsers) {
          try {
            const db = await database();
            if (db) {
              await db.insert(notifications).values({
                recipientId: admin.id,
                type: "priority_incident",
                title,
                body: input.message,
              });
            } else {
              _memoryNotifications.push({
                id: _memoryNotifications.length + 1,
                recipientId: admin.id,
                incidentId: null,
                type: "priority_incident",
                title,
                body: input.message,
                readAt: null,
                createdAt: new Date(),
              });
            }
          } catch {}
        }

        return { success: true };
      }),
    hospitalActivityTimeline: medicalOperationsProcedure.query(async ({ ctx }) => {
      let hospitalId: number | null = null;
      if (ctx.user.role === "hospital" || ctx.user.role === "medical") {
        const db = await database();
        if (db) {
          try {
            const profile = (
              await db.select().from(hospitalStaffProfiles).where(eq(hospitalStaffProfiles.userId, ctx.user.id)).limit(1)
            )[0];
            if (profile) hospitalId = profile.hospitalId;
          } catch {}
        }
        if (!hospitalId) {
          const memProfile = _memoryHospitalStaffProfiles.get(ctx.user.id);
          if (memProfile) hospitalId = memProfile.hospitalId;
        }
      }

      // Return recent audit events related to hospital operations
      try {
        const db = await database();
        if (db) {
          const rows = await db
            .select({
              id: auditLogs.id,
              action: auditLogs.action,
              detail: auditLogs.detail,
              createdAt: auditLogs.createdAt,
              actor: { id: users.id, name: users.name },
            })
            .from(auditLogs)
            .leftJoin(users, eq(auditLogs.actorId, users.id))
            .where(or(eq(auditLogs.resourceType, "hospital"), eq(auditLogs.resourceType, "hospitalCaseNotification")))
            .orderBy(desc(auditLogs.createdAt))
            .limit(20);
          if (rows.length > 0) return rows;
        }
      } catch {}

      const memLogs = Array.from(_memoryAuditLogs)
        .filter(l => l.resourceType === "hospital" || l.resourceType === "hospitalCaseNotification")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 20)
        .map(l => ({
          id: l.id,
          action: l.action,
          detail: l.detail,
          createdAt: l.createdAt,
          actor: { id: l.actorId || 0, name: _memoryUsers.get(String(l.actorId))?.name || "Staff Member" },
        }));

      return memLogs;
    }),
    hospitalRegistrationRequests: adminProcedure.query(async () => {
      const db = await database();
      if (db) {
        try {
          return await db
            .select({
              request: hospitalRegistrationRequests,
              user: { id: users.id, name: users.name, email: users.email },
            })
            .from(hospitalRegistrationRequests)
            .leftJoin(users, eq(hospitalRegistrationRequests.userId, users.id))
            .orderBy(desc(hospitalRegistrationRequests.createdAt));
        } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
      }
      return Array.from(_memoryHospitalRequests.values()).map(request => ({
        request,
        user: {
          id: request.userId,
          name: _memoryUsers.get(String(request.userId))?.name || "Medical User",
          email: _memoryUsers.get(String(request.userId))?.email || null,
        },
      }));
    }),
    rescuerRegistrationRequests: adminProcedure.query(() => listRescuerRegistrationRequests()),
    rescueRoster: adminProcedure.query(() => getRescuerRoster()),
    availableUsers: adminProcedure.query(async () => {
      const db = await database();
      if (db) {
        try {
          return await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).orderBy(users.name);
        } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
      }
      return Array.from(_memoryUsers.values()).map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
    }),
    adminUsersList: adminProcedure
      .input(
        z.object({
          search: z.string().optional(),
          role: z.enum(["all", "user", "hospital", "rescuer", "admin"]).default("all"),
          status: z.enum(["all", "active", "disabled"]).default("all"),
          limit: z.number().int().min(1).max(200).default(100),
          offset: z.number().int().min(0).default(0),
        }).optional()
      )
      .query(async ({ input }) => {
        const search = input?.search?.trim().toLowerCase() || "";
        const roleFilter = input?.role || "all";
        const statusFilter = input?.status || "all";
        const limit = input?.limit || 100;
        const offset = input?.offset || 0;

        let allDbUsers: any[] = [];
        let allRescuerProfiles: any[] = [];
        let allHospitalStaffProfiles: any[] = [];
        let allHospitals: any[] = [];
        let allRescuerReqs: any[] = [];
        let allHospitalReqs: any[] = [];

        const db = await database();
        if (db) {
          try {
            allDbUsers = await db.select().from(users).orderBy(desc(users.id));
            allRescuerProfiles = await db.select().from(rescueProfiles);
            allHospitalStaffProfiles = await db.select().from(hospitalStaffProfiles);
            allHospitals = await db.select().from(hospitals);
            allRescuerReqs = await db.select().from(rescuerRegistrationRequests);
            allHospitalReqs = await db.select().from(hospitalRegistrationRequests);
          } catch (err) {
            if (process.env.NODE_ENV === "production") {
              throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database query failed in production" });
            }
          }
        }

        // Fallback / merge with memory store
        if (!allDbUsers.length) {
          const seen = new Set<number>();
          for (const u of Array.from(_memoryUsers.values())) {
            if (!seen.has(u.id)) {
              seen.add(u.id);
              allDbUsers.push(u);
            }
          }
          allRescuerProfiles = Array.from(_memoryRescueProfiles.values());
          allHospitalStaffProfiles = Array.from(_memoryHospitalStaffProfiles.values());
          allHospitals = Array.from(_memoryHospitals.values());
          allRescuerReqs = Array.from(_memoryRescuerRequests.values());
          allHospitalReqs = Array.from(_memoryHospitalRequests.values());
        }

        const rescuerProfileMap = new Map(allRescuerProfiles.map(p => [p.userId, p]));
        const rescuerReqMap = new Map(allRescuerReqs.map(r => [r.userId, r]));
        const hospitalStaffMap = new Map(allHospitalStaffProfiles.map(s => [s.userId, s]));
        const hospitalMap = new Map(allHospitals.map(h => [h.id, h]));
        const hospitalReqMap = new Map(allHospitalReqs.map(hr => [hr.userId, hr]));

        // Normalize roles & map details
        const enriched = allDbUsers.map(u => {
          const canonicalRole: "user" | "hospital" | "rescuer" | "admin" =
            u.role === "medical" ? "hospital" : (u.role || "user");
          const userStatus: "active" | "disabled" = u.status === "disabled" ? "disabled" : "active";

          const rescuerProfile = rescuerProfileMap.get(u.id);
          const rescuerReq = rescuerReqMap.get(u.id);
          const hospitalStaff = hospitalStaffMap.get(u.id);
          const hospitalData = hospitalStaff ? hospitalMap.get(hospitalStaff.hospitalId) : null;
          const hospitalReq = hospitalReqMap.get(u.id);

          return {
            id: u.id,
            openId: u.openId,
            name: u.name,
            email: u.email,
            role: canonicalRole,
            status: userStatus,
            loginMethod: u.loginMethod || "platform-login",
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
            lastSignedIn: u.lastSignedIn,
            rescuerProfile: rescuerProfile ? {
              callSign: rescuerProfile.callSign,
              phone: rescuerProfile.phone,
              availability: rescuerProfile.availability,
              locationSharing: rescuerProfile.locationSharing,
              locationUpdatedAt: rescuerProfile.locationUpdatedAt,
            } : null,
            rescuerRequest: rescuerReq ? {
              id: rescuerReq.id,
              status: rescuerReq.status,
              phone: rescuerReq.phone,
              createdAt: rescuerReq.createdAt,
              reviewedAt: rescuerReq.reviewedAt,
            } : null,
            hospitalProfile: hospitalStaff ? {
              hospitalId: hospitalStaff.hospitalId,
              hospitalName: hospitalData?.name || `Hospital #${hospitalStaff.hospitalId}`,
              hospitalAddress: hospitalData?.address || "",
              designation: hospitalStaff.designation,
              status: hospitalData?.status || "open",
            } : null,
            hospitalRequest: hospitalReq ? {
              id: hospitalReq.id,
              hospitalName: hospitalReq.hospitalName,
              address: hospitalReq.address,
              status: hospitalReq.status,
              createdAt: hospitalReq.createdAt,
              reviewedAt: hospitalReq.reviewedAt,
            } : null,
          };
        });

        // Compute summary counts across ALL users
        const summary = {
          total: enriched.length,
          citizens: enriched.filter(u => u.role === "user").length,
          hospitalStaff: enriched.filter(u => u.role === "hospital").length,
          rescuers: enriched.filter(u => u.role === "rescuer").length,
          admins: enriched.filter(u => u.role === "admin").length,
          active: enriched.filter(u => u.status === "active").length,
          disabled: enriched.filter(u => u.status === "disabled").length,
        };

        // Filter
        let filtered = enriched;
        if (roleFilter !== "all") {
          filtered = filtered.filter(u => u.role === roleFilter);
        }
        if (statusFilter !== "all") {
          filtered = filtered.filter(u => u.status === statusFilter);
        }
        if (search) {
          filtered = filtered.filter(u =>
            (u.email && u.email.toLowerCase().includes(search)) ||
            (u.name && u.name.toLowerCase().includes(search)) ||
            (u.openId && u.openId.toLowerCase().includes(search)) ||
            String(u.id) === search ||
            (u.rescuerProfile?.callSign && u.rescuerProfile.callSign.toLowerCase().includes(search)) ||
            (u.hospitalProfile?.hospitalName && u.hospitalProfile.hospitalName.toLowerCase().includes(search))
          );
        }

        const totalFiltered = filtered.length;
        const paged = filtered.slice(offset, offset + limit);

        return {
          users: paged,
          total: totalFiltered,
          summary,
        };
      }),
    adminGetUser: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const user = await getUserById(input.userId);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

        let rescuerProfile = await getRescuerProfile(input.userId);
        let emergencyContactsList = await getEmergencyContactsByUserId(input.userId);
        let userHospitalStaff = null;
        let userHospital = null;
        let userAuditHistory: any[] = [];
        let assignedMissionsCount = 0;

        const db = await database();
        if (db) {
          try {
            const hs = (await db.select().from(hospitalStaffProfiles).where(eq(hospitalStaffProfiles.userId, input.userId)).limit(1))[0];
            if (hs) {
              userHospitalStaff = hs;
              userHospital = (await db.select().from(hospitals).where(eq(hospitals.id, hs.hospitalId)).limit(1))[0] || null;
            }
            userAuditHistory = await db.select().from(auditLogs).where(and(eq(auditLogs.resourceType, "user"), eq(auditLogs.resourceId, String(input.userId)))).orderBy(desc(auditLogs.createdAt)).limit(20);
            const mCount = await db.select().from(missions).where(eq(missions.rescuerId, input.userId));
            assignedMissionsCount = mCount.length;
          } catch (err) {}
        }
        
        if (!userHospitalStaff) {
          const hs = _memoryHospitalStaffProfiles.get(input.userId);
          if (hs) {
            userHospitalStaff = hs;
            userHospital = _memoryHospitals.get(hs.hospitalId) || null;
          }
        }
        if (!userAuditHistory.length) {
          userAuditHistory = _memoryAuditLogs.filter(l => l.resourceType === "user" && l.resourceId === String(input.userId));
        }
        if (!assignedMissionsCount) {
          assignedMissionsCount = Array.from(_memoryMissions.values()).filter(m => m.rescuerId === input.userId).length;
        }

        return {
          user: {
            id: user.id,
            openId: user.openId,
            name: user.name,
            email: user.email,
            role: user.role === "medical" ? "hospital" : user.role,
            status: user.status || "active",
            loginMethod: user.loginMethod,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastSignedIn: user.lastSignedIn,
          },
          rescuerProfile,
          hospitalStaffProfile: userHospitalStaff,
          hospital: userHospital,
          emergencyContactsCount: emergencyContactsList.length,
          assignedMissionsCount,
          auditHistory: userAuditHistory,
        };
      }),
    adminUpdateUserRole: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          role: z.enum(["user", "hospital", "rescuer", "admin"]),
          hospitalId: z.number().int().positive().optional(),
          designation: z.string().trim().max(120).optional(),
          callSign: z.string().trim().min(2).max(96).optional(),
          phone: z.string().trim().max(32).optional(),
          reason: z.string().trim().max(500).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await getUserById(input.userId);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

        if (input.role === "hospital") {
          if (!input.hospitalId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "A verified hospital facility must be selected." });
          }
          let hospitalExists = false;
          const db = await database();
          if (db) {
            try {
              const h = (await db.select().from(hospitals).where(eq(hospitals.id, input.hospitalId)).limit(1))[0];
              if (h) hospitalExists = true;
            } catch (err) {}
          } else {
            hospitalExists = _memoryHospitals.has(input.hospitalId);
          }
          if (!hospitalExists) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Selected hospital facility was not found." });
          }
        }

        if (input.role === "rescuer") {
          if (!input.callSign || input.callSign.trim().length < 2) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "A field call sign (min 2 characters) is required for rescuer role." });
          }
        }

        const previousRole = user.role;
        const db = await database();

        if (db) {
          try {
            await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));

            if (input.role === "hospital" && input.hospitalId) {
              const existingStaff = (await db.select().from(hospitalStaffProfiles).where(eq(hospitalStaffProfiles.userId, input.userId)).limit(1))[0];
              if (existingStaff) {
                await db.update(hospitalStaffProfiles).set({ hospitalId: input.hospitalId, designation: input.designation || existingStaff.designation || null }).where(eq(hospitalStaffProfiles.userId, input.userId));
              } else {
                await db.insert(hospitalStaffProfiles).values({
                  userId: input.userId,
                  hospitalId: input.hospitalId,
                  designation: input.designation || "Medical Coordinator",
                });
              }
            } else if (input.role === "rescuer" && input.callSign) {
              const existingRescue = (await db.select().from(rescueProfiles).where(eq(rescueProfiles.userId, input.userId)).limit(1))[0];
              if (existingRescue) {
                await db.update(rescueProfiles).set({ callSign: input.callSign.trim(), phone: input.phone || existingRescue.phone || null, availability: "available" }).where(eq(rescueProfiles.userId, input.userId));
              } else {
                await db.insert(rescueProfiles).values({
                  userId: input.userId,
                  callSign: input.callSign.trim(),
                  phone: input.phone || null,
                  availability: "available",
                });
              }
            }
          } catch (err) {
            if (process.env.NODE_ENV === "production") {
              throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database update failed in production" });
            }
          }
        }

        // Memory cache sync
        for (const [k, memU] of Array.from(_memoryUsers.entries())) {
          if (memU && (memU.id === input.userId || memU.openId === user.openId || (user.email && memU.email?.toLowerCase() === user.email.toLowerCase()))) {
            memU.role = input.role;
            _memoryUsers.set(k, { ...memU, role: input.role });
          }
        }

        if (input.role === "hospital" && input.hospitalId) {
          _memoryHospitalStaffProfiles.set(input.userId, {
            id: _memoryHospitalStaffProfiles.get(input.userId)?.id || _memoryHospitalStaffProfiles.size + 1,
            userId: input.userId,
            hospitalId: input.hospitalId,
            designation: input.designation || "Medical Coordinator",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else if (input.role === "rescuer" && input.callSign) {
          _memoryRescueProfiles.set(input.userId, {
            id: _memoryRescueProfiles.get(input.userId)?.id || _memoryRescueProfiles.size + 1,
            userId: input.userId,
            callSign: input.callSign.trim(),
            phone: input.phone || null,
            photoKey: null,
            photoUrl: null,
            contactSharing: "no",
            locationSharing: "no",
            availability: "available",
            lastLatitude: null,
            lastLongitude: null,
            locationUpdatedAt: null,
            updatedAt: new Date(),
          });
        }

        await writeAudit(
          ctx.user.id,
          "ROLE_CHANGED",
          "user",
          input.userId,
          JSON.stringify({
            previousRole,
            newRole: input.role,
            targetEmail: user.email,
            targetUserId: user.id,
            hospitalId: input.hospitalId,
            callSign: input.callSign,
            reason: input.reason || "Administrative role update",
          })
        );

        return { success: true, newRole: input.role };
      }),
    adminSetUserStatus: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          status: z.enum(["active", "disabled"]),
          reason: z.string().trim().max(500).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.id === input.userId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Administrators cannot disable their own account.",
          });
        }

        const user = await getUserById(input.userId);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

        const previousStatus = user.status || "active";
        const db = await database();

        if (db) {
          try {
            await db.update(users).set({ status: input.status }).where(eq(users.id, input.userId));
          } catch (err) {
            if (process.env.NODE_ENV === "production") {
              throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database update failed in production" });
            }
          }
        }

        // Memory cache sync
        for (const [k, memU] of Array.from(_memoryUsers.entries())) {
          if (memU && (memU.id === input.userId || memU.openId === user.openId || (user.email && memU.email?.toLowerCase() === user.email.toLowerCase()))) {
            memU.status = input.status;
            _memoryUsers.set(k, { ...memU, status: input.status });
          }
        }

        await writeAudit(
          ctx.user.id,
          input.status === "disabled" ? "ACCOUNT_DISABLED" : "ACCOUNT_ENABLED",
          "user",
          input.userId,
          JSON.stringify({
            previousStatus,
            newStatus: input.status,
            targetEmail: user.email,
            targetUserId: user.id,
            reason: input.reason || (input.status === "disabled" ? "Disabled by administrator" : "Re-activated by administrator"),
          })
        );

        return { success: true, status: input.status };
      }),
    promoteRescuer: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          callSign: z.string().trim().min(2).max(96),
          phone: z.string().trim().max(32).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        let target: any = Array.from(_memoryUsers.values()).find(u => u.id === input.userId);
        const db = await database();
        if (db) {
          try {
            const dbTarget = (await db.select().from(users).where(eq(users.id, input.userId)).limit(1))[0];
            if (dbTarget) target = dbTarget;
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
        if (target.role === "admin")
          throw new TRPCError({ code: "BAD_REQUEST", message: "Administrators cannot be converted to rescuers." });
        if (db) {
          try {
            await db.update(users).set({ role: "rescuer" }).where(eq(users.id, input.userId));
            const existing = await getRescuerProfile(input.userId);
            if (existing)
              await db
                .update(rescueProfiles)
                .set({ callSign: input.callSign, phone: input.phone ?? null })
                .where(eq(rescueProfiles.userId, input.userId));
            else
              await db.insert(rescueProfiles).values({
                userId: input.userId,
                callSign: input.callSign,
                phone: input.phone ?? null,
                availability: "available",
              });
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        target.role = "rescuer";
        _memoryRescueProfiles.set(input.userId, {
          id: _memoryRescueProfiles.get(input.userId)?.id || _memoryRescueProfiles.size + 1,
          userId: input.userId,
          callSign: input.callSign,
          phone: input.phone ?? null,
          photoKey: null,
          photoUrl: null,
          contactSharing: "no",
          locationSharing: "no",
          availability: "available",
          lastLatitude: null,
          lastLongitude: null,
          locationUpdatedAt: null,
          updatedAt: new Date(),
        });
        await writeAudit(
          ctx.user.id,
          "rescuer.promote",
          "user",
          input.userId,
          `Assigned call sign ${input.callSign}`
        );
        return { success: true };
      }),
    promoteMedical: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        let target: any = Array.from(_memoryUsers.values()).find(u => u.id === input.userId);
        const db = await database();
        if (db) {
          try {
            const dbTarget = (await db.select().from(users).where(eq(users.id, input.userId)).limit(1))[0];
            if (dbTarget) target = dbTarget;
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
        if (target.role !== "user")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only a standard signed-in user can be authorized as medical staff.",
          });
        if (db) {
          try {
            await db.update(users).set({ role: "medical" }).where(eq(users.id, input.userId));
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        target.role = "medical";
        await writeAudit(ctx.user.id, "medical.promote", "user", input.userId, "Authorized medical operations access");
        return { success: true };
      }),
    promoteHospital: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        let target: any = Array.from(_memoryUsers.values()).find(u => u.id === input.userId);
        const db = await database();
        if (db) {
          try {
            const dbTarget = (await db.select().from(users).where(eq(users.id, input.userId)).limit(1))[0];
            if (dbTarget) target = dbTarget;
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
        if (target.role !== "user")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only a standard signed-in user can be authorized as hospital staff.",
          });
        if (db) {
          try {
            await db.update(users).set({ role: "hospital" }).where(eq(users.id, input.userId));
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        target.role = "hospital";
        await writeAudit(ctx.user.id, "hospital.promote", "user", input.userId, "Authorized hospital operations access");
        return { success: true };
      }),
    reviewHospitalRegistration: adminProcedure
      .input(
        z.object({
          requestId: z.number().int().positive(),
          decision: z.enum(["approved", "rejected"]),
          reviewNote: z.string().trim().max(1000).optional(),
          designation: z.string().trim().max(120).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        let request: any = _memoryHospitalRequests.get(input.requestId);
        const db = await database();
        if (db) {
          try {
            const dbReq = (
              await db
                .select()
                .from(hospitalRegistrationRequests)
                .where(eq(hospitalRegistrationRequests.id, input.requestId))
                .limit(1)
            )[0];
            if (dbReq) request = dbReq;
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Hospital registration request not found." });
        if (request.status !== "pending")
          throw new TRPCError({ code: "BAD_REQUEST", message: "This hospital registration has already been reviewed." });
        const reviewedAt = new Date();
        if (db) {
          try {
            await db
              .update(hospitalRegistrationRequests)
              .set({ status: input.decision, reviewedBy: ctx.user.id, reviewedAt, reviewNote: input.reviewNote ?? null })
              .where(eq(hospitalRegistrationRequests.id, request.id));
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        request.status = input.decision;
        request.reviewedBy = ctx.user.id;
        request.reviewedAt = reviewedAt;
        request.reviewNote = input.reviewNote ?? null;
        if (input.decision === "approved") {
          let hospitalId = _memoryHospitals.size + 1;
          let targetOpenId: string | undefined;
          let targetEmail: string | undefined;
          if (db) {
            try {
              const dbUser = (await db.select().from(users).where(eq(users.id, request.userId)).limit(1))[0];
              if (dbUser) {
                targetOpenId = dbUser.openId;
                targetEmail = dbUser.email?.toLowerCase();
              }
            } catch (err) {}
            try {
              await db.update(users).set({ role: "hospital" }).where(eq(users.id, request.userId));
            } catch (err) {}
            try {
              const created = await db.insert(hospitals).values({
                name: request.hospitalName,
                address: request.address,
                contactPhone: request.contactPhone,
                latitude: request.latitude,
                longitude: request.longitude,
                totalEmergencyBeds: 0,
                availableEmergencyBeds: 0,
                totalIcuBeds: 0,
                availableIcuBeds: 0,
                oxygenCylinderCount: 0,
                bloodUnitCount: 0,
                ambulanceCount: 0,
                foodSupplyStatus: "limited",
                medicineSupplyStatus: "limited",
                waterSupplyStatus: "limited",
                powerBackupStatus: "limited",
                status: "limited",
                updatedBy: request.userId,
              });
              hospitalId = Number(created[0].insertId);
            } catch (err) {}
            try {
              await db.insert(hospitalStaffProfiles).values({
                userId: request.userId,
                hospitalId,
                designation: input.designation ?? null,
              });
            } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
          }
          _memoryHospitals.set(hospitalId, {
            id: hospitalId,
            name: request.hospitalName,
            address: request.address,
            contactPhone: request.contactPhone,
            latitude: request.latitude,
            longitude: request.longitude,
            totalEmergencyBeds: 0,
            availableEmergencyBeds: 0,
            totalIcuBeds: 0,
            availableIcuBeds: 0,
            oxygenCylinderCount: 0,
            bloodUnitCount: 0,
            ambulanceCount: 0,
            foodSupplyStatus: "limited",
            medicineSupplyStatus: "limited",
            waterSupplyStatus: "limited",
            powerBackupStatus: "limited",
            status: "limited",
            updatedBy: request.userId,
            updatedAt: new Date(),
          });
          _memoryHospitalStaffProfiles.set(request.userId, {
            id: _memoryHospitalStaffProfiles.size + 1,
            userId: request.userId,
            hospitalId,
            designation: input.designation ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          for (const [k, u] of Array.from(_memoryUsers.entries())) {
            if (
              u &&
              (u.id === request.userId ||
                (targetOpenId && u.openId === targetOpenId) ||
                (targetEmail && u.email?.toLowerCase() === targetEmail))
            ) {
              u.role = "hospital";
              _memoryUsers.set(k, { ...u, role: "hospital" });
            }
          }
          await writeAudit(
            ctx.user.id,
            "hospitalRegistration.approved",
            "hospitalRegistration",
            request.id,
            `Created hospital ${hospitalId}`
          );
          return { success: true, hospitalId };
        }
        await writeAudit(
          ctx.user.id,
          "hospitalRegistration.rejected",
          "hospitalRegistration",
          request.id,
          input.reviewNote ?? null
        );
        return { success: true, hospitalId: null };
      }),
    reviewRescuerRegistration: adminProcedure
      .input(
        z.object({
          requestId: z.number().int().positive(),
          decision: z.enum(["approved", "rejected"]),
          callSign: z.string().trim().min(2).max(96).optional(),
          reviewNote: z.string().trim().max(1000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!requiresCallSign(input.decision, input.callSign))
          throw new TRPCError({ code: "BAD_REQUEST", message: "A field call sign is required to approve a rescuer." });
        let request: any = _memoryRescuerRequests.get(input.requestId);
        let targetOpenId: string | undefined;
        let targetEmail: string | undefined;
        const db = await database();
        if (db) {
          try {
            const dbReq = (
              await db
                .select()
                .from(rescuerRegistrationRequests)
                .where(eq(rescuerRegistrationRequests.id, input.requestId))
                .limit(1)
            )[0];
            if (dbReq) request = dbReq;
            const dbUser = (await db.select().from(users).where(eq(users.id, request.userId)).limit(1))[0];
            if (dbUser) {
              targetOpenId = dbUser.openId;
              targetEmail = dbUser.email?.toLowerCase();
            }
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Registration request not found." });
        if (request.status !== "pending")
          throw new TRPCError({ code: "BAD_REQUEST", message: "This registration request has already been reviewed." });
        const reviewedAt = new Date();
        if (db) {
          try {
            await db
              .update(rescuerRegistrationRequests)
              .set({ status: input.decision, reviewedBy: ctx.user.id, reviewedAt, reviewNote: input.reviewNote ?? null })
              .where(eq(rescuerRegistrationRequests.id, request.id));
            if (input.decision === "approved") {
              await db.update(users).set({ role: "rescuer" }).where(eq(users.id, request.userId));
              const existing = (await db.select().from(rescueProfiles).where(eq(rescueProfiles.userId, request.userId)).limit(1))[0];
              if (existing)
                await db
                  .update(rescueProfiles)
                  .set({ callSign: input.callSign!, phone: request.phone ?? null, availability: "available" })
                  .where(eq(rescueProfiles.userId, request.userId));
              else
                await db.insert(rescueProfiles).values({
                  userId: request.userId,
                  callSign: input.callSign!,
                  phone: request.phone ?? null,
                  availability: "available",
                });
            }
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        request.status = input.decision;
        request.reviewedBy = ctx.user.id;
        request.reviewedAt = reviewedAt;
        request.reviewNote = input.reviewNote ?? null;
        if (input.decision === "approved") {
          for (const [k, u] of Array.from(_memoryUsers.entries())) {
            if (
              u &&
              (u.id === request.userId ||
                (targetOpenId && u.openId === targetOpenId) ||
                (targetEmail && u.email?.toLowerCase() === targetEmail))
            ) {
              u.role = "rescuer";
              _memoryUsers.set(k, { ...u, role: "rescuer" });
            }
          }
          _memoryRescueProfiles.set(request.userId, {
            id: _memoryRescueProfiles.get(request.userId)?.id || _memoryRescueProfiles.size + 1,
            userId: request.userId,
            callSign: input.callSign!,
            phone: request.phone ?? null,
            photoKey: null,
            photoUrl: null,
            contactSharing: "no",
            locationSharing: "no",
            availability: "available",
            lastLatitude: null,
            lastLongitude: null,
            locationUpdatedAt: null,
            updatedAt: new Date(),
          });
        }
        await writeAudit(
          ctx.user.id,
          `rescuerRegistration.${input.decision}`,
          "rescuerRegistration",
          request.id,
          input.callSign ?? input.reviewNote ?? null
        );
        return { success: true };
      }),
    assignMission: adminProcedure
      .input(z.object({ incidentId: z.number().int().positive(), rescuerId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const incident = await getIncidentById(input.incidentId);
        if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "SOS request not found." });
        if (incident.status !== "pending")
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending SOS requests can be assigned." });
        const profile = await getRescuerProfile(input.rescuerId);
        if (!profile)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Select an authorized rescuer." });
        if (profile.availability !== "available")
          throw new TRPCError({ code: "BAD_REQUEST", message: "Selected rescuer is not available." });
        let missionId = _memoryMissions.size + 1;
        const db = await database();
        if (db) {
          try {
            const mission = await db
              .insert(missions)
              .values({ incidentId: incident.id, rescuerId: input.rescuerId, assignedBy: ctx.user.id, status: "pending" });
            missionId = Number(mission[0].insertId);
            await db.update(incidents).set({ assignedRescuerId: input.rescuerId }).where(eq(incidents.id, incident.id));
            await db.update(rescueProfiles).set({ availability: "on_mission", locationSharing: "yes", lastLatitude: null, lastLongitude: null, locationUpdatedAt: null }).where(eq(rescueProfiles.userId, input.rescuerId));
            await db.insert(notifications).values({
              recipientId: input.rescuerId,
              incidentId: incident.id,
              type: "mission_assigned",
              title: `Mission assigned: ${incident.publicCode}`,
              body: `Proceed to ${incident.locationLabel} and update the mission status when dispatched.`,
            });
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        _memoryMissions.set(missionId, {
          id: missionId,
          incidentId: incident.id,
          rescuerId: input.rescuerId,
          status: "pending",
          assignedBy: ctx.user.id,
          assignedAt: new Date(),
          dispatchedAt: null,
          resolvedAt: null,
          notes: null,
          updatedAt: new Date(),
        });
        const memInc = _memoryIncidents.get(incident.id);
        if (memInc) memInc.assignedRescuerId = input.rescuerId;
        const memProf = _memoryRescueProfiles.get(input.rescuerId);
        if (memProf) {
          memProf.availability = "on_mission";
          memProf.locationSharing = "yes";
          memProf.lastLatitude = null;
          memProf.lastLongitude = null;
          memProf.locationUpdatedAt = null;
        }
        _memoryNotifications.push({
          id: _memoryNotifications.length + 1,
          recipientId: input.rescuerId,
          incidentId: incident.id,
          type: "mission_assigned",
          title: `Mission assigned: ${incident.publicCode}`,
          body: `Proceed to ${incident.locationLabel} and update the mission status when dispatched.`,
          readAt: null,
          createdAt: new Date(),
        });
        await sendRescuerPush([input.rescuerId], {
          title: `Mission assigned: ${incident.publicCode}`,
          body: `Proceed to ${incident.locationLabel} and update the mission status when dispatched.`,
          incidentId: incident.id,
          url: "/responder/alerts",
        });
        await addIncidentEvent(
          incident.id,
          ctx.user.id,
          "mission_assigned",
          "Rescue mission assigned",
          "A rescuer has been assigned and is preparing to deploy."
        );
        await writeAudit(ctx.user.id, "mission.assign", "incident", incident.id, `Assigned to user ${input.rescuerId}`);
        return { missionId };
      }),
    addShelter: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(180),
          address: z.string().trim().min(3).max(360),
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          capacity: z.number().int().min(0).max(1_000_000),
          occupancy: z.number().int().min(0).max(1_000_000),
          status: z.enum(["open", "limited", "closed"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.occupancy > input.capacity && input.capacity > 0)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Occupancy cannot exceed capacity." });
        let shelterId = _memoryShelters.size + 1;
        const db = await database();
        if (db) {
          try {
            const result = await db.insert(shelters).values({ ...input, createdBy: ctx.user.id });
            shelterId = Number(result[0].insertId);
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        _memoryShelters.set(shelterId, {
          id: shelterId,
          ...input,
          createdBy: ctx.user.id,
          updatedAt: new Date(),
        });
        await writeAudit(ctx.user.id, "shelter.create", "shelter", shelterId, input.name);
        return { id: shelterId };
      }),
    updateShelter: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().trim().min(2).max(180),
          address: z.string().trim().min(3).max(360),
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          capacity: z.number().int().min(0).max(1_000_000),
          occupancy: z.number().int().min(0).max(1_000_000),
          status: z.enum(["open", "limited", "closed"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.occupancy > input.capacity && input.capacity > 0)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Occupancy cannot exceed capacity." });
        const db = await database();
        if (db) {
          try {
            await db
              .update(shelters)
              .set({
                name: input.name,
                address: input.address,
                latitude: input.latitude,
                longitude: input.longitude,
                capacity: input.capacity,
                occupancy: input.occupancy,
                status: input.status,
              })
              .where(eq(shelters.id, input.id));
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        const mem = _memoryShelters.get(input.id);
        if (mem) {
          Object.assign(mem, input);
          mem.updatedAt = new Date();
        }
        await writeAudit(ctx.user.id, "shelter.update", "shelter", input.id, input.name);
        return { success: true };
      }),
    addHospital: adminProcedure.input(hospitalInput).mutation(async ({ input, ctx }) => {
      if (
        !hasValidHospitalCapacity(
          input.totalEmergencyBeds,
          input.availableEmergencyBeds,
          input.totalIcuBeds,
          input.availableIcuBeds
        )
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Available beds cannot exceed the declared hospital capacity.",
        });
      let hospitalId = _memoryHospitals.size + 1;
      const db = await database();
      if (db) {
        try {
          const result = await db
            .insert(hospitals)
            .values({ ...input, contactPhone: input.contactPhone ?? null, updatedBy: ctx.user.id });
          hospitalId = Number(result[0].insertId);
        } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
      }
      _memoryHospitals.set(hospitalId, {
        id: hospitalId,
        ...input,
        contactPhone: input.contactPhone ?? null,
        updatedBy: ctx.user.id,
        updatedAt: new Date(),
      });
      await writeAudit(ctx.user.id, "hospital.create", "hospital", hospitalId, input.name);
      return { id: hospitalId };
    }),
    updateHospital: adminProcedure
      .input(hospitalInput.extend({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (
          !hasValidHospitalCapacity(
            input.totalEmergencyBeds,
            input.availableEmergencyBeds,
            input.totalIcuBeds,
            input.availableIcuBeds
          )
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Available beds cannot exceed the declared hospital capacity.",
          });
        const db = await database();
        if (db) {
          try {
            await db
              .update(hospitals)
              .set({ ...input, contactPhone: input.contactPhone ?? null, updatedBy: ctx.user.id })
              .where(eq(hospitals.id, input.id));
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        const mem = _memoryHospitals.get(input.id);
        if (mem) {
          Object.assign(mem, input);
          mem.updatedAt = new Date();
        }
        await writeAudit(ctx.user.id, "hospital.update", "hospital", input.id, input.name);
        return { success: true };
      }),
    updateMyHospitalResources: medicalOperationsProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          availableEmergencyBeds: z.number().int().min(0).max(1_000_000),
          availableIcuBeds: z.number().int().min(0).max(1_000_000),
          oxygenCylinderCount: z.number().int().min(0).max(1_000_000),
          bloodUnitCount: z.number().int().min(0).max(1_000_000),
          ambulanceCount: z.number().int().min(0).max(1_000_000),
          foodSupplyStatus: supplyStatusSchema,
          medicineSupplyStatus: supplyStatusSchema,
          waterSupplyStatus: supplyStatusSchema,
          powerBackupStatus: supplyStatusSchema,
          status: hospitalStatusSchema,
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "hospital" && ctx.user.role !== "medical")
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only an approved hospital staff account can publish live hospital resources.",
          });
        const db = await database();
        let assignedHospitalId: number | null = null;
        if (db) {
          try {
            const staff = (await db.select().from(hospitalStaffProfiles).where(eq(hospitalStaffProfiles.userId, ctx.user.id)).limit(1))[0];
            if (staff) assignedHospitalId = staff.hospitalId;
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        } else {
          const staff = Array.from(_memoryHospitalStaffProfiles.values()).find(s => s.userId === ctx.user.id);
          if (staff) assignedHospitalId = staff.hospitalId;
        }
        
        if (!canEditHospitalResources(ctx.user.role, assignedHospitalId, input.id)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You are not authorized to edit this hospital's resources." });
        }
        let existing = _memoryHospitals.get(input.id);
        if (db) {
          try {
            const dbExisting = (await db.select().from(hospitals).where(eq(hospitals.id, input.id)).limit(1))[0];
            if (dbExisting) existing = dbExisting as any;
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Hospital not found." });
        if (
          !hasValidHospitalCapacity(
            existing.totalEmergencyBeds,
            input.availableEmergencyBeds,
            existing.totalIcuBeds,
            input.availableIcuBeds
          )
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Available beds cannot exceed the declared total capacity of the hospital.",
          });
        }
        if (db) {
          try {
            await db.update(hospitals).set({ ...input, updatedBy: ctx.user.id }).where(eq(hospitals.id, input.id));
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        const mem = _memoryHospitals.get(input.id);
        if (mem) {
          Object.assign(mem, input);
          mem.updatedAt = new Date();
        }
        await writeAudit(
          ctx.user.id,
          "hospital.resources.update",
          "hospital",
          input.id,
          "Published live hospital resource update"
        );
        return { success: true };
      }),
    addFloodZone: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(180),
          severity: severitySchema,
          points: z.array(pointSchema).min(3).max(200),
        })
      )
      .mutation(async ({ input, ctx }) => {
        let zoneId = _memoryFloodZones.size + 1;
        const db = await database();
        if (db) {
          try {
            const result = await db.insert(floodZones).values({
              name: input.name,
              severity: input.severity,
              polygonJson: JSON.stringify(input.points),
              createdBy: ctx.user.id,
              active: "yes",
            });
            zoneId = Number(result[0].insertId);
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        _memoryFloodZones.set(zoneId, {
          id: zoneId,
          name: input.name,
          severity: input.severity,
          polygonJson: JSON.stringify(input.points),
          createdBy: ctx.user.id,
          active: "yes",
          updatedAt: new Date(),
        });
        await writeAudit(ctx.user.id, "floodZone.create", "floodZone", zoneId, input.name);
        return { id: zoneId };
      }),
  }),

  rescuer: router({
    myRegistration: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      if (db) {
        try {
          const res = (
            await db
              .select()
              .from(rescuerRegistrationRequests)
              .where(eq(rescuerRegistrationRequests.userId, ctx.user.id))
              .limit(1)
          )[0];
          if (res) return res;
        } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
      }
      return Array.from(_memoryRescuerRequests.values()).find(r => r.userId === ctx.user.id) ?? null;
    }),
    requestRegistration: protectedProcedure
      .input(z.object({ phone: z.string().trim().max(32).optional(), note: z.string().trim().max(1000).optional() }))
      .mutation(async ({ input, ctx }) => {
        if (!canRequestRescuerRegistration(ctx.user.role))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              ctx.user.role === "rescuer"
                ? "This account is already an authorized rescuer."
                : ctx.user.role === "medical"
                ? "Medical staff accounts cannot request field-rescuer access."
                : "Administrator accounts cannot request rescuer access.",
          });
        let existing: any = Array.from(_memoryRescuerRequests.values()).find(r => r.userId === ctx.user.id);
        const db = await database();
        if (db) {
          try {
            const dbExisting = (
              await db
                .select()
                .from(rescuerRegistrationRequests)
                .where(eq(rescuerRegistrationRequests.userId, ctx.user.id))
                .limit(1)
            )[0];
            if (dbExisting) existing = dbExisting;
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        let requestId = existing?.id || _memoryRescuerRequests.size + 1;
        if (db) {
          try {
            if (existing) {
              await db
                .update(rescuerRegistrationRequests)
                .set({
                  phone: input.phone ?? null,
                  note: input.note ?? null,
                  status: "pending",
                  reviewedBy: null,
                  reviewedAt: null,
                  reviewNote: null,
                })
                .where(eq(rescuerRegistrationRequests.id, existing.id));
            } else {
              const result = await db
                .insert(rescuerRegistrationRequests)
                .values({ userId: ctx.user.id, phone: input.phone ?? null, note: input.note ?? null, status: "pending" });
              requestId = Number(result[0].insertId);
            }
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        _memoryRescuerRequests.set(requestId, {
          id: requestId,
          userId: ctx.user.id,
          phone: input.phone ?? null,
          note: input.note ?? null,
          status: "pending",
          reviewedBy: null,
          reviewNote: null,
          reviewedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await writeAudit(
          ctx.user.id,
          "rescuerRegistration.request",
          "rescuerRegistration",
          requestId,
          input.note ?? null
        );
        return { success: true };
      }),
    profile: rescuerProcedure.query(({ ctx }) => getRescuerProfile(ctx.user.id)),
    missionMessages: rescuerProcedure
      .input(z.object({ missionId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const mission = await getMissionForRescuer(input.missionId, ctx.user.id);
        if (!mission) throw new TRPCError({ code: "FORBIDDEN", message: "This mission is not assigned to your account." });
        return getIncidentMessages(mission.incidentId);
      }),
    sendMissionMessage: rescuerProcedure
      .input(z.object({ missionId: z.number().int().positive(), message: z.string().trim().min(1).max(500) }))
      .mutation(async ({ input, ctx }) => {
        const mission = await getMissionForRescuer(input.missionId, ctx.user.id);
        if (!mission) throw new TRPCError({ code: "FORBIDDEN", message: "This mission is not assigned to your account." });
        if (mission.status === "resolved")
          throw new TRPCError({ code: "BAD_REQUEST", message: "This mission has already been resolved." });
        let messageId = _memoryIncidentMessages.length + 1;
        const db = await database();
        if (db) {
          try {
            const result = await db
              .insert(incidentMessages)
              .values({ incidentId: mission.incidentId, authorType: "rescuer", authorId: ctx.user.id, message: input.message });
            messageId = Number(result[0].insertId);
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        _memoryIncidentMessages.push({
          id: messageId,
          incidentId: mission.incidentId,
          authorType: "rescuer",
          authorId: ctx.user.id,
          message: input.message,
          createdAt: new Date(),
        });
        return { id: messageId };
      }),
    updateProfile: rescuerProcedure
      .input(
        z.object({
          phone: z.string().trim().max(32).nullable().optional(),
          contactSharing: z.enum(["yes", "no"]).optional(),
          photoDataUrl: z.string().max(1_500_000).nullable().optional(),
          clearPhoto: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const profile = await getRescuerProfile(ctx.user.id);
        const resultingPhone = input.phone !== undefined ? input.phone : profile?.phone;
        if (input.contactSharing === "yes" && !resultingPhone)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Add a contact number before enabling assignment contact sharing.",
          });
        const photo = readProfilePhoto(input.photoDataUrl);
        const uploaded = photo
          ? await storagePut(`rescuers/${ctx.user.id}/profile.${photo.extension}`, photo.bytes, photo.contentType)
          : null;
        const db = await database();
        if (db) {
          try {
            await db
              .update(rescueProfiles)
              .set({
                ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
                ...(input.contactSharing ? { contactSharing: input.contactSharing } : {}),
                ...(input.clearPhoto ? { photoKey: null, photoUrl: null } : {}),
                ...(uploaded ? { photoKey: uploaded.key, photoUrl: uploaded.url } : {}),
              })
              .where(eq(rescueProfiles.userId, ctx.user.id));
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        let mem = _memoryRescueProfiles.get(ctx.user.id);
        if (!mem) {
          mem = {
            id: _memoryRescueProfiles.size + 1,
            userId: ctx.user.id,
            callSign: ctx.user.name || `Rescuer #${ctx.user.id}`,
            phone: input.phone || null,
            photoKey: uploaded?.key || null,
            photoUrl: uploaded?.url || null,
            contactSharing: input.contactSharing || "no",
            locationSharing: "no",
            availability: "available",
            lastLatitude: 26.1445,
            lastLongitude: 91.7362,
            locationUpdatedAt: new Date(),
            updatedAt: new Date(),
          };
          _memoryRescueProfiles.set(ctx.user.id, mem);
        } else {
          if (input.phone !== undefined) mem.phone = input.phone || null;
          if (input.contactSharing) mem.contactSharing = input.contactSharing;
          if (input.clearPhoto) { mem.photoKey = null; mem.photoUrl = null; }
          if (uploaded) { mem.photoKey = uploaded.key; mem.photoUrl = uploaded.url; }
          mem.updatedAt = new Date();
        }
        await writeAudit(
          ctx.user.id,
          "rescuer.profile.update",
          "rescueProfile",
          mem.id,
          input.clearPhoto
            ? "Cleared profile photo"
            : uploaded
            ? "Updated profile photo"
            : "Updated profile sharing preferences"
        );
        return { success: true };
      }),
    updateLiveLocation: rescuerProcedure
      .input(z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }))
      .mutation(async ({ input, ctx }) => {
        const profile = await getRescuerProfile(ctx.user.id);
        if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Rescuer profile not found." });
        const hasOpenMission = (await listMissionsForRescuer(ctx.user.id)).some(
          ({ mission }) => mission.status !== "resolved"
        );
        if (!hasOpenMission)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Live location updates are available only during an active assigned mission.",
          });
        const db = await database();
        if (db) {
          try {
            await db
              .update(rescueProfiles)
              .set({
                locationSharing: "yes",
                lastLatitude: input.latitude,
                lastLongitude: input.longitude,
                locationUpdatedAt: new Date(),
              })
              .where(eq(rescueProfiles.userId, ctx.user.id));
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        const mem = _memoryRescueProfiles.get(ctx.user.id);
        if (mem) {
          mem.locationSharing = "yes";
          mem.lastLatitude = input.latitude;
          mem.lastLongitude = input.longitude;
          mem.locationUpdatedAt = new Date();
          mem.updatedAt = new Date();
        }
        return { success: true };
      }),
    notifyHospital: rescuerProcedure
      .input(
        z.object({
          incidentId: z.number().int().positive(),
          hospitalId: z.number().int().positive(),
          severity: z.enum(["critical", "high", "medium", "low"]).default("high"),
          patientCount: z.number().int().min(1).max(100).default(1),
          estimatedArrivalMinutes: z.number().int().min(1).max(300).default(15),
          requiredDepartment: z.string().trim().min(1).max(120).default("Emergency & Trauma"),
          icuRequired: z.enum(["yes", "no"]).default("no"),
          oxygenRequired: z.enum(["yes", "no"]).default("no"),
          notes: z.string().trim().max(1000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const hospital = (await listHospitals()).find(h => h.id === input.hospitalId);
        const hospitalName = hospital?.name || `Hospital #${input.hospitalId}`;
        const incident = await getIncidentById(input.incidentId);

        const record = await createHospitalCaseNotification({
          incidentId: input.incidentId,
          hospitalId: input.hospitalId,
          rescuerId: ctx.user.id,
          severity: input.severity,
          patientCount: input.patientCount,
          estimatedArrivalMinutes: input.estimatedArrivalMinutes,
          requiredDepartment: input.requiredDepartment,
          icuRequired: input.icuRequired,
          oxygenRequired: input.oxygenRequired,
          notes: input.notes,
        });

        // Add to incident events timeline
        await addIncidentEvent(
          input.incidentId,
          ctx.user.id,
          "hospital_notified",
          `Hospital Inbound Alert: ${hospitalName}`,
          `Field Unit notified ${hospitalName} — Inbound with ${input.patientCount} patient(s). ETA: ${input.estimatedArrivalMinutes} mins. Department: ${input.requiredDepartment}${input.icuRequired === "yes" ? " [ICU Required]" : ""}${input.oxygenRequired === "yes" ? " [Oxygen Required]" : ""}.`
        );

        // Add audit log
        await writeAudit(
          ctx.user.id,
          "hospital.notified",
          "incident",
          input.incidentId,
          `Notified ${hospitalName} of incoming case (ETA: ${input.estimatedArrivalMinutes} min)`
        );

        return { success: true, notification: record };
      }),
    missions: rescuerProcedure.query(({ ctx }) => listMissionsForRescuer(ctx.user.id)),
    notifications: rescuerProcedure.query(async ({ ctx }) => ({
      items: await listNotificationFeed(ctx.user.id),
      unread: await unreadNotificationCount(ctx.user.id),
    })),
    pushConfig: rescuerProcedure.query(() => ({
      enabled: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT),
      publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    })),
    subscribePush: rescuerProcedure
      .input(
        z.object({
          endpoint: z.string().url().max(4096),
          p256dh: z.string().min(20).max(512),
          auth: z.string().min(10).max(512),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await database();
        const endpointHash = createHash("sha256").update(input.endpoint).digest("hex");
        if (db) {
          try {
            await db
              .insert(pushSubscriptions)
              .values({
                userId: ctx.user.id,
                endpointHash,
                endpoint: input.endpoint,
                p256dh: input.p256dh,
                auth: input.auth,
              })
              .onDuplicateKeyUpdate({
                set: {
                  userId: ctx.user.id,
                  endpoint: input.endpoint,
                  p256dh: input.p256dh,
                  auth: input.auth,
                  updatedAt: new Date(),
                },
              });
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        await writeAudit(ctx.user.id, "push.subscribe", "pushSubscription", endpointHash);
        return { success: true };
      }),
    setAvailability: rescuerProcedure
      .input(
        z.object({
          availability: z.enum(["available", "on_mission", "off_duty"]),
          latitude: z.number().min(-90).max(90).optional(),
          longitude: z.number().min(-180).max(180).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const profile = await getRescuerProfile(ctx.user.id);
        if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Rescuer profile not found." });
        const hasOpenMission = (await listMissionsForRescuer(ctx.user.id)).some(
          ({ mission }) => mission.status !== "resolved"
        );
        if (hasOpenMission && input.availability === "off_duty")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Resolve or hand off your active mission before going off duty.",
          });
        const db = await database();
        if (db) {
          try {
            await db
              .update(rescueProfiles)
              .set({
                availability: input.availability,
                lastLatitude: input.latitude ?? profile.lastLatitude,
                lastLongitude: input.longitude ?? profile.lastLongitude,
              })
              .where(eq(rescueProfiles.userId, ctx.user.id));
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        const mem = _memoryRescueProfiles.get(ctx.user.id);
        if (mem) {
          mem.availability = input.availability;
          mem.lastLatitude = input.latitude ?? profile.lastLatitude;
          mem.lastLongitude = input.longitude ?? profile.lastLongitude;
          mem.updatedAt = new Date();
        }
        await writeAudit(ctx.user.id, "rescuer.availability", "rescueProfile", profile.id, input.availability);
        return { success: true };
      }),
    updateMission: rescuerProcedure
      .input(
        z.object({
          missionId: z.number().int().positive(),
          status: z.enum(["dispatched", "resolved"]),
          notes: z.string().trim().max(2000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const mission = await getMissionForRescuer(input.missionId, ctx.user.id);
        if (!mission) throw new TRPCError({ code: "NOT_FOUND", message: "Assigned mission not found." });
        const allowed = isAllowedMissionTransition(mission.status, input.status);
        if (!allowed)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Mission status must progress from Pending to Dispatched to Resolved.",
          });
        const now = new Date();
        const db = await database();
        if (db) {
          try {
            await db
              .update(missions)
              .set({
                status: input.status,
                notes: input.notes ?? mission.notes,
                ...(input.status === "dispatched" ? { dispatchedAt: now } : { resolvedAt: now }),
              })
              .where(eq(missions.id, mission.id));
            await db
              .update(incidents)
              .set({
                status: input.status,
                ...(input.status === "dispatched" ? { dispatchedAt: now } : { resolvedAt: now }),
              })
              .where(eq(incidents.id, mission.incidentId));
            if (input.status === "resolved")
              await db.update(rescueProfiles).set({ availability: "available", locationSharing: "no", lastLatitude: null, lastLongitude: null, locationUpdatedAt: null }).where(eq(rescueProfiles.userId, ctx.user.id));
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        const memMission = _memoryMissions.get(mission.id);
        if (memMission) {
          memMission.status = input.status;
          memMission.notes = input.notes ?? mission.notes;
          if (input.status === "dispatched") memMission.dispatchedAt = now;
          else memMission.resolvedAt = now;
          memMission.updatedAt = new Date();
        }
        const memIncident = _memoryIncidents.get(mission.incidentId);
        if (memIncident) {
          memIncident.status = input.status;
          if (input.status === "dispatched") memIncident.dispatchedAt = now;
          else memIncident.resolvedAt = now;
          memIncident.updatedAt = new Date();
        }
        if (input.status === "resolved") {
          const memProf = _memoryRescueProfiles.get(ctx.user.id);
          if (memProf) {
            memProf.availability = "available";
            memProf.locationSharing = "no";
            memProf.lastLatitude = null;
            memProf.lastLongitude = null;
            memProf.locationUpdatedAt = null;
            memProf.updatedAt = new Date();
          }
        }
        await addIncidentEvent(
          mission.incidentId,
          ctx.user.id,
          `mission_${input.status}`,
          input.status === "dispatched" ? "Rescuer dispatched" : "Rescue resolved",
          input.notes ?? null
        );
        await writeAudit(ctx.user.id, "mission.update", "mission", mission.id, input.status);
        return { success: true };
      }),
    markNotificationRead: rescuerProcedure
      .input(z.object({ notificationId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await database();
        if (db) {
          try {
            await db
              .update(notifications)
              .set({ readAt: new Date() })
              .where(and(eq(notifications.id, input.notificationId), eq(notifications.recipientId, ctx.user.id)));
          } catch (err) { if (process.env.NODE_ENV === 'production') throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database operation failed in production' }); }
        }
        const notif = _memoryNotifications.find(n => n.id === input.notificationId && n.recipientId === ctx.user.id);
        if (notif) notif.readAt = new Date();
        await writeAudit(ctx.user.id, "notification.read", "notification", input.notificationId);
        return { success: true };
      }),
  }),

  weather: router({
    current: publicProcedure
      .input(
        z
          .object({
            latitude: z.number().min(-90).max(90).optional(),
            longitude: z.number().min(-180).max(180).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const latitude = input?.latitude ?? 26.1445;
        const longitude = input?.longitude ?? 91.7362;
        const weather = await getComprehensiveWeather(latitude, longitude);
        return {
          available: weather.available,
          provider: weather.provider,
          updatedAt: weather.updatedAt,
          location: weather.location,
          current: weather.current,
        };
      }),
    forecast: publicProcedure
      .input(
        z
          .object({
            latitude: z.number().min(-90).max(90).optional(),
            longitude: z.number().min(-180).max(180).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const latitude = input?.latitude ?? 26.1445;
        const longitude = input?.longitude ?? 91.7362;
        const weather = await getComprehensiveWeather(latitude, longitude);
        return {
          available: weather.available,
          provider: weather.provider,
          updatedAt: weather.updatedAt,
          forecast: weather.forecast,
          trend: weather.trend,
        };
      }),
    floodAlerts: publicProcedure
      .input(
        z
          .object({
            latitude: z.number().min(-90).max(90).optional(),
            longitude: z.number().min(-180).max(180).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const latitude = input?.latitude ?? 26.1445;
        const longitude = input?.longitude ?? 91.7362;
        const db = await database();
        let activeZonesCount = 0;
        if (db) {
          try {
            const zones = await db.select({ id: floodZones.id }).from(floodZones).where(eq(floodZones.active, "yes"));
            activeZonesCount = zones.length;
          } catch {
            activeZonesCount = Array.from(_memoryFloodZones.values()).filter((z) => z.active === "yes").length;
          }
        } else {
          activeZonesCount = Array.from(_memoryFloodZones.values()).filter((z) => z.active === "yes").length;
        }
        const weather = await getComprehensiveWeather(latitude, longitude, activeZonesCount);
        return {
          available: weather.available,
          floodRisk: weather.floodRisk,
          riverGauge: weather.river,
        };
      }),
    airQuality: publicProcedure
      .input(
        z
          .object({
            latitude: z.number().min(-90).max(90).optional(),
            longitude: z.number().min(-180).max(180).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const latitude = input?.latitude ?? 26.1445;
        const longitude = input?.longitude ?? 91.7362;
        const weather = await getComprehensiveWeather(latitude, longitude);
        return {
          available: weather.available,
          updatedAt: weather.updatedAt,
          airQuality: weather.airQuality,
        };
      }),
    alerts: publicProcedure
      .input(
        z
          .object({
            latitude: z.number().min(-90).max(90).optional(),
            longitude: z.number().min(-180).max(180).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const latitude = input?.latitude ?? 26.1445;
        const longitude = input?.longitude ?? 91.7362;
        const weather = await getComprehensiveWeather(latitude, longitude);
        return {
          available: weather.available,
          updatedAt: weather.updatedAt,
          alerts: weather.alerts,
        };
      }),
    comprehensive: publicProcedure
      .input(
        z
          .object({
            latitude: z.number().min(-90).max(90).optional(),
            longitude: z.number().min(-180).max(180).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const latitude = input?.latitude ?? 26.1445;
        const longitude = input?.longitude ?? 91.7362;
        return getComprehensiveWeather(latitude, longitude);
      }),
    locations: publicProcedure.query(() => {
      return ASSAM_DISTRICT_LOCATIONS;
    }),
    providerHealth: publicProcedure.query(() => {
      return weatherProviderManager.getHealthReport();
    }),
  }),

  profile: router({
    update: publicProcedure
      .input(
        z.object({
          name: z.string().min(1, "Name cannot be empty").optional(),
          phone: z.string().optional(),
          emergencyContact: z.string().optional(),
          bloodGroup: z.string().optional(),
          medicalNotes: z.string().optional(),
          homeDistrict: z.string().optional(),
          address: z.string().optional(),
          preferredLanguage: z.string().optional(),
          safetyNotifications: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in to update your profile." });
        }
        const updated = {
          ...ctx.user,
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
          ...(input.emergencyContact !== undefined ? { emergencyContact: input.emergencyContact.trim() } : {}),
          ...(input.bloodGroup !== undefined ? { bloodGroup: input.bloodGroup.trim() } : {}),
          ...(input.medicalNotes !== undefined ? { medicalNotes: input.medicalNotes.trim() } : {}),
          ...(input.homeDistrict !== undefined ? { homeDistrict: input.homeDistrict.trim() } : {}),
          ...(input.address !== undefined ? { address: input.address.trim() } : {}),
          ...(input.preferredLanguage !== undefined ? { preferredLanguage: input.preferredLanguage.trim() } : {}),
          ...(input.safetyNotifications !== undefined ? { safetyNotifications: input.safetyNotifications } : {}),
          updatedAt: new Date(),
        };

        await upsertUser(updated);
        const refreshed = await getUserByOpenId(ctx.user.openId);
        return {
          success: true,
          user: refreshed || updated,
        };
      }),
  }),

  emergencyContacts: router({
    list: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return await getEmergencyContactsByUserId(ctx.user.id);
    }),
    upsert: publicProcedure
      .input(
        z.object({
          id: z.number().optional(),
          name: z.string().min(1, "Contact name is required"),
          relation: z.string().min(1, "Relation is required"),
          phone: z.string().min(1, "Phone number is required"),
          alternatePhone: z.string().optional(),
          isPrimary: z.enum(["yes", "no"]).default("no"),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in to manage emergency contacts." });
        }
        return await upsertEmergencyContact({
          ...input,
          userId: ctx.user.id,
        });
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in to delete emergency contacts." });
        }
        return await deleteEmergencyContact(input.id, ctx.user.id);
      }),
    getForUser: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user || (ctx.user.role !== "admin" && ctx.user.role !== "rescuer" && ctx.user.role !== "hospital" && ctx.user.role !== "medical" && ctx.user.id !== input.userId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access restricted to emergency personnel (Admin, Rescuer, Hospital)." });
        }
        return await getEmergencyContactsByUserId(input.userId);
      }),
    getForIncident: publicProcedure
      .input(z.object({ incidentId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user || (ctx.user.role !== "admin" && ctx.user.role !== "rescuer" && ctx.user.role !== "hospital" && ctx.user.role !== "medical")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access restricted to emergency response personnel." });
        }
        const incident = await getIncidentById(input.incidentId);
        if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found" });
        if (!incident.reporterId) return [];
        return await getEmergencyContactsByUserId(incident.reporterId);
      }),
  }),
});
