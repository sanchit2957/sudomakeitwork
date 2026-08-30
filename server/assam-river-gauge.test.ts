import { describe, expect, it } from "vitest";
import { resolveCwcRelayContentUrl, selectCwcAssamRiverGauge, selectOfficialAssamRiverGauge } from "./assam-river-gauge";

const csv = `SlNo,Station,Agency,State LGD Code,State,District LGD Code,District,Tehsil,Block,Village,River,Basin,Tributary,Subtributary,SubSubtributary,Local River,Latitude,Longitude,Is_DischargeDataAvailable,RL_of_zeroGauge,MeanSeaLevel,Data Acquisition Time,River Water Level Telemetry Hourly (meter)\n1,Nearby gauge,Assam,18,Assam,1,TEST,-,-,-,Brahmaputra,-,-,-,-,-,26.14,91.73,No,0,0,22-08-2026 04:00,60.100\n2,Nearby gauge,Assam,18,Assam,1,TEST,-,-,-,Brahmaputra,-,-,-,-,-,26.14,91.73,No,0,0,22-08-2026 23:00,60.180\n3,Far gauge,Assam,18,Assam,2,TEST,-,-,-,Other,-,-,-,-,-,27.8,95.7,No,0,0,22-08-2026 23:00,22.000`;

describe("official Assam river gauge selection", () => {
  it("selects the nearest fresh official station and derives its rising trend", () => {
    const gauge = selectOfficialAssamRiverGauge(csv, 26.1445, 91.7362, new Date("2026-08-22T19:00:00.000Z"));
    expect(gauge.available).toBe(true);
    expect(gauge.stationName).toBe("Nearby gauge");
    expect(gauge.levelMetres).toBe(60.18);
    expect(gauge.trend).toBe("rising");
  });

  it("does not label an old official value as live", () => {
    const gauge = selectOfficialAssamRiverGauge(csv, 26.1445, 91.7362, new Date("2026-08-27T19:00:00.000Z"));
    expect(gauge.available).toBe(false);
    expect(gauge.message).toContain("not shown as live");
  });

  it("selects a fresh nearby CWC observation relayed with transparent attribution when the NWDP data is stale", () => {
    const relayPayload = JSON.stringify({ gauges: [
      { agency: "Central Water Commission", source: "CWC FFS", state: "Assam", station_operational: true, site_name: "Dibrugarh", river: "Brahmaputra", coordinates: [94.9, 27.47], level_m: 104.82, observed_at: "2026-08-22T16:30:00+05:30", trend_cm_per_hr: 0, source_url: "https://ffs.india-water.gov.in/#/station/010-UBDDIB" },
      { agency: "Central Water Commission", source: "CWC FFS", state: "Assam", station_operational: true, site_name: "Far station", river: "Other", coordinates: [92.1, 24.6], level_m: 22.14, observed_at: "2026-08-22T21:00:00+05:30", trend_cm_per_hr: -3.75, source_url: "https://ffs.india-water.gov.in/#/station/017-MBDghy" },
    ] });
    const gauge = selectCwcAssamRiverGauge(relayPayload, 27.46, 94.92, new Date("2026-08-22T13:00:00.000Z"));
    expect(gauge).toMatchObject({ available: true, stationName: "Dibrugarh", riverName: "Brahmaputra", levelMetres: 104.82, trend: "steady", sourceName: "Central Water Commission (via Axom Flood)", sourceUrl: "https://ffs.india-water.gov.in/#/station/010-UBDDIB" });
  });

  it("does not label an old CWC-relayed value as live", () => {
    const relayPayload = JSON.stringify({ gauges: [{ agency: "Central Water Commission", source: "CWC FFS", state: "Assam", station_operational: true, site_name: "Dibrugarh", river: "Brahmaputra", coordinates: [94.9, 27.47], level_m: 104.82, observed_at: "2026-08-22T16:30:00+05:30", trend_cm_per_hr: 0, source_url: "https://ffs.india-water.gov.in/#/station/010-UBDDIB" }] });
    const gauge = selectCwcAssamRiverGauge(relayPayload, 27.46, 94.92, new Date("2026-08-27T13:00:00.000Z"));
    expect(gauge.available).toBe(false);
    expect(gauge.message).toContain("not shown as live");
  });

  it("resolves the current-feed content URL from the Assam Flood origin without duplicating the data path", () => {
    expect(resolveCwcRelayContentUrl("data/content-current.json")?.href).toBe("https://assamflood.org/data/content-current.json");
    expect(resolveCwcRelayContentUrl("https://untrusted.example/data/content.json")).toBeNull();
  });
});
