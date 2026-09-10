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
    <div className="victim-page min-h-screen bg-[#f8f7f2] text-[#1c1917] transition-colors dark:bg-[#0a0b0d] dark:text-[#f8fafc]">
      <main className="victim-main mx-auto min-h-screen max-w-lg bg-[#fdfcf7] px-5 pb-28 pt-6 transition-colors dark:bg-[#121316] md:my-6 md:min-h-[850px] md:rounded-[2.75rem] md:border md:border-black/10 dark:md:border-white/10 shadow-xl">
        {/* Universal Header Bar */}
        <header className="flex items-center justify-between gap-3 pb-2">
          <button
            onClick={() => setLocation("/more")}
            className="group flex items-center gap-2.5 text-left transition hover:opacity-85 active:scale-95"
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#881337] text-white shadow-sm transition dark:bg-[#eab308] dark:text-[#0a0b0d]">
              <ArrowLeft className="h-5 w-5" />
            </span>
            <div>
              <span className="block text-lg font-black tracking-[-.04em] text-[#1c1917] dark:text-[#f8fafc]">
                {t("Donate to NGO")}
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#78716c] dark:text-[#a8a29e]">
                {t("Nearby Relief Organizations")}
              </span>
            </div>
          </button>
          <LanguageSelector compact />
        </header>

        {/* Hero Section: Community Relief NGOs */}
        <section className="mt-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#78350f] via-[#92400e] to-[#451a03] p-5 text-white shadow-xl ring-1 ring-black/10 dark:from-[#291e0a] dark:via-[#1f1708] dark:to-[#120f06] dark:ring-[#ca8a04]/30">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm text-2xl">
                🤝
              </span>
              <div>
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#fde68a] dark:text-[#facc15]">
                  {t("Verified Relief Directory")}
                </p>
                <h1 className="mt-0.5 text-xl font-black tracking-tight text-white">
                  {t("Community Relief NGOs")}
                </h1>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[#fef3c7] dark:text-[#fef08a]/80">
            {t("Connect directly with grassroots flood relief and disaster rehabilitation teams across Assam.")}
          </p>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/15 pt-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#fef3c7]">
              <MapPin className="h-4 w-4 shrink-0 text-[#facc15]" />
              <span className="truncate">
                {locationStatus === "locating"
                  ? t("Locating nearby NGOs…")
                  : locationStatus === "ready"
                  ? `${t("Sorted by nearest distance")} 📍`
                  : t("Showing Assam relief organizations")}
              </span>
            </div>
            <button
              onClick={requestLocation}
              disabled={loading || locationStatus === "locating"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/30 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{t("Refresh")}</span>
            </button>
          </div>
        </section>

        {/* NGO List Section */}
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-black tracking-tight text-[#1c1917] dark:text-[#f8fafc]">
              {t("Nearby Relief Teams")} {ngos.length > 0 && `(${ngos.length})`}
            </h2>
            <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#ca8a04] dark:text-[#facc15]">
              {t("Sorted by distance")} 📍
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-[2rem] border border-black/10 bg-white p-12 text-center shadow-sm dark:border-white/10 dark:bg-[#18191d]">
              <Loader2 className="h-8 w-8 animate-spin text-[#881337] dark:text-[#facc15]" />
              <p className="mt-3 text-sm font-bold text-[#1c1917] dark:text-[#f8fafc]">
                {t("Finding nearby NGOs…")}
              </p>
              <p className="mt-1 text-xs text-[#78716c] dark:text-[#a8a29e]">
                {t("Calculating distances from your location")}
              </p>
            </div>
          ) : error ? (
            <div className="rounded-[2rem] border border-destructive/30 bg-destructive/10 p-6 text-center">
              <p className="text-sm font-bold text-destructive">{error}</p>
              <Button
                onClick={requestLocation}
                variant="outline"
                className="mt-3 rounded-xl border-destructive/40 text-xs font-bold"
              >
                {t("Retry")}
              </Button>
            </div>
          ) : ngos.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-black/10 bg-white p-8 text-center dark:border-white/10 dark:bg-[#18191d]">
              <Building2 className="mx-auto h-10 w-10 text-[#a8a29e]" />
              <p className="mt-3 text-sm font-black text-[#1c1917] dark:text-[#f8fafc]">
                {t("No NGOs found nearby")}
              </p>
              <p className="mt-1 text-xs text-[#78716c] dark:text-[#a8a29e]">
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
                    className="overflow-hidden rounded-[1.8rem] border border-black/10 bg-white p-4.5 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-[#18191d]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#fefce8] text-[#ca8a04] dark:bg-[#291e0a] dark:text-[#facc15] text-sm">
                            🏢
                          </span>
                          <h3 className="truncate text-sm font-black tracking-tight text-[#1c1917] dark:text-[#f8fafc]">
                            {ngo.name}
                          </h3>
                        </div>

                        {/* Address */}
                        <div className="mt-2.5 flex items-start gap-2 text-xs leading-5 text-[#78716c] dark:text-[#a8a29e]">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ca8a04] dark:text-[#facc15]" />
                          <span>{ngo.address}</span>
                        </div>

                        {/* Phone Number */}
                        <div className="mt-2 flex items-start gap-2 text-xs font-semibold">
                          <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#881337] dark:text-[#facc15]" />
                          {hasValidPhone ? (
                            <a
                              href={`tel:${ngo.phone.replace(/[^0-9+]/g, "")}`}
                              className="text-[#881337] font-bold hover:underline dark:text-[#facc15]"
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
                        <div className="shrink-0 rounded-xl border border-black/5 bg-[#fafaf9] px-2.5 py-1 text-right dark:border-white/5 dark:bg-[#1e2025]">
                          <span className="block font-mono text-[11px] font-black text-[#881337] dark:text-[#facc15]">
                            {ngo.distance}
                          </span>
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-[#78716c] dark:text-[#a8a29e]">
                            {t("Distance")}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="mt-3.5 flex items-center gap-2 border-t border-black/5 pt-3 dark:border-white/5">
                      {hasValidPhone ? (
                        <a
                          href={`tel:${ngo.phone.replace(/[^0-9+]/g, "")}`}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#881337] px-3.5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[#9f1239] active:scale-95 dark:bg-[#eab308] dark:text-[#0a0b0d]"
                        >
                          <PhoneCall className="h-3.5 w-3.5" />
                          <span>{t("Call NGO")} 📞</span>
                        </a>
                      ) : null}

                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${ngo.name}, ${ngo.address}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-xs font-bold text-[#1c1917] transition hover:bg-black/5 active:scale-95 dark:border-white/10 dark:bg-[#22252a] dark:text-[#f8fafc] dark:hover:bg-white/5 ${
                          hasValidPhone ? "flex-1" : "w-full"
                        }`}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-[#78716c] dark:text-[#a8a29e]" />
                        <span>{t("Open Maps")} 🗺️</span>
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
