import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  startBleSosBeacon,
  stopBleSosBeacon,
  isBleSosBeaconActive,
  getActiveBleBeacon,
  getStoredBleBeacons,
  calculateBleDistanceMeters,
  calculateApproximateBleDistance,
  scanForNearbyBleBeacons,
  encodeBleSosPayload,
  decodeBleSosPayload,
  calculateChecksum,
  getBleStatus,
  requestBlePermissions,
  pruneStaleDetectedBeacons,
  generateBleBeaconId,
  getOrCreateActiveBleBeaconId,
  clearActiveBleBeaconId,
  isValidBleCoordinate,
  encodeCoordinateMicrodegrees,
  decodeCoordinateMicrodegrees,
  BLE_BEACON_STORAGE_KEY,
  BLE_ACTIVE_BEACON_ID_KEY,
  BLE_PROTOCOL_VERSION,
  BLE_PAYLOAD_LENGTH,
  BLE_PROTOCOL_VERSION_V1,
  BLE_PROTOCOL_VERSION_V2,
  BLE_PAYLOAD_LENGTH_V1,
  BLE_PAYLOAD_LENGTH_V2,
  BLE_SENTINEL_COORDINATE_UNAVAILABLE,
  BLE_COORDINATE_SCALE,
} from "./bleBeacon";

const storage = new Map<string, string>();
const sessionStorageMap = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  sessionStorageMap.clear();
  void stopBleSosBeacon({ clearId: true });

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });

  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => sessionStorageMap.get(key) ?? null,
      setItem: (key: string, value: string) => sessionStorageMap.set(key, value),
      removeItem: (key: string) => sessionStorageMap.delete(key),
    },
  });
});

