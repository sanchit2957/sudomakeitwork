# CURRENT PRODUCTION STATUS & ARCHITECTURAL SPECIFICATION
Assam Emergency Response Platform — `sudomakeitwork`

## 1. System Architecture Overview
The Assam Emergency Response Platform is a mission-critical emergency orchestration platform designed for disaster response in Assam, India. It coordinates citizen SOS distress alerts, automated capability-based responder dispatch, live road routing, hospital triage, and multi-channel notifications.

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 Citizen Mobile/Web App                 │
                  └───────────┬────────────────────────────────┬───────────┘
                              │ SOS Request / Tracking Stream  │ Web Push
                              ▼                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   Assam Emergency Backend (Node.js/Express)              │
│                                                                          │
│  ┌───────────────────────┐  ┌─────────────────────┐  ┌────────────────┐ │
│  │ tRPC Mutation/Queries │  │ SSE Streaming Hub   │  │ OSRM Routing   │ │
│  │ (Auth, Incidents)     │  │ (Live Rescuer GPS)  │  │ & ETA Engine   │ │
│  └───────────┬───────────┘  └───────────▲─────────┘  └───────▲────────┘ │
└──────────────┼──────────────────────────┼────────────────────┼───────────┘
               │                          │                    │
               ▼                          │                    │
┌──────────────────────────────┐          │                    │
│ TiDB / MySQL Database        ├──────────┴────────────────────┘
│ (Authoritative Source)       │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ n8n Automation Engine        │ (Webhook Delivery & Escalation)
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ 360dialog / WhatsApp API     │ (Encrypted WhatsApp Citizen Alert)
└──────────────────────────────┘
```

---

## 2. Canonical Routes & Entry Points

### Citizen Surface
- **Home / SOS Initiation:** `/` (`client/src/pages/Home.tsx`)
- **Dedicated SOS Tracking Page:** `/track?code=SOS-XXXXXXXX` (`client/src/pages/Track.tsx`)
- **Unified Rescue Flow:** `/flow?code=SOS-XXXXXXXX` (`client/src/pages/user/UserTrackFlow.tsx`)
- **Citizen Profile & Medical Info:** `/user/profile` (`client/src/pages/user/UserProfile.tsx`)
- **Offline Safety Guides:** `/safety` (`client/src/pages/Safety.tsx`)
- **Live Weather & Flood Gauges:** `/flood-conditions` (`client/src/components/FloodConditionsPanel.tsx`)

### Operational Portals
- **Rescuer Tactical Dashboard:** `/responder` (`client/src/pages/Responder.tsx`, `/user/responder`)
- **State Emergency Operations Command:** `/admin` (`client/src/pages/AdminCommand.tsx`)
- **Hospital Emergency & ICU Beds:** `/hospital` (`client/src/pages/HospitalPortal.tsx`)
- **Public & Role Login:** `/login`, `/role-login` (`client/src/pages/Login.tsx`, `RoleLogin.tsx`)

---

## 3. Authoritative Architectural Authorities

| Component | Authority Role | Invariant & Fail-Safe |
| :--- | :--- | :--- |
| **TiDB / MySQL Database** | **Authoritative State** | All incidents, profiles, missions, and users are durably persisted. Database failure in production fails closed. |
| **HTTP-Only Cookies** | **Web Authentication** | Signed JWT cookies represent authoritative web sessions. Web browser tRPC clients do not read localStorage tokens. |
| **Capacitor Mobile SDK** | **Native Authentication** | Android APK utilizes isolated bearer authorization strictly gated by `Capacitor.isNativePlatform()`. |
| **Supabase Client** | **OTP Verification Only** | Purely an email OTP/verification gateway. Does not maintain persistent browser sessions (`persistSession: false`). |
| **OSRM Routing Engine** | **Road ETA Calculation** | Computes road geometry with 15s in-memory cache and grid snapping. Automatically falls back to Haversine + 1.35x circuity on timeout. |
| **Server-Sent Events (SSE)** | **Live Rescuer GPS Stream** | Lightweight push transport (`X-Accel-Buffering: no`, 15s heartbeat). Authorizes subscribers and bounds connections. |
| **n8n Webhook Engine** | **Notification Automation** | Triggered asynchronously on SOS creation/escalation. n8n downtime never blocks SOS creation. |
| **360dialog Gateway** | **WhatsApp Transport** | Sends automated WhatsApp alerts containing dynamic HTTPS tracking links (`https://<domain>/track?code=SOS-XXXXXXXX`). |

---

## 4. Emergency SOS & Dispatch Invariants

1. **Accidental SOS Window:** Exactly 10 seconds (`TRIAGE_CANCEL_WINDOW_MS = 10_000`). User may cancel or choose category.
2. **Immediate Category Dispatch:** Selecting Medical, Rescue, or Emergency begins matching and offers immediately.
3. **Safe Default Fallback:** If 10 seconds elapse with no category selected, backend automatically defaults to `emergency` category and dispatches.
4. **Unlimited Details Entry:** Entering additional details is non-blocking. The user can take as long as needed without being forced away from the details screen.
5. **Capability Enforcement:** Dispatch ranking prioritizes certified rescuer capabilities (`medical`, `flood_rescue`, `trapped_rescue`, `evacuation`) over simple geographical proximity. User-editable call signs are not security boundaries.

---

## 5. Production Environment Configuration (Render)

| Environment Variable | Description | Security Mode |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Standard |
| `PORT` | Web service listen port (default `3000`) | Standard |
| `DATABASE_URL` | TiDB / MySQL production connection URI | `sync: false` (Secret) |
| `JWT_SECRET` | 64-char cryptographically random secret | `generateValue: true` |
| `APP_URL` / `RENDER_EXTERNAL_URL` | Canonical public HTTPS base URL | `sync: false` |
| `N8N_SOS_WEBHOOK_URL` | Destination webhook URL on n8n | `sync: false` |
| `N8N_SOS_WEBHOOK_SECRET` | Shared HMAC secret for n8n status hooks | `sync: false` (Secret) |
| `OSRM_ROUTER_URL` | Self-hosted or open OSRM routing base URL | `sync: false` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push notification cryptographic pair | `sync: false` (Secret) |
| `VAPID_SUBJECT` | Push contact email (`mailto:...`) | `sync: false` |

---

## 6. Verification Status Matrix

- **CODE VERIFIED:**
  - Strict exact-match CORS origin validation (`server/_core/cors.ts`).
  - Chat & check-in authorization guards (`server/routers/rescue.ts`).
  - Idempotent offline SOS sync with fail-closed DB behavior (`server/n8n.ts`).
  - Web/native auth storage boundary enforcement (`client/src/main.tsx`, `useAuth.ts`).
  - Exactly 10-second triage timer constants (`client/src/components/SosClassificationModal.tsx`).
  - OSRM route calculations, caching, and fallback (`server/routing/routing.service.ts`).
  - SSE connection limits and subscriber registry (`server/tracking/liveStream.ts`).

- **LOCAL VERIFIED:**
  - TypeScript compilation: 0 errors (`npm run check`).
  - Vitest test suite: 86 test files, 405 tests passing (`npm test -- --run`).
  - Vite & esbuild production build: Clean success (`npm run build`).

- **RENDER VERIFIED:**
  - `render.yaml` configuration with `sync: false` declarations and build/start commands.

- **REMAINING PHYSICAL / EXTERNAL VERIFICATION:**
  - Live Render deployment verification.
  - Live TiDB cloud production connectivity.
  - Live n8n webhook firing and 360dialog WhatsApp delivery.
  - Physical Android GPS movement in outdoor transit.
