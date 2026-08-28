export type MicPermissionState = "prompt" | "granted" | "denied" | "unsupported";

const MIC_SESSION_PROMPTED_KEY = "sudo-makeitwork-mic-session-prompted";
const MIC_STATUS_KEY = "sudo-makeitwork-mic-status";

const listeners = new Set<(status: MicPermissionState) => void>();

function notifyMicListeners(status: MicPermissionState) {
  listeners.forEach(fn => {
    try {
      fn(status);
    } catch {}
  });
}

export function subscribeMicPermission(listener: (status: MicPermissionState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isMicSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return Boolean(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

export async function checkCurrentMicPermission(): Promise<MicPermissionState> {
  if (!isMicSupported()) return "unsupported";

  if (typeof navigator !== "undefined" && navigator.permissions && typeof navigator.permissions.query === "function") {
    try {
      const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
      if (result.state === "granted" || result.state === "denied" || result.state === "prompt") {
        sessionStorage.setItem(MIC_STATUS_KEY, result.state);
        return result.state;
      }
    } catch {
      // Permissions API for microphone not universally supported across all browsers (e.g. Safari / Firefox on some platforms)
    }
  }

  const stored = sessionStorage.getItem(MIC_STATUS_KEY) as MicPermissionState | null;
  return stored || "prompt";
}

export async function requestMicPermission(force: boolean = false): Promise<MicPermissionState> {
  if (!isMicSupported()) return "unsupported";

  if (!force) {
    const isPrompted = sessionStorage.getItem(MIC_SESSION_PROMPTED_KEY) === "true";
    const currentStatus = sessionStorage.getItem(MIC_STATUS_KEY) as MicPermissionState | null;

    if (isPrompted && currentStatus === "denied") {
      return "denied";
    }

    if (typeof navigator !== "undefined" && navigator.permissions && typeof navigator.permissions.query === "function") {
      try {
        const queryResult = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (queryResult.state === "granted") {
          sessionStorage.setItem(MIC_STATUS_KEY, "granted");
          notifyMicListeners("granted");
          return "granted";
        }
      } catch {}
    }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Immediately release all audio tracks so the microphone does not stay active
    stream.getTracks().forEach(track => track.stop());

    sessionStorage.setItem(MIC_SESSION_PROMPTED_KEY, "true");
    sessionStorage.setItem(MIC_STATUS_KEY, "granted");
    notifyMicListeners("granted");
    return "granted";
  } catch (err: any) {
    sessionStorage.setItem(MIC_SESSION_PROMPTED_KEY, "true");
    sessionStorage.setItem(MIC_STATUS_KEY, "denied");
    notifyMicListeners("denied");
    return "denied";
  }
}

/**
 * Triggered strictly immediately after successful authentication (login / register).
 * Never called on unauthenticated pages or app load before login.
 */
export async function triggerPostAuthMicPermission(): Promise<MicPermissionState> {
  if (!isMicSupported()) return "unsupported";

  const isPrompted = sessionStorage.getItem(MIC_SESSION_PROMPTED_KEY) === "true";
  if (isPrompted) {
    return checkCurrentMicPermission();
  }

  // If already granted in a previous session or device settings, do not prompt again
  if (typeof navigator !== "undefined" && navigator.permissions && typeof navigator.permissions.query === "function") {
    try {
      const queryResult = await navigator.permissions.query({ name: "microphone" as PermissionName });
      if (queryResult.state === "granted") {
        sessionStorage.setItem(MIC_SESSION_PROMPTED_KEY, "true");
        sessionStorage.setItem(MIC_STATUS_KEY, "granted");
        notifyMicListeners("granted");
        return "granted";
      }
    } catch {}
  }

  return requestMicPermission(false);
}
