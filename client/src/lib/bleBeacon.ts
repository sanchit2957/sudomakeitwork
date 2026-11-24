/**
 * Bluetooth Low Energy (BLE) Emergency SOS Beacon & Rescuer Radar Engine.
 *
 * Provides real Android BLE communication using Capacitor 8 native integration:
 *  - Victim Phone: Broadcasts emergency SOS beacon (BluetoothLeAdvertiser + Foreground Service)
 *  - Rescuer Phone: Scans and detects nearby SOS beacons (BluetoothLeScanner + 16-bit Service UUID 0xFC01)
 *  - 100% Offline: Operates with zero cellular data, zero Wi-Fi, zero internet.
 *
 * Compact binary protocol (17 bytes):
 *  Byte 0:     Protocol Version (0x01)
 *  Bytes 1..8: Emergency ID (8 bytes ASCII alphanumeric, null-padded)
 *  Byte 9:     Emergency Type (1 byte enum: flood, medical, fire, trapped, supplies, other)
 *  Byte 10:    People Affected (1 byte uint8: 1..255)
 *  Bytes 11..14: Creation Timestamp (4 bytes uint32 big-endian Unix epoch seconds)
 *  Byte 15:    Priority / Severity (1 byte: low, medium, high, critical)
 *  Byte 16:    Checksum (1 byte XOR of bytes 0..15)
 */

import { registerPlugin, Capacitor } from "@capacitor/core";

export const BLE_SOS_SERVICE_UUID = "0000fc01-0000-1000-8000-00805f9b34fb";
export const BLE_PROTOCOL_VERSION_V1 = 0x01;
export const BLE_PROTOCOL_VERSION_V2 = 0x02;
export const BLE_PROTOCOL_VERSION = BLE_PROTOCOL_VERSION_V2; // Default to v2
export const BLE_PAYLOAD_LENGTH_V1 = 17;
export const BLE_PAYLOAD_LENGTH_V2 = 26;
export const BLE_PAYLOAD_LENGTH = BLE_PAYLOAD_LENGTH_V2;
export const BLE_SENTINEL_COORDINATE_UNAVAILABLE = 0x7FFFFFFF;
export const BLE_COORDINATE_SCALE = 10_000_000;
export const BLE_BEACON_STORAGE_KEY = "sudo-makeitwork-ble-beacons-v1";
export const BLE_ACTIVE_BEACON_ID_KEY = "sudo-active-ble-beacon-id-v1";

/**
 * Generates an 8-character uppercase alphanumeric ID (A-Z, 0-9).
 * Provides ~2.82 trillion combinations to prevent collisions in disaster zones.
 */
export function generateBleBeaconId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 8; i++) {
      result += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 8; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return result;
}

/**
 * Returns the currently active BLE beacon ID for this device's emergency.
 * If one already exists in storage, it is returned without regeneration.
 * Otherwise, generates a new unique 8-character ID and persists it.
 */
export function getOrCreateActiveBleBeaconId(): string {
  try {
    if (typeof sessionStorage !== "undefined" || typeof localStorage !== "undefined") {
      const existing =
        (typeof sessionStorage !== "undefined" ? sessionStorage.getItem(BLE_ACTIVE_BEACON_ID_KEY) : null) ||
        (typeof localStorage !== "undefined" ? localStorage.getItem(BLE_ACTIVE_BEACON_ID_KEY) : null);
      if (existing && /^[A-Z0-9-]{4,8}$/.test(existing)) {
        return existing;
      }
    }
  } catch { }

  const newId = generateBleBeaconId();
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(BLE_ACTIVE_BEACON_ID_KEY, newId);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(BLE_ACTIVE_BEACON_ID_KEY, newId);
    }
  } catch { }
  return newId;
}

/**
 * Clears the active BLE beacon ID upon SOS resolution or cancellation.
 */
export function clearActiveBleBeaconId(): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(BLE_ACTIVE_BEACON_ID_KEY);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(BLE_ACTIVE_BEACON_ID_KEY);
    }
  } catch { }
}
export const STALE_TIMEOUT_MS = 25_000;

