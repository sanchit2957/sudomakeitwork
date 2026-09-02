// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INDIA_CENTER } from "@shared/india-locations";
import { MapView } from "./Map";

describe("temporary unrestricted map configuration", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); delete (window as Window & { google?: unknown }).google; });

  it("keeps the familiar default centre without passing a geographic restriction to the map instance", async () => {
    const mapInstance = { setCenter: vi.fn(), setZoom: vi.fn() };
    const Map = vi.fn<(container: unknown, options: unknown) => unknown>(() => mapInstance);
    (window as any).google = { maps: { Map } };
    const view = render(<MapView className="h-48" initialZoom={7} />);
    await waitFor(() => expect(Map).toHaveBeenCalledTimes(1));
    expect(Map.mock.calls[0]?.[1]).toMatchObject({ center: INDIA_CENTER, zoom: 7 });
    expect(Map.mock.calls[0]?.[1]).not.toHaveProperty("restriction");
    const currentLocation = { lat: 19.083, lng: 72.9159 };
    view.rerender(<MapView className="h-48" initialCenter={currentLocation} initialZoom={14} />);
    await waitFor(() => expect(mapInstance.setCenter).toHaveBeenCalledWith(currentLocation));
    expect(mapInstance.setZoom).toHaveBeenCalledWith(14);
  });
});
