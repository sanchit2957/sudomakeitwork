export const ASSAM_RIVER_GAUGE_SOURCE_URL = "https://nwdp.nwic.gov.in/dataset/6273c426-32f9-4fdf-b67f-e4e7a46d8554/resource/847f5630-f231-46c0-922d-0f2f379a5cb8/download/rwl_tel_hr_assam_999_2026_2030.csv";
export const ASSAM_RIVER_GAUGE_SOURCE_PAGE = "https://nwdp.nwic.gov.in/dataset/river-water-level-telemetry-hourly-assam-department";
export const CWC_ASSAM_GAUGE_FEED_URL = "https://assamflood.org/data/current.json";

type Observation = { stationName: string; riverName: string | null; latitude: number; longitude: number; observedAt: Date; levelMetres: number };
export type OfficialRiverGauge = { available: boolean; levelMetres: number | null; trend: "rising" | "falling" | "steady" | null; updatedAt: Date | null; stationName: string | null; riverName: string | null; distanceKm: number | null; sourceName: string; sourceUrl: string; message: string };

const MAX_STATION_DISTANCE_KM = 250;
const MAX_FRESHNESS_HOURS = 48;
const cache = { expiresAt: 0, csv: "" };
const cwcCache = { expiresAt: 0, payload: "" };

type CwcRelayGauge = { agency?: string; coordinates?: unknown; level_m?: unknown; observed_at?: unknown; river?: unknown; site_name?: unknown; source?: unknown; source_url?: unknown; state?: unknown; station_operational?: unknown; trend_cm_per_hr?: unknown };

function parseCsvLine(line: string) {
  const values: string[] = []; let current = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) { const character = line[index]; if (character === '"') { if (quoted && line[index + 1] === '"') { current += '"'; index += 1; } else quoted = !quoted; } else if (character === "," && !quoted) { values.push(current); current = ""; } else current += character; }
  values.push(current); return values;
}

function parseIndiaObservationTime(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 5, Number(minute) - 30));
}

function distanceKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLatitude = radians(latitudeB - latitudeA); const dLongitude = radians(longitudeB - longitudeA);
  const a = Math.sin(dLatitude / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(dLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function unavailable(message: string, isAssamContext = false): OfficialRiverGauge {
  return {
    available: false,
    levelMetres: null,
    trend: null,
    updatedAt: null,
    stationName: null,
    riverName: null,
    distanceKm: null,
    sourceName: isAssamContext ? "Assam Department telemetry via National Water Data Portal" : "",
    sourceUrl: isAssamContext ? ASSAM_RIVER_GAUGE_SOURCE_PAGE : "",
    message: isAssamContext ? message : "No nearby official flood gauge available",
  };
}

function unavailableCwcRelay(message: string, isAssamContext = false): OfficialRiverGauge {
  return {
    available: false,
    levelMetres: null,
    trend: null,
    updatedAt: null,
    stationName: null,
    riverName: null,
    distanceKm: null,
    sourceName: isAssamContext ? "Central Water Commission (via Axom Flood)" : "",
    sourceUrl: isAssamContext ? "https://ffs.india-water.gov.in/" : "",
    message: isAssamContext ? message : "No nearby official flood gauge available",
  };
}

export function isNorthEastRiverGaugeRegion(latitude: number, longitude: number): boolean {
  return latitude >= 23.0 && latitude <= 29.0 && longitude >= 88.0 && longitude <= 97.5;
}

export function selectOfficialAssamRiverGauge(csv: string, latitude: number, longitude: number, now = new Date()): OfficialRiverGauge {
  const isAssam = isNorthEastRiverGaugeRegion(latitude, longitude);
  const lines = csv.trim().split(/\r?\n/); if (lines.length < 2) return unavailable("Official Assam telemetry has no readable observations at the moment.", isAssam);
  const headers = parseCsvLine(lines[0]); const column = (name: string) => headers.indexOf(name);
  const stationColumn = column("Station"); const riverColumn = column("River"); const latitudeColumn = column("Latitude"); const longitudeColumn = column("Longitude"); const timeColumn = column("Data Acquisition Time"); const levelColumn = column("River Water Level Telemetry Hourly (meter)");
  if ([stationColumn, latitudeColumn, longitudeColumn, timeColumn, levelColumn].some(index => index < 0)) return unavailable("Official Assam telemetry format is temporarily unavailable.", isAssam);
  const observations: Observation[] = [];
  for (const line of lines.slice(1)) { const row = parseCsvLine(line); const observedAt = parseIndiaObservationTime(row[timeColumn] || ""); const rowLatitude = Number(row[latitudeColumn]); const rowLongitude = Number(row[longitudeColumn]); const levelMetres = Number(row[levelColumn]); if (!observedAt || !Number.isFinite(rowLatitude) || !Number.isFinite(rowLongitude) || !Number.isFinite(levelMetres)) continue; observations.push({ stationName: row[stationColumn] || "Unnamed Assam gauge", riverName: row[riverColumn] || null, latitude: rowLatitude, longitude: rowLongitude, observedAt, levelMetres }); }
  if (!observations.length) return unavailable("Official Assam telemetry has no usable observations at the moment.", isAssam);
  const stationDistances = new Map<string, number>();
  for (const observation of observations) stationDistances.set(observation.stationName, distanceKm(latitude, longitude, observation.latitude, observation.longitude));
  const nearestStation = Array.from(stationDistances.entries()).sort((a, b) => a[1] - b[1])[0];
  if (!nearestStation || nearestStation[1] > MAX_STATION_DISTANCE_KM) return unavailable("No nearby official flood gauge available", isAssam);
  const stationObservations = observations.filter(observation => observation.stationName === nearestStation[0]).sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());
  const latest = stationObservations[0]; const ageHours = (now.getTime() - latest.observedAt.getTime()) / 3_600_000;
  const comparison = stationObservations.find(observation => latest.observedAt.getTime() - observation.observedAt.getTime() >= 18 * 3_600_000) || stationObservations[stationObservations.length - 1];
  const change = latest.levelMetres - comparison.levelMetres; const trend: OfficialRiverGauge["trend"] = change > 0.02 ? "rising" : change < -0.02 ? "falling" : "steady";
  const base = { levelMetres: latest.levelMetres, trend, updatedAt: latest.observedAt, stationName: latest.stationName, riverName: latest.riverName, distanceKm: Math.round(nearestStation[1] * 10) / 10, sourceName: "Assam Department telemetry via National Water Data Portal", sourceUrl: ASSAM_RIVER_GAUGE_SOURCE_PAGE };
  if (ageHours > MAX_FRESHNESS_HOURS || ageHours < -2) return { available: false, ...base, message: `Latest official gauge reading is ${Math.max(0, Math.round(ageHours))} hours old and is not shown as live.` };
  return { available: true, ...base, message: `${latest.stationName}${latest.riverName ? ` · ${latest.riverName}` : ""} · ${trend}` };
}

export function selectCwcAssamRiverGauge(payload: string, latitude: number, longitude: number, now = new Date()): OfficialRiverGauge {
  const isAssam = isNorthEastRiverGaugeRegion(latitude, longitude);
  let parsed: { gauges?: unknown };
  try { parsed = JSON.parse(payload) as { gauges?: unknown }; } catch { return unavailableCwcRelay("Current CWC gauge data is temporarily unavailable.", isAssam); }
  if (!Array.isArray(parsed.gauges)) return unavailableCwcRelay("Current CWC gauge data has no readable observations at the moment.", isAssam);

  const observations = parsed.gauges.flatMap((candidate): Observation[] => {
    const gauge = candidate as CwcRelayGauge;
    const [candidateLongitude, candidateLatitude] = Array.isArray(gauge.coordinates) ? gauge.coordinates : [];
    const stationName = typeof gauge.site_name === "string" ? gauge.site_name.trim() : "";
    const riverName = typeof gauge.river === "string" && gauge.river.trim() ? gauge.river.trim() : null;
    const observedAt = typeof gauge.observed_at === "string" ? new Date(gauge.observed_at) : null;
    const levelMetres = Number(gauge.level_m);
    if (gauge.agency !== "Central Water Commission" || gauge.source !== "CWC FFS" || gauge.state !== "Assam" || gauge.station_operational !== true || !stationName || !observedAt || Number.isNaN(observedAt.getTime()) || !Number.isFinite(Number(candidateLatitude)) || !Number.isFinite(Number(candidateLongitude)) || !Number.isFinite(levelMetres)) return [];
    return [{ stationName, riverName, latitude: Number(candidateLatitude), longitude: Number(candidateLongitude), observedAt, levelMetres }];
  });
  if (!observations.length) return unavailableCwcRelay("Current CWC gauge data has no usable observations at the moment.", isAssam);

  const nearest = observations.map(observation => ({ observation, distance: distanceKm(latitude, longitude, observation.latitude, observation.longitude) })).sort((a, b) => a.distance - b.distance)[0];
  if (!nearest || nearest.distance > MAX_STATION_DISTANCE_KM) return unavailableCwcRelay("No nearby official flood gauge available", isAssam);
  const sourceGauge = parsed.gauges.find(candidate => {
    const gauge = candidate as CwcRelayGauge;
    return gauge.site_name === nearest.observation.stationName && gauge.river === nearest.observation.riverName;
  }) as CwcRelayGauge | undefined;
  const ageHours = (now.getTime() - nearest.observation.observedAt.getTime()) / 3_600_000;
  const trendRate = Number(sourceGauge?.trend_cm_per_hr);
  const trend: OfficialRiverGauge["trend"] = trendRate > 0.2 ? "rising" : trendRate < -0.2 ? "falling" : "steady";
  const base = { levelMetres: nearest.observation.levelMetres, trend, updatedAt: nearest.observation.observedAt, stationName: nearest.observation.stationName, riverName: nearest.observation.riverName, distanceKm: Math.round(nearest.distance * 10) / 10, sourceName: "Central Water Commission (via Axom Flood)", sourceUrl: typeof sourceGauge?.source_url === "string" && sourceGauge.source_url.startsWith("https://ffs.india-water.gov.in/") ? sourceGauge.source_url : "https://ffs.india-water.gov.in/" };
  if (ageHours > MAX_FRESHNESS_HOURS || ageHours < -2) return { available: false, ...base, message: `Latest CWC gauge reading is ${Math.max(0, Math.round(ageHours))} hours old and is not shown as live.` };
  return { available: true, ...base, message: `${nearest.observation.stationName}${nearest.observation.riverName ? ` · ${nearest.observation.riverName}` : ""} · ${trend} · CWC observation relayed by Axom Flood` };
}

export function resolveCwcRelayContentUrl(contentUrl: unknown): URL | null {
  if (typeof contentUrl !== "string") return null;
  const resolved = new URL(contentUrl, "https://assamflood.org/");
  return resolved.origin === "https://assamflood.org" && resolved.pathname.startsWith("/data/") ? resolved : null;
}

async function getCurrentCwcAssamRiverGauge(latitude: number, longitude: number, now: Date): Promise<OfficialRiverGauge> {
  const isAssam = isNorthEastRiverGaugeRegion(latitude, longitude);
  try {
    if (Date.now() >= cwcCache.expiresAt) {
      const indexResponse = await fetch(CWC_ASSAM_GAUGE_FEED_URL, { signal: AbortSignal.timeout(8_000), headers: { accept: "application/json" } });
      if (!indexResponse.ok) throw new Error(`CWC relay index responded ${indexResponse.status}`);
      const index = await indexResponse.json() as { content_url?: unknown };
      const contentUrl = resolveCwcRelayContentUrl(index.content_url);
      if (!contentUrl) throw new Error("CWC relay payload URL is invalid");
      const contentResponse = await fetch(contentUrl, { signal: AbortSignal.timeout(8_000), headers: { accept: "application/json" } });
      if (!contentResponse.ok) throw new Error(`CWC relay content responded ${contentResponse.status}`);
      cwcCache.payload = await contentResponse.text();
      cwcCache.expiresAt = Date.now() + 5 * 60_000;
    }
    return selectCwcAssamRiverGauge(cwcCache.payload, latitude, longitude, now);
  } catch { return unavailableCwcRelay("Current CWC gauge data is temporarily unavailable.", isAssam); }
}

export async function getOfficialAssamRiverGauge(latitude: number, longitude: number, now = new Date()): Promise<OfficialRiverGauge> {
  const isAssam = isNorthEastRiverGaugeRegion(latitude, longitude);
  if (!isAssam) {
    return unavailable("No nearby official flood gauge available", false);
  }

  let primary: OfficialRiverGauge;
  try {
    if (Date.now() >= cache.expiresAt) {
      const response = await fetch(ASSAM_RIVER_GAUGE_SOURCE_URL, { signal: AbortSignal.timeout(8_000), headers: { accept: "text/csv" } });
      if (!response.ok) throw new Error(`Gauge source responded ${response.status}`);
      cache.csv = await response.text();
      cache.expiresAt = Date.now() + 15 * 60_000;
    }
    primary = selectOfficialAssamRiverGauge(cache.csv, latitude, longitude, now);
  } catch {
    primary = unavailable("Official Assam gauge data is temporarily unavailable.", isAssam);
  }
  if (primary.available) return primary;
  const currentCwcGauge = await getCurrentCwcAssamRiverGauge(latitude, longitude, now);
  return currentCwcGauge.available ? currentCwcGauge : primary;
}
