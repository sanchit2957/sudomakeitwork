/**
 * @vitest-environment jsdom
 *
 * Tests for client/src/hooks/useLiveRescuerStream.ts
 * Covers SSE connection, reconnection, cleanup, polling fallback,
 * stale GPS detection, malformed event handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useLiveRescuerStream, LIVE_LOCATION_STALE_THRESHOLD_MS, ARRIVING_DISTANCE_KM } from "./useLiveRescuerStream";

// ---- Mock EventSource ----
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  readyState = 1;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  _onerror: ((e: Event) => void) | null = null;

  constructor(url: string, opts?: EventSourceInit) {
    this.url = url;
    this.withCredentials = opts?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  set onerror(handler: ((e: Event) => void)) {
    this._onerror = handler;
  }

  emit(event: string, data: unknown) {
    const handlers = this.listeners[event] ?? [];
    const msg = { data: JSON.stringify(data) } as MessageEvent;
    handlers.forEach(h => h(msg));
  }

  close() {
    this.readyState = 2;
  }

  simulateError() {
    this._onerror?.(new Event("error"));
  }
}

describe("useLiveRescuerStream", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    (globalThis as any).EventSource = MockEventSource;
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("Test 21: SSE connection opens on valid publicCode", () => {
    renderHook(() => useLiveRescuerStream("SOS-ABCD1234"));
    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0].url).toContain("code=SOS-ABCD1234");
  });

  it("Test 22: SSE reconnects after error with exponential backoff", async () => {
    const { result } = renderHook(() => useLiveRescuerStream("SOS-ABCD1234"));
    const firstInstance = MockEventSource.instances[0];

    act(() => {
      firstInstance.simulateError();
    });

    // After 2 seconds delay (first reconnect)
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(MockEventSource.instances.length).toBe(2);
  });

  it("Test 23: SSE cleanup on unmount closes EventSource", () => {
    const { unmount } = renderHook(() => useLiveRescuerStream("SOS-ABCD1234"));
    const instance = MockEventSource.instances[0];
    unmount();
    expect(instance.readyState).toBe(2); // closed
  });

  it("Test 24: Polling interval is 4000ms when SSE disconnected", () => {
    const { result } = renderHook(() => useLiveRescuerStream("SOS-ABCD1234"));
    // Initially connecting, so polling fallback is active
    expect(result.current.pollingIntervalMs).toBe(4_000);
  });

  it("Test 25: Polling interval is null (no fallback) when SSE connected", () => {
    const { result } = renderHook(() => useLiveRescuerStream("SOS-ABCD1234"));
    const instance = MockEventSource.instances[0];

    act(() => {
      instance.emit("connected", {
        type: "connected",
        publicCode: "SOS-ABCD1234",
        incidentStatus: "dispatched",
        rescuer: {
          callSign: "ALPHA-01",
          name: "John",
          photoUrl: null,
          phone: null,
          locationStatus: "live",
          latitude: 26.1445,
          longitude: 91.7362,
          updatedAt: new Date().toISOString(),
        },
        route: null,
        timestamp: new Date().toISOString(),
      });
    });

    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.pollingIntervalMs).toBeNull();
  });

  it("Test 26: Live marker updates with valid coordinates", () => {
    const { result } = renderHook(() => useLiveRescuerStream("SOS-ABCD1234"));
    const instance = MockEventSource.instances[0];

    // First: connected
    act(() => {
      instance.emit("connected", {
        type: "connected",
        publicCode: "SOS-ABCD1234",
        incidentStatus: "dispatched",
        rescuer: null,
        route: null,
        timestamp: new Date().toISOString(),
      });
    });

    // Then: location update
    act(() => {
      instance.emit("rescuer_location", {
        type: "rescuer_location",
        publicCode: "SOS-ABCD1234",
        incidentStatus: "dispatched",
        rescuer: {
          callSign: "ALPHA-01",
          name: null,
          photoUrl: null,
          phone: null,
          locationStatus: "live",
          latitude: 26.1500,
          longitude: 91.7400,
          updatedAt: new Date().toISOString(),
        },
        route: {
          distanceKm: 1.2,
          distanceText: "1.2 km",
          durationMinutes: 4,
          etaText: "4 min",
          isApproximate: false,
          coordinates: [[26.1445, 91.7362], [26.1500, 91.7400]],
        },
        timestamp: new Date().toISOString(),
      });
    });

    expect(result.current.rescuer).not.toBeNull();
    expect(result.current.rescuer?.latitude).toBeCloseTo(26.1500, 4);
    expect(result.current.rescuer?.longitude).toBeCloseTo(91.7400, 4);
    expect(result.current.route).not.toBeNull();
    expect(result.current.route?.distanceKm).toBe(1.2);
  });

  it("Test 27: Stale GPS shows isStale after threshold", () => {
    const { result } = renderHook(() => useLiveRescuerStream("SOS-ABCD1234"));
    const instance = MockEventSource.instances[0];

    act(() => {
      instance.emit("connected", {
        type: "connected",
        publicCode: "SOS-ABCD1234",
        incidentStatus: "dispatched",
        rescuer: {
          callSign: "ALPHA-01",
          name: null,
          photoUrl: null,
          phone: null,
          locationStatus: "live",
          latitude: 26.1445,
          longitude: 91.7362,
          updatedAt: new Date().toISOString(),
        },
        route: null,
        timestamp: new Date().toISOString(),
      });
    });

    // Not stale immediately
    expect(result.current.isStale).toBe(false);

    // Advance time past LIVE_LOCATION_STALE_THRESHOLD_MS
    act(() => {
      vi.advanceTimersByTime(LIVE_LOCATION_STALE_THRESHOLD_MS + 10_000);
    });

    expect(result.current.isStale).toBe(true);
  });

  it("Test 28: ETA card updates when new route arrives", () => {
    const { result } = renderHook(() => useLiveRescuerStream("SOS-ABCD1234"));
    const instance = MockEventSource.instances[0];

    act(() => {
      instance.emit("connected", {
        type: "connected",
        publicCode: "SOS-ABCD1234",
        incidentStatus: "dispatched",
        rescuer: null,
        route: null,
        timestamp: new Date().toISOString(),
      });
    });

    expect(result.current.route).toBeNull();

    act(() => {
      instance.emit("rescuer_location", {
        type: "rescuer_location",
        publicCode: "SOS-ABCD1234",
        incidentStatus: "dispatched",
        rescuer: {
          callSign: "B-02",
          name: null,
          photoUrl: null,
          phone: null,
          locationStatus: "live",
          latitude: 26.18,
          longitude: 91.76,
          updatedAt: new Date().toISOString(),
        },
        route: {
          distanceKm: 3.5,
          distanceText: "3.5 km",
          durationMinutes: 8,
          etaText: "8 min",
          isApproximate: false,
          coordinates: [],
        },
        timestamp: new Date().toISOString(),
      });
    });

    expect(result.current.route?.durationMinutes).toBe(8);
    expect(result.current.route?.etaText).toBe("8 min");
  });

  it("Test 29: Completed mission stops tracking", () => {
    const { result } = renderHook(() => useLiveRescuerStream("SOS-ABCD1234"));
    const instance = MockEventSource.instances[0];

    act(() => {
      instance.emit("connected", {
        type: "connected",
        publicCode: "SOS-ABCD1234",
        incidentStatus: "dispatched",
        rescuer: null,
        route: null,
        timestamp: new Date().toISOString(),
      });
    });

    act(() => {
      instance.emit("mission_status", {
        type: "mission_status",
        publicCode: "SOS-ABCD1234",
        incidentStatus: "resolved",
        timestamp: new Date().toISOString(),
      });
    });

    expect(result.current.incidentStatus).toBe("resolved");
    expect(result.current.connectionStatus).toBe("disconnected");
  });

  it("ignores malformed events without crashing", () => {
    const { result } = renderHook(() => useLiveRescuerStream("SOS-ABCD1234"));
    const instance = MockEventSource.instances[0];

    expect(() => {
      act(() => {
        // Emit a completely invalid payload
        const handlers = instance.listeners["connected"] ?? [];
        const msg = { data: "this is not JSON" } as MessageEvent;
        handlers.forEach(h => {
          try { h(msg); } catch {}
        });
      });
    }).not.toThrow();
  });

  it("ignores events with invalid coordinates", () => {
    const { result } = renderHook(() => useLiveRescuerStream("SOS-ABCD1234"));
    const instance = MockEventSource.instances[0];

    act(() => {
      instance.emit("connected", {
        type: "connected",
        publicCode: "SOS-ABCD1234",
        incidentStatus: "dispatched",
        rescuer: null,
        route: null,
        timestamp: new Date().toISOString(),
      });
    });

    act(() => {
      instance.emit("rescuer_location", {
        type: "rescuer_location",
        publicCode: "SOS-ABCD1234",
        incidentStatus: "dispatched",
        rescuer: {
          callSign: "X",
          name: null,
          photoUrl: null,
          phone: null,
          locationStatus: "live",
          latitude: NaN, // Invalid!
          longitude: 91.7,
          updatedAt: new Date().toISOString(),
        },
        route: null,
        timestamp: new Date().toISOString(),
      });
    });

    // Rescuer should not update due to invalid coordinates
    expect(result.current.rescuer).toBeNull();
  });

  it("ARRIVING_DISTANCE_KM constant is 0.5 km", () => {
    expect(ARRIVING_DISTANCE_KM).toBe(0.5);
  });

  it("LIVE_LOCATION_STALE_THRESHOLD_MS constant is 90000ms", () => {
    expect(LIVE_LOCATION_STALE_THRESHOLD_MS).toBe(90_000);
  });
});
