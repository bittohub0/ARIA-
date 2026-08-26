import React, { useState, useEffect, useCallback } from "react";
import { 
  X, 
  Sun, 
  Moon, 
  Cloud, 
  CloudRain, 
  CloudSun, 
  CloudMoon, 
  CloudLightning, 
  CloudSnow, 
  CloudFog, 
  Wind, 
  Droplets, 
  Search, 
  RefreshCw, 
  MapPin, 
  Thermometer,
  Compass,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Gauge,
  Navigation,
  ShieldCheck,
  AlertCircle,
  LocateFixed,
  ChevronRight
} from "lucide-react";
import { useMiraStore } from "../../store/useMiraStore";
import { getGeolocationPermissionState, GeolocationPermissionState } from "../../lib/geolocationService";

interface WeatherWidgetProps {
  onClose: () => void;
}

interface WeatherData {
  city: string;
  country: string;
  temp: number; // in Celsius
  feelsLike: number; // in Celsius
  tempMin: number;
  tempMax: number;
  humidity: number;
  windSpeed: number; // in km/h
  windDirection: number;
  weatherCode: number;
  condition: string;
  isDay: boolean;
  uvIndex: number;
  pressure: number;
  hourly: Array<{
    time: string;
    temp: number;
    weatherCode: number;
    isDay: boolean;
  }>;
  daily: Array<{
    day: string;
    date: string;
    tempMin: number;
    tempMax: number;
    weatherCode: number;
  }>;
}

// Map WMO codes to conditions & descriptions
function getWeatherInfo(code: number, isDay: boolean = true): { label: string; icon: React.ReactNode } {
  switch (code) {
    case 0:
      return { 
        label: isDay ? "Clear Sky" : "Clear Night", 
        icon: isDay ? <Sun className="w-8 h-8 text-amber-400" /> : <Moon className="w-8 h-8 text-indigo-200" /> 
      };
    case 1:
    case 2:
      return { 
        label: isDay ? "Partly Cloudy" : "Partly Cloudy Night", 
        icon: isDay ? <CloudSun className="w-8 h-8 text-amber-300" /> : <CloudMoon className="w-8 h-8 text-indigo-300" /> 
      };
    case 3:
      return { label: "Overcast", icon: <Cloud className="w-8 h-8 text-slate-300" /> };
    case 45:
    case 48:
      return { label: "Foggy", icon: <CloudFog className="w-8 h-8 text-zinc-300" /> };
    case 51:
    case 53:
    case 55:
      return { label: "Light Drizzle", icon: <CloudRain className="w-8 h-8 text-cyan-300" /> };
    case 61:
    case 63:
    case 65:
      return { label: "Rainy", icon: <CloudRain className="w-8 h-8 text-blue-400" /> };
    case 71:
    case 73:
    case 75:
    case 77:
      return { label: "Snowy", icon: <CloudSnow className="w-8 h-8 text-cyan-100" /> };
    case 80:
    case 81:
    case 82:
      return { label: "Rain Showers", icon: <CloudRain className="w-8 h-8 text-sky-400" /> };
    case 95:
    case 96:
    case 99:
      return { label: "Thunderstorm", icon: <CloudLightning className="w-8 h-8 text-amber-400" /> };
    default:
      return { 
        label: "Fair Weather", 
        icon: isDay ? <Sun className="w-8 h-8 text-amber-400" /> : <Moon className="w-8 h-8 text-indigo-200" /> 
      };
  }
}

function getSmallWeatherIcon(code: number, isDay: boolean = true) {
  if (code === 0) return isDay ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-200" />;
  if (code === 1 || code === 2) return isDay ? <CloudSun className="w-4 h-4 text-amber-300" /> : <CloudMoon className="w-4 h-4 text-indigo-300" />;
  if (code === 3) return <Cloud className="w-4 h-4 text-slate-300" />;
  if (code >= 45 && code <= 48) return <CloudFog className="w-4 h-4 text-zinc-300" />;
  if (code >= 51 && code <= 65) return <CloudRain className="w-4 h-4 text-blue-400" />;
  if (code >= 71 && code <= 77) return <CloudSnow className="w-4 h-4 text-cyan-100" />;
  if (code >= 80 && code <= 82) return <CloudRain className="w-4 h-4 text-sky-400" />;
  if (code >= 95) return <CloudLightning className="w-4 h-4 text-amber-400" />;
  return <Sun className="w-4 h-4 text-amber-400" />;
}

