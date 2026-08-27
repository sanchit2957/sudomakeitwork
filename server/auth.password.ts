import crypto from "crypto";

/**
 * Generates a salted scrypt hash for a plaintext password.
 * Format: `<salt_hex>:<hash_hex>`
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a stored salted hash.
 * Uses timing-safe equality comparison.
 */
export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || typeof storedHash !== "string" || !storedHash.includes(":")) {
    return false;
  }
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) {
    return false;
  }
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expectedHash, "hex");
    if (derivedKey.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(derivedKey, expectedBuffer);
  } catch {
    return false;
  }
}