describe("Bluetooth Low Energy (BLE) SOS Beacon & Rescuer Radar", () => {
  describe("Binary Payload Specification & Encoding/Decoding", () => {
    it("encodes and decodes valid SOS beacon packets accurately (defaults to Protocol v2)", () => {
      const original = {
        id: "SOS-8K2N",
        emergencyType: "flood",
        peopleAffected: 4,
        timestamp: 1700000000000,
        priority: "critical" as const,
      };

      const encoded = encodeBleSosPayload(original);
      expect(encoded).toBeInstanceOf(Uint8Array);
      expect(encoded.length).toBe(BLE_PAYLOAD_LENGTH_V2);
      expect(encoded[0]).toBe(BLE_PROTOCOL_VERSION_V2);

      const decoded = decodeBleSosPayload(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded?.id).toBe("SOS-8K2N");
      expect(decoded?.emergencyType).toBe("flood");
      expect(decoded?.peopleAffected).toBe(4);
      expect(decoded?.timestamp).toBe(1700000000000);
      expect(decoded?.priority).toBe("critical");
      expect(decoded?.protocolVersion).toBe(2);
      expect(decoded?.hasOriginalCoordinates).toBe(false);
      expect(decoded?.origLatitude).toBeNull();
      expect(decoded?.origLongitude).toBeNull();
    });

    it("verifies packet checksum and rejects corrupted data for v2", () => {
      const encoded = encodeBleSosPayload({
        id: "SOS-SAFE",
        emergencyType: "medical",
        peopleAffected: 2,
        timestamp: Date.now(),
        priority: "high",
      });

      // Valid packet decodes properly
      expect(decodeBleSosPayload(encoded)).not.toBeNull();

      // Corrupt a byte in the payload body
      const corrupted = new Uint8Array(encoded);
      corrupted[5] = (corrupted[5] ^ 0xff); // Bit flip
      expect(decodeBleSosPayload(corrupted)).toBeNull();

      // Corrupt the checksum byte itself (byte 25 in v2)
      const badChecksum = new Uint8Array(encoded);
      badChecksum[encoded.length - 1] = (badChecksum[encoded.length - 1] + 1) % 256;
      expect(decodeBleSosPayload(badChecksum)).toBeNull();
    });

    it("rejects packets with unsupported protocol version", () => {
      const encoded = encodeBleSosPayload({
        id: "SOS-VER",
        emergencyType: "trapped",
        peopleAffected: 1,
        timestamp: Date.now(),
      });

      const badVersion = new Uint8Array(encoded);
      badVersion[0] = 0x99; // Unknown protocol version
      // Recalculate checksum so only the version is invalid
      badVersion[badVersion.length - 1] = calculateChecksum(badVersion, badVersion.length - 1);

      expect(decodeBleSosPayload(badVersion)).toBeNull();
    });

    it("rejects undersized or null buffer payloads", () => {
      expect(decodeBleSosPayload(new Uint8Array(5))).toBeNull();
      expect(decodeBleSosPayload(new Uint8Array(0))).toBeNull();
      expect(decodeBleSosPayload(null as any)).toBeNull();
      // v2 packet truncated to 25 bytes
      const v2Truncated = new Uint8Array(25);
      v2Truncated[0] = BLE_PROTOCOL_VERSION_V2;
      expect(decodeBleSosPayload(v2Truncated)).toBeNull();
    });

    it("sanitizes IDs with non-alphanumeric characters and enforces 8-character limit", () => {
      const encoded = encodeBleSosPayload({
        id: "@#$99999-EXTRA",
        emergencyType: "supplies",
        peopleAffected: 10,
        timestamp: Date.now(),
      });

      const decoded = decodeBleSosPayload(encoded);
      expect(decoded?.id).toBe("99999-EX");
      expect(decoded?.id.length).toBeLessThanOrEqual(8);
    });
  });

  describe("Protocol v2: GPS Coordinate Encoding & Microdegrees Precision", () => {
    it("encodes and decodes valid Assam coordinates (Guwahati) with exact microdegree precision", () => {
      const guwahatiLat = 26.1445;
      const guwahatiLng = 91.7362;

      // Microdegree calculation: round(coord * 10,000,000)
      const latMicro = encodeCoordinateMicrodegrees(guwahatiLat);
      const lngMicro = encodeCoordinateMicrodegrees(guwahatiLng);
      expect(latMicro).toBe(261445000);
      expect(lngMicro).toBe(917362000);

      const encoded = encodeBleSosPayload({
        id: "SOS-AS01",
        emergencyType: "flood",
        peopleAffected: 5,
        timestamp: 1700000000000,
        priority: "critical",
        latitude: guwahatiLat,
        longitude: guwahatiLng,
        hopCount: 0,
      });

      expect(encoded.length).toBe(BLE_PAYLOAD_LENGTH_V2);
      expect(encoded[0]).toBe(BLE_PROTOCOL_VERSION_V2);

      // Verify big-endian byte layout for coordinates
      // lat = 261445000 = 0x0F955588
      expect(encoded[16]).toBe(0x0f);
      expect(encoded[17]).toBe(0x95);
      expect(encoded[18]).toBe(0x55);
      expect(encoded[19]).toBe(0x88);

      // lng = 917362000 = 0x36ADD550
      expect(encoded[20]).toBe(0x36);
      expect(encoded[21]).toBe(0xad);
      expect(encoded[22]).toBe(0xd5);
      expect(encoded[23]).toBe(0x50);

      // Hop count
      expect(encoded[24]).toBe(0);

      const decoded = decodeBleSosPayload(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded?.protocolVersion).toBe(2);
      expect(decoded?.hasOriginalCoordinates).toBe(true);
      expect(decoded?.origLatitude).toBeCloseTo(guwahatiLat, 6);
      expect(decoded?.origLongitude).toBeCloseTo(guwahatiLng, 6);
      expect(decoded?.latitude).toBeCloseTo(guwahatiLat, 6);
      expect(decoded?.longitude).toBeCloseTo(guwahatiLng, 6);
      expect(decoded?.hopCount).toBe(0);
    });

    it("encodes and decodes negative coordinates correctly across hemispheres", () => {
      // Sydney, Australia (Southern hemisphere): -33.8688, 151.2093
      const sydney = {
        id: "SOS-SYDN",
        emergencyType: "medical",
        peopleAffected: 1,
        timestamp: 1700000000000,
        latitude: -33.8688,
        longitude: 151.2093,
      };

      const encSydney = encodeBleSosPayload(sydney);
      const decSydney = decodeBleSosPayload(encSydney);
      expect(decSydney?.hasOriginalCoordinates).toBe(true);
      expect(decSydney?.origLatitude).toBeCloseTo(-33.8688, 6);
      expect(decSydney?.origLongitude).toBeCloseTo(151.2093, 6);

      // Rio de Janeiro, Brazil (Southern & Western hemisphere): -22.9068, -43.1729
      const rio = {
        id: "SOS-RIO1",
        emergencyType: "trapped",
        peopleAffected: 3,
        timestamp: 1700000000000,
        latitude: -22.9068,
        longitude: -43.1729,
      };

      const encRio = encodeBleSosPayload(rio);
      const decRio = decodeBleSosPayload(encRio);
      expect(decRio?.hasOriginalCoordinates).toBe(true);
      expect(decRio?.origLatitude).toBeCloseTo(-22.9068, 6);
      expect(decRio?.origLongitude).toBeCloseTo(-43.1729, 6);
    });

    it("encodes and decodes zero coordinates (0.0, 0.0) without confusing with sentinel or missing GPS", () => {
      // Equator and Prime Meridian (Gulf of Guinea)
      const zeroCoords = {
        id: "SOS-ZERO",
        emergencyType: "other",
        peopleAffected: 2,
        timestamp: 1700000000000,
        latitude: 0.0,
        longitude: 0.0,
      };

      const encZero = encodeBleSosPayload(zeroCoords);
      // Bytes 16..19 and 20..23 should be 0x00
      expect(encZero[16]).toBe(0);
      expect(encZero[17]).toBe(0);
      expect(encZero[18]).toBe(0);
      expect(encZero[19]).toBe(0);
      expect(encZero[20]).toBe(0);
      expect(encZero[21]).toBe(0);
      expect(encZero[22]).toBe(0);
      expect(encZero[23]).toBe(0);

      const decZero = decodeBleSosPayload(encZero);
      expect(decZero?.hasOriginalCoordinates).toBe(true);
      expect(decZero?.origLatitude).toBe(0.0);
      expect(decZero?.origLongitude).toBe(0.0);
    });

    it("encodes and decodes extreme valid geographic boundaries without integer overflow", () => {
      // Maximum valid boundary: North Pole, 180 degrees East
      const maxBoundary = {
        id: "SOS-MAXB",
        emergencyType: "flood",
        peopleAffected: 1,
        timestamp: 1700000000000,
        latitude: 90.0,
        longitude: 180.0,
      };
      const encMax = encodeBleSosPayload(maxBoundary);
      const decMax = decodeBleSosPayload(encMax);
      expect(decMax?.hasOriginalCoordinates).toBe(true);
      expect(decMax?.origLatitude).toBe(90.0);
      expect(decMax?.origLongitude).toBe(180.0);

      // Minimum valid boundary: South Pole, 180 degrees West
      const minBoundary = {
        id: "SOS-MINB",
        emergencyType: "flood",
        peopleAffected: 1,
        timestamp: 1700000000000,
        latitude: -90.0,
        longitude: -180.0,
      };
      const encMin = encodeBleSosPayload(minBoundary);
      const decMin = decodeBleSosPayload(encMin);
      expect(decMin?.hasOriginalCoordinates).toBe(true);
      expect(decMin?.origLatitude).toBe(-90.0);
      expect(decMin?.origLongitude).toBe(-180.0);
    });

    it("validates coordinates with isValidBleCoordinate and rejects out-of-bounds or non-finite values", () => {
      expect(isValidBleCoordinate(26.1445, 91.7362)).toBe(true);
      expect(isValidBleCoordinate(-90.0, -180.0)).toBe(true);
      expect(isValidBleCoordinate(90.0, 180.0)).toBe(true);
      expect(isValidBleCoordinate(0, 0)).toBe(true);

      // Latitude out of bounds
      expect(isValidBleCoordinate(90.0001, 91.0)).toBe(false);
      expect(isValidBleCoordinate(-90.1, 91.0)).toBe(false);

      // Longitude out of bounds
      expect(isValidBleCoordinate(26.0, 180.0001)).toBe(false);
      expect(isValidBleCoordinate(26.0, -180.5)).toBe(false);

      // Non-finite values
      expect(isValidBleCoordinate(NaN, 91.0)).toBe(false);
      expect(isValidBleCoordinate(26.0, NaN)).toBe(false);
      expect(isValidBleCoordinate(Infinity, 0)).toBe(false);
      expect(isValidBleCoordinate(0, -Infinity)).toBe(false);
      expect(isValidBleCoordinate(null as any, null as any)).toBe(false);
      expect(isValidBleCoordinate(undefined as any, undefined as any)).toBe(false);
    });

    it("encodes documented sentinel 0x7FFFFFFF when GPS coordinates are unavailable and never fabricates INDIA_CENTER", () => {
      const payloadNoGps = {
        id: "SOS-NOGP",
        emergencyType: "flood",
        peopleAffected: 3,
        timestamp: 1700000000000,
        latitude: null,
        longitude: null,
      };

      const encoded = encodeBleSosPayload(payloadNoGps);
      expect(encoded.length).toBe(BLE_PAYLOAD_LENGTH_V2);

      // Bytes 16..19 should be 0x7F, 0xFF, 0xFF, 0xFF
      expect(encoded[16]).toBe(0x7f);
      expect(encoded[17]).toBe(0xff);
      expect(encoded[18]).toBe(0xff);
      expect(encoded[19]).toBe(0xff);

      // Bytes 20..23 should be 0x7F, 0xFF, 0xFF, 0xFF
      expect(encoded[20]).toBe(0x7f);
      expect(encoded[21]).toBe(0xff);
      expect(encoded[22]).toBe(0xff);
      expect(encoded[23]).toBe(0xff);

      const decoded = decodeBleSosPayload(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded?.protocolVersion).toBe(2);
      expect(decoded?.hasOriginalCoordinates).toBe(false);
      expect(decoded?.origLatitude).toBeNull();
      expect(decoded?.origLongitude).toBeNull();
      expect(decoded?.latitude).toBeUndefined();
      expect(decoded?.longitude).toBeUndefined();

      // Ensure neither decoded coordinate matches INDIA_CENTER
      expect(decoded?.origLatitude).not.toBe(20.5937);
      expect(decoded?.origLongitude).not.toBe(78.9629);
    });

    it("encodes documented sentinel when out-of-bounds coordinates are supplied", () => {
      const outOfBounds = {
        id: "SOS-OOB1",
        emergencyType: "fire",
        peopleAffected: 1,
        timestamp: 1700000000000,
        latitude: 95.0, // Invalid lat > 90
        longitude: 200.0, // Invalid lng > 180
      };

      const encoded = encodeBleSosPayload(outOfBounds);
      // Bytes 16..19 must be sentinel
      expect(encoded[16]).toBe(0x7f);
      expect(encoded[17]).toBe(0xff);
      expect(encoded[18]).toBe(0xff);
      expect(encoded[19]).toBe(0xff);

      const decoded = decodeBleSosPayload(encoded);
      expect(decoded?.hasOriginalCoordinates).toBe(false);
      expect(decoded?.origLatitude).toBeNull();
      expect(decoded?.origLongitude).toBeNull();
    });
  });

  describe("Backward Compatibility: Protocol v1 & Dual-Version Parsing", () => {
    it("encodes explicit v1 packet with exact 17-byte length", () => {
      const v1Payload = {
        id: "SOS-V1PK",
        emergencyType: "medical",
        peopleAffected: 2,
        timestamp: 1700000000000,
        priority: "high" as const,
        protocolVersion: BLE_PROTOCOL_VERSION_V1,
      };

      const encoded = encodeBleSosPayload(v1Payload);
      expect(encoded.length).toBe(BLE_PAYLOAD_LENGTH_V1); // Exactly 17 bytes
      expect(encoded[0]).toBe(BLE_PROTOCOL_VERSION_V1); // 0x01

      // Verify checksum at index 16
      const expectedChecksum = calculateChecksum(encoded, 16);
      expect(encoded[16]).toBe(expectedChecksum);
    });

    it("decodes legacy 17-byte v1 packet successfully with protocolVersion 1 and no coordinates", () => {
      const v1Payload = {
        id: "SOS-LEG1",
        emergencyType: "flood",
        peopleAffected: 4,
        timestamp: 1700000000000,
        priority: "critical" as const,
        protocolVersion: BLE_PROTOCOL_VERSION_V1,
      };

      const encoded = encodeBleSosPayload(v1Payload);
      expect(encoded.length).toBe(17);

      const decoded = decodeBleSosPayload(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded?.id).toBe("SOS-LEG1");
      expect(decoded?.protocolVersion).toBe(1);
      expect(decoded?.emergencyType).toBe("flood");
      expect(decoded?.peopleAffected).toBe(4);
      expect(decoded?.priority).toBe("critical");
      expect(decoded?.hasOriginalCoordinates).toBe(false);
      expect(decoded?.origLatitude).toBeNull();
      expect(decoded?.origLongitude).toBeNull();
      expect(decoded?.hopCount).toBe(0);
    });

    it("verifies packet checksum and rejects corrupted data for legacy v1 packet", () => {
      const encoded = encodeBleSosPayload({
        id: "SOS-V1CS",
        emergencyType: "medical",
        peopleAffected: 2,
        timestamp: 1700000000000,
        priority: "high",
        protocolVersion: BLE_PROTOCOL_VERSION_V1,
      });

      expect(encoded.length).toBe(17);
      expect(decodeBleSosPayload(encoded)).not.toBeNull();

      // Corrupt byte 16 (the v1 checksum)
      const badChecksum = new Uint8Array(encoded);
      badChecksum[16] = (badChecksum[16] + 1) % 256;
      expect(decodeBleSosPayload(badChecksum)).toBeNull();

      // Corrupt payload byte
      const badByte = new Uint8Array(encoded);
      badByte[3] = badByte[3] ^ 0xff;
      expect(decodeBleSosPayload(badByte)).toBeNull();
    });
  });

  describe("Cross-Language Deterministic Binary Verification (Java <-> TypeScript)", () => {
    it("produces deterministic, byte-for-byte identical v2 packet matching Java BleSosPayload.toBytes(2)", () => {
      // Test vector parameters matching native Android test:
      // ID: "SOS8K2N1"
      // Type: "flood" (0x01)
      // People: 4 (0x04)
      // Timestamp: 1700000000 (0x65540900)
      // Priority: "critical" (0x04)
      // Latitude: 26.1445 -> microdegrees: 261445000 (0x0F9589A8)
      // Longitude: 91.7362 -> microdegrees: 917362000 (0x36AEBBC8)
      // Hop Count: 0 (0x00)
      const payload = {
        id: "SOS8K2N1",
        emergencyType: "flood",
        peopleAffected: 4,
        timestamp: 1700000000000, // ms, converts to 1700000000 s
        priority: "critical" as const,
        latitude: 26.1445,
        longitude: 91.7362,
        hopCount: 0,
      };

      const encoded = encodeBleSosPayload(payload);
      expect(encoded.length).toBe(26);

      // Verify each field against expected byte values
      expect(encoded[0]).toBe(0x02); // Version
      // ID bytes ASCII "SOS8K2N1"
      expect(encoded[1]).toBe(0x53); // 'S'
      expect(encoded[2]).toBe(0x4f); // 'O'
      expect(encoded[3]).toBe(0x53); // 'S'
      expect(encoded[4]).toBe(0x38); // '8'
      expect(encoded[5]).toBe(0x4b); // 'K'
      expect(encoded[6]).toBe(0x32); // '2'
      expect(encoded[7]).toBe(0x4e); // 'N'
      expect(encoded[8]).toBe(0x31); // '1'
      expect(encoded[9]).toBe(0x01); // Type flood
      expect(encoded[10]).toBe(0x04); // 4 people
      // Timestamp 1700000000 = 0x6553F100
      expect(encoded[11]).toBe(0x65);
      expect(encoded[12]).toBe(0x53);
      expect(encoded[13]).toBe(0xf1);
      expect(encoded[14]).toBe(0x00);
      expect(encoded[15]).toBe(0x04); // Priority critical
      // Latitude 261445000 = 0x0F955588
      expect(encoded[16]).toBe(0x0f);
      expect(encoded[17]).toBe(0x95);
      expect(encoded[18]).toBe(0x55);
      expect(encoded[19]).toBe(0x88);
      // Longitude 917362000 = 0x36ADD550
      expect(encoded[20]).toBe(0x36);
      expect(encoded[21]).toBe(0xad);
      expect(encoded[22]).toBe(0xd5);
      expect(encoded[23]).toBe(0x50);
      // Hop count
      expect(encoded[24]).toBe(0x00);

      // Checksum byte 25 must match XOR of bytes 0..24
      let expectedXor = 0;
      for (let i = 0; i < 25; i++) {
        expectedXor ^= encoded[i];
      }
      expect(encoded[25]).toBe(expectedXor);

      // Verify that decoding this exact byte array reproduces the identical fields
      const decoded = decodeBleSosPayload(encoded);
      expect(decoded?.id).toBe("SOS8K2N1");
      expect(decoded?.emergencyType).toBe("flood");
      expect(decoded?.peopleAffected).toBe(4);
      expect(decoded?.timestamp).toBe(1700000000000);
      expect(decoded?.priority).toBe("critical");
      expect(decoded?.origLatitude).toBeCloseTo(26.1445, 6);
      expect(decoded?.origLongitude).toBeCloseTo(91.7362, 6);
      expect(decoded?.hasOriginalCoordinates).toBe(true);
      expect(decoded?.hopCount).toBe(0);
    });
  });

  describe("RSSI Distance & Proximity Estimation", () => {
    it("calculates estimated distance and monotonic ordering from RSSI signal strength", () => {
      const closeDistance = calculateBleDistanceMeters(-45);
      const midDistance = calculateBleDistanceMeters(-75);
      const farDistance = calculateBleDistanceMeters(-90);

      expect(closeDistance).toBeLessThan(midDistance);
      expect(midDistance).toBeLessThan(farDistance);
    });

    it("assigns accurate proximity categories based on real RSSI thresholds", () => {
      const immediate = calculateApproximateBleDistance(-55);
      expect(immediate.proximityCategory).toBe("immediate");
      expect(immediate.isApproximate).toBe(true);

      const near = calculateApproximateBleDistance(-70);
      expect(near.proximityCategory).toBe("near");

      const moderate = calculateApproximateBleDistance(-80);
      expect(moderate.proximityCategory).toBe("moderate");

      const far = calculateApproximateBleDistance(-92);
      expect(far.proximityCategory).toBe("far");
    });

    it("handles zero or invalid RSSI safely", () => {
      const zeroResult = calculateApproximateBleDistance(0);
      expect(zeroResult.distanceMeters).toBe(-1);
      expect(zeroResult.proximityCategory).toBe("far");
    });
  });

  describe("Broadcasting & Scanner Lifecycle", () => {
    it("starts and stops BLE beacon broadcast", async () => {
      expect(isBleSosBeaconActive()).toBe(false);

      const res = await startBleSosBeacon({
        id: "BLE12345",
        latitude: 26.1445,
        longitude: 91.7362,
        emergencyType: "flood",
        peopleAffected: 3,
      });

      expect(res.success).toBe(true);
      expect(isBleSosBeaconActive()).toBe(true);
      const active = getActiveBleBeacon();
      expect(active?.id).toBe("BLE12345");
      expect(active?.emergencyType).toBe("flood");
      expect(active?.peopleAffected).toBe(3);

      await stopBleSosBeacon();
      expect(isBleSosBeaconActive()).toBe(false);
      expect(getActiveBleBeacon()).toBeNull();
    });

    it("scans and detects nearby BLE beacons with approximate distance", async () => {
      await startBleSosBeacon({
        id: "SOS-BOAT",
        latitude: 26.145,
        longitude: 91.737,
        emergencyType: "flood",
        peopleAffected: 4,
      });

      const scanned = await scanForNearbyBleBeacons(26.144, 91.736);
      expect(scanned).toHaveLength(1);
      expect(scanned[0].id).toBe("SOS-BOAT");
      expect(scanned[0].approxDistanceMeters).toBeDefined();
      expect(scanned[0].distanceMeters).toBeDefined();
      expect(scanned[0].rssi).toBeDefined();
      expect(scanned[0].proximityCategory).toBeDefined();
    });

    it("reports Bluetooth status and permissions gracefully in web/development environment", async () => {
      const status = await getBleStatus();
      expect(status).toHaveProperty("isAvailable");
      expect(status).toHaveProperty("isEnabled");
      expect(status).toHaveProperty("isAdvertisingSupported");
      expect(status).toHaveProperty("isScanningSupported");
      expect(status).toHaveProperty("permissionsGranted");

      const perms = await requestBlePermissions();
      expect(perms).toHaveProperty("granted");
      expect(perms).toHaveProperty("message");
    });
  });

  describe("Unique 8-Character Beacon ID Lifecycle & Collision Prevention", () => {
    it("generates unique 8-character uppercase alphanumeric IDs with zero collisions across 500 samples", () => {
      const generatedIds = new Set<string>();
      const sampleCount = 500;

      for (let i = 0; i < sampleCount; i++) {
        const id = generateBleBeaconId();
        expect(id).toMatch(/^[A-Z0-9]{8}$/);
        expect(id.length).toBe(8);
        generatedIds.add(id);
      }

      // Zero collisions: all 500 generated IDs must be distinct
      expect(generatedIds.size).toBe(sampleCount);
    });

    it("getOrCreateActiveBleBeaconId returns stable ID without regeneration across restarts", () => {
      const first = getOrCreateActiveBleBeaconId();
      expect(first).toMatch(/^[A-Z0-9]{8}$/);

      // Subsequent reads must return the identical ID
      const second = getOrCreateActiveBleBeaconId();
      const third = getOrCreateActiveBleBeaconId();
      expect(second).toBe(first);
      expect(third).toBe(first);

      // Must be persisted in localStorage
      expect(localStorage.getItem(BLE_ACTIVE_BEACON_ID_KEY)).toBe(first);
    });

    it("clearActiveBleBeaconId clears the ID so subsequent emergency gets a fresh unique ID", () => {
      const id1 = getOrCreateActiveBleBeaconId();
      expect(id1).toBeDefined();

      clearActiveBleBeaconId();
      expect(localStorage.getItem(BLE_ACTIVE_BEACON_ID_KEY)).toBeNull();

      const id2 = getOrCreateActiveBleBeaconId();
      expect(id2).toMatch(/^[A-Z0-9]{8}$/);
      expect(id2).not.toBe(id1);
    });

    it("encodeBleSosPayload preserves unique 8-character IDs without truncation or distortion", () => {
      const uniqueId = generateBleBeaconId();
      const encoded = encodeBleSosPayload({
        id: uniqueId,
        emergencyType: "medical",
        peopleAffected: 2,
        timestamp: 1710000000000,
      });

      const decoded = decodeBleSosPayload(encoded);
      expect(decoded?.id).toBe(uniqueId);
      expect(decoded?.id.length).toBe(8);
    });

    it("strips legacy SOS-BLE- prefix gracefully without creating identical 'SOS-BLE-' collisions", () => {
      const id1 = "SOS-BLE-K8N2X9P1";
      const id2 = "SOS-BLE-W4M7Q2A5";

      const enc1 = encodeBleSosPayload({ id: id1, emergencyType: "flood", peopleAffected: 1, timestamp: Date.now() });
      const enc2 = encodeBleSosPayload({ id: id2, emergencyType: "flood", peopleAffected: 1, timestamp: Date.now() });

      const dec1 = decodeBleSosPayload(enc1);
      const dec2 = decodeBleSosPayload(enc2);

      expect(dec1?.id).toBe("K8N2X9P1");
      expect(dec2?.id).toBe("W4M7Q2A5");
      expect(dec1?.id).not.toBe("SOS-BLE-");
      expect(dec2?.id).not.toBe("SOS-BLE-");
      expect(dec1?.id).not.toBe(dec2?.id);
    });
  });

  describe("Offline-First Safety & Voice Note Non-Regression", () => {
    it("does not embed audio data into compact BLE packet (privacy & size enforcement)", () => {
      // Voice note data URLs must remain in offline storage and not leak into the public BLE radio packet
      const payloadWithAudio = {
        id: "SOS-AUDIO",
        emergencyType: "flood",
        peopleAffected: 2,
        timestamp: Date.now(),
        priority: "high" as const,
        voiceNoteDataUrl: "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8USA...",
      };

      // Protocol v2 packet
      const encodedV2 = encodeBleSosPayload(payloadWithAudio);
      expect(encodedV2.length).toBe(BLE_PAYLOAD_LENGTH_V2); // Fixed 26 bytes, audio excluded

      const decodedV2 = decodeBleSosPayload(encodedV2);
      expect(decodedV2?.id).toBe("AUDIO");
      expect((decodedV2 as any)?.voiceNoteDataUrl).toBeUndefined();

      // Legacy Protocol v1 packet
      const encodedV1 = encodeBleSosPayload({ ...payloadWithAudio, protocolVersion: BLE_PROTOCOL_VERSION_V1 });
      expect(encodedV1.length).toBe(BLE_PAYLOAD_LENGTH_V1); // Fixed 17 bytes, audio excluded

      const decodedV1 = decodeBleSosPayload(encodedV1);
      expect(decodedV1?.id).toBe("AUDIO");
      expect((decodedV1 as any)?.voiceNoteDataUrl).toBeUndefined();
    });
  });
});
