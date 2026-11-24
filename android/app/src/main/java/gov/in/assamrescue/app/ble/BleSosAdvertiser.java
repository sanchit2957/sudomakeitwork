package gov.in.assamrescue.app.ble;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.Context;
import android.util.Log;

/**
 * Native Android BLE SOS Advertiser.
 * Uses BluetoothLeAdvertiser to broadcast compact emergency SOS packets.
 */
public class BleSosAdvertiser {
    private static final String TAG = "BleSosAdvertiser";

    public interface AdvertiseStatusListener {
        void onAdvertisingStarted();
        void onAdvertisingStopped();
        void onAdvertisingFailed(int errorCode, String errorMessage);
    }

    private final Context context;
    private final BluetoothAdapter bluetoothAdapter;
    private BluetoothLeAdvertiser advertiser;
    private AdvertiseCallback activeCallback;
    private boolean isAdvertising = false;
    private BleSosPayload activePayload;
    private AdvertiseStatusListener listener;

    public BleSosAdvertiser(Context context) {
        this.context = context.getApplicationContext();
        BluetoothManager bluetoothManager = (BluetoothManager) this.context.getSystemService(Context.BLUETOOTH_SERVICE);
        this.bluetoothAdapter = (bluetoothManager != null) ? bluetoothManager.getAdapter() : null;
    }

    public void setListener(AdvertiseStatusListener listener) {
        this.listener = listener;
    }

    /**
     * Checks if BLE advertising is supported on this hardware.
     */
    public boolean isAdvertisingSupported() {
        if (bluetoothAdapter == null) return false;
        if (!bluetoothAdapter.isEnabled()) return false;
        return bluetoothAdapter.isMultipleAdvertisementSupported() || bluetoothAdapter.getBluetoothLeAdvertiser() != null;
    }

    public boolean isAdvertising() {
        return isAdvertising;
    }

    public BleSosPayload getActivePayload() {
        return activePayload;
    }

    /**
     * Starts BLE advertising with the provided SOS payload.
     */
    public synchronized void startAdvertising(BleSosPayload payload) {
        if (bluetoothAdapter == null) {
            notifyFailed(-1, "Bluetooth hardware is not available on this device.");
            return;
        }

        if (!bluetoothAdapter.isEnabled()) {
            notifyFailed(-2, "Bluetooth is disabled. Please enable Bluetooth to broadcast SOS beacon.");
            return;
        }

        advertiser = bluetoothAdapter.getBluetoothLeAdvertiser();
        if (advertiser == null) {
            notifyFailed(-3, "BLE peripheral advertising is not supported by this device hardware.");
            return;
        }

        // Stop existing advertisement if already running
        if (isAdvertising) {
            stopAdvertising();
        }

        this.activePayload = payload;
        byte[] payloadBytes = payload.toBytes();

        AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(false)
                .setTimeout(0) // Continuous broadcast
                .build();

        AdvertiseData.Builder dataBuilder = new AdvertiseData.Builder()
                .addServiceData(BleSosPayload.SOS_SERVICE_UUID, payloadBytes)
                .setIncludeDeviceName(false)
                .setIncludeTxPowerLevel(false);

        // Include standalone 16-bit Service UUID structure only for legacy v1 (17-byte) packets
        // For v2 (26-byte) packets, the 16-bit Service Data structure itself takes 30 bytes (1B len + 1B type + 2B UUID + 26B data),
        // which leaves exactly 1 byte remaining in the 31-byte legacy BLE advertisement limit.
        if (payloadBytes.length <= BleSosPayload.PAYLOAD_LENGTH_V1) {
            dataBuilder.addServiceUuid(BleSosPayload.SOS_SERVICE_UUID);
        }

        AdvertiseData data = dataBuilder.build();

        activeCallback = new AdvertiseCallback() {
            @Override
            public void onStartSuccess(AdvertiseSettings settingsInEffect) {
                super.onStartSuccess(settingsInEffect);
                isAdvertising = true;
                Log.i(TAG, "BLE SOS advertising started successfully for: " + payload.getId());
                if (listener != null) {
                    listener.onAdvertisingStarted();
                }
            }

            @Override
            public void onStartFailure(int errorCode) {
                super.onStartFailure(errorCode);
                isAdvertising = false;
                activePayload = null;
                String errorMsg = getErrorMessage(errorCode);
                Log.e(TAG, "BLE SOS advertising failed: code " + errorCode + " - " + errorMsg);
                notifyFailed(errorCode, errorMsg);
            }
        };

        try {
            advertiser.startAdvertising(settings, data, activeCallback);
        } catch (SecurityException se) {
            isAdvertising = false;
            activePayload = null;
            notifyFailed(-4, "Bluetooth advertising permission denied by Android security policy: " + se.getMessage());
        } catch (Exception ex) {
            isAdvertising = false;
            activePayload = null;
            notifyFailed(-5, "Failed to initiate BLE advertising: " + ex.getMessage());
        }
    }

    /**
     * Stops BLE advertising.
     */
    public synchronized void stopAdvertising() {
        if (advertiser != null && activeCallback != null && isAdvertising) {
            try {
                advertiser.stopAdvertising(activeCallback);
                Log.i(TAG, "BLE SOS advertising stopped.");
            } catch (SecurityException se) {
                Log.w(TAG, "SecurityException while stopping advertising: " + se.getMessage());
            } catch (Exception e) {
                Log.w(TAG, "Exception while stopping advertising: " + e.getMessage());
            }
        }
        isAdvertising = false;
        activePayload = null;
        activeCallback = null;
        if (listener != null) {
            listener.onAdvertisingStopped();
        }
    }

    private void notifyFailed(int code, String message) {
        if (listener != null) {
            listener.onAdvertisingFailed(code, message);
        }
    }

    private static String getErrorMessage(int errorCode) {
        switch (errorCode) {
            case AdvertiseCallback.ADVERTISE_FAILED_DATA_TOO_LARGE:
                return "Advertisement data exceeds 31-byte limit.";
            case AdvertiseCallback.ADVERTISE_FAILED_TOO_MANY_ADVERTISERS:
                return "Hardware advertising resources exhausted by other applications.";
            case AdvertiseCallback.ADVERTISE_FAILED_ALREADY_STARTED:
                return "Advertisement already running.";
            case AdvertiseCallback.ADVERTISE_FAILED_INTERNAL_ERROR:
                return "Android Bluetooth subsystem internal error.";
            case AdvertiseCallback.ADVERTISE_FAILED_FEATURE_UNSUPPORTED:
                return "Device hardware does not support BLE advertising.";
            default:
                return "Unknown advertising error (" + errorCode + ").";
        }
    }
}
