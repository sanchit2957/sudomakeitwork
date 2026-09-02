/**
 * MAP FRONTEND INTEGRATION
 * Supports Google Maps API with dynamic loader and native map features,
 * with seamless fallback to Leaflet / CartoDB Voyager tiles.
 * 
 * Available Libraries:
 * libraries=marker,places,geocoding,geometry,routes
 */

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { loadGoogleMaps, isGoogleMapsLoaded } from "@/lib/googleMaps";
import { trpc } from "@/lib/trpc";
import { getWeatherRiskPresentation } from "@/lib/weatherRisk";

import { LocateFixed, RefreshCw } from "lucide-react";

declare global {
  namespace google {
    namespace maps {
      type Map = any;
      type LatLngLiteral = { lat: number; lng: number };
      type Marker = any;
      namespace marker {
        type AdvancedMarkerElement = any;
        type PinElement = any;
      }
      type Polyline = any;
      type PolylineOptions = any;
      type Polygon = any;
      type PolygonOptions = any;
      type Circle = any;
      type InfoWindow = any;
      type DirectionsService = any;
      type DirectionsRenderer = any;
      type TravelMode = any;
    }
  }
  interface Window {
    google?: any;
    __GOOGLE_MAPS_API_KEY__?: string;
  }
}

export type MapHospital = {
  id: number;
  name: string;
  address?: string;
  contactPhone?: string | null;
  latitude: number;
  longitude: number;
  availableEmergencyBeds?: number;
  distanceKm?: number;
};

export type MapShelter = {
  id: number;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  occupancy?: number;
  distanceKm?: number;
};

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  showWeatherHeatmap?: boolean;
  hospitals?: MapHospital[];
  shelters?: MapShelter[];
  onRecenter?: () => void;
  recenterLoading?: boolean;
  onMapReady?: (map: google.maps.Map | any) => void;
  onLeafletReady?: (map: any) => void;
  onMapError?: () => void;
  onPickLocation?: (point: { lat: number; lng: number }) => void;
}

function renderWeatherPopupHtml(pt: any) {
  const riskInfo = getWeatherRiskPresentation(pt.riskLevel);

  return `
    <div style="font-family:Inter,system-ui,sans-serif;padding:6px;min-width:180px;font-size:12px;line-height:1.4;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
        <strong style="color:#111827;font-size:13px;">${pt.name}</strong>
        <span style="background:${riskInfo.hexColor};color:#fff;padding:2px 6px;border-radius:9999px;font-size:9px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;">
          ${riskInfo.badgeLabelKey}
        </span>
      </div>
      <div style="color:#6b7280;font-size:11px;margin-bottom:4px;">${pt.state || "India"}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px;padding:4px 6px;background:#f3f4f6;border-radius:6px;font-size:10px;">
        <div>🌡️ Temp: <strong>${pt.currentTempC !== null && pt.currentTempC !== undefined ? `${Math.round(pt.currentTempC)}°C` : pt.temperatureC !== null && pt.temperatureC !== undefined ? `${Math.round(pt.temperatureC)}°C` : "—"}</strong></div>
        <div>🌧️ Rain: <strong>${pt.precipitation24hMm !== null && pt.precipitation24hMm !== undefined ? `${pt.precipitation24hMm}mm` : pt.precipitationMm !== null && pt.precipitationMm !== undefined ? `${pt.precipitationMm}mm` : "0mm"}</strong></div>
        <div>💨 Wind: <strong>${pt.windSpeedKmh !== null && pt.windSpeedKmh !== undefined ? `${Math.round(pt.windSpeedKmh)}km/h` : "—"}</strong></div>
        <div>🎯 Chance: <strong>${pt.rainChance !== null && pt.rainChance !== undefined ? `${pt.rainChance}%` : pt.rainChancePercent !== null && pt.rainChancePercent !== undefined ? `${pt.rainChancePercent}%` : "—"}</strong></div>
      </div>
    </div>
  `;
}

class SafeErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function WeatherHeatmapClient({ onPoints }: { onPoints: (points: any[]) => void }) {
  const { data } = trpc.rescue.weather.riskHeatmap.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (data) {
      const points = Array.isArray(data) ? data : (data as any)?.points;
      if (Array.isArray(points) && points.length > 0) {
        onPoints(points);
      }
    }
  }, [data, onPoints]);

  return null;
}

function WeatherHeatmapConsumer({ onPoints }: { onPoints: (points: any[]) => void }) {
  if (typeof window === "undefined") {
    return null;
  }
  return <WeatherHeatmapClient onPoints={onPoints} />;
}

