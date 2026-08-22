import { describe, expect, it } from "vitest";
import { selectOfficialAssamRiverGauge } from "./assam-river-gauge";

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
});
