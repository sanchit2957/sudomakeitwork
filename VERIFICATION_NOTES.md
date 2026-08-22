# sudo MakeItWork Verification Notes

## Hospital resources panel

The hosted administrator session was checked at `/command/hospitals`. The live page displayed the **Hospitals & critical resources** workspace with visible navigation, the medical-resource creation form, emergency and ICU bed fields, oxygen, blood, ambulance capacity fields, readiness selection, and the live map. The empty state correctly advised coordinators to pin verified hospital or health-centre locations and record current capacity only.

## Responsive victim experience

The public safety hub and panic-mode SOS flow were checked at a 375px phone viewport. The four role-entry actions remained visible, and the SOS screen showed three image-led emergency choices, location sharing, people count controls, optional details, offline-state explanation, and a prominent SOS action.

## Synchronization and discoverability update

The hosted administrator Command Centre was checked after the reliability update. Its persistent navigation now includes **Hospitals & resources** and **Rescuer requests**, while the operations board includes a separate prominent **Hospitals & critical resources** action. The live browser console reported no client-side errors during this check.

The hosted **Rescuer registration requests** route was also verified in an administrator session. It displayed the review workflow and an accurate empty state when no applications were pending.

After the live refresh interval elapsed, the administrator request queue remained responsive and continued to render its stable no-pending-applications state.

## Test-only synchronization scenario

For user-authorized end-to-end verification, a temporary SOS was prepared through the public emergency form with the unmistakable location label **TEST ONLY – sync verification point**, coordinates 26.14450, 91.73620, and notes stating that no emergency exists. This record will be removed after the synchronization check.

The temporary SOS was submitted successfully through the live app and received tracking code `SOS-SZ65GD3U` with an initial **pending** status.

During the Command Centre verification, the database held `SOS-SZ65GD3U` while the browser displayed an older incident-feed snapshot. Investigation identified that the offline service worker was applying cache-first handling to same-origin `/api/trpc` GET requests. The service worker was updated to bypass every `/api/*` request, old cache generations are deleted on activation, and the tRPC response/request path now explicitly uses `no-store`/`no-cache` headers. A fresh service-worker activation and cross-role verification is required before closing this test.

After activating the new `sudo-makeitwork-offline-shell-v2` cache generation and revisiting `/command`, the Command Centre incident feed displayed `SOS-SZ65GD3U` as **pending** with the **TEST ONLY – sync verification point** location. The live feed total also reconciled to six incidents, including both pending cases. This confirms that the stale-read path was eliminated for the test SOS.

The administrator then selected the explicitly test-only responder `TEST-RESQ` and assigned `SOS-SZ65GD3U` through the Command Centre. The interface immediately reconciled to show **Assigned: TEST-RESQ** for the test incident. The responder-facing mission/status transition still requires verification before test data is removed.

For the final responder-side test, a short-lived development-only session was issued by an administrator-gated route for the approved temporary account only. It was held in browser session storage through the app’s existing preview authentication fallback; no production route or real account was used.

The approved temporary account successfully entered `/responder` as **TEST-RESQ**. Its responder workspace displayed the assigned `SOS-SZ65GD3U` mission as **pending** with the test-only location and the **Mark dispatched** action, demonstrating that approval unlocks the field workspace and that the assignment propagated to the responder view.

`TEST-RESQ` then used the responder action to mark `SOS-SZ65GD3U` **dispatched**; the responder panel immediately changed its state and action to **Mark resolved**. The first attempt to switch the sandbox back to the command account did not establish a usable administrator identity, so the administrator-side view still requires a corrected session handoff before the final status check.

After restoring the actual database-authorized administrator identity, `/command` displayed `SOS-SZ65GD3U` as **dispatched**, assigned to **TEST-RESQ**, and labelled **Responder en route**. This completed the live administrator → responder → administrator propagation check after the cache-policy fix.

All temporary verification records were then deleted in a single database transaction: the test SOS, mission, incident events, notifications, test rescuer profile, registration request, audit entries, subscriptions, and temporary user. A zero-count integrity query confirmed that no test record remained. The temporary development-only session routes and local session-helper artifacts were removed before the final validation pass.