export type ProximityCategory = "immediate" | "near" | "moderate" | "far";
export type EmergencyPriority = "low" | "medium" | "high" | "critical";

export interface BleStatus {
  isAvailable: boolean;
  isEnabled: boolean;
  isAdvertisingSupported: boolean;
  isScanningSupported: boolean;
  permissionsGranted: boolean;
  isAdvertising: boolean;
  isScanning: boolean;
  activeBroadcast: BleBeaconPayload | null;
  detectedCount: number;
}

export interface BleBeaconPayload {
  id: string; // Opaque alphanumeric identifier (e.g. "SOS-8K2N")
  emergencyType: string; // flood, medical, fire, trapped, supplies, other
  peopleAffected: number;
  timestamp: number; // Unix timestamp in milliseconds
  priority?: EmergencyPriority;
  rssi?: number; // Actual Received Signal Strength in dBm (e.g. -65 dBm)
  approxDistanceMeters?: number; // Estimated distance based on log-distance path loss
  proximityCategory?: ProximityCategory;
  lastSeenMs?: number;
  deviceAddress?: string;
  isStale?: boolean;
  isSimulation?: boolean;

  // Protocol v2 fields
  protocolVersion?: number;
  origLatitude?: number | null;
  origLongitude?: number | null;
  hasOriginalCoordinates?: boolean;
  hopCount?: number;

  // Optional legacy coordinate properties (preserved when cached locally)
  latitude?: number;
  longitude?: number;
  distanceMeters?: number; // Alias for approxDistanceMeters
}

