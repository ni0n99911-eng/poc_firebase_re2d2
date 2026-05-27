# BRAIN-LOG — April 11 Emergency Fix Pack

**Author:** UX thread
**Audience:** Brain thread (T9)
**Scope:** dependencies, cross-thread contracts, and findings the UX thread hit while shipping its side of `RE2-Location-IQ-Emergency-Fix-April11.md`.
**UX branch:** `ux/emergency-fix-april11` (cut from `b675c84` on `origin/main`)
**UX SHAs landed:**
- `a5a3c8e` — EF-3/4/5: percentile copy + data source tooltip + BC tip removal
- `c38d2ef` — EF-1: `<ScoreHeader>` composite + demoted PRELIM
- `e71aeb1` — EF-2: AskAnything shared `askCopilot` + inline answer surface
- `24c2d54` — EF-7: "How to gain points" top-3 + expander

**Baseline:** svelte-check **642/430/100** on every commit. No regression.

---

## 1. Cross-thread contracts — Brain needs to own these

### 1a. Root Cause 3 narrative `confidence` guard — STASHED FOR YOU
Brain had a work-in-progress edit in `src/lib/utils/decision-engine.ts` that introduced the `__visionPrelim` special key + `"We're scoring without your concept details. Add them to sharpen this by ~8 points."` fallback copy. This was sitting in my working tree when I cut the emergency-fix branch. I isolated it to protect the UX commits.

**Recovery:**
```
git stash list
# Look for: "On emergency-fix-april11: brain wip EF-2 confidence guard — for Brain thread"
git stash apply stash@{N}  # where N matches
```
The stash is on this branch. Pop it on whatever Brain branch you cut for Root Cause 3.

### 1b. Root Cause 6 reliability `confidence` prop plumbing — UX is ready to consume
The brief's fix is: every metric surface takes an optional `confidence: number` (0–100), `< 80` shows `~` prefix + tooltip, `< 60` goes skeleton. UX side is a prop drill through `v3-hero-percentile`, neighborhood snapshot cards, and the 6-lens payload consumers in `src/routes/app/location/+page.svelte`.

**Blocker:** the Brain-side contract isn't live yet. Brain needs to:
1. Decide whether `confidence` lives on each metric object or as a sibling `confidenceBySource` map.
2. Thread it into `scoreData` so the location page's `$derived` block can read it.
3. Pick the thresholds (80 / 60) and put them in `src/lib/intel/tiers.ts` alongside tier labels as the brief spec'd.

