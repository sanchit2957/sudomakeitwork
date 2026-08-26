// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Login from "./Login";
import { RoleGate } from "@/components/RoleGate";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

const mockLoginAsRole = vi.fn().mockResolvedValue({ success: true });
const mockLogout = vi.fn().mockResolvedValue({ success: true });
let mockUser: any = null;

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    login: mockLoginAsRole,
    loginAsRole: mockLoginAsRole,
    logout: mockLogout,
  }),
}));

const mockSetLocation = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/login", mockSetLocation],
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider defaultTheme="light">
      <LanguageProvider>{ui}</LanguageProvider>
    </ThemeProvider>
  );
}

describe("Login UI & Role Access Gate", () => {
  it("renders the sign in form with email and password inputs", () => {
    mockUser = null;
    renderWithProviders(<Login />);

    expect(screen.getByText("Sign In")).toBeTruthy();
    expect(screen.getByLabelText(/Email or Username/i)).toBeTruthy();
    expect(screen.getByLabelText(/Password/i)).toBeTruthy();
  });

  it("handles credential submission and triggers login", async () => {
    mockUser = null;
    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/Email or Username/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getAllByRole("button", { name: /Sign in/i })[0];

    fireEvent.change(emailInput, { target: { value: "admin" } });
    fireEvent.change(passwordInput, { target: { value: "admin" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLoginAsRole).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "admin",
          password: "admin",
        })
      );
    });
  });

  it("displays active session status banner when user is logged in", () => {
    mockUser = {
      id: 1,
      openId: "test-admin",
      name: "State Coordinator",
      email: "admin@assamrescue.gov.in",
      role: "admin",
    };

    renderWithProviders(<Login />);

    expect(screen.getByText("State Coordinator")).toBeTruthy();
    expect(screen.getByText("Enter ADMIN Workspace")).toBeTruthy();
  });

  it("denies a wrong role through RoleGate", () => {
    mockUser = {
      id: 2,
      openId: "test-rescuer",
      name: "NDRF Rescuer",
      role: "rescuer",
    };

    renderWithProviders(
      <RoleGate roles={["admin"]}>
        <div>Open Command Centre</div>
      </RoleGate>
    );

    expect(screen.queryByText("Open Command Centre")).toBeNull();
    expect(mockSetLocation).toHaveBeenCalledWith("/");
  });
});
