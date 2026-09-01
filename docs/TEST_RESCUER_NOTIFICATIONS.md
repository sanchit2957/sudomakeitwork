# Rescuer SOS Notification System - Manual Verification Checklist

This document details how to verify that incoming emergency SOS mission offers reliably trigger audio, visual, and OS notifications across Web and Native Android APK environments.

---

## Testing Environments Covered:
1. **Localhost Web** (`http://localhost:3000`)
2. **Cloud Deployed Web** (e.g. Render HTTPS)
3. **Capacitor Native Android APK** (Debug & Release builds)

---

## 5-Point Test Checklist

### 1. (a) Web Tab is Focused
* **Action**: Log in as a rescuer (set status to **Available**), keep `/responder` tab active and visible in the browser. Submit an SOS from `/victim` (or incognito window).
* **Expected Result**:
  * Emergency siren synthesizer immediately beeps in the browser (`playEmergencyAudioAlert`).
  * High-priority sticky `EmergencyOfferCard` alert banner appears at the top of the viewport with countdown timer and pulsating border.
  * Browser OS desktop notification appears unconditionally with title `🚨 EMERGENCY SOS OFFER: ...`.
  * Document title alternates between `(1) 🚨 NEW SOS - sudo MakeItWork` and `⚠️ MISSION OFFER PENDING`.

---

### 2. (b) Web Tab is Backgrounded (Minimized or Another Tab Active)
* **Action**: Keep `/responder` open in one tab, but switch to a different browser tab or minimize browser window. Trigger an SOS.
* **Expected Result**:
  * Browser tab title flashes `(1) 🚨 NEW SOS - sudo MakeItWork` alerting the user even if another tab is focused.
  * OS desktop notification pops up on screen with sound and action cue.
  * Clicking the OS notification focuses `/responder` directly showing the active mission offer ready for one-click acceptance.

---

### 3. (c) Web Tab is Fully Closed (with Web Push Subscribed)
* **Action**: Rescuer clicked "Allow alerts" (subscribing their browser endpoint with VAPID). Fully close all browser windows. Trigger an SOS.
* **Expected Result**:
  * Service worker (`/sw.js`) receives the background `push` event sent from `sendRescuerPush`.
  * Native OS system notification displays `🚨 EMERGENCY OFFER: ... 15s to accept.` with vibration and sound.
  * Clicking the notification opens the browser and routes directly to `/responder`.

---

### 4. (d) Android APK is in Foreground
* **Action**: Launch the Android APK on a device or emulator, sign in as rescuer with availability marked "Available", and keep app on screen. Trigger an SOS.
* **Expected Result**:
  * `requestNotificationPermission()` was auto-granted on initial dashboard load.
  * Native `LocalNotifications.schedule` fires on channel `emergency_alerts` with `beep.wav` sound and vibration.
  * Top sticky emergency modal/banner appears over current view.

---

### 5. (e) Android APK is in Background / Screen Locked
* **Action**: Minimize the app or lock the Android device screen. Trigger an SOS.
* **Expected Result**:
  * Android heads-up emergency notification appears on lock screen / status bar with high importance (Importance 5).
  * Device vibrates and plays `beep.wav`.
  * Tapping the notification unlocks into the app and shows the countdown offer card.

---

## Push Fallback In-App Traceability
* If a rescuer hasn't subscribed to web push or background push delivery skips, the automated dispatch orchestrator automatically inserts an in-app fallback record into the `notifications` table and logs:
  ```
  [Dispatch] Push delivery skipped/unreached for rescuer user IDs: [101, ...]. Inserting in-app polling notification fallbacks.
  ```
* Rescuers receive polling updates via React Query within 3 seconds on `/responder`.
