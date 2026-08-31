// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockMutateAsync = vi.fn().mockResolvedValue({
  reply: "For flood safety, move to high ground immediately and avoid floodwater.",
  conversationId: "test-conv-123",
});

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ locale: "as", t: (key: string) => key }),
}));

vi.mock("@/lib/nativeLocation", () => ({
  getCurrentCoordinates: vi.fn().mockResolvedValue({ latitude: 26.1445, longitude: 91.7362 }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    ai: {
      chat: {
        useMutation: () => ({
          mutateAsync: mockMutateAsync,
          isPending: false,
        }),
      },
    },
  },
}));

import { SahayakAiModal } from "./SahayakAiModal";

describe("SahayakAiModal component", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({
      reply: "For flood safety, move to high ground immediately and avoid floodwater.",
      conversationId: "test-conv-123",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render when isOpen is false", () => {
    render(<SahayakAiModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText("Sahayak AI")).toBeNull();
  });

  it("renders header, welcome message, and suggested prompt chips when isOpen is true", () => {
    render(<SahayakAiModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText("Sahayak AI")).toBeTruthy();
    expect(screen.getByText("Hi! I'm Sahayak AI. How can I help you?")).toBeTruthy();
    expect(screen.getByText("Flood safety")).toBeTruthy();
    expect(screen.getByText("Find a hospital")).toBeTruthy();
    expect(screen.getByText("Rescue assistance")).toBeTruthy();
  });

  it("submits message on suggested prompt click and displays response", async () => {
    render(<SahayakAiModal isOpen={true} onClose={vi.fn()} />);

    const promptChip = screen.getByText("Flood safety");
    fireEvent.click(promptChip);

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Flood safety",
        language: "as",
        history: [{ role: "user", content: "Flood safety" }],
      })
    );

    await waitFor(() => {
      expect(screen.getByText("For flood safety, move to high ground immediately and avoid floodwater.")).toBeTruthy();
    });
  });

  it("handles custom text input and send button", async () => {
    render(<SahayakAiModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText("Ask about flood safety, weather, or hospitals…");
    fireEvent.change(input, { target: { value: "Where is the nearest shelter?" } });

    const sendBtn = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(sendBtn);

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Where is the nearest shelter?",
        language: "as",
        history: [{ role: "user", content: "Where is the nearest shelter?" }],
      })
    );
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(<SahayakAiModal isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
