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
    mockUser = { role: "medical" };
    const medical = render(<RoleGate roles={["medical"]}><span>Medical Workspace Content</span></RoleGate>);
    expect(medical.getByText("Medical Workspace Content")).toBeTruthy();
    expect(medical.queryByTestId("redirect")).toBeNull();
    medical.unmount();
  });
});
