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
      type Polygon = any;
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

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map | any) => void;
  onLeafletReady?: (map: any) => void;
  onMapError?: () => void;
  onPickLocation?: (point: { lat: number; lng: number }) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 26.2006, lng: 92.9376 },
  initialZoom = 12,
  onMapReady,
  onLeafletReady,
  onMapError,
  onPickLocation,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkerRef = useRef<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [mapEngine, setMapEngine] = useState<"google" | "leaflet" | "none">("none");

  useEffect(() => {
    if (!mapContainer.current) return;
    let isMounted = true;

    // Fast path: Synchronous Google Maps initialization if already present on window
    if (typeof window !== "undefined" && (window as any).google?.maps?.Map) {
      try {
        const gMaps = (window as any).google.maps;
        const map = new gMaps.Map(mapContainer.current, {
          zoom: initialZoom,
          center: { lat: initialCenter.lat, lng: initialCenter.lng },
          mapTypeControl: true,
          fullscreenControl: true,
          zoomControl: true,
          streetViewControl: false,
        });

        googleMapRef.current = map;
        setMapEngine("google");

        if (gMaps.Marker) {
          const marker = new gMaps.Marker({
            position: { lat: initialCenter.lat, lng: initialCenter.lng },
            map,
            title: "Selected Location",
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

        return () => {
          if (googleMarkerRef.current?.setMap) {
            googleMarkerRef.current.setMap(null);
            googleMarkerRef.current = null;
          }
          googleMapRef.current = null;
        };
      } catch (err) {
        console.warn("[GoogleMap] Sync init error, falling back to Leaflet:", err);
      }
    }

    async function initMap() {
      // 1. Try loading and initializing Google Maps
      try {
        const gMaps = await loadGoogleMaps();
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
              animation: (window as any).google?.maps?.Animation?.DROP,
            });
            googleMarkerRef.current = marker;
          }

          // Handle click to pick location
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
        console.warn("[GoogleMaps] Init failed, falling back to Leaflet:", gErr);
      }

      // 2. Fallback: Initialize Leaflet
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

        const marker = L.marker([initialCenter.lat, initialCenter.lng]).addTo(lMap);

        if (onPickLocation) {
          lMap.on("click", (e: any) => {
            marker.setLatLng(e.latlng);
            onPickLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
          });
        }

        leafletMapRef.current = lMap;
        setMapEngine("leaflet");
        onLeafletReady?.(lMap);

        setTimeout(() => {
          if (isMounted) lMap.invalidateSize();
        }, 100);
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
      googleMapRef.current = null;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [initialZoom]);

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

