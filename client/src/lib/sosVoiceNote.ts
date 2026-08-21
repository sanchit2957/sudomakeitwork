export type SosVoiceNoteDraft = { dataUrl: string; durationSeconds: number; createdAt: number };

const storageKey = "sudo-makeitwork-sos-voice-note";

export function readSosVoiceNote() {
  try {
    const value = sessionStorage.getItem(storageKey);
    return value ? JSON.parse(value) as SosVoiceNoteDraft : null;
  } catch {
    return null;
  }
}

export function saveSosVoiceNote(draft: SosVoiceNoteDraft) {
  sessionStorage.setItem(storageKey, JSON.stringify(draft));
}

export function clearSosVoiceNote() {
  sessionStorage.removeItem(storageKey);
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
