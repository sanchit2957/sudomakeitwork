import { describe, expect, it } from "vitest";
import { isSupabaseConfigured, supabase } from "./supabase";

describe("Supabase Integration Helper", () => {
  it("initializes supabase client when project credentials are configured", () => {
    expect(isSupabaseConfigured()).toBe(true);
    expect(supabase).toBeDefined();
    expect(supabase?.auth).toBeDefined();
  });
});
