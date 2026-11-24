# Project Sahay — Product Design System Architecture
### Standard Operating Design System (SODS) | Avishkar 2026

---

## 1. Brand & Aesthetic Foundations

Sahay is an emergency-response and disaster-management technology platform for India.
The visual identity communicates **dependability, operational calm, high usability under acute stress, and clinical clarity**.

### Visual Anti-Patterns (Strictly Avoided)
- **No Default Blue:** Blue is not the default color for cards, buttons, backgrounds, or borders.
- **No Generic AI SaaS Bloat:** No rounded floating cards, no card-in-card-in-card nesting, no blurry glassmorphism (`backdrop-filter: blur(32px)`), no glowing neon rims.
- **No Random Light/Dark Sections:** Clean structural hierarchy where roles use layout architectures tailored to their physical working environment.
- **No Decorative Animated Rings:** Animation is reserved strictly for real-time live distress beacons and countdown timers.

---

## 2. Color System & Semantic Roles

| Token Role | Hex Code (Light) | Hex Code (Dark) | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `#F8FAFC` (Slate 50) | `#0A0E17` (Deep Slate) | Top-level application canvas |
| **Surface Card** | `#FFFFFF` (White) | `#0F172A` (Navy Slate) | Content containers, panels, data cards |
| **Elevated Surface** | `#F1F5F9` (Slate 100) | `#1E293B` (Elevated Slate) | Dropdowns, dialogs, popovers, table headers |
| **Border Subtle** | `#E2E8F0` (Slate 200) | `#1E293B` (Slate 800) | Card boundaries, dividers, table cell lines |
| **Border Active** | `#CBD5E1` (Slate 300) | `#334155` (Slate 700) | Hovered inputs, focused containers |
| **Foreground Primary** | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Headings, critical metrics, high-contrast labels |
| **Foreground Muted** | `#64748B` (Slate 500) | `#94A3B8` (Slate 400) | Secondary metadata, captions, timestamps |
| **Emergency Red** | `#DC2626` / `#EF4444` | `#EF4444` / `#F87171` | Distress SOS, critical triage, declining offer |
| **Warning Amber** | `#D97706` / `#F59E0B` | `#F59E0B` / `#FBBF24` | 30s offer countdown, flood risk warning, limited supply |
| **Operational Teal** | `#0D9488` / `#14B8A6` | `#14B8A6` / `#2DD4BF` | Safe status, confirmed rescue, medical readiness |
| **Telemetry Cyan** | `#0284C7` / `#38BDF8` | `#38BDF8` / `#7DD3FC` | GPS coordinates, distance markers, transit routes |

---

## 3. Typography & Numerical Scales

- **Primary Typeface:** Inter / Geist Sans (Clean, legible grotesque sans-serif).
- **Telemetry & Numerical Face:** Tabular figures (`font-variant-numeric: tabular-nums`, monospace fallback) for coordinates, ETA counters, bed capacities, and mission timers.
- **Scale:**
  - `Display 1`: `30px` (`leading-tight`, `font-bold`, `-0.02em` tracking) — Hero emergency headlines.
  - `Heading 2`: `22px` (`leading-snug`, `font-bold`) — Page titles, section headings.
  - `Heading 3`: `16px` (`leading-normal`, `font-semibold`) — Card headers, drawer titles.
  - `Body Normal`: `14px` (`leading-relaxed`, `font-normal`) — Form instructions, case field notes.
  - `Body Compact`: `12px` (`leading-5`, `font-medium`) — Secondary table rows, location landmarks.
  - `Micro Caption`: `10px` (`leading-none`, `font-mono`, `uppercase`, `tracking-wider`) — Status chips, telemetry tags.

---

## 4. Spacing Scale, Layout Grid & Breakpoints

- **Base Unit:** 4px geometric scaling (`4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`, `48px`).
- **Breakpoints:**
  - `Mobile S/M`: `375px` – `390px` (Citizen primary interface, single column, bottom navigation bar).
  - `Tablet`: `768px` (Split-view responder maps, 2-column resource grids).
  - `Laptop`: `1024px` (Clinical hospital desk with fixed sidebar).
  - `Desktop`: `1440px` (State Command Center with full tactical map and bottom alert inbox table).
  - `Wide Desktop`: `1920px` (Multi-sector operations room monitoring).
- **Touch Target Floor:** Minimum $44\text{px} \times 44\text{px}$ on all mobile touchpoints; citizen SOS $\ge 120\text{px} \times 120\text{px}$.

---

## 5. Component Specifications

### A. Buttons & Triggers
- **Primary Action (Teal / Brand):** Solid `#0D9488`, hover `#0F766E`, text white, 10px-12px rounded corners, subtle shadow.
- **Emergency Action (Red):** Solid `#DC2626`, hover `#B91C1C`, text white, high-contrast urgency.
- **Secondary / Outline:** Transparent background, `1px solid var(--border)`, text slate-700/slate-200.
- **Destructive / Reject:** Rose-50 text, border `#EF4444/30`, hover `#EF4444/10`.

### B. Cards & Panels
- **Container Structure:** Flat, border-delimited (`border border-slate-200/80 dark:border-slate-800`), `rounded-2xl` (16px), zero heavy blurry drop-shadows.
- **Internal Spacing:** `p-4` or `p-5` with dedicated `border-b` header partitions where applicable.

### C. Tables & Operational Rosters
- **Header:** Sticky or static, `bg-slate-50/75 dark:bg-slate-800/60`, `text-[10px] font-bold uppercase tracking-wider text-slate-500`.
- **Row:** `hover:bg-slate-50/50 dark:hover:bg-slate-800/40`, subtle border separator (`divide-y divide-slate-100 dark:divide-slate-800`).
- **Data Cells:** `py-3 px-4`, clean vertical alignment, tabular monospace codes and coordinates.

### D. Status Indicators & Badges
- **Live Dot:** `h-2 w-2 rounded-full animate-pulse` accompanying status copy (`• Live Reconciling`, `• On Duty`).
- **Triage Urgency Pills:**
  - `Critical`: `bg-rose-50 text-rose-700 ring-1 ring-rose-500/30`
  - `High`: `bg-amber-50 text-amber-700 ring-1 ring-amber-500/30`
  - `Moderate`: `bg-blue-50 text-blue-700 ring-1 ring-blue-500/30`
  - `Resolved / Ready`: `bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/30`

---

## 6. Role Experience Blueprints

1. **Citizen Experience:**
   - Visual Focus: 1 single prominent circular SOS trigger.
   - Failover: Immediate offline SMS 112 fallback card with exact device coordinates.
   - Tracking: Reassuring step progression without extraneous clutter.
2. **Responder Experience:**
   - Visual Focus: 30-second countdown HUD with audible chime toggle.
   - In-field Usability: Large touch targets for gloves and wet-screen operations.
   - Status: One-touch availability switcher (`Available`, `On Mission`, `Off Duty`).
3. **Hospital Operations Desk:**
   - Visual Focus: Clinical capacity steppers and inbound emergency case queue.
   - Clarity: Direct visibility into ICU ventilator and oxygen reserves.
   - Zero Fictitious Data: All metrics tethered to actual facility DB record.
4. **State Command Centre:**
   - Visual Focus: Coordinated tactical map + bottom incident dispatch table.
   - Workflow: Auditable dispatch state transitions with override protections.

