<!--
  ScoreMetaLine — UX-6 wireframe
  Renders: "Scored [relative date] · Re-score ↻"
  - scoredAt: epoch ms (number | string) or null
  - onRescore: callback fired when Re-score is clicked
  - surface: 'card' | 'ring' | 'chip' — affects sizing
  - driftDot: if true, shows amber ● drift indicator
  States: default → spinner → success (date flips to "today") → drift dot (amber ●, 24h)
-->
<script lang="ts">
  import { onDestroy } from 'svelte';

  type Surface = 'card' | 'ring' | 'chip';
  type State = 'default' | 'loading' | 'success' | 'drift';

  interface Props {
    scoredAt?: number | string | null;
    onRescore?: () => Promise<void> | void;
    surface?: Surface;
    driftDot?: boolean;
  }

  let {
    scoredAt = null,
    onRescore = undefined,
    surface = 'card',
    driftDot = false,
  }: Props = $props();

  let state = $state<State>('default');
  let tooltipVisible = $state(false);
  let successTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Locked disclaimer copy (BR-5 §5.5) ───────────────────────────────────
  const DISCLAIMER = `This score is a snapshot from your last scoring run. It does not update automatically. Refining your concept details or periodic updates to neighborhood data can produce variations on re-scoring. Such variations are typically non-material and rarely change the verdict band. Use Re-score to refresh.`;

  // ── Relative date helper ──────────────────────────────────────────────────
  function relativeDate(ts: number | string | null | undefined): string {
    if (!ts) return '—';
    const t = typeof ts === 'number' ? ts : (isFinite(Number(ts)) ? Number(ts) : new Date(ts as string).getTime());
    if (!t || isNaN(t)) return '—';
    const diff = Date.now() - t;
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return mins <= 1 ? 'today' : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return 'today';
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return 'last week';
    // Absolute after 14 days
    const d = new Date(t);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  let displayDate = $derived(state === 'success' ? 'today' : relativeDate(scoredAt));

  // UX-22 / BR-05: Contextual Re-score tooltip — mirrors the BR-05 ageLabel format
  // ('Scored 3 hours ago' / '2 days ago') so the hover hint tells the user what
  // they'll gain by clicking. Derived client-side from scoredAt without needing a fetch.
  let rescoreHoverTitle = $derived.by(() => {
    if (!scoredAt) return 'Re-run scoring against the latest data.';
    const t = typeof scoredAt === 'number' ? scoredAt : (isFinite(Number(scoredAt)) ? Number(scoredAt) : new Date(scoredAt as string).getTime());
    if (!t || isNaN(t)) return 'Re-run scoring against the latest data.';
    const ageHours = Math.max(0, (Date.now() - t) / 3_600_000);
    let ageStr: string;
    if (ageHours < 1) ageStr = `${Math.max(1, Math.round(ageHours * 60))} minutes ago`;
    else if (ageHours < 24) ageStr = `${Math.round(ageHours)} hours ago`;
    else ageStr = `${Math.round(ageHours / 24)} days ago`;
    return `Last scored ${ageStr}. Click to refresh if you want the latest Foursquare, census, and permit data.`;
  });

  // F-04: Stale badge — score is considered stale after 24 hours.
  // Shows an amber "Score may be outdated" nudge so users know
  // market data (permits, inspections, competitors) may have shifted.
  const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours
  let isStale = $derived((() => {
    if (!scoredAt || state === 'success') return false;
    const t = typeof scoredAt === 'number' ? scoredAt : (isFinite(Number(scoredAt)) ? Number(scoredAt) : new Date(scoredAt as string).getTime());
    if (!t || isNaN(t)) return false;
    return (Date.now() - t) > STALE_MS;
  })());

  // ── Re-score handler ──────────────────────────────────────────────────────
  async function handleRescore() {
    if (state === 'loading') return;
    state = 'loading';
    if (successTimer) clearTimeout(successTimer);
    try {
      if (onRescore) await onRescore();
      state = 'success';
      successTimer = setTimeout(() => { state = driftDot ? 'drift' : 'default'; }, 2200);
    } catch {
      state = 'default';
    }
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────
  function showTooltip() { tooltipVisible = true; }
  function hideTooltip() { tooltipVisible = false; }
  function toggleTooltip() { tooltipVisible = !tooltipVisible; }

  onDestroy(() => { if (successTimer) clearTimeout(successTimer); });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="score-meta-line score-meta-line--{surface} score-meta-line--{state}"
  class:has-drift={driftDot || state === 'drift'}
  onmouseenter={showTooltip}
  onmouseleave={hideTooltip}
  onclick={toggleTooltip}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleTooltip(); }}
  role="button"
  tabindex="0"
  aria-label="Score snapshot info"
