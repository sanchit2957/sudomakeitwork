/**
 * Offline SOS outbox — IndexedDB-first with localStorage fallback.
 *
 * When a citizen taps the SOS button with no network:
 *  1. The payload is written to IndexedDB (robust, large capacity, SW-accessible)
 *  2. A Service Worker Background Sync is registered ("sos-outbox-sync")
 *     so the SOS is delivered even after the user closes the browser
 *  3. If IndexedDB is unavailable (very rare), falls back to localStorage
 *
 * On reconnect:
 *  - The Service Worker sync event fires → reads IDB → POSTs to /api/sos/offline
 *  - OR the app's online listener calls flushOfflineSos() as a belt-and-suspenders
 */

import {
  type SosPayload,
  type SosRecord,
  markSosDelivered,
  markSosFailed,
  queueSosToDb,
  readPendingSos,
  purgeSosOlderThan,
} from "./offlineSosDb";

// Re-export types for consumers
export type OfflineSosPayload = SosPayload;
export type QueuedSos = SosPayload & { id: string; createdAt: number };

const STORAGE_KEY = "sudo-makeitwork-sos-outbox-v1";

const signal = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("sudo-sos-outbox"));
};

// ─── Migration: move old localStorage entries to IndexedDB ──────────

async function migrateLocalStorageToIdb(): Promise<void> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    for (const entry of parsed) {
      if (entry && entry.locationLabel) {
        const { id: _id, createdAt: _createdAt, ...payload } = entry;
        await queueSosToDb(payload as SosPayload);
      }
    }
    // Clear localStorage after successful migration
    localStorage.removeItem(STORAGE_KEY);
    console.log(`[OfflineSOS] Migrated ${parsed.length} entry(ies) from localStorage to IndexedDB`);
  } catch {
    // Migration failure is non-fatal; old entries stay in localStorage
  }
}

// Run migration once on load
let migrationDone = false;
export function _resetMigrationForTesting() {
  migrationDone = false;
}

async function ensureMigration() {
  if (migrationDone) return;
  migrationDone = true;
  await migrateLocalStorageToIdb();
}

// ─── Background Sync registration ───────────────────────────────────

async function registerBackgroundSync(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if ("sync" in registration) {
        await (registration as any).sync.register("sos-outbox-sync");
        console.log("[OfflineSOS] Background Sync registered: sos-outbox-sync");
      }
    }
  } catch {
    // Background Sync is not available in all browsers; delivery falls back to online event
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Read all pending (undelivered) SOS entries from IndexedDB.
 * Falls back to localStorage if IndexedDB is unavailable.
 */
export async function readOfflineSosOutbox(): Promise<QueuedSos[]> {
  try {
    await ensureMigration();
    const records = await readPendingSos();
    return records.map((r) => ({
      ...r.payload,
      id: r.id,
      createdAt: r.createdAt,
    }));
  } catch {
    // IndexedDB unavailable — read from localStorage
    return readFromLocalStorage();
  }
}

/**
 * Queue an SOS payload for offline delivery.
 * Writes to IndexedDB first, registers Background Sync, falls back to localStorage.
 */
export async function queueOfflineSos(payload: OfflineSosPayload): Promise<number> {
  try {
    await ensureMigration();
    await queueSosToDb(payload);
    await registerBackgroundSync();
    signal();
    const pending = await readPendingSos();
    return pending.length;
  } catch {
    // IndexedDB unavailable — fall back to localStorage
    const next = [...readFromLocalStorage(), { ...payload, id: crypto.randomUUID(), createdAt: Date.now() }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    signal();
    return next.length;
  }
}

/**
 * Attempt to deliver all pending SOS entries.
 * Called by the app when the device comes back online (belt-and-suspenders with Background Sync).
 *
 * @param send - Function that delivers one SOS payload to the server. Must return { publicCode }.
 */
export async function flushOfflineSos(
  send: (payload: OfflineSosPayload) => Promise<{ publicCode: string }>
): Promise<{ delivered: string[]; remaining: number }> {
  try {
    await ensureMigration();
  } catch {}

  // First, try IndexedDB
  try {
    const pending = await readPendingSos();
    const delivered: string[] = [];
    let remaining = 0;

    for (const record of pending) {
      try {
        const result = await send(record.payload);
        await markSosDelivered(record.id);
        delivered.push(result.publicCode);
      } catch {
        await markSosFailed(record.id);
        remaining++;
      }
    }

    // Purge old delivered records (older than 7 days)
    try { await purgeSosOlderThan(); } catch {}

    signal();
    return { delivered, remaining };
  } catch {
    // IndexedDB unavailable — flush from localStorage
    return flushFromLocalStorage(send);
  }
}

/**
 * Returns count of pending SOS entries (for badge display).
 */
export async function pendingSosCount(): Promise<number> {
  try {
    await ensureMigration();
    const records = await readPendingSos();
    return records.length;
  } catch {
    return readFromLocalStorage().length;
  }
}

// ─── localStorage fallback (for environments without IndexedDB) ─────

function readFromLocalStorage(): QueuedSos[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function flushFromLocalStorage(
  send: (payload: OfflineSosPayload) => Promise<{ publicCode: string }>
): Promise<{ delivered: string[]; remaining: number }> {
  const pending = readFromLocalStorage();
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