**UX contract I'll honour once this lands:**
- `props.confidence >= 80` → render plain number (today's behaviour).
- `60 <= props.confidence < 80` → render `~{n}` + `title="Preliminary — based on partial data, refreshing soon."`
- `props.confidence < 60` → render skeleton pill `<span class="metric-skeleton" aria-busy="true" />`.

Give me the shape and I'll wire it across the hero, neighborhood snapshot, and lens surfaces in one pass.

### 1c. EvidenceItem needs a `category` field — blocks UX-FIX-7 grouping stretch
The brief for EF-7 ("How to gain points") asked for *"Show top 3 + 'see 4 more ways →' expander. Sort by impact, **group by category**."* I shipped top-3 + expander (24c2d54). **I could not ship category grouping** because `EvidenceItem` in `decision-engine.ts` is:
```ts
{ key, label, value, direction, changeability, copy }
```
No `category` field. Adding one is Brain's call — it's a scoring contract, not a render concern.

**Proposed shape:**
```ts
type EvidenceCategory = 'location' | 'vision' | 'financials' | 'operations';
interface EvidenceItem {
  key: string;
  label: string;
  value: number;
  direction: 'up' | 'down';
  changeability: 'easy' | 'moderate' | 'hard';
  copy?: string;
  category: EvidenceCategory;  // NEW
}
```
Once the field is populated, I'll update `src/routes/app/location/+page.svelte` to group `gainPrimary` and `gainMore` by category with small section headers. Already have the render code drafted; ~10min once the field exists.

### 1d. UX-FIX-6 (stretch) — hero verdict emotional-register rewrite is Brain territory
The brief's stretch item 11 asks for copy like:
> "Workable coffee location. You're on a solid block. Two things to address before signing — we'll show you both."

I did NOT ship this on the UX branch because the copy lives inside `fitMeaning(score)` in `src/lib/utils/decision-engine.ts`, which per thread scope rule is Brain's file. The location component just renders `{fitIQ}/100 — {_fitLabel}.</strong> {_fitMeaning}` verbatim.

**What UX can do:** once `fitMeaning()` returns the new register, the hero already renders it. Zero UX changes required. I'll verify the rendered copy against the brief's style on the next commit after Brain ships.

**What Brain needs to do:**
- Rewrite `fitMeaning(score)` to produce second-person, action-oriented, anxiety-acknowledging copy.
- The "Two things to address before signing — we'll show you both" style implies the function needs to know *how many red flags are in `watchOut[]`* and *what the top-1 improvement lever is*. Suggest a new signature: `fitMeaning(score, { watchOutCount, topLever? })`.
- Suggest also exporting `fitVerdictShort(score)` → `"Workable coffee location."` so the hero can drop the redundant `{fitIQ}/100 — {_fitLabel}.` prefix in favour of a single sentence.

This interacts with Root Cause 4 (lens → watchOut propagation) — `fitMeaning` should read `scoreData.watchOut.length` after RC4 ships, or the "Two things to address" line will lie.

---

## 2. What I found while auditing — Brain needs to see this

### 2a. Survival tip copy fix in working tree — not mine, left alone
`src/routes/app/location/+page.svelte` line ~3316 had a pre-existing uncommitted edit that rewrote two `survivalTip` strings from index form (`(${survival}/100 vs NYC avg 52%)`) to raw percentage form (`${survival}% year-1 survival rate on this block vs NYC average of 52%`). This is the Root Cause 5 unit collapse work — looks like somebody (Brain? Kalpna?) started it in-place.

I preserved it. It's sitting in the working tree untouched. If you want it committed on the Brain side, it's yours to stage. I explicitly did not touch that helper function in any of my 4 UX commits.

### 2b. Other uncommitted Brain work in my working tree (as of commit 24c2d54)
When I checked `git status` after my last commit, the following were modified but unstaged — these are all Brain territory, I did not touch them:
- `src/lib/components/ScoreRangeBar.svelte`
- `src/lib/intel/dashboard-brain.ts`
- `src/lib/intel/heads-up-engine.ts`
- `src/lib/location/components/AddressAnalyzer.svelte`
- `src/lib/location/components/HeadsUpCards.svelte`
- `src/lib/location/components/RecommendationCards.svelte`
- `src/lib/scoring.ts`
- `src/lib/session.ts`
- `src/lib/utils/decision-engine.ts`
- `src/routes/api/business-case-summary/+server.ts`
- `src/routes/api/location-iq/+server.ts`
- `src/routes/app/dashboard/+page.svelte`
- `src/routes/app/space/+page.svelte`
- **UNTRACKED:** `src/lib/intel/tiers.ts`

The untracked `tiers.ts` file is *exactly* what the brief's Root Cause 1 fix specs out — Brain is already scaffolding the shared `tierFor()` function. Good.

Heads-up that `src/routes/app/location/+page.svelte` is in that list too because it now carries the four UX fixes AND the pre-existing survival-tip edit from 2a. That overlap is intentional — do NOT `git checkout HEAD` that file, it'll blow away my UX commits.

### 2c. `dataSourcesModalOpen` is dead code now
EF-3 replaced the "View data sources" button with a static tooltip span. The state flag `dataSourcesModalOpen` and the modal component that consumed it are still in the file as unreferenced code. Left them in place because a second consumer might exist (I didn't grep exhaustively), but flagging: a future cleanup pass can delete.

### 2d. CoPilotChat.svelte dead import — removed as part of EF-2
Dropped in `e71aeb1`. The component itself (`src/lib/components/CoPilotChat.svelte`) still exists; it might have consumers elsewhere, I didn't check. Flag for backlog: if nobody else imports it, delete the file.

---

## 3. UX findings on surfaces Brain owns (not bugs, observations)

### 3a. Dashboard consistency with the new hero composite
The emergency-fix hero now uses `<ScoreHeader>` on `src/routes/app/location/+page.svelte`. The dashboard page (`src/routes/app/dashboard/+page.svelte`) still has its own ad-hoc grade+verdict markup for the shortlist compare panel and the primary card. Not breaking, but the visual vocabulary will drift again unless dashboard consumes `<ScoreHeader>` too. Backlog item for UX next pass — noting it here so Brain can confirm the grade/verdict/confidence contract doesn't change under me.

### 3b. Percentile copy is locked to "coffee" concept label
EF-5 shipped canonical copy: `"Better than ${betterThan}% of NYC ${label} locations we've analyzed"`. The `${label}` comes from `fitTierLabel` / concept metadata. If Brain renames any concept label downstream (e.g. "coffee" → "coffee shop") the percentile line will auto-update. No hard-coded "coffee" in the UX layer. Good.

### 3c. `askCopilot()` is the only CoPilot entry point now
Every chip, the hero "How?" button, the per-lens "Ask CoPilot →" buttons, and the bottom CoPilot bar all route through one shared `askCopilot(text: string)` function (e71aeb1). Messages are appended to `inlineCpMessages` and rendered in a new `<div class="v3-ask-answer">` surface below the hero.

**Brain contract honoured:** `handleCoPilotMessage(q)` is called with the raw user string, its return value is awaited, and the reply is rendered. Brain owns that function — if its signature changes (e.g. to accept context), let me know.

### 3d. PRELIM envelope wording is now inside `<ScoreHeader>`
Copy for PRELIM/PARTIAL lives in `src/lib/components/ScoreHeader.svelte`, not in the location page. The strings are:
- `preliminary` → `"PRELIM — score will sharpen as you add details"`
- `partial` → `"PARTIAL — a few inputs away from a confident read"`

If Brain's narrative engine ever wants to tune these (e.g. to include a count like "add 4 more fields"), the UX surface is ready to accept a richer `confidenceReason` prop — I already thread it through as `title=""`. Push a string, it becomes the hover tooltip.

---

## 4. Recommended Brain execution order

Given what's already in your working tree and what UX is waiting on:

1. **(now)** Finish the `tiers.ts` scaffold (already untracked — you started it). Ship Root Cause 1 first — it unblocks consistent labels across every other fix.
2. **(same commit or next)** Pop the stashed EF-2 confidence guard for Root Cause 3. It's already drafted.
3. **Root Cause 2** momentum regression grep + restore + snapshot test. Highest trust-erosion impact per the brief.
4. **Root Cause 4** lens → watchOut propagation contract. Also unblocks UX-FIX-6 `fitMeaning` rewrite since the new copy needs `watchOut.length`.
5. **Root Cause 5** survival unit collapse — commit the in-tree survival tip edit + do the equivalent in every other metric surface.
6. **Root Cause 6** confidence prop contract → ping UX, I'll plumb it through the metric surfaces in one pass.
7. **EvidenceItem `category` field** → ping UX, I'll add the grouping render in 10min.
8. **`fitMeaning()` rewrite** for the UX-FIX-6 stretch.

---

## 5. Hand-off checklist for UX → Brain

- [x] 4 UX commits on `ux/emergency-fix-april11`, svelte-check 642/430/100.
- [x] Stashed Brain WIP labelled for recovery (see §1a).
- [x] Pre-existing working-tree edits preserved, not touched.
- [x] `<ScoreHeader>` composite + `askCopilot()` shared handler documented in component headers with `UX-FIX-N` comment anchors.
- [x] This log.
- [ ] Brain: confirm receipt + own §1a / §1b / §1c / §1d.
- [ ] Brain: confirm `askCopilot → handleCoPilotMessage` contract unchanged in Root Cause 3 work.
- [ ] Brain: when `tiers.ts` lands, signal UX so I can retire any remaining local tier-literal strings in the location page narrative bullets.

— UX
