# SFT Billing

An executive financial workspace for office billing and financial management — built as a desktop-first web app today, packaged as a Windows desktop app (via Tauri) starting in Phase 7.

## ⚠️ Before you run this

This codebase was written in a sandboxed environment **with no network access**, so it has not been run through `npm install`, compiled with `tsc`, or started with `vite dev`. Every file was written and manually reviewed for correctness, consistent imports/exports, and Tailwind class names that match the token config — but there is a real chance a first `npm install && npm run dev` surfaces a small issue (a version mismatch in a dependency, a minor type error). If that happens, it's normal for a from-scratch scaffold; paste the error back and it'll get fixed immediately.

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (defaults to `http://localhost:1420`).

To type-check and build a production bundle:

```bash
npm run build
npm run preview
```

## What's in Phase 1

Per the phased build-out requested for this project, **Phase 1 delivers**:

- Project setup: Vite + React + TypeScript + Tailwind, with a path alias (`@/`) and a Tauri-ready config (relative asset base, fixed dev port, no browser-only routing assumptions)
- The full design-token system (`src/styles/tokens.css`) — light and dark themes, wired into Tailwind (`tailwind.config.ts`) so no component ever hard-codes a color, radius, shadow, or motion duration
- Typed data models for `Invoice`, `Client`, `Payment`, `ActivityEvent`, `Product`, `User`, `Report` (`src/types/`)
- A deterministic, seeded mock dataset (`src/data/`) — six clients, ~35 invoices spanning twelve months (for the revenue trend) plus a deliberately varied "current cycle" covering paid, pending, overdue (both the mild and severe band), and draft invoices. Payments and activity-timeline events are *generated from* the invoices, not hand-entered separately — so the ledger, the dashboard, and the timeline can never disagree with each other.
- A `DataProvider` interface (`src/services/dataProvider.ts`) and a mock implementation with simulated network latency — the seam where a real API swaps in later (Phase 6) without touching any component
- The desktop application shell: collapsible sidebar (`SidebarNav`), main workspace, dark/light theme toggle
- The **Overview** screen — the Financial Command Center: a dominant hero revenue metric, a clickable status strip that cross-fades the panel below into a focused, filtered invoice list (no page navigation), a revenue trend chart (Recharts, 6/12-month toggle), a recent-activity feed, and a calm inline alert banner for seriously overdue invoices
- A global **Command Palette** (`Ctrl/Cmd+K`) with subsequence fuzzy search, grouped results (Quick Actions / Navigation / Invoices), and full keyboard navigation
- The **AURA** assistant shell: the collapsed floating mark, the expanding panel, conversation history, and a small set of Phase-1 rule-based commands wired to the *real* dataset (overdue/pending/paid/draft counts, this month's revenue) — see `src/lib/auraAssistant.ts` for exactly what it can and can't do yet
- Polished loading (skeleton), empty, and error states — not just the happy path
- Every visible navigation item and command that isn't wired up yet is **visibly disabled and labeled** ("Soon" / "Phase 2" / "Phase 3"), never a silent dead click

## What's intentionally NOT in Phase 1

Per the requested phasing:

- **Phase 2** — Invoices list screen, Create Invoice split-screen workspace
- **Phase 3** — Clients (Relationship Hub), Payments (ledger + record-payment slide-over)
- **Phase 4** — Reports, Intelligence
- **Phase 5** — AURA's deeper integration (a real intent/action loop replacing the Phase 1 rule-based matcher in `src/lib/auraAssistant.ts`)
- **Phase 6** — Swapping `mockDataProvider` for a real database/API-backed `DataProvider` implementation
- **Phase 7** — Tauri scaffolding (`src-tauri/`), Windows packaging, `SFT Billing Setup.exe`

The sidebar and command palette already show all of these destinations so the full information architecture reads as complete — clicking them today shows a "coming soon" state rather than nothing happening.

## Project structure

```
src/
  types/            Invoice, Client, Payment, ActivityEvent, Product, User, Report
  data/             Seeded mock dataset + date/random helpers
  services/         DataProvider interface + mock implementation (the API seam)
  hooks/            Domain hooks (useInvoices, useClients, ...) + the Zustand UI store
  lib/              Pure functions: invoice math, formatters, overview aggregation, fuzzy search, AURA's Phase 1 command matcher
  components/
    layout/         AppShell, SidebarNav, PageHeader
    overview/        MetricHero, StatStrip, RevenueChart, ActivityFeed, FocusedInvoiceList
    command-palette/ CommandPalette
    aura/            AuraPanel
    shared/          StatusChip, Button, EmptyState, SkeletonLoader, InlineBanner
  pages/            OverviewPage
  styles/           tokens.css — the single source of truth for color/type/radius/shadow/motion
```

## Design tokens, at a glance

Every value below is a CSS variable in `src/styles/tokens.css`, exposed to Tailwind in `tailwind.config.ts` — change it once, it updates everywhere:

- Canvas `#F7F5F1`, Surface `#FFFFFF`, Ink `#1B1A18`
- Accent (primary actions, healthy state) — deep emerald `#1F5A44`
- Premium/AURA accent — muted champagne/bronze `#9C7A3C`
- Status colors: Paid (success green), Pending (calm blue-gray — a normal state, not a warning), Overdue mild → strong (amber → desaturated brick red), Draft (neutral gray)
- Display type: Fraunces (serif) for hero numbers and headings; Inter (sans) for everything else; tabular numerals everywhere money appears

## Phase 7 note on Tauri

Nothing in this codebase assumes a browser-only environment (no `window.location`-based routing, relative asset paths via `base: "./"` in `vite.config.ts`, a fixed dev port for a future `tauri.conf.json` to target). When Phase 7 starts, the added step is running Tauri's own scaffolding (`cargo install tauri-cli` and `npm create tauri-app` or `cargo tauri init`) against this existing `src/`, not restructuring the frontend.
