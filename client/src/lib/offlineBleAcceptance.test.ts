import { beforeEach, describe, expect, it } from "vitest";
import {
  recordOfflineBleAcceptance,
  getOfflineBleAcceptance,
  listAllOfflineBleAcceptances,
  listPendingOfflineBleAcceptances,
  updateOfflineBleAcceptanceStatus,
  type OfflineBleAcceptanceRecord,
} from "./offlineBleAcceptanceDb";

describe("Offline BLE Acceptance Storage (IndexedDB Mock/In-Memory)", () => {
  const store = new Map<string, OfflineBleAcceptanceRecord>();

  beforeEach(() => {
    store.clear();
  });

  it("creates and retrieves an offline acceptance record", async () => {
    const acceptance: OfflineBleAcceptanceRecord = {
      id: "test-uuid-1",
      bleBeaconId: "B6N9Y85F",
      acceptedAt: Date.now(),
      rescuerId: 42,
      rescuerLatitude: 26.1445,
      rescuerLongitude: 91.7362,
      syncStatus: "pending",
    };
    store.set(acceptance.bleBeaconId, acceptance);

    const retrieved = store.get("B6N9Y85F");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.bleBeaconId).toBe("B6N9Y85F");
    expect(retrieved?.rescuerId).toBe(42);
    expect(retrieved?.syncStatus).toBe("pending");
  });

  it("updates acceptance status when reconciled with server", async () => {
    const acceptance: OfflineBleAcceptanceRecord = {
      id: "test-uuid-2",
      bleBeaconId: "K8N2X9P1",
      acceptedAt: Date.now(),
      rescuerId: 101,
      syncStatus: "pending",
    };
    store.set(acceptance.bleBeaconId, acceptance);

    // Simulate status update upon server assignment
    const existing = store.get("K8N2X9P1")!;
    const updated: OfflineBleAcceptanceRecord = {
      ...existing,
      syncStatus: "synced",
      assignedPublicCode: "SOS-R4GNKX2M",
    };
    store.set("K8N2X9P1", updated);

    const recheck = store.get("K8N2X9P1");
    expect(recheck?.syncStatus).toBe("synced");
    expect(recheck?.assignedPublicCode).toBe("SOS-R4GNKX2M");
  });

  it("handles assignment conflict when another responder accepted first", async () => {
    const acceptance: OfflineBleAcceptanceRecord = {
      id: "test-uuid-3",
      bleBeaconId: "CONFLIC1",
      acceptedAt: Date.now(),
      rescuerId: 102,
      syncStatus: "pending",
    };
    store.set(acceptance.bleBeaconId, acceptance);

    const existing = store.get("CONFLIC1")!;
    const conflictUpdate: OfflineBleAcceptanceRecord = {
      ...existing,
      syncStatus: "conflict",
      syncError: "This emergency was already assigned to another responder.",
    };
    store.set("CONFLIC1", conflictUpdate);

    const recheck = store.get("CONFLIC1");
    expect(recheck?.syncStatus).toBe("conflict");
    expect(recheck?.syncError).toContain("already assigned");
  });
});
