# Sierra signal room identity - design spec

**Status:** Approved direction (brainstorm 2026-05-28)
**Author:** Harvey + agent
**Goal:** Update Crew Chief's visual identity so it feels like a rugged race-operations command surface for the Tahoe 200 crew, with enough Sierra expedition character to feel ownable and memorable.

---

## Context

- **Site:** Static Astro site for Harvey's Tahoe 200 crew, pacers, and family follow-along.
- **Current identity:** Warm field-manual styling with paper tones, serif display type, compact crew information, and burnt-orange accents.
- **Reference input:** `Leonxlnx/taste-skill`, especially:
  - `redesign-existing-projects`: audit current UI, keep the stack, improve targeted visual weak points.
  - `design-taste-frontend`: infer the design read before changing aesthetics; avoid generic AI frontend patterns.
  - `brandkit`: build a coherent identity world around a symbolic metaphor rather than isolated decoration.
- **Selected direction:** Start from "race ops" clarity, then add "Sierra expedition" novelty through angular geometry, terrain texture, route-signal gradients, and coded station language.

---

## Design read

**Reading this as:** an expedition command interface for a small race crew, with a dark Sierra signal-room language, leaning toward native Astro/CSS tokens and restrained motion.

### Taste Skill dials

| Dial | Value | Reason |
|------|-------|--------|
| Design variance | 7 | The site should feel more distinctive than a plain field manual, but not experimental enough to compromise race-week scanning. |
| Motion intensity | 3 | Race logistics need calm, predictable UI. Motion can support hover, focus, and route emphasis, but should not become cinematic. |
| Visual density | 6 | Crew pages contain real operational data. The identity should support compact station cards, timings, and status panels. |

---

## Brand promise

Crew Chief should feel like:

> The signal room for Harvey's Tahoe 200 crew: live-enough, rugged, precise, and ready for the next decision.

The identity should not feel like:

- A generic endurance-race brochure.
- A soft beige lifestyle site.
- A futuristic dashboard unrelated to mountains and trails.
- A decorative redesign that makes race information harder to use.

---

## Visual system

### Palette

Use a darker, more operational base while preserving Sierra warmth through a single strong accent.

| Token role | Direction | Notes |
|------------|-----------|-------|
| Base surface | Charcoal pine / off-black green | Main page background and dark panels. Avoid pure black. |
| Raised surface | Deep green-gray | Cards, nav, route panels, and operational modules. |
| Divider | Desaturated blue-green gray | Low-contrast but visible on dark surfaces. |
| Primary ink | Off-white with slight green warmth | Main text on dark surfaces. |
| Secondary ink | Mist gray-green | Metadata, helper text, timestamps. |
| Accent | Signal orange | Only for priority action, active state, live status, and key route signals. |
| Secondary environment tones | Pine, granite, route amber | Used inside gradients and subdued background texture only. |

**Rule:** Keep one active accent. Signal orange is the action color. Do not introduce random blue, purple, or teal CTAs.

### Gradients and texture

Borrow the bolder energy from "Trail control" without losing the "Signal room" base.

- Use angled route bands with `linear-gradient()` in pine-to-orange ranges.
- Clip selected bands and panels with diagonal edges using `clip-path` or pseudo-elements.
- Add subtle topo or route-line texture as low-opacity background layers.
- Keep gradients purposeful:
  - hero atmosphere
  - active route/leg emphasis
  - status priority panels
  - not every card

### Geometry

Angular forms are the main novelty device.

- Primary CTA and selected operational panels may use clipped diagonal corners.
- Secondary cards can stay rectangular for readability.
- Avoid applying clipped corners everywhere. A few strong angular moments will read better than a full novelty skin.
- Borders should be crisp and functional, like instrument panels or weatherproof labels.

### Typography

The current serif field-manual display type gives warmth, but the new direction should become more operational.

Recommended direction:

- Display: heavy, compressed or geometric sans if added later.
- Body: keep a highly readable system or existing sans.
- Mono: keep for timing, distance, station codes, and tabular data.
- Use sentence case for most headings.
- Use uppercase mono labels sparingly for station codes and operational metadata.

**Eyebrow restraint:** Do not put uppercase mono labels above every section. Use them only where they behave like real operational labels.

### Voice and labels

Use short, race-useful language.

Good:

- "Next stop"
- "Move now"
- "Arrival window"
- "Crew call"
- "Aid station"
- "Night leg"
- "Signal"

