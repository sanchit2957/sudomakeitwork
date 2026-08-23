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
  it("renders the 4 dedicated role cards on the Login page", () => {
    mockUser = null;
    renderWithProviders(<Login />);

    expect(screen.getByText("Government Command")).toBeTruthy();
    expect(screen.getByText("Field Rescuer Operations")).toBeTruthy();
    expect(screen.getByText("Hospital & Medical Staff")).toBeTruthy();
    expect(screen.getByText("Assam Resident / Citizen")).toBeTruthy();
  });

  it("handles 1-Click Superadmin login and triggers navigation to /command", async () => {
    mockUser = null;
    renderWithProviders(<Login />);

    const adminBtn = screen.getAllByRole("button", { name: /Government/i })[0];
    fireEvent.click(adminBtn);

    await waitFor(() => {
      expect(mockLoginAsRole).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "admin",
          email: "admin@assamrescue.gov.in",
        })
      );
      expect(mockSetLocation).toHaveBeenCalledWith("/command");
    });
  });

  it("handles 1-Click Field Rescuer login and triggers navigation to /responder", async () => {
    mockUser = null;
    renderWithProviders(<Login />);

    const rescuerBtn = screen.getAllByRole("button", { name: /Field/i })[0];
    fireEvent.click(rescuerBtn);

    await waitFor(() => {
      expect(mockLoginAsRole).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "rescuer",
          email: "rescuer@assamrescue.gov.in",
        })
      );
      expect(mockSetLocation).toHaveBeenCalledWith("/responder");
    });
  });

  it("handles 1-Click Hospital Staff login and triggers navigation to /medical", async () => {
    mockUser = null;
    renderWithProviders(<Login />);

    const medicalBtn = screen.getAllByRole("button", { name: /Hospital/i })[0];
    fireEvent.click(medicalBtn);

    await waitFor(() => {
      expect(mockLoginAsRole).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "medical",
          email: "medical@gmch.gov.in",
        })
      );
      expect(mockSetLocation).toHaveBeenCalledWith("/medical");
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

  it("enforces RoleGate isolation: blocks Rescuer from accessing Command workspace", () => {
    mockUser = {
      id: 2,
      openId: "test-rescuer",
      name: "NDRF Rescuer",
      role: "rescuer",
    };

    renderWithProviders(
      <RoleGate roles={["admin"]}>
        <div>Secret Command Centre</div>
      </RoleGate>
    );

    expect(screen.queryByText("Secret Command Centre")).toBeNull();
    expect(screen.getByText("Field Rescuer Portal Only")).toBeTruthy();
    expect(screen.getByText("Go to Rescuer Portal")).toBeTruthy();
  });

  it("enforces RoleGate isolation: blocks Hospital Staff from accessing Command workspace", () => {
    mockUser = {
      id: 3,
      openId: "test-medical",
      name: "Hospital Lead",
      role: "medical",
    };

    renderWithProviders(
      <RoleGate roles={["admin"]}>
        <div>Secret Command Centre</div>
      </RoleGate>
    );

    expect(screen.queryByText("Secret Command Centre")).toBeNull();
    expect(screen.getByText("Hospital Staff Portal Only")).toBeTruthy();
    expect(screen.getByText("Go to Hospital Portal")).toBeTruthy();
  });

  it("allows Superadmin (admin) to access any workspace through RoleGate", () => {
    mockUser = {
      id: 1,
      openId: "test-admin",
      name: "Super Admin",
      role: "admin",
    };

    renderWithProviders(
      <RoleGate roles={["rescuer"]}>
        <div>Field Rescuer Workspace Content</div>
      </RoleGate>
    );

    expect(screen.getByText("Field Rescuer Workspace Content")).toBeTruthy();
  });
});
