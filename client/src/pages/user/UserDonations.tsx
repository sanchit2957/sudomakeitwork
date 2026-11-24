import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import { VictimNavigation } from "@/pages/Home";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ExternalLink,
  HeartHandshake,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export type NgoItem = {
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  distance?: string;
};

const NO_PHONE_TEXT = "Contact number not listed — reach out via address";

export default function UserDonations() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"locating" | "ready" | "fallback">("locating");
  const [ngos, setNgos] = useState<NgoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Get user's device location
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("fallback");
      setPosition({ latitude: 26.1445, longitude: 91.7362 });
      return;
    }

    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      pos => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLocationStatus("ready");
      },
      err => {
        console.warn("[UserDonations] Geolocation unavailable, using Assam central coordinates:", err.message);
        setLocationStatus("fallback");
        setPosition({ latitude: 26.1445, longitude: 91.7362 });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  // Fetch nearby NGOs when position is ready or updated
  useEffect(() => {
    if (!position) return;

    let isMounted = true;
    const fetchNearbyNgos = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/donations/ngos/nearby?lat=${encodeURIComponent(position.latitude)}&lon=${encodeURIComponent(position.longitude)}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch nearby NGOs (HTTP ${res.status})`);
        }
        const data: NgoItem[] = await res.json();
        if (isMounted) {
          setNgos(Array.isArray(data) ? data : []);
        }
      } catch (err: any) {
        console.error("[UserDonations] Error loading nearby NGOs:", err);
        if (isMounted) {
          setError(t("Unable to load nearby NGOs. Please check connection and try again."));
          toast.error(t("Failed to load nearby NGOs"));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchNearbyNgos();
    return () => {
      isMounted = false;
    };
  }, [position]);

  return (
    <div className="victim-page min-h-screen bg-[#F8FAFC] text-slate-900 transition-colors dark:bg-[#0A0E17] dark:text-slate-100 overflow-x-hidden">
      <main className="victim-main relative mx-auto min-h-screen w-full max-w-4xl px-4 sm:px-6 pb-32 pt-5">
        {/* Header */}
        <header className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 mb-5 flex items-center justify-between">
          <button
            onClick={() => setLocation("/more")}
            className="flex items-center gap-3 text-left transition hover:opacity-85 active:scale-95"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-950/40 dark:text-teal-400">
              <ArrowLeft className="h-5 w-5" />
            </span>
            <div>
              <span className="block text-base font-bold text-slate-900 dark:text-white">
                {t("Donate to NGO")}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {t("Nearby Relief Organizations")}
              </span>
            </div>
          </button>
          <LanguageSelector compact />
        </header>

        {/* Hero Section */}
        <section className="rounded-2xl border border-slate-800 bg-[#0F172A] p-6 text-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-teal-400">
                <HeartHandshake className="h-6 w-6" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-400">
                  {t("Verified Relief Directory")}
                </p>
                <h1 className="mt-0.5 text-xl font-bold tracking-tight text-white">
                  {t("Community Relief NGOs")}
                </h1>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-300">
            {t("Connect directly with grassroots flood relief and disaster rehabilitation teams across Assam.")}
          </p>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <MapPin className="h-4 w-4 shrink-0 text-teal-400" />
              <span className="truncate">
                {locationStatus === "locating"
                  ? t("Locating nearby NGOs…")
                  : locationStatus === "ready"
                  ? t("Sorted by nearest distance")
                  : t("Showing Assam relief organizations")}
              </span>
            </div>
            <button
              onClick={requestLocation}
              disabled={loading || locationStatus === "locating"}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{t("Refresh")}</span>
            </button>
          </div>
        </section>

        {/* NGO List Section */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              {t("Nearby Relief Teams")} {ngos.length > 0 && `(${ngos.length})`}
            </h2>
            <span className="font-mono text-[10px] text-slate-500">
              {t("Sorted by distance")}
            </span>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600 mx-auto" />
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                {t("Finding nearby NGOs…")}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t("Calculating distances from your location")}
              </p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              <p className="text-sm font-semibold">{error}</p>
              <Button
                onClick={requestLocation}
                variant="outline"
                className="mt-3 rounded-xl text-xs"
              >
                {t("Retry")}
              </Button>
            </div>
          ) : ngos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <Building2 className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                {t("No NGOs found nearby")}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {t("Check your device location permissions or refresh to load all Assam relief organizations.")}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {ngos.map((ngo, idx) => {
                const hasValidPhone = Boolean(
                  ngo.phone &&
                    ngo.phone.trim() !== "" &&
                    ngo.phone.trim() !== NO_PHONE_TEXT &&
                    !ngo.phone.toLowerCase().includes("not listed")
                );

                return (
                  <article
                    key={`${ngo.name}-${idx}`}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-500/20 dark:bg-teal-950/40 dark:text-teal-400">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {ngo.name}
                          </h3>
                        </div>

                        {/* Address */}
                        <div className="mt-2.5 flex items-start gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>{ngo.address}</span>
                        </div>

                        {/* Phone Number */}
                        <div className="mt-2 flex items-start gap-2 text-xs font-semibold">
                          <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                          {hasValidPhone ? (
                            <a
                              href={`tel:${ngo.phone.replace(/[^0-9+]/g, "")}`}
                              className="text-teal-700 hover:underline dark:text-teal-400 font-mono"
                            >
                              {ngo.phone}
                            </a>
                          ) : (
                            <span className="font-normal italic text-slate-400">
                              {NO_PHONE_TEXT}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Distance Badge */}
                      {ngo.distance && (
                        <div className="shrink-0 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-1 text-right dark:border-slate-800 dark:bg-slate-800/60">
                          <span className="block font-mono text-[11px] font-bold text-teal-700 dark:text-teal-400">
                            {ngo.distance}
                          </span>
                          <span className="block text-[9px] uppercase tracking-wider text-slate-400">
                            {t("Distance")}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="mt-3.5 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                      {hasValidPhone ? (
                        <a
                          href={`tel:${ngo.phone.replace(/[^0-9+]/g, "")}`}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-700 active:scale-95"
                        >
                          <PhoneCall className="h-3.5 w-3.5" />
                          <span>{t("Call NGO")}</span>
                        </a>
                      ) : null}

                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${ngo.name}, ${ngo.address}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 ${
                          hasValidPhone ? "flex-1" : "w-full"
                        }`}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                        <span>{t("View on Map")}</span>
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <VictimNavigation current="more" />
    </div>
  );
}
