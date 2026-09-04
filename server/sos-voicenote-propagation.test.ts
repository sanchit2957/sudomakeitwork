import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import {
  _memoryIncidents,
  _memoryMissionOffers,
  _memoryMissions,
  _memoryRescueProfiles,
  _memoryUsers,
} from "./rescue.db";
import { setRescuerSessionStartedAt } from "./routers/rescue";
import type { TrpcContext } from "./_core/context";

// Valid small dummy 1-second WebM audio base64
const VALID_WEBM_DATA_URL =
  "data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAA145+A";

// Valid small dummy M4A audio base64
const VALID_M4A_DATA_URL =
  "data:audio/mp4;codecs=mp4a.40.2;base64,AAAAHGZ0eXBtcDQyAAAAAWlzb21tcDQyAAACAG1vb3Y=";

function createCitizenContext(id: number = 55): TrpcContext {
  const now = new Date();
  const user = {
    id,
    openId: `citizen-user-${id}`,
    name: `Citizen ${id}`,
    email: `citizen${id}@example.com`,
    loginMethod: "test",
    role: "user" as const,
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
  _memoryUsers.set(String(id), user as any);
  return {
    user,
    req: { headers: {} } as any,
    res: { cookie: () => {} } as any,
  };
}

function createRescuerContext(id: number = 77, sessionStartedAt?: number): TrpcContext {
  const now = new Date();
  const user = {
    id,
    openId: `rescuer-unit-${id}`,
    name: `Officer ${id}`,
    email: `rescuer${id}@sdrf.gov.in`,
    loginMethod: "test",
    role: "rescuer" as const,
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    sessionStartedAt,
  };
  _memoryUsers.set(String(id), user as any);
  _memoryRescueProfiles.set(id, {
    id,
    userId: id,
    callSign: `Officer ${id}`,
    availability: "available",
  } as any);
  return {
    user,
    req: { headers: {} } as any,
    res: { cookie: () => {} } as any,
  };
}

describe("SOS Voice Note End-to-End Propagation & Resilience Suite", () => {
  beforeEach(() => {
    _memoryIncidents.clear();
    _memoryMissionOffers.clear();
    _memoryMissions.clear();
  });

  it(
    "TEST 1: Citizen creates SOS with voice note -> persisted with voiceNoteUrl and retrievable",
    async () => {
    const citizenCtx = createCitizenContext(101);
    const citizenCaller = appRouter.createCaller(citizenCtx);

    const sos = await citizenCaller.rescue.emergency.create({
      contactName: "Bhaben Baruah",
      locationLabel: "Hatigaon Chariali, Guwahati",
      latitude: 26.1385,
      longitude: 91.7912,
      emergencyType: "flood",
      severity: "high",
      peopleAffected: 3,
      notes: "Water reached waist level. Family stranded on first floor.",
      voiceNoteDataUrl: VALID_WEBM_DATA_URL,
      voiceNoteDurationSeconds: 15,
    });

    expect(sos.publicCode).toMatch(/^SOS-/);
    expect(sos.voiceNoteUrl).toBeTruthy();

    // Verify incident in memory
    const stored = _memoryIncidents.get(sos.incidentId);
    expect(stored).toBeDefined();
    expect(stored?.voiceNoteUrl).toBe(sos.voiceNoteUrl);
    expect(stored?.voiceNoteDurationSeconds).toBe(15);
  }, 45000);

  it("TEST 2: Rescuer receives incoming offer -> activeOffer includes voiceNoteUrl and duration", async () => {
    const rescuerId = 202;
    const sessionStart = Date.now() - 5_000;
    setRescuerSessionStartedAt(rescuerId, sessionStart);

    const incidentTime = new Date();
    const incidentId = 88;
    const publicCode = "SOS-VNTEST88";
    const voiceNoteUrl = "/uploads/incidents/SOS-VNTEST88/voice-note_test123.webm";

    _memoryIncidents.set(incidentId, {
      id: incidentId,
      publicCode,
      locationLabel: "Zoo Road Tiniali",
      latitude: 26.173,
      longitude: 91.782,
      emergencyType: "trapped",
      severity: "critical",
      peopleAffected: 2,
      notes: "Elderly resident needs boat rescue",
      voiceNoteUrl,
      voiceNoteDurationSeconds: 22,
      status: "pending",
      dispatchStatus: "offered",
      createdAt: incidentTime,
      updatedAt: incidentTime,
    } as any);

    _memoryMissionOffers.set(8801, {
      id: 8801,
      incidentId,
      rescuerId,
      status: "offered",
      distanceKm: 1.4,
      matchScore: 92,
      offeredAt: incidentTime,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: incidentTime,
    } as any);

    const rescuerCtx = createRescuerContext(rescuerId, sessionStart);
    const rescuerCaller = appRouter.createCaller(rescuerCtx);

    const offerResult = await rescuerCaller.rescue.rescuer.activeOffer();

    expect(offerResult.hasOffer).toBe(true);
    expect(offerResult.incident).toBeDefined();
    expect(offerResult.incident?.publicCode).toBe(publicCode);
    expect(offerResult.incident?.voiceNoteUrl).toBe(voiceNoteUrl);
    expect(offerResult.incident?.voiceNoteDurationSeconds).toBe(22);
  });

  it("TEST 3: Rescuer accepts offer -> mission list preserves incident voiceNoteUrl for playback", async () => {
    const rescuerId = 303;
    const missionId = 55;
    const incidentId = 99;
    const voiceNoteUrl = "/uploads/incidents/SOS-VNTEST99/voice-note_abc.webm";

    _memoryIncidents.set(incidentId, {
      id: incidentId,
      publicCode: "SOS-ACCEPT99",
      locationLabel: "Dispur Supermarket",
      latitude: 26.142,
      longitude: 91.798,
      emergencyType: "medical",
      severity: "critical",
      peopleAffected: 1,
      notes: "Cardiac emergency during flood evacuation",
      voiceNoteUrl,
      voiceNoteDurationSeconds: 30,
      status: "dispatched",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    _memoryMissions.set(missionId, {
      id: missionId,
      incidentId,
      rescuerId,
      status: "pending",
      assignedAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const rescuerCtx = createRescuerContext(rescuerId);
    const rescuerCaller = appRouter.createCaller(rescuerCtx);

    const missionsList = await rescuerCaller.rescue.rescuer.missions();
    expect(missionsList.length).toBeGreaterThanOrEqual(1);

    const matchingMission = missionsList.find(m => m.incident.publicCode === "SOS-ACCEPT99");
    expect(matchingMission).toBeDefined();
    expect(matchingMission?.incident.voiceNoteUrl).toBe(voiceNoteUrl);
  });

  it("TEST 4: Citizen creates SOS without voice note -> succeeds normally with voiceNoteUrl: null", async () => {
    const citizenCtx = createCitizenContext(102);
    const citizenCaller = appRouter.createCaller(citizenCtx);

    const sos = await citizenCaller.rescue.emergency.create({
      contactName: "Pranab Saikia",
      locationLabel: "Kahilipara",
      latitude: 26.13,
      longitude: 91.76,
      emergencyType: "evacuation",
      severity: "medium",
      peopleAffected: 2,
    });

    expect(sos.publicCode).toMatch(/^SOS-/);
    expect(sos.voiceNoteUrl).toBeNull();

    const stored = _memoryIncidents.get(sos.incidentId);
    expect(stored?.voiceNoteUrl).toBeNull();
  });

  it("TEST 5: Citizen creates SOS with M4A/AAC audio -> correctly accepted and saved", async () => {
    const citizenCtx = createCitizenContext(103);
    const citizenCaller = appRouter.createCaller(citizenCtx);

    const sos = await citizenCaller.rescue.emergency.create({
      contactName: "Rituparna Sharma",
      locationLabel: "Chandmari Colony",
      latitude: 26.191,
      longitude: 91.778,
      emergencyType: "trapped",
      severity: "high",
      peopleAffected: 1,
      voiceNoteDataUrl: VALID_M4A_DATA_URL,
      voiceNoteDurationSeconds: 8,
    });

    expect(sos.publicCode).toMatch(/^SOS-/);
    expect(sos.voiceNoteUrl).toBeTruthy();

    const stored = _memoryIncidents.get(sos.incidentId);
    expect(stored?.voiceNoteUrl).toBeTruthy();
    expect(stored?.voiceNoteDurationSeconds).toBe(8);
  });

  it("TEST 6: Corrupt or unrecognized audio data does NOT crash or abort SOS creation", async () => {
    const citizenCtx = createCitizenContext(104);
    const citizenCaller = appRouter.createCaller(citizenCtx);

    // Provide malformed data URL
    const sos = await citizenCaller.rescue.emergency.create({
      contactName: "Anil Bora",
      locationLabel: "Maligaon Gate 4",
      latitude: 26.155,
      longitude: 91.701,
      emergencyType: "flood",
      severity: "critical",
      peopleAffected: 4,
      voiceNoteDataUrl: "data:application/octet-stream;base64,not-audio-data",
      voiceNoteDurationSeconds: 10,
    });

    // The critical safety rule: The SOS MUST SUCCEED to protect the victim!
    expect(sos.publicCode).toMatch(/^SOS-/);
    expect(sos.voiceNoteUrl).toBeNull();

    const stored = _memoryIncidents.get(sos.incidentId);
    expect(stored).toBeDefined();
    expect(stored?.status).toBe("pending");
  });
});
