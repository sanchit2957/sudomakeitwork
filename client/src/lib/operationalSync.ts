export function markIncidentDispatched<T extends { incident: { id: number; status: string } }>(rows: T[] | undefined, incidentId: number): T[] | undefined {
  if (!rows) return undefined;
  return rows.map(row => (row.incident.id === incidentId ? { ...row, incident: { ...row.incident, status: "dispatched" as T["incident"]["status"] } } : row));
}

export function reconcileMissionStatus<T extends { mission: { id: number; status: string }; incident: { status: string } }>(rows: T[] | undefined, missionId: number, status: T["mission"]["status"]): T[] | undefined {
  if (!rows) return undefined;
  return rows.map(row => (row.mission.id === missionId ? { ...row, mission: { ...row.mission, status }, incident: { ...row.incident, status: status as T["incident"]["status"] } } : row));
}

export function reconcileAvailability<T>(profile: T | null | undefined, availability: string): T | undefined {
  return profile ? { ...profile, availability } as unknown as T : undefined;
}