export interface BleSosPluginInterface {
  getBleStatus(): Promise<BleStatus>;
  requestBlePermissions(): Promise<{ granted: boolean; message: string }>;
  startAdvertising(options: {
    id: string;
    emergencyType: string;
    peopleAffected: number;
    timestamp?: number;
    priority?: string;
    latitude?: number;
    longitude?: number;
    hopCount?: number;
  }): Promise<{ success: boolean; id: string; isAdvertising: boolean; message: string }>;
  stopAdvertising(): Promise<{ success: boolean; isAdvertising: boolean; message: string }>;
  startScanning(): Promise<{ success: boolean; isScanning: boolean; message: string }>;
  stopScanning(): Promise<{ success: boolean; isScanning: boolean; message: string }>;
  getDetectedBeacons(): Promise<{ beacons: BleBeaconPayload[]; count: number }>;
  clearDetectedBeacons(): Promise<{ success: boolean }>;
  triggerEmergencyAlert?(options: {
    id: string;
    emergencyType?: string;
    peopleAffected?: number;
    rssi?: number;
    timestamp?: number;
    priority?: string;
  }): Promise<{ success: boolean; alerted: boolean }>;
  addListener(
    eventName: "onBeaconDetected",
    listenerFunc: (beacon: BleBeaconPayload) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "onScanStatusChanged",
    listenerFunc: (status: { isScanning: boolean; errorCode?: number; error?: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "onAdvertisingStatusChanged",
    listenerFunc: (status: { isAdvertising: boolean; errorCode?: number; error?: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

export const BleSos = registerPlugin<BleSosPluginInterface>("BleSos");

// ─── Compact Binary Protocol: Encoder & Decoder ─────────────────────

export const EMERGENCY_TYPE_MAP: Record<string, number> = {
  other: 0x00,
  flood: 0x01,
  medical: 0x02,
  fire: 0x03,
  trapped: 0x04,
  supplies: 0x05,
  food: 0x05,
};

export const REVERSE_TYPE_MAP: Record<number, string> = {
  0x00: "other",
  0x01: "flood",
  0x02: "medical",
  0x03: "fire",
  0x04: "trapped",
  0x05: "supplies",
};

export const PRIORITY_MAP: Record<string, number> = {
  low: 0x01,
  medium: 0x02,
  high: 0x03,
  critical: 0x04,
};

export const REVERSE_PRIORITY_MAP: Record<number, EmergencyPriority> = {
  0x01: "low",
  0x02: "medium",
  0x03: "high",
  0x04: "critical",
};

/**
 * Validates whether latitude and longitude are within real geographic bounds.
 */
export function isValidBleCoordinate(lat: number, lng: number): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -90.0 && lat <= 90.0 && lng >= -180.0 && lng <= 180.0;
}

/**
 * Encodes a floating-point coordinate into a signed 32-bit microdegrees integer.
 */
export function encodeCoordinateMicrodegrees(coord: number | null | undefined): number {
  if (coord === null || coord === undefined || !Number.isFinite(coord)) {
    return BLE_SENTINEL_COORDINATE_UNAVAILABLE;
  }
  const scaled = Math.round(coord * BLE_COORDINATE_SCALE);
  if (scaled < -2147483648 || scaled >= BLE_SENTINEL_COORDINATE_UNAVAILABLE) {
    return BLE_SENTINEL_COORDINATE_UNAVAILABLE;
  }
  return scaled;
}

/**
 * Decodes a signed 32-bit microdegrees integer into floating-point degrees.
 */
export function decodeCoordinateMicrodegrees(raw: number): number | null {
  if (raw === BLE_SENTINEL_COORDINATE_UNAVAILABLE) {
    return null;
  }
  return raw / BLE_COORDINATE_SCALE;
}

/**
 * Computes single-byte XOR checksum over buffer range.
 */
export function calculateChecksum(bytes: Uint8Array, length: number): number {
  let checksum = 0;
  for (let i = 0; i < length; i++) {
    checksum ^= bytes[i];
  }
  return checksum;
}

/**
 * Serializes an SOS distress signal into a compact binary array (v2: 26 bytes, v1: 17 bytes).
 */
export function encodeBleSosPayload(payload: {
  id: string;
  emergencyType: string;
  peopleAffected: number;
  timestamp: number;
  priority?: EmergencyPriority;
  protocolVersion?: number;
  latitude?: number | null;
  longitude?: number | null;
  hopCount?: number;
}): Uint8Array {
  const version = payload.protocolVersion === BLE_PROTOCOL_VERSION_V1 ? BLE_PROTOCOL_VERSION_V1 : BLE_PROTOCOL_VERSION_V2;
  const length = version === BLE_PROTOCOL_VERSION_V1 ? BLE_PAYLOAD_LENGTH_V1 : BLE_PAYLOAD_LENGTH_V2;
  const buffer = new Uint8Array(length);

  // Byte 0: Protocol version
  buffer[0] = version;

  // Bytes 1..8: Emergency ID (8 chars ASCII, uppercase, alphanumeric/hyphen)
  let rawId = (payload.id || "").replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
  if (rawId.startsWith("SOS-BLE-")) {
    rawId = rawId.slice("SOS-BLE-".length);
  } else if (rawId.startsWith("SOS-") && rawId.length > 8) {
    rawId = rawId.slice("SOS-".length);
  }
  let cleanedId = rawId.slice(0, 8);
  if (!cleanedId) {
    cleanedId = getOrCreateActiveBleBeaconId();
  }
  for (let i = 0; i < 8; i++) {
    buffer[1 + i] = i < cleanedId.length ? cleanedId.charCodeAt(i) : 0;
  }

  // Byte 9: Emergency Type
  const normalizedType = (payload.emergencyType || "flood").toLowerCase();
  buffer[9] = EMERGENCY_TYPE_MAP[normalizedType] ?? EMERGENCY_TYPE_MAP.other;

  // Byte 10: People Affected (1..255)
  buffer[10] = Math.max(1, Math.min(255, payload.peopleAffected || 1));

  // Bytes 11..14: Unix Epoch Seconds (uint32 big-endian)
  const epochSecs = Math.floor((payload.timestamp || Date.now()) / 1000);
  buffer[11] = (epochSecs >>> 24) & 0xff;
  buffer[12] = (epochSecs >>> 16) & 0xff;
  buffer[13] = (epochSecs >>> 8) & 0xff;
  buffer[14] = epochSecs & 0xff;

  // Byte 15: Priority
  const priorityKey = (payload.priority || "high").toLowerCase();
  buffer[15] = PRIORITY_MAP[priorityKey] ?? PRIORITY_MAP.high;

  if (version === BLE_PROTOCOL_VERSION_V1) {
    // Byte 16: Checksum of bytes 0..15
    buffer[16] = calculateChecksum(buffer, 16);
    return buffer;
  }

  // Protocol v2:
  const hasCoords = payload.latitude != null && payload.longitude != null && isValidBleCoordinate(payload.latitude, payload.longitude);

  const latInt = hasCoords ? encodeCoordinateMicrodegrees(payload.latitude) : BLE_SENTINEL_COORDINATE_UNAVAILABLE;
  buffer[16] = (latInt >>> 24) & 0xff;
  buffer[17] = (latInt >>> 16) & 0xff;
  buffer[18] = (latInt >>> 8) & 0xff;
  buffer[19] = latInt & 0xff;

  const lngInt = hasCoords ? encodeCoordinateMicrodegrees(payload.longitude) : BLE_SENTINEL_COORDINATE_UNAVAILABLE;
  buffer[20] = (lngInt >>> 24) & 0xff;
  buffer[21] = (lngInt >>> 16) & 0xff;
  buffer[22] = (lngInt >>> 8) & 0xff;
  buffer[23] = lngInt & 0xff;

  // Byte 24: Hop Count
  buffer[24] = Math.max(0, Math.min(255, payload.hopCount ?? 0));

  // Byte 25: Checksum of bytes 0..24
  buffer[25] = calculateChecksum(buffer, 25);

  return buffer;
}

/**
 * Decodes and validates a received BLE advertisement payload.
 * Supports both legacy v1 (17-byte) and v2 (26-byte) packets with strict validation.
 */
export function decodeBleSosPayload(data: Uint8Array): BleBeaconPayload | null {
  if (!data || data.length < BLE_PAYLOAD_LENGTH_V1) {
    return null;
  }

  const version = data[0];

  if (version === BLE_PROTOCOL_VERSION_V1) {
    if (data.length < BLE_PAYLOAD_LENGTH_V1) {
      return null;
    }
    const expectedChecksum = calculateChecksum(data, 16);
    if (data[16] !== expectedChecksum) {
      return null; // Corrupted packet rejected
    }

    let idChars = "";
    for (let i = 1; i <= 8; i++) {
      if (data[i] === 0) break;
      idChars += String.fromCharCode(data[i]);
    }
    const id = idChars.trim() || "SOS-UNKNOWN";

    const emergencyType = REVERSE_TYPE_MAP[data[9]] || "other";
    const peopleAffected = data[10] || 1;

    const epochSecs =
      ((data[11] << 24) >>> 0) +
      (data[12] << 16) +
      (data[13] << 8) +
      data[14];
    const timestamp = epochSecs * 1000;

    const priority = REVERSE_PRIORITY_MAP[data[15]] || "high";

    return {
      id,
      emergencyType,
      peopleAffected,
      timestamp,
      priority,
      protocolVersion: 1,
      origLatitude: null,
      origLongitude: null,
      hasOriginalCoordinates: false,
      hopCount: 0,
      latitude: undefined,
      longitude: undefined,
    };
  }

  if (version === BLE_PROTOCOL_VERSION_V2) {
    if (data.length < BLE_PAYLOAD_LENGTH_V2) {
      return null;
    }
    const expectedChecksum = calculateChecksum(data, 25);
    if (data[25] !== expectedChecksum) {
      return null; // Corrupted packet rejected
    }

    let idChars = "";
    for (let i = 1; i <= 8; i++) {
      if (data[i] === 0) break;
      idChars += String.fromCharCode(data[i]);
    }
    const id = idChars.trim() || "SOS-UNKNOWN";

    const emergencyType = REVERSE_TYPE_MAP[data[9]] || "other";
    const peopleAffected = data[10] || 1;

    const epochSecs =
      ((data[11] << 24) >>> 0) +
      (data[12] << 16) +
      (data[13] << 8) +
      data[14];
    const timestamp = epochSecs * 1000;

    const priority = REVERSE_PRIORITY_MAP[data[15]] || "high";

    // Signed 32-bit big-endian integer microdegrees
    const latRaw = (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19];
    const lngRaw = (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23];

    let origLatitude = decodeCoordinateMicrodegrees(latRaw);
    let origLongitude = decodeCoordinateMicrodegrees(lngRaw);

    let hasOriginalCoordinates = false;
    if (origLatitude !== null && origLongitude !== null && isValidBleCoordinate(origLatitude, origLongitude)) {
      hasOriginalCoordinates = true;
    } else {
      origLatitude = null;
      origLongitude = null;
    }

    const hopCount = data[24] & 0xff;

    return {
      id,
      emergencyType,
      peopleAffected,
      timestamp,
      priority,
      protocolVersion: 2,
      origLatitude,
      origLongitude,
      hasOriginalCoordinates,
      hopCount,
      latitude: hasOriginalCoordinates ? (origLatitude ?? undefined) : undefined,
      longitude: hasOriginalCoordinates ? (origLongitude ?? undefined) : undefined,
    };
  }

  // Unsupported protocol version
  return null;
}

// ─── Approximate Distance & Proximity Estimation ───────────────────

/**
 * Calculates estimated distance based on Bluetooth RSSI (dBm).
 * Uses standard log-distance path loss formula:
 *   d = 10 ^ ((txPower - rssi) / (10 * n))
 *
 * @param rssi - Received signal strength in dBm (-30 dBm to -95 dBm)
 * @param txPower - Measured power at 1 meter (default -59 dBm)
 * @param pathLoss - Environmental path loss exponent (default 2.5 for outdoor/flood zones)
 */
export function calculateApproximateBleDistance(
  rssi: number,
  txPower: number = -59,
  pathLoss: number = 2.5
): {
  distanceMeters: number;
  proximityCategory: ProximityCategory;
  isApproximate: true;
} {
  if (!rssi || rssi === 0) {
    return { distanceMeters: -1, proximityCategory: "far", isApproximate: true };
  }

  const clampedRssi = Math.max(-100, Math.min(-20, rssi));
  const exponent = (txPower - clampedRssi) / (10.0 * pathLoss);
  const rawDist = Math.pow(10.0, exponent);
  const distanceMeters = Math.max(1, Math.round(rawDist * 10) / 10);

  let proximityCategory: ProximityCategory;
  if (clampedRssi >= -60) {
    proximityCategory = "immediate"; // < 3m
  } else if (clampedRssi >= -75) {
    proximityCategory = "near"; // 3m - 10m
  } else if (clampedRssi >= -85) {
    proximityCategory = "moderate"; // 10m - 25m
  } else {
    proximityCategory = "far"; // > 25m
  }

  return { distanceMeters, proximityCategory, isApproximate: true };
}

/**
 * Backwards-compatible distance function.
 */
export function calculateBleDistanceMeters(rssi: number, txPower: number = -59): number {
  return calculateApproximateBleDistance(rssi, txPower).distanceMeters;
}

// ─── State Management & Native Integration ─────────────────────────

let activeBroadcastingBeacon: BleBeaconPayload | null = null;
const memoryDetectedBeacons = new Map<string, BleBeaconPayload>();
let beaconScanListenerRemover: (() => Promise<void>) | null = null;

export function isBleSosBeaconActive(): boolean {
  return activeBroadcastingBeacon !== null;
}

export function getActiveBleBeacon(): BleBeaconPayload | null {
  return activeBroadcastingBeacon;
}

/**
 * Gets real Bluetooth status from the native Android plugin.
 * In a desktop/browser development environment, returns development state.
 */
export async function getBleStatus(): Promise<BleStatus> {
  if (Capacitor.isNativePlatform()) {
    try {
      return await BleSos.getBleStatus();
    } catch (e) {
      console.warn("[BleSos] Native getBleStatus call failed:", e);
    }
  }

  return {
    isAvailable: false,
    isEnabled: false,
    isAdvertisingSupported: false,
    isScanningSupported: false,
    permissionsGranted: false,
    isAdvertising: isBleSosBeaconActive(),
    isScanning: false,
    activeBroadcast: activeBroadcastingBeacon,
    detectedCount: memoryDetectedBeacons.size,
  };
}

/**
 * Requests required Android Bluetooth permissions via native plugin.
 */
export async function requestBlePermissions(): Promise<{ granted: boolean; message: string }> {
  if (Capacitor.isNativePlatform()) {
    try {
      return await BleSos.requestBlePermissions();
    } catch (e: any) {
      return { granted: false, message: e?.message || "Failed to request Bluetooth permissions." };
    }
  }
  return { granted: true, message: "Browser simulation environment: permissions mock granted." };
}

/**
 * Activates real Android Bluetooth Low Energy emergency SOS beacon advertising.
 * Starts native foreground service with persistent alarm notification.
 */
export async function startBleSosBeacon(
  payload: Omit<BleBeaconPayload, "timestamp"> & { timestamp?: number }
): Promise<{ success: boolean; id: string; error?: string }> {
  const timestamp = payload.timestamp || Date.now();
  let cleanId = payload.id;
  if (!cleanId) {
    cleanId = getOrCreateActiveBleBeaconId();
  } else {
    let raw = cleanId.replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
    if (raw.startsWith("SOS-BLE-")) {
      raw = raw.slice("SOS-BLE-".length);
    } else if (raw.startsWith("SOS-") && raw.length > 8) {
      raw = raw.slice("SOS-".length);
    }
    cleanId = raw.slice(0, 8) || getOrCreateActiveBleBeaconId();
  }

  const fullPayload: BleBeaconPayload = {
    ...payload,
    id: cleanId,
    timestamp,
    priority: payload.priority || "high",
  };

  activeBroadcastingBeacon = fullPayload;

  // Persist locally for offline status resilience
  try {
    const existing = getStoredBleBeacons().filter(b => b.id !== cleanId);
    existing.unshift(fullPayload);
    localStorage.setItem(BLE_BEACON_STORAGE_KEY, JSON.stringify(existing.slice(0, 20)));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sudo-ble-beacon-updated", { detail: fullPayload }));
    }
  } catch { }

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await BleSos.startAdvertising({
        id: cleanId,
        emergencyType: fullPayload.emergencyType,
        peopleAffected: fullPayload.peopleAffected,
        timestamp: fullPayload.timestamp,
        priority: fullPayload.priority,
        latitude: fullPayload.latitude,
        longitude: fullPayload.longitude,
        hopCount: fullPayload.hopCount ?? 0,
      });
      return { success: res.success, id: cleanId };
    } catch (e: any) {
      console.warn("[BleSos] Native BLE advertising error:", e);
      return { success: false, id: cleanId, error: e?.message || "Advertising failed." };
    }
  }

  return { success: true, id: cleanId };
}

/**
 * Stops broadcasting the BLE SOS beacon.
 */
export async function stopBleSosBeacon(options?: { clearId?: boolean }): Promise<void> {
  activeBroadcastingBeacon = null;
  if (options?.clearId) {
    clearActiveBleBeaconId();
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await BleSos.stopAdvertising();
    } catch (e) {
      console.warn("[BleSos] Native stopAdvertising error:", e);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sudo-ble-beacon-updated", { detail: null }));
  }
}

/**
 * Starts continuous BLE scanning for rescuer boats.
 */
export async function startBleRadar(
  onBeaconUpdate?: (beacons: BleBeaconPayload[]) => void,
  onError?: (error: string) => void
): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      // Clean up previous listener
      if (beaconScanListenerRemover) {
        await beaconScanListenerRemover();
        beaconScanListenerRemover = null;
      }

      const listenerHandle = await BleSos.addListener("onBeaconDetected", (rawBeacon) => {
        const approx = calculateApproximateBleDistance(rawBeacon.rssi ?? -70);
        const beacon: BleBeaconPayload = {
          ...rawBeacon,
          approxDistanceMeters: rawBeacon.approxDistanceMeters ?? approx.distanceMeters,
          distanceMeters: rawBeacon.approxDistanceMeters ?? approx.distanceMeters,
          proximityCategory: rawBeacon.proximityCategory ?? approx.proximityCategory,
          lastSeenMs: rawBeacon.lastSeenMs || Date.now(),
        };

        memoryDetectedBeacons.set(beacon.id, beacon);
        pruneStaleDetectedBeacons();

        if (onBeaconUpdate) {
          onBeaconUpdate(Array.from(memoryDetectedBeacons.values()));
        }
      });

      beaconScanListenerRemover = listenerHandle.remove;

      await BleSos.addListener("onScanStatusChanged", (status) => {
        if (status.error && onError) {
          onError(status.error);
        }
      });

      const res = await BleSos.startScanning();
      return res.success;
    } catch (e: any) {
      if (onError) onError(e?.message || "Failed to start BLE scanning.");
      return false;
    }
  }

  return false;
}

