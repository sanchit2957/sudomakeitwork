import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import { _memoryUsers, getDatabasePoolMetrics, getRoleCodeVersion } from "../db";
import { _memoryIncidents, _memoryMissions, _memoryHospitals, _memoryRescueProfiles } from "../rescue.db";
import { weatherProviderManager } from "../weather.service";

type UserSim = {
  id: number;
  openId: string;
  name: string;
  email: string;
  role: "user" | "rescuer" | "hospital" | "admin";
  codeVersion?: number;
};

const adminUser: UserSim = { id: 1, openId: "user-admin", name: "Superadmin", email: "admin@assamrescue.gov.in", role: "admin" };
const rescuerUser: UserSim = { id: 2, openId: "user-rescuer", name: "Captain Hazarika", email: "rescuer@assamrescue.gov.in", role: "rescuer", codeVersion: 1 };
const hospitalUser: UserSim = { id: 3, openId: "user-hospital", name: "Dr. B. Borooah Staff", email: "hospital@assamrescue.gov.in", role: "hospital", codeVersion: 1 };
const citizenUser: UserSim = { id: 4, openId: "user-citizen", name: "Anamika Das", email: "citizen@assamrescue.gov.in", role: "user" };

function createTestCaller(user: UserSim | null) {
  return appRouter.createCaller({
    req: {
      headers: {
        authorization: user ? `Bearer mock-token-${user.id}` : undefined,
      },
    } as any,
    res: {} as any,
    user: user as any,
  });
}

function calculatePercentiles(durations: number[]) {
  if (!durations.length) return { p50: 0, p95: 0, p99: 0 };
  const sorted = [...durations].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return { p50: Math.round(p50 * 10) / 10, p95: Math.round(p95 * 10) / 10, p99: Math.round(p99 * 10) / 10 };
}

