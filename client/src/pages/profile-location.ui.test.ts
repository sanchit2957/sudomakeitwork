import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResponderProfileCard } from "./Responder";
import { AssignedRescuerCard } from "./Track";

vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));

const profile = { callSign: "Boat 4", phone: "+919999999999", photoUrl: null, contactSharing: "yes" as const, locationSharing: "no" as const };
const render = (element: ReactElement) => renderToStaticMarkup(element);

describe("assigned rescuer profile and location UI", () => {
  it("renders field-profile contact controls and explains automatic sharing before an active mission", () => {
    const markup = render(createElement(ResponderProfileCard, { profile, hasActiveMission: false, saving: false, onSave: () => undefined }));
    expect(markup).toContain("Assignment contact number");
    expect(markup).toContain("Show my phone number to my active assignment");
    expect(markup).toContain("Location sharing starts automatically when Command assigns you an active SOS mission.");
    expect(markup).not.toContain("Share live location");
    expect(markup).not.toContain("Stop sharing");
  });

  it("renders active-mission automatic sharing without a manual control", () => {
    const markup = render(createElement(ResponderProfileCard, { profile, hasActiveMission: true, saving: false, onSave: () => undefined }));
    expect(markup).toContain("Your location is shared automatically with the person linked to your active SOS and refreshes every 5 seconds.");
    expect(markup).toContain("Sharing automatically every 5 seconds");
    expect(markup).not.toContain("Share live location");
    expect(markup).not.toContain("Stop sharing");
  });

  it("renders victim contact and a map only for an assigned rescuer sharing fresh live coordinates", () => {
    const markup = render(createElement(AssignedRescuerCard, { rescuer: { callSign: "Boat 4", name: "Rescue Volunteer", photoUrl: null, phone: "+919999999999", locationStatus: "live", location: { latitude: 26.1445, longitude: 91.7362, updatedAt: new Date() } } }));
    expect(markup).toContain("tel:+919999999999");
    expect(markup).toContain("Live rescuer location · updating every 5 seconds");
    expect(markup).toContain("h-60");
  });

  it("hides the phone and map for paused or not-started live-location states", () => {
    const paused = render(createElement(AssignedRescuerCard, { rescuer: { callSign: "Boat 4", name: null, photoUrl: null, phone: null, locationStatus: "paused", location: null } }));
    const notStarted = render(createElement(AssignedRescuerCard, { rescuer: { callSign: "Boat 4", name: null, photoUrl: null, phone: null, locationStatus: "off", location: null } }));
    expect(paused).toContain("Contact is shared when the responder enables it");
    expect(paused).toContain("Waiting for the next automatic location update");
    expect(paused).not.toContain("h-60");
    expect(notStarted).toContain("Location sharing starts automatically after assignment");
    expect(notStarted).not.toContain("tel:");
  });
});
