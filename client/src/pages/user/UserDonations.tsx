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
    <div className="victim-page min-h-screen bg-[#f6f8f7] text-foreground dark:bg-[#111214]">
      <main className="victim-main mx-auto min-h-screen max-w-lg bg-[#fcfdfd] px-5 pb-28 pt-6 md:my-6 md:min-h-[850px] md:rounded-[2.75rem] md:border md:border-black/5 dark:bg-[#141619] dark:md:border-white/10">
        {/* Header */}
        <header className="flex items-center justify-between gap-2 pb-2">
          <button
            onClick={() => setLocation("/more")}
            className="flex items-center gap-2 text-left transition hover:opacity-80 active:scale-95"
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#174e46] text-white shadow-sm dark:bg-emerald-600">
              <ArrowLeft className="h-5 w-5" />
            </span>
            <div>
              <span className="block text-lg font-black tracking-[-.04em] text-[#142c2b] dark:text-white">
                {t("Donate to NGO")}
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64847d] dark:text-[#8ea49d]">
                {t("Nearby Relief Organizations")}
              </span>
            </div>
          </button>
          <LanguageSelector compact />
        </header>

        {/* Hero Section */}
        <section className="mt-4 rounded-[1.8rem] bg-gradient-to-br from-[#174e46] via-[#1b5850] to-[#123e38] p-5 text-white shadow-[0_16px_36px_-18px_rgba(23,78,70,0.5)] dark:from-[#0d342f] dark:to-[#08201d]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <HeartHandshake className="h-6 w-6 text-[#9fe6d5]" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#a7dfd3]">
                  {t("Verified Relief Directory")}
                </p>
                <h1 className="mt-0.5 text-xl font-black tracking-tight text-white">
                  {t("Community Relief NGOs")}
                </h1>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[#cde6e0]">
            {t("Connect directly with grassroots flood relief and disaster rehabilitation teams across Assam.")}
          </p>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#b8ded5]">
              <MapPin className="h-4 w-4 shrink-0 text-[#5eead4]" />
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
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-extrabold tracking-tight text-[#142c2b] dark:text-white">
              {t("Nearby Relief Teams")} {ngos.length > 0 && `(${ngos.length})`}
            </h2>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#64847d] dark:text-[#8ea49d]">
              {t("Sorted by distance")}
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-[2rem] border border-[#e4edea] bg-white p-12 text-center shadow-sm dark:border-white/10 dark:bg-[#191b1f]">
              <Loader2 className="h-8 w-8 animate-spin text-[#174e46] dark:text-emerald-400" />
              <p className="mt-3 text-sm font-bold text-[#142c2b] dark:text-white">
                {t("Finding nearby NGOs…")}
              </p>
              <p className="mt-1 text-xs text-[#64847d] dark:text-[#8ea49d]">
                {t("Calculating distances from your location")}
              </p>
            </div>
          ) : error ? (
            <div className="rounded-[2rem] border border-destructive/20 bg-destructive/5 p-6 text-center">
              <p className="text-sm font-bold text-destructive">{error}</p>
              <Button
                onClick={requestLocation}
                variant="outline"
                className="mt-3 rounded-xl border-destructive/30 text-xs"
              >
                {t("Retry")}
              </Button>
            </div>
          ) : ngos.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-[#d6ebe3] bg-white p-8 text-center dark:border-white/10 dark:bg-[#191b1f]">
              <Building2 className="mx-auto h-10 w-10 text-[#64847d]/60" />
              <p className="mt-3 text-sm font-bold text-[#142c2b] dark:text-white">
                {t("No NGOs found nearby")}
              </p>
              <p className="mt-1 text-xs text-[#64847d] dark:text-[#8ea49d]">
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
                    className="overflow-hidden rounded-[1.6rem] border border-[#d6ebe3] bg-white p-4 shadow-[0_4px_16px_rgba(20,70,60,0.04)] transition hover:border-[#174e46]/40 dark:border-white/10 dark:bg-[#191b1f] dark:hover:border-emerald-500/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#eaf6f2] text-[#176a5a] dark:bg-emerald-950/50 dark:text-emerald-300">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <h3 className="truncate text-sm font-black tracking-tight text-[#142c2b] dark:text-white">
                            {ngo.name}
                          </h3>
                        </div>

                        {/* Address */}
                        <div className="mt-2.5 flex items-start gap-2 text-xs leading-5 text-[#54736b] dark:text-[#9bb2aa]">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#176a5a] dark:text-emerald-400" />
                          <span>{ngo.address}</span>
                        </div>

                        {/* Phone Number */}
                        <div className="mt-2 flex items-start gap-2 text-xs font-semibold">
                          <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#176a5a] dark:text-emerald-400" />
                          {hasValidPhone ? (
                            <a
                              href={`tel:${ngo.phone.replace(/[^0-9+]/g, "")}`}
                              className="text-[#174e46] hover:underline dark:text-emerald-400"
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
                        <div className="shrink-0 rounded-xl bg-[#f0faf6] px-2.5 py-1 text-right dark:bg-[#20252b]">
                          <span className="block font-mono text-[11px] font-black text-[#176a5a] dark:text-emerald-300">
                            {ngo.distance}
                          </span>
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-[#6e8e85] dark:text-[#8ea49d]">
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
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#174e46] px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#123e38] active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-500"
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
                        className={`flex items-center justify-center gap-1.5 rounded-xl border border-[#cbe4db] bg-white px-3 py-2 text-xs font-bold text-[#142c2b] transition hover:bg-neutral-50 active:scale-95 dark:border-white/10 dark:bg-[#202328] dark:text-white dark:hover:bg-neutral-800 ${
                          hasValidPhone ? "flex-1" : "w-full"
                        }`}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-[#63817a] dark:text-neutral-400" />
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
