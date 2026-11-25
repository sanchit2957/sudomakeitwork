import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import {
  COOKIE_NAME,
  PORTAL_COOKIE_NAMES,
  PORTAL_HEADER_NAME,
  PORTAL_IDS,
  getPortalForPath,
  getPortalLoginPath,
} from "../shared/const";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { sdk } from "./_core/sdk";
import { setRoleAccessCode, upsertUser } from "./db";
import { hashPassword } from "./auth.password";
import {
  portalStreamRouter,
  broadcastPortalEvent,
  getPortalSseStats,
} from "./realtime/portalStream";

function parseSetCookieHeader(setCookies: string[]): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const header of setCookies) {
    const firstPart = header.split(";")[0];
    const eqIndex = firstPart.indexOf("=");
    if (eqIndex > 0) {
      const name = firstPart.slice(0, eqIndex).trim();
      const val = firstPart.slice(eqIndex + 1).trim();
      if (val === "" || header.toLowerCase().includes("max-age=0") || header.toLowerCase().includes("expires=thu, 01 jan 1970")) {
        delete jar[name];
      } else {
        jar[name] = decodeURIComponent(val);
      }
    }
  }
  return jar;
}

function serializeCookieJar(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("; ");
}

async function readSseUntil(
  url: string,
  cookieHeader: string,
  predicate: (frames: Array<{ event: string; data: any }>) => boolean,
  timeoutMs = 5000
): Promise<{
  status: number;
  frames: Array<{ event: string; data: any }>;
  close: () => void;
}> {
  const controller = new AbortController();
  const res = await fetch(url, {
    headers: {
      Cookie: cookieHeader,
    },
    signal: controller.signal,
  });

  if (res.status !== 200 || !res.body) {
    return { status: res.status, frames: [], close: () => controller.abort() };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const frames: Array<{ event: string; data: any }> = [];
  let buffer = "";

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate(frames)) break;
    const race = await Promise.race([
      reader.read(),
      new Promise<{ done: true; value: undefined }>((resolve) =>
        setTimeout(() => resolve({ done: true, value: undefined }), Math.max(50, deadline - Date.now()))
      ),
    ]);
    if (race.value) {
      buffer += decoder.decode(race.value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        if (!block.trim() || block.startsWith(":")) continue;
        let evt = "message";
        let dataStr = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) evt = line.slice(6).trim();
          else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
        }
        if (dataStr) {
          try {
            frames.push({ event: evt, data: JSON.parse(dataStr) });
          } catch {
            frames.push({ event: evt, data: dataStr });
          }
        }
      }
      if (predicate(frames)) break;
    } else if (race.done) {
      break;
    }
  }

  return {
    status: res.status,
    frames,
    close: () => {
      try {
        controller.abort();
      } catch {}
    },
  };
}

