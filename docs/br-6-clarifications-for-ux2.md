# BR-6 Clarifications for UX-2 Patch

**From:** Brain
**For:** UX thread (UX-2 Business Case patch brief)
**Date:** April 5, 2026

Three questions answered. Short version: flat range = no bar (single point), chips = amber pills, banner = 2+ kill factors, nudge CTA = split from inline arrow into separate button.

---

## § 4.4 — Flat range bars on 3 of 4 survival numbers

**Decision:** Cash to Open, Months of Runway, Cushion Needed display **as a single-point number only — no range bar at all.** Only Break-Even Month renders a min/max range.

**Why the asymmetry:**
- **Cash to Open** = `buildoutBudget + 45K` — buildout is a fixed concept input, doesn't move with revenue scenarios
- **Months of Runway** = `fundingCapital / (Year0 SDE / 12)` — capital and pre-opening burn, pre-revenue period
- **Cushion Needed** = `cashToOpen − fundingCapital` — buildout minus capital, neither moves with revenue
- **Break-Even Month** = cumulative Σ SDE ≥ 0 — this IS revenue-driven, so Optimistic/Stressed multipliers shift when the model crosses zero

Showing a ±range bar on the three fixed numbers would imply they move under scenarios. They don't. Rendering a range where none exists misleads the user.

**UX display spec:**
- Cash to Open: just "$395,000" (big number, no bar, no shading)
- Months of Runway: just "7 months"
- Cushion Needed: just "$330,000"
- **Break-Even Month: "22 months" with a min/max bar underneath** — bar shows e.g. `16 ─── 22 ─── 30` (optimistic / base / stressed)

**Edge case:** if Rent Escalation scenario toggle is active, loan payment shifts (because rent feeds SDE every year). That appears in the Detailed tab P&L, not in the four summary numbers. Summary stays clean.

---

## § 6.4 — Kill factor chips + multi-factor banner

**Kill factor chip** = a small amber warning pill that sits below the survival number grid (or inline next to the affected number). Copy format:

```
⚠ Rent 14% — above 10% threshold
⚠ Runway 2 months — below 3-month floor
⚠ Gap $680K — 1.7× cash-to-open
```

**Three kill factors exist** (per BR-6 § 6.1):
1. Rent Kill — rent % of revenue > concept threshold
2. Thin Runway — `monthsOfRunway < 3` and capital > 0
3. Stress Capital Gap — cushion needed > 1.5× cash-to-open

**Display rules (per BR-6 § 6.4):**

| Active kill factors | Treatment |
|---|---|
| 0 | Nothing — clean verdict, no chips, no banner |
| 1 | **1 amber chip** below survival grid. Verdict label keeps its normal color. |
| 2 | **Red banner at top of Summary tab** listing all active factors + verdict rendered in Rethink color regardless of raw break-even |
| 3 | Same as 2 — red banner + Rethink verdict |

**The multi-factor banner fires at 2+ kill factors.** Visual: red background strip across the top of the Summary card. Copy format: `"⚠ 2 kill factors active: Rent 14% · Runway 2 months"` (listed, pipe-separated).

**Why the escalation:** one kill factor is a manageable problem (visible, flagged). Two or more means the business case is structurally broken — the user needs to see that loud, not dismiss it as a minor warning.

---

## § 7 — Nudge CTA separation

**The change:** The `isPartialSeed` nudge state previously had one element — a single sentence with a trailing arrow:

```
OLD: "Run the Business Case to see survival numbers for this location →"
     (one element, the arrow is part of the sentence, whole line is the link)
```

**New:** split into two elements — a plain statement + a separate button below it:

```
NEW:  "Run the Business Case to see survival numbers for this location."
      [ Build Business Case → ]  ← separate button element
```

**Separate from what:** separate from the body copy *within the nudge card itself*. The nudge state is already the whole-card treatment (replaces the 4 survival number boxes). Inside that card, the copy and the CTA are now two distinct elements instead of one linked sentence.

**Not separate from any other CTA** — there's no conflict with a card-level or page-level CTA. This is purely about the internal structure of the nudge state.

**Visual treatment (per BR-6 § 7, updated):**
- Dashed grey card (muted)
- Body copy (plain text, not a link)
- CTA button "Build Business Case →" linking to `/app/financials?addr=[addr]`
- Mobile: full-width card, button tap target = full button width

---

## Quick reference — what UX-2 needs to update

| Wireframe area | What changes |
|---|---|
| 4 survival number grid | Cash to Open / Runway / Cushion = single numbers, no bars. Break-Even Month = number + min/max range bar below it. |
| Below survival grid | 0 or 1 amber kill factor chips, depending on active factors |
| Top of Summary tab | Red banner strip if 2+ kill factors active |
| isPartialSeed nudge | Split copy from CTA: plain body text + "Build Business Case →" button (two elements) |
| FICO block | No change — stays in Summary tab with `creditGateMessage` only (no loan amounts/rates) |
| Scenario range bar | Only renders on Break-Even Month card, nowhere else |

---

*Any further clarifications needed, flag Brain.*