// Convert wind direction in degrees to cardinal notation
function getWindDirection(deg: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(deg / 45) % 8;
  return directions[index] || "N";
}

const DEFAULT_WEATHER: WeatherData = {
  city: "New Delhi",
  country: "India",
  temp: 28,
  feelsLike: 29,
  tempMin: 22,
  tempMax: 32,
  humidity: 52,
  windSpeed: 14,
  windDirection: 310,
  weatherCode: 1,
  condition: "Mostly Clear",
  isDay: true,
  uvIndex: 5,
  pressure: 1012,
  hourly: [
    { time: "09:00", temp: 25, weatherCode: 1, isDay: true },
    { time: "12:00", temp: 29, weatherCode: 0, isDay: true },
    { time: "15:00", temp: 31, weatherCode: 1, isDay: true },
    { time: "18:00", temp: 28, weatherCode: 2, isDay: true },
    { time: "21:00", temp: 24, weatherCode: 0, isDay: false },
    { time: "00:00", temp: 22, weatherCode: 0, isDay: false }
  ],
  daily: [
    { day: "Today", date: "Aug 6", tempMin: 22, tempMax: 32, weatherCode: 1 },
    { day: "Thu", date: "Aug 7", tempMin: 23, tempMax: 33, weatherCode: 0 },
    { day: "Fri", date: "Aug 8", tempMin: 24, tempMax: 31, weatherCode: 2 },
    { day: "Sat", date: "Aug 9", tempMin: 22, tempMax: 30, weatherCode: 61 },
    { day: "Sun", date: "Aug 10", tempMin: 21, tempMax: 29, weatherCode: 1 }
  ]
};

const POPULAR_CITIES = [
  { name: "New Delhi", lat: 28.6139, lon: 77.2090, country: "India" },
  { name: "Mumbai", lat: 19.0760, lon: 72.8777, country: "India" },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946, country: "India" },
  { name: "London", lat: 51.5074, lon: -0.1278, country: "UK" },
  { name: "Tokyo", lat: 35.6762, lon: 139.6503, country: "Japan" },
  { name: "San Francisco", lat: 37.7749, lon: -122.4194, country: "USA" }
];

