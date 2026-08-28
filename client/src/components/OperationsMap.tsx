import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Hospital, MapPin, Radio, TentTree } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadGoogleMaps, isGoogleMapsLoaded } from "@/lib/googleMaps";

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
  const pickMarkerRef = useRef<any>(null);
  const [engine, setEngine] = useState<"google" | "leaflet" | "none">("none");

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
      // 1. Try Google Maps first
      try {
        const gMaps = await loadGoogleMaps();
        if (!isMounted || !mapContainer.current) return;

        if (gMaps && gMaps.Map) {
          const map = new gMaps.Map(mapContainer.current, {
            center: { lat: 26.2006, lng: 92.9376 }, // Assam Center
            zoom: compact ? 7 : 8,
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

      // 2. Fallback to Leaflet
      try {
        const L = (await import("leaflet")).default;
        if (!isMounted || !mapContainer.current) return;

        const map = L.map(mapContainer.current, {
          center: [26.2006, 92.9376], // Assam Center
          zoom: compact ? 7 : 8,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19,
            subdomains: "abcd",
          }
        ).addTo(map);

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
      googleMapRef.current = null;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, [compact]);

  // Render Operational Layers on Google Maps or Leaflet
  useEffect(() => {
    // 1. Render on Google Maps
    if (engine === "google" && googleMapRef.current && (window as any).google?.maps) {
      const gMap = googleMapRef.current;
      const gMaps = (window as any).google.maps;

      // Clear previous Google Maps markers and polygons
      googleObjectsRef.current.forEach((obj) => obj.setMap?.(null));
      googleObjectsRef.current = [];

      const infoWindow = new gMaps.InfoWindow();

      // Incidents
      mapLayers.incidents.forEach((incident) => {
        const color = severityColor[incident.severity] || "#c94b45";
        const marker = new gMaps.Marker({
          position: { lat: incident.latitude, lng: incident.longitude },
          map: gMap,
          title: incident.publicCode,
        });

        marker.addListener("click", () => {
          infoWindow.setContent(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:4px;min-width:160px;">
              <strong style="color:${color};font-size:13px;">${incident.publicCode}</strong><br/>
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

      // Shelters
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

      // Hospitals
      mapLayers.hospitals.forEach((hospital) => {
        const marker = new gMaps.Marker({
          position: { lat: hospital.latitude, lng: hospital.longitude },
          map: gMap,
          title: hospital.name,
        });

        marker.addListener("click", () => {
          infoWindow.setContent(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:4px;min-width:190px;">
              <strong style="color:#1d5148;font-size:13px;">🏥 ${hospital.name}</strong><br/>
              <span style="font-size:11px;color:#666;">${hospital.address}</span>
              <div style="margin-top:6px;display:flex;gap:6px;font-size:11px;">
                <span style="background:#e8f4f1;color:#19755f;padding:2px 6px;border-radius:4px;font-weight:bold;">
                  ER ${hospital.availableEmergencyBeds}/${hospital.totalEmergencyBeds}
                </span>
                <span style="background:#eaf2fb;color:#255c7d;padding:2px 6px;border-radius:4px;font-weight:bold;">
                  ICU ${hospital.availableIcuBeds}/${hospital.totalIcuBeds}
                </span>
              </div>
            </div>
          `);
          infoWindow.open(gMap, marker);
        });

        googleObjectsRef.current.push(marker);
      });

      // Rescuers
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

      // Flood Zones
      mapLayers.floodZones.forEach((zone) => {
        try {
          const paths = JSON.parse(zone.polygonJson) as Point[];
          const color = severityColor[zone.severity] || "#c94b45";
          const polygon = new gMaps.Polygon({
            paths: paths.map((p) => ({ lat: p.lat, lng: p.lng })),
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
                <strong style="color:${color};">${zone.name}</strong><br/>
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

      return;
    }

    // 2. Render on Leaflet
    const layerGroup = layerGroupRef.current;
    if (!layerGroup) return;
    if (typeof window === "undefined") return;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        layerGroup.clearLayers();

        // 1. Incidents (SOS)
        mapLayers.incidents.forEach((incident) => {
          const color = severityColor[incident.severity] || "#c94b45";
          const icon = L.divIcon({
            className: "incident-pin",
            html: `<div style="background:${color};color:#fff;border-radius:50%;width:26px;height:26px;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:11px;font-weight:bold;">🚨</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          const marker = L.marker([incident.latitude, incident.longitude], {
            icon,
            title: incident.publicCode,
          });

          marker.bindPopup(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:4px;min-width:160px;">
              <strong style="color:${color};font-size:13px;">${incident.publicCode}</strong><br/>
              <span style="font-size:12px;color:#333;">${incident.locationLabel}</span><br/>
              <span style="display:inline-block;margin-top:4px;padding:2px 6px;border-radius:4px;background:#f3f4f6;font-size:10px;font-weight:bold;text-transform:uppercase;">
                ${incident.status} · ${incident.severity}
              </span>
            </div>
          `);

          layerGroup.addLayer(marker);
        });

        // 2. Relief Shelters
        mapLayers.shelters.forEach((shelter) => {
          const color = shelter.status === "open" ? "#258e78" : "#7d8f88";
          const icon = L.divIcon({
            className: "shelter-pin",
            html: `<div style="background:${color};color:#fff;border-radius:8px;width:26px;height:26px;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.25);font-size:12px;">⛺</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          const marker = L.marker([shelter.latitude, shelter.longitude], {
            icon,
            title: shelter.name,
          });

          marker.bindPopup(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:4px;min-width:180px;">
              <strong style="color:#174e46;font-size:13px;">${shelter.name}</strong><br/>
              <span style="font-size:11px;color:#666;">${shelter.address}</span><br/>
              <div style="margin-top:6px;font-size:11px;font-weight:600;">
                Occupancy: ${shelter.occupancy} / ${shelter.capacity || "—"} (${shelter.status.toUpperCase()})
              </div>
            </div>
          `);

          layerGroup.addLayer(marker);
        });

        // 3. Hospitals & Medical Resources
        mapLayers.hospitals.forEach((hospital) => {
          const color =
            hospital.status === "open"
              ? "#255c7d"
              : hospital.status === "limited"
              ? "#e7ae35"
              : hospital.status === "critical"
              ? "#c94b45"
              : "#7d8f88";

          const icon = L.divIcon({
            className: "hospital-pin",
            html: `<div style="background:${color};color:#fff;border-radius:8px;width:26px;height:26px;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.25);font-size:12px;">🏥</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          const marker = L.marker([hospital.latitude, hospital.longitude], {
            icon,
            title: hospital.name,
          });

          marker.bindPopup(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:4px;min-width:190px;">
              <strong style="color:#1d5148;font-size:13px;">${hospital.name}</strong><br/>
              <span style="font-size:11px;color:#666;">${hospital.address}</span>
              <div style="margin-top:6px;display:flex;gap:6px;font-size:11px;">
                <span style="background:#e8f4f1;color:#19755f;padding:2px 6px;border-radius:4px;font-weight:bold;">
                  ER ${hospital.availableEmergencyBeds}/${hospital.totalEmergencyBeds}
                </span>
                <span style="background:#eaf2fb;color:#255c7d;padding:2px 6px;border-radius:4px;font-weight:bold;">
                  ICU ${hospital.availableIcuBeds}/${hospital.totalIcuBeds}
                </span>
              </div>
            </div>
          `);

          layerGroup.addLayer(marker);
        });

        // 4. Rescuers & Active Teams
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
              <strong style="color:#174e46;font-size:13px;">${profile.callSign}</strong><br/>
              <span style="font-size:11px;color:#666;">${user.name || "Field Team"}</span><br/>
              <span style="font-size:10px;font-weight:bold;text-transform:uppercase;color:#258e78;">
                ${profile.availability.replace("_", " ")}
              </span>
            </div>
          `);

          layerGroup.addLayer(marker);
        });

        // 5. Flood Zones (Polygons)
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
                <strong style="color:${color};">${zone.name}</strong><br/>
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
      } catch (err) {
        console.error("[OperationsMap] Layers render error:", err);
      }
    })();
  }, [
    engine,
    mapLayers.incidents,
    mapLayers.shelters,
    mapLayers.hospitals,
    mapLayers.rescuers,
    mapLayers.floodZones,
  ]);

  return (
    <section
      className={cn(
        "map-shell relative overflow-hidden rounded-2xl border bg-[#dfeee9] dark:bg-[#202023] z-0",
        compact ? "h-[320px]" : "h-[520px]",
        className
      )}
    >
      <div ref={mapContainer} className="h-full w-full" />

      {!compact && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-[400] grid gap-1.5 rounded-xl border border-white/70 bg-white/90 p-3 text-[11px] shadow-lg backdrop-blur dark:border-[#46464e] dark:bg-[#1a1a1c]/95 dark:text-[#f4f4f5]">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-[#c94b45]" /> SOS severity
          </span>
          <span className="flex items-center gap-2">
            <TentTree className="h-3.5 w-3.5 text-[#258e78]" /> Relief shelter
          </span>
          <span className="flex items-center gap-2">
            <Hospital className="h-3.5 w-3.5 text-[#255c7d]" /> Medical resource
          </span>
          <span className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-[#255c7d]" /> Rescue team
          </span>
          {onPickLocation && (
            <span className="mt-1 flex items-center gap-2 border-t pt-2 font-semibold text-primary">
              <MapPin className="h-3.5 w-3.5" /> Click map to set a location
            </span>
          )}
        </div>
      )}
    </section>
  );
}

