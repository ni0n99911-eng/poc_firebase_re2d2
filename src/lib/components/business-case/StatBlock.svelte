<script lang="ts">
  import RangeBar from './RangeBar.svelte';

  type Variant = 'normal' | 'trough' | 'closer';

  interface Props {
    label: string;
    value: string | number;
    prefix?: string;
    suffix?: string;
    rangeMin?: number;
    rangeMax?: number;
    rangeValue?: number;   // defaults to value if numeric
    rangeColor?: string;
    thresholdPct?: number;
    soWhat?: string;
    variant?: Variant;
    sublabel?: string;
  }

  let {
    label,
    value,
    prefix = '',
    suffix = '',
    rangeMin,
    rangeMax,
    rangeValue,
    rangeColor,
    thresholdPct,
    soWhat,
    variant = 'normal',
    sublabel,
  }: Props = $props();

  const showRange = $derived(rangeMin !== undefined && rangeMax !== undefined);

  const bgMap: Record<Variant, string> = {
    normal: '#fff',
    trough: '#fef2f2',
    closer: '#eff6ff',
  };

  const borderMap: Record<Variant, string> = {
    normal: '#e5e7eb',
    trough: '#fca5a5',
    closer: '#93c5fd',
  };

  const rangeColorMap: Record<Variant, string> = {
    normal: '#1e3a2a',
    trough: '#dc2626',
    closer: '#2563eb',
  };

  const bg = $derived(bgMap[variant]);
  const border = $derived(borderMap[variant]);
  const defaultRangeColor = $derived(rangeColor ?? rangeColorMap[variant]);

  const numericValue = $derived(typeof value === 'number' ? value : parseFloat(String(value)) || 0);
  const effectiveRangeValue = $derived(rangeValue ?? numericValue);
</script>

<div class="stat-block" style="background:{bg}; border-color:{border}">
  <div class="sb-top">
    <div class="sb-label-col">
      <div class="sb-label">{label}</div>
      {#if sublabel}
        <div class="sb-sublabel">{sublabel}</div>
      {/if}
    </div>
    <div class="sb-value">{prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</div>
  </div>

  {#if showRange}
    <RangeBar
      value={effectiveRangeValue}
      min={rangeMin}
      max={rangeMax}
      color={defaultRangeColor}
      thresholdPct={thresholdPct}
    />
  {/if}

  {#if soWhat}
    <div class="sb-so-what">{soWhat}</div>
  {/if}
</div>

<style>
  .stat-block {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 14px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sb-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .sb-label-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sb-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  }

  .sb-sublabel {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #9ca3af;
  }

  .sb-value {
    font-family: 'DM Sans', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #111827;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .sb-so-what {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #6b7280;
    line-height: 1.45;
  }
</style>
