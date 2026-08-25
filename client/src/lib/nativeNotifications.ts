import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
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

  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id,
            schedule: { at: new Date(Date.now() + 50) },
            sound: "beep.wav",
          },
        ],
      });
      return;
    } catch (err) {
      console.warn("[Notifications] Native schedule error:", err);
    }
  }

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch (err) {
      console.warn("[Notifications] Web Notification error:", err);
    }
  }
}
