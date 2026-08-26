/**
 * Geolocation & Local Context Service for ARIA
 * Handles device GPS permissions, precise coordinate retrieval, and reverse geocoding.
 */

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  city: string;
  region?: string;
  country: string;
  postalCode?: string;
  accuracyMeters?: number;
  source: "gps" | "ip" | "cached" | "default";
  timestamp: number;
}

export type GeolocationPermissionState = "prompt" | "granted" | "denied" | "unsupported";

const STORAGE_KEY = "aria_user_geolocation";
const PERM_DISMISSED_KEY = "aria_geo_prompt_dismissed";

export const DEFAULT_FALLBACK_LOCATION: DeviceLocation = {
  latitude: 28.6139,
  longitude: 77.2090,
  city: "New Delhi",
  region: "Delhi",
  country: "India",
  accuracyMeters: 5000,
  source: "default",
  timestamp: Date.now()
};

/**
 * Check current browser permission state for geolocation
 */
export async function getGeolocationPermissionState(): Promise<GeolocationPermissionState> {
  if (typeof window === "undefined" || !("navigator" in window) || !("geolocation" in navigator)) {
    return "unsupported";
  }

  try {
    if ("permissions" in navigator && typeof navigator.permissions.query === "function") {
      const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      return status.state as GeolocationPermissionState;
    }
  } catch (err) {
    // Some browsers do not support querying geolocation permission
  }

  // Fallback to cached state
  const cached = getCachedLocation();
  if (cached && cached.source === "gps") {
    return "granted";
  }

  return "prompt";
}

/**
 * Retrieve cached location from localStorage
 */
export function getCachedLocation(): DeviceLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
      return parsed;
    }
  } catch (e) {
    console.warn("[GeolocationService] Failed reading cached location", e);
  }
  return null;
}

/**
 * Save location to localStorage
 */
export function saveCachedLocation(loc: DeviceLocation): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch (e) {
    console.warn("[GeolocationService] Failed saving cached location", e);
  }
}

/**
 * Check if the user previously dismissed the location request banner
 */
export function isLocationPromptDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PERM_DISMISSED_KEY) === "true";
}

export function setLocationPromptDismissed(dismissed: boolean): void {
  if (typeof window === "undefined") return;
  if (dismissed) {
    localStorage.setItem(PERM_DISMISSED_KEY, "true");
  } else {
    localStorage.removeItem(PERM_DISMISSED_KEY);
  }
}

/**
 * Reverse geocode latitude & longitude into a human-friendly city and country
 */
export async function reverseGeocodeCoordinates(lat: number, lon: number): Promise<{ city: string; region: string; country: string; postalCode?: string }> {
  // 1. Try OpenStreetMap Nominatim
  try {
    const revUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12&addressdetails=1`;
    const res = await fetch(revUrl, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "ARIA-Assistant/1.0"
      }
    });

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.municipality || addr.village || addr.suburb || addr.state_district || addr.county || "Local Area";
      const region = addr.state || addr.province || addr.region || "";
      const country = addr.country || "Local";
      const postalCode = addr.postcode || "";

      return { city, region, country, postalCode };
    }
  } catch (err) {
    console.warn("[GeolocationService] Nominatim reverse geocode failed, trying fallback", err);
  }

  // 2. Open-Meteo elevation / geocoding fallback
  try {
    const fallbackUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${lat.toFixed(2)},${lon.toFixed(2)}&count=1&language=en&format=json`;
    const res = await fetch(fallbackUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        return {
          city: item.name || "Local Area",
          region: item.admin1 || "",
          country: item.country || "Local"
        };
      }
    }
  } catch (e) {
    // fallback
  }

  return {
    city: `Coordinates (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
    region: "",
    country: "Local Device"
  };
}

/**
 * Request device geolocation from the browser with explicit user interaction
 */
export function requestDeviceCoordinates(options?: { highAccuracy?: boolean; timeout?: number }): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("navigator" in window) || !("geolocation" in navigator)) {
      return reject(new Error("Geolocation is not supported by your browser."));
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy: options?.highAccuracy ?? true,
      timeout: options?.timeout ?? 10000,
      maximumAge: 60000 // Accept up to 1-minute cached GPS readings
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(err),
      geoOptions
    );
  });
}

/**
 * Execute full location acquisition flow: Prompt/Acquire GPS -> Reverse Geocode -> Save -> Return
 */
export async function acquirePreciseLocation(): Promise<DeviceLocation> {
  const position = await requestDeviceCoordinates({ highAccuracy: true, timeout: 12000 });
  const { latitude, longitude, accuracy } = position.coords;

  const geocoded = await reverseGeocodeCoordinates(latitude, longitude);

  const locationData: DeviceLocation = {
    latitude,
    longitude,
    city: geocoded.city,
    region: geocoded.region,
    country: geocoded.country,
    postalCode: geocoded.postalCode,
    accuracyMeters: Math.round(accuracy || 0),
    source: "gps",
    timestamp: Date.now()
  };

  saveCachedLocation(locationData);
  setLocationPromptDismissed(false);

  return locationData;
}