## Mobile Rescuer sidebar visibility

The authenticated Rescuer workspace was checked at a 375px mobile viewport with its navigation drawer open. The drawer displayed an opaque light background, a visible border and shadow, high-contrast identity area, all three navigation tabs (**My missions**, **Field map**, and **Alerts**), and the responder footer with **Sign out**. The app content was visibly dimmed behind the drawer rather than bleeding through it. The temporary inspection state used for this visual check was removed before validation.

The final 375px capture was reviewed directly after the inspection helper had established the open drawer state. It confirmed that the opaque surface, divider border, active-tab contrast, secondary tab labels, and responder footer remain readable without background-content bleed-through.

## Desktop workspace sidebar availability

The desktop workspace layout was checked at 1280px after changing the sidebar to icon-collapsible mode. The opaque sidebar remained visible with its navigation entries, responder footer, and an in-sidebar expand/collapse control. The same shared layout is used by the Administrator Command Centre, where **Rescuer requests** remains an accessible desktop navigation item.

## Multilingual emergency workflow

The platform language selector now offers English, Assamese, Hindi, Bengali, Odia, Marathi, Gujarati, Tamil, Telugu, and Kannada. A direct Tamil (`?lang=ta`) mobile check confirmed that the public safety-hub headline, emergency choice cards, quick-access navigation, GPS instruction, SOS action, and offline reassurance render in Tamil script without layout overlap. Operational IDs, incident content, coordinates, and other entered data are intentionally left unchanged.

The authenticated Tamil Rescuer workspace was also checked at 375px. Its workspace header, readiness state, availability controls, mission controls, assignment alert guidance, and selector remained visible without clipping. The Tamil protected Command Centre entry state was checked at 1280px: its language selector and translated controls remained legible, while access stayed correctly restricted to the administrator role.

The completed operational language pack now covers static Rescuer and Command Centre labels for availability, missions, alerts, registration, metrics, resource management, shelter and hospital forms, incident states, assignments, rescuer approvals, and protected-role access. It is loaded independently from incident records, preserving SOS codes, names, entered notes, coordinates, and all other operational data exactly as recorded. Final TypeScript validation passed and the regression suite completed with 34 tests passing.

The final pack was expanded to include operational helper copy, placeholders, resource and stock labels, readiness states, action labels, empty states, browser-alert recovery guidance, and role-gate interpolation. It safely translates only static rendered text and presentation attributes; input values, incident records, private tracking codes, and user-entered information are excluded from alteration.

Final authenticated-content preview checks rendered the Tamil Command Centre hospital and shelter forms at desktop width. The screens showed translated fixed-sidebar navigation, form headings, field labels, placeholders, state controls, helper text, empty state, and map-fallback guidance without clipping. The temporary preview-only role bypass used for this visual check was removed before the final validation run.

## Assigned rescuer profile and location sharing

The SOS tracking contract now exposes a rescuer only when the matching mission is active. The exposed payload is limited to call sign, optional photo, optional phone number when the rescuer has explicitly enabled contact sharing, and an opted-in location only when the latest update is less than two minutes old. Location updates are accepted only from the assigned rescuer while location sharing is enabled; resolving the mission automatically stops sharing and clears saved coordinates.

The public tracking screen was checked at a 375px viewport after the new card and map components were added. Its reference-entry and status layout remained responsive without clipping or console-visible build errors. The new responder policy tests cover fresh-location disclosure, contact consent, stale-location suppression, and the active-mission requirement.

A final 375px Tamil tracking-page capture also retained its readable mobile header, language selector, SOS reference input, and status action without overlap. Rendered regression coverage additionally verifies the Rescuer profile contact/share controls, active versus disabled location-sharing controls, victim phone visibility, and the live, paused, and not-started location states.

## Two-app redesign and Victim App safety flow

The public routes now form a dedicated Victim App: a language-aware, phone-first home screen with a large SOS control, online/offline status, browser voice-note capture, GPS-aware location preview, a source-labelled weather/flood panel, and a four-icon navigation bar for SOS, Tracking, Safety, and More. The flood panel obtains current forecast values from the public Open-Meteo model endpoint; it does not invent a river level and clearly states when an official gauge is not integrated.

