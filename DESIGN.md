# Project Sahay — Product Design System Specification
### National Emergency Infrastructure & Hybrid Operational Architecture | Avishkar 2026

---

## 1. Approved Design Architecture

Sahay is a Pan-India disaster-response and rescue-coordination platform connecting citizens, frontline responders, clinical hospitals, and state command centers. 

The design architecture employs a purposeful hybrid model:

| Operational Role | Design Foundation | Primary Interaction & Visual Objective |
| :--- | :--- | :--- |
| **Citizen / Victim** | **Direction 3 — Human-Centric Emergency Service** | Calm, reassuring, trauma-informed. Plain-language guidance, large legible tap targets, zero 3D spheres or pulsing ripples. |
| **Field Responder** | **Direction 2 — Mission Operational Grid** | High-density CAD-911 dispatch manifest. Monospaced coordinates/distances, master-detail incident queue, zero floating cards. |
| **Hospital Operations** | **Direction 1 + 2 — Institutional Clinical Operations** | Structured resource ledger, bed & ICU matrix, inbound admissions queue, compact tabular shortage indicators. |
| **State Command Admin** | **Direction 2 + Direction 1 Visual Principles** | Authoritative incident dispatch register, GIS spatial coordination, national force mobilization ledger. |
| **Shared Foundations** | **Direction 1 — National Emergency Infrastructure** | Utilitarian, austere, high-contrast typography, strict 6px/8px radii, hairline dividers, zero decorative gloss or glow. |

---

## 2. Global Visual Anti-Patterns (Strictly Enforced)

The following design artifacts are strictly prohibited across the entire product:
- **No Giant SOS Domes:** No 3D spheres, radial gradients, specular bevels, or glass lens reflections.
- **No Decorative Ripple Rings & Radars:** No pulsing SVG concentric waves, rotating radar sweep lines, or ambient glowing orbs.
- **No Card-in-Card Nesting:** No nested container Russian-doll patterns (e.g., page card containing hospital card containing bed card). Sections use clean hairline rules (`border-b border-border`) and generous whitespace.
- **No Floating Card Collections:** No disconnected cards floating over colored backgrounds with heavy drop shadows.
- **No Badge / Pill Proliferation:** No enclosing every label, metric, and status into colored oval badges. Plain text, semantic colors, and subtle tabular text replace badge-mania.
- **No Dark Tactical or Sci-Fi Terminals:** No glowing blue borders, sci-fi cyber styling, or arbitrary dark banners on light pages.
- **No Assam-Specific Hardcoding:** Sahay is a **Pan-India platform**. No demo addresses hardcoded to Guwahati or emails ending in `@assamrescue.gov.in`. All location displays dynamically use actual coordinates or national agency standards (NDMA, NDRF, SDRF, 112).

---

## 3. Restrained Color Palette & Semantic Rules

| Token | Light Value | Dark Value | Strict Purpose & Rules |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `#FFFFFF` | `#0B0F17` | Clean, flat, distraction-free neutral canvas. |
| **Surface Subdued** | `#F8FAFC` (Slate 50) | `#0F172A` (Slate 900) | Secondary panels, table headers, table alternating rows. |
| **Border Hairline** | `#E2E8F0` (Slate 200) | `#1E293B` (Slate 800) | 1px clean structure dividers and table boundaries. |
| **Border Active** | `#94A3B8` (Slate 400) | `#475569` (Slate 600) | Focused inputs and active tab indicators. |
| **Foreground High** | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Primary headlines, data figures, critical instructions. |
| **Foreground Muted** | `#475569` (Slate 600) | `#94A3B8` (Slate 400) | Subtitles, table labels, timestamps, metadata. |
| **Emergency Signal Red** | `#DC2626` (Red 600) | `#EF4444` (Red 500) | **Reserved strictly** for active emergency triggers, SOS confirmation, and Critical P1 life-safety alerts. |
| **Warning Amber** | `#D97706` (Amber 600)| `#F59E0B` (Amber 500)| Cautionary alerts, limited supply status, 30s decision countdown. |
| **Operational Emerald** | `#059669` (Green 600)| `#10B981` (Green 500)| Available resources, verified safe, resolved mission. |
| **Primary Action** | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Standard buttons, mode switchers, form submissions. |

