package gov.in.assamrescue.app.ble;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import gov.in.assamrescue.app.MainActivity;

/**
 * Foreground Service for continuous background BLE SOS broadcasting and Rescuer scanning.
 * Guarantees that:
 * 1. The victim's distress beacon continues transmitting even when the phone is locked.
 * 2. The rescuer's radar scanner continues actively monitoring for SOS signals in disaster zones.
 * 3. Advertising and scanning are maintained as independent operations without mutual cancellation.
 * 4. Android 14+ foregroundServiceType="connectedDevice" lifecycle requirements are honored.
 */
public class BleSosForegroundService extends Service {
    private static final String TAG = "BleSosService";
    public static final String CHANNEL_ID = "assam_rescue_ble_sos_channel";
    public static final int NOTIFICATION_ID = 91101;

    // Actions
    public static final String ACTION_START_ADVERTISE = "gov.in.assamrescue.app.ble.ACTION_START_ADVERTISE";
    public static final String ACTION_STOP_ADVERTISE = "gov.in.assamrescue.app.ble.ACTION_STOP_ADVERTISE";
    public static final String ACTION_START_SCAN = "gov.in.assamrescue.app.ble.ACTION_START_SCAN";
    public static final String ACTION_STOP_SCAN = "gov.in.assamrescue.app.ble.ACTION_STOP_SCAN";

    // Legacy Action compatibility
    public static final String ACTION_START = "gov.in.assamrescue.app.ble.ACTION_START";
    public static final String ACTION_STOP = "gov.in.assamrescue.app.ble.ACTION_STOP";

    public static final String EXTRA_ID = "extra_id";
    public static final String EXTRA_TYPE = "extra_type";
    public static final String EXTRA_PEOPLE = "extra_people";
    public static final String EXTRA_TIMESTAMP = "extra_timestamp";
    public static final String EXTRA_PRIORITY = "extra_priority";
    public static final String EXTRA_LATITUDE = "extra_latitude";
    public static final String EXTRA_LONGITUDE = "extra_longitude";
    public static final String EXTRA_HOP = "extra_hop";

    private static volatile boolean isAdvertisingActive = false;
    private static volatile boolean isScanningActive = false;
    private static volatile BleSosPayload activePayload = null;

    private BleSosAdvertiser advertiser;
    private PowerManager.WakeLock wakeLock;

    public static boolean isAdvertisingRunning() {
        return isAdvertisingActive;
    }

    public static boolean isScanningRunning() {
        return isScanningActive;
    }

    public static BleSosPayload getActivePayload() {
        return activePayload;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        advertiser = new BleSosAdvertiser(this);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            updateForegroundState();
            return START_STICKY;
        }

        String action = intent.getAction();
        if (action == null) {
            updateForegroundState();
            return START_STICKY;
        }

        Log.d(TAG, "onStartCommand received action: " + action);

        if (ACTION_STOP.equals(action)) {
            // Full stop requested: halts both advertising and scanning
            isAdvertisingActive = false;
            isScanningActive = false;
            activePayload = null;
            if (advertiser != null) {
                advertiser.stopAdvertising();
            }
            updateForegroundState();
            return START_NOT_STICKY;
        }

        if (ACTION_STOP_ADVERTISE.equals(action)) {
            isAdvertisingActive = false;
            activePayload = null;
            if (advertiser != null) {
                advertiser.stopAdvertising();
            }
            updateForegroundState();
            return START_STICKY;
        }

        if (ACTION_STOP_SCAN.equals(action)) {
            isScanningActive = false;
            updateForegroundState();
            return START_STICKY;
        }