/**
 * Stops BLE scanning for rescuers.
 */
export async function stopBleRadar(): Promise<void> {
  if (beaconScanListenerRemover) {
    try {
      await beaconScanListenerRemover();
    } catch { }
    beaconScanListenerRemover = null;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await BleSos.stopScanning();
    } catch (e) {
      console.warn("[BleSos] stopScanning error:", e);
    }
  }
}

/**
 * Removes detected beacons that have not been heard for STALE_TIMEOUT_MS.
 */
export function pruneStaleDetectedBeacons(): void {
  const now = Date.now();
  memoryDetectedBeacons.forEach((beacon, id) => {
    if (beacon.lastSeenMs && now - beacon.lastSeenMs > STALE_TIMEOUT_MS) {
      memoryDetectedBeacons.delete(id);
    }
  });
}

/**
 * Reads all detected BLE beacons from local radio buffer / storage.
 */
export function getStoredBleBeacons(): BleBeaconPayload[] {
  try {
    const raw = localStorage.getItem(BLE_BEACON_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Scans for nearby BLE beacons.
 * On native Android, queries the active BluetoothLeScanner.
 * In a browser preview, clearly indicates simulated development mode.
 */
export async function scanForNearbyBleBeacons(
  rescuerLat?: number,
  rescuerLng?: number
): Promise<BleBeaconPayload[]> {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await BleSos.getDetectedBeacons();
      return result.beacons.map((b) => {
        const approx = calculateApproximateBleDistance(b.rssi ?? -70);
        return {
          ...b,
          approxDistanceMeters: b.approxDistanceMeters ?? approx.distanceMeters,
          distanceMeters: b.approxDistanceMeters ?? approx.distanceMeters,
          proximityCategory: b.proximityCategory ?? approx.proximityCategory,
        };
      });
    } catch (e) {
      console.warn("[BleSos] Native getDetectedBeacons failed:", e);
    }
  }

  // Development/browser-only fallback with explicit simulation flag
  const stored = getStoredBleBeacons();
  return stored.map((beacon) => {
    let approxDist = 35;
    let rssi = -68;

    if (rescuerLat && rescuerLng && beacon.latitude && beacon.longitude) {
      const R = 6371e3;
      const φ1 = (rescuerLat * Math.PI) / 180;
      const φ2 = (beacon.latitude * Math.PI) / 180;
      const Δφ = ((beacon.latitude - rescuerLat) * Math.PI) / 180;
      const Δλ = ((beacon.longitude - rescuerLng) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      approxDist = Math.max(5, Math.round(R * c));
      rssi = Math.max(-95, Math.min(-35, Math.round(-59 - 25 * Math.log10(Math.max(1, approxDist / 10)))));
    }

    const { distanceMeters, proximityCategory } = calculateApproximateBleDistance(rssi);

    return {
      ...beacon,
      rssi,
      approxDistanceMeters: distanceMeters,
      distanceMeters,
      proximityCategory,
      isSimulation: true,
    };
  });
}