Avoid:

- "Elevate your race experience"
- "Seamless crew coordination"
- "Unlock next-gen endurance logistics"
- vague marketing copy

---

## Page-level application

### Home

The homepage should become the clearest expression of the identity.

- Hero reads as command surface, not welcome brochure.
- Add one strong angled gradient/route band behind or beside the main message.
- Show the most important crew action paths as operational buttons:
  - Next stop
  - Race board
  - Crew guide
- Keep race status readable above visual novelty.

### Next stop

This page should feel most like the signal room.

- Prioritize leave-by, arrival window, station, and action state.
- Use signal-orange only for the highest-priority next action.
- Use compact mono timing blocks with strong contrast.
- Angular panels can emphasize "move now" or critical route context.

### Race board

Keep density and scanning above decoration.

- Use dark raised rows or panels with clear dividers.
- Preserve tabular alignment.
- Apply the identity through typography, color, and selected status markers rather than complex card shapes.

### Crew guide and aid stations

Use expedition novelty more lightly.

- Add route-line texture or small angled headers.
- Keep long-form reading comfortable.
- Avoid making every aid station card visually loud.

### Follow / family-facing pages

Use a slightly calmer expression.

- Family pages should inherit the new colors and typography.
- Keep the language warm and reassuring.
- Avoid over-indexing on "command center" intensity for non-crew readers.

---

## Component rules

### Buttons

- Primary button: signal orange, clipped or angled shape allowed.
- Secondary button: dark raised surface with border.
- Text links: off-white or mist gray with orange hover.
- No duplicate CTA labels for the same intent.
- Desktop button labels must stay on one line.
- All focus states must remain visible.

### Cards and panels

- Use cards only when grouping helps scanning.
- Prefer instrument-panel surfaces over generic white card shadows.
- Use tinted borders and subtle background contrast instead of heavy shadows.
- Reserve clipped corners for priority panels or hero modules.

### Data blocks

- Use mono numerals and tabular alignment.
- Treat time, distance, and station codes as first-class visual elements.
- Do not sacrifice contrast for atmosphere.

### Backgrounds

- Use dark base surfaces with route-line or topo-line overlays.
- Keep texture subtle enough not to interfere with text.
- Avoid sudden unrelated light sections unless they serve a specific family-facing reading need.

---

## Accessibility and usability

This identity must support race-week use on phones, often under stress.

- Maintain WCAG AA contrast for body text, buttons, form labels, and metadata.
- Preserve large tap targets on mobile.
- Avoid animation that delays access to information.
- Respect `prefers-reduced-motion`.
- Keep content hierarchy clear without relying on color alone.
- Do not hide core crew actions behind decorative interactions.

---

## Implementation boundaries

This spec describes the identity direction only. Implementation should stay within the existing Astro and CSS-token architecture.

In scope for a later implementation plan:

- Update `src/styles/tokens.css` with the new palette and legacy aliases.
- Update global surfaces, links, buttons, and focus styles.
- Update core shared components that define identity:
  - `BaseLayout.astro`
  - `SiteNav.astro`
  - `StatusBlock.astro`
  - key card/action components
- Apply page-specific polish to Home, Next stop, Race board, Crew guide, and Follow.
- Keep JSON data and race facts unchanged.

Out of scope for the identity pass:

- Changing race data.
- Changing broadcast Worker behavior.
- Adding a new frontend framework.
- Introducing heavy animation libraries.
- Rewriting all components from scratch.
- Replacing content strategy beyond short UI-label cleanup.

---

## Testing and review criteria

| Area | Expected result |
|------|-----------------|
| Build | Astro production build succeeds. |
| Mobile navigation | Primary nav remains usable and does not wrap into broken rows. |
| Home | The new identity is clear within the first viewport and primary paths are obvious. |
| Next stop | Highest-priority crew action is immediately identifiable. |
| Race board | Timings and stations remain scannable after the visual update. |
| Follow | Family-facing content remains readable and not overly tactical. |
| Accessibility | Keyboard focus, contrast, and tap targets remain usable. |
| Reduced motion | Any motion enhancements gracefully reduce or disappear. |

---

## Success criteria

- The site feels like a Tahoe 200 crew command surface, not a generic template.
- B's operational clarity remains the foundation.
- C's novelty appears through gradients, angular route geometry, and expedition texture.
- Crew-critical pages become easier to scan, not harder.
- The identity can be applied through tokens and focused component updates without a full rebuild.
