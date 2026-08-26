// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { RoleGate } from "./RoleGate";

const mockSetLocation = vi.fn();
let mockUser: any = null;

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/command", mockSetLocation],
}));

describe("RoleGate", () => {
  it("renders content for an allowed role", () => {
    mockUser = { role: "admin" };
    const view = render(<RoleGate roles={["admin"]}><span>Command Workspace Content</span></RoleGate>);
    expect(view.getByText("Command Workspace Content")).toBeTruthy();
    view.unmount();
  });

  it("redirects a wrong role and does not render protected content", () => {
    mockUser = { role: "user" };
    render(<RoleGate roles={["admin"]}><span>Command Workspace Content</span></RoleGate>);
    expect(screen.queryByText("Command Workspace Content")).toBeNull();
    expect(mockSetLocation).toHaveBeenCalledWith("/");
  });
});
