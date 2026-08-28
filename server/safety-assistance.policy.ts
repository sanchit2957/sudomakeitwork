export type SafetyAssistanceCategory = "shelter" | "food" | "medical" | "protection";
export type SafetyOperatorRole = "admin" | "hospital" | "medical" | "rescuer";
export type SafetyAssistanceStatus = "new" | "acknowledged" | "resolved";

export function canHandleSafetyAssistance(role: SafetyOperatorRole, category: SafetyAssistanceCategory) {
  return role === "admin" || role === "rescuer" || ((role === "hospital" || role === "medical") && category === "medical");
}

export function canTransitionSafetyAssistance(current: SafetyAssistanceStatus, next: Exclude<SafetyAssistanceStatus, "new">) {
  return (current === "new" && next === "acknowledged") || (current === "acknowledged" && next === "resolved");
}

export function visibleSafetyCategoriesForRole(role: SafetyOperatorRole): SafetyAssistanceCategory[] {
  return (role === "hospital" || role === "medical") ? ["medical"] : ["shelter", "food", "medical", "protection"];
}

export function isSafetyRequestOwnedBy(requesterId: number, viewerId: number) {
  return requesterId === viewerId;
}
