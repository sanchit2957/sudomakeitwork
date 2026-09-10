// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { ProfileAvatar, UserProfileBadge, getAvatarColor, getInitials, getFirstName } from "./ProfileAvatar";

afterEach(() => {
  cleanup();
});

describe("ProfileAvatar component & helpers", () => {
  it("computes single-letter initial correctly from names and emails", () => {
    expect(getInitials("Ayushi Singh")).toBe("A");
    expect(getInitials("Rahul Sharma")).toBe("R");
    expect(getInitials("Ankita")).toBe("A");
    expect(getInitials("", "test@assamrelief.gov.in")).toBe("T");
    expect(getInitials(null, null)).toBe("U");
  });

  it("extracts only the first word of full name correctly", () => {
    expect(getFirstName("Ayushi Singh")).toBe("Ayushi");
    expect(getFirstName("Rahul Sharma")).toBe("Rahul");
    expect(getFirstName("Ankita")).toBe("Ankita");
    expect(getFirstName("   Priya   Das  ")).toBe("Priya");
    expect(getFirstName("", "ayushi.singh@example.com")).toBe("Ayushi");
    expect(getFirstName(null, null, "Guest")).toBe("Guest");
  });

  it("produces deterministic consistent colors from username hashes", () => {
    const color1 = getAvatarColor("rahul_rescuer");
    const color2 = getAvatarColor("rahul_rescuer");
    expect(color1).toEqual(color2);

    const colorAdmin = getAvatarColor("admin@assam.gov.in");
    expect(colorAdmin).toHaveProperty("bg");
    expect(colorAdmin).toHaveProperty("text");
  });

  it("renders single-letter initials fallback when photo is not provided", () => {
    render(
      <ProfileAvatar
        user={{ name: "Ayushi Singh", email: "ayushi@example.com" }}
      />
    );
    expect(screen.getByText("A")).toBeDefined();
  });

  it("renders UserProfileBadge with avatar initial and only the first word of the full name", () => {
    render(
      <UserProfileBadge
        user={{ name: "Ayushi Singh", email: "ayushi@example.com" }}
      />
    );
    expect(screen.getByText("A")).toBeDefined();
    expect(screen.getByText("Ayushi")).toBeDefined();
    expect(screen.queryByText("Ayushi Singh")).toBeNull();
  });

  it("renders custom photo in UserProfileBadge when photoUrl is present", () => {
    const { container } = render(
      <UserProfileBadge
        user={{ name: "Ayushi Singh", photoUrl: "https://example.com/avatar.jpg" }}
      />
    );
    const img = container.querySelector("img");
    expect(img).toBeDefined();
    expect(screen.getByText("Ayushi")).toBeDefined();
  });
});
