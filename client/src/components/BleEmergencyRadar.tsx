import React, { useEffect, useState, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  BleBeaconPayload,
  BleStatus,
  getBleStatus,
  requestBlePermissions,
  startBleRadar,
  stopBleRadar,
  scanForNearbyBleBeacons,
} from "@/lib/bleBeacon";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  AlertTriangle,
  Bluetooth,
  CheckCircle,
  Compass,
  Navigation,
  Radio,
  RefreshCw,
  ShieldAlert,
  Signal,
  Users,
  Waves,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  recordOfflineBleAcceptance,
  listAllOfflineBleAcceptances,
  type OfflineBleAcceptanceRecord,
} from "@/lib/offlineBleAcceptanceDb";

export function BleEmergencyRadar({
  rescuerLatitude,
  rescuerLongitude,
  rescuerUserId,
  onTargetSelect,
  onAcceptBeacon,
}: {
  rescuerLatitude?: number;
  rescuerLongitude?: number;
  rescuerUserId?: number;
  onTargetSelect?: (beacon: BleBeaconPayload) => void;
  onAcceptBeacon?: (beacon: BleBeaconPayload) => void;
}) {
  const { t } = useLanguage();
  const [scanning, setScanning] = useState(false);
  const [beacons, setBeacons] = useState<BleBeaconPayload[]>([]);
  const [bleStatus, setBleStatus] = useState<BleStatus | null>(null);
  const [lastScannedAt, setLastScannedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRequestingPerms, setIsRequestingPerms] = useState(false);
  const [acceptances, setAcceptances] = useState<Map<string, OfflineBleAcceptanceRecord>>(new Map());
  const isMountedRef = useRef(true);

  // Load existing offline acceptances
  useEffect(() => {
    void listAllOfflineBleAcceptances().then((records) => {
      if (isMountedRef.current) {
        const map = new Map<string, OfflineBleAcceptanceRecord>();
        records.forEach((r) => map.set(r.bleBeaconId, r));
        setAcceptances(map);
      }
    });

    const handler = (event: any) => {
      void listAllOfflineBleAcceptances().then((records) => {
        if (isMountedRef.current) {
          const map = new Map<string, OfflineBleAcceptanceRecord>();
          records.forEach((r) => map.set(r.bleBeaconId, r));
          setAcceptances(map);
        }
      });
    };

    if (typeof window !== "undefined") {
      window.addEventListener("sudo-ble-acceptance-changed", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("sudo-ble-acceptance-changed", handler);
      }
    };
  }, []);

  const handleAccept = async (beacon: BleBeaconPayload) => {
    if (!rescuerUserId) {
      if (onAcceptBeacon) onAcceptBeacon(beacon);
      return;
    }

    try {
      await recordOfflineBleAcceptance({
        bleBeaconId: beacon.id,
        rescuerId: rescuerUserId,
        rescuerLatitude,
        rescuerLongitude,
      });
      if (onAcceptBeacon) {
        onAcceptBeacon(beacon);
      }
    } catch (e: any) {
      console.error("[BleEmergencyRadar] Failed to record acceptance:", e);
    }
  };

  const checkStatus = useCallback(async () => {
    try {
      const status = await getBleStatus();
      if (isMountedRef.current) {
        setBleStatus(status);
        if (!status.isAvailable && Capacitor.isNativePlatform()) {
          setErrorMessage(t("Bluetooth hardware is not available on this device."));
        } else if (!status.isEnabled && Capacitor.isNativePlatform()) {
          setErrorMessage(t("Bluetooth is turned off. Please enable Bluetooth in Android settings."));
        } else if (!status.permissionsGranted && Capacitor.isNativePlatform()) {
          setErrorMessage(t("Bluetooth scanning permissions are required to detect nearby SOS signals."));
        } else {
          setErrorMessage(null);
        }
      }
      return status;
    } catch {
      return null;
    }
  }, [t]);

  const handleGrantPermissions = async () => {
    setIsRequestingPerms(true);
    try {
      const res = await requestBlePermissions();
      if (!res.granted) {
        setErrorMessage(res.message || t("Bluetooth permissions denied."));
      } else {
        setErrorMessage(null);
        await checkStatus();
        await runScan();
      }
    } finally {
      setIsRequestingPerms(false);
    }
  };

  const runScan = useCallback(async () => {
    setScanning(true);
    setErrorMessage(null);

    const status = await checkStatus();
    if (Capacitor.isNativePlatform()) {
      if (status && !status.isEnabled) {
        setScanning(false);
        setErrorMessage(t("Bluetooth is disabled. Please turn on Bluetooth."));
        return;
      }
      if (status && !status.permissionsGranted) {
        setScanning(false);
        setErrorMessage(t("Bluetooth permissions required to scan."));
        return;
      }
    }

    try {
      if (Capacitor.isNativePlatform()) {
        const started = await startBleRadar(
          (updatedList) => {
            if (isMountedRef.current) {
              setBeacons(updatedList);
              setLastScannedAt(new Date());
            }
          },
          (err) => {
            if (isMountedRef.current) {
              setErrorMessage(err);
            }
          }
        );
        if (started && isMountedRef.current) {
          setScanning(true);
        }
      }

      // Also query current detected list immediately
      const results = await scanForNearbyBleBeacons(rescuerLatitude, rescuerLongitude);
      if (isMountedRef.current) {
        setBeacons(results);
        setLastScannedAt(new Date());
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setErrorMessage(e?.message || t("Scan cycle failed."));
      }
    } finally {
      setTimeout(() => {
        if (isMountedRef.current && !Capacitor.isNativePlatform()) {
          setScanning(false);
        }
      }, 1000);
    }
  }, [checkStatus, rescuerLatitude, rescuerLongitude, t]);

  useEffect(() => {
    isMountedRef.current = true;
    void runScan();

    const interval = setInterval(() => {
      void runScan();
    }, 15_000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      void stopBleRadar();
    };
  }, [runScan]);

  const getProximityBadge = (beacon: BleBeaconPayload) => {
    const rssi = beacon.rssi ?? -70;
    const approx = beacon.approxDistanceMeters ?? beacon.distanceMeters ?? 15;
    const cat = beacon.proximityCategory || "near";

    let color = "bg-cyan-500/20 text-cyan-200 border-cyan-500/30";
    let label = t("Near");

    if (cat === "immediate" || rssi >= -60) {
      color = "bg-emerald-500/20 text-emerald-200 border-emerald-500/30";
      label = t("Immediate (<3m)");
    } else if (cat === "near" || rssi >= -75) {
      color = "bg-cyan-500/20 text-cyan-200 border-cyan-500/30";
      label = t("Near (~3-10m)");
    } else if (cat === "moderate" || rssi >= -85) {
      color = "bg-amber-500/20 text-amber-200 border-amber-500/30";
      label = t("Moderate (~10-25m)");
    } else {
      color = "bg-rose-500/20 text-rose-200 border-rose-500/30";
      label = t("Weak (>25m)");
    }

    return (
      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${color}`}>
        {rssi} dBm · {label} · ~{approx}m
      </span>
    );
  };

  const getFreshnessLabel = (beacon: BleBeaconPayload) => {
    if (!beacon.lastSeenMs) return t("Live");
    const secondsAgo = Math.max(0, Math.round((Date.now() - beacon.lastSeenMs) / 1000));
    if (secondsAgo < 5) return t("Just now");
    return `${secondsAgo}s ${t("ago")}`;
  };

  const isNative = Capacitor.isNativePlatform();
  const isBluetoothReady = bleStatus?.isEnabled && bleStatus?.permissionsGranted;

  return (
    <div className="glass-panel glass-panel-dark overflow-hidden border border-[#1D4ED8]/30 bg-[#0F172A] p-4.5 text-white shadow-xl dark:bg-[#182353]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative grid h-8 w-8 place-items-center rounded-xl bg-[#1D4ED8]/20 text-[#F1F5F9]">
            <Radio className={`h-4 w-4 ${scanning ? "animate-spin" : "animate-pulse"}`} />
            {scanning && <span className="absolute inset-0 rounded-xl bg-[#1D4ED8]/30 animate-ping" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#F1F5F9]">
                {t("Offline BLE Distress Radar")}
              </h3>
              {!isNative && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-extrabold uppercase text-amber-300 ring-1 ring-amber-400/30">
                  {t("Browser Preview")}
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#F1F5F9]/70">
              {t("Peer-to-Peer Bluetooth Low Energy · 100% Offline")}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={scanning}
          onClick={runScan}
          className="h-7 rounded-xl border-[#1D4ED8]/40 bg-[#1D4ED8]/20 px-2.5 text-[11px] font-bold text-[#F1F5F9] hover:bg-[#1D4ED8]/30"
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? t("Scanning…") : t("Scan Radio")}
        </Button>
      </div>

      {/* Error or Permission Callout */}
      {errorMessage && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-2.5 text-[11px] text-rose-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold">{errorMessage}</p>
            {bleStatus && !bleStatus.permissionsGranted && isNative && (
              <Button
                size="sm"
                onClick={handleGrantPermissions}
                disabled={isRequestingPerms}
                className="mt-2 h-6 rounded-lg bg-rose-600 px-2.5 text-[10px] font-bold text-white hover:bg-rose-500"
              >
                {isRequestingPerms ? t("Requesting…") : t("Grant Bluetooth Permissions")}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Radar Status Bar */}
      <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-cyan-200/80">
        <span className="flex items-center gap-1.5">
          {scanning && (!isNative || isBluetoothReady) ? (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300">{t("Rescuer BLE Scanner Active")}</span>
            </>
          ) : !isNative ? (
            <>
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <span>{t("Dev Mesh Simulation Ready")}</span>
            </>
          ) : !isBluetoothReady ? (
            <>
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              <span className="text-rose-300">{t("Bluetooth Inactive")}</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>{t("Scanning Idle")}</span>
            </>
          )}
        </span>
        <span>
          {beacons.length} {beacons.length === 1 ? t("distress beacon detected") : t("distress beacons detected")}
        </span>
      </div>

      {/* Detected Beacons List */}
      <div className="mt-3 space-y-2">
        {beacons.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-black/20 p-4 text-center">
            <Bluetooth className="mx-auto h-6 w-6 text-cyan-500/50 mb-1" />
            <p className="text-xs font-bold text-cyan-100">{t("No nearby BLE SOS beacons detected")}</p>
            <p className="mt-0.5 text-[10px] text-cyan-300/60">
              {t("Victim phones in range broadcasting offline BLE packets will appear here automatically.")}
            </p>
          </div>
        ) : (
          beacons.map((beacon) => (
            <div
              key={beacon.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-950/40 p-3 backdrop-blur transition hover:border-cyan-400"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-black text-white">{beacon.id}</span>
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-rose-300">
                    {beacon.emergencyType || t("FLOOD")}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-cyan-300">
                    <Users className="h-3 w-3" />
                    {beacon.peopleAffected || 1}
                  </span>
                  <span className="text-[9px] text-cyan-400/80">
                    {getFreshnessLabel(beacon)}
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-cyan-200/80">
                  {getProximityBadge(beacon)}
                  {beacon.latitude && beacon.longitude && (
                    <span className="font-mono text-[9px] opacity-75">
                      {beacon.latitude.toFixed(4)}°N, {beacon.longitude.toFixed(4)}°E
                    </span>
                  )}
                </div>

                <p className="mt-1 text-[8px] text-cyan-300/50 italic">
                  {t("*Distance is approximate (walls, water & body shielding affect signal)")}
                </p>

                {acceptances.has(beacon.id) && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold">
                    {acceptances.get(beacon.id)!.syncStatus === "synced" ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle className="h-3 w-3" />
                        {t("Assignment confirmed by server")}
                        {acceptances.get(beacon.id)!.assignedPublicCode && (
                          <span className="font-mono text-[9px] text-emerald-200">
                            ({acceptances.get(beacon.id)!.assignedPublicCode})
                          </span>
                        )}
                      </span>
                    ) : acceptances.get(beacon.id)!.syncStatus === "conflict" ? (
                      <span className="flex items-center gap-1 text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        {acceptances.get(beacon.id)!.syncError || t("Assigned to another responder")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-cyan-300">
                        <Radio className="h-3 w-3 animate-pulse text-cyan-400" />
                        {t("Accepted locally — waiting to sync")}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                {!acceptances.has(beacon.id) && (
                  <Button
                    size="sm"
                    onClick={() => void handleAccept(beacon)}
                    className="h-8 shrink-0 rounded-xl bg-emerald-500 px-3 text-[11px] font-black text-black hover:bg-emerald-400 active:scale-95"
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    {t("Accept")}
                  </Button>
                )}

                {onTargetSelect && (
                  <Button
                    size="sm"
                    onClick={() => onTargetSelect(beacon)}
                    className="h-8 shrink-0 rounded-xl bg-cyan-500 px-3 text-[11px] font-black text-black hover:bg-cyan-400 active:scale-95"
                  >
                    <Navigation className="mr-1 h-3 w-3" />
                    {t("Navigate")}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
