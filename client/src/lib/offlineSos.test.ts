import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushOfflineSos, queueOfflineSos, readOfflineSosOutbox } from "./offlineSos";

const store = new Map<string, string>();
const payload = { locationLabel: "Safe test landmark", latitude: 26.2, longitude: 92.9, emergencyType: "flood" as const, severity: "high" as const, peopleAffected: 2, guestKey: "123456789012345678901234" };

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent: vi.fn() } });
});

describe("offline SOS outbox", () => {
  it("keeps a report on device until a later delivery succeeds", async () => {
    queueOfflineSos(payload);
    expect(readOfflineSosOutbox()).toHaveLength(1);
    const result = await flushOfflineSos(async () => ({ publicCode: "SOS-TEST123" }));
    expect(result).toEqual({ delivered: ["SOS-TEST123"], remaining: 0 });
    expect(readOfflineSosOutbox()).toHaveLength(0);
  });

  it("retains a report when delivery is still unavailable", async () => {
    queueOfflineSos(payload);
    await flushOfflineSos(async () => { throw new Error("offline"); });
    expect(readOfflineSosOutbox()).toHaveLength(1);
  });
});
