package gov.in.assamrescue.app.ble;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import gov.in.assamrescue.app.MainActivity;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Native Android Alert Manager for BLE SOS Emergency Detections.
 * Handles:
 * 1. Audible emergency ringtone playback via native RingtoneManager (no Web Audio API autoplay block).
 * 2. Multi-pulse haptic vibration pattern ([0, 400, 200, 400] ms).
 * 3. Dedicated High-Importance Notification Channel with tap-to-open navigation to Responder view.
 * 4. Alert deduplication and 60-second cooldown per unique emergency beacon to prevent notification spam.
 * 5. Full compliance with Android system ringer modes (normal, vibrate, silent/DND).
 */
public class BleSosAlertManager {
    private static final String TAG = "BleSosAlertManager";

    public static final String CHANNEL_ID = "assam_rescue_ble_detections";
    public static final String CHANNEL_NAME = "Assam Rescue BLE Emergency Detections";
    public static final long ALERT_COOLDOWN_MS = 60_000L; // 60s cooldown per unique beacon

    private static volatile BleSosAlertManager instance;
    private final Context context;
    private final Map<String, Long> lastAlertTimestamps = new ConcurrentHashMap<>();

    private BleSosAlertManager(Context context) {
        this.context = context.getApplicationContext();
        createNotificationChannel();
    }

    public static BleSosAlertManager getInstance(Context context) {
        if (instance == null) {
            synchronized (BleSosAlertManager.class) {
                if (instance == null) {
                    instance = new BleSosAlertManager(context);
                }
            }
        }
        return instance;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Audible alerts and notifications when nearby offline BLE distress beacons are detected.");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 400, 200, 400});
            channel.setShowBadge(true);

            NotificationManager nm = context.getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    /**
     * Triggers native emergency alert (sound, vibration, notification) for a detected beacon.
     * Enforces cooldown to prevent repeated alerts for the same beacon.
     *
     * @param beacon Detected distress beacon
     * @return true if a fresh alert was triggered; false if throttled by cooldown.
     */
    public synchronized boolean triggerEmergencyAlert(BleSosScanner.DetectedBeacon beacon) {
        if (beacon == null || beacon.id == null) {
            return false;
        }

        long now = System.currentTimeMillis();
        Long lastAlert = lastAlertTimestamps.get(beacon.id);
        if (lastAlert != null && (now - lastAlert) < ALERT_COOLDOWN_MS) {
            // Under cooldown: update notification silently if needed, but do not play alert sound or vibrate
            return false;
        }

        lastAlertTimestamps.put(beacon.id, now);
        Log.i(TAG, "Triggering native emergency alert for distress beacon: " + beacon.id);

        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        int ringerMode = (audioManager != null) ? audioManager.getRingerMode() : AudioManager.RINGER_MODE_NORMAL;

        // 1. Native Sound Playback (respected in RINGER_MODE_NORMAL)
        if (ringerMode == AudioManager.RINGER_MODE_NORMAL) {
            playAudibleAlert();
        }

        // 2. Native Vibration (respected in NORMAL and VIBRATE modes; suppressed in SILENT)
        if (ringerMode != AudioManager.RINGER_MODE_SILENT) {
            triggerVibration();
        }

        // 3. Android System Notification
        postDetectionNotification(beacon);

        return true;
    }

    private void playAudibleAlert() {
        try {
            Uri alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            if (alertUri == null) {
                alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            }
            if (alertUri != null) {
                Ringtone ringtone = RingtoneManager.getRingtone(context, alertUri);
                if (ringtone != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        ringtone.setVolume(1.0f);
                    }
                    ringtone.play();
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to play native ringtone: " + e.getMessage());
        }
    }

    private void triggerVibration() {
        try {
            long[] pattern = new long[]{0, 400, 200, 400};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) {
                    Vibrator v = vm.getDefaultVibrator();
                    if (v != null && v.hasVibrator()) {
                        v.vibrate(VibrationEffect.createWaveform(pattern, -1));
                    }
                }
            } else {
                Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createWaveform(pattern, -1));
                    } else {
                        v.vibrate(pattern, -1);
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to trigger vibration: " + e.getMessage());
        }
    }

    private void postDetectionNotification(BleSosScanner.DetectedBeacon beacon) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "POST_NOTIFICATIONS permission not granted; notification skipped.");
                return;
            }
        }

        try {
            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            launchIntent.putExtra("route", "/responder");
            launchIntent.putExtra("beaconId", beacon.id);

            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent contentPendingIntent = PendingIntent.getActivity(
                    context,
                    Math.abs(beacon.id.hashCode()),
                    launchIntent,
                    pendingFlags
            );

            String title = "🚨 Distress Beacon Detected: " + beacon.id;
            String proxLabel = (beacon.proximityCategory != null) ? beacon.proximityCategory.toUpperCase() : "PROXIMITY ESTIMATED";
            String content = "Emergency: " + beacon.emergencyType.toUpperCase() +
                    " • " + beacon.peopleAffected + " affected" +
                    " • ~" + beacon.approxDistanceMeters + "m (" + proxLabel + ")";

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setContentTitle(title)
                    .setContentText(content)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(
                            content + "\nSignal: " + beacon.rssi + " dBm (Path-loss estimate). Tap to open Rescuer Radar."
                    ))
                    .setSmallIcon(android.R.drawable.stat_sys_warning)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setContentIntent(contentPendingIntent)
                    .setAutoCancel(true);

            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                int notificationId = 92000 + (Math.abs(beacon.id.hashCode()) % 1000);
                nm.notify(notificationId, builder.build());
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to post emergency notification: " + e.getMessage());
        }
    }

    public boolean hasAlertedRecently(String beaconId) {
        if (beaconId == null) return false;
        Long last = lastAlertTimestamps.get(beaconId);
        return last != null && (System.currentTimeMillis() - last) < ALERT_COOLDOWN_MS;
    }

    public void clearCooldown(String beaconId) {
        if (beaconId != null) {
            lastAlertTimestamps.remove(beaconId);
        }
    }

    public void clearAllCooldowns() {
        lastAlertTimestamps.clear();
    }
}