export function MapView({
  className,
  initialCenter = { lat: 20.5937, lng: 78.9629 },
  initialZoom = 5,
  showWeatherHeatmap = true,
  hospitals,
  shelters,
  onRecenter,
  recenterLoading,
  onMapReady,
  onLeafletReady,
  onMapError,
  onPickLocation,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const leafletWeatherLayerRef = useRef<any>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkerRef = useRef<any>(null);
  const googleWeatherCirclesRef = useRef<any[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [mapEngine, setMapEngine] = useState<"google" | "leaflet" | "none">("none");
  const [weatherPoints, setWeatherPoints] = useState<any[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;
    let isMounted = true;

    async function initMap() {
      // 1. If Google Maps is already loaded or an explicit API key is configured
      const isLoaded = isGoogleMapsLoaded();
      const apiKey = typeof window !== "undefined" ? ((window as any).__GOOGLE_MAPS_API_KEY__ || import.meta.env.VITE_GOOGLE_MAPS_API_KEY) : "";
      if (isLoaded || (apiKey && apiKey.trim().length > 0)) {
        try {
          const gMaps = isLoaded ? (window as any).google.maps : await loadGoogleMaps(apiKey);
          if (!isMounted || !mapContainer.current) return;

          if (gMaps && gMaps.Map) {
            const map = new gMaps.Map(mapContainer.current, {
              zoom: initialZoom,
              center: { lat: initialCenter.lat, lng: initialCenter.lng },
              mapTypeControl: true,
              mapTypeControlOptions: {
                style: (window as any).google?.maps?.MapTypeControlStyle?.HORIZONTAL_BAR,
              },
              fullscreenControl: true,
              zoomControl: true,
              streetViewControl: false,
            });

            googleMapRef.current = map;
            setMapEngine("google");

            // Add default location pin
            if (gMaps.Marker || (window as any).google?.maps?.Marker) {
              const MarkerClass = gMaps.Marker || (window as any).google.maps.Marker;
              const marker = new MarkerClass({
                position: { lat: initialCenter.lat, lng: initialCenter.lng },
                map,
                title: "Selected Location",
                zIndex: 1000,
                animation: (window as any).google?.maps?.Animation?.DROP,
              });
              googleMarkerRef.current = marker;
            }

            if (onPickLocation && map.addListener) {
              map.addListener("click", (e: any) => {
                if (e.latLng) {
                  const lat = e.latLng.lat();
                  const lng = e.latLng.lng();
                  if (googleMarkerRef.current?.setPosition) {
                    googleMarkerRef.current.setPosition({ lat, lng });
                  }
                  onPickLocation({ lat, lng });
                }
              });
            }

            onMapReady?.(map);
            return;
          }
        } catch (gErr) {
          console.warn("[GoogleMaps] Init failed, using zero-config Leaflet:", gErr);
        }
      }

      // 2. Primary / Default Engine: Zero-config Leaflet with high-resolution OSM/CartoDB tiles (No API key required)
      try {
        const L = (await import("leaflet")).default;
        if (!isMounted || !mapContainer.current) return;

        if (leafletMapRef.current) {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
        }

        const lMap = L.map(mapContainer.current, {
          center: [initialCenter.lat, initialCenter.lng],
          zoom: initialZoom,
          zoomControl: true,
          attributionControl: true,
        });

        // OpenStreetMap default tiles (100% free & keyless)
        L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          }
        ).addTo(lMap);

        const weatherLayer = L.layerGroup().addTo(lMap);
        leafletWeatherLayerRef.current = weatherLayer;

        const customPin = L.divIcon({
          className: "custom-map-pin",
          html: `<div style="background:#0f766e;color:#fff;border-radius:50%;width:30px;height:30px;display:grid;place-items:center;box-shadow:0 4px 12px rgba(0,0,0,0.35);border:2px solid #fff;font-size:15px;position:relative;z-index:1000;">📍</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
        });

        const marker = L.marker([initialCenter.lat, initialCenter.lng], { icon: customPin, zIndexOffset: 1000 }).addTo(lMap);

        if (onPickLocation) {
          lMap.on("click", (e: any) => {
            marker.setLatLng(e.latlng);
            onPickLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
          });
        }

        leafletMapRef.current = lMap;
        setMapEngine("leaflet");
        onLeafletReady?.(lMap);

        // Multi-stage invalidation to prevent grey tile glitch on mobile WebView / animations
        const timers = [
          setTimeout(() => { if (isMounted) lMap.invalidateSize(); }, 50),
          setTimeout(() => { if (isMounted) lMap.invalidateSize(); }, 250),
          setTimeout(() => { if (isMounted) lMap.invalidateSize(); }, 750),
        ];

        const handleResize = () => {
          if (isMounted && leafletMapRef.current) {
            leafletMapRef.current.invalidateSize();
          }
        };
        window.addEventListener("resize", handleResize);

        return () => {
          timers.forEach(t => clearTimeout(t));
          window.removeEventListener("resize", handleResize);
        };
      } catch (err) {
        console.error("[Map] Leaflet initialization failed:", err);
        if (isMounted) {
          setLoadError(true);
          onMapError?.();
        }
      }
    }

    void initMap();

    return () => {
      isMounted = false;
      if (googleMarkerRef.current?.setMap) {
        googleMarkerRef.current.setMap(null);
        googleMarkerRef.current = null;
      }
      googleWeatherCirclesRef.current.forEach((c) => c?.setMap?.(null));
      googleWeatherCirclesRef.current = [];
      googleMapRef.current = null;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [initialZoom]);

  // Sync Weather Risk Heatmap Overlay
  useEffect(() => {
    if (!showWeatherHeatmap || !weatherPoints || weatherPoints.length === 0) {
      if (leafletWeatherLayerRef.current) leafletWeatherLayerRef.current.clearLayers();
      googleWeatherCirclesRef.current.forEach((c) => c?.setMap?.(null));
      googleWeatherCirclesRef.current = [];
      return;
    }

    if (mapEngine === "leaflet" && leafletWeatherLayerRef.current) {
      (async () => {
        const L = (await import("leaflet")).default;
        const layer = leafletWeatherLayerRef.current;
        if (!layer) return;
        layer.clearLayers();

        weatherPoints.forEach((pt) => {
          const riskInfo = getWeatherRiskPresentation(pt.riskLevel);

          const circle = L.circle([pt.latitude, pt.longitude], {
            radius: 90000,
            color: riskInfo.strokeColor,
            fillColor: riskInfo.hexColor,
            fillOpacity: riskInfo.fillOpacity,
            weight: 1.5,
          });
          circle.bindPopup(renderWeatherPopupHtml(pt));
          layer.addLayer(circle);

          const centerDot = L.circleMarker([pt.latitude, pt.longitude], {
            radius: 4,
            color: riskInfo.strokeColor,
            fillColor: "#ffffff",
            fillOpacity: 0.9,
            weight: 2,
          });
          centerDot.bindPopup(renderWeatherPopupHtml(pt));
          layer.addLayer(centerDot);
        });
      })();
    } else if (mapEngine === "google" && googleMapRef.current && (window as any).google?.maps) {
      const gMaps = (window as any).google.maps;
      googleWeatherCirclesRef.current.forEach((c) => c?.setMap?.(null));
      googleWeatherCirclesRef.current = [];

      const infoWindow = new gMaps.InfoWindow();

      weatherPoints.forEach((pt) => {
        const riskInfo = getWeatherRiskPresentation(pt.riskLevel);

        const circle = new gMaps.Circle({
          strokeColor: riskInfo.strokeColor,
          strokeOpacity: 0.6,
          strokeWeight: 1.5,
          fillColor: riskInfo.hexColor,
          fillOpacity: riskInfo.fillOpacity,
          map: googleMapRef.current,
          center: { lat: pt.latitude, lng: pt.longitude },
          radius: 90000,
        });

        circle.addListener("click", (e: any) => {
          infoWindow.setContent(renderWeatherPopupHtml(pt));
          infoWindow.setPosition(e.latLng);
          infoWindow.open(googleMapRef.current);
        });

        googleWeatherCirclesRef.current.push(circle);
      });
    }
  }, [mapEngine, showWeatherHeatmap, weatherPoints]);

  const leafletResourcesLayerRef = useRef<any>(null);
  const googleResourcesMarkersRef = useRef<any[]>([]);

  // Sync Resource Markers (Hospitals & Shelters)
  useEffect(() => {
    if (mapEngine === "leaflet" && leafletMapRef.current) {
      (async () => {
        const L = (await import("leaflet")).default;
        if (!leafletResourcesLayerRef.current) {
          leafletResourcesLayerRef.current = L.layerGroup().addTo(leafletMapRef.current);
        }
        const layer = leafletResourcesLayerRef.current;
        layer.clearLayers();

        // 1. Hospital Pins
        (hospitals || []).forEach((h) => {
          const hospIcon = L.divIcon({
            className: "hosp-pin",
            html: `<div style="background:#166534;color:#fff;border-radius:50%;width:26px;height:26px;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:12px;cursor:pointer;">🏥</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 26],
          });
          const marker = L.marker([h.latitude, h.longitude], { icon: hospIcon, zIndexOffset: 500 });
          marker.bindPopup(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:6px;min-width:170px;font-size:12px;line-height:1.4;">
              <strong style="color:#166534;font-size:13px;">🏥 ${h.name}</strong><br/>
              <span style="color:#4b5563;font-size:11px;">${h.address || "Emergency Hospital"}</span><br/>
              <div style="margin-top:4px;font-size:10px;font-weight:700;color:#047857;">
                Beds ready: ${h.availableEmergencyBeds ?? "—"}
                ${h.distanceKm !== undefined ? ` · ${h.distanceKm.toFixed(1)} km away` : ""}
              </div>
              ${h.contactPhone ? `<a href="tel:${h.contactPhone}" style="display:inline-block;margin-top:4px;color:#166534;font-weight:800;text-decoration:underline;">📞 Call ${h.contactPhone}</a>` : ""}
            </div>
          `);
          layer.addLayer(marker);
        });

        // 2. Shelter Pins
        (shelters || []).forEach((s) => {
          const shelterIcon = L.divIcon({
            className: "shelter-pin",
            html: `<div style="background:#1e40af;color:#fff;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:11px;cursor:pointer;">⛺</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 24],
          });
          const marker = L.marker([s.latitude, s.longitude], { icon: shelterIcon, zIndexOffset: 450 });
          marker.bindPopup(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:6px;min-width:160px;font-size:12px;line-height:1.4;">
              <strong style="color:#1e40af;font-size:13px;">⛺ ${s.name}</strong><br/>
              <span style="color:#4b5563;font-size:11px;">${s.address || "Relief Camp"}</span><br/>
              <div style="margin-top:4px;font-size:10px;font-weight:700;color:#1d4ed8;">
                Capacity: ${s.capacity ?? "—"} ${s.distanceKm !== undefined ? ` · ${s.distanceKm.toFixed(1)} km away` : ""}
              </div>
            </div>
          `);
          layer.addLayer(marker);
        });
      })();
    }
  }, [mapEngine, hospitals, shelters]);

  useEffect(() => {
    if (googleMapRef.current) {
      googleMapRef.current.setCenter({ lat: initialCenter.lat, lng: initialCenter.lng });
      googleMapRef.current.setZoom(initialZoom);
      if (googleMarkerRef.current) {
        googleMarkerRef.current.setPosition({ lat: initialCenter.lat, lng: initialCenter.lng });
      }
    }
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([initialCenter.lat, initialCenter.lng], initialZoom);
    }
  }, [initialCenter.lat, initialCenter.lng, initialZoom]);

  return (
    <div
      ref={mapContainer}
      className={cn("relative w-full h-[500px] z-0 overflow-hidden", className)}
    >
      {showWeatherHeatmap && (
        <SafeErrorBoundary>
          <WeatherHeatmapConsumer onPoints={setWeatherPoints} />
        </SafeErrorBoundary>
      )}

      {/* Floating Recenter / Locate Button */}
      {onRecenter && (
        <button
          type="button"
          onClick={onRecenter}
          disabled={recenterLoading}
          aria-label="Recenter to my location"
          title="Recenter to my location"
          className="absolute bottom-4 right-4 z-[999] flex items-center gap-1.5 rounded-2xl bg-white/95 px-3.5 py-2.5 text-xs font-black text-[#174e46] shadow-lg shadow-black/15 ring-1 ring-black/10 backdrop-blur-md transition hover:bg-white active:scale-95 disabled:opacity-75 dark:bg-[#1a1a1c]/95 dark:text-[#7fd6bb] dark:ring-white/15"
        >
          {recenterLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin text-[#277b6b]" />
          ) : (
            <LocateFixed className="h-4 w-4 text-[#df3e43]" />
          )}
          <span>{recenterLoading ? "Locating…" : "Recenter"}</span>
        </button>
      )}

      {/* Floating Weather Risk Legend */}
      {showWeatherHeatmap && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-[999] flex items-center gap-2 rounded-xl bg-white/90 px-2.5 py-1.5 text-[9px] font-extrabold shadow-md backdrop-blur-md dark:bg-[#1a1a1c]/90">
          <span className="flex items-center gap-1 text-[#059669]">
            <span className="h-2 w-2 rounded-full bg-[#10b981]" /> Good
          </span>
          <span className="flex items-center gap-1 text-[#d97706]">
            <span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> Watch
          </span>
          <span className="flex items-center gap-1 text-[#dc2626]">
            <span className="h-2 w-2 rounded-full bg-[#ef4444]" /> High Risk
          </span>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 grid place-items-center bg-[#deebe7] p-6 text-center dark:bg-[#202023]">
          <div>
            <p className="font-semibold text-[#1d5148] dark:text-[#f4f4f5]">
              Map service is temporarily unavailable.
            </p>
            <p className="mt-1 text-sm text-[#54736c] dark:text-[#c4c4cc]">
              Enter coordinates manually.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

