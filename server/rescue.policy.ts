export type MissionState = "pending" | "dispatched" | "resolved";

export function isAllowedMissionTransition(current: MissionState, next: MissionState): boolean {
  return (current === "pending" && next === "dispatched") || (current === "dispatched" && next === "resolved");
}

export const GUEST_SOS_WINDOW_MS = 5 * 60 * 1000;
export const GUEST_SOS_MAX_REQUESTS = 3;

export function getGuestSosRateLimitDecision(requestCount: number, windowStartedAt: Date, now: Date) {
  if (now.getTime() - windowStartedAt.getTime() >= GUEST_SOS_WINDOW_MS) return { action: "reset" as const, requestCount: 1 };
  if (requestCount >= GUEST_SOS_MAX_REQUESTS) return { action: "reject" as const, requestCount };
  return { action: "increment" as const, requestCount: requestCount + 1 };
}
