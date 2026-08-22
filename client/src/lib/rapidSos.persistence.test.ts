// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLatestSos, redirectAfterRapidSos, rememberLatestSos } from "./rapidSos";

describe("latest SOS tracking persistence", () => {
  beforeEach(() => localStorage.clear());

  it("stores the valid latest code before redirecting to the tracking flow", () => {
    const navigate = vi.fn();
    redirectAfterRapidSos("sos-abcdefgh", navigate);
    expect(getLatestSos()).toBe("SOS-ABCDEFGH");
    expect(navigate).toHaveBeenCalledWith("/track?code=SOS-ABCDEFGH");
    expect(rememberLatestSos("SOS-1234ABCD")).toBe("SOS-1234ABCD");
    expect(getLatestSos()).toBe("SOS-1234ABCD");
  });
});
