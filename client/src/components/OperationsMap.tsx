import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, CloudRain, Eye, EyeOff, Hospital, Info, Layers, MapPin, Radio, ShieldCheck, TentTree, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadGoogleMaps, isGoogleMapsLoaded } from "@/lib/googleMaps";
import { trpc } from "@/lib/trpc";
import { INDIA_CENTER, type WeatherRiskPoint } from "@shared/india-locations";
import { getWeatherRiskPresentation } from "@/lib/weatherRisk";

type Point = { lat: number; lng: number };
export type OperationalLayers = {
  incidents: Array<{
    id: number;
    publicCode: string;
    locationLabel: string;
    latitude: number;
    longitude: number;
    severity: "critical" | "high" | "medium" | "low";
    status: string;
  }>;
  shelters: Array<{
    id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    status: string;
    capacity: number;
    occupancy: number;
  }>;
  hospitals: Array<{
    id: number;
    name: string;
    address: string;
    contactPhone?: string | null;
    specialty?: string;
    latitude: number;
    longitude: number;
    status: string;
    availableEmergencyBeds: number;
    totalEmergencyBeds: number;
    availableIcuBeds: number;
    totalIcuBeds: number;
  }>;
  floodZones: Array<{
    id: number;
    name: string;
    severity: "critical" | "high" | "medium" | "low";
    polygonJson: string;
  }>;
  rescuers: Array<{
    user: { id: number; name: string | null };
    profile: {
      callSign: string;
      lastLatitude: number | null;
      lastLongitude: number | null;
      availability: string;
    };
  }>;
};

const severityColor = {
  critical: "#c94b45",
  high: "#e8792e",
  medium: "#e7ae35",
  low: "#258e78",
};

const riskBadgeConfig = {
  critical: { bg: "#fee2e2", border: "#ef4444", text: "#991b1b", label: "Critical Risk", dot: "🔴" },
  moderate: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e", label: "Moderate Risk", dot: "🟠" },
  good: { bg: "#d1fae5", border: "#10b981", text: "#065f46", label: "Good / Low Risk", dot: "🟢" },
  unknown: { bg: "#f3f4f6", border: "#9ca3af", text: "#374151", label: "Unavailable", dot: "⚪" },
};

