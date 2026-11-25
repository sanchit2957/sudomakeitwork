/**
 * Spatial-Temporal SOS Clustering (DBSCAN)
 * Groups nearby distress signals within an epsilon radius and time window
 * into unified emergency event clusters to prevent duplicate rescue dispatch.
 */

export interface ClusterableIncident {
  id: number;
  publicCode: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  severity: "critical" | "high" | "medium" | "low";
  emergencyType: string;
  peopleAffected: number;
  status: string;
  createdAt: Date | string;
}

export interface IncidentCluster {
  clusterId: string;
  centroid: { latitude: number; longitude: number };
  radiusKm: number;
  incidentCount: number;
  totalPeopleAffected: number;
  highestSeverity: "critical" | "high" | "medium" | "low";
  primaryLocationLabel: string;
  emergencyTypes: string[];
  incidentIds: number[];
  publicCodes: string[];
  earliestAt: string;
  latestAt: string;
}

export interface ClusteringResult {
  clusters: IncidentCluster[];
  unclusteredIncidentIds: number[];
  totalInputIncidents: number;
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Runs DBSCAN spatial-temporal clustering on active SOS incidents.
 */
export function clusterIncidentsDBSCAN(
  incidents: ClusterableIncident[],
  options?: {
    epsilonKm?: number;
    minPoints?: number;
    maxWindowMinutes?: number;
  }
): ClusteringResult {
  const epsilonKm = options?.epsilonKm ?? 0.5; // 500 meters default
  const minPoints = options?.minPoints ?? 2;
  const maxWindowMs = (options?.maxWindowMinutes ?? 60) * 60_000;

  const valid = incidents.filter(
    (inc) =>
      Number.isFinite(inc.latitude) &&
      Number.isFinite(inc.longitude) &&
      inc.latitude !== 0 &&
      inc.longitude !== 0
  );

  const n = valid.length;
  const labels = new Array<number>(n).fill(-1); // -1 = unvisited, 0 = noise, >0 = clusterId
  let currentCluster = 0;

  const getNeighbors = (idx: number): number[] => {
    const target = valid[idx];
    const tTime = new Date(target.createdAt).getTime();
    const neighbors: number[] = [];
    for (let j = 0; j < n; j++) {
      const other = valid[j];
      const oTime = new Date(other.createdAt).getTime();
      if (Math.abs(tTime - oTime) > maxWindowMs) continue;
      if (haversineKm(target.latitude, target.longitude, other.latitude, other.longitude) <= epsilonKm) {
        neighbors.push(j);
      }
    }
    return neighbors;
  };

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue;
    const neighbors = getNeighbors(i);
    if (neighbors.length < minPoints) {
      labels[i] = 0; // noise / singleton
      continue;
    }

    currentCluster++;
    labels[i] = currentCluster;
    const seedQueue = [...neighbors.filter((idx) => idx !== i)];
    let qPos = 0;

    while (qPos < seedQueue.length) {
      const curr = seedQueue[qPos++];
      if (labels[curr] === 0) {
        labels[curr] = currentCluster;
      }
      if (labels[curr] !== -1) continue;
      labels[curr] = currentCluster;
      const currNeighbors = getNeighbors(curr);
      if (currNeighbors.length >= minPoints) {
        for (const nb of currNeighbors) {
          if (labels[nb] === -1 || labels[nb] === 0) {
            seedQueue.push(nb);
          }
        }
      }
    }
  }

  const clusterGroups = new Map<number, ClusterableIncident[]>();
  const unclusteredIncidentIds: number[] = [];

  for (let i = 0; i < n; i++) {
    if (labels[i] > 0) {
      const list = clusterGroups.get(labels[i]) || [];
      list.push(valid[i]);
      clusterGroups.set(labels[i], list);
    } else {
      unclusteredIncidentIds.push(valid[i].id);
    }
  }

  const clusters: IncidentCluster[] = [];
  for (const [cid, group] of Array.from(clusterGroups.entries())) {
    const centroidLat = group.reduce((s, x) => s + x.latitude, 0) / group.length;
    const centroidLng = group.reduce((s, x) => s + x.longitude, 0) / group.length;
    let maxDist = 0;
    let highestSev: "critical" | "high" | "medium" | "low" = "low";
    let totalPeople = 0;
    const types = new Set<string>();
    const times: number[] = [];

    for (const item of group) {
      const dist = haversineKm(centroidLat, centroidLng, item.latitude, item.longitude);
      if (dist > maxDist) maxDist = dist;
      if ((SEVERITY_RANK[item.severity] || 0) > (SEVERITY_RANK[highestSev] || 0)) {
        highestSev = item.severity;
      }
      totalPeople += item.peopleAffected || 1;
      types.add(item.emergencyType);
      times.push(new Date(item.createdAt).getTime());
    }

    clusters.push({
      clusterId: `CLU-${cid.toString().padStart(3, "0")}`,
      centroid: {
        latitude: Number(centroidLat.toFixed(6)),
        longitude: Number(centroidLng.toFixed(6)),
      },
      radiusKm: Number(Math.max(0.05, maxDist).toFixed(2)),
      incidentCount: group.length,
      totalPeopleAffected: totalPeople,
      highestSeverity: highestSev,
      primaryLocationLabel: group[0].locationLabel,
      emergencyTypes: Array.from(types),
      incidentIds: group.map((g) => g.id),
      publicCodes: group.map((g) => g.publicCode),
      earliestAt: new Date(Math.min(...times)).toISOString(),
      latestAt: new Date(Math.max(...times)).toISOString(),
    });
  }

  clusters.sort((a, b) => (SEVERITY_RANK[b.highestSeverity] - SEVERITY_RANK[a.highestSeverity]) || (b.incidentCount - a.incidentCount));

  return {
    clusters,
    unclusteredIncidentIds,
    totalInputIncidents: incidents.length,
  };
}
