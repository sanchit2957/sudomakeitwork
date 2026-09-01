import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

/**
 * Automatically creates the high-priority emergency notification channel on Android (Capacitor).
 */
async function ensureNativeChannel(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.createChannel({
        id: "emergency_alerts",
        name: "Emergency SOS Alerts",
        description: "High priority alerts for disaster rescue missions",
        importance: 5, // High / Urgent
        visibility: 1, // Public
        sound: "beep.wav",
        vibration: true,
        lights: true,
        lightColor: "#DC2626",
      });
    } catch {
      // Channel might already exist or platform doesn't require it
    }
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureNativeChannel();
      const status = await LocalNotifications.checkPermissions();
      if (status.display === "granted") return true;
      const res = await LocalNotifications.requestPermissions();
      return res.display === "granted";
    } catch (err) {
      console.warn("[Notifications] Native permission error:", err);
      return false;
    }
  }

  if (typeof Notification !== "undefined") {
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch {
      return false;
    }
  }

  return false;
}

export async function showNotification(options: {
  title: string;
  body: string;
  id?: number;
}): Promise<void> {
  const { title, body, id = Math.floor(Math.random() * 100000) } = options;

  // 1. Native Capacitor Android / iOS local notification
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureNativeChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id,
            schedule: { at: new Date(Date.now() + 50) },
            sound: "beep.wav",
            channelId: "emergency_alerts",
            actionTypeId: "EMERGENCY_OFFER",
          },
        ],
      });
      return;
    } catch (err) {
      console.warn("[Notifications] Native schedule error:", err);
    }
  }

  // 2. Web Desktop / Mobile Notification
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: `sos-offer-${id}`,
        requireInteraction: true,
      });
    } catch (err) {
      console.warn("[Notifications] Web Notification error:", err);
    }
  }
}

/**
 * Web Audio API synthesizer for an immediate, unmistakable emergency siren alert.
 * Works without external assets and respects browser audio policies.
 */
export function playEmergencyAudioAlert(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: High warning pulse (880Hz -> 1200Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    // Tone 2: Alert reply pulse (1200Hz -> 960Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(1200, now + 0.28);
    osc2.frequency.exponentialRampToValueAtTime(960, now + 0.45);
    gain2.gain.setValueAtTime(0.4, now + 0.28);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.52);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.28);
    osc2.stop(now + 0.52);
  } catch (err) {
    console.warn("[Audio] Emergency sound synthesis error:", err);
  }
}
