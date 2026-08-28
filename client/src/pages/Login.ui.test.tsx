// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  Redirect: ({ to }: { to: string }) => <div data-testid="redirect" data-to={to}>Redirecting to {to}</div>,
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider defaultTheme="light">
      <LanguageProvider>{ui}</LanguageProvider>
    </ThemeProvider>
  );
}

describe("Login UI & Role Access Gate", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the sign in form with email and password inputs and top toggle", () => {
    mockUser = null;
    renderWithProviders(<Login />);

    expect(screen.getAllByText("Sign In").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^Register$/i })).toBeTruthy();
    expect(screen.getByLabelText(/Email or Username/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Password$/i)).toBeTruthy();
  });

  it("handles credential submission and triggers login", async () => {
    mockUser = null;
    const { container } = renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/Email or Username/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);
    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(submitBtn).toBeTruthy();
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

  it("switches to registration mode when clicking Register tab", () => {
    mockUser = null;
    renderWithProviders(<Login />);

    const registerTab = screen.getByRole("button", { name: /^Register$/i });
    fireEvent.click(registerTab);

    expect(screen.getByText("Create Account")).toBeTruthy();
    expect(screen.getByLabelText(/Full Name/i)).toBeTruthy();
    expect(screen.getByLabelText(/Email Address/i)).toBeTruthy();
  });

  it("renders bottom role access portals for Field Rescuers and Hospitals", () => {
    mockUser = null;
    renderWithProviders(<Login />);

    expect(screen.getByText("Emergency Personnel Portals")).toBeTruthy();
    const rescuerCard = screen.getByRole("button", { name: /Field Rescuer/i });
    const medicalCard = screen.getByRole("button", { name: /Hospital & Medical/i });

    expect(rescuerCard).toBeTruthy();
    expect(medicalCard).toBeTruthy();

    fireEvent.click(rescuerCard);
    expect(mockSetLocation).toHaveBeenCalledWith("/responder/login");

    fireEvent.click(medicalCard);
    expect(mockSetLocation).toHaveBeenCalledWith("/medical/login");
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

  it("blocks unauthorized workspaces through RoleGate and redirects", () => {
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

    // It should render the Redirect mock instead of the children
    expect(screen.queryByText("Open Command Centre")).toBeNull();
    expect(screen.getByTestId("redirect")).toBeTruthy();
    expect(screen.getByTestId("redirect").getAttribute("data-to")).toBe("/responder");
  });
});
