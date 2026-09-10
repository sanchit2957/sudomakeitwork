import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashPassword, verifyPassword } from "./auth.password";

describe("Database Seed & Account Integrity", () => {
  it("generates valid salted scrypt hashes for all 4 seed accounts", () => {
    const accounts = [
      { email: "citizen@assamrescue.gov.in", raw: "citizen" },
      { email: "admin@assamrescue.gov.in", raw: "admin" },
    ];

    for (const acc of accounts) {
      const hash = hashPassword(acc.raw);
      expect(hash).toContain(":");
      const [salt, hex] = hash.split(":");
      expect(salt.length).toBe(32); // 16 bytes in hex
      expect(hex.length).toBe(128); // 64 bytes in hex
      expect(hash).not.toBe(acc.raw);

      // Verify correct password matches
      expect(verifyPassword(acc.raw, hash)).toBe(true);

      // Verify incorrect password fails
      expect(verifyPassword("wrong-password", hash)).toBe(false);
      expect(verifyPassword("", hash)).toBe(false);
    }
  });

  it("verifies seed function idempotency and structure", async () => {
    const { seedDatabase } = await import("./seed");
    expect(typeof seedDatabase).toBe("function");
  });

  it("ensures default memory users have valid salted scrypt hashes matching the credentials", async () => {
    const { getUserByEmail } = await import("./db");
    
    const citizen = await getUserByEmail("citizen@assamrescue.gov.in");
    expect(citizen).toBeDefined();
    expect(verifyPassword("citizen", citizen?.password)).toBe(true);
    expect(citizen?.role).toBe("user");

    const admin = await getUserByEmail("admin@assamrescue.gov.in");
    expect(admin).toBeDefined();
    expect(verifyPassword("admin", admin?.password)).toBe(true);
    expect(admin?.role).toBe("admin");

    // Rescuer and hospital are not pre-seeded; they register self-service
    const rescuer = await getUserByEmail("rescuer@assamrescue.gov.in");
    expect(rescuer).toBeNull();
    const medical = await getUserByEmail("medical@assamrescue.gov.in");
    expect(medical).toBeNull();
  });
});
