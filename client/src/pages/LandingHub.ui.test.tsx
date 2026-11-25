// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LandingHub from "./LandingHub";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

const mockNavigate = vi.fn();

vi.mock("wouter", () => ({
  useLocation: () => ["/", mockNavigate],
}));

describe("Unified 4-Panel Main Homepage (LandingHub)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  function renderHub() {
    return render(
      <ThemeProvider defaultTheme="light">
        <LanguageProvider>
          <LandingHub />
        </LanguageProvider>
      </ThemeProvider>
    );
  }

  it("renders 4 clearly separated panels for Citizen, Rescuer, Hospital, and Admin", () => {
    renderHub();
    expect(screen.getByTestId("portal-panel-citizen")).toBeTruthy();
    expect(screen.getByTestId("portal-panel-rescuer")).toBeTruthy();
    expect(screen.getByTestId("portal-panel-hospital")).toBeTruthy();
    expect(screen.getByTestId("portal-panel-admin")).toBeTruthy();
  });

  it("navigates to each role's dedicated Sign In and Register pages independently", () => {
    renderHub();

    fireEvent.click(screen.getByTestId("portal-login-citizen"));
    expect(mockNavigate).toHaveBeenLastCalledWith("/login?mode=signin");

    fireEvent.click(screen.getByTestId("portal-register-citizen"));
    expect(mockNavigate).toHaveBeenLastCalledWith("/login?mode=register");

    fireEvent.click(screen.getByTestId("portal-login-rescuer"));
    expect(mockNavigate).toHaveBeenLastCalledWith("/responder/login?mode=signin");

    fireEvent.click(screen.getByTestId("portal-register-rescuer"));
    expect(mockNavigate).toHaveBeenLastCalledWith("/responder/login?mode=register");

    fireEvent.click(screen.getByTestId("portal-login-hospital"));
    expect(mockNavigate).toHaveBeenLastCalledWith("/hospital/login?mode=signin");

    fireEvent.click(screen.getByTestId("portal-register-hospital"));
    expect(mockNavigate).toHaveBeenLastCalledWith("/hospital/login?mode=register");

    fireEvent.click(screen.getByTestId("portal-login-admin"));
    expect(mockNavigate).toHaveBeenLastCalledWith("/admin/login?mode=signin");
    expect(screen.queryByTestId("portal-register-admin")).toBeNull();
  });
});
