import React, { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { BleBeaconPayload, scanForNearbyBleBeacons } from "@/lib/bleBeacon";
import { Button } from "@/components/ui/button";
import { AlertCircle, Bluetooth, Compass, Navigation, Radio, RefreshCw, ShieldAlert, Users, Waves } from "lucide-react";

export function BleEmergencyRadar({
  rescuerLatitude,
  rescuerLongitude,
  onTargetSelect,
}: {
  rescuerLatitude?: number;
  rescuerLongitude?: number;
  onTargetSelect?: (beacon: BleBeaconPayload) => void;
}) {
  const { t } = useLanguage();
  const [scanning, setScanning] = useState(false);
  const [beacons, setBeacons] = useState<BleBeaconPayload[]>([]);
  const [lastScannedAt, setLastScannedAt] = useState<Date | null>(null);

  const runScan = async () => {
    setScanning(true);
    try {
      const results = await scanForNearbyBleBeacons(rescuerLatitude, rescuerLongitude);
      setBeacons(results);
      setLastScannedAt(new Date());
    } finally {
      setTimeout(() => setScanning(false), 800);
    }
  };

  useEffect(() => {
    void runScan();
    const interval = setInterval(() => {
      void runScan();
    }, 12_000);
    return () => clearInterval(interval);
  }, [rescuerLatitude, rescuerLongitude]);

  return (
    <div className="rounded-[1.6rem] border border-cyan-500/20 bg-gradient-to-br from-[#0c2229] via-[#0f2d37] to-[#0a1b20] p-4 text-white shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative grid h-8 w-8 place-items-center rounded-xl bg-cyan-500/20 text-cyan-400">
            <Radio className={`h-4 w-4 ${scanning ? "animate-spin" : "animate-pulse"}`} />
            {scanning && <span className="absolute inset-0 rounded-xl bg-cyan-400/20 animate-ping" />}
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">
              {t("Offline BLE Distress Radar")}
            </h3>
            <p className="text-[10px] text-cyan-200/70">
              {t("Peer-to-Peer Bluetooth (~50-100m range)")}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={scanning}
          onClick={runScan}
          className="h-7 rounded-xl border-cyan-500/40 bg-cyan-950/60 px-2.5 text-[11px] font-bold text-cyan-200 hover:bg-cyan-900"
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? t("Scanning…") : t("Scan Radio")}
        </Button>
      </div>

      {/* Radar Status Bar */}
      <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-cyan-200/80">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          {t("Rescuer BLE Receiver Active")}
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
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-white">{beacon.id}</span>
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-rose-300">
                    {beacon.emergencyType || t("FLOOD")}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-cyan-300">
                    <Users className="h-3 w-3" />
                    {beacon.peopleAffected || 1}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[10px] text-cyan-200/80">
                  <span className="font-mono">{beacon.latitude.toFixed(4)}°N, {beacon.longitude.toFixed(4)}°E</span>
                  {beacon.distanceMeters !== undefined && (
                    <span className="rounded-full bg-cyan-500/20 px-2 py-0.2 font-bold text-cyan-200">
                      ~{beacon.distanceMeters}m {t("away")} ({beacon.rssi} dBm)
                    </span>
                  )}
                </div>
              </div>

              {onTargetSelect && (
                <Button
                  size="sm"
                  onClick={() => onTargetSelect(beacon)}
                  className="h-8 rounded-xl bg-cyan-500 px-3 text-[11px] font-black text-black hover:bg-cyan-400 active:scale-95"
                >
                  <Navigation className="mr-1 h-3 w-3" />
                  {t("Navigate")}
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
