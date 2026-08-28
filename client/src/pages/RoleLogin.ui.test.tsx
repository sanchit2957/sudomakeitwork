// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MedicalLogin, RescuerLogin } from "./RoleLogin";

const runtime = vi.hoisted(() => ({ login: vi.fn(), logout: vi.fn(), navigate: vi.fn() }));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ login: runtime.login, logout: runtime.logout }) }));
vi.mock("@/components/LanguageSelector", () => ({ default: () => <span>Language</span> }));
vi.mock("wouter", () => ({ useLocation: () => ["/portal/login", runtime.navigate] }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("dedicated operational portal login", () => {
  it.each([
    ["rescuer", RescuerLogin, { role: "rescuer" }, "/responder"],
    ["medical", MedicalLogin, { role: "medical" }, "/medical"],
  ] as const)("%s accepts only its trusted role", async (_name, Component, user, destination) => {
    runtime.login.mockResolvedValueOnce({ user });
    render(<Component />);
    fireEvent.change(screen.getByLabelText("Email or Username"), { target: { value: "account" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Sign In to ${_name}`, "i") }));
    await waitFor(() => expect(runtime.navigate).toHaveBeenCalledWith(destination));
  });

  it.each([
    ["rescuer", RescuerLogin, { role: "user" }],
    ["medical", MedicalLogin, { role: "user" }],
    ["medical", MedicalLogin, { role: "rescuer" }],
    ["rescuer", RescuerLogin, { role: "medical" }],
  ] as const)("%s denies a different trusted role and clears the session", async (_name, Component, user) => {
    runtime.login.mockResolvedValueOnce({ user });
    runtime.logout.mockResolvedValueOnce({});
    render(<Component />);
    fireEvent.change(screen.getByLabelText("Email or Username"), { target: { value: "account" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Sign In to ${_name}`, "i") }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/not authorized/i));
    expect(runtime.logout).toHaveBeenCalled();
    expect(runtime.navigate).not.toHaveBeenCalledWith(_name === "rescuer" ? "/responder" : "/medical");
  });
});
