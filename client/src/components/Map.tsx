/**
 * MAP FRONTEND INTEGRATION
 * Supports Leaflet (OpenStreetMap / CartoDB) out of the box with zero API keys,
 * and seamlessly falls back to Google Maps when configured.
 * 
 * Available Libraries and Core Features:
 * 📍 MARKER (from `marker` library)
 * 🏢 PLACES (from `places` library)
 * 🧭 GEOCODER (from `geocoding` library)
 * 📐 GEOMETRY (from `geometry` library)
 * 🛣️ ROUTES (from `routes` library)
 * 
 * libraries=marker,places,geocoding,geometry,routes
 */

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { cn } from "@/lib/utils";

declare global {
  namespace google {
    namespace maps {
      type Map = any;
      type LatLngLiteral = { lat: number; lng: number };
      namespace marker {
        type AdvancedMarkerElement = any;
        type PinElement = any;
      }
      type Polyline = any;
      type DirectionsService = any;
      type DirectionsRenderer = any;
      type TravelMode = any;
    }
  }
  interface Window {
    google?: any;
  }
}

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map | any) => void;
  onLeafletReady?: (map: any) => void;
  onMapError?: () => void;
}

export function MapView({
  className,
  initialCenter = { lat: 26.2006, lng: 92.9376 },
  initialZoom = 12,
  onMapReady,
  onLeafletReady,
  onMapError,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Check if Google Maps is present (e.g., in test mocks or with active script)
    if (typeof window !== "undefined" && (window as any).google?.maps?.Map) {
      try {
        const gMap = new (window as any).google.maps.Map(mapContainer.current, {
          zoom: initialZoom,
          center: initialCenter,
          mapTypeControl: true,
          fullscreenControl: true,
          zoomControl: true,
          streetViewControl: true,
          mapId: "DEMO_MAP_ID",
        });
        googleMapRef.current = gMap;
        onMapReady?.(gMap);
        return () => {
          googleMapRef.current = null;
        };
      } catch (err) {
        console.warn("[GoogleMap] Init error, falling back to Leaflet:", err);
      }
    }

    // Default: Initialize OpenStreetMap / CartoDB via Leaflet on the client
    if (typeof window === "undefined") return;

    let isMounted = true;
    (async () => {
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

        // CartoDB Voyager tiles (clean, high-res OpenStreetMap tiles)
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19,
            subdomains: "abcd",
          }
        ).addTo(lMap);

        leafletMapRef.current = lMap;
        onLeafletReady?.(lMap);

        setTimeout(() => {
          if (isMounted) lMap.invalidateSize();
        }, 100);
      } catch (err) {
        console.error("[Leaflet] Map init failed:", err);
        setLoadError(true);
        onMapError?.();
      }
    })();

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [initialZoom]);

  useEffect(() => {
    if (googleMapRef.current) {
      googleMapRef.current.setCenter(initialCenter);
      googleMapRef.current.setZoom(initialZoom);
    }
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([initialCenter.lat, initialCenter.lng], initialZoom);
    }
  }, [initialCenter.lat, initialCenter.lng, initialZoom]);

  return (
    <div
      ref={mapContainer}
      className={cn("relative w-full h-[500px] z-0", className)}
    >
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
