// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

import { EmergencyOfferCard, type ActiveOfferData } from "./EmergencyOfferCard";

describe("EmergencyOfferCard Component", () => {
  const sampleOfferData: ActiveOfferData = {
    offer: {
      id: 55,
      distanceKm: 2.3,
      matchScore: 980,
      status: "offered",
      offeredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10_000).toISOString(),
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

  it("renders emergency offer card with incident type, distance, and 10s countdown", () => {
    render(<EmergencyOfferCard data={sampleOfferData} />);

    expect(screen.getByText("NEW EMERGENCY REQUEST")).toBeDefined();
    expect(screen.getByText("SOS-OFFER01")).toBeDefined();
    expect(screen.getByText("Silpukhuri, Guwahati")).toBeDefined();
    expect(screen.getByText("2.3 km")).toBeDefined();
    expect(screen.getByTestId("accept-offer-btn")).toBeDefined();
    expect(screen.getByTestId("decline-offer-btn")).toBeDefined();
  });

  it("triggers accept mutation and callback when responder accepts", async () => {
    const onAccepted = vi.fn();
    render(<EmergencyOfferCard data={sampleOfferData} onAccepted={onAccepted} />);

    const acceptBtn = screen.getByTestId("accept-offer-btn");
    fireEvent.click(acceptBtn);

    expect(acceptMutateMock).toHaveBeenCalledWith({ offerId: 55 });
  });

  it("triggers decline mutation and callback when responder declines", async () => {
    const onDeclined = vi.fn();
    render(<EmergencyOfferCard data={sampleOfferData} onDeclined={onDeclined} />);

    const declineBtn = screen.getByTestId("decline-offer-btn");
    fireEvent.click(declineBtn);

    expect(declineMutateMock).toHaveBeenCalledWith({ offerId: 55 });
  });
});