export default function OperationsMap({
  layers,
  onPickLocation,
  className,
  compact = false,
}: {
  layers?: OperationalLayers;
  onPickLocation?: (point: Point) => void;
  className?: string;
  compact?: boolean;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const googleMapRef = useRef<any>(null);
  const googleObjectsRef = useRef<any[]>([]);
  const googlePickMarkerRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const weatherLayerGroupRef = useRef<any>(null);
  const pickMarkerRef = useRef<any>(null);
  const [engine, setEngine] = useState<"google" | "leaflet" | "none">("none");
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(true);

  // Fetch live India-wide risk heatmap (server-cached, zero DB strain)
  const weatherRiskQuery = trpc.rescue.weather.riskHeatmap.useQuery(undefined, {
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const mapLayers = layers ?? {
    incidents: [],
    shelters: [],
    hospitals: [],
    floodZones: [],
    rescuers: [],
  };

  // Initialize Map (Google Maps preferred, Leaflet fallback)
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
              center: { lat: INDIA_CENTER.lat, lng: INDIA_CENTER.lng },
              zoom: compact ? 5 : 5,
              mapTypeControl: true,
              fullscreenControl: true,
              zoomControl: true,
              streetViewControl: false,
            });

            googleMapRef.current = map;
            setEngine("google");

            if (onPickLocation) {
              map.addListener("click", (e: any) => {
                if (e.latLng) {
                  const point = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                  if (googlePickMarkerRef.current) {
                    googlePickMarkerRef.current.setPosition(point);
                  } else {
                    googlePickMarkerRef.current = new (gMaps.Marker || (window as any).google.maps.Marker)({
                      position: point,
                      map,
                      title: "Selected Location",
                      animation: (window as any).google?.maps?.Animation?.DROP,
                    });
                  }
                  onPickLocation(point);
                }
              });
            }

            return;
          }
        } catch (err) {
          console.warn("[OperationsMap] Google Maps init error, falling back to Leaflet:", err);
        }
      }

      // 2. Primary / Default Engine: Zero-config Leaflet (100% free, no API key required)
      try {
        const L = (await import("leaflet")).default;
        if (!isMounted || !mapContainer.current) return;

        const map = L.map(mapContainer.current, {
          center: [INDIA_CENTER.lat, INDIA_CENTER.lng],
          zoom: compact ? 5 : 5,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          }
        ).addTo(map);

        const weatherLayerGroup = L.layerGroup().addTo(map);
        weatherLayerGroupRef.current = weatherLayerGroup;

        const layerGroup = L.layerGroup().addTo(map);
        layerGroupRef.current = layerGroup;
        leafletMapRef.current = map;
        setEngine("leaflet");

        if (onPickLocation) {
          map.on("click", (e: any) => {
            const point = { lat: e.latlng.lat, lng: e.latlng.lng };
            if (pickMarkerRef.current) {
              pickMarkerRef.current.setLatLng(e.latlng);
            } else {
              const pickIcon = L.divIcon({
                className: "custom-pick-pin",
                html: `<div style="background:#174e46;color:#fff;border-radius:50%;width:28px;height:28px;display:grid;place-items:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);border:2px solid #fff;font-size:14px;">📍</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 28],
              });
              pickMarkerRef.current = L.marker(e.latlng, { icon: pickIcon }).addTo(map);
            }
            onPickLocation(point);
          });
        }

        // Multi-stage invalidation to eliminate grey tile loading issues on mobile WebView
        const timers = [
          setTimeout(() => { if (isMounted) map.invalidateSize(); }, 50),
          setTimeout(() => { if (isMounted) map.invalidateSize(); }, 250),
          setTimeout(() => { if (isMounted) map.invalidateSize(); }, 750),
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
        console.error("[OperationsMap] Leaflet init error:", err);
      }
    }

    void initMap();

    return () => {
      isMounted = false;
      if (googlePickMarkerRef.current) {
        googlePickMarkerRef.current.setMap(null);
        googlePickMarkerRef.current = null;
      }
      googleObjectsRef.current.forEach((obj) => obj.setMap && obj.setMap(null));
      googleObjectsRef.current = [];
      googleMapRef.current = null;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [compact]);

  // Render Operational Layers + Weather Risk Heatmap
  useEffect(() => {
    if (engine === "none") return;

    const weatherPoints: WeatherRiskPoint[] = weatherRiskQuery.data?.points || [];

    // Helper HTML builder for Weather Risk Hub Popup
    const renderWeatherPopupHtml = (pt: WeatherRiskPoint) => {
      const badge = riskBadgeConfig[pt.riskLevel] || riskBadgeConfig.unknown;
      const rain = pt.precipitationMm !== null ? `${pt.precipitationMm} mm` : "0 mm";
      const rainChance = pt.rainChancePercent !== null ? `${pt.rainChancePercent}%` : "—";
      const wind = pt.windSpeedKmh !== null ? `${pt.windSpeedKmh} km/h` : "—";
      const temp = pt.temperatureC !== null ? `${pt.temperatureC}°C` : "—";
      const aqi = pt.aqiUs !== null ? `AQI ${pt.aqiUs} (${pt.aqiCategory || "Moderate"})` : "—";

      return `
        <div style="font-family:Inter,system-ui,sans-serif;padding:8px;min-width:210px;max-width:260px;color:#1e293b;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">
            <div>
              <div style="font-size:13px;font-weight:800;color:#0f172a;">${pt.name}</div>
              <div style="font-size:10px;font-weight:600;color:#64748b;">${pt.state} · ${pt.region} India</div>
            </div>
            <span style="display:inline-block;padding:3px 7px;border-radius:9999px;background:${badge.bg};color:${badge.text};border:1px solid ${badge.border};font-size:10px;font-weight:800;text-transform:uppercase;white-space:nowrap;">
              ${badge.dot} ${badge.label}
            </span>
          </div>
          
          <div style="margin-top:6px;font-size:11px;font-weight:700;color:#0f766e;">
            🌦️ ${pt.condition} (${temp})
          </div>

          <div style="margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;">
            <div style="background:#f1f5f9;padding:4px 6px;border-radius:6px;">
              <span style="color:#64748b;display:block;">Rain / Chance</span>
              <strong style="color:#0f172a;">${rain} · ${rainChance}</strong>
            </div>
            <div style="background:#f1f5f9;padding:4px 6px;border-radius:6px;">
              <span style="color:#64748b;display:block;">Wind Speed</span>
              <strong style="color:#0f172a;">${wind}</strong>
            </div>
          </div>

          <div style="margin-top:4px;background:#f8fafc;padding:4px 6px;border-radius:6px;font-size:10px;">
            <span style="color:#64748b;">Air Quality:</span> <strong style="color:#334155;">${aqi}</strong>
          </div>

          <div style="margin-top:6px;font-size:10px;line-height:1.3;color:#475569;background:#eff6ff;padding:4px 6px;border-radius:4px;border-left:3px solid #3b82f6;">
            ${pt.alertSummary || "Conditions live via Open-Meteo High-Resolution Ensemble."}
          </div>
        </div>
      `;
    };

    // ──────────────────────────────────────────
    // GOOGLE MAPS ENGINE
    // ──────────────────────────────────────────
    if (engine === "google" && googleMapRef.current) {
      const gMap = googleMapRef.current;
      const gMaps = (window as any).google?.maps;
      if (!gMaps) return;

      googleObjectsRef.current.forEach((obj) => obj.setMap && obj.setMap(null));
      googleObjectsRef.current = [];

      const infoWindow = new gMaps.InfoWindow();

      // A. Weather Risk Heatmap Circles (Bottom Layer)
      if (showWeatherOverlay && weatherPoints.length > 0) {
        weatherPoints.forEach((pt) => {
          const riskInfo = getWeatherRiskPresentation(pt.riskLevel);

          const circle = new gMaps.Circle({
            strokeColor: riskInfo.strokeColor,
            strokeOpacity: 0.6,
            strokeWeight: 1.5,
            fillColor: riskInfo.hexColor,
            fillOpacity: riskInfo.fillOpacity,
            map: gMap,
            center: { lat: pt.latitude, lng: pt.longitude },
            radius: 90000, // ~90km regional radius
          });

          circle.addListener("click", (e: any) => {
            infoWindow.setContent(renderWeatherPopupHtml(pt));
            infoWindow.setPosition(e.latLng);
            infoWindow.open(gMap);
          });

          googleObjectsRef.current.push(circle);
        });
      }

      // B. Flood Zones
      mapLayers.floodZones.forEach((zone) => {
        try {
          const paths = JSON.parse(zone.polygonJson) as Point[];
          const color = severityColor[zone.severity] || "#c94b45";
          const polygon = new gMaps.Polygon({
            paths,
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.25,
            map: gMap,
          });

          polygon.addListener("click", (e: any) => {
            infoWindow.setContent(`
              <div style="font-family:Inter,system-ui,sans-serif;padding:4px;">
                <strong style="color:${color};font-size:13px;">🌊 ${zone.name}</strong><br/>
                <span style="font-size:11px;text-transform:uppercase;font-weight:bold;">
                  Severity: ${zone.severity}
                </span>
              </div>
            `);
            infoWindow.setPosition(e.latLng);
            infoWindow.open(gMap);
          });

          googleObjectsRef.current.push(polygon);
        } catch {
          // Ignore invalid polygon JSON
        }
      });

      // C. Shelters
      mapLayers.shelters.forEach((shelter) => {
        const marker = new gMaps.Marker({
          position: { lat: shelter.latitude, lng: shelter.longitude },
          map: gMap,
          title: shelter.name,
        });

        marker.addListener("click", () => {
          infoWindow.setContent(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:4px;min-width:180px;">
              <strong style="color:#174e46;font-size:13px;">⛺ ${shelter.name}</strong><br/>
              <span style="font-size:11px;color:#666;">${shelter.address}</span><br/>
              <div style="margin-top:6px;font-size:11px;font-weight:600;">
                Occupancy: ${shelter.occupancy} / ${shelter.capacity || "—"} (${shelter.status.toUpperCase()})
              </div>
            </div>
          `);
          infoWindow.open(gMap, marker);
        });

        googleObjectsRef.current.push(marker);
      });

      // D. Hospitals
      mapLayers.hospitals.forEach((hospital) => {
        const marker = new gMaps.Marker({
          position: { lat: hospital.latitude, lng: hospital.longitude },
          map: gMap,
          title: hospital.name,
        });

        const totalBeds = hospital.totalEmergencyBeds + hospital.totalIcuBeds;
        const availableBeds = hospital.availableEmergencyBeds + hospital.availableIcuBeds;
        const occupiedBeds = totalBeds - availableBeds;
        const specialty = hospital.specialty || "Emergency Care";
        const contact = hospital.contactPhone || "+91 112";

        marker.addListener("click", () => {
          infoWindow.setContent(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:6px;min-width:240px;max-width:280px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:16px;">🏥</span>
                <strong style="color:#1d5148;font-size:13px;font-weight:800;">${hospital.name}</strong>
              </div>
              <div style="margin-top:4px;font-size:11px;color:#555;line-height:1.4;">📍 ${hospital.address}</div>
              <div style="margin-top:6px;padding:4px 6px;border-radius:6px;background:#f0f7f5;font-size:11px;color:#174e46;font-weight:600;">
                🩺 <strong>Specialty:</strong> ${specialty}
              </div>
              <div style="margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;">
                <div style="background:#e8f4f1;color:#19755f;padding:4px 6px;border-radius:4px;">
                  <div style="font-weight:bold;text-transform:uppercase;">Bed Capacity</div>
                  <div style="font-size:12px;font-weight:800;">${totalBeds} beds</div>
                  <div>ER: ${hospital.totalEmergencyBeds} · ICU: ${hospital.totalIcuBeds}</div>
                </div>
                <div style="background:#eaf2fb;color:#255c7d;padding:4px 6px;border-radius:4px;">
                  <div style="font-weight:bold;text-transform:uppercase;">Occupancy</div>
                  <div style="font-size:12px;font-weight:800;">${occupiedBeds} occupied</div>
                  <div>${availableBeds} available</div>
                </div>
              </div>
              <div style="margin-top:6px;font-size:11px;font-weight:bold;color:#1d5148;">
                📞 Contact: <a href="tel:${contact}" style="color:#0f766e;text-decoration:underline;">${contact}</a>
              </div>
            </div>
          `);
          infoWindow.open(gMap, marker);
        });

        googleObjectsRef.current.push(marker);
      });

      // E. Rescuers
      mapLayers.rescuers.forEach(({ user, profile }) => {
        if (profile.lastLatitude === null || profile.lastLongitude === null) return;
        const marker = new gMaps.Marker({
          position: { lat: profile.lastLatitude, lng: profile.lastLongitude },
          map: gMap,
          title: profile.callSign,
        });

        marker.addListener("click", () => {
          infoWindow.setContent(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:4px;">
              <strong style="color:#174e46;font-size:13px;">🛡️ ${profile.callSign}</strong><br/>
              <span style="font-size:11px;color:#666;">${user.name || "Field Team"}</span><br/>
              <span style="font-size:10px;font-weight:bold;text-transform:uppercase;color:#258e78;">
                ${profile.availability.replace("_", " ")}
              </span>
            </div>
          `);
          infoWindow.open(gMap, marker);
        });

        googleObjectsRef.current.push(marker);
      });

      // F. Incidents (Top Priority)
      mapLayers.incidents.forEach((incident) => {
        const color = severityColor[incident.severity] || "#c94b45";
        const marker = new gMaps.Marker({
          position: { lat: incident.latitude, lng: incident.longitude },
          map: gMap,
          title: incident.publicCode,
          zIndex: 9999,
        });

        marker.addListener("click", () => {
          infoWindow.setContent(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:4px;min-width:160px;">
              <strong style="color:${color};font-size:13px;">🚨 ${incident.publicCode}</strong><br/>
              <span style="font-size:12px;color:#333;">${incident.locationLabel}</span><br/>
              <span style="display:inline-block;margin-top:4px;padding:2px 6px;border-radius:4px;background:#f3f4f6;font-size:10px;font-weight:bold;text-transform:uppercase;">
                ${incident.status} · ${incident.severity}
              </span>
            </div>
          `);
          infoWindow.open(gMap, marker);
        });

        googleObjectsRef.current.push(marker);
      });

      return;
    }

    // ──────────────────────────────────────────
    // LEAFLET MAP ENGINE
    // ──────────────────────────────────────────
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        const layerGroup = layerGroupRef.current;
        const weatherLayerGroup = weatherLayerGroupRef.current;
        if (!layerGroup) return;

        layerGroup.clearLayers();
        if (weatherLayerGroup) weatherLayerGroup.clearLayers();

        // 1. Weather Risk Heatmap Overlay (Bottom Layer)
        if (showWeatherOverlay && weatherLayerGroup && weatherPoints.length > 0) {
          weatherPoints.forEach((pt) => {
            const riskInfo = getWeatherRiskPresentation(pt.riskLevel);

            const circle = L.circle([pt.latitude, pt.longitude], {
              radius: 95000, // 95km radius
              color: riskInfo.strokeColor,
              fillColor: riskInfo.hexColor,
              fillOpacity: riskInfo.fillOpacity,
              weight: 1.5,
            });

            circle.bindPopup(renderWeatherPopupHtml(pt));
            weatherLayerGroup.addLayer(circle);

            // Center subtle indicator dot
            const centerDot = L.circleMarker([pt.latitude, pt.longitude], {
              radius: 5,
              color: riskInfo.strokeColor,
              fillColor: "#ffffff",
              fillOpacity: 0.9,
              weight: 2,
            });
            centerDot.bindPopup(renderWeatherPopupHtml(pt));
            weatherLayerGroup.addLayer(centerDot);
          });
        }

        // 2. Flood Zones
        mapLayers.floodZones.forEach((zone) => {
          try {
            const paths = JSON.parse(zone.polygonJson) as Point[];
            const color = severityColor[zone.severity] || "#c94b45";
            const latLngs = paths.map((p) => [p.lat, p.lng] as [number, number]);

            const polygon = L.polygon(latLngs, {
              color,
              fillColor: color,
              fillOpacity: 0.2,
              weight: 2,
            });

            polygon.bindPopup(`
              <div style="font-family:Inter,system-ui,sans-serif;padding:4px;">
                <strong style="color:${color};">🌊 ${zone.name}</strong><br/>
                <span style="font-size:11px;text-transform:uppercase;font-weight:bold;">
                  Severity: ${zone.severity}
                </span>
              </div>
            `);

            layerGroup.addLayer(polygon);
          } catch {
            // Ignore invalid polygon JSON
          }
        });

        // 3. Shelters
        mapLayers.shelters.forEach((shelter) => {
          const icon = L.divIcon({
            className: "shelter-pin",
            html: `<div style="background:#258e78;color:#fff;border-radius:50%;width:26px;height:26px;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:12px;">⛺</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          const marker = L.marker([shelter.latitude, shelter.longitude], { icon, title: shelter.name });

          marker.bindPopup(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:4px;min-width:180px;">
              <strong style="color:#174e46;font-size:13px;">⛺ ${shelter.name}</strong><br/>
              <span style="font-size:11px;color:#666;">${shelter.address}</span><br/>
              <div style="margin-top:6px;font-size:11px;font-weight:600;">
                Occupancy: ${shelter.occupancy} / ${shelter.capacity || "—"} (${shelter.status.toUpperCase()})
              </div>
            </div>
          `);

          layerGroup.addLayer(marker);
        });

        // 4. Hospitals
        mapLayers.hospitals.forEach((hospital) => {
          const icon = L.divIcon({
            className: "hospital-pin",
            html: `<div style="background:#255c7d;color:#fff;border-radius:50%;width:28px;height:28px;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:13px;">🏥</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });

          const marker = L.marker([hospital.latitude, hospital.longitude], { icon, title: hospital.name });

          const totalBeds = hospital.totalEmergencyBeds + hospital.totalIcuBeds;
          const availableBeds = hospital.availableEmergencyBeds + hospital.availableIcuBeds;
          const occupiedBeds = totalBeds - availableBeds;
          const specialty = hospital.specialty || "Emergency Care";
          const contact = hospital.contactPhone || "+91 112";

          marker.bindPopup(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:6px;min-width:240px;max-width:280px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:16px;">🏥</span>
                <strong style="color:#1d5148;font-size:13px;font-weight:800;">${hospital.name}</strong>
              </div>
              <div style="margin-top:4px;font-size:11px;color:#555;line-height:1.4;">📍 ${hospital.address}</div>
              <div style="margin-top:6px;padding:4px 6px;border-radius:6px;background:#f0f7f5;font-size:11px;color:#174e46;font-weight:600;">
                🩺 <strong>Specialty:</strong> ${specialty}
              </div>
              <div style="margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;">
                <div style="background:#e8f4f1;color:#19755f;padding:4px 6px;border-radius:4px;">
                  <div style="font-weight:bold;text-transform:uppercase;">Bed Capacity</div>
                  <div style="font-size:12px;font-weight:800;">${totalBeds} beds</div>
                  <div>ER: ${hospital.totalEmergencyBeds} · ICU: ${hospital.totalIcuBeds}</div>
                </div>
                <div style="background:#eaf2fb;color:#255c7d;padding:4px 6px;border-radius:4px;">
                  <div style="font-weight:bold;text-transform:uppercase;">Occupancy</div>
                  <div style="font-size:12px;font-weight:800;">${occupiedBeds} occupied</div>
                  <div>${availableBeds} available</div>
                </div>
              </div>
              <div style="margin-top:6px;font-size:11px;font-weight:bold;color:#1d5148;">
                📞 Contact: <a href="tel:${contact}" style="color:#0f766e;text-decoration:underline;">${contact}</a>
              </div>
            </div>
          `);

          layerGroup.addLayer(marker);
        });

        // 5. Rescuers & Active Teams
        mapLayers.rescuers.forEach(({ user, profile }) => {
          if (profile.lastLatitude === null || profile.lastLongitude === null) return;

          const icon = L.divIcon({
            className: "rescuer-pin",
            html: `<div style="background:#174e46;color:#fff;border-radius:50%;width:26px;height:26px;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:12px;">🛡️</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          const marker = L.marker([profile.lastLatitude, profile.lastLongitude], {
            icon,
            title: profile.callSign,
          });

          marker.bindPopup(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:4px;">
              <strong style="color:#174e46;font-size:13px;">🛡️ ${profile.callSign}</strong><br/>
              <span style="font-size:11px;color:#666;">${user.name || "Field Team"}</span><br/>
              <span style="font-size:10px;font-weight:bold;text-transform:uppercase;color:#258e78;">
                ${profile.availability.replace("_", " ")}
              </span>
            </div>
          `);

          layerGroup.addLayer(marker);
        });

        // 6. Incidents (Top Priority)
        mapLayers.incidents.forEach((incident) => {
          const color = severityColor[incident.severity] || "#c94b45";
          const icon = L.divIcon({
            className: "incident-pin",
            html: `<div style="background:${color};color:#fff;border-radius:50%;width:30px;height:30px;display:grid;place-items:center;border:2.5px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.4);font-size:14px;z-index:9999;">🚨</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          });

          const marker = L.marker([incident.latitude, incident.longitude], {
            icon,
            title: incident.publicCode,
            zIndexOffset: 1000,
          });

          marker.bindPopup(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:4px;min-width:160px;">
              <strong style="color:${color};font-size:13px;">🚨 ${incident.publicCode}</strong><br/>
              <span style="font-size:12px;color:#333;">${incident.locationLabel}</span><br/>
              <span style="display:inline-block;margin-top:4px;padding:2px 6px;border-radius:4px;background:#f3f4f6;font-size:10px;font-weight:bold;text-transform:uppercase;">
                ${incident.status} · ${incident.severity}
              </span>
            </div>
          `);

          layerGroup.addLayer(marker);
        });
      } catch (err) {
        console.error("[OperationsMap] Layers render error:", err);
      }
    })();
  }, [
    engine,
    showWeatherOverlay,
    weatherRiskQuery.data,
    mapLayers.incidents,
    mapLayers.shelters,
    mapLayers.hospitals,
    mapLayers.rescuers,
    mapLayers.floodZones,
  ]);

  const riskCounts = weatherRiskQuery.data?.counts;

  return (
    <section
      className={cn(
        "map-shell relative overflow-hidden rounded-2xl border bg-[#dfeee9] dark:bg-[#202023] z-0",
        compact ? "h-[340px]" : "h-[540px]",
        className
      )}
    >
      <div ref={mapContainer} className="h-full w-full" />

      {/* Top Map Action Bar: Weather Heatmap Switch */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowWeatherOverlay((prev) => !prev)}
          className={cn(
            "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-md backdrop-blur transition-all",
            showWeatherOverlay
              ? "border-emerald-600 bg-emerald-700 text-white hover:bg-emerald-800"
              : "border-slate-300 bg-white/95 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200"
          )}
          title="Toggle Pan-India Weather Risk Heatmap"
        >
          {showWeatherOverlay ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          <span>Weather Risk Heatmap</span>
          {showWeatherOverlay && riskCounts && (
            <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">
              {riskCounts.critical > 0 ? `🚨 ${riskCounts.critical}` : `🟢 Normal`}
            </span>
          )}
        </button>
      </div>

      {/* Bottom Floating Legend & Map Controls */}
      <div className="pointer-events-auto absolute bottom-3 left-3 right-3 sm:right-auto z-[400] max-w-sm rounded-2xl border border-white/80 bg-white/95 p-3 text-[11px] shadow-xl backdrop-blur dark:border-[#46464e] dark:bg-[#1a1a1c]/95 dark:text-[#f4f4f5]">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
          <span className="font-extrabold text-[#134e44] dark:text-[#2dd4bf] uppercase tracking-wider text-[10px] flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Pan-India Operating Picture
          </span>
          <span className="text-[9px] font-semibold text-slate-500">Live Telemetry</span>
        </div>

        {/* Weather Heatmap Legend (When Active) */}
        {showWeatherOverlay && (
          <div className="pt-2 pb-1 border-b border-slate-100 dark:border-slate-800/60">
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Environmental Risk Classification:</span>
              <span className="text-[9px] font-normal text-slate-400">Open-Meteo</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-bold text-center">
              <div className="rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-1 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                🟢 Good / Low
              </div>
              <div className="rounded-lg bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-1 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                🟠 Moderate
              </div>
              <div className="rounded-lg bg-rose-50 text-rose-800 border border-rose-300 px-1.5 py-1 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                🔴 Critical
              </div>
            </div>
          </div>
        )}

        {/* Operational Symbols Legend */}
        {!compact && (
          <div className="pt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-[#c94b45]" /> SOS Incidents
            </span>
            <span className="flex items-center gap-1.5">
              <TentTree className="h-3.5 w-3.5 text-[#258e78]" /> Relief Shelters
            </span>
            <span className="flex items-center gap-1.5">
              <Hospital className="h-3.5 w-3.5 text-[#255c7d]" /> Hospital Beds
            </span>
            <span className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-[#174e46]" /> Rescue Units
            </span>
          </div>
        )}

        {onPickLocation && (
          <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-1.5 font-semibold text-primary text-[10px] dark:border-slate-800">
            <MapPin className="h-3 w-3" /> Click any point to select coordinates
          </div>
        )}
      </div>
    </section>
  );
}
