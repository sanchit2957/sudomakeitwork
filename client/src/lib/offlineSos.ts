export type OfflineSosPayload = {
  contactName?: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  emergencyType: "flood" | "medical" | "trapped" | "evacuation" | "other";
  severity: "critical" | "high" | "medium" | "low";
  peopleAffected: number;
  notes?: string;
  evidenceDataUrl?: string;
  voiceNoteDataUrl?: string;
  voiceNoteDurationSeconds?: number;
  guestKey: string;
};

export type QueuedSos = OfflineSosPayload & { id: string; createdAt: number };

const STORAGE_KEY = "sudo-makeitwork-sos-outbox-v1";
const signal = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("sudo-sos-outbox"));
};

export function readOfflineSosOutbox(): QueuedSos[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function queueOfflineSos(payload: OfflineSosPayload) {
  const next = [...readOfflineSosOutbox(), { ...payload, id: crypto.randomUUID(), createdAt: Date.now() }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  signal();
  return next.length;
}

export async function flushOfflineSos(send: (payload: OfflineSosPayload) => Promise<{ publicCode: string }>) {
  const pending = readOfflineSosOutbox();
  const delivered: string[] = [];
  const remaining: QueuedSos[] = [];
  for (const entry of pending) {
    try {
      const { id: _id, createdAt: _createdAt, ...payload } = entry;
      const result = await send(payload);
      delivered.push(result.publicCode);
    } catch {
      remaining.push(entry);
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  signal();
  return { delivered, remaining: remaining.length };
}
