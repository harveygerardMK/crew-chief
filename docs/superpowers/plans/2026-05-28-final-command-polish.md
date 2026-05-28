# Final Command Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the remaining major improvements: mobile pass, mobile race-board cards, reduced long-form content, visual priority system, and accessibility refinements.

**Architecture:** Keep all data sources and behavior intact. Add responsive markup only where needed, then style it through the existing Sierra signal room CSS system.

**Tech Stack:** Astro 5, TypeScript, vanilla CSS.

---

## Tasks

### Task 1: Mobile board cards

**Files:**
- Modify: `src/pages/board.astro`
- Modify: `src/scripts/tahoe-app.ts`
- Modify: `src/styles/global.css`

- [ ] Render mobile board cards from the same board rows.
- [ ] Update board JS to refresh both table rows and mobile cards.
- [ ] Hide table on narrow screens and show cards.
- [ ] Run `npm run build`.

### Task 2: Collapse remaining long-form detail

**Files:**
- Modify: `src/pages/crew.astro`
- Modify: `src/pages/follow.astro`
- Modify: `src/styles/global.css`

- [ ] Wrap secondary explanatory content in `details.more-panel`.
- [ ] Keep urgent/primary content visible.
- [ ] Run `npm run build`.

### Task 3: Priority and accessibility polish

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/board.astro`
- Modify: `src/styles/global.css`

- [ ] Add skip-to-content link.
- [ ] Add priority-action styling for critical CTAs.
- [ ] Improve mobile spacing, nav wrapping, tap targets, and focus styles.
- [ ] Run `npm run build` and `git diff --check`.

---

## Self-review

- Covers all five requested improvements.
- Keeps race data and app behavior intact.
- Contains no unresolved placeholder markers.