export default function WeatherWidget({ onClose }: WeatherWidgetProps) {
  const {
    userLocation,
    geolocationPermission,
    isLocating,
    locationPromptDismissed,
    requestDeviceLocation,
    dismissLocationPrompt,
    setGeolocationPermission
  } = useMiraStore();

  // Always default unit to Celsius (°C)
  const [unit, setUnit] = useState<"C" | "F">(() => {
    const saved = localStorage.getItem("mira_weather_unit");
    return saved === "F" ? "F" : "C";
  });

  const [weather, setWeatherData] = useState<WeatherData>(DEFAULT_WEATHER);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Array<{ name: string; country: string; admin1?: string; latitude: number; longitude: number }>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("Just now");
  const [isUsingGps, setIsUsingGps] = useState(false);

  // Save unit preference whenever changed
  const handleUnitToggle = (newUnit: "C" | "F") => {
    setUnit(newUnit);
    localStorage.setItem("mira_weather_unit", newUnit);
  };

  // Convert Celsius to current selected unit
  const formatTemp = (celsius: number): string => {
    if (unit === "F") {
      const f = Math.round((celsius * 9) / 5 + 32);
      return `${f}°F`;
    }
    return `${Math.round(celsius)}°C`;
  };

  // Fetch forecast data by coordinates
  const fetchForecast = useCallback(async (lat: number, lon: number, cityName: string, countryName: string, fromGps = false) => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsUsingGps(fromGps);

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&hourly=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto&forecast_days=6`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch meteorological data");
      
      const data = await res.json();
      const current = data.current;
      const daily = data.daily;
      const hourly = data.hourly;

      const weatherInfo = getWeatherInfo(current.weather_code, current.is_day === 1);

      // Parse next 6 hours of hourly forecast
      const now = new Date();
      const currentHourIndex = hourly.time.findIndex((t: string) => new Date(t).getHours() === now.getHours());
      const startIndex = currentHourIndex >= 0 ? currentHourIndex : 0;
      
      const hourlySlice = hourly.time.slice(startIndex, startIndex + 6).map((timeStr: string, idx: number) => {
        const d = new Date(timeStr);
        const actualIdx = startIndex + idx;
        return {
          time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
          temp: hourly.temperature_2m[actualIdx],
          weatherCode: hourly.weather_code[actualIdx],
          isDay: hourly.is_day ? hourly.is_day[actualIdx] === 1 : true
        };
      });

      // Parse 5-day forecast
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dailyList = daily.time.slice(0, 5).map((timeStr: string, idx: number) => {
        const d = new Date(timeStr);
        const dayLabel = idx === 0 ? "Today" : dayNames[d.getDay()];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dateLabel = `${monthNames[d.getMonth()]} ${d.getDate()}`;

        return {
          day: dayLabel,
          date: dateLabel,
          tempMin: daily.temperature_2m_min[idx],
          tempMax: daily.temperature_2m_max[idx],
          weatherCode: daily.weather_code[idx]
        };
      });

      const parsed: WeatherData = {
        city: cityName,
        country: countryName,
        temp: current.temperature_2m,
        feelsLike: current.apparent_temperature,
        tempMin: daily.temperature_2m_min[0] ?? current.temperature_2m - 4,
        tempMax: daily.temperature_2m_max[0] ?? current.temperature_2m + 4,
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
        windDirection: current.wind_direction_10m,
        weatherCode: current.weather_code,
        condition: weatherInfo.label,
        isDay: current.is_day === 1,
        uvIndex: daily.uv_index_max ? Math.round(daily.uv_index_max[0]) : 4,
        pressure: Math.round(current.surface_pressure || 1013),
        hourly: hourlySlice.length > 0 ? hourlySlice : DEFAULT_WEATHER.hourly,
        daily: dailyList.length > 0 ? dailyList : DEFAULT_WEATHER.daily
      };

      setWeatherData(parsed);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err: any) {
      console.warn("[WeatherWidget] Live fetch error, showing cached/fallback:", err);
      setErrorMessage("Using cached readings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handler for explicit user geolocation request
  const handleEnableLocation = async () => {
    const loc = await requestDeviceLocation(true);
    if (loc) {
      fetchForecast(loc.latitude, loc.longitude, loc.city, loc.country, true);
    }
  };

  // Check initial permission and load either userLocation or default
  useEffect(() => {
    async function checkAndInit() {
      const permState = await getGeolocationPermissionState();
      setGeolocationPermission(permState);

      if (userLocation) {
        // We already have cached GPS location
        fetchForecast(userLocation.latitude, userLocation.longitude, userLocation.city, userLocation.country, true);
      } else if (permState === "granted") {
        // Permission was previously granted, quietly acquire
        const loc = await requestDeviceLocation(false);
        if (loc) {
          fetchForecast(loc.latitude, loc.longitude, loc.city, loc.country, true);
        } else {
          fetchForecast(28.6139, 77.2090, "New Delhi", "India", false);
        }
      } else {
        // Load default city
        fetchForecast(28.6139, 77.2090, "New Delhi", "India", false);
      }
    }

    checkAndInit();
  }, [fetchForecast, setGeolocationPermission, userLocation, requestDeviceLocation]);

  // Search cities via Geocoding API
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
      const res = await fetch(geoUrl);
      const data = await res.json();

      if (data.results && data.results.length > 0) {
        setSearchResults(data.results);
        setShowSearchResults(true);
      } else {
        setErrorMessage(`No location found for "${query}"`);
        setShowSearchResults(false);
      }
    } catch (err) {
      console.error("Geocoding search failed", err);
      setErrorMessage("Search failed. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const selectCity = (city: { name: string; country: string; admin1?: string; latitude: number; longitude: number }) => {
    const fullCountry = city.admin1 ? `${city.admin1}, ${city.country}` : city.country;
    fetchForecast(city.latitude, city.longitude, city.name, fullCountry, false);
    setShowSearchResults(false);
    setSearchQuery("");
  };

  const currentWeather = getWeatherInfo(weather.weatherCode, weather.isDay);

  // Check if we should display the permission request card
  const showPermissionBanner = !userLocation && geolocationPermission !== "granted" && !locationPromptDismissed;

  return (
    <div 
      id="mira-weather-widget" 
      className="bg-[#0b0c10]/95 border border-white/[0.08] backdrop-blur-[35px] rounded-[32px] w-[92vw] max-w-md shadow-[0_24px_60px_rgba(0,0,0,0.85)] relative text-white flex flex-col overflow-hidden max-h-[88vh]"
    >
      {/* Background ambient light */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[50%] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[50%] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04] z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
            <Sparkles className="w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wider font-mono text-cyan-300 uppercase leading-none">ARIA Weather Station</h3>
            <span className="text-[9px] text-zinc-400 font-mono tracking-widest mt-0.5 block leading-none">
              aria.meteorological_feed • {lastUpdated}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Unit Toggle: Celsius (°C) default & primary */}
          <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-xl p-0.5">
            <button
              onClick={() => handleUnitToggle("C")}
              className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg transition-all cursor-pointer ${
                unit === "C"
                  ? "bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Display in Celsius (°C)"
            >
              °C
            </button>
            <button
              onClick={() => handleUnitToggle("F")}
              className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg transition-all cursor-pointer ${
                unit === "F"
                  ? "bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Display in Fahrenheit (°F)"
            >
              °F
            </button>
          </div>

          <button 
            onClick={onClose} 
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer bg-white/[0.03] p-1.5 rounded-xl hover:bg-white/[0.06]"
            aria-label="Close Weather"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Container */}
      <div className="p-6 space-y-4 overflow-y-auto z-10 custom-scrollbar">
        
        {/* Device Geolocation Permission Request Flow Banner */}
        {showPermissionBanner && (
          <div 
            id="aria-geolocation-permission-card" 
            className="bg-gradient-to-br from-cyan-950/40 via-indigo-950/30 to-zinc-900/60 border border-cyan-500/30 rounded-2xl p-4 relative overflow-hidden shadow-[0_8px_24px_rgba(6,182,212,0.15)] animate-in fade-in duration-300"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-cyan-500/20 border border-cyan-400/30 rounded-xl shrink-0 text-cyan-300">
                <Navigation className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-cyan-200 uppercase font-mono tracking-wider">Enable Device Geolocation</h4>
                  <span className="text-[9px] bg-cyan-500/20 text-cyan-300 font-mono px-1.5 py-0.5 rounded-md">Hyper-Local</span>
                </div>
                <p className="text-[11px] text-zinc-300 mt-1 leading-relaxed">
                  Allow ARIA to access your device's GPS for hyper-local real-time weather, accurate temperature, UV alerts, and sunrise timing.
                </p>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={handleEnableLocation}
                    disabled={isLocating}
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-mono font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.35)] disabled:opacity-50"
                  >
                    {isLocating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Acquiring GPS...</span>
                      </>
                    ) : (
                      <>
                        <LocateFixed className="w-3.5 h-3.5" />
                        <span>Allow Exact Location</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={dismissLocationPrompt}
                    className="text-zinc-400 hover:text-zinc-200 text-xs font-mono px-2.5 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GPS Denied Warning Banner */}
        {geolocationPermission === "denied" && (
          <div className="bg-amber-950/25 border border-amber-500/25 rounded-2xl p-3 flex items-center justify-between gap-2 text-left">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-200">Device Location Access Blocked</p>
                <p className="text-[10px] text-zinc-400">Browser location permission is denied. Using selected city or search below.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEnableLocation}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-mono px-2.5 py-1.5 rounded-lg border border-amber-500/30 shrink-0 cursor-pointer"
            >
              Retry GPS
            </button>
          </div>
        )}

        {/* Search Bar & GPS Locate Button */}
        <form onSubmit={handleSearch} className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search city (e.g. Mumbai, London, Tokyo)..."
                className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.07] border border-white/[0.08] focus:border-cyan-500/50 rounded-2xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all font-sans"
              />
            </div>
            
            {/* Quick GPS Re-ping Button */}
            <button
              type="button"
              onClick={handleEnableLocation}
              disabled={isLocating}
              title="Use Precise Device GPS Location"
              className={`border font-mono text-xs px-3 py-2 rounded-2xl transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                isUsingGps 
                  ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
                  : "bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.08] text-zinc-300 hover:text-white"
              }`}
            >
              <LocateFixed className={`w-3.5 h-3.5 ${isLocating ? "animate-spin text-cyan-300" : ""}`} />
              <span className="hidden sm:inline">GPS</span>
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 font-mono text-xs px-3.5 py-2 rounded-2xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
            >
              {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Search"}
            </button>
          </div>

          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#12131a] border border-cyan-500/20 rounded-2xl shadow-2xl z-30 overflow-hidden">
              <div className="p-1">
                {searchResults.map((city, idx) => (
                  <button
                    key={`${city.name}-${idx}`}
                    type="button"
                    onClick={() => selectCity(city)}
                    className="w-full text-left px-3.5 py-2 hover:bg-cyan-500/10 rounded-xl transition-colors flex items-center justify-between text-xs cursor-pointer group"
                  >
                    <span className="font-medium text-zinc-200 group-hover:text-cyan-300">
                      {city.name} {city.admin1 ? `(${city.admin1})` : ""}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">{city.country}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Quick City Presets & My Location Pill */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {userLocation && (
            <button
              type="button"
              onClick={() => fetchForecast(userLocation.latitude, userLocation.longitude, userLocation.city, userLocation.country, true)}
              className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                isUsingGps
                  ? "bg-cyan-500/25 border-cyan-500/50 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.25)]"
                  : "bg-cyan-950/20 border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/20"
              }`}
            >
              <LocateFixed className="w-3 h-3 text-cyan-400" />
              <span>{userLocation.city}</span>
            </button>
          )}

          {POPULAR_CITIES.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => fetchForecast(c.lat, c.lon, c.name, c.country, false)}
              className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border whitespace-nowrap transition-all cursor-pointer ${
                !isUsingGps && weather.city === c.name
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                  : "bg-white/[0.02] border-white/[0.05] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {errorMessage && (
          <div className="text-[11px] text-amber-300 font-mono bg-amber-950/30 border border-amber-500/20 p-2 rounded-xl text-center">
            {errorMessage}
          </div>
        )}

        {/* Primary Hero Weather Card in Celsius */}
        <div className="bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/[0.06] rounded-3xl p-5 relative overflow-hidden">
          
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-sans flex-wrap">
                <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="font-semibold text-white text-sm">{weather.city}</span>
                {weather.country && <span className="text-zinc-500 text-xs">({weather.country})</span>}
                
                {isUsingGps && userLocation?.accuracyMeters && (
                  <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-md ml-1 flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    GPS ±{userLocation.accuracyMeters}m
                  </span>
                )}
              </div>
              <div className="text-xs text-cyan-300/80 font-mono mt-0.5 capitalize">
                {weather.condition}
              </div>
            </div>

            <div className="p-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl shadow-inner">
              {currentWeather.icon}
            </div>
          </div>

          {/* Main Temperature Display in Celsius */}
          <div className="my-3 flex items-baseline gap-3">
            <div className="text-5xl font-mono font-black tracking-tight text-white drop-shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              {formatTemp(weather.temp)}
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-zinc-400 font-mono">
                Feels like <span className="text-zinc-200 font-bold">{formatTemp(weather.feelsLike)}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                <span className="flex items-center text-rose-300">
                  <ArrowUp className="w-3 h-3 mr-0.5" />
                  {formatTemp(weather.tempMax)}
                </span>
                <span className="flex items-center text-cyan-300">
                  <ArrowDown className="w-3 h-3 mr-0.5" />
                  {formatTemp(weather.tempMin)}
                </span>
              </div>
            </div>
          </div>

          {/* Metric Stats Grid (Wind in km/h, Humidity, UV, Pressure) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-white/[0.05]">
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2 text-left">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                <Wind className="w-3 h-3 text-cyan-300" />
                <span>WIND</span>
              </div>
              <div className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
                {weather.windSpeed} km/h {getWindDirection(weather.windDirection)}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2 text-left">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                <Droplets className="w-3 h-3 text-blue-300" />
                <span>HUMIDITY</span>
              </div>
              <div className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
                {weather.humidity}%
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2 text-left">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                <Sun className="w-3 h-3 text-amber-300" />
                <span>UV INDEX</span>
              </div>
              <div className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
                {weather.uvIndex} • {weather.uvIndex <= 2 ? "Low" : weather.uvIndex <= 5 ? "Mod" : "High"}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2 text-left">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                <Gauge className="w-3 h-3 text-violet-300" />
                <span>PRESSURE</span>
              </div>
              <div className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
                {weather.pressure} hPa
              </div>
            </div>
          </div>
        </div>

        {/* 24-Hour Forecast in Celsius */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-1">
            <span className="text-zinc-400 font-bold uppercase tracking-wider">Hourly Forecast (°C)</span>
            <span className="text-[10px] text-cyan-400 font-mono">24H CYCLE</span>
          </div>

          <div className="grid grid-cols-6 gap-1.5">
            {weather.hourly.map((h, i) => (
              <div 
                key={`${h.time}-${i}`} 
                className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-2 flex flex-col items-center justify-center gap-1 text-center"
              >
                <span className="text-[10px] font-mono text-zinc-500">{h.time}</span>
                <div className="my-0.5">
                  {getSmallWeatherIcon(h.weatherCode, h.isDay)}
                </div>
                <span className="text-xs font-mono font-bold text-zinc-200">
                  {formatTemp(h.temp)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 5-Day Weekly Forecast in Celsius */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-1">
            <span className="text-zinc-400 font-bold uppercase tracking-wider">5-Day Outlook (°C)</span>
            <span className="text-[10px] text-indigo-400 font-mono">DAILY PROJECTIONS</span>
          </div>

          <div className="space-y-1.5">
            {weather.daily.map((d) => (
              <div 
                key={d.day}
                className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-3.5 py-2 flex items-center justify-between text-xs"
              >
                <div className="w-20 text-left">
                  <span className="font-bold text-zinc-200 block leading-tight">{d.day}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{d.date}</span>
                </div>

                <div className="flex items-center gap-2">
                  {getSmallWeatherIcon(d.weatherCode, true)}
                  <span className="text-[11px] text-zinc-400 font-mono w-24 truncate text-left hidden sm:inline">
                    {getWeatherInfo(d.weatherCode, true).label}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-cyan-300 font-medium">{formatTemp(d.tempMin)}</span>
                  <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden relative">
                    <div className="absolute inset-y-0 left-1 right-1 bg-gradient-to-r from-cyan-400 to-rose-400 rounded-full" />
                  </div>
                  <span className="text-rose-300 font-bold">{formatTemp(d.tempMax)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom AI Status Banner */}
        <div className="bg-cyan-950/20 border border-cyan-500/20 rounded-2xl p-2.5 text-center text-[10px] text-cyan-300 font-mono flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Celsius (°C) meteorological metrics synchronized with ARIA voice engine</span>
        </div>

      </div>
    </div>
  );
}
