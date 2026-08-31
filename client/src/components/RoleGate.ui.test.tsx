// @vitest-environment jsdom
import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { RoleGate } from "./RoleGate";

let mockUser: any = null;
let mockLoading = false;
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
  }),
}));

vi.mock("wouter", () => ({
  Redirect: ({ to }: { to: string }) => <div data-testid="redirect" data-to={to}>Redirecting to {to}</div>,
}));

describe("RoleGate strict access portals", () => {
  it("redirects unauthenticated users to /login", () => {
    mockUser = null;
    mockLoading = false;
    const gate = render(<RoleGate roles={["user"]}><span>Citizen SOS Content</span></RoleGate>);
    expect(gate.queryByText("Citizen SOS Content")).toBeNull();
    expect(gate.getByTestId("redirect").getAttribute("data-to")).toBe("/login");
    gate.unmount();
  });

  it("shows loading spinner during initial authentication check", () => {
    mockUser = null;
    mockLoading = true;
    const gate = render(<RoleGate roles={["user"]}><span>Citizen SOS Content</span></RoleGate>);
    expect(gate.queryByText("Citizen SOS Content")).toBeNull();
    expect(gate.queryByTestId("redirect")).toBeNull();
    gate.unmount();
  });

  it("blocks access and redirects to appropriate dashboard when role mismatch", () => {
    mockUser = { role: "rescuer" };
    mockLoading = false;
    const command = render(<RoleGate roles={["admin"]}><span>Command Workspace Content</span></RoleGate>);
    expect(command.queryByText("Command Workspace Content")).toBeNull();
    expect(command.getByTestId("redirect").getAttribute("data-to")).toBe("/responder");
    command.unmount();
  });

  it("allows access when role matches", () => {
    mockUser = { role: "hospital" };
    mockLoading = false;
    const hospital = render(<RoleGate roles={["hospital"]}><span>Hospital Workspace Content</span></RoleGate>);
    expect(hospital.getByText("Hospital Workspace Content")).toBeTruthy();
    expect(hospital.queryByTestId("redirect")).toBeNull();
    hospital.unmount();
  });

  it("allows citizen user on citizen routes", () => {
    mockUser = { role: "user" };
    mockLoading = false;
    const citizen = render(<RoleGate roles={["user"]}><span>Citizen SOS Hub</span></RoleGate>);
    expect(citizen.getByText("Citizen SOS Hub")).toBeTruthy();
    expect(citizen.queryByTestId("redirect")).toBeNull();
    citizen.unmount();
  });
});
