package gov.in.assamrescue.app.ble;

import android.os.ParcelUuid;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Compact binary encoder & decoder for Assam Rescue BLE SOS beacon packets.
 *
 * Protocol v1 (Legacy, 17 bytes):
 * Byte 0:     Protocol Version (0x01)
 * Bytes 1..8: Emergency ID (8 bytes ASCII alphanumeric, null-padded)
 * Byte 9:     Emergency Type (1 byte enum)
 * Byte 10:    People Affected (1 byte, 1..255)
 * Bytes 11..14: Creation Timestamp (4 bytes uint32 big-endian Unix epoch seconds)
 * Byte 15:    Priority / Severity (1 byte)
 * Byte 16:    Checksum (XOR of bytes 0..15)
 *
 * Protocol v2 (Coordinate-Aware, 26 bytes):
 * Byte 0:     Protocol Version (0x02)
 * Bytes 1..8: Original SOS ID (8 bytes ASCII alphanumeric, null-padded)
 * Byte 9:     Emergency Type (1 byte enum)
 * Byte 10:    People Affected (1 byte, 1..255)
 * Bytes 11..14: Original SOS Timestamp (4 bytes uint32 big-endian Unix epoch seconds)
 * Byte 15:    Priority / Severity (1 byte)
 * Bytes 16..19: Original Latitude (4 bytes signed int32 big-endian, microdegrees = round(lat * 1e7))
 * Bytes 20..23: Original Longitude (4 bytes signed int32 big-endian, microdegrees = round(lng * 1e7))
 * Byte 24:    Hop Count (1 byte uint8, 0 = original broadcast from victim phone)
 * Byte 25:    Checksum (XOR of bytes 0..24)
 *
 * Total v2 size: 26 bytes (fits cleanly within 31-byte legacy BLE advertisement limit).
 */
public class BleSosPayload {
    public static final String SOS_SERVICE_UUID_STRING = "0000fc01-0000-1000-8000-00805f9b34fb";
    public static final ParcelUuid SOS_SERVICE_UUID = ParcelUuid.fromString(SOS_SERVICE_UUID_STRING);
    public static final UUID SOS_UUID = UUID.fromString(SOS_SERVICE_UUID_STRING);

    public static final byte PROTOCOL_VERSION_V1 = 0x01;
    public static final byte PROTOCOL_VERSION_V2 = 0x02;
    public static final byte PROTOCOL_VERSION = PROTOCOL_VERSION_V2; // Default to v2

    public static final int PAYLOAD_LENGTH_V1 = 17;
    public static final int PAYLOAD_LENGTH_V2 = 26;
    public static final int PAYLOAD_LENGTH = PAYLOAD_LENGTH_V2;

    public static final int SENTINEL_COORDINATE_UNAVAILABLE = 0x7FFFFFFF;
    public static final double COORDINATE_SCALE = 10_000_000.0;

    // Emergency Type Codes
    public static final byte TYPE_OTHER = 0x00;
    public static final byte TYPE_FLOOD = 0x01;
    public static final byte TYPE_MEDICAL = 0x02;
    public static final byte TYPE_FIRE = 0x03;
    public static final byte TYPE_TRAPPED = 0x04;
    public static final byte TYPE_SUPPLIES = 0x05;

    // Priority Codes
    public static final byte PRIORITY_LOW = 0x01;
    public static final byte PRIORITY_MEDIUM = 0x02;
    public static final byte PRIORITY_HIGH = 0x03;
    public static final byte PRIORITY_CRITICAL = 0x04;

    private final String id;
    private final String emergencyType;
    private final int peopleAffected;
    private final long timestampMs;
    private final String priority;
    private final int protocolVersion;
    private final Double origLatitude;
    private final Double origLongitude;
    private final boolean hasOriginalCoordinates;
    private final int hopCount;

    /**
     * Primary constructor for Protocol v2 (Coordinate-Aware).
     */
    public BleSosPayload(String id, String emergencyType, int peopleAffected, long timestampMs, String priority,
                         Double origLatitude, Double origLongitude) {
        this(PROTOCOL_VERSION_V2, id, emergencyType, peopleAffected, timestampMs, priority, origLatitude, origLongitude, 0);
    }

    /**
     * Legacy constructor (defaults to v2 with unavailable coordinates).
     */
    public BleSosPayload(String id, String emergencyType, int peopleAffected, long timestampMs, String priority) {
        this(PROTOCOL_VERSION_V2, id, emergencyType, peopleAffected, timestampMs, priority, null, null, 0);
    }

