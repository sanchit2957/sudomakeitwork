export type PortalId = "citizen" | "rescuer" | "hospital" | "admin";

export const PORTAL_IDS: readonly PortalId[] = [
  "citizen",
  "rescuer",
  "hospital",
  "admin",
] as const;

export const PORTAL_HEADER_NAME = "x-lifelink-portal";

export const PORTAL_COOKIE_NAMES: Record<PortalId, string> = {
  citizen: "app_session_citizen",
  rescuer: "app_session_rescuer",
  hospital: "app_session_hospital",
  admin: "app_session_admin",
};

export function isPortalId(value: unknown): value is PortalId {
  return (
    value === "citizen" ||
    value === "rescuer" ||
    value === "hospital" ||
    value === "admin"
  );
}

export function normalizePortalId(value: unknown): PortalId | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return isPortalId(normalized) ? normalized : null;
}

export function getPortalCookieName(
  portal: PortalId | null | undefined,
  legacyCookieName = "app_session_id"
): string {
  if (portal && isPortalId(portal)) {
    return PORTAL_COOKIE_NAMES[portal];
  }
  return legacyCookieName;
}

/**
 * Deterministically maps an application route path to one of the four LifeLink portals.
 * Note: `/hospital/register` is citizen-facing onboarding, so it belongs to `citizen`.
 */
export function getPortalForPath(pathname: string): PortalId {
  const path = (pathname || "/").split("?")[0].toLowerCase();

  if (
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/command" ||
    path.startsWith("/command/")
  ) {
    return "admin";
  }

  if (path === "/responder" || path.startsWith("/responder/")) {
    return "rescuer";
  }

  if (path === "/hospital/register" || path.startsWith("/hospital/register/")) {
    return "citizen";
  }

  if (
    path === "/hospital" ||
    path.startsWith("/hospital/") ||
    path === "/medical" ||
    path.startsWith("/medical/")
  ) {
    return "hospital";
  }

  return "citizen";
}

export function getPortalLoginPath(portal: PortalId): string {
  switch (portal) {
    case "admin":
      return "/admin/login";
    case "rescuer":
      return "/responder/login";
    case "hospital":
      return "/hospital/login";
    case "citizen":
    default:
      return "/login";
  }
}

export function getPortalDashboardPath(portal: PortalId): string {
  switch (portal) {
    case "admin":
      return "/command";
    case "rescuer":
      return "/responder";
    case "hospital":
      return "/hospital";
    case "citizen":
    default:
      return "/";
  }
}

export function isRoleAllowedInPortal(
  role: string | null | undefined,
  portal: PortalId
): boolean {
  if (!role) return false;
  switch (portal) {
    case "admin":
      return role === "admin";
    case "hospital":
      return role === "hospital" || role === "medical" || role === "admin";
    case "rescuer":
      return role === "rescuer" || role === "admin";
    case "citizen":
      return (
        role === "user" ||
        role === "admin" ||
        role === "rescuer" ||
        role === "hospital" ||
        role === "medical"
      );
    default:
      return false;
  }
}
