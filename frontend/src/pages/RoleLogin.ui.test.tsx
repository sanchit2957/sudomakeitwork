// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HospitalLogin, RescuerLogin } from "./RoleLogin";

const runtime = vi.hoisted(() => ({ login: vi.fn(), logout: vi.fn(), navigate: vi.fn() }));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ login: runtime.login, logout: runtime.logout }) }));
vi.mock("@/components/LanguageSelector", () => ({ default: () => <span>Language</span> }));
vi.mock("wouter", () => ({ useLocation: () => ["/portal/login", runtime.navigate] }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("dedicated operational portal login", () => {
  it.each([
    ["rescuer", RescuerLogin, { role: "rescuer" }, "/responder"],
    ["hospital", HospitalLogin, { role: "hospital" }, "/hospital"],
  ] as const)("%s accepts only its trusted role", async (_name, Component, user, destination) => {
    runtime.login.mockResolvedValueOnce({ user });
    render(<Component />);
    fireEvent.change(screen.getByLabelText("Email or Username"), { target: { value: "account" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.change(screen.getByPlaceholderText(/Government Access Code/i), { target: { value: "GOV-CODE-123" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Sign In as`, "i") }));
    await waitFor(() => expect(runtime.navigate).toHaveBeenCalledWith(destination));
  });

  it.each([
    ["rescuer", RescuerLogin, { role: "user" }],
    ["hospital", HospitalLogin, { role: "user" }],
    ["hospital", HospitalLogin, { role: "rescuer" }],
    ["rescuer", RescuerLogin, { role: "hospital" }],
  ] as const)("%s denies a different trusted role and clears the session", async (_name, Component, user) => {
    runtime.login.mockResolvedValueOnce({ user });
    runtime.logout.mockResolvedValueOnce({});
    render(<Component />);
    fireEvent.change(screen.getByLabelText("Email or Username"), { target: { value: "account" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.change(screen.getByPlaceholderText(/Government Access Code/i), { target: { value: "GOV-CODE-123" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Sign In as`, "i") }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/not authorized/i));
    expect(runtime.logout).toHaveBeenCalled();
    expect(runtime.navigate).not.toHaveBeenCalledWith(_name === "rescuer" ? "/responder" : "/hospital");
  });
});
