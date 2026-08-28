import { describe, expect, it } from "vitest";
import { isSupabaseConfigured } from "./supabase";

describe("Supabase Integration Helper", () => {
  it("safely detects unconfigured or template supabase configurations", () => {
    // When environment variables are empty or placeholders, it should return false
    expect(isSupabaseConfigured()).toBe(false);
  });
});