    /**
     * Full constructor supporting both v1 and v2 protocol specifications.
     */
    public BleSosPayload(int protocolVersion, String id, String emergencyType, int peopleAffected, long timestampMs,
                         String priority, Double origLatitude, Double origLongitude, int hopCount) {
        this.protocolVersion = protocolVersion;
        this.id = sanitizeId(id);
        this.emergencyType = emergencyType != null ? emergencyType.toLowerCase() : "flood";
        this.peopleAffected = Math.max(1, Math.min(255, peopleAffected));
        this.timestampMs = timestampMs > 0 ? timestampMs : System.currentTimeMillis();
        this.priority = priority != null ? priority.toLowerCase() : "high";
        this.hopCount = Math.max(0, Math.min(255, hopCount));

        if (origLatitude != null && origLongitude != null && isValidCoordinate(origLatitude, origLongitude)) {
            this.origLatitude = origLatitude;
            this.origLongitude = origLongitude;
            this.hasOriginalCoordinates = true;
        } else {
            this.origLatitude = null;
            this.origLongitude = null;
            this.hasOriginalCoordinates = false;
        }
    }

    /**
     * Validates whether latitude and longitude are within real geographic bounds.
     */
    public static boolean isValidCoordinate(double lat, double lng) {
        if (Double.isNaN(lat) || Double.isNaN(lng) || Double.isInfinite(lat) || Double.isInfinite(lng)) {
            return false;
        }
        return lat >= -90.0 && lat <= 90.0 && lng >= -180.0 && lng <= 180.0;
    }

    /**
     * Encodes a floating-point coordinate into a signed 32-bit microdegrees integer.
     */
    public static int encodeCoordinate(Double coord) {
        if (coord == null || Double.isNaN(coord) || Double.isInfinite(coord)) {
            return SENTINEL_COORDINATE_UNAVAILABLE;
        }
        long scaled = Math.round(coord * COORDINATE_SCALE);
        if (scaled < -2147483648L || scaled >= SENTINEL_COORDINATE_UNAVAILABLE) {
            return SENTINEL_COORDINATE_UNAVAILABLE;
        }
        return (int) scaled;
    }

    /**
     * Decodes a signed 32-bit microdegrees integer into floating-point degrees.
     */
    public static Double decodeCoordinate(int raw) {
        if (raw == SENTINEL_COORDINATE_UNAVAILABLE) {
            return null;
        }
        return ((double) raw) / COORDINATE_SCALE;
    }

    private static String sanitizeId(String rawId) {
        if (rawId == null || rawId.trim().isEmpty()) {
            return generateBeaconId();
        }
        // Normalize: uppercase, remove non-alphanumeric except hyphen
        String cleaned = rawId.replaceAll("[^A-Za-z0-9-]", "").toUpperCase();
        if (cleaned.startsWith("SOS-BLE-")) {
            cleaned = cleaned.substring("SOS-BLE-".length());
        }
        if (cleaned.length() > 8) {
            cleaned = cleaned.substring(0, 8);
        }
        if (cleaned.isEmpty()) {
            cleaned = generateBeaconId();
        }
        return cleaned;
    }

