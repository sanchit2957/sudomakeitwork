package gov.in.assamrescue.app.ble;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Native Android BLE SOS Scanner for Rescuers.
 * Filters for the Assam Rescue SOS Service UUID (0xFC01), decodes compact packets,
 * captures genuine RSSI values in dBm, and tracks beacon freshness.
 */
public class BleSosScanner {
    private static final String TAG = "BleSosScanner";
    public static final long STALE_TIMEOUT_MS = 25_000L; // 25 seconds of silence = stale

    public static class DetectedBeacon {
        public final String id;
        public final String emergencyType;
        public final int peopleAffected;
        public final long emergencyTimestamp;
        public final String priority;
        public final int protocolVersion;
        public final Double origLatitude;
        public final Double origLongitude;
        public final boolean hasOriginalCoordinates;
        public final int hopCount;
        public int rssi;
        public long lastSeenMs;
        public double approxDistanceMeters;
        public String proximityCategory;
        public String deviceAddress;

        public DetectedBeacon(BleSosPayload payload, int rssi, String deviceAddress) {
            this.id = payload.getId();
            this.emergencyType = payload.getEmergencyType();
            this.peopleAffected = payload.getPeopleAffected();
            this.emergencyTimestamp = payload.getTimestampMs();
            this.priority = payload.getPriority();
            this.protocolVersion = payload.getProtocolVersion();
            this.origLatitude = payload.getOrigLatitude();
            this.origLongitude = payload.getOrigLongitude();
            this.hasOriginalCoordinates = payload.hasOriginalCoordinates();
            this.hopCount = payload.getHopCount();
            this.rssi = rssi;
            this.deviceAddress = deviceAddress != null ? deviceAddress : "unknown";
            this.lastSeenMs = System.currentTimeMillis();
            updateProximity(rssi);
        }

        public void updateRssi(int newRssi) {
            this.rssi = newRssi;
            this.lastSeenMs = System.currentTimeMillis();
            updateProximity(newRssi);
        }

        private void updateProximity(int rssi) {
            // Log-distance path loss formula: d = 10 ^ ((txPower - rssi) / (10 * n))
            // txPower = -59 dBm (nominal at 1m), n = 2.5 (real-world flood / outdoor environment)
            double txPower = -59.0;
            double n = 2.5;
            double exponent = (txPower - (double) rssi) / (10.0 * n);
            double estimated = Math.pow(10.0, exponent);
            this.approxDistanceMeters = Math.max(1.0, Math.round(estimated * 10.0) / 10.0);

            if (rssi >= -60) {
                this.proximityCategory = "immediate"; // < 3m
            } else if (rssi >= -75) {
                this.proximityCategory = "near"; // 3m - 10m
            } else if (rssi >= -85) {
                this.proximityCategory = "moderate"; // 10m - 25m
            } else {
                this.proximityCategory = "far"; // > 25m
            }
        }

        public boolean isStale() {
            return (System.currentTimeMillis() - lastSeenMs) > STALE_TIMEOUT_MS;
        }
    }

    public interface ScanStatusListener {
        void onScanStarted();
        void onScanStopped();
        void onBeaconDetected(DetectedBeacon beacon);
        void onScanFailed(int errorCode, String errorMessage);
    }

    private final Context context;
    private final BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner scanner;
    private ScanCallback activeCallback;
    private boolean isScanning = false;
    private ScanStatusListener listener;
    private final Map<String, DetectedBeacon> detectedBeacons = new ConcurrentHashMap<>();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable stalePruneRunnable;

    public BleSosScanner(Context context) {
        this.context = context.getApplicationContext();
        BluetoothManager bluetoothManager = (BluetoothManager) this.context.getSystemService(Context.BLUETOOTH_SERVICE);
        this.bluetoothAdapter = (bluetoothManager != null) ? bluetoothManager.getAdapter() : null;
    }

    public void setListener(ScanStatusListener listener) {
        this.listener = listener;
    }

    public boolean isScanning() {
        return isScanning;
    }

    public List<DetectedBeacon> getActiveBeacons() {
        pruneStaleBeacons();
        return new ArrayList<>(detectedBeacons.values());
    }

    /**
     * Starts low-latency BLE scanning for SOS distress beacons.
     */
    public synchronized void startScanning() {
        if (bluetoothAdapter == null) {
            notifyFailed(-1, "Bluetooth hardware is not available on this device.");
            return;
        }

        if (!bluetoothAdapter.isEnabled()) {
            notifyFailed(-2, "Bluetooth is disabled. Please enable Bluetooth to scan for SOS beacons.");
            return;
        }

        scanner = bluetoothAdapter.getBluetoothLeScanner();
        if (scanner == null) {
            notifyFailed(-3, "BLE scanner subsystem unavailable.");
            return;
        }

        if (isScanning) {
            stopScanning();
        }

        // Filter by Assam Rescue SOS Service UUID and Service Data
        ScanFilter filterByUuid = new ScanFilter.Builder()
                .setServiceUuid(BleSosPayload.SOS_SERVICE_UUID)
                .build();
        ScanFilter filterByServiceData = new ScanFilter.Builder()
                .setServiceData(BleSosPayload.SOS_SERVICE_UUID, new byte[0], new byte[0])
                .build();
        List<ScanFilter> filters = Arrays.asList(filterByUuid, filterByServiceData);

        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
                .setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
                .setNumOfMatches(ScanSettings.MATCH_NUM_MAX_ADVERTISEMENT)
                .build();

        activeCallback = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                super.onScanResult(callbackType, result);
                processScanResult(result);
            }

