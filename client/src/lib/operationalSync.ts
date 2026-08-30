export function markIncidentDispatched<T extends { incident: { id: number; status: string } }>(rows: T[] | undefined, incidentId: number) {
  return rows?.map(row => row.incident.id === incidentId ? { ...row, incident: { ...row.incident, status: "dispatched" as T["incident"]["status"] } } : row);
}

export function reconcileMissionStatus<T extends { mission: { id: number; status: string }; incident: { status: string } }>(rows: T[] | undefined, missionId: number, status: T["mission"]["status"]) {
  return rows?.map(row => row.mission.id === missionId ? { ...row, mission: { ...row.mission, status }, incident: { ...row.incident, status: status as T["incident"]["status"] } } : row);
}

export function reconcileAvailability<T extends { availability: string }>(profile: T | null | undefined, availability: T["availability"]): T | undefined {
  return profile ? { ...profile, availability } : undefined;
}
