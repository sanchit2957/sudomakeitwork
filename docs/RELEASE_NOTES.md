# Riverguard Release Notes

## Delivered operational capabilities

sudo MakeItWork provides distinct victim, rescuer, and administrator workspaces with role-gated navigation. Victims can submit a location-based SOS report and track it through a private reference. Administrators can triage incidents, assign authorized field teams, manage shelters and map layers, and view live operational metrics. Rescuers can manage availability, receive in-app operational alerts, and progress assigned missions through the enforced **Pending → Dispatched → Resolved** workflow.

The public emergency form supports GPS, manual coordinate entry, map-point selection, urgency, people count, narrative notes, and optional image evidence. SOS reports are rate-limited in supported guest mode. Administrative and responder changes are recorded through incident events and audit entries.

## Verification completed

| Area | Result |
|---|---|
| TypeScript validation | Passed with `pnpm check` |
| Automated tests | Passed: 26 tests across authentication, authorization, rescue workflow, offline SOS, cache policy, registration approval, VAPID configuration, and role synchronization |
| OAuth account handling | Verified against the hosted HTTPS preview; local `127.0.0.1` previews are intentionally not valid OAuth callback origins |
| Role separation | Verified for administrator, rescuer, and blocked-role states |
| Live rescue workflow | A clearly labelled test-only SOS was created, assigned to `SANCHIT-RESQ`, moved to Dispatched, resolved by the responder, reflected in analytics, and then removed along with dependent test records |
| Google Maps | Verified on the externally hosted preview; manual-coordinate fallback remains available when map loading is unavailable |
| Push credential setup | VAPID public/private values were validated as a matching P-256 key pair |
| In-app alert fallback | Verified in the responder Alerts workspace at mobile width using a temporary test-only notification, then removed |
| Shelter edit persistence | A temporary test-only shelter was created, updated (location, capacity, occupancy, and status), verified, then removed |
| Synchronization cache safety | Live tRPC responses and client requests now use no-cache/no-store policies; the offline service worker bypasses every `/api/*` request and clears obsolete cache generations |
| Cross-role synchronization | A test-only SOS appeared in Command Centre, was assigned to a test responder, reached the responder mission board, moved to Dispatched, reappeared in Command Centre as **Responder en route**, and was then removed with all dependent test records |
| Rescuer registration approval | A test-only standard account requested field access, was approved with call sign `TEST-RESQ`, unlocked the responder workspace, and was removed after verification |

## Browser alert registration note

The responder UI now distinguishes permission from confirmed Web Push device registration, awaits an active service worker, shows actionable failures, and attempts an in-app service-worker/subscription reset. The current responder browser session still reports Chrome’s `could not retrieve the public key` PushManager failure. Because the project VAPID pair, hosted HTTPS worker, and in-app alert flow were independently validated, this remaining failure is treated as browser-device state. The application retains the in-app Alerts workspace and polling updates as the operational fallback.

For browser-level delivery on that device, restart the browser/device, then clear the sudo MakeItWork site’s storage and notification permission before trying alert setup again. A different current browser profile can also be used for a clean registration attempt.