>
  {#if state === 'drift'}
    <span class="ml-drift-dot" aria-hidden="true">●</span>
  {/if}

  <span class="ml-date">
    {#if state === 'loading'}
      <span class="ml-spinner" aria-label="Scoring in progress"></span>
      Scoring…
    {:else if state === 'success'}
      ✓ Scored today
    {:else}
      Scored {displayDate}
    {/if}
  </span>

  {#if state !== 'loading'}
    <span class="ml-sep" aria-hidden="true">·</span>
    <button
      class="ml-rescore"
      onclick={(e) => { e.stopPropagation(); handleRescore(); }}
      disabled={state === 'loading'}
      aria-label="Re-score this location"
      title={rescoreHoverTitle}
      type="button"
    >Re-score ↻</button>
    {#if isStale}
      <span class="ml-stale-badge" title="Score is over 24 hours old — neighborhood data may have changed">Score may be outdated</span>
    {/if}
  {/if}

  {#if tooltipVisible}
    <!-- Locked disclaimer tooltip (UX-6 §6.2) -->
    <div class="ml-tooltip" role="tooltip" onclick={(e) => e.stopPropagation()}>
      {DISCLAIMER}
    </div>
  {/if}
</div>

<style>
  /* ── Base ──────────────────────────────────────────────────────────────── */
  .score-meta-line {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #888;
    line-height: 1.4;
    cursor: pointer;
    position: relative;
    user-select: none;
    -webkit-user-select: none;
    outline: none;
    border-radius: 4px;
  }
  .score-meta-line:focus-visible { box-shadow: 0 0 0 2px rgba(5,150,105,0.3); }

  /* ── Surface modifiers ─────────────────────────────────────────────────── */
  .score-meta-line--ring { font-size: 10px; justify-content: center; }
  .score-meta-line--chip { font-size: 10px; }
  .score-meta-line--card { font-size: 11px; }

  /* ── State modifiers ───────────────────────────────────────────────────── */
  .score-meta-line--success .ml-date { color: #059669; }
  .score-meta-line--drift .ml-drift-dot { color: #B45309; font-size: 8px; margin-right: 2px; }
  .score-meta-line--loading { opacity: 0.7; pointer-events: none; }
  /* dim the score ring when loading — parent must add .score-ring-dim class via prop */

  /* ── Elements ──────────────────────────────────────────────────────────── */
  .ml-date { color: inherit; }
  .ml-sep  { color: #ccc; }

  .ml-rescore {
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
    color: #059669;
    cursor: pointer;
    font-family: inherit;
    line-height: inherit;
    text-decoration: none;
  }
  .ml-rescore:hover { text-decoration: underline; }
  .ml-rescore:disabled { color: #aaa; cursor: not-allowed; }

  /* ── Spinner ───────────────────────────────────────────────────────────── */
  .ml-spinner {
    display: inline-block;
    width: 9px;
    height: 9px;
    border: 1.5px solid #ccc;
    border-top-color: #059669;
    border-radius: 50%;
    animation: ml-spin 0.7s linear infinite;
    margin-right: 3px;
    vertical-align: middle;
  }
  @keyframes ml-spin { to { transform: rotate(360deg); } }

  /* ── F-04: Stale badge (24h TTL) ────────────────────────────────────────── */
  .ml-stale-badge {
    display: inline-block;
    font-size: 9px; font-weight: 600; letter-spacing: 0.3px;
    color: #92400e; background: rgba(217,119,6,0.10);
    border: 1px solid rgba(217,119,6,0.25);
    border-radius: 4px; padding: 2px 6px;
    margin-left: 4px; vertical-align: middle;
    cursor: help;
    white-space: nowrap;
  }

  /* ── Tooltip ───────────────────────────────────────────────────────────── */
  .ml-tooltip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: #1a2e1f;
    color: #e5ede7;
    font-size: 11px;
    line-height: 1.5;
    padding: 10px 13px;
    border-radius: 8px;
    width: 280px;
    max-width: 90vw;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    z-index: 200;
    pointer-events: auto;
    white-space: normal;
    text-align: left;
  }
  /* Arrow */
  .ml-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: #1a2e1f;
  }

  /* ── Mobile ────────────────────────────────────────────────────────────── */
  @media (max-width: 480px) {
    .score-meta-line { font-size: 10px; }
    .ml-tooltip { width: 240px; bottom: calc(100% + 4px); }
  }
</style>