            @Override
            public void onBatchScanResults(List<ScanResult> results) {
                super.onBatchScanResults(results);
                for (ScanResult res : results) {
                    processScanResult(res);
                }
            }

            @Override
            public void onScanFailed(int errorCode) {
                super.onScanFailed(errorCode);
                isScanning = false;
                String errorMsg = getErrorMessage(errorCode);
                Log.e(TAG, "BLE scan failed: code " + errorCode + " - " + errorMsg);
                notifyFailed(errorCode, errorMsg);
            }
        };

        try {
            scanner.startScan(filters, settings, activeCallback);
            isScanning = true;
            Log.i(TAG, "BLE SOS scanning started.");
            if (listener != null) {
                listener.onScanStarted();
            }
            startPeriodicStalePruner();
        } catch (SecurityException se) {
            isScanning = false;
            notifyFailed(-4, "Bluetooth scan permission denied by Android security policy: " + se.getMessage());
        } catch (Exception ex) {
            isScanning = false;
            notifyFailed(-5, "Failed to start BLE scanner: " + ex.getMessage());
        }
    }

    /**
     * Stops BLE scanning and halts the stale prune timer.
     */
    public synchronized void stopScanning() {
        stopPeriodicStalePruner();
        if (scanner != null && activeCallback != null && isScanning) {
            try {
                scanner.stopScan(activeCallback);
                Log.i(TAG, "BLE SOS scanning stopped.");
            } catch (SecurityException se) {
                Log.w(TAG, "SecurityException while stopping scanner: " + se.getMessage());
            } catch (Exception e) {
                Log.w(TAG, "Exception while stopping scanner: " + e.getMessage());
            }
        }
        isScanning = false;
        activeCallback = null;
        if (listener != null) {
            listener.onScanStopped();
        }
    }

    public synchronized void clearDetectedBeacons() {
        detectedBeacons.clear();
    }

    private void processScanResult(ScanResult result) {
        if (result == null) return;
        ScanRecord record = result.getScanRecord();
        if (record == null) return;

        // Retrieve service data for SOS_SERVICE_UUID
        byte[] serviceData = record.getServiceData(BleSosPayload.SOS_SERVICE_UUID);
        if (serviceData == null || serviceData.length < BleSosPayload.PAYLOAD_LENGTH) {
            return;
        }

        BleSosPayload payload = BleSosPayload.fromBytes(serviceData);
        if (payload == null) {
            // Malformed packet, checksum mismatch, or unsupported protocol version
            return;
        }

        String deviceAddress = (result.getDevice() != null) ? result.getDevice().getAddress() : "unknown";
        int rssi = result.getRssi();

        DetectedBeacon beacon = detectedBeacons.get(payload.getId());
        if (beacon == null) {
            beacon = new DetectedBeacon(payload, rssi, deviceAddress);
            detectedBeacons.put(payload.getId(), beacon);
            Log.i(TAG, "New BLE SOS beacon detected: " + payload.getId() + " RSSI=" + rssi + "dBm");
        } else {
            beacon.updateRssi(rssi);
        }

        // Trigger native audible alert, vibration, and system notification (with 60s cooldown per unique beacon)
        BleSosAlertManager.getInstance(context).triggerEmergencyAlert(beacon);

        final DetectedBeacon finalBeacon = beacon;
        mainHandler.post(() -> {
            if (listener != null) {
                listener.onBeaconDetected(finalBeacon);
            }
        });
    }

    public synchronized void pruneStaleBeacons() {
        List<String> toRemove = new ArrayList<>();
        for (Map.Entry<String, DetectedBeacon> entry : detectedBeacons.entrySet()) {
            if (entry.getValue().isStale()) {
                toRemove.add(entry.getKey());
            }
        }
        for (String id : toRemove) {
            detectedBeacons.remove(id);
            Log.d(TAG, "Pruned stale BLE beacon: " + id);
        }
    }

    private void startPeriodicStalePruner() {
        stopPeriodicStalePruner();
        stalePruneRunnable = new Runnable() {
            @Override
            public void run() {
                pruneStaleBeacons();
                if (isScanning) {
                    mainHandler.postDelayed(this, 10_000L); // Check every 10 seconds
                }
            }
        };
        mainHandler.postDelayed(stalePruneRunnable, 10_000L);
    }

    private void stopPeriodicStalePruner() {
        if (stalePruneRunnable != null) {
            mainHandler.removeCallbacks(stalePruneRunnable);
            stalePruneRunnable = null;
        }
    }

    private void notifyFailed(int code, String message) {
        mainHandler.post(() -> {
            if (listener != null) {
                listener.onScanFailed(code, message);
            }
        });
    }

    private static String getErrorMessage(int errorCode) {
        switch (errorCode) {
            case ScanCallback.SCAN_FAILED_ALREADY_STARTED:
                return "Scan already started.";
            case ScanCallback.SCAN_FAILED_APPLICATION_REGISTRATION_FAILED:
                return "Application registration failed in Bluetooth stack.";
            case ScanCallback.SCAN_FAILED_INTERNAL_ERROR:
                return "Android Bluetooth subsystem internal error.";
            case ScanCallback.SCAN_FAILED_FEATURE_UNSUPPORTED:
                return "Power-optimized BLE scan unsupported.";
            default:
                return "Unknown scan error (" + errorCode + ").";
        }
    }
}
