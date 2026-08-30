/**
 * IndexedDB-backed offline SOS storage.
 *
 * Provides reliable, high-capacity persistence for SOS payloads that are
 * queued when the citizen's device has no network connectivity (e.g. during
 * Assam floods when cellular towers go down).
 *
 * Unlike localStorage (5 MB, synchronous, string-only), IndexedDB supports:
 *  - Megabytes of binary blob storage (voice notes, photos) without base64
 *  - Asynchronous, non-blocking reads/writes
 *  - Structured cloning (stores objects directly)
 *  - Access from Service Workers (required for Background Sync delivery)
 */

const DB_NAME = "sudo-makeitwork-sos";
const DB_VERSION = 1;
const STORE_NAME = "outbox";

export type SosRecord = {
  /** Auto-generated UUID */
  id: string;
  /** ISO timestamp of when the user pressed the SOS button */
  createdAt: number;
  /** Delivery status: pending = awaiting network, delivered = sent to server */
  status: "pending" | "delivered";
  /** Number of delivery attempts made so far */
  retryCount: number;
  /** ISO timestamp of successful delivery (null until delivered) */
  deliveredAt: number | null;
  /** The SOS payload to send to the backend */
  payload: SosPayload;
};

export type SosPayload = {
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

// ─── Database lifecycle ───────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Opens (or creates) the SOS IndexedDB database.
 * Returns a cached promise so multiple callers share the same connection.
 */
export function openSosDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

/** Reset the cached connection (useful for tests). */
export function _resetDbPromise() {
  dbPromise = null;
}

// ─── CRUD operations ─────────────────────────────────────────────────

/**
 * Queues an SOS payload in IndexedDB for later delivery.
 * Returns the generated record ID.
 */
export async function queueSosToDb(payload: SosPayload): Promise<string> {
  const db = await openSosDb();
  const id = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const record: SosRecord = {
    id,
    createdAt: Date.now(),
    status: "pending",
    retryCount: 0,
    deliveredAt: null,
    payload,
  };
  return new Promise<string>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Returns all SOS records with status === "pending", ordered by createdAt.
 */
export async function readPendingSos(): Promise<SosRecord[]> {
  const db = await openSosDb();
  return new Promise<SosRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("status");
    const request = index.getAll("pending");
    request.onsuccess = () => {
      const results = (request.result as SosRecord[]) || [];
      results.sort((a, b) => a.createdAt - b.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Returns ALL records (pending + delivered) for diagnostics or UI display.
 */
export async function readAllSos(): Promise<SosRecord[]> {
  const db = await openSosDb();
  return new Promise<SosRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as SosRecord[]) || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Marks a record as successfully delivered.
 */
export async function markSosDelivered(id: string): Promise<void> {
  const db = await openSosDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result as SosRecord | undefined;
      if (!record) { resolve(); return; }
      record.status = "delivered";
      record.deliveredAt = Date.now();
      store.put(record);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Increments the retry counter for a failed delivery attempt.
 * The record stays "pending" so it will be retried.
 */
export async function markSosFailed(id: string): Promise<void> {
  const db = await openSosDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result as SosRecord | undefined;
      if (!record) { resolve(); return; }
      record.retryCount += 1;
      store.put(record);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Deletes delivered records older than the given age in milliseconds.
 * Default: 7 days. Call periodically to prevent unbounded storage growth.
 */
export async function purgeSosOlderThan(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const db = await openSosDb();
  const cutoff = Date.now() - maxAgeMs;
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    let purged = 0;
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const record = cursor.value as SosRecord;
      if (record.status === "delivered" && record.createdAt < cutoff) {
        cursor.delete();
        purged++;
      }
      cursor.continue();
    };
    tx.oncomplete = () => resolve(purged);
    tx.onerror = () => reject(tx.error);
  });
}
