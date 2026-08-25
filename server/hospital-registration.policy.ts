export type HospitalAccessRole = "user" | "rescuer" | "medical" | "admin";

export function canRequestHospitalRegistration(role: HospitalAccessRole) {
  return role === "user";
}

export function canEditHospitalResources(role: HospitalAccessRole, assignedHospitalId: number | null | undefined, requestedHospitalId: number) {
  return role === "admin" || (role === "medical" && assignedHospitalId === requestedHospitalId);
}
