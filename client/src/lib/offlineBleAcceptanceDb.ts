/**
 * IndexedDB storage for offline Rescuer BLE acceptances.
 *
 * When a rescuer operating offline detects a BLE SOS beacon and taps "Accept Mission",
 * the acceptance is persisted here immediately. When internet connectivity returns,
 * the Responder panel flushes these acceptances to the server via
 * trpc.rescue.rescuer.submitOfflineBleAcceptance.
 */

const DB_NAME = "sudo-makeitwork-ble-acceptances";
const DB_VERSION = 1;
const STORE_NAME = "acceptances";

export type OfflineBleAcceptanceRecord = {
  /** Unique acceptance UUID */
  id: string;
  /** BLE Beacon ID (e.g. 8-char alphanumeric 'K8N2X9P1') */
  bleBeaconId: string;
  /** Timestamp when rescuer tapped Accept */
  acceptedAt: number;
  /** Rescuer user ID */
  rescuerId: number;
  /** Rescuer location at acceptance time if known */
  rescuerLatitude?: number;
  rescuerLongitude?: number;
  /** Synchronisation status */
  syncStatus: "pending" | "synced" | "failed" | "conflict";
  /** Error message or conflict detail if server rejected */
  syncError?: string;
  /** Public code of assigned incident once reconciled */
  assignedPublicCode?: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function openBleAcceptancesDb(): Promise<IDBDatabase> {
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
        const store = db.createObjectStore(STORE_NAME, { keyPath: "bleBeaconId" });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
        store.createIndex("acceptedAt", "acceptedAt", { unique: false });
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

export async function recordOfflineBleAcceptance(data: {
  bleBeaconId: string;
  rescuerId: number;
  rescuerLatitude?: number;
  rescuerLongitude?: number;
}): Promise<OfflineBleAcceptanceRecord> {
  const db = await openBleAcceptancesDb();
  const record: OfflineBleAcceptanceRecord = {
    id: typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    bleBeaconId: data.bleBeaconId,
    acceptedAt: Date.now(),
    rescuerId: data.rescuerId,
    rescuerLatitude: data.rescuerLatitude,
    rescuerLongitude: data.rescuerLongitude,
    syncStatus: "pending",
  };

  return new Promise<OfflineBleAcceptanceRecord>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sudo-ble-acceptance-changed", { detail: record }));
      }
      resolve(record);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineBleAcceptance(bleBeaconId: string): Promise<OfflineBleAcceptanceRecord | null> {
  try {
    const db = await openBleAcceptancesDb();
    return new Promise<OfflineBleAcceptanceRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(bleBeaconId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function listAllOfflineBleAcceptances(): Promise<OfflineBleAcceptanceRecord[]> {
  try {
    const db = await openBleAcceptancesDb();
    return new Promise<OfflineBleAcceptanceRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as OfflineBleAcceptanceRecord[]) || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

export async function listPendingOfflineBleAcceptances(): Promise<OfflineBleAcceptanceRecord[]> {
  const all = await listAllOfflineBleAcceptances();
  return all.filter(a => a.syncStatus === "pending");
}

export async function updateOfflineBleAcceptanceStatus(
  bleBeaconId: string,
  update: {
    syncStatus: "pending" | "synced" | "failed" | "conflict";
    syncError?: string;
    assignedPublicCode?: string;
  }
): Promise<void> {
  const db = await openBleAcceptancesDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(bleBeaconId);
    getReq.onsuccess = () => {
      const existing = getReq.result as OfflineBleAcceptanceRecord | undefined;
      if (!existing) {
        resolve();
        return;
      }
      const updated = {
        ...existing,
        ...update,
      };
      store.put(updated);
    };
    tx.oncomplete = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sudo-ble-acceptance-changed", { detail: { bleBeaconId, ...update } }));
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
