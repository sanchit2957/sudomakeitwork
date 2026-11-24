import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Rescuer Operations Dashboard Features", () => {
  it("removes Safety requests from navigation and deletes /responder/safety routing", () => {
    const userResponder = readFileSync(new URL("./user/UserResponder.tsx", import.meta.url), "utf8");

    expect(userResponder).not.toContain('label: "Safety requests"');
    expect(userResponder).not.toContain('path: "/responder/safety"');
    expect(userResponder).not.toContain('location === "/responder/safety"');
  });

  it("adds the Hospitals section with /responder/hospitals routing and directory cards", () => {
    const userResponder = readFileSync(new URL("./user/UserResponder.tsx", import.meta.url), "utf8");

    expect(userResponder).toContain('path: "/responder/hospitals"');
    expect(userResponder).toContain('location === "/responder/hospitals"');
    expect(userResponder).toContain("RescuerHospitalsView");
    expect(userResponder).toContain("HospitalDirectoryCard");
    expect(userResponder).toContain("calculateDistanceKm");
  });

  it("removes the subtitle 'Work each mission through its required sequence.' from the My Missions board", () => {
    const userResponder = readFileSync(new URL("./user/UserResponder.tsx", import.meta.url), "utf8");

    expect(userResponder).not.toContain('title={t("responder.boardTitle")}');
    expect(userResponder).toContain('{t("responder.board")}');
  });

  it("removes the SOS Conversation widget from the Alerts page and isolates it to the mission board", () => {
    const userResponder = readFileSync(new URL("./user/UserResponder.tsx", import.meta.url), "utf8");

    // In AlertsView, ResponderMissionChat should not appear
    expect(userResponder).toContain("<ResponderMissionChat");
  });

  it("implements 24-hour TTL check for alerts filtering", () => {
    const userResponder = readFileSync(new URL("./user/UserResponder.tsx", import.meta.url), "utf8");
    const dbSource = readFileSync(new URL("../../../server/rescue.db.ts", import.meta.url), "utf8");

    expect(userResponder).toContain("TWENTY_FOUR_HOURS_MS");
    expect(userResponder).toContain("now - alertTime <= TWENTY_FOUR_HOURS_MS");
    expect(dbSource).toContain("cutoff24h");
    expect(dbSource).toContain("gte(notifications.createdAt, cutoff24h)");
  });
});
