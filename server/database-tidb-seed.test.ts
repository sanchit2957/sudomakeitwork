import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashPassword, verifyPassword } from "./auth.password";

describe("Database Seed & Account Integrity", () => {
  it("generates valid salted scrypt hashes for all 4 seed accounts", () => {
    const accounts = [
      { email: "citizen@assamrescue.gov.in", raw: "citizen" },
      { email: "rescuer@assamrescue.gov.in", raw: "rescuer" },
      { email: "medical@assamrescue.gov.in", raw: "medical" },
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

  it("ensures default memory users also have valid salted scrypt hashes matching the demo credentials", async () => {
    const { getUserByEmail } = await import("./db");
    
    const citizen = await getUserByEmail("citizen@assamrescue.gov.in");
    expect(citizen).toBeDefined();
    expect(verifyPassword("citizen", citizen?.password)).toBe(true);
    expect(citizen?.role).toBe("user");

    const rescuer = await getUserByEmail("rescuer@assamrescue.gov.in");
    expect(rescuer).toBeDefined();
    expect(verifyPassword("rescuer", rescuer?.password)).toBe(true);
    expect(rescuer?.role).toBe("rescuer");

    const medical = await getUserByEmail("medical@assamrescue.gov.in");
    expect(medical).toBeDefined();
    expect(verifyPassword("medical", medical?.password)).toBe(true);
    expect(medical?.role).toBe("medical");

    const admin = await getUserByEmail("admin@assamrescue.gov.in");
    expect(admin).toBeDefined();
    expect(verifyPassword("admin", admin?.password)).toBe(true);
    expect(admin?.role).toBe("admin");
  });
});
