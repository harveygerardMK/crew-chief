# Command Content Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce repeated content and sharpen the Crew Chief visual system around five agreed changes: tighter home dashboard, reusable signal panels, one Crew Ops block, tactical page intros, and compact data bands.

**Architecture:** Add small Astro components for repeated command UI instead of copying markup across pages. Keep JSON race data and app behavior unchanged. Use existing global CSS and Sierra signal room tokens.

**Tech Stack:** Astro 5, TypeScript, vanilla CSS custom properties, existing JSON data.

---

## Tasks

### Task 1: Add reusable command components

**Files:**
- Create: `src/components/CrewOps.astro`
- Create: `src/components/RaceDataBand.astro`
- Modify: `src/styles/global.css`

- [ ] Create `CrewOps.astro` with four core crew actions: Next stop, Race board, Crew guide, Aid stations.
- [ ] Create `RaceDataBand.astro` with compact race facts from `race` and `site` data.
- [ ] Add `.signal-panel`, `.crew-ops`, and `.race-data-band` styles.
- [ ] Run `npm run build`.
- [ ] Commit with `feat: add reusable command content panels`.

### Task 2: Tighten homepage content

**Files:**
- Modify: `src/pages/index.astro`

- [ ] Replace repeated homepage action/path/meta content with `CrewOps` and `RaceDataBand`.
- [ ] Keep `StatusBlock`, `LiveRaceUpdates`, and one clear family tracker note.
- [ ] Run `npm run build`.
- [ ] Commit with `content: consolidate homepage command dashboard`.

### Task 3: Shorten tactical page intros

**Files:**
- Modify: `src/pages/next.astro`
- Modify: `src/pages/board.astro`
- Modify: `src/pages/crew.astro`
- Modify: `src/pages/follow.astro`

- [ ] Shorten intro leads to one operational sentence each.
- [ ] Use `CrewOps` only where it prevents repeated action lists.
- [ ] Preserve all functional forms, scripts, and data rendering.
- [ ] Run `npm run build`.
- [ ] Commit with `content: tighten tactical page intros`.

### Task 4: Final verification and review

**Files:**
- Review all changed files.

- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Request code review.
- [ ] Fix Critical or Important findings.
- [ ] Push branch and update/create PR.

---

## Plan self-review

- Covers all five requested visual/content changes.
- Keeps changes scoped to content presentation and shared components.
- Contains no unresolved placeholder markers.
