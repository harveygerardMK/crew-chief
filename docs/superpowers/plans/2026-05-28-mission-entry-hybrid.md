# Mission Entry Hybrid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Mission Control / Entry System direction: concept 1's modular dashboard structure with concept 3's lively credential graphics and Pavillion palette.

**Architecture:** Keep Astro components and race data unchanged where possible. Update tokens and CSS first, then add small markup hooks for barcode strips, station IDs, and priority chips.

**Tech Stack:** Astro 5, vanilla CSS, existing JSON data.

---

## Tasks

### Task 1: Extend the visual token system

- [ ] Add peach, lime, blue, paper, barcode, and entry-strip tokens in `src/styles/tokens.css`.
- [ ] Keep existing accessible foreground/background pairings.
- [ ] Run `npm run build`.

### Task 2: Apply the hybrid identity to shared modules

- [ ] Restyle RaceDataBand as a top telemetry rail.
- [ ] Restyle CrewOps and signal panels with barcode/entry graphics.
- [ ] Add lime priority treatment for critical action modules.
- [ ] Run `npm run build`.

### Task 3: Apply the hybrid identity to homepage and board

- [ ] Add homepage entry-system station panel and barcode strip.
- [ ] Add board/mobile-card station ID and credential details.
- [ ] Run `npm run build` and `git diff --check`.

---

## Self-review

- Covers the approved visual direction.
- Does not change race data or core behavior.
- Contains no unresolved placeholder markers.
