export type HospitalAccessRole = "user" | "rescuer" | "hospital" | "medical" | "admin";

export function canRequestHospitalRegistration(role: HospitalAccessRole) {
  return role === "user";
}

export function canEditHospitalResources(
  role: HospitalAccessRole,
  assignedHospitalId: number | null | undefined,
  requestedHospitalId: number,
  ownerUserId?: number | null,
  currentUserId?: number | null,
) {
  if (role === "admin") return true;
  if (role !== "hospital" && role !== "medical") return false;
  if (ownerUserId != null && currentUserId != null && ownerUserId === currentUserId) return true;
  return assignedHospitalId != null && assignedHospitalId === requestedHospitalId;
}
