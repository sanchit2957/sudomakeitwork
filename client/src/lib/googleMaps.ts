/**
 * Google Maps JavaScript API Loader
 * Supports dynamic asynchronous loading with custom API keys,
 * environment configuration (VITE_GOOGLE_MAPS_API_KEY), and fallback handling.
 */

let googleMapsPromise: Promise<any> | null = null;

export function getGoogleMapsApiKey(): string {
  if (typeof window !== "undefined") {
    const override = (window as any).__GOOGLE_MAPS_API_KEY__;
    if (typeof override === "string" && override.trim().length > 0) {
      return override.trim();
    }
  }
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (typeof envKey === "string" && envKey.trim().length > 0) {
    return envKey.trim();
  }
  return "";
}

export function isGoogleMapsLoaded(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).google?.maps?.Map);
}

export function loadGoogleMaps(apiKey?: string): Promise<any> {
  if (isGoogleMapsLoaded()) {
    return Promise.resolve((window as any).google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  const key = apiKey || getGoogleMapsApiKey();
  if (!key) {
    // No API key configured
    return Promise.resolve(null);
  }

  if (typeof document === "undefined") {
    return Promise.resolve(null);
  }

  googleMapsPromise = new Promise((resolve) => {
    const scriptId = "google-maps-script";
    const existingScript = document.getElementById(scriptId);

    if (existingScript) {
      if (isGoogleMapsLoaded()) {
        resolve((window as any).google.maps);
      } else {
        existingScript.addEventListener("load", () => {
          resolve((window as any).google?.maps || null);
        });
        existingScript.addEventListener("error", () => {
          resolve(null);
        });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.type = "text/javascript";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key
    )}&libraries=marker,places,geocoding,geometry,routes&loading=async`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (isGoogleMapsLoaded()) {
        resolve((window as any).google.maps);
      } else {
        resolve(null);
      }
    };

    script.onerror = () => {
      console.warn("[GoogleMaps] Failed to load Google Maps script. Falling back to alternative map provider.");
      resolve(null);
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