    public static String generateBeaconId() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder(8);
        java.security.SecureRandom random = new java.security.SecureRandom();
        for (int i = 0; i < 8; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    public static byte encodeEmergencyType(String type) {
        if (type == null) return TYPE_FLOOD;
        switch (type.toLowerCase()) {
            case "flood": return TYPE_FLOOD;
            case "medical": return TYPE_MEDICAL;
            case "fire": return TYPE_FIRE;
            case "trapped": return TYPE_TRAPPED;
            case "supplies": case "food": return TYPE_SUPPLIES;
            default: return TYPE_OTHER;
        }
    }

    public static String decodeEmergencyType(byte code) {
        switch (code) {
            case TYPE_FLOOD: return "flood";
            case TYPE_MEDICAL: return "medical";
            case TYPE_FIRE: return "fire";
            case TYPE_TRAPPED: return "trapped";
            case TYPE_SUPPLIES: return "supplies";
            default: return "other";
        }
    }

    public static byte encodePriority(String priority) {
        if (priority == null) return PRIORITY_HIGH;
        switch (priority.toLowerCase()) {
            case "low": return PRIORITY_LOW;
            case "medium": return PRIORITY_MEDIUM;
            case "critical": return PRIORITY_CRITICAL;
            case "high": default: return PRIORITY_HIGH;
        }
    }

    public static String decodePriority(byte code) {
        switch (code) {
            case PRIORITY_LOW: return "low";
            case PRIORITY_MEDIUM: return "medium";
            case PRIORITY_CRITICAL: return "critical";
            case PRIORITY_HIGH: default: return "high";
        }
    }

    public static byte calculateChecksum(byte[] bytes, int length) {
        byte checksum = 0;
        for (int i = 0; i < length; i++) {
            checksum ^= bytes[i];
        }
        return checksum;
    }

    /**
     * Serializes this SOS beacon into a binary array according to its protocolVersion.
     */
    public byte[] toBytes() {
        if (protocolVersion == PROTOCOL_VERSION_V1) {
            return toBytesV1();
        }
        return toBytesV2();
    }

    /**
     * Serializes legacy 17-byte v1 packet.
     */
    public byte[] toBytesV1() {
        byte[] buffer = new byte[PAYLOAD_LENGTH_V1];
        buffer[0] = PROTOCOL_VERSION_V1;

        byte[] idBytes = id.getBytes(StandardCharsets.US_ASCII);
        int copyLen = Math.min(idBytes.length, 8);
        System.arraycopy(idBytes, 0, buffer, 1, copyLen);
        for (int i = 1 + copyLen; i <= 8; i++) {
            buffer[i] = 0;
        }

        buffer[9] = encodeEmergencyType(emergencyType);
        buffer[10] = (byte) (peopleAffected & 0xFF);

        long epochSecs = timestampMs / 1000L;
        buffer[11] = (byte) ((epochSecs >> 24) & 0xFF);
        buffer[12] = (byte) ((epochSecs >> 16) & 0xFF);
        buffer[13] = (byte) ((epochSecs >> 8) & 0xFF);
        buffer[14] = (byte) (epochSecs & 0xFF);

        buffer[15] = encodePriority(priority);
        buffer[16] = calculateChecksum(buffer, 16);

        return buffer;
    }

    /**
     * Serializes coordinate-aware 26-byte v2 packet.
     */
    public byte[] toBytesV2() {
        byte[] buffer = new byte[PAYLOAD_LENGTH_V2];
        buffer[0] = PROTOCOL_VERSION_V2;

        byte[] idBytes = id.getBytes(StandardCharsets.US_ASCII);
        int copyLen = Math.min(idBytes.length, 8);
        System.arraycopy(idBytes, 0, buffer, 1, copyLen);
        for (int i = 1 + copyLen; i <= 8; i++) {
            buffer[i] = 0;
        }

        buffer[9] = encodeEmergencyType(emergencyType);
        buffer[10] = (byte) (peopleAffected & 0xFF);

        long epochSecs = timestampMs / 1000L;
        buffer[11] = (byte) ((epochSecs >> 24) & 0xFF);
        buffer[12] = (byte) ((epochSecs >> 16) & 0xFF);
        buffer[13] = (byte) ((epochSecs >> 8) & 0xFF);
        buffer[14] = (byte) (epochSecs & 0xFF);

        buffer[15] = encodePriority(priority);

        // Bytes 16..19: Latitude (signed int32 big-endian, microdegrees)
        int latInt = hasOriginalCoordinates ? encodeCoordinate(origLatitude) : SENTINEL_COORDINATE_UNAVAILABLE;
        buffer[16] = (byte) ((latInt >> 24) & 0xFF);
        buffer[17] = (byte) ((latInt >> 16) & 0xFF);
        buffer[18] = (byte) ((latInt >> 8) & 0xFF);
        buffer[19] = (byte) (latInt & 0xFF);

        // Bytes 20..23: Longitude (signed int32 big-endian, microdegrees)
        int lngInt = hasOriginalCoordinates ? encodeCoordinate(origLongitude) : SENTINEL_COORDINATE_UNAVAILABLE;
        buffer[20] = (byte) ((lngInt >> 24) & 0xFF);
        buffer[21] = (byte) ((lngInt >> 16) & 0xFF);
        buffer[22] = (byte) ((lngInt >> 8) & 0xFF);
        buffer[23] = (byte) (lngInt & 0xFF);

        // Byte 24: Hop count
        buffer[24] = (byte) (hopCount & 0xFF);

        // Byte 25: Checksum of bytes 0..24
        buffer[25] = calculateChecksum(buffer, 25);

        return buffer;
    }

    /**
     * Decodes and validates a binary payload received over BLE.
     * Supports both legacy v1 (17-byte) and v2 (26-byte) packets with strict validation.
     */
    public static BleSosPayload fromBytes(byte[] data) {
        if (data == null || data.length < PAYLOAD_LENGTH_V1) {
            return null;
        }

        byte version = data[0];

        if (version == PROTOCOL_VERSION_V1) {
            if (data.length < PAYLOAD_LENGTH_V1) {
                return null;
            }
            byte expectedChecksum = calculateChecksum(data, 16);
            if (data[16] != expectedChecksum) {
                return null;
            }

            int idEnd = 1;
            while (idEnd <= 8 && data[idEnd] != 0) {
                idEnd++;
            }
            String id = new String(data, 1, idEnd - 1, StandardCharsets.US_ASCII).trim();
            if (id.isEmpty()) {
                id = "SOS-UNKNOWN";
            }

            String type = decodeEmergencyType(data[9]);
            int people = data[10] & 0xFF;
            if (people <= 0) people = 1;

            long epochSecs = (((long) (data[11] & 0xFF)) << 24)
                    | (((long) (data[12] & 0xFF)) << 16)
                    | (((long) (data[13] & 0xFF)) << 8)
                    | (((long) (data[14] & 0xFF)));
            long timestampMs = epochSecs * 1000L;

            String priority = decodePriority(data[15]);

            // v1 has no original coordinates and hopCount = 0
            return new BleSosPayload(PROTOCOL_VERSION_V1, id, type, people, timestampMs, priority, null, null, 0);

        } else if (version == PROTOCOL_VERSION_V2) {
            if (data.length < PAYLOAD_LENGTH_V2) {
                return null;
            }
            byte expectedChecksum = calculateChecksum(data, 25);
            if (data[25] != expectedChecksum) {
                return null;
            }

            int idEnd = 1;
            while (idEnd <= 8 && data[idEnd] != 0) {
                idEnd++;
            }
            String id = new String(data, 1, idEnd - 1, StandardCharsets.US_ASCII).trim();
            if (id.isEmpty()) {
                id = "SOS-UNKNOWN";
            }

            String type = decodeEmergencyType(data[9]);
            int people = data[10] & 0xFF;
            if (people <= 0) people = 1;

            long epochSecs = (((long) (data[11] & 0xFF)) << 24)
                    | (((long) (data[12] & 0xFF)) << 16)
                    | (((long) (data[13] & 0xFF)) << 8)
                    | (((long) (data[14] & 0xFF)));
            long timestampMs = epochSecs * 1000L;

            String priority = decodePriority(data[15]);

            // Signed 32-bit big-endian microdegrees
            int latRaw = (((int) data[16]) << 24)
                    | (((int) data[17] & 0xFF) << 16)
                    | (((int) data[18] & 0xFF) << 8)
                    | (((int) data[19] & 0xFF));

            int lngRaw = (((int) data[20]) << 24)
                    | (((int) data[21] & 0xFF) << 16)
                    | (((int) data[22] & 0xFF) << 8)
                    | (((int) data[23] & 0xFF));

            Double lat = decodeCoordinate(latRaw);
            Double lng = decodeCoordinate(lngRaw);

            // Strict geographic validation
            if (lat != null && lng != null) {
                if (!isValidCoordinate(lat, lng)) {
                    lat = null;
                    lng = null;
                }
            } else {
                lat = null;
                lng = null;
            }

            int hopCount = data[24] & 0xFF;

            return new BleSosPayload(PROTOCOL_VERSION_V2, id, type, people, timestampMs, priority, lat, lng, hopCount);
        }

        // Unsupported protocol version
        return null;
    }

    public String getId() { return id; }
    public String getEmergencyType() { return emergencyType; }
    public int getPeopleAffected() { return peopleAffected; }
    public long getTimestampMs() { return timestampMs; }
    public String getPriority() { return priority; }
    public int getProtocolVersion() { return protocolVersion; }
    public Double getOrigLatitude() { return origLatitude; }
    public Double getOrigLongitude() { return origLongitude; }
    public boolean hasOriginalCoordinates() { return hasOriginalCoordinates; }
    public int getHopCount() { return hopCount; }
}
