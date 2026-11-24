package gov.in.assamrescue.app.ble;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.List;

/**
 * Capacitor 8 Native Android Plugin for Assam Rescue BLE SOS.
 * Connects the React UI to genuine Android Bluetooth Low Energy APIs.
 */
@CapacitorPlugin(
        name = "BleSos",
        permissions = {
                @Permission(
                        strings = {
                                Manifest.permission.BLUETOOTH_SCAN,
                                Manifest.permission.BLUETOOTH_ADVERTISE,
                                Manifest.permission.BLUETOOTH_CONNECT,
                                Manifest.permission.POST_NOTIFICATIONS
                        },
                        alias = "bluetoothModern"
                ),
                @Permission(
                        strings = {
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                        },
                        alias = "locationLegacy"
                )
        }
)
public class BleSosPlugin extends Plugin {
    private static final String TAG = "BleSosPlugin";

    private BleSosAdvertiser advertiser;
    private BleSosScanner scanner;
    private BluetoothAdapter bluetoothAdapter;

    @Override
    public void load() {
        super.load();
        Context ctx = getContext();
        BluetoothManager bm = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        bluetoothAdapter = (bm != null) ? bm.getAdapter() : null;

        advertiser = new BleSosAdvertiser(ctx);
        advertiser.setListener(new BleSosAdvertiser.AdvertiseStatusListener() {
            @Override
            public void onAdvertisingStarted() {
                JSObject ret = new JSObject();
                ret.put("isAdvertising", true);
                notifyListeners("onAdvertisingStatusChanged", ret);
            }

            @Override
            public void onAdvertisingStopped() {
                JSObject ret = new JSObject();
                ret.put("isAdvertising", false);
                notifyListeners("onAdvertisingStatusChanged", ret);
            }

            @Override
            public void onAdvertisingFailed(int errorCode, String errorMessage) {
                JSObject ret = new JSObject();
                ret.put("isAdvertising", false);
                ret.put("errorCode", errorCode);
                ret.put("error", errorMessage);
                notifyListeners("onAdvertisingStatusChanged", ret);
            }
        });

        scanner = new BleSosScanner(ctx);
        scanner.setListener(new BleSosScanner.ScanStatusListener() {
            @Override
            public void onScanStarted() {
                JSObject ret = new JSObject();
                ret.put("isScanning", true);
                notifyListeners("onScanStatusChanged", ret);
            }

            @Override
            public void onScanStopped() {
                JSObject ret = new JSObject();
                ret.put("isScanning", false);
                notifyListeners("onScanStatusChanged", ret);
            }

            @Override
            public void onBeaconDetected(BleSosScanner.DetectedBeacon beacon) {
                JSObject ret = beaconToJson(beacon);
                notifyListeners("onBeaconDetected", ret);
            }

            @Override
            public void onScanFailed(int errorCode, String errorMessage) {
                JSObject ret = new JSObject();
                ret.put("isScanning", false);
                ret.put("errorCode", errorCode);
                ret.put("error", errorMessage);
                notifyListeners("onScanStatusChanged", ret);
            }
        });
    }

