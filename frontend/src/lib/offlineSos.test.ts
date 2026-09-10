import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushOfflineSos, queueOfflineSos, readOfflineSosOutbox, pendingSosCount, _resetMigrationForTesting } from "./offlineSos";
import { _resetDbPromise, queueSosToDb, readPendingSos, markSosDelivered, markSosFailed, purgeSosOlderThan } from "./offlineSosDb";

const localStore = new Map<string, string>();
const idbStore = new Map<string, any>();

function createMockIndexedDb() {
  idbStore.clear();
  return {
    open: vi.fn((_name: string, _version: number) => {
      const request: any = {
        result: {
          objectStoreNames: {
            contains: (_s: string) => true,
          },
          createObjectStore: vi.fn(() => ({
            createIndex: vi.fn(),
          })),
          transaction: (_storeName: string, _mode: string) => {
            const tx: any = {
              oncomplete: null,
              onerror: null,
              objectStore: (_s: string) => ({
                put: (record: any) => {
                  idbStore.set(record.id, JSON.parse(JSON.stringify(record)));
                  setTimeout(() => tx.oncomplete?.(), 0);
                },
                get: (id: string) => {
                  const req: any = { result: idbStore.get(id) ? JSON.parse(JSON.stringify(idbStore.get(id))) : undefined };
                  setTimeout(() => req.onsuccess?.(), 0);
                  return req;
                },
                getAll: () => {
                  const req: any = { result: Array.from(idbStore.values()).map(v => JSON.parse(JSON.stringify(v))) };
                  setTimeout(() => req.onsuccess?.(), 0);
                  return req;
                },
                index: (_indexName: string) => ({
                  getAll: (query: string) => {
                    const req: any = {
                      result: Array.from(idbStore.values())
                        .filter(v => v.status === query)
                        .map(v => JSON.parse(JSON.stringify(v))),
                    };
                    setTimeout(() => req.onsuccess?.(), 0);
                    return req;
                  },
                }),
                openCursor: () => {
                  const items = Array.from(idbStore.entries());
                  let index = 0;
                  const req: any = {};
                  const advance = () => {
                    if (index < items.length) {
                      const [key, value] = items[index];
                      req.result = {
                        value,
                        delete: () => idbStore.delete(key),
                        continue: () => {
                          index++;
                          advance();
                        },
                      };
                      req.onsuccess?.();
                    } else {
                      req.result = null;
                      req.onsuccess?.();
                      setTimeout(() => tx.oncomplete?.(), 0);
                    }
                  };
                  setTimeout(advance, 0);
                  return req;
                },
              }),
            };
            return tx;
          },
        },
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    }),
  };
}

const payload = {
  locationLabel: "Safe test landmark in Guwahati",
  latitude: 26.1445,
  longitude: 91.7362,
  emergencyType: "flood" as const,
  severity: "high" as const,
  peopleAffected: 2,
  guestKey: "123456789012345678901234",
};

beforeEach(() => {
  localStore.clear();
  idbStore.clear();
  _resetDbPromise();
  _resetMigrationForTesting();

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => localStore.get(key) ?? null,
      setItem: (key: string, value: string) => localStore.set(key, value),
      removeItem: (key: string) => localStore.delete(key),
    },
  });

  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: createMockIndexedDb(),
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { dispatchEvent: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
});

describe("offline SOS IndexedDB storage & flush", () => {
  it("stores SOS in IndexedDB and retrieves pending count", async () => {
    const count = await queueOfflineSos(payload);
    expect(count).toBe(1);

    const outbox = await readOfflineSosOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].locationLabel).toBe("Safe test landmark in Guwahati");
    expect(outbox[0].latitude).toBe(26.1445);
    expect(await pendingSosCount()).toBe(1);
  });

  it("flushes and marks delivered successfully", async () => {
    await queueOfflineSos(payload);
    const result = await flushOfflineSos(async (p) => {
      expect(p.locationLabel).toBe("Safe test landmark in Guwahati");
      return { publicCode: "SOS-IDBTEST1" };
    });

    expect(result).toEqual({ delivered: ["SOS-IDBTEST1"], remaining: 0 });
    expect(await readOfflineSosOutbox()).toHaveLength(0);
    expect(await pendingSosCount()).toBe(0);
  });

  it("retains pending SOS if network delivery throws an error", async () => {
    await queueOfflineSos(payload);
    const result = await flushOfflineSos(async () => {
      throw new Error("Network unreachable");
    });

    expect(result.delivered).toHaveLength(0);
    expect(result.remaining).toBe(1);
    expect(await readOfflineSosOutbox()).toHaveLength(1);
  });

  it("preserves voice note attachments in IndexedDB offline queue", async () => {
    const voicePayload = {
      ...payload,
      voiceNoteDataUrl: "data:audio/webm;base64,dGVzdGF1ZGlv",
      voiceNoteDurationSeconds: 15,
    };
    await queueOfflineSos(voicePayload);

    let capturedPayload: any = null;
    await flushOfflineSos(async (queued) => {
      capturedPayload = queued;
      return { publicCode: "SOS-VOICEIDB" };
    });

    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.voiceNoteDataUrl).toBe("data:audio/webm;base64,dGVzdGF1ZGlv");
    expect(capturedPayload.voiceNoteDurationSeconds).toBe(15);
  });

  it("migrates existing localStorage items into IndexedDB seamlessly", async () => {
    // Put legacy item in localStorage before IDB migration
    localStore.set(
      "sudo-makeitwork-sos-outbox-v1",
      JSON.stringify([
        { ...payload, id: "legacy-uuid", createdAt: Date.now() - 1000 },
      ])
    );

    const outbox = await readOfflineSosOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].locationLabel).toBe("Safe test landmark in Guwahati");
    // Should have cleared from localStorage
    expect(localStore.get("sudo-makeitwork-sos-outbox-v1")).toBeUndefined();
  });
});
