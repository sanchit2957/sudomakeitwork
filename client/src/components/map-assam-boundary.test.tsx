// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ASSAM_CENTER, ASSAM_MAP_RESTRICTION } from "@shared/assam-boundary";
import { MapView } from "./Map";

describe("Assam map configuration", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); delete (window as Window & { google?: unknown }).google; });

  it("passes the Assam centre and strict state restriction to every default map instance", async () => {
    const Map = vi.fn<(container: unknown, options: unknown) => unknown>(() => ({}));
    (window as any).google = { maps: { Map } };
    render(<MapView className="h-48" initialZoom={7} />);
    await waitFor(() => expect(Map).toHaveBeenCalledTimes(1));
    expect(Map.mock.calls[0]?.[1]).toMatchObject({ center: ASSAM_CENTER, zoom: 7, restriction: ASSAM_MAP_RESTRICTION });
  });
});