describe("PHASE 10 — Production Load Test & Memory Forensics", () => {
  it("executes simulated 5, 10, 25, 50 user concurrency tests across all 9 critical disaster workflows", async () => {
    vi.spyOn(weatherProviderManager, "getWeather").mockResolvedValue({
      available: true,
      provider: "Open-Meteo High-Resolution Ensemble",
      location: { latitude: 26.1445, longitude: 91.7362 },
      updatedAt: new Date().toISOString(),
      current: {
        temperatureC: 28,
        feelsLikeC: 30,
        humidityPercent: 75,
        pressureHpa: 1010,
        windKmh: 12,
        windDirectionDeg: 180,
        windGustsKmh: 18,
        visibilityKm: 10,
        cloudCoverPercent: 40,
        precipitationMm: 0,
        rainMm: 0,
        weatherCode: 2,
        condition: "Partly cloudy",
        category: "cloudy",
        icon: "cloud",
        uvIndex: 5,
      },
      forecast: {
        rainChance: 20,
        rainAmountMm: 2,
        hourly24h: [],
        days7: [],
      },
      trend: {
        source: "Model",
        pastDays7: [],
      },
      alerts: [],
      floodRisk: {
        riskLevel: "normal",
        title: "Normal conditions",
        summary: "No immediate flood danger.",
        precipitation24hMm: 5,
        precipitationProbabilityMax: 20,
        riverDischargeM3s: 1500,
        riverDischargeTrend: "steady",
        activeFloodZonesCount: 0,
        riverGauge: null,
      },
      airQuality: {
        aqiUs: 45,
        category: "Good",
        pm25: 12,
        pm10: 25,
        nitrogenDioxide: 10,
        ozone: 30,
        sulphurDioxide: 5,
        carbonMonoxide: 200,
      },
      river: null,
      source: {
        provider: "Open-Meteo",
        tier: "primary",
        fetchedAt: new Date().toISOString(),
        isCached: true,
        latencyMs: 1,
      },
    });
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          current: { temperature_2m: 28, precipitation: 0, weather_code: 2, wind_speed_10m: 10 },
          daily: {
            temperature_2m_max: [30],
            temperature_2m_min: [24],
            precipitation_probability_max: [10],
            precipitation_sum: [0],
            weather_code: [2],
            wind_speed_10m_max: [15],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    try {
      const memorySnapshots: Array<{ step: string; rssMb: number; heapMb: number }> = [];
      const recordMem = (step: string) => {
        const m = process.memoryUsage();
        memorySnapshots.push({
          step,
          rssMb: Math.round((m.rss / (1024 * 1024)) * 10) / 10,
          heapMb: Math.round((m.heapUsed / (1024 * 1024)) * 10) / 10,
        });
      };

      recordMem("Baseline Initial");

      const tiers = [5, 10, 25, 50];
      const results: Record<number, any> = {};

      for (const concurrency of tiers) {
        const durations: number[] = [];
        let successes = 0;
        let failures = 0;
        const startTime = performance.now();

        // Run parallel workflows for simulated users
        const tasks = Array.from({ length: concurrency }).map(async (_, idx) => {
          const userType = idx % 4;
          const caller =
            userType === 0
              ? createTestCaller(citizenUser)
              : userType === 1
              ? createTestCaller(rescuerUser)
              : userType === 2
              ? createTestCaller(hospitalUser)
              : createTestCaller(adminUser);

          try {
            // 1. Weather conditions / health check
            const t0 = performance.now();
            await caller.rescue.emergency.conditions({});
            durations.push(performance.now() - t0);
            successes++;

            // 2. Citizen Rapid SOS creation & tracking
            if (userType === 0) {
              const t1 = performance.now();
              const sos = await caller.rescue.emergency.create({
                latitude: 26.1445 + idx * 0.001,
                longitude: 91.7362 + idx * 0.001,
                emergencyType: "flood",
                severity: "high",
                peopleAffected: 2,
                locationLabel: `Disaster Zone ${idx + 1}`,
              });
              durations.push(performance.now() - t1);
              successes++;

              const t2 = performance.now();
              await caller.rescue.emergency.statusByCode({ publicCode: sos.publicCode });
              durations.push(performance.now() - t2);
              successes++;
            }

            // 3. Rescuer Missions & Notifications polling
            if (userType === 1) {
              const t1 = performance.now();
              await caller.rescue.rescuer.missions();
              durations.push(performance.now() - t1);
              successes++;

              const t2 = performance.now();
              await caller.rescue.rescuer.notifications();
              durations.push(performance.now() - t2);
              successes++;
            }

            // 4. Hospital Capacity & Cases polling
            if (userType === 2) {
              const t1 = performance.now();
              await caller.rescue.operations.myHospital();
              durations.push(performance.now() - t1);
              successes++;

              const t2 = performance.now();
              await caller.rescue.operations.hospitalCases();
              durations.push(performance.now() - t2);
              successes++;
            }

            // 5. Admin Incident Board & Analytics
            if (userType === 3) {
              const t1 = performance.now();
              await caller.rescue.operations.incidents({});
              durations.push(performance.now() - t1);
              successes++;

              const t2 = performance.now();
              await caller.rescue.operations.analytics();
              durations.push(performance.now() - t2);
              successes++;
            }
          } catch (err: any) {
            failures++;
          }
        });

        await Promise.all(tasks);

        const totalTimeMs = performance.now() - startTime;
        const totalRequests = successes + failures;
        const percentiles = calculatePercentiles(durations);

        recordMem(`After ${concurrency} Users Load`);

        results[concurrency] = {
          concurrency,
          totalRequests,
          successes,
          failures,
          successRate: `${((successes / totalRequests) * 100).toFixed(1)}%`,
          totalTimeMs: Math.round(totalTimeMs),
          requestsPerSec: Math.round((totalRequests / (totalTimeMs / 1000)) * 10) / 10,
          p50Ms: percentiles.p50,
          p95Ms: percentiles.p95,
          p99Ms: percentiles.p99,
        };

        expect(failures).toBe(0);
        expect(percentiles.p95).toBeLessThan(150); // Under 150ms p95 locally
      }

      console.log("\n=======================================================");
      console.log("📊 FORENSIC AUDIT — LOAD TEST RESULTS TABLE");
      console.log("=======================================================");
      console.table(results);

      console.log("\n📈 MEMORY PROFILE TABLE");
      console.table(memorySnapshots);

      // Verify memory stabilized and did not experience runaway growth
      const initialHeap = memorySnapshots[0].heapMb;
      const finalHeap = memorySnapshots[memorySnapshots.length - 1].heapMb;
      const heapGrowth = finalHeap - initialHeap;

      console.log(`\n💡 Total Heap Delta across all 4 tiers (5->10->25->50): ${heapGrowth.toFixed(1)} MB`);
      expect(heapGrowth).toBeLessThan(50); // Memory growth is bounded & stable
    } finally {
      global.fetch = originalFetch;
    }
  }, 45000);
});
