# Sierra Signal Room Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Sierra signal room visual identity to Crew Chief's Astro site.

**Architecture:** Keep the existing Astro and vanilla CSS architecture. Update design tokens first, then apply the identity through shared global styles, the homepage hero/status area, the next-stop command center, and shared cards/data blocks without changing race data or backend behavior.

**Tech Stack:** Astro 5, TypeScript, vanilla CSS custom properties, existing JSON data.

---

## File structure

- Modify `src/styles/tokens.css`: replace field-manual token values with dark pine, raised operational surfaces, signal orange, mist text, gradients, and route texture aliases.
- Modify `src/styles/global.css`: apply the identity to global body/header/footer styles, buttons, status block, card/panel surfaces, homepage hero, audience cards, command center, board statuses, and reduced-motion behavior.
- Modify `src/layouts/BaseLayout.astro`: update theme color and font stack to a more operational sans display direction while preserving readable body/mono fonts.
- Modify `src/pages/index.astro`: adjust hero copy and CTA labels/classes so the homepage reads as a command surface.
- Modify `src/components/StatusBlock.astro`: tighten action labels and add a signal-room class hook for status actions.
- Modify `src/pages/next.astro`: add a signal surface class to the next-stop wrapper for page-specific gradients.
- Modify `src/scripts/tahoe-app.ts`: adjust command-center labels from generic planning wording to operational "arrival window", "leave by", and "crew move" language.

---

### Task 1: Establish Sierra signal tokens

**Files:**
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Replace the token block**

Update `:root` to use these identity values while preserving the existing variable names used across the app:

```css
/* Crew Chief - Sierra signal room design tokens */
:root {
  --surface-base: #0f1719;
  --surface-raised: #172529;
  --surface-deep: #081012;

  --ink-primary: #edf1ea;
  --ink-secondary: #b8c5bf;
  --ink-tertiary: #8ea19f;
  --ink-muted: #718581;
  --ink-divider: #31494e;

  --accent-primary: #d3743a;
  --accent-warning: #d8a84d;
  --accent-success: #7fa36d;

  --link: #edf1ea;
  --link-hover: #f19a5f;
  --focus-ring: 0 0 0 2px #f19a5f, 0 0 0 5px rgba(211, 116, 58, 0.24);

  --font-display: "Barlow Condensed", "IBM Plex Sans Condensed", "Arial Narrow", var(--font-body);
  --font-body: "IBM Plex Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;

  --text-eyebrow: 0.6875rem;
  --text-meta: 0.75rem;
  --text-body-sm: 0.875rem;
  --text-body: 1rem;
  --text-lead: 1.125rem;
  --text-h4: 1.25rem;
  --text-h3: 1.5rem;
  --text-h2: 2rem;
  --text-h1: 2.5rem;
  --text-display: 3.75rem;
  --text-stat: 3rem;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --space-8: 4rem;
  --space-9: 6rem;

  --container-narrow: 36rem;
  --container-base: 48rem;
  --container-wide: 64rem;

  --radius-sm: 0px;
  --radius-md: 2px;
  --radius-lg: 4px;
  --radius-full: 9999px;
  --border-hairline: 1px solid var(--ink-divider);

  --signal-gradient: linear-gradient(130deg, #213936 0%, #405f54 46%, #d3743a 100%);
  --signal-gradient-soft: linear-gradient(135deg, rgba(33, 57, 54, 0.86), rgba(211, 116, 58, 0.22));
  --route-texture: repeating-linear-gradient(145deg, transparent 0 13px, rgba(237, 241, 234, 0.08) 14px 15px);

  /* Legacy aliases used across existing CSS */
  --canvas: var(--surface-base);
  --surface: var(--surface-raised);
  --surface-soft: #121d20;
  --ink: var(--ink-primary);
  --charcoal: var(--ink-primary);
  --slate: var(--ink-secondary);
  --steel: var(--ink-secondary);
  --stone: var(--ink-tertiary);
  --muted: var(--ink-tertiary);
  --hairline: var(--ink-divider);
  --hairline-soft: rgba(142, 161, 159, 0.28);
  --mint: var(--accent-primary);
  --mint-deep: #f19a5f;
  --mint-soft: var(--accent-warning);
  --hero-dark-from: var(--surface-deep);
  --hero-dark-to: var(--surface-raised);
  --hero-sky-from: #405f54;
  --hero-sky-to: var(--accent-primary);
  --sans: var(--font-body);
  --mono: var(--font-mono);
  --shadow-card: none;
  --shadow-featured: none;
}
```

- [ ] **Step 2: Verify tokens are syntactically valid**

Run: `npm run build`

Expected: build succeeds, or any failure is unrelated to CSS token syntax.

- [ ] **Step 3: Commit token work**

```bash
git add src/styles/tokens.css
git commit -m "style: add sierra signal room tokens"
```

---

### Task 2: Apply global signal-room surfaces and buttons

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Update layout metadata and fonts**

In `src/layouts/BaseLayout.astro`, set theme color to `#0f1719` and replace the Google Fonts link with IBM Plex Sans, IBM Plex Mono, and Barlow Condensed:

