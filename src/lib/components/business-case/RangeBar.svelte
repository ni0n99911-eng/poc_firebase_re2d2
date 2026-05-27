<script lang="ts">
  interface Props {
    value: number;
    min?: number;
    max?: number;
    color?: string;
    thresholdPct?: number;   // 0–100, optional vertical marker
    showLabels?: boolean;
    minLabel?: string;
    maxLabel?: string;
    thresholdLabel?: string;
  }

  let {
    value,
    min = 0,
    max = 100,
    color = '#1e3a2a',
    thresholdPct,
    showLabels = false,
    minLabel,
    maxLabel,
    thresholdLabel,
  }: Props = $props();

  const fillPct = $derived(Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)));
</script>

<div class="range-bar-wrap">
  <div class="rb-track">
    <div class="rb-fill" style="width: {fillPct}%; background: {color}"></div>
    <div class="rb-dot" style="left: {fillPct}%; background: {color}"></div>
    {#if thresholdPct !== undefined}
      <div class="rb-threshold" style="left: {thresholdPct}%">
        {#if thresholdLabel}
          <span class="rb-threshold-label">{thresholdLabel}</span>
        {/if}
      </div>
    {/if}
  </div>
  {#if showLabels}
    <div class="rb-labels">
      <span>{minLabel ?? min}</span>
      <span>{maxLabel ?? max}</span>
    </div>
  {/if}
</div>

<style>
  .range-bar-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .rb-track {
    position: relative;
    height: 4px;
    background: #e5e7eb;
    border-radius: 2px;
    margin: 8px 0 4px;
  }

  .rb-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s ease;
  }

  .rb-dot {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    transition: left 0.4s ease;
  }

  .rb-threshold {
    position: absolute;
    top: -6px;
    bottom: -6px;
    width: 2px;
    background: #f59e0b;
    border-radius: 1px;
    transform: translateX(-50%);
  }

  .rb-threshold-label {
    position: absolute;
    top: -18px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 9px;
    font-family: 'DM Sans', sans-serif;
    color: #f59e0b;
    white-space: nowrap;
    font-weight: 600;
  }

  .rb-labels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    font-family: 'DM Sans', sans-serif;
    color: #9ca3af;
  }
</style>
