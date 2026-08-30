// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkCurrentMicPermission,
  isMicSupported,
  requestMicPermission,
  triggerPostAuthMicPermission,
} from "./micPermission";

describe("micPermission management", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
        clear: () => store.clear(),
      },
    });

    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: () => [mockTrack],
    };

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
        permissions: {
          query: vi.fn().mockResolvedValue({ state: "prompt" }),
        },
      },
    });

    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: class {
        static isTypeSupported = () => true;
      },
    });
  });

  it("detects microphone support accurately", () => {
    expect(isMicSupported()).toBe(true);
  });

  it("requests permission and immediately releases all media tracks", async () => {
    const mockTrack = { stop: vi.fn() };
    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [mockTrack],
    });

    const status = await requestMicPermission();
    expect(status).toBe("granted");
    expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("sudo-makeitwork-mic-status")).toBe("granted");
    expect(sessionStorage.getItem("sudo-makeitwork-mic-session-prompted")).toBe("true");
  });

  it("does not re-prompt if already requested in current session and denied", async () => {
    sessionStorage.setItem("sudo-makeitwork-mic-session-prompted", "true");
    sessionStorage.setItem("sudo-makeitwork-mic-status", "denied");

    const status = await requestMicPermission(false);
    expect(status).toBe("denied");
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it("allows manual retry when force is true even if previously denied", async () => {
    sessionStorage.setItem("sudo-makeitwork-mic-session-prompted", "true");
    sessionStorage.setItem("sudo-makeitwork-mic-status", "denied");

    const mockTrack = { stop: vi.fn() };
    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [mockTrack],
    });

    const status = await requestMicPermission(true);
    expect(status).toBe("granted");
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
  });

  it("handles user denial gracefully without throwing", async () => {
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(new Error("Permission denied"));

    const status = await requestMicPermission(true);
    expect(status).toBe("denied");
    expect(sessionStorage.getItem("sudo-makeitwork-mic-status")).toBe("denied");
  });

  it("triggerPostAuthMicPermission skips prompting if already granted", async () => {
    navigator.permissions.query = vi.fn().mockResolvedValue({ state: "granted" });

    const status = await triggerPostAuthMicPermission();
    expect(status).toBe("granted");
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});
