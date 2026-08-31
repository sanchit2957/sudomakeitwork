// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsyncMock = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/lib/trpc", () => ({
  trpc: {
    rescue: {
      emergency: {
        selectCategory: {
          useMutation: () => ({
            mutateAsync: mutateAsyncMock,
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
    mutateAsyncMock.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders 3 category choices and the 10-second rapid triage countdown", () => {
    render(
      <SosClassificationModal
        isOpen={true}
        publicCode="SOS-TEST01"
        incidentId={10}
        triageDeadlineAt={new Date(Date.now() + 10_000).toISOString()}
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText("WHAT KIND OF HELP DO YOU NEED?")).toBeDefined();
    expect(screen.getByTestId("triage-option-medical")).toBeDefined();
    expect(screen.getByTestId("triage-option-rescue")).toBeDefined();
    expect(screen.getByTestId("triage-option-emergency")).toBeDefined();
    expect(screen.getByText("SOS-TEST01")).toBeDefined();
  });

  it("triggers selectCategory mutation and onComplete when citizen selects medical help", async () => {
    const onComplete = vi.fn();
    render(
      <SosClassificationModal
        isOpen={true}
        publicCode="SOS-TEST02"
        incidentId={11}
        triageDeadlineAt={new Date(Date.now() + 10_000).toISOString()}
        onComplete={onComplete}
      />
    );

    const medicalBtn = screen.getByTestId("triage-option-medical");
    await act(async () => {
      fireEvent.click(medicalBtn);
    });

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      publicCode: "SOS-TEST02",
      incidentId: 11,
      category: "medical",
    });

    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    expect(onComplete).toHaveBeenCalledWith("medical");
  });

  it("automatically completes with emergency category when timer expires", async () => {
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