        if (ACTION_START_ADVERTISE.equals(action) || ACTION_START.equals(action)) {
            String id = intent.getStringExtra(EXTRA_ID);
            String type = intent.getStringExtra(EXTRA_TYPE);
            int people = intent.getIntExtra(EXTRA_PEOPLE, 1);
            long timestamp = intent.getLongExtra(EXTRA_TIMESTAMP, System.currentTimeMillis());
            String priority = intent.getStringExtra(EXTRA_PRIORITY);
            double lat = intent.getDoubleExtra(EXTRA_LATITUDE, Double.NaN);
            double lng = intent.getDoubleExtra(EXTRA_LONGITUDE, Double.NaN);
            int hop = intent.getIntExtra(EXTRA_HOP, 0);

            Double origLat = Double.isNaN(lat) ? null : lat;
            Double origLng = Double.isNaN(lng) ? null : lng;

            activePayload = new BleSosPayload(BleSosPayload.PROTOCOL_VERSION_V2, id, type, people, timestamp, priority, origLat, origLng, hop);
            isAdvertisingActive = true;

            if (advertiser != null) {
                advertiser.startAdvertising(activePayload);
            }
            updateForegroundState();
            return START_STICKY;
        }

        if (ACTION_START_SCAN.equals(action)) {
            isScanningActive = true;
            updateForegroundState();
            return START_STICKY;
        }

        return START_STICKY;
    }

    private synchronized void updateForegroundState() {
        if (!isAdvertisingActive && !isScanningActive) {
            Log.i(TAG, "Neither advertising nor scanning active. Stopping foreground service.");
            if (advertiser != null) {
                advertiser.stopAdvertising();
            }
            releaseWakeLock();
            stopForeground(true);
            stopSelf();
            return;
        }

        Notification notification = buildDynamicNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        acquireWakeLock();
    }

    private void acquireWakeLock() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AssamRescue:BleSosForegroundWakeLock");
                    wakeLock.acquire(2 * 60 * 60 * 1000L); // 2 hours max safety limit
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to acquire wake lock: " + e.getMessage());
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to release wake lock: " + e.getMessage());
        }
    }

    private Notification buildDynamicNotification() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (isScanningActive && !isAdvertisingActive) {
            launchIntent.putExtra("route", "/responder");
        }

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent contentPendingIntent = PendingIntent.getActivity(
                this, 0, launchIntent, pendingFlags
        );

        String title;
        String text;

        if (isAdvertisingActive && isScanningActive) {
            String beaconId = (activePayload != null) ? activePayload.getId() : "ACTIVE";
            title = "Assam Rescue: SOS Beacon & Radar Active";
            text = "Broadcasting distress beacon [" + beaconId + "] & scanning for nearby signals.";
        } else if (isAdvertisingActive) {
            String beaconId = (activePayload != null) ? activePayload.getId() : "ACTIVE";
            title = "Emergency SOS Beacon Active: " + beaconId;
            text = "Broadcasting offline Bluetooth distress signal (~50m range) for rescue teams.";
        } else {
            title = "Assam Rescue: Radar Scanning Active";
            text = "Continuous background BLE scan active for distress beacons in disaster zone.";
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(android.R.drawable.stat_sys_warning)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setContentIntent(contentPendingIntent);

        if (isAdvertisingActive) {
            Intent stopAdvIntent = new Intent(this, BleSosForegroundService.class);
            stopAdvIntent.setAction(ACTION_STOP_ADVERTISE);
            PendingIntent stopAdvPendingIntent = PendingIntent.getService(this, 1, stopAdvIntent, pendingFlags);
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop Beacon", stopAdvPendingIntent);
        }

        if (isScanningActive) {
            Intent stopScanIntent = new Intent(this, BleSosForegroundService.class);
            stopScanIntent.setAction(ACTION_STOP_SCAN);
            PendingIntent stopScanPendingIntent = PendingIntent.getService(this, 2, stopScanIntent, pendingFlags);
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop Radar", stopScanPendingIntent);
        }

        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Assam Rescue SOS Emergency Beacon & Radar",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Shows active offline BLE distress beacon and rescuer radar status during flood emergencies.");
            channel.enableVibration(false);
            channel.setShowBadge(true);

            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        isAdvertisingActive = false;
        isScanningActive = false;
        activePayload = null;
        if (advertiser != null) {
            advertiser.stopAdvertising();
        }
        releaseWakeLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
