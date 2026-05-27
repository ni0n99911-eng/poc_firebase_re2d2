# Welcome-Back + Onboarding Audit Log
**Date:** March 25, 2026

## CRITICAL

| # | Issue | File | Status |
|---|-------|------|--------|
| 1 | ChatInput disabled state too subtle — looks "kinda grayed out" instead of clearly disabled→active | ChatInput.svelte | FIX |
| 2 | Confirm dialog: no role="dialog", no aria-modal, no Escape key handler, no focus trap | welcome-back/+page.svelte | FIX |
| 3 | `lastScore!` non-null assertion — could crash if isComplete logic has edge case | welcome-back/+page.svelte:294 | FIX |
| 4 | `monthlyRevenue[0]`/`[1]` accessed without length check — shows $undefined if empty array | welcome-back/+page.svelte:250 | FIX |
| 5 | Long address text breaks layout — no overflow/word-break on .action-desc | welcome-back/+page.svelte:327 | FIX |
| 6 | Nav avatar button has no aria-label — inaccessible to screen readers | welcome-back/+page.svelte:154 | FIX |

## IMPORTANT

| # | Issue | File | Status |
|---|-------|------|--------|
| 7 | No loading state during sign-out — user might click multiple times | welcome-back/+page.svelte | FIX |
| 8 | "Start New Concept" button has no loading state or disabled-on-click | welcome-back/+page.svelte:377 | FIX |
| 9 | Mobile: nav CTA button text hides but empty green pill remains | welcome-back/+page.svelte CSS | FIX |
| 10 | formatCurrency shows "$NaN" or "$Infinity" for bad data | welcome-back/+page.svelte:44 | FIX |
| 11 | Concept vision text can overflow card with 300+ chars | welcome-back/+page.svelte CSS | FIX |
| 12 | Score verdict text can overflow on mobile | welcome-back/+page.svelte CSS | FIX |
| 13 | "Show more details" button appears even when both arrays are empty | welcome-back/+page.svelte:264 | FIX |
| 14 | Confirm dialog overlay close on tap too easy on mobile — accidental dismiss | welcome-back/+page.svelte:372 | FIX |
| 15 | No :focus-visible styles on interactive elements | welcome-back/+page.svelte CSS | FIX |
| 16 | Progress badge text can truncate on very narrow mobile | welcome-back/+page.svelte CSS | FIX |
| 17 | Nav dropdown: no role="menu", no aria-expanded on toggle | welcome-back/+page.svelte:154-164 | FIX |
| 18 | "Start New Concept" proceed button has no danger styling | welcome-back/+page.svelte CSS | FIX |

## MINOR (won't fix now)

| # | Issue | File | Notes |
|---|-------|------|-------|
| 19 | Hardcoded hover color #d49830 instead of CSS variable | CSS | Cosmetic |
| 20 | Clock SVG in continue-card has no aria-label | +page.svelte:195 | Low impact |
| 21 | hasComparisonLocations loaded but unused | +page.server.ts:77 | Dead code |
| 22 | Back button goes to "/" — user might expect browser-back behavior | +page.svelte:147 | Design choice |
| 23 | userName fallback "there" reads awkwardly | +page.server.ts:85 | Edge case |
