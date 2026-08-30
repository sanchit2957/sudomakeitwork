import { describe, expect, it } from "vitest";
import { mayEditPostAlertDetails } from "./post-alert-details.policy";

describe("post-alert SOS detail policy", () => {
  it("allows only the reporting victim to add people and help details while a SOS is active", () => {
    expect(mayEditPostAlertDetails(7, 7, "pending")).toBe(true);
    expect(mayEditPostAlertDetails(7, 7, "dispatched")).toBe(true);
    expect(mayEditPostAlertDetails(7, 9, "pending")).toBe(false);
    expect(mayEditPostAlertDetails(null, 7, "pending")).toBe(false);
  });

  it("prevents all post-alert edits once a SOS is resolved", () => {
    expect(mayEditPostAlertDetails(7, 7, "resolved")).toBe(false);
  });
});
