export function canRequestRescuerRegistration(role: "user" | "rescuer" | "medical" | "admin") {
  return role === "user";
}

export function requiresCallSign(decision: "approved" | "rejected", callSign?: string) {
  return decision !== "approved" || Boolean(callSign?.trim());
}
