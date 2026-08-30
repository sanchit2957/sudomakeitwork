export type EditableSosStatus = "pending" | "dispatched" | "resolved";

export function mayEditPostAlertDetails(reporterId: number | null, actorId: number, status: EditableSosStatus) {
  return reporterId === actorId && status !== "resolved";
}