---

## 4. Typography Hierarchy & Numerical System

- **Primary Sans:** System-native grotesque sans (`Inter`, `system-ui`, `-apple-system`, `sans-serif`).
- **Telemetry & Numbers:** Tabular figures (`DM Mono`, `JetBrains Mono`, `ui-monospace`, with `font-variant-numeric: tabular-nums`).
- **Scale:**
  - `Hero 1`: `28px` – `32px` (`font-bold`, `-0.02em` tracking) — Emergency headlines, critical counters.
  - `Title 2`: `20px` – `22px` (`font-semibold`) — Page titles, operational desk headers.
  - `Subhead 3`: `15px` – `16px` (`font-semibold`) — Table section headers, mission identifiers.
  - `Body Normal`: `14px` (`leading-relaxed`) — Citizen instructions, triage clinical notes.
  - `Body Compact`: `12px` (`leading-normal`) — Table cells, status descriptions, metadata.
  - `Mono Data`: `11px` – `12px` (`font-mono`, `font-semibold`) — GPS coordinates, case IDs, timestamps.

---

## 5. Role-Specific Blueprint Specifications

### 1. Citizen Interface (Direction 3 — Human-Centric Emergency Service)
- **Emergency Trigger:** Clean, large, rectangular flat action block: `REQUEST EMERGENCY ASSISTANCE` with prominent high-contrast text and emergency red background. Direct tap or press-and-hold; zero 3D spheres, zero ripple rings.
- **Failover & Offline:** Clean hairline partition with direct action buttons: `Call 112 (National Emergency)` and `SMS 112 with GPS Location`.
- **Telemetry Card:** Simple, calm location block: `Your Verified Location: 26.1445° N, 91.7362° E · Kamrup, Assam / Pan-India`.
- **Bottom Navigation:** Solid, flat bar (64px width, $\ge 44\text{px}$ touch targets), clean text labels, no floating capsules.

### 2. Field Responder Interface (Direction 2 — Mission Operational Grid)
- **Readiness Header:** Compact 3-way toggle button group (`AVAILABLE`, `ON MISSION`, `OFF DUTY`) with real-time GPS acquisition.
- **Dispatch Queue:** Chronological table or compact list showing incident ID, priority (`CRITICAL P1`, `HIGH P2`), victim count, distance in km, and 1-click status updates (`ACKNOWLEDGE` → `EN ROUTE` → `ON SCENE` → `RESOLVED`).
- **Zero Card-in-Card Nesting:** Clean hairline table rows, monospaced distances, and direct phone dial actions.

### 3. Hospital Clinical Portal (Direction 1 + 2 — Institutional Clinical Operations)
- **Resource Manifest Table:** Compact structured matrix of Trauma Beds, ICU Ventilators, Oxygen Barometric Pressure, Blood Units, and Ambulance Fleet.
- **Inline Steppers:** Clean `+` and `-` numerical steppers with immediate server synchronization.
- **Shortage Indicators:** Clear semantic status column: `Operational`, `Limited Stock`, `Critical Need`.
- **Inbound Admissions Queue:** Chronological ledger of inbound ambulances with patient triage notes, ETA, and assigned trauma bed/OR suite.

### 4. Administrator Command Centre (Direction 2 + 1 Visual Principles)
- **Incident Dispatch Register:** Tabular ledger of all district emergencies with multi-column sorting, severity filtering, and inline force dispatch triggers.
- **GIS Operations View:** Clean geographic map overlay without military / sci-fi styling.
- **Access Codes & RBAC Management:** High-assurance tabular records with code versioning and instant session invalidation triggers.
