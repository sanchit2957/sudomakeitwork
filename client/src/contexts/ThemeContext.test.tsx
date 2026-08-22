// @vitest-environment jsdom
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme}</button>;
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("persists the selected theme and applies the dark root class", () => {
    const view = render(<ThemeProvider switchable><ThemeProbe /></ThemeProvider>);
    const toggle = view.getByRole("button", { name: "light" });
    fireEvent.click(toggle);
    expect(view.getByRole("button", { name: "dark" })).toBeTruthy();
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
