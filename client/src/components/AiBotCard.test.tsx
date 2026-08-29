// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

import { AiBotCard } from "./AiBotCard";

describe("AiBotCard component", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the AI Bot title, Get Help subtitle, and button", () => {
    const handleOpen = vi.fn();
    render(<AiBotCard onOpen={handleOpen} />);

    expect(screen.getByText("AI Bot")).toBeTruthy();
    expect(screen.getByText("Get Help")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open AI Bot" })).toBeTruthy();
  });

  it("triggers onOpen callback when button is clicked", () => {
    const handleOpen = vi.fn();
    render(<AiBotCard onOpen={handleOpen} />);

    const openBtn = screen.getByRole("button", { name: "Open AI Bot" });
    fireEvent.click(openBtn);

    expect(handleOpen).toHaveBeenCalledTimes(1);
  });
});