The SOS report schema now stores a short voice note securely in object storage, and the offline outbox carries that note until it can be delivered. The tracker contains the existing active-assignment responder profile, consented phone action, freshness-limited location map, and a short, authenticated victim-to-rescuer message channel. The matching Rescuer workspace exposes the linked response thread.

The protected Operations App now has distinct routes for Government Command (`/command`), Medical Operations (`/medical`), and field response (`/responder`). Medical staff can be authorized only by an administrator after they have signed in; their scope is limited to hospital resources and the operations map. A desktop role-gate check confirmed that a rescuer cannot enter Medical Operations and receives clear account guidance. Mobile screenshots confirmed the Victim App layout at 375px, including explicit-English URL locale precedence.

## Connected Safety assistance

The Victim App Safety tab was redesigned from the supplied prototype into an actionable resource screen. It provides clear flood-preparedness guidance, an immediate 112 call action, a Rapid SOS escape path, and four concise assistance types: shelter, food, medical, and protection. Signed-in users can select a need, set the number of people, add an optional operational note, and share the request only after a current location is available. The screen displays only verified shelters and hospitals from the operational database; it does not fabricate nearby resources when none are recorded.

Safety assistance is deliberately separate from confirmed SOS incidents. Each request is stored with an auditable status of new, acknowledged, or resolved. Government Command receives the full triage queue, Medical Operations receives medical requests only, and the Rescuer workspace receives a response queue for field support. Victim requests and operations updates are protected by role checks; unauthenticated creation and ordinary-user queue access are covered by direct regressions. A 375px mobile capture confirmed the redesigned Safety layout is readable with the resource selector, assistance form, escalation choices, and flood guidance visible without clipping.

The completed Safety page also renders an explicit, source-labelled live conditions card from the existing weather/flood contract. It distinguishes high and elevated rainfall risk from an unavailable source, shows forecast availability honestly, and states that an official river gauge is not yet linked. Medical and Rescuer safety queues now include role-specific pre-acknowledgement guidance. Safety requests must transition from **new** to **acknowledged** before they can be **resolved**; policy regressions cover those transitions and verify that medical staff are limited to medical requests. Rendered UI tests cover high-risk and unavailable local-alert states.

## Authenticated rapid SOS and post-alert details

The public SOS disc now requires a signed-in victim account, invokes the device’s location permission at the moment of activation, creates a high-priority SOS with the location and any recorded voice note, then redirects directly to the private tracking code. The legacy multi-step Emergency route redirects back to this rapid entry point, so it cannot be used to bypass mandatory sign-in. If GPS cannot be supplied, the app does not send a location-less alert; if the user is offline, the signed-in SOS is visibly queued and is flushed to Tracking after connection returns.

Tracking now contains an **Add more details** control for active cases. Only the reporting account can view or update people count, help type, help needs, and notes; all edits are blocked after resolution and recorded in the incident audit timeline. Direct authorization, policy, and rendered UI regressions cover the login gate, active-case editor entry point, reporter ownership, and resolved-case restriction. Mobile captures confirmed the signed-out SOS entry and direct legacy-route redirect render the streamlined phone-first home screen.

The final rapid-SOS validation added direct rendered coverage for the signed-out **Sign in to activate** label and explicit GPS-permission error state. The completion helper is covered to confirm a created code routes to its private tracking URL, and router-level mocked regressions confirm that an active case is visible only to its reporting victim while both view and update access are rejected after resolution. A jsdom interaction regression now renders the actual authenticated Home flow, supplies a successful browser location, resolves the real SOS mutation contract, and confirms navigation to the returned private tracking code. TypeScript validation completed successfully and all **26** Vitest files, containing **64** tests, passed.

The final 375px visual check shows the signed-out Victim App presenting a prominent **Sign in to activate** SOS control, a visible connectivity state, voice-note entry, map fallback, and honest no-gauge condition guidance. The retired `/emergency` route renders the same rapid Home screen, confirming that the former multi-step route is no longer available.
