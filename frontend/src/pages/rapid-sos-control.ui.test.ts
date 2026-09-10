import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createAndRedirectAfterRapidSos, redirectAfterRapidSos, rapidSosTrackingPath } from "@/lib/rapidSos";
import { RapidSosControl } from "./Home";

vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));

describe("rapid SOS activation controls", () => {
  it("shows a mandatory sign-in state before a victim can activate SOS", () => {
    const markup = renderToStaticMarkup(createElement(RapidSosControl, { authenticated: false, authLoading: false, status: "idle", notice: "", onActivate: () => undefined }));
    expect(markup).toContain("Sign in to activate");
    expect(markup).not.toContain("Tap for immediate help");
  });

  it("shows the explicit location-permission failure to an authenticated victim", () => {
    const markup = renderToStaticMarkup(createElement(RapidSosControl, { authenticated: true, authLoading: false, status: "error", notice: "Location permission is needed before SOS can be sent.", onActivate: () => undefined }));
    expect(markup).toContain("Tap for immediate help");
    expect(markup).toContain("Location permission is needed before SOS can be sent.");
    expect(markup).toContain('role="status"');
  });

  it("builds the private tracking redirect after rapid SOS creation", async () => {
    expect(rapidSosTrackingPath("SOS-ABCDEFGH")).toBe("/track?code=SOS-ABCDEFGH");
    expect(() => rapidSosTrackingPath("invalid")).toThrow("Invalid SOS tracking code.");
    const navigate = vi.fn();
    redirectAfterRapidSos("SOS-ABCDEFGH", navigate);
    expect(navigate).toHaveBeenCalledWith("/track?code=SOS-ABCDEFGH");
    const createSos = vi.fn().mockResolvedValue({ publicCode: "SOS-ABCDEFGH" });
    await createAndRedirectAfterRapidSos({ payload: { emergencyType: "flood" }, createSos, navigate });
    expect(createSos).toHaveBeenCalledWith({ emergencyType: "flood" });
    expect(navigate).toHaveBeenLastCalledWith("/track?code=SOS-ABCDEFGH");
  });
});