describe("Multi-Portal Independent Session Architecture & SSE Streams", () => {
  let server: Server;
  let baseUrl = "";

  const uniqueSuffix = Date.now();
  const citizenEmail = `citizen_multi_${uniqueSuffix}@example.com`;
  const citizenBEmail = `citizen_b_${uniqueSuffix}@example.com`;
  const rescuerEmail = `rescuer_multi_${uniqueSuffix}@assamrescue.gov.in`;
  const hospitalEmail = `hospital_multi_${uniqueSuffix}@assamrescue.gov.in`;
  const adminEmail = `admin_multi_${uniqueSuffix}@assamrescue.gov.in`;

  beforeAll(async () => {
    await setRoleAccessCode("rescuer", "RESC-MULTI-TEST", 1);
    await setRoleAccessCode("hospital", "HOSP-MULTI-TEST", 1);

    await upsertUser({
      openId: `user-citizen-${uniqueSuffix}`,
      name: "Citizen One",
      email: citizenEmail,
      password: hashPassword("pass-citizen"),
      role: "user",
      status: "active",
      loginMethod: "platform-login",
    });

    await upsertUser({
      openId: `user-citizen-b-${uniqueSuffix}`,
      name: "Citizen Two",
      email: citizenBEmail,
      password: hashPassword("pass-citizen-b"),
      role: "user",
      status: "active",
      loginMethod: "platform-login",
    });

    await upsertUser({
      openId: `user-rescuer-${uniqueSuffix}`,
      name: "Rescuer One",
      email: rescuerEmail,
      password: hashPassword("pass-rescuer"),
      role: "rescuer",
      status: "active",
      loginMethod: "platform-login",
    });

    await upsertUser({
      openId: `user-hospital-${uniqueSuffix}`,
      name: "Hospital Officer",
      email: hospitalEmail,
      password: hashPassword("pass-hospital"),
      role: "hospital",
      status: "active",
      loginMethod: "platform-login",
    });

    await upsertUser({
      openId: `user-admin-${uniqueSuffix}`,
      name: "Command Admin",
      email: adminEmail,
      password: hashPassword("pass-admin"),
      role: "admin",
      status: "active",
      loginMethod: "platform-login",
    });

    const app = express();
    app.use(express.json());
    app.use(portalStreamRouter);
    app.use(
      "/api/trpc",
      createExpressMiddleware({
        router: appRouter,
        createContext,
      })
    );

    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("maps every LifeLink route cleanly to its own portal without overlap", () => {
    expect(new Set(Object.values(PORTAL_COOKIE_NAMES)).size).toBe(4);
    expect(getPortalForPath("/")).toBe("citizen");
    expect(getPortalForPath("/login")).toBe("citizen");
    expect(getPortalForPath("/track")).toBe("citizen");
    expect(getPortalForPath("/hospital/register")).toBe("citizen");

    expect(getPortalForPath("/responder")).toBe("rescuer");
    expect(getPortalForPath("/responder/login")).toBe("rescuer");

    expect(getPortalForPath("/hospital")).toBe("hospital");
    expect(getPortalForPath("/hospital/login")).toBe("hospital");
    expect(getPortalForPath("/medical")).toBe("hospital");

    expect(getPortalForPath("/admin/login")).toBe("admin");
    expect(getPortalForPath("/command")).toBe("admin");

    expect(getPortalLoginPath("citizen")).toBe("/login");
    expect(getPortalLoginPath("rescuer")).toBe("/responder/login");
    expect(getPortalLoginPath("hospital")).toBe("/hospital/login");
    expect(getPortalLoginPath("admin")).toBe("/admin/login");
  });

  it("maintains 4 completely independent portal cookies in the same browser jar simultaneously", async () => {
    const browserCookieJar: Record<string, string> = {};

    async function trpcCall(path: string, portal: string, method: "GET" | "POST", body?: unknown) {
      const headers: Record<string, string> = {
        [PORTAL_HEADER_NAME]: portal,
        Cookie: serializeCookieJar(browserCookieJar),
      };
      if (method === "POST") headers["Content-Type"] = "application/json";

      const url =
        method === "GET" && body !== undefined
          ? `${baseUrl}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: body }))}`
          : `${baseUrl}/api/trpc/${path}`;

      const res = await fetch(url, {
        method,
        headers,
        body: method === "POST" ? JSON.stringify({ json: body }) : undefined,
      });

      const setCookie = res.headers.getSetCookie?.() || [];
      Object.assign(browserCookieJar, parseSetCookieHeader(setCookie));
      for (const h of setCookie) {
        const first = h.split(";")[0];
        const eq = first.indexOf("=");
        if (eq > 0 && first.slice(eq + 1) === "") {
          delete browserCookieJar[first.slice(0, eq).trim()];
        }
      }

      const json = await res.json();
      return { status: res.status, json };
    }

    // 1. Login to Citizen portal
    const citLogin = await trpcCall("auth.login", "citizen", "POST", {
      email: citizenEmail,
      password: "pass-citizen",
      role: "user",
      portal: "citizen",
    });
    expect(citLogin.status).toBe(200);
    expect(browserCookieJar[PORTAL_COOKIE_NAMES.citizen]).toBeDefined();

    // 2. Login to Rescuer portal in same browser
    const resLogin = await trpcCall("auth.login", "rescuer", "POST", {
      email: rescuerEmail,
      password: "pass-rescuer",
      role: "rescuer",
      governmentCode: "RESC-MULTI-TEST",
      portal: "rescuer",
    });
    expect(resLogin.status).toBe(200);
    expect(browserCookieJar[PORTAL_COOKIE_NAMES.rescuer]).toBeDefined();
    expect(browserCookieJar[PORTAL_COOKIE_NAMES.citizen]).toBeDefined();

    // 3. Login to Hospital portal in same browser
    const hospLogin = await trpcCall("auth.login", "hospital", "POST", {
      email: hospitalEmail,
      password: "pass-hospital",
      role: "hospital",
      governmentCode: "HOSP-MULTI-TEST",
      portal: "hospital",
    });
    expect(hospLogin.status).toBe(200);
    expect(browserCookieJar[PORTAL_COOKIE_NAMES.hospital]).toBeDefined();

    // 4. Login to Admin portal in same browser
    const admLogin = await trpcCall("auth.login", "admin", "POST", {
      email: adminEmail,
      password: "pass-admin",
      role: "admin",
      portal: "admin",
    });
    expect(admLogin.status).toBe(200);
    expect(browserCookieJar[PORTAL_COOKIE_NAMES.admin]).toBeDefined();

    // 5. All 4 portals report their own distinct user when queried concurrently with the SAME cookie jar
    const [meCit, meRes, meHosp, meAdm] = await Promise.all([
      trpcCall("auth.me", "citizen", "GET", { portal: "citizen" }),
      trpcCall("auth.me", "rescuer", "GET", { portal: "rescuer" }),
      trpcCall("auth.me", "hospital", "GET", { portal: "hospital" }),
      trpcCall("auth.me", "admin", "GET", { portal: "admin" }),
    ]);

    expect(meCit.json.result.data.json.email).toBe(citizenEmail);
    expect(meRes.json.result.data.json.email).toBe(rescuerEmail);
    expect(meHosp.json.result.data.json.email).toBe(hospitalEmail);
    expect(meAdm.json.result.data.json.email).toBe(adminEmail);

    // 6. Reject cross-portal JWT replay (citizen token stuffed into admin cookie)
    const spoofedReq = {
      headers: {
        [PORTAL_HEADER_NAME]: "admin",
        cookie: `${PORTAL_COOKIE_NAMES.admin}=${browserCookieJar[PORTAL_COOKIE_NAMES.citizen]}`,
      },
      query: {},
    } as any;
    await expect(sdk.authenticateRequest(spoofedReq)).rejects.toThrow(/portal/i);

    // 7. Logging out of Admin clears ONLY app_session_admin and leaves the other 3 portals logged in
    const logoutAdm = await trpcCall("auth.logout", "admin", "POST", { portal: "admin" });
    expect(logoutAdm.status).toBe(200);
    expect(browserCookieJar[PORTAL_COOKIE_NAMES.admin]).toBeUndefined();
    expect(browserCookieJar[PORTAL_COOKIE_NAMES.citizen]).toBeDefined();
    expect(browserCookieJar[PORTAL_COOKIE_NAMES.rescuer]).toBeDefined();
    expect(browserCookieJar[PORTAL_COOKIE_NAMES.hospital]).toBeDefined();

    const [afterCit, afterRes, afterHosp, afterAdm] = await Promise.all([
      trpcCall("auth.me", "citizen", "GET", { portal: "citizen" }),
      trpcCall("auth.me", "rescuer", "GET", { portal: "rescuer" }),
      trpcCall("auth.me", "hospital", "GET", { portal: "hospital" }),
      trpcCall("auth.me", "admin", "GET", { portal: "admin" }),
    ]);

    expect(afterCit.json.result.data.json.email).toBe(citizenEmail);
    expect(afterRes.json.result.data.json.email).toBe(rescuerEmail);
    expect(afterHosp.json.result.data.json.email).toBe(hospitalEmail);
    expect(afterAdm.json.result.data.json).toBeNull();
  });

  it("streams independent portal SSE connections without cross-user leakage or cross-portal disconnects", async () => {
    const citToken = await sdk.createSessionToken(`user-citizen-${uniqueSuffix}`, {
      name: "Citizen One",
      portal: "citizen",
    });
    const citBToken = await sdk.createSessionToken(`user-citizen-b-${uniqueSuffix}`, {
      name: "Citizen Two",
      portal: "citizen",
    });
    const { getRoleCodeVersion } = await import("./db");
    const resCodeVer = await getRoleCodeVersion("rescuer");
    const hospCodeVer = await getRoleCodeVersion("hospital");

    const resToken = await sdk.createSessionToken(`user-rescuer-${uniqueSuffix}`, {
      name: "Rescuer One",
      portal: "rescuer",
      codeVersion: resCodeVer,
    });
    const hospToken = await sdk.createSessionToken(`user-hospital-${uniqueSuffix}`, {
      name: "Hospital Officer",
      portal: "hospital",
      codeVersion: hospCodeVer,
    });
    const admToken = await sdk.createSessionToken(`user-admin-${uniqueSuffix}`, {
      name: "Command Admin",
      portal: "admin",
    });

    // Browser jar holds all 4 portal tokens simultaneously
    const jar = serializeCookieJar({
      [PORTAL_COOKIE_NAMES.citizen]: citToken,
      [PORTAL_COOKIE_NAMES.rescuer]: resToken,
      [PORTAL_COOKIE_NAMES.hospital]: hospToken,
      [PORTAL_COOKIE_NAMES.admin]: admToken,
    });

    // Verify unauthorized portal SSE connection fails cleanly
    const unauthAdmin = await fetch(`${baseUrl}/api/realtime/stream?portal=admin`, {
      headers: { Cookie: serializeCookieJar({ [PORTAL_COOKIE_NAMES.citizen]: citToken }) },
    });
    expect(unauthAdmin.status).toBe(401);

    // Connect Citizen A, Citizen B, Rescuer, Hospital, Admin streams concurrently
    const citStreamPromise = readSseUntil(
      `${baseUrl}/api/realtime/stream?portal=citizen`,
      jar,
      (frames) => frames.some((f) => f.event === "incident_update")
    );
    const citBStreamPromise = readSseUntil(
      `${baseUrl}/api/realtime/stream?portal=citizen`,
      serializeCookieJar({ [PORTAL_COOKIE_NAMES.citizen]: citBToken }),
      (frames) => frames.some((f) => f.event === "hospital_update")
    );
    const resStreamPromise = readSseUntil(
      `${baseUrl}/api/realtime/stream?portal=rescuer`,
      jar,
      (frames) => frames.some((f) => f.event === "access_code_revoked")
    );
    const hospStreamPromise = readSseUntil(
      `${baseUrl}/api/realtime/stream?portal=hospital`,
      jar,
      (frames) => frames.some((f) => f.event === "hospital_update")
    );
    const admStreamPromise = readSseUntil(
      `${baseUrl}/api/realtime/stream?portal=admin`,
      jar,
      (frames) => frames.some((f) => f.event === "incident_update")
    );

    // Give connections a brief moment to register
    await new Promise((r) => setTimeout(r, 150));

    const statsBefore = getPortalSseStats();
    expect(statsBefore.byPortal.citizen).toBeGreaterThanOrEqual(2);
    expect(statsBefore.byPortal.rescuer).toBeGreaterThanOrEqual(1);
    expect(statsBefore.byPortal.hospital).toBeGreaterThanOrEqual(1);
    expect(statsBefore.byPortal.admin).toBeGreaterThanOrEqual(1);

    // Lookup Citizen A's ID from DB/memory
    const { getUserByEmail } = await import("./db");
    const citUserA = await getUserByEmail(citizenEmail, "user");

    // Broadcast private incident update for Citizen A -> Citizen B must NOT receive it
    broadcastPortalEvent({
      type: "incident_update",
      portals: ["admin", "citizen"],
      targetUserIds: citUserA ? [citUserA.id] : [],
      publicCode: "SOS-TEST1234",
      action: "created",
    });

    // Broadcast public hospital update
    broadcastPortalEvent({
      type: "hospital_update",
      portals: ["citizen", "hospital"],
      action: "resources_updated",
    });

    // Broadcast rescuer code revocation -> ONLY rescuer gets it
    broadcastPortalEvent({
      type: "access_code_revoked",
      portals: ["rescuer"],
      action: "code_updated",
    });

    const [citRes, citBRes, resRes, hospRes, admRes] = await Promise.all([
      citStreamPromise,
      citBStreamPromise,
      resStreamPromise,
      hospStreamPromise,
      admStreamPromise,
    ]);

    expect(citRes.frames.some((f) => f.event === "incident_update")).toBe(true);
    expect(citBRes.frames.some((f) => f.event === "incident_update")).toBe(false);
    expect(citBRes.frames.some((f) => f.event === "hospital_update")).toBe(true);
    expect(resRes.frames.some((f) => f.event === "access_code_revoked")).toBe(true);
    expect(hospRes.frames.some((f) => f.event === "access_code_revoked")).toBe(false);
    expect(hospRes.frames.some((f) => f.event === "hospital_update")).toBe(true);
    expect(admRes.frames.some((f) => f.event === "incident_update")).toBe(true);

    // Disconnecting admin does not disturb citizen/hospital/rescuer
    admRes.close();
    await new Promise((r) => setTimeout(r, 80));
    expect(getPortalSseStats().byPortal.hospital).toBeGreaterThanOrEqual(1);

    citRes.close();
    citBRes.close();
    resRes.close();
    hospRes.close();
  });
});
