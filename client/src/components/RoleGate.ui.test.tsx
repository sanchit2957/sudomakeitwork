// @vitest-environment jsdom
import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { RoleGate } from "./RoleGate";

let mockUser: any = null;
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
  }),
}));

vi.mock("wouter", () => ({
  Redirect: ({ to }: { to: string }) => <div data-testid="redirect" data-to={to}>Redirecting to {to}</div>,
}));

describe("RoleGate strict access portals", () => {
  it("blocks access and redirects to appropriate dashboard", () => {
    mockUser = { role: "rescuer" };
    const command = render(<RoleGate roles={["admin"]}><span>Command Workspace Content</span></RoleGate>);
    expect(command.queryByText("Command Workspace Content")).toBeNull();
    expect(command.getByTestId("redirect").getAttribute("data-to")).toBe("/responder");
    command.unmount();
  });

  it("allows access when role matches", () => {
    mockUser = { role: "hospital" };
    const hospital = render(<RoleGate roles={["hospital"]}><span>Hospital Workspace Content</span></RoleGate>);
    expect(hospital.getByText("Hospital Workspace Content")).toBeTruthy();
    expect(hospital.queryByTestId("redirect")).toBeNull();
    hospital.unmount();
  });
});
