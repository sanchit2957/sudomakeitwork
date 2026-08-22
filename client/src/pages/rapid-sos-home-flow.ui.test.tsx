// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ mutateAsync: vi.fn(), navigate: vi.fn(), startLogin: vi.fn(), flushOfflineSos: vi.fn() }));

vi.mock("@/components/Map", () => ({ MapView: () => <div data-testid="map-preview" /> }));
vi.mock("@/components/LanguageSelector", () => ({ default: () => <span>English</span> }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/sosVoiceNote", () => ({ blobToDataUrl: vi.fn(), clearSosVoiceNote: vi.fn(), readSosVoiceNote: () => null, saveSosVoiceNote: vi.fn() }));
vi.mock("@/lib/offlineSos", () => ({ flushOfflineSos: runtime.flushOfflineSos, queueOfflineSos: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { rescue: { emergency: { conditions: { useQuery: () => ({ data: undefined, isLoading: false }) }, create: { useMutation: () => ({ mutateAsync: runtime.mutateAsync }) } } } } }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 7, name: "Victim" }, loading: false }) }));
vi.mock("@/const", () => ({ startLogin: runtime.startLogin }));
vi.mock("wouter", () => ({ useLocation: () => ["/", runtime.navigate] }));

import Home from "./Home";

describe("Home rapid-SOS success flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.mutateAsync.mockResolvedValue({ publicCode: "SOS-ABCDEFGH" });
    runtime.flushOfflineSos.mockResolvedValue({ delivered: [] });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 26.1445, longitude: 91.7362 } } as GeolocationPosition) } });
  });

  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("creates the authenticated location-first SOS and redirects to its private tracking code", async () => {
    const view = render(<Home />);
    fireEvent.click(view.getByRole("button", { name: "Send SOS" }));
    await waitFor(() => expect(runtime.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ latitude: 26.1445, longitude: 91.7362, emergencyType: "flood", severity: "high", peopleAffected: 1 })));
    await waitFor(() => expect(runtime.navigate).toHaveBeenCalledWith("/track?code=SOS-ABCDEFGH"));
  });

  it("uses an out-of-Assam device location for the temporary unrestricted rapid SOS flow", async () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 25.5788, longitude: 91.8933 } } as GeolocationPosition) } });
    const view = render(<Home />);
    fireEvent.click(view.getByRole("button", { name: "Send SOS" }));
    await waitFor(() => expect(runtime.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ latitude: 25.5788, longitude: 91.8933 })));
    await waitFor(() => expect(runtime.navigate).toHaveBeenCalledWith("/track?code=SOS-ABCDEFGH"));
  });
});
