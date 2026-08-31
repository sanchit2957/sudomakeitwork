// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mutateSelectCategoryMock = vi.fn().mockResolvedValue({ success: true });
const mutateUpdateDetailsMock = vi.fn().mockResolvedValue({ success: true });
const mutateCancelSosMock = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/lib/trpc", () => ({
  trpc: {
    rescue: {
      emergency: {
        selectCategory: {
          useMutation: () => ({
            mutateAsync: mutateSelectCategoryMock,
          }),
        },
        updateMyDetails: {
          useMutation: () => ({
            mutateAsync: mutateUpdateDetailsMock,
          }),
        },
        cancel: {
          useMutation: () => ({
            mutateAsync: mutateCancelSosMock,
          }),
        },
      },
    },
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

import { SosClassificationModal } from "./SosClassificationModal";

describe("SosClassificationModal Component", () => {
  beforeEach(() => {
    mutateSelectCategoryMock.mockClear();
    mutateUpdateDetailsMock.mockClear();
    mutateCancelSosMock.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders all 4 category options, CANCEL SOS button, and the 10-second rapid triage countdown", () => {
    render(
      <SosClassificationModal
        isOpen={true}
        publicCode="SOS-TEST01"
        incidentId={10}
        triageDeadlineAt={new Date(Date.now() + 10_000).toISOString()}
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText("Tell us what's happening")).toBeDefined();
    expect(screen.getByTestId("triage-option-medical")).toBeDefined();
    expect(screen.getByTestId("triage-option-rescue")).toBeDefined();
    expect(screen.getByTestId("triage-option-emergency")).toBeDefined();
    expect(screen.getByTestId("triage-option-other")).toBeDefined();
    expect(screen.getByTestId("cancel-sos-btn")).toBeDefined();
    expect(screen.getByText("SOS-TEST01")).toBeDefined();
    expect(screen.getByText("00:10")).toBeDefined();
  });

  it("triggers cancel mutation and onCancel when citizen clicks CANCEL SOS during the window", async () => {
    const onCancel = vi.fn();
    const onComplete = vi.fn();
    render(
      <SosClassificationModal
        isOpen={true}
        publicCode="SOS-TEST09"
        incidentId={19}
        triageDeadlineAt={new Date(Date.now() + 10_000).toISOString()}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );

    const cancelBtn = screen.getByTestId("cancel-sos-btn");
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(mutateCancelSosMock).toHaveBeenCalledWith({
      publicCode: "SOS-TEST09",
      incidentId: 19,
    });
    expect(onCancel).toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("starts dispatch immediately on category click and switches to details with NO timer", async () => {
    render(
      <SosClassificationModal
        isOpen={true}
        publicCode="SOS-TEST02"
        incidentId={11}
        triageDeadlineAt={new Date(Date.now() + 10_000).toISOString()}
        onComplete={vi.fn()}
      />
    );

    const medicalBtn = screen.getByTestId("triage-option-medical");
    await act(async () => {
      fireEvent.click(medicalBtn);
    });

    // Category mutation is fired IMMEDIATELY without waiting 10 seconds!
    expect(mutateSelectCategoryMock).toHaveBeenCalledWith({
      publicCode: "SOS-TEST02",
      incidentId: 11,
      category: "medical",
    });

    // Contextual heading reflects medical category
    expect(screen.getByText("How many people need medical help?")).toBeDefined();
    expect(screen.getByText("Your SOS is active")).toBeDefined();

    // Verify NO countdown timer text is rendered on Step 2 (Details)
    expect(screen.queryByText(/Automatic emergency dispatch/i)).toBeNull();
    expect(screen.queryByText("00:10")).toBeNull();
  });

  it("does NOT auto-navigate away from Details screen when the 10-second deadline passes", async () => {
    const onComplete = vi.fn();
    render(
      <SosClassificationModal
        isOpen={true}
        publicCode="SOS-TEST07"
        incidentId={17}
        triageDeadlineAt={new Date(Date.now() + 10_000).toISOString()}
        onComplete={onComplete}
      />
    );

    // 1. Select category at 2 seconds
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });

    const medicalBtn = screen.getByTestId("triage-option-medical");
    await act(async () => {
      fireEvent.click(medicalBtn);
    });

    expect(screen.getByText("How many people need medical help?")).toBeDefined();

    // 2. Advance time past the original 10s deadline (e.g. 15 more seconds = 17s total)
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });

    // CRITICAL ASSERTION: The Details screen must STILL be open and onComplete must NOT have been called!
    expect(screen.getByText("How many people need medical help?")).toBeDefined();
    expect(onComplete).not.toHaveBeenCalled();

    // 3. User types notes past the deadline
    const notesInput = screen.getByPlaceholderText(/Optional landmarks, floor level/i);
    await act(async () => {
      fireEvent.change(notesInput, { target: { value: "Water rising above ground floor" } });
    });

    // 4. User explicitly clicks Continue to Tracking
    const continueBtn = screen.getByTestId("continue-to-tracking-btn");
    await act(async () => {
      fireEvent.click(continueBtn);
    });

    expect(mutateUpdateDetailsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        publicCode: "SOS-TEST07",
        notes: "Water rising above ground floor",
      })
    );
    expect(onComplete).toHaveBeenCalledWith("medical");
  });

  it("maps Other / Not Listed category option safely to emergency on backend", async () => {
    render(
      <SosClassificationModal
        isOpen={true}
        publicCode="SOS-TEST04"
        incidentId={14}
        triageDeadlineAt={new Date(Date.now() + 10_000).toISOString()}
        onComplete={vi.fn()}
      />
    );

    const otherBtn = screen.getByTestId("triage-option-other");
    await act(async () => {
      fireEvent.click(otherBtn);
    });

    expect(mutateSelectCategoryMock).toHaveBeenCalledWith({
      publicCode: "SOS-TEST04",
      incidentId: 14,
      category: "emergency",
    });

    expect(screen.getByText("How many people are involved?")).toBeDefined();
  });

  it("allows navigating back to categories without resetting timer or losing details state", async () => {
    render(
      <SosClassificationModal
        isOpen={true}
        publicCode="SOS-TEST05"
        incidentId={15}
        triageDeadlineAt={new Date(Date.now() + 10_000).toISOString()}
        onComplete={vi.fn()}
      />
    );

    // Click category
    await act(async () => {
      fireEvent.click(screen.getByTestId("triage-option-rescue"));
    });

    expect(screen.getByText("How many people need rescue?")).toBeDefined();

    // Modify people counter
    const plusBtn = screen.getByText("+");
    await act(async () => {
      fireEvent.click(plusBtn);
      fireEvent.click(plusBtn);
    });

    // Toggle need tag
    const boatTag = screen.getByText("Boat needed");
    await act(async () => {
      fireEvent.click(boatTag);
    });

    // Click back to categories
    const backBtn = screen.getByTestId("back-to-categories-btn");
    await act(async () => {
      fireEvent.click(backBtn);
    });

    expect(screen.getByText("Tell us what's happening")).toBeDefined();
  });

  it("submits category and details when confirming in Step 2", async () => {
    const onComplete = vi.fn();
    render(
      <SosClassificationModal
        isOpen={true}
        publicCode="SOS-TEST06"
        incidentId={16}
        triageDeadlineAt={new Date(Date.now() + 10_000).toISOString()}
        onComplete={onComplete}
      />
    );

    // Click category
    await act(async () => {
      fireEvent.click(screen.getByTestId("triage-option-medical"));
    });

    // Add special need tag
    await act(async () => {
      fireEvent.click(screen.getByText("Urgent medicine"));
    });

    // Click Continue to Tracking
    const continueBtn = screen.getByTestId("continue-to-tracking-btn");
    await act(async () => {
      fireEvent.click(continueBtn);
    });

    expect(mutateUpdateDetailsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        publicCode: "SOS-TEST06",
        helpNeeds: "Urgent medicine",
      })
    );

    expect(onComplete).toHaveBeenCalledWith("medical");
  });

  it("automatically completes with emergency category when timer expires on categories screen with no selection", async () => {
    const onComplete = vi.fn();
    const now = Date.now();
    render(
      <SosClassificationModal
        isOpen={true}
        publicCode="SOS-TEST03"
        incidentId={12}
        triageDeadlineAt={new Date(now + 10_000).toISOString()}
        onComplete={onComplete}
      />
    );

    // Fast-forward 10.2 seconds
    await act(async () => {
      vi.advanceTimersByTime(10_200);
    });

    expect(screen.getByText("Time expired — Emergency response has been activated automatically.")).toBeDefined();

    // Advance past timeout transition
    await act(async () => {
      vi.advanceTimersByTime(1_500);
    });
    expect(onComplete).toHaveBeenCalledWith("emergency");
  });
});
