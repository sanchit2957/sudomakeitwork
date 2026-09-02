/**
 * PAN-INDIA GEOGRAPHIC & METEOROLOGICAL GRID
 * Bounded regional sampling points across India for real-time weather risk heatmap.
 */

export type IndiaPoint = { lat: number; lng: number };

export const INDIA_CENTER: IndiaPoint = { lat: 20.5937, lng: 78.9629 };
export const INDIA_DEFAULT_ZOOM = 5;

export const INDIA_MAP_BOUNDS = {
  north: 37.6,
  south: 6.5,
  east: 97.4,
  west: 68.1,
  minLat: 6.5,
  maxLat: 37.6,
  minLng: 68.1,
  maxLng: 97.4,
} as const;

export type WeatherRiskLevel = "good" | "moderate" | "critical" | "unknown";

export type WeatherRiskPoint = {
  id: string;
  name: string;
  state: string;
  region: "North" | "South" | "East" | "West" | "Central" | "North-East" | "Islands";
  latitude: number;
  longitude: number;
  riskLevel: WeatherRiskLevel;
  riskScore: number; // 0.00 to 1.00
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidityPercent: number | null;
  precipitationMm: number | null;
  rainChancePercent: number | null;
  windSpeedKmh: number | null;
  windGustsKmh: number | null;
  condition: string;
  weatherCode: number | null;
  aqiUs: number | null;
  aqiCategory?: string;
  activeAlertsCount: number;
  alertSummary?: string;
  updatedAt: string;
};

export type MeteorologicalHub = {
  id: string;
  name: string;
  state: string;
  region: "North" | "South" | "East" | "West" | "Central" | "North-East" | "Islands";
  latitude: number;
  longitude: number;
};

/**
 * 26 strategically selected meteorological hubs representing all climate and disaster zones in India.
 * Ensures complete India-wide coverage with bounded API requests and server-side cache reuse.
 */
export const PAN_INDIA_WEATHER_HUBS: MeteorologicalHub[] = [
  // North & Himalayan Belts
  { id: "delhi", name: "New Delhi", state: "Delhi NCR", region: "North", latitude: 28.6139, longitude: 77.2090 },
  { id: "srinagar", name: "Srinagar", state: "Jammu & Kashmir", region: "North", latitude: 34.0837, longitude: 74.7973 },
  { id: "shimla", name: "Shimla", state: "Himachal Pradesh", region: "North", latitude: 31.1048, longitude: 77.1734 },
  { id: "dehradun", name: "Dehradun", state: "Uttarakhand", region: "North", latitude: 30.3165, longitude: 78.0322 },
  { id: "lucknow", name: "Lucknow", state: "Uttar Pradesh", region: "North", latitude: 26.8467, longitude: 80.9462 },
  { id: "jaipur", name: "Jaipur", state: "Rajasthan", region: "North", latitude: 26.9124, longitude: 75.7873 },

  // East & Gangetic Delta
  { id: "patna", name: "Patna", state: "Bihar", region: "East", latitude: 25.5941, longitude: 85.1376 },
  { id: "kolkata", name: "Kolkata", state: "West Bengal", region: "East", latitude: 22.5726, longitude: 88.3639 },
  { id: "bhubaneswar", name: "Bhubaneswar", state: "Odisha", region: "East", latitude: 20.2961, longitude: 85.8245 },
  { id: "ranchi", name: "Ranchi", state: "Jharkhand", region: "East", latitude: 23.3441, longitude: 85.3096 },

  // North-East & Brahmaputra Basin
  { id: "guwahati", name: "Guwahati", state: "Assam", region: "North-East", latitude: 26.1445, longitude: 91.7362 },
  { id: "dibrugarh", name: "Dibrugarh", state: "Assam", region: "North-East", latitude: 27.4728, longitude: 94.9120 },
  { id: "silchar", name: "Silchar", state: "Assam", region: "North-East", latitude: 24.8333, longitude: 92.7789 },
  { id: "agartala", name: "Agartala", state: "Tripura", region: "North-East", latitude: 23.8315, longitude: 91.2868 },
  { id: "shillong", name: "Shillong", state: "Meghalaya", region: "North-East", latitude: 25.5788, longitude: 91.8933 },

  // Central India
  { id: "bhopal", name: "Bhopal", state: "Madhya Pradesh", region: "Central", latitude: 23.2599, longitude: 77.4126 },
  { id: "nagpur", name: "Nagpur", state: "Maharashtra", region: "Central", latitude: 21.1458, longitude: 79.0882 },
  { id: "raipur", name: "Raipur", state: "Chhattisgarh", region: "Central", latitude: 21.2514, longitude: 81.6296 },

  // West & Coastal Konkan
  { id: "mumbai", name: "Mumbai", state: "Maharashtra", region: "West", latitude: 19.0760, longitude: 72.8777 },
  { id: "ahmedabad", name: "Ahmedabad", state: "Gujarat", region: "West", latitude: 23.0225, longitude: 72.5714 },
  { id: "pune", name: "Pune", state: "Maharashtra", region: "West", latitude: 18.5204, longitude: 73.8567 },

  // South & Coastal Coromandel / Malabar
  { id: "bengaluru", name: "Bengaluru", state: "Karnataka", region: "South", latitude: 12.9716, longitude: 77.5946 },
  { id: "hyderabad", name: "Hyderabad", state: "Telangana", region: "South", latitude: 17.3850, longitude: 78.4867 },
  { id: "chennai", name: "Chennai", state: "Tamil Nadu", region: "South", latitude: 13.0827, longitude: 80.2707 },
  { id: "kochi", name: "Kochi", state: "Kerala", region: "South", latitude: 9.9312, longitude: 76.2673 },
  { id: "visakhapatnam", name: "Visakhapatnam", state: "Andhra Pradesh", region: "South", latitude: 17.6868, longitude: 83.2185 },
];

export const POPULAR_INDIAN_LOCATIONS = PAN_INDIA_WEATHER_HUBS.map((h) => ({
  name: `${h.name} (${h.state})`,
  lat: h.latitude,
  lng: h.longitude,
  region: h.region,
}));
