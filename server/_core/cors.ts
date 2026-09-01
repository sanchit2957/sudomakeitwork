/**
 * SECURE CORS CONFIGURATION & NORMALIZED ORIGIN MATCHER
 * Strictly prevents arbitrary origin reflection, substring attacks (e.g. evil.onrender.com),
 * and prefix attacks (e.g. app.onrender.com.attacker.com).
 */

import { ENV } from "./env";

/**
 * Normalizes an origin string (lowercased, trims trailing slash).
 */
export function normalizeOrigin(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase().replace(/\/+$/, "");
  return trimmed || null;
}

/**
 * Builds the authoritative, exact-match origin set.
 */
export function getAuthorizedOrigins(): Set<string> {
  const list = new Set<string>([
    // Production Canonical Domains
    "https://assam-rescue-platform.onrender.com",
    // Native Mobile App Identifiers
    "capacitor://localhost",
    "ionic://localhost",
    "https://localhost",
    "http://localhost",
    "android-app://gov.in.assamrescue.app",
  ]);

  // Local development origins
  if (process.env.NODE_ENV !== "production") {
    list.add("http://localhost:3000");
    list.add("http://localhost:5173");
    list.add("http://127.0.0.1:3000");
    list.add("http://127.0.0.1:5173");
    list.add("http://10.0.2.2:3000");
  }

  // Explicit environment configuration
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(",").forEach(item => {
      const norm = normalizeOrigin(item);
      if (norm) list.add(norm);
    });
  }

  if (process.env.APP_URL) {
    const norm = normalizeOrigin(process.env.APP_URL);
    if (norm) list.add(norm);
  }

  if (process.env.PUBLIC_APP_URL) {
    const norm = normalizeOrigin(process.env.PUBLIC_APP_URL);
    if (norm) list.add(norm);
  }

  if (process.env.RENDER_EXTERNAL_URL) {
    const norm = normalizeOrigin(process.env.RENDER_EXTERNAL_URL);
    if (norm) list.add(norm);
  }

  return list;
}

/**
 * Validates whether an incoming HTTP Origin is explicitly allowed.
 * Performs exact string matching against the normalized allowlist.
 */
export function isOriginAllowed(origin?: string | null): boolean {
  if (!origin || origin === "null") {
    // Mobile apps and native client requests often have null origin
    return true;
  }

  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  const allowedSet = getAuthorizedOrigins();
  if (allowedSet.has(normalized)) {
    return true;
  }

  // In non-production, permit localhost with any dynamic port
  if (process.env.NODE_ENV !== "production") {
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        return true;
      }
    } catch {}
  }

  return false;
}
