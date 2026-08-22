export function rapidSosTrackingPath(publicCode: string) {
  const normalized = publicCode.trim().toUpperCase();
  if (!/^SOS-[A-Z0-9]{8}$/.test(normalized)) throw new Error("Invalid SOS tracking code.");
  return `/track?code=${normalized}`;
}

export function redirectAfterRapidSos(publicCode: string, navigate: (path: string) => void) {
  navigate(rapidSosTrackingPath(publicCode));
}

export async function createAndRedirectAfterRapidSos<TInput, TResponse extends { publicCode: string }>({ payload, createSos, navigate }: { payload: TInput; createSos: (input: TInput) => Promise<TResponse>; navigate: (path: string) => void }) {
  const created = await createSos(payload);
  redirectAfterRapidSos(created.publicCode, navigate);
  return created;
}