```astro
<meta name="theme-color" content="#0f1719" />
...
<link
  href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 2: Update global CSS foundations**

In `src/styles/global.css`, update body/header/footer/buttons/cards so the app uses dark operational surfaces, clipped primary CTAs, readable secondary links, and subtle route texture. Keep existing class names.

- [ ] **Step 3: Verify global CSS**

Run: `npm run build`

Expected: Astro build exits 0.

- [ ] **Step 4: Commit global foundation**

```bash
git add src/styles/global.css src/layouts/BaseLayout.astro
git commit -m "style: apply signal room global surfaces"
```

---

### Task 3: Convert the homepage into the command-surface hero

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Update homepage hero copy and CTAs**

Use concise operational copy:

```astro
<p class="page-eyebrow">Crew Chief / {site.race} / {site.year}</p>
<h1>Make the next crew call.</h1>
<p class="lead">
  Live course intel, crew timing, and trail logistics for Harvey's {site.distance_miles}-mile loop around Lake Tahoe.
</p>
```

Use CTAs:

```astro
<a class="btn btn--primary" href={`${base}next/`}>Next stop</a>
<a class="btn btn--secondary" href={`${base}board/`}>Race board</a>
<a class="btn btn--secondary" href={`${base}crew/`}>Crew guide</a>
```

- [ ] **Step 2: Update hero CSS**

In `global.css`, style `.home-hero` with dark background, angled gradient pseudo-element, topo texture, clipped route band, and an instrument-panel mileage block.

- [ ] **Step 3: Verify homepage build**

Run: `npm run build`

Expected: Astro build exits 0.

- [ ] **Step 4: Commit homepage work**

```bash
git add src/pages/index.astro src/styles/global.css
git commit -m "style: reshape homepage as signal room"
```

---

### Task 4: Upgrade status and next-stop command panels

**Files:**
- Modify: `src/components/StatusBlock.astro`
- Modify: `src/pages/next.astro`
- Modify: `src/scripts/tahoe-app.ts`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Tighten status action labels**

In `StatusBlock.astro`, change action labels to:

```astro
<a class="btn btn--secondary" href={`${base}next/`}>Next stop</a>
<a class="btn btn--secondary" href={`${base}board/`}>Race board</a>
```

- [ ] **Step 2: Add next-stop surface hook**

In `next.astro`, use:

```astro
<div class="command-center-wrap signal-surface">
```

- [ ] **Step 3: Update command-center generated labels**

In `src/scripts/tahoe-app.ts`, make these copy changes:

```ts
hero.innerHTML = `
  <p class="command-center__eyebrow">Crew move / Stop ${stop.crew_stop_n}</p>
  <h2 class="command-center__title">${stop.name}</h2>
  <p class="command-center__mile">Mile ${stop.mile} / Cutoff ${stop.cutoff}</p>
  <dl class="command-center__times">
    <div><dt>Arrival window (${pace})</dt><dd>${formatWhen(plannedIso(stop, pace))}</dd></div>
    <div><dt>Leave by</dt><dd>${formatWhen(leaveBy.toISOString())}</dd></div>
    <div><dt>Drive buffer</dt><dd>${driveMin} min before arrival</dd></div>
  </dl>
  <p class="command-center__hint">${minsToLeave < 0 ? "Move now if not already there." : minsToLeave <= 30 ? `Crew move in ~${minsToLeave} min` : `Crew move in ~${Math.floor(minsToLeave / 60)}h ${minsToLeave % 60}m`}</p>
`;
```

- [ ] **Step 4: Update status and command-center CSS**

In `global.css`, make status and command-center panels dark raised surfaces with tinted borders, clipped priority states, mono timing blocks, and signal-orange urgent states.

- [ ] **Step 5: Verify command center build**

Run: `npm run build`

Expected: Astro build exits 0 and TypeScript compiles.

- [ ] **Step 6: Commit command panel work**

```bash
git add src/components/StatusBlock.astro src/pages/next.astro src/scripts/tahoe-app.ts src/styles/global.css
git commit -m "style: upgrade command center panels"
```

---

### Task 5: Tune shared cards, race board, and reduced motion

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Update shared card/data styles**

Apply instrument-panel surfaces to `.card`, `.audience-path`, `.stat-strip`, `.aid-card`, `.pacer-leg-card`, `.board-status`, and table wrappers without changing markup.

- [ ] **Step 2: Add reduced motion guard**

Add:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Final verification**

Run:

```bash
npm run build
git diff --check
```

Expected: build exits 0 and diff check exits 0.

- [ ] **Step 4: Commit shared polish**

```bash
git add src/styles/global.css
git commit -m "style: tune shared signal room components"
```

---

## Plan self-review

- Spec coverage: tokens, global surfaces, homepage, next stop, race board/card surfaces, accessibility, reduced motion, and implementation boundaries are covered.
- Placeholder scan: this plan contains no unresolved placeholder markers.
- Type consistency: all referenced files and class names already exist except the planned `signal-surface` class, which is introduced in CSS and used once in `next.astro`.