    private boolean checkPermissionsGranted() {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) { // API 31+
            return ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
                   ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED &&
                   ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        } else {
            return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        }
    }

    @PluginMethod
    public void getBleStatus(PluginCall call) {
        JSObject ret = new JSObject();
        boolean hasHardware = bluetoothAdapter != null;
        boolean isEnabled = hasHardware && bluetoothAdapter.isEnabled();
        boolean advSupported = advertiser != null && advertiser.isAdvertisingSupported();
        boolean perms = checkPermissionsGranted();

        ret.put("isAvailable", hasHardware);
        ret.put("isEnabled", isEnabled);
        ret.put("isAdvertisingSupported", advSupported);
        ret.put("isScanningSupported", hasHardware);
        ret.put("permissionsGranted", perms);
        ret.put("isAdvertising", advertiser != null && advertiser.isAdvertising());
        ret.put("isScanning", scanner != null && scanner.isScanning());

        if (advertiser != null && advertiser.getActivePayload() != null) {
            BleSosPayload p = advertiser.getActivePayload();
            JSObject active = new JSObject();
            active.put("id", p.getId());
            active.put("emergencyType", p.getEmergencyType());
            active.put("peopleAffected", p.getPeopleAffected());
            active.put("timestamp", p.getTimestampMs());
            active.put("priority", p.getPriority());
            ret.put("activeBroadcast", active);
        } else {
            ret.put("activeBroadcast", null);
        }

        ret.put("detectedCount", scanner != null ? scanner.getActiveBeacons().size() : 0);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestBlePermissions(PluginCall call) {
        if (checkPermissionsGranted()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            ret.put("message", "Bluetooth permissions already granted.");
            call.resolve(ret);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissionForAlias("bluetoothModern", call, "permissionCallback");
        } else {
            requestPermissionForAlias("locationLegacy", call, "permissionCallback");
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        boolean granted = checkPermissionsGranted();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        if (granted) {
            ret.put("message", "Bluetooth permissions granted successfully.");
        } else {
            ret.put("message", "Bluetooth permissions were denied by the user. SOS scanning or broadcasting requires Bluetooth authorization.");
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void startAdvertising(PluginCall call) {
        if (bluetoothAdapter == null) {
            call.reject("Bluetooth hardware is not available on this device.");
            return;
        }

        if (!bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth is currently disabled. Please enable Bluetooth.");
            return;
        }

        if (!checkPermissionsGranted()) {
            call.reject("Bluetooth permissions not granted. Call requestBlePermissions first.");
            return;
        }

        if (!advertiser.isAdvertisingSupported()) {
            call.reject("BLE peripheral advertising is not supported on this device.");
            return;
        }

        String id = call.getString("id");
        if (id == null || id.trim().isEmpty()) {
            id = "SOS-" + Long.toHexString(System.currentTimeMillis()).toUpperCase();
        }

        String emergencyType = call.getString("emergencyType", "flood");
        int peopleAffected = call.getInt("peopleAffected", 1);
        long timestamp = call.getLong("timestamp", System.currentTimeMillis());
        String priority = call.getString("priority", "high");
        Double latitude = call.getDouble("latitude");
        Double longitude = call.getDouble("longitude");
        int hopCount = call.getInt("hopCount", 0);

        BleSosPayload payload = new BleSosPayload(BleSosPayload.PROTOCOL_VERSION_V2, id, emergencyType, peopleAffected, timestamp, priority, latitude, longitude, hopCount);

        // Start Foreground Service for continuous background operation
        Context ctx = getContext();
        Intent serviceIntent = new Intent(ctx, BleSosForegroundService.class);
        serviceIntent.setAction(BleSosForegroundService.ACTION_START_ADVERTISE);
        serviceIntent.putExtra(BleSosForegroundService.EXTRA_ID, payload.getId());
        serviceIntent.putExtra(BleSosForegroundService.EXTRA_TYPE, payload.getEmergencyType());
        serviceIntent.putExtra(BleSosForegroundService.EXTRA_PEOPLE, payload.getPeopleAffected());
        serviceIntent.putExtra(BleSosForegroundService.EXTRA_TIMESTAMP, payload.getTimestampMs());
        serviceIntent.putExtra(BleSosForegroundService.EXTRA_PRIORITY, payload.getPriority());
        serviceIntent.putExtra(BleSosForegroundService.EXTRA_LATITUDE, payload.hasOriginalCoordinates() ? payload.getOrigLatitude() : Double.NaN);
        serviceIntent.putExtra(BleSosForegroundService.EXTRA_LONGITUDE, payload.hasOriginalCoordinates() ? payload.getOrigLongitude() : Double.NaN);
        serviceIntent.putExtra(BleSosForegroundService.EXTRA_HOP, payload.getHopCount());

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(serviceIntent);
            } else {
                ctx.startService(serviceIntent);
            }
        } catch (Exception ex) {
            Log.w(TAG, "Could not start foreground service: " + ex.getMessage() + "; falling back to direct advertiser.");
            advertiser.startAdvertising(payload);
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("id", payload.getId());
        ret.put("isAdvertising", true);
        ret.put("message", "BLE SOS beacon broadcasting active.");
        call.resolve(ret);
    }

    @PluginMethod
    public void stopAdvertising(PluginCall call) {
        if (advertiser != null) {
            advertiser.stopAdvertising();
        }

        Context ctx = getContext();
        Intent serviceIntent = new Intent(ctx, BleSosForegroundService.class);
        serviceIntent.setAction(BleSosForegroundService.ACTION_STOP_ADVERTISE);
        try {
            ctx.startService(serviceIntent);
        } catch (Exception e) {
            Log.w(TAG, "Error stopping foreground service: " + e.getMessage());
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("isAdvertising", false);
        ret.put("message", "BLE SOS beacon stopped.");
        call.resolve(ret);
    }

    @PluginMethod
    public void startScanning(PluginCall call) {
        if (bluetoothAdapter == null) {
            call.reject("Bluetooth hardware is not available on this device.");
            return;
        }

        if (!bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth is currently disabled. Please enable Bluetooth.");
            return;
        }

        if (!checkPermissionsGranted()) {
            call.reject("Bluetooth permissions not granted. Call requestBlePermissions first.");
            return;
        }

        scanner.startScanning();

        // Elevate rescuer process to foreground service with connectedDevice type
        // so continuous scanning continues when phone is locked or app is backgrounded
        Context ctx = getContext();
        Intent serviceIntent = new Intent(ctx, BleSosForegroundService.class);
        serviceIntent.setAction(BleSosForegroundService.ACTION_START_SCAN);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(serviceIntent);
            } else {
                ctx.startService(serviceIntent);
            }
        } catch (Exception ex) {
            Log.w(TAG, "Could not start foreground service for scanning: " + ex.getMessage());
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("isScanning", true);
        ret.put("message", "BLE SOS radar scanning active.");
        call.resolve(ret);
    }

    @PluginMethod
    public void stopScanning(PluginCall call) {
        if (scanner != null) {
            scanner.stopScanning();
        }

        Context ctx = getContext();
        Intent serviceIntent = new Intent(ctx, BleSosForegroundService.class);
        serviceIntent.setAction(BleSosForegroundService.ACTION_STOP_SCAN);
        try {
            ctx.startService(serviceIntent);
        } catch (Exception e) {
            Log.w(TAG, "Error stopping foreground scanning: " + e.getMessage());
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("isScanning", false);
        ret.put("message", "BLE SOS scanning stopped.");
        call.resolve(ret);
    }

    @PluginMethod
    public void triggerEmergencyAlert(PluginCall call) {
        String id = call.getString("id", "SOS-TEST");
        String emergencyType = call.getString("emergencyType", "flood");
        int peopleAffected = call.getInt("peopleAffected", 1);
        int rssi = call.getInt("rssi", -65);
        long timestamp = call.getLong("timestamp", System.currentTimeMillis());
        String priority = call.getString("priority", "high");

        BleSosPayload payload = new BleSosPayload(id, emergencyType, peopleAffected, timestamp, priority);
        BleSosScanner.DetectedBeacon beacon = new BleSosScanner.DetectedBeacon(payload, rssi, "manual");

        boolean alerted = BleSosAlertManager.getInstance(getContext()).triggerEmergencyAlert(beacon);

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("alerted", alerted);
        call.resolve(ret);
    }

    @PluginMethod
    public void getDetectedBeacons(PluginCall call) {
        JSArray arr = new JSArray();
        if (scanner != null) {
            List<BleSosScanner.DetectedBeacon> list = scanner.getActiveBeacons();
            for (BleSosScanner.DetectedBeacon b : list) {
                arr.put(beaconToJson(b));
            }
        }
        JSObject ret = new JSObject();
        ret.put("beacons", arr);
        ret.put("count", arr.length());
        call.resolve(ret);
    }

    @PluginMethod
    public void clearDetectedBeacons(PluginCall call) {
        if (scanner != null) {
            scanner.clearDetectedBeacons();
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    private JSObject beaconToJson(BleSosScanner.DetectedBeacon b) {
        JSObject o = new JSObject();
        o.put("id", b.id);
        o.put("emergencyType", b.emergencyType);
        o.put("peopleAffected", b.peopleAffected);
        o.put("emergencyTimestamp", b.emergencyTimestamp);
        o.put("priority", b.priority);
        o.put("rssi", b.rssi);
        o.put("lastSeenMs", b.lastSeenMs);
        o.put("approxDistanceMeters", b.approxDistanceMeters);
        o.put("proximityCategory", b.proximityCategory);
        o.put("deviceAddress", b.deviceAddress);
        o.put("isStale", b.isStale());
        o.put("protocolVersion", b.protocolVersion);
        o.put("hopCount", b.hopCount);
        o.put("hasOriginalCoordinates", b.hasOriginalCoordinates);
        if (b.hasOriginalCoordinates && b.origLatitude != null && b.origLongitude != null) {
            o.put("origLatitude", b.origLatitude);
            o.put("origLongitude", b.origLongitude);
            o.put("latitude", b.origLatitude);
            o.put("longitude", b.origLongitude);
        } else {
            o.put("origLatitude", null);
            o.put("origLongitude", null);
        }
        return o;
    }
}
