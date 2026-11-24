import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import { VictimNavigation } from "@/components/VictimNavigation";
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
        // Fallback to Guwahati / Assam central coordinates
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
    <div className="victim-page min-h-screen bg-[#F8FAFC] text-[#0F172A] transition-colors dark:bg-[#0F172A] dark:text-[#F8FAFC]">
      <main className="victim-main relative mx-auto min-h-screen w-full max-w-4xl px-4 sm:px-6 pb-32 pt-5">
        {/* Header */}
        <header className="glass-card mb-5 flex items-center justify-between p-3.5 shadow-sm">
          <button
            onClick={() => setLocation("/more")}
            className="flex items-center gap-3 text-left transition hover:opacity-80 active:scale-95"
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#1D4ED8] text-white shadow-md shadow-[#1D4ED8]/20">
              <ArrowLeft className="h-5 w-5" />
            </span>
            <div>
              <span className="block text-lg font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                {t("Donate to NGO")}
              </span>
              <span className="block text-xs font-bold uppercase tracking-wider text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
                {t("Nearby Relief Organizations")}
              </span>
            </div>
          </button>
          <LanguageSelector compact />
        </header>

        {/* Hero Section */}
        <section className="glass-panel overflow-hidden bg-[#0F172A] p-5 text-white dark:bg-[#0c1433]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm text-[#F1F5F9]">
                <HeartHandshake className="h-6 w-6" />
              </span>
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#F1F5F9]">
                  {t("Verified Relief Directory")}
                </p>
                <h1 className="mt-0.5 text-xl font-black tracking-tight text-[#F8FAFC]">
                  {t("Community Relief NGOs")}
                </h1>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[#F1F5F9]/85 text-prose-justified">
            {t("Connect directly with grassroots flood relief and disaster rehabilitation teams across Assam.")}
          </p>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F1F5F9]">
              <MapPin className="h-4 w-4 shrink-0 text-[#1D4ED8]" />
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/25 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{t("Refresh")}</span>
            </button>
          </div>
        </section>

        {/* NGO List Section */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-sm font-extrabold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              {t("Nearby Relief Teams")} {ngos.length > 0 && `(${ngos.length})`}
            </h2>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
              {t("Sorted by distance")}
            </span>
          </div>

          {loading ? (
            <div className="glass-panel flex flex-col items-center justify-center p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#1D4ED8]" />
              <p className="mt-3 text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t("Finding nearby NGOs…")}
              </p>
              <p className="mt-1 text-xs text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
                {t("Calculating distances from your location")}
              </p>
            </div>
          ) : error ? (
            <div className="glass-panel border-red-500/30 bg-red-500/10 p-6 text-center text-red-700 dark:text-red-300">
              <p className="text-sm font-bold">{error}</p>
              <Button
                onClick={requestLocation}
                variant="outline"
                className="mt-3 rounded-xl border-red-500/40 text-xs"
              >
                {t("Retry")}
              </Button>
            </div>
          ) : ngos.length === 0 ? (
            <div className="glass-panel p-8 text-center border-dashed border-[#E2E8F0]/40">
              <Building2 className="mx-auto h-10 w-10 text-[#E2E8F0]" />
              <p className="mt-3 text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t("No NGOs found nearby")}
              </p>
              <p className="mt-1 text-xs text-[#0F172A]/70 dark:text-[#F1F5F9]/70 max-w-sm mx-auto">
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
                    className="glass-panel p-4.5 transition hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#F1F5F9] text-[#1D4ED8] dark:bg-[#1D4ED8]/30 dark:text-[#F1F5F9]">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <h3 className="truncate text-sm font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                            {ngo.name}
                          </h3>
                        </div>

                        {/* Address */}
                        <div className="mt-2.5 flex items-start gap-2 text-xs leading-5 text-[#0F172A]/70 dark:text-[#F1F5F9]/70">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1D4ED8] dark:text-[#F1F5F9]" />
                          <span>{ngo.address}</span>
                        </div>

                        {/* Phone Number */}
                        <div className="mt-2 flex items-start gap-2 text-xs font-semibold">
                          <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1D4ED8] dark:text-[#F1F5F9]" />
                          {hasValidPhone ? (
                            <a
                              href={`tel:${ngo.phone.replace(/[^0-9+]/g, "")}`}
                              className="text-[#1D4ED8] hover:underline dark:text-[#F1F5F9]"
                            >
                              {ngo.phone}
                            </a>
                          ) : (
                            <span className="font-normal italic text-muted-foreground">
                              {NO_PHONE_TEXT}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Distance Badge */}
                      {ngo.distance && (
                        <div className="shrink-0 rounded-xl glass-card px-2.5 py-1 text-right">
                          <span className="block font-mono text-[11px] font-black text-[#1D4ED8] dark:text-[#F1F5F9]">
                            {ngo.distance}
                          </span>
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-[#0F172A]/60 dark:text-[#F1F5F9]/60">
                            {t("Distance")}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="mt-3.5 flex items-center gap-2 border-t border-[#E2E8F0]/20 dark:border-[#F1F5F9]/10 pt-3">
                      {hasValidPhone ? (
                        <a
                          href={`tel:${ngo.phone.replace(/[^0-9+]/g, "")}`}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#1d47db] active:scale-95"
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
                        className={`flex items-center justify-center gap-1.5 rounded-xl glass-card border border-[#E2E8F0]/30 px-3 py-2 text-xs font-bold text-[#0F172A] transition hover:bg-neutral-50 active:scale-95 dark:text-[#F8FAFC] dark:hover:bg-neutral-800 ${
                          hasValidPhone ? "flex-1" : "w-full"
                        }`}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#F1F5F9]" />
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
