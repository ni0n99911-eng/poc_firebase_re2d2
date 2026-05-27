<script lang="ts">
  import { PHASES } from '$lib/data/checklist-data';
  import type { ItemState } from '$lib/data/checklist-data';

  let {
    items,
    locationName,
    conceptLabel,
  }: {
    items: ItemState[];
    locationName: string;
    conceptLabel: string;
  } = $props();

  const doneCount  = $derived(items.filter(i => i.done).length);
  const totalCount = $derived(items.length);
  const pct        = $derived(totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0);
  const costLow    = $derived(items.reduce((s, i) => s + i.costLow,  0));
  const costHigh   = $derived(items.reduce((s, i) => s + i.costHigh, 0));

  function dotState(phaseId: string): 'done' | 'active' | '' {
    const pi = items.filter(i => i.phase === phaseId);
    if (pi.length === 0) return '';
    if (pi.every(i => i.done)) return 'done';
    if (pi.some(i => i.done))  return 'active';
    return '';
  }

  // PA-04: Quick wins count (free + <1 week, not done)
  const quickWinsCount = $derived(items.filter(i => !i.done && i.costHigh === 0 && i.weeks < 1).length);

  // A1: Hero moment (5-state progress message)
  const heroMessage = $derived.by(() => {
    if (pct === 0) return 'You\'re on your way to opening day.';
    if (pct < 25) return 'Great start! Keep the momentum.';
    if (pct < 50) return 'You\'re halfway there!';
    if (pct < 75) return 'Almost there. Great work.';
    if (pct < 100) return 'One last push. You\'ve got this.';
    return 'Launch day is here! 🎉';
  });
</script>

<div class="progress-strip">
  <div class="progress-header">
    <div class="progress-left">
      <!-- CL1: Concept tag above title -->
      {#if conceptLabel || locationName}
        <div class="progress-context-tag">
          {conceptLabel}{locationName ? ` at ${locationName.split(',')[0]}` : ''}
        </div>
      {/if}
      <div class="progress-title">Your path to opening day</div>
      <div class="progress-subtitle">
        {heroMessage}
        {#if doneCount === 0 && quickWinsCount > 0}
          Start with the {quickWinsCount} free ones.
        {/if}
      </div>
    </div>
    <div class="progress-stats">
      {#if doneCount > 0}
      <div class="stat-muted">✓ {doneCount} done</div>
      {/if}
    </div>
  </div>

  <div class="progress-bar">
    <div class="progress-fill" class:milestone-25={pct >= 25 && pct < 50} class:milestone-50={pct >= 50 && pct < 75} class:milestone-75={pct >= 75 && pct < 100} class:milestone-100={pct === 100} style="width: {pct}%">
      <span class="pct-label">{pct}%</span>
    </div>
  </div>

  <div class="phase-dots" aria-hidden="true">
    {#each PHASES as p}
      {@const state = dotState(p.id)}
      <div class="phase-dot">
        <div class="dot" class:active={state === 'active'} class:done={state === 'done'}></div>
        <span>{p.name.split(' ')[0]}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .progress-strip {
    background: #fff;
    padding: 20px 32px;
    border-bottom: 1px solid #E9ECEF;
    flex-shrink: 0;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    gap: 16px;
    flex-wrap: wrap;
  }

  .progress-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #1B3A5C;
    line-height: 1.2;
  }

  .progress-subtitle {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    margin-top: 2px;
  }

  .progress-context-tag {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #6C757D;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .progress-context {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #6C757D;
    margin-top: 2px;
  }

  .stat-muted {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #6C757D;
    font-weight: 500;
    white-space: nowrap;
  }

  .progress-stats {
    display: flex;
    gap: 24px;
    flex-shrink: 0;
  }

  .stat {
    text-align: center;
  }

  .stat-value {
    font-family: 'DM Sans', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #1B3A5C;
    line-height: 1;
  }

  .stat-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6C757D;
    margin-top: 2px;
  }

  .progress-bar {
    height: 14px;
    background: #E9ECEF;
    border-radius: 7px;
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #27AE60, #2E75B6);
    border-radius: 7px;
    transition: width 0.5s ease;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 36px;
    position: relative;
  }

  .progress-fill.milestone-25 { background: linear-gradient(90deg, #27AE60, #2ECC71); }
  .progress-fill.milestone-50 { background: linear-gradient(90deg, #27AE60, #1ABC9C); }
  .progress-fill.milestone-75 { background: linear-gradient(90deg, #27AE60, #2E75B6); }
  .progress-fill.milestone-100 { background: linear-gradient(90deg, #27AE60, #1B3A5C); }

  .pct-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    padding-right: 6px;
    white-space: nowrap;
  }

  .phase-dots {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    padding: 0 2px;
  }

  .phase-dot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #DEE2E6;
  }

  .dot.active { background: #2E75B6; }
  .dot.done   { background: #27AE60; }

  .phase-dot span {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #6C757D;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .progress-strip { padding: 16px; }
    .progress-title { font-size: 18px; }
    .stat-value { font-size: 18px; }
    .progress-stats { gap: 16px; }
  }
</style>
