// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const acceptMutateMock = vi.fn().mockResolvedValue({ success: true, missionId: 99 });
const declineMutateMock = vi.fn().mockResolvedValue({ success: true });
const invalidateMock = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      rescue: {
        rescuer: {
          activeOffer: { invalidate: invalidateMock },
          missions: { invalidate: invalidateMock },
          profile: { invalidate: invalidateMock },
        },
      },
    }),
    rescue: {
      rescuer: {
        acceptMissionOffer: {
          useMutation: () => ({
            mutateAsync: acceptMutateMock,
            isPending: false,
          }),
        },
        declineMissionOffer: {
          useMutation: () => ({
            mutateAsync: declineMutateMock,
            isPending: false,
          }),
        },
      },
    },
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

import { EmergencyOfferCard, EmergencyAudioAlert, type ActiveOfferData } from "./EmergencyOfferCard";

describe("EmergencyOfferCard Component", () => {
  const sampleOfferData: ActiveOfferData = {
    offer: {
      id: 55,
      distanceKm: 2.3,
      matchScore: 980,
      status: "offered",
      offeredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    },
    incident: {
      id: 88,
      publicCode: "SOS-OFFER01",
      locationLabel: "Silpukhuri, Guwahati",
      latitude: 26.18,
      longitude: 91.77,
      requestCategory: "rescue",
      emergencyType: "flood",
      severity: "critical",
      peopleAffected: 4,
      notes: "Family stranded on rooftop",
    },
  };

  beforeEach(() => {
    acceptMutateMock.mockClear();
    declineMutateMock.mockClear();
    invalidateMock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders emergency offer card with incident type, distance, and 30-second countdown", () => {
    render(<EmergencyOfferCard data={sampleOfferData} />);

    expect(screen.getByText("NEW EMERGENCY REQUEST")).toBeDefined();
    expect(screen.getByText("SOS-OFFER01")).toBeDefined();
    expect(screen.getByText("Silpukhuri, Guwahati")).toBeDefined();
    expect(screen.getByText("2.3 km")).toBeDefined();
    expect(screen.getByText("Family stranded on rooftop", { exact: false })).toBeDefined();
    expect(screen.getByTestId("offer-countdown")).toBeDefined();
    expect(screen.getByTestId("accept-offer-btn")).toBeDefined();
    expect(screen.getByTestId("decline-offer-btn")).toBeDefined();
    expect(screen.getByText("00:30")).toBeDefined();
  });

  it("counts down from 30 seconds and remains visible while pending", () => {
    render(<EmergencyOfferCard data={sampleOfferData} />);

    expect(screen.getByText("00:30")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.getByText("00:25")).toBeDefined();
    expect(screen.getByTestId("emergency-offer-card")).toBeDefined();
  });

  it("triggers accept mutation and callback when responder accepts", async () => {
    const onAccepted = vi.fn();
    render(<EmergencyOfferCard data={sampleOfferData} onAccepted={onAccepted} />);

    const acceptBtn = screen.getByTestId("accept-offer-btn");
    await act(async () => {
      fireEvent.click(acceptBtn);
    });

    expect(acceptMutateMock).toHaveBeenCalledWith({ offerId: 55 });
    expect(invalidateMock).toHaveBeenCalled();
  });

  it("triggers decline mutation and triggers reassignment when responder declines", async () => {
    const onDeclined = vi.fn();
    render(<EmergencyOfferCard data={sampleOfferData} onDeclined={onDeclined} />);

    const declineBtn = screen.getByTestId("decline-offer-btn");
    await act(async () => {
      fireEvent.click(declineBtn);
    });

    expect(declineMutateMock).toHaveBeenCalledWith({ offerId: 55 });
    expect(invalidateMock).toHaveBeenCalled();
  });

  it("automatically triggers reassignment and decline when 30-second timer reaches 0", async () => {
    const onDeclined = vi.fn();
    render(<EmergencyOfferCard data={sampleOfferData} onDeclined={onDeclined} />);

    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });

    expect(declineMutateMock).toHaveBeenCalledWith({ offerId: 55 });
  });

  it("ignores duplicate clicks on Accept", async () => {
    render(<EmergencyOfferCard data={sampleOfferData} />);
    const acceptBtn = screen.getByTestId("accept-offer-btn");
    
    await act(async () => {
      fireEvent.click(acceptBtn);
      fireEvent.click(acceptBtn);
    });

    // Should only call mutate once because of actionLockRef
    expect(acceptMutateMock).toHaveBeenCalledTimes(1);
  });

  it("ignores duplicate clicks on Decline", async () => {
    render(<EmergencyOfferCard data={sampleOfferData} />);
    const declineBtn = screen.getByTestId("decline-offer-btn");
    
    await act(async () => {
      fireEvent.click(declineBtn);
      fireEvent.click(declineBtn);
    });

    expect(declineMutateMock).toHaveBeenCalledTimes(1);
  });

  it("does not trigger timer decline if Accept is already in progress", async () => {
    render(<EmergencyOfferCard data={sampleOfferData} />);
    const acceptBtn = screen.getByTestId("accept-offer-btn");
    
    await act(async () => {
      fireEvent.click(acceptBtn);
      // While accept is happening, timer expires
      vi.advanceTimersByTime(31_000);
    });

    // Accept should be called, but auto-decline should NOT be called
    expect(acceptMutateMock).toHaveBeenCalled();
    expect(declineMutateMock).not.toHaveBeenCalled();
  });

  it("starts and stops emergency audio alert chime gracefully", () => {
    const alert = new EmergencyAudioAlert();
    alert.start();
    expect(alert.getMuted()).toBe(false);

    alert.toggleMute();
    expect(alert.getMuted()).toBe(true);

    alert.toggleMute();
    expect(alert.getMuted()).toBe(false);

    alert.stop();
  });
});
