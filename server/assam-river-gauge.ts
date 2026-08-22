export const ASSAM_RIVER_GAUGE_SOURCE_URL = "https://nwdp.nwic.gov.in/dataset/6273c426-32f9-4fdf-b67f-e4e7a46d8554/resource/847f5630-f231-46c0-922d-0f2f379a5cb8/download/rwl_tel_hr_assam_999_2026_2030.csv";
export const ASSAM_RIVER_GAUGE_SOURCE_PAGE = "https://nwdp.nwic.gov.in/dataset/river-water-level-telemetry-hourly-assam-department";

type Observation = { stationName: string; riverName: string | null; latitude: number; longitude: number; observedAt: Date; levelMetres: number };
export type OfficialRiverGauge = { available: boolean; levelMetres: number | null; trend: "rising" | "falling" | "steady" | null; updatedAt: Date | null; stationName: string | null; riverName: string | null; distanceKm: number | null; sourceName: string; sourceUrl: string; message: string };

const MAX_STATION_DISTANCE_KM = 250;
const MAX_FRESHNESS_HOURS = 48;
const cache = { expiresAt: 0, csv: "" };

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

function unavailable(message: string): OfficialRiverGauge {
  return { available: false, levelMetres: null, trend: null, updatedAt: null, stationName: null, riverName: null, distanceKm: null, sourceName: "Assam Department telemetry via National Water Data Portal", sourceUrl: ASSAM_RIVER_GAUGE_SOURCE_PAGE, message };
}

export function selectOfficialAssamRiverGauge(csv: string, latitude: number, longitude: number, now = new Date()): OfficialRiverGauge {
  const lines = csv.trim().split(/\r?\n/); if (lines.length < 2) return unavailable("Official Assam telemetry has no readable observations at the moment.");
  const headers = parseCsvLine(lines[0]); const column = (name: string) => headers.indexOf(name);
  const stationColumn = column("Station"); const riverColumn = column("River"); const latitudeColumn = column("Latitude"); const longitudeColumn = column("Longitude"); const timeColumn = column("Data Acquisition Time"); const levelColumn = column("River Water Level Telemetry Hourly (meter)");
  if ([stationColumn, latitudeColumn, longitudeColumn, timeColumn, levelColumn].some(index => index < 0)) return unavailable("Official Assam telemetry format is temporarily unavailable.");
  const observations: Observation[] = [];
  for (const line of lines.slice(1)) { const row = parseCsvLine(line); const observedAt = parseIndiaObservationTime(row[timeColumn] || ""); const rowLatitude = Number(row[latitudeColumn]); const rowLongitude = Number(row[longitudeColumn]); const levelMetres = Number(row[levelColumn]); if (!observedAt || !Number.isFinite(rowLatitude) || !Number.isFinite(rowLongitude) || !Number.isFinite(levelMetres)) continue; observations.push({ stationName: row[stationColumn] || "Unnamed Assam gauge", riverName: row[riverColumn] || null, latitude: rowLatitude, longitude: rowLongitude, observedAt, levelMetres }); }
  if (!observations.length) return unavailable("Official Assam telemetry has no usable observations at the moment.");
  const stationDistances = new Map<string, number>();
  for (const observation of observations) stationDistances.set(observation.stationName, distanceKm(latitude, longitude, observation.latitude, observation.longitude));
  const nearestStation = Array.from(stationDistances.entries()).sort((a, b) => a[1] - b[1])[0]; if (!nearestStation || nearestStation[1] > MAX_STATION_DISTANCE_KM) return unavailable("No official Assam gauge is available near this location.");
  const stationObservations = observations.filter(observation => observation.stationName === nearestStation[0]).sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());
  const latest = stationObservations[0]; const ageHours = (now.getTime() - latest.observedAt.getTime()) / 3_600_000;
  const comparison = stationObservations.find(observation => latest.observedAt.getTime() - observation.observedAt.getTime() >= 18 * 3_600_000) || stationObservations[stationObservations.length - 1];
  const change = latest.levelMetres - comparison.levelMetres; const trend: OfficialRiverGauge["trend"] = change > 0.02 ? "rising" : change < -0.02 ? "falling" : "steady";
  const base = { levelMetres: latest.levelMetres, trend, updatedAt: latest.observedAt, stationName: latest.stationName, riverName: latest.riverName, distanceKm: Math.round(nearestStation[1] * 10) / 10, sourceName: "Assam Department telemetry via National Water Data Portal", sourceUrl: ASSAM_RIVER_GAUGE_SOURCE_PAGE };
  if (ageHours > MAX_FRESHNESS_HOURS || ageHours < -2) return { available: false, ...base, message: `Latest official gauge reading is ${Math.max(0, Math.round(ageHours))} hours old and is not shown as live.` };
  return { available: true, ...base, message: `${latest.stationName}${latest.riverName ? ` · ${latest.riverName}` : ""} · ${trend}` };
}

export async function getOfficialAssamRiverGauge(latitude: number, longitude: number, now = new Date()): Promise<OfficialRiverGauge> {
  try { if (Date.now() >= cache.expiresAt) { const response = await fetch(ASSAM_RIVER_GAUGE_SOURCE_URL, { signal: AbortSignal.timeout(8_000), headers: { accept: "text/csv" } }); if (!response.ok) throw new Error(`Gauge source responded ${response.status}`); cache.csv = await response.text(); cache.expiresAt = Date.now() + 15 * 60_000; } return selectOfficialAssamRiverGauge(cache.csv, latitude, longitude, now); }
  catch { return unavailable("Official Assam gauge data is temporarily unavailable."); }
}
