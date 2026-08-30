import { beforeEach, describe, expect, it } from "vitest";
import {
  startBleSosBeacon,
  stopBleSosBeacon,
  isBleSosBeaconActive,
  getActiveBleBeacon,
  getStoredBleBeacons,
  calculateBleDistanceMeters,
  scanForNearbyBleBeacons,
  BLE_BEACON_STORAGE_KEY,
} from "./bleBeacon";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  stopBleSosBeacon();

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
});

describe("Bluetooth Low Energy (BLE) SOS Beacon & Rescuer Radar", () => {
  it("starts and stops BLE beacon broadcast", () => {
    expect(isBleSosBeaconActive()).toBe(false);

    startBleSosBeacon({
      id: "SOS-BLE12345",
      latitude: 26.1445,
      longitude: 91.7362,
      emergencyType: "flood",
      peopleAffected: 3,
    });

    expect(isBleSosBeaconActive()).toBe(true);
    const active = getActiveBleBeacon();
    expect(active?.id).toBe("SOS-BLE12345");
    expect(active?.latitude).toBe(26.1445);
    expect(active?.peopleAffected).toBe(3);

    stopBleSosBeacon();
    expect(isBleSosBeaconActive()).toBe(false);
  });

  it("calculates estimated distance from RSSI signal strength", () => {
    const closeDistance = calculateBleDistanceMeters(-45);
    const midDistance = calculateBleDistanceMeters(-75);
    const farDistance = calculateBleDistanceMeters(-90);

    expect(closeDistance).toBeLessThan(midDistance);
    expect(midDistance).toBeLessThan(farDistance);
  });

  it("scans and detects nearby BLE beacons for rescuer boats", async () => {
    startBleSosBeacon({
      id: "SOS-BOAT-TARGET",
      latitude: 26.145,
      longitude: 91.737,
      emergencyType: "flood",
      peopleAffected: 4,
    });

    const scanned = await scanForNearbyBleBeacons(26.144, 91.736);
    expect(scanned).toHaveLength(1);
    expect(scanned[0].id).toBe("SOS-BOAT-TARGET");
    expect(scanned[0].distanceMeters).toBeDefined();
    expect(scanned[0].rssi).toBeDefined();
  });
});
