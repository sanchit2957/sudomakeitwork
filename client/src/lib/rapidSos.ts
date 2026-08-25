const latestSosStorageKey = "sudo-makeitwork-latest-sos";

export function rapidSosTrackingPath(publicCode: string) {
  const normalized = publicCode.trim().toUpperCase();
  if (!/^SOS-[A-Z0-9]{8}$/.test(normalized)) throw new Error("Invalid SOS tracking code.");
  return `/track?code=${normalized}`;
}

export function rememberLatestSos(publicCode: string) {
  const normalized = rapidSosTrackingPath(publicCode).split("=")[1]!;
  try { localStorage.setItem(latestSosStorageKey, normalized); } catch { /* Private-mode storage can be unavailable. */ }
  return normalized;
}

export function getLatestSos() {
  try {
    const stored = localStorage.getItem(latestSosStorageKey);
    return stored && /^SOS-[A-Z0-9]{8}$/.test(stored) ? stored : "";
  } catch { return ""; }
}

export function redirectAfterRapidSos(publicCode: string, navigate: (path: string) => void) {
  navigate(rapidSosTrackingPath(rememberLatestSos(publicCode)));
}

export async function createAndRedirectAfterRapidSos<TInput, TResponse extends { publicCode: string }>({ payload, createSos, navigate }: { payload: TInput; createSos: (input: TInput) => Promise<TResponse>; navigate: (path: string) => void }) {
  const created = await createSos(payload);
  redirectAfterRapidSos(created.publicCode, navigate);
  return created;
}
