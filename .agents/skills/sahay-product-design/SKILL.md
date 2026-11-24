---
name: sahay-product-design
description: Authoritative product design principles, design system tokens, role-specific UX standards, accessibility rules, and engineering constraints for Project Sahay disaster-management platform.
when_to_use: "Use when designing, modifying, auditing, or implementing any frontend screen, component, layout, or design token across Project Sahay."
allowed-tools: Read, Glob, Grep, Edit, Write
version: 1.0.0
---

# Project Sahay — Product Design System & Standards

> **Mission:** Dependable public-safety, disaster-response, and emergency-coordination platform connecting Citizens, First Responders, Hospitals, and State Command Authorities.
> **Atmosphere:** Calm under extreme pressure. Reliable. Clear. Production-grade. Trustworthy. Zero artificial decoration.

---

## 1. Product Foundations & Architecture

Sahay operates across four primary operational user roles:
1. **Citizens:** Stressed, injured, flood-affected, or displaced individuals needing rapid, unmistakable SOS activation, offline resilience, and clear tracking.
2. **Field Responders:** Search-and-rescue teams (NDRF, SDRF, local boat operators) operating in harsh outdoor conditions, requiring high-contrast UI, rapid triage actions, offline distress radar, and large touch targets.
3. **Hospital Operations:** Clinical triage officers and emergency room superintendents managing beds, ICU units, oxygen supply, and incoming trauma victims.
4. **State Command Centre:** Executive emergency dispatchers managing state-wide incidents, asset allocation, spatial flood zones, and telemetry.

---

## 2. Visual Direction & Anti-Patterns

### ❌ Absolute Visual Anti-Patterns (Eliminate Completely)
1. **Excessive / Default Blue:** Blue must never be the default color for all buttons, icons, borders, cards, and backgrounds.
2. **Generic AI SaaS Aesthetic:** No endless rounded floating cards, no card-inside-a-card-inside-a-card syndrome, no soft blur glassmorphism (`backdrop-filter: blur(32px)`), no glowing neon rims.
3. **Random Contrast Shifts:** Avoid mixing dark and light sections arbitrarily without operational hierarchy.
4. **Meaningless Decoration:** No decorative animated ripples unless indicating live emergency distress; no decorative gradient washes or emojis acting as critical status indicators.
5. **Overloaded Chrome:** No tracked-out all-caps labels (`A L E R T`) above every standard heading; no meaningless icons attached to plain text labels.

### ✅ Positive Design Language
1. **Neutral Foundation:** Balanced, intentional slate surfaces with crisp borders (`1px solid var(--border)`).
2. **Semantic Colour Purpose:**
   - **Emergency Red (`#DC2626` / `#EF4444`):** Active distress calls, critical triage, urgent patient status.
   - **Warning Amber (`#D97706` / `#F59E0B`):** Impending flood risk, expiring offer timer, limited resources.
   - **Clinical / Operational Teal (`#0D9488` / `#14B8A6`):** Standard operational confirmation, medical stability, active tracking.
   - **Neutral Slates (`#0A0E17`, `#0F172A`, `#1E293B` dark / `#F8FAFC`, `#FFFFFF`, `#F1F5F9` light):** Structural layout and readable content.
3. **Information Density with Breathing Room:** Command centre screens prioritize tabular information density; citizen screens prioritize radical simplicity and unmistakable action buttons.
4. **Tabular Numerics:** All coordinates, ETA counters, bed counts, and timestamps must use `font-variant-numeric: tabular-nums` or `font-mono` for clean vertical alignment.

---

## 3. Role-Specific UX Standards

### A. Citizen Experience (Mobile-First)
- **SOS Button:** Accessible within 1 second of loading the application.
- **Fail-Safe Offline Mode:** If network is unavailable, immediately provide 1-tap SMS 112 with prefilled GPS coordinates and offline BLE mesh guidance.
- **Location Transparency:** Display explicit landmark and GPS coordinates with accuracy indicator so citizens can confirm where responders are heading.
- **Live Tracking:** Clear visual progression: `Pending` → `Dispatched (Rescuer Call Sign, ETA, Proximity)` → `Resolved`.
- **Bottom Navigation Bar:** Dedicated 4-item mobile navigation bar with touch targets $\ge 48\text{px} \times 48\text{px}$.

### B. Field Responder Experience (High-Contrast Field Operations)
- **Offer HUD (30s Window):** High-contrast modal showing emergency code, victim distance, severity, audio notes, and unambiguous `Accept` / `Decline` controls.
- **Readiness State:** Persistent status toggle (`Available`, `On Mission`, `Off Duty`) visible on top of workspace.
- **Mission Status Transitions:** Fast 1-tap milestone progression: `Arrived on Scene` → `Evacuating Victims` → `En Route to Hospital` → `Mission Complete`.
- **Offline Mesh Distress Radar:** Dedicated BLE scanner interface showing detected RSSI signal strengths and distance estimates without cellular connectivity.

### C. Hospital Operations Desk (Clinical Utility)
- **Readiness & Load:** Real-time occupancy metrics (Emergency Beds, ICU Beds, Oxygen, Ambulances) with direct numeric steppers.
- **Incoming Case Queue:** Structured case cards with triage urgency, ETA countdown, required specialty department, and clear intake actions (`Acknowledge` → `Prepare ER` → `Ready` → `Received`).
- **Command Channel:** Direct emergency broadcasting to State Command for asset support (blood units, extra ambulances, transfer requests).
- **Zero Fabricated Data:** Display only actual facility numbers connected to database schema.

### D. Administrator Command Centre (Operational Geospatial Density)
- **Map Inbox & Telemetry:** Full situational awareness map showing verified flood polygons, active distress markers, shelter capacity, and field teams.
- **Tabular Incident Dispatch Roster:** Dense tabular view displaying SOS code, location, emergency type, severity badge, assigned unit, and manual override controls.
- **Workflow Integrity:** Incident progression locked into an auditable lifecycle; dispatch overrides require explicit confirmation.

---

## 4. Accessibility & Mobile Standards (WCAG AA Compliance)

1. **Touch Targets:** Minimum $44\text{px} \times 44\text{px}$ on all interactive touchpoints; primary mobile SOS $\ge 120\text{px} \times 120\text{px}$.
2. **Color Contrast:** Contrast ratio $\ge 4.5:1$ for normal body text and $\ge 3:1$ for large text and UI components against backgrounds.
3. **Focus States:** Visible outline on keyboard focus (`outline: 2px solid var(--ring); outline-offset: 2px`).
4. **Reduced Motion:** Respect `@media (prefers-reduced-motion: reduce)` by disabling non-essential animations.
5. **Capacitor Android Support:** Layouts must account for native status bar (`safe-area-inset-top`) and navigation bar (`safe-area-inset-bottom`).

---

## 5. Engineering Constraints & Invariants

- **No Schema Modifications:** Under no circumstances alter backend Drizzle tables, database schemas, or tRPC router contracts.
- **No Integration Replacements:** Retain Leaflet/Google Maps, Capacitor, Open-Meteo, TiDB, and Web Audio APIs.
- **Preserve Protected Selectors:** Maintain test-critical attributes:
  - `data-testid="emergency-offer-card"`
  - `data-testid="offer-countdown"`
  - `data-testid="accept-offer-btn"`
  - `data-testid="decline-offer-btn"`
  - `data-testid="offer-voice-note"`
  - `data-testid="mission-voice-note"`
- **Strict Clean Build:** All code must pass `npm run check` (`tsc --noEmit`), `npm test`, `npm run build`, and `npx cap sync android`.

