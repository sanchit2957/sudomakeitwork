// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

import { VoiceNoteCard } from "./VoiceNoteCard";
import * as sosVoiceNote from "@/lib/sosVoiceNote";

describe("VoiceNoteCard component", () => {
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
    const mockStream = { getTracks: () => [mockTrack] };

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
        permissions: {
          query: vi.fn().mockResolvedValue({ state: "granted" }),
        },
      },
    });

    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: class MockMediaRecorder {
        state = "inactive";
        mimeType = "audio/webm";
        ondataavailable: ((e: any) => void) | null = null;
        onstop: (() => void) | null = null;

        static isTypeSupported = () => true;

        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          if (this.ondataavailable) {
            this.ondataavailable({ data: new Blob(["fake-audio"], { type: "audio/webm" }) });
          }
          if (this.onstop) {
            this.onstop();
          }
        }
      },
    });

    // Mock HTMLAudioElement
    globalThis.Audio = vi.fn().mockImplementation(() => ({
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      src: "",
      currentTime: 0,
    })) as any;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders Idle state with record button and descriptive copy", () => {
    render(<VoiceNoteCard />);
    expect(screen.getByText("Record voice note")).toBeTruthy();
    expect(screen.getByText("Speak briefly if typing is difficult")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Record voice note" })).toBeTruthy();
  });

  it("displays draft preview and allows playback when draft is present in sessionStorage", () => {
    sessionStorage.setItem(
      "sudo-makeitwork-sos-voice-note",
      JSON.stringify({
        dataUrl: "data:audio/webm;base64,dGVzdA==",
        durationSeconds: 15,
        createdAt: Date.now(),
      })
    );

    render(<VoiceNoteCard />);
    expect(screen.getByText("Voice note ready")).toBeTruthy();
    expect(screen.getByText("15s · Attached to your next SOS")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play voice note" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete voice note" })).toBeTruthy();
  });

  it("clears the draft and returns card to Idle state when Delete is clicked", async () => {
    sessionStorage.setItem(
      "sudo-makeitwork-sos-voice-note",
      JSON.stringify({
        dataUrl: "data:audio/webm;base64,dGVzdA==",
        durationSeconds: 8,
        createdAt: Date.now(),
      })
    );

    render(<VoiceNoteCard />);
    expect(screen.getByText("Voice note ready")).toBeTruthy();

    const deleteBtn = screen.getByRole("button", { name: "Delete voice note" });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText("Record voice note")).toBeTruthy();
      expect(sessionStorage.getItem("sudo-makeitwork-sos-voice-note")).toBeNull();
    });
  });

  it("displays non-blocking banner with Try again when mic permission is denied", async () => {
    sessionStorage.setItem("sudo-makeitwork-mic-status", "denied");
    navigator.permissions.query = vi.fn().mockResolvedValue({ state: "denied" });

    render(<VoiceNoteCard />);

    await waitFor(() => {
      expect(screen.getByText("Microphone access is off")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    });
  });
});
