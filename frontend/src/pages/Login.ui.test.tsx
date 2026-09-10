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
const mockSendEmailOtp = vi.fn().mockResolvedValue({ success: true });
const mockVerifyEmailOtp = vi.fn().mockResolvedValue({ success: true });
let mockUser: any = null;

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    login: mockLoginAsRole,
    loginAsRole: mockLoginAsRole,
    logout: mockLogout,
    sendEmailOtp: mockSendEmailOtp,
    verifyEmailOtp: mockVerifyEmailOtp,
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

  it("renders the sign in form with email OTP input and top toggle", () => {
    mockUser = null;
    renderWithProviders(<Login />);

    expect(screen.getAllByText("Sign In").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^Register$/i })).toBeTruthy();
    expect(screen.getByLabelText(/Email Address/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Send Verification Code/i })).toBeTruthy();
  });

  it("handles email OTP request and triggers sendEmailOtp", async () => {
    mockUser = null;
    const { container } = renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/Email Address/i);
    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(submitBtn).toBeTruthy();
    fireEvent.change(emailInput, { target: { value: "citizen@example.com" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSendEmailOtp).toHaveBeenCalledWith("citizen@example.com");
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
    expect(screen.getByRole("button", { name: /Create Citizen Account/i })).toBeTruthy();
  });

  it("renders bottom role access portals for Field Rescuers and Hospitals", () => {
    mockUser = null;
    renderWithProviders(<Login />);

    expect(screen.getByText("Emergency Personnel Portals")).toBeTruthy();
    const rescuerCard = screen.getByRole("button", { name: /Field Rescuer/i });
    const hospitalCard = screen.getByRole("button", { name: /Hospital Portal/i });

    expect(rescuerCard).toBeTruthy();
    expect(hospitalCard).toBeTruthy();

    fireEvent.click(rescuerCard);
    expect(mockSetLocation).toHaveBeenCalledWith("/responder/login");

    fireEvent.click(hospitalCard);
    expect(mockSetLocation).toHaveBeenCalledWith("/hospital/login");
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

  it("renders Admin? Click here at the extreme bottom and triggers admin navigation", () => {
    mockUser = null;
    renderWithProviders(<Login />);

    const adminBtn = screen.getByText(/Click here/i).closest("button")!;
    expect(adminBtn).toBeTruthy();

    fireEvent.click(adminBtn);
    expect(mockSetLocation).toHaveBeenCalledWith("/admin/login");
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
