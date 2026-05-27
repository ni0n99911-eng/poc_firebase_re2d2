<script lang="ts">
  import type { ItemState } from '$lib/data/checklist-data';

  let { items }: { items: ItemState[] } = $props();

  const doneItems    = $derived(items.filter(i => i.done));
  const todoItems    = $derived(items.filter(i => !i.done));
  const spentLow     = $derived(doneItems.reduce((s, i) => s + i.costLow, 0));
  const spentHigh    = $derived(doneItems.reduce((s, i) => s + i.costHigh, 0));
  const remainLow    = $derived(todoItems.reduce((s, i) => s + i.costLow, 0));
  const remainHigh   = $derived(todoItems.reduce((s, i) => s + i.costHigh, 0));
  const totalLow     = $derived(items.reduce((s, i) => s + i.costLow, 0));
  const totalHigh    = $derived(items.reduce((s, i) => s + i.costHigh, 0));
  const totalWeeks   = $derived(items.reduce((s, i) => s + i.weeks, 0));

  // CL7: Convert weeks to months (round up, cap display at ~24 months)
  const totalMonths  = $derived(Math.ceil(totalWeeks / 4.33));
  const remainWeeks  = $derived(todoItems.reduce((s, i) => s + i.weeks, 0));
  const remainMonths = $derived(Math.ceil(remainWeeks / 4.33));

  function fmtK(n: number): string {
    if (n === 0) return '$0';
    if (n < 1000) return `$${n}`;
    return `$${Math.round(n / 1000)}K`;
  }

  function fmtMonths(m: number): string {
    if (m <= 1) return '< 1 mo';
    return `~${m} mo`;
  }
</script>

<!-- CL7: Sticky money tracker bar under progress strip -->
<div class="summary-sticky">
  <div class="summary-row">
    <div class="summary-item">
      <span class="summary-label">Spent</span>
      <span class="summary-val spent">{fmtK(spentLow)}–{fmtK(spentHigh)}</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-item">
      <span class="summary-label">Remaining</span>
      <span class="summary-val remaining">{fmtK(remainLow)}–{fmtK(remainHigh)}</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-item">
      <span class="summary-label">Total</span>
      <span class="summary-val">{fmtK(totalLow)}–{fmtK(totalHigh)}</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-item">
      <span class="summary-label">Timeline</span>
      <span class="summary-val">{fmtMonths(remainMonths)} left</span>
    </div>
  </div>
</div>

<style>
  /* CL7: Sticky money tracker bar */
  .summary-sticky {
    background: #fff;
    border-bottom: 1px solid #E9ECEF;
    padding: 10px 32px;
    position: sticky;
    top: 0;
    z-index: 10;
    flex-shrink: 0;
  }

  .summary-row {
    display: flex;
    align-items: center;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .summary-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .summary-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #6C757D;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    font-weight: 600;
  }

  .summary-val {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #1B3A5C;
  }

  .summary-val.spent     { color: #27AE60; }
  .summary-val.remaining { color: #D68910; }

  .summary-divider {
    width: 1px;
    height: 18px;
    background: #E9ECEF;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .summary-sticky { padding: 8px 14px; }
    .summary-row { gap: 10px; }
    .summary-val { font-size: 12px; }
    .summary-divider { display: none; }
    .summary-row { justify-content: space-between; }
  }
</style>
