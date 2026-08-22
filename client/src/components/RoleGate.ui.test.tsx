// @vitest-environment jsdom
import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false, logout: vi.fn() }) }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ t: (value: string) => value }) }));
vi.mock("@/components/LanguageSelector", () => ({ default: () => <span>Language</span> }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/", vi.fn()] }));

import { RoleGate } from "./RoleGate";

describe("RoleGate protected access portals", () => {
  it("presents separate secure-entry copy for Command, Medical, and Rescuer workspaces", () => {
    const command = render(<RoleGate roles={["admin"]}><span>hidden</span></RoleGate>);
    expect(command.getByText("Government Command access")).toBeTruthy();
    command.unmount();
    const medical = render(<RoleGate roles={["medical"]}><span>hidden</span></RoleGate>);
    expect(medical.getByText("Medical Operations access")).toBeTruthy();
    medical.unmount();
    const responder = render(<RoleGate roles={["rescuer"]}><span>hidden</span></RoleGate>);
    expect(responder.getByText("Rescuer secure access")).toBeTruthy();
  });
});
