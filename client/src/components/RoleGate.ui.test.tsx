// @vitest-environment jsdom
import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { RoleGate } from "./RoleGate";

describe("RoleGate open access portals", () => {
  it("renders workspace children directly without login barriers", () => {
    const command = render(<RoleGate roles={["admin"]}><span>Command Workspace Content</span></RoleGate>);
    expect(command.getByText("Command Workspace Content")).toBeTruthy();
    command.unmount();

    const medical = render(<RoleGate roles={["medical"]}><span>Medical Workspace Content</span></RoleGate>);
    expect(medical.getByText("Medical Workspace Content")).toBeTruthy();
    medical.unmount();

    const responder = render(<RoleGate roles={["rescuer"]}><span>Responder Workspace Content</span></RoleGate>);
    expect(responder.getByText("Responder Workspace Content")).toBeTruthy();
  });
});
