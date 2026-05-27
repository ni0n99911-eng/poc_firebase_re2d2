# RE² · BR-3 · Signals Message Audit
**Brain Thread · April 5, 2026**
**Status: PROPOSAL — awaiting Kalpna approval before any code changes**

---

## 0 · Problem Statement

Users and testers see the message **"Score is based on 0 location signals."** on the Location IQ page. This is alarming — it implies the scoring engine has no data, which shakes trust in the product. The message is a fallback string in `decision-engine.ts`, not a real signal count, and "0" can appear even when scoring data is present.

---

## 1 · Root Cause

**File:** `src/lib/utils/decision-engine.ts` · Line 181

```javascript
else reasons.push(
  `Score is based on ${
    Object.keys(s).filter(k => s[k as keyof typeof s] > 0).length
  } location signals.`
);
```

### When this line fires

This is a last-resort fallback. It runs only when all three conditions are true simultaneously:

1. `reasons.length < 2` — the engine hasn't been able to generate 2 reasons from normal signal logic
2. `mkt < 60` — market proof sub-score is below threshold (no market-proof reason generated)
3. `acc < 65` — accessibility sub-score is below threshold (no accessibility reason generated)
4. The vision-preliminary notice either wasn't needed or didn't consume a slot

### Why "0" appears

`s` is the `sixScores` object (the six sub-score keys). The count is:

```javascript
Object.keys(s).filter(k => s[k] > 0).length
```

If all six sub-scores are zero — which happens when:
- The analysis hasn't fully loaded yet (async race)
- The scoring engine returned no data for this address
- `sixScores` is the empty default object `{}`

...then the count is `0`, and the rendered string reads **"Score is based on 0 location signals."**

This is not a scoring engine failure — the Location IQ composite score can still be non-zero (it uses multiple data sources). But the message makes it look like the whole analysis is empty.

---

## 2 · Impact on Testers

A tester who sees this message will conclude:
- The app has no data for their location
- The score is meaningless
- Something is broken

None of these are necessarily true. The message is a UI copy problem disguised as a data problem.

---

## 3 · Proposed Fix

**Two-part change. No logic changes to scoring — copy and guard only.**

### Part 1 — Never display "0 location signals"

Add a guard so the fallback string only renders when the count is at least 1. If count is 0, use a different (still honest) fallback.

```javascript
// decision-engine.ts ~line 181
const sigCount = Object.keys(s).filter(k => s[k as keyof typeof s] > 0).length;
if (sigCount > 0) {
  reasons.push(`Score draws from ${sigCount} location data points.`);
} else {
  reasons.push(`Analysis complete — explore the breakdown below for detail.`);
}
```

Changes:
- "signals" → "data points" (more accurate; these are scored dimensions, not raw sensor feeds)
- Zero case gets a neutral, non-alarming fallback
- The count still appears when real (honest about the data)

### Part 2 — Prevent the fallback from firing on stale async state

The zero case most often fires during the brief window when `sixScores` hasn't loaded yet. Add an early return in the signals block if scoring data isn't ready:

```javascript
// Before the reasons.length < 2 block
if (!sixScores || Object.keys(sixScores).length === 0) {
  // Scores not loaded yet — skip fallback, let async complete
  return reasons.slice(0, 4);
}
```

This prevents the zero-signal message from appearing as a flash during initial load.

---

## 4 · Files Affected

| File | Change |
|---|---|
| `src/lib/utils/decision-engine.ts` | Guard + copy change in last-resort fallback block (~lines 176–182) |

No component changes. No data changes. No schema changes.

---

## 5 · Estimated Effort

~8 lines changed in one file. Zero risk to scoring logic.

---

## 6 · Copy Before / After

| | Before | After |
|---|---|---|
| Count ≥ 1 | "Score is based on N location signals." | "Score draws from N location data points." |
| Count = 0 | "Score is based on 0 location signals." | "Analysis complete — explore the breakdown below for detail." |
| Scores not loaded | "Score is based on 0 location signals." | *(nothing — returns early)* |

---

## Decision Required

**Approve this proposal to proceed with implementation on branch `brain/br-3-signals-fix`.**
