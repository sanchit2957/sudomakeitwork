import { describe, expect, it } from "vitest";
import { GUEST_SOS_MAX_REQUESTS, GUEST_SOS_WINDOW_MS, getGuestSosRateLimitDecision, isAllowedMissionTransition } from "./rescue.policy";

describe("mission workflow policy", () => {
  it("only permits Pending → Dispatched → Resolved", () => {
    expect(isAllowedMissionTransition("pending", "dispatched")).toBe(true);
    expect(isAllowedMissionTransition("dispatched", "resolved")).toBe(true);
    expect(isAllowedMissionTransition("pending", "resolved")).toBe(false);
    expect(isAllowedMissionTransition("dispatched", "pending")).toBe(false);
    expect(isAllowedMissionTransition("resolved", "dispatched")).toBe(false);
  });
});

describe("guest SOS rate-limit policy", () => {
  const startedAt = new Date("2026-08-19T10:00:00.000Z");

  it("increments a report count inside the protection window", () => {
    expect(getGuestSosRateLimitDecision(1, startedAt, new Date(startedAt.getTime() + 60_000))).toEqual({ action: "increment", requestCount: 2 });
  });

  it("rejects a fourth report within the same window", () => {
    expect(getGuestSosRateLimitDecision(GUEST_SOS_MAX_REQUESTS, startedAt, new Date(startedAt.getTime() + 60_000))).toEqual({ action: "reject", requestCount: GUEST_SOS_MAX_REQUESTS });
  });

  it("opens a fresh reporting window after expiry", () => {
    expect(getGuestSosRateLimitDecision(GUEST_SOS_MAX_REQUESTS, startedAt, new Date(startedAt.getTime() + GUEST_SOS_WINDOW_MS))).toEqual({ action: "reset", requestCount: 1 });
  });
});
