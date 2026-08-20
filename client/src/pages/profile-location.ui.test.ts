import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResponderProfileCard } from "./Responder";
import { AssignedRescuerCard } from "./Track";

vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));

const profile = { callSign: "Boat 4", phone: "+919999999999", photoUrl: null, contactSharing: "yes" as const, locationSharing: "no" as const };
const render = (element: ReactElement) => renderToStaticMarkup(element);

describe("assigned rescuer profile and location UI", () => {
  it("renders field-profile contact controls and disables live sharing without an active mission", () => {
    const markup = render(createElement(ResponderProfileCard, { profile, hasActiveMission: false, saving: false, onSave: () => undefined, onLocationSharing: () => undefined }));
    expect(markup).toContain("Assignment contact number");
    expect(markup).toContain("Show my phone number to my active assignment");
    expect(markup).toContain("Live location can be started after you are assigned an active SOS mission.");
    expect(markup).toMatch(/Share live location<\/button>/);
    expect(markup).toContain("disabled");
  });

  it("renders the active mission sharing action without a disabled control", () => {
    const markup = render(createElement(ResponderProfileCard, { profile, hasActiveMission: true, saving: false, onSave: () => undefined, onLocationSharing: () => undefined }));
    expect(markup).toContain("Share your current position with this SOS only while this mission is active.");
    expect(markup).toMatch(/Share live location<\/button>/);
    const labelIndex = markup.indexOf("Share live location</button>");
    const liveSharingButton = markup.slice(markup.lastIndexOf("<button", labelIndex), labelIndex + "Share live location</button>".length);
    expect(liveSharingButton).not.toMatch(/\sdisabled(?:=""|(?=\s|>))/);
  });

  it("renders victim contact and a map only for an assigned rescuer sharing fresh live coordinates", () => {
    const markup = render(createElement(AssignedRescuerCard, { rescuer: { callSign: "Boat 4", name: "Rescue Volunteer", photoUrl: null, phone: "+919999999999", locationStatus: "live", location: { latitude: 26.1445, longitude: 91.7362, updatedAt: new Date() } } }));
    expect(markup).toContain("tel:+919999999999");
    expect(markup).toContain("Live location is updating");
    expect(markup).toContain("h-60");
  });

  it("hides the phone and map for paused or not-started live-location states", () => {
    const paused = render(createElement(AssignedRescuerCard, { rescuer: { callSign: "Boat 4", name: null, photoUrl: null, phone: null, locationStatus: "paused", location: null } }));
    const notStarted = render(createElement(AssignedRescuerCard, { rescuer: { callSign: "Boat 4", name: null, photoUrl: null, phone: null, locationStatus: "off", location: null } }));
    expect(paused).toContain("Contact is shared when the responder enables it");
    expect(paused).toContain("Location sharing is paused");
    expect(paused).not.toContain("h-60");
    expect(notStarted).toContain("Location sharing has not started");
    expect(notStarted).not.toContain("tel:");
  });
});
