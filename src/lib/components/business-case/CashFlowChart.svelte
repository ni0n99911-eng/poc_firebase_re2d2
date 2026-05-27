<script lang="ts">
  // CashFlowChart only reads month + cashFlow
  interface ChartRow {
    month: number;
    cashFlow: number;
  }

  interface Props {
    rows: ChartRow[];
    height?: number;
  }

  let { rows = [], height = 220 }: Props = $props();

  const WIDTH = 600;
  const BAR_GAP = 3;
  const LABEL_LEFT = 52;
  const CHART_RIGHT = 12;

  // Guard: treat empty/NaN as zeros
  const safeRows = $derived(
    rows.length > 0
      ? rows.map(r => ({ ...r, cashFlow: isFinite(r.cashFlow) ? r.cashFlow : 0 }))
      : Array.from({ length: 36 }, (_, i) => ({ month: i + 1, revenue: 0, costs: 0, cashFlow: 0, cumulative: 0 }))
  );

  const chartWidth = $derived(WIDTH - LABEL_LEFT - CHART_RIGHT);
  const barWidth = $derived(Math.max(4, (chartWidth - BAR_GAP * 35) / 36));

  const values = $derived(safeRows.map(r => r.cashFlow));
  const maxVal = $derived(Math.max(...values.map(Math.abs), 1));

  // Y-axis range with nice padding
  const minVal = $derived(Math.min(...values, 0));
  const maxValPos = $derived(Math.max(...values, 0));
  const range = $derived(Math.max(maxVal * 2.1, 1));  // guard zero range
  const zeroY = $derived((maxVal / range) * (height - 40) + 16);

  // Worst cash month (deepest negative)
  const worstIdx = $derived(values.reduce((wi, v, i) => v < values[wi] ? i : wi, 0));
  // First positive month (breakeven flip)
  const flipIdx = $derived(values.findIndex(v => v > 0));

  function barX(i: number): number {
    return LABEL_LEFT + i * (barWidth + BAR_GAP);
  }

  function barH(v: number): number {
    return Math.abs(v) / range * (height - 40);
  }

  function barY(v: number): number {
    if (v >= 0) return zeroY - barH(v);
    return zeroY;
  }

  function fmtK(n: number): string {
    if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}k`;
    return `$${Math.round(n)}`;
  }

  // Y-axis label values
  const yLabels = $derived([
    { v: maxValPos, y: zeroY - barH(maxValPos) },
    { v: 0, y: zeroY },
    { v: minVal, y: zeroY + barH(Math.abs(minVal)) },
  ]);
</script>

<div class="chart-wrap">
  <svg viewBox="0 0 {WIDTH} {height}" width="100%" preserveAspectRatio="xMidYMid meet">
    <!-- Zero line -->
    <line
      x1={LABEL_LEFT} y1={zeroY}
      x2={WIDTH - CHART_RIGHT} y2={zeroY}
      stroke="#d1d5db" stroke-width="1"
    />

    <!-- Y-axis labels -->
    {#each yLabels as lbl}
      <text
        x={LABEL_LEFT - 6}
        y={lbl.y + 4}
        text-anchor="end"
        font-size="9"
        font-family="DM Sans, sans-serif"
        fill="#9ca3af"
      >{fmtK(lbl.v)}</text>
    {/each}

    <!-- Bars -->
    {#each safeRows as row, i}
      {@const v = row.cashFlow}
      {@const x = barX(i)}
      {@const bh = Math.max(2, barH(Math.abs(v)))}
      {@const by = barY(v)}
      {@const isWorst = i === worstIdx}
      {@const isFlip = i === flipIdx}

      <rect
        x={x}
        y={by}
        width={barWidth}
        height={bh}
        rx="1"
        fill={v >= 0 ? '#1e3a2a' : isWorst ? '#991b1b' : '#dc2626'}
        opacity={isWorst ? 1 : isFlip ? 1 : 0.85}
      />

      <!-- Worst month annotation -->
      {#if isWorst && v < 0}
        <line
          x1={x + barWidth / 2} y1={by + bh + 4}
          x2={x + barWidth / 2} y2={by + bh + 18}
          stroke="#991b1b" stroke-width="1" stroke-dasharray="2,2"
        />
        <text
          x={x + barWidth / 2}
          y={by + bh + 28}
          text-anchor="middle"
          font-size="8"
          font-family="DM Sans, sans-serif"
          fill="#991b1b"
          font-weight="600"
        >Worst</text>
      {/if}

      <!-- Breakeven flip annotation -->
      {#if isFlip && v > 0}
        <line
          x1={x + barWidth / 2} y1={by - 4}
          x2={x + barWidth / 2} y2={by - 18}
          stroke="#1e3a2a" stroke-width="1" stroke-dasharray="2,2"
        />
        <text
          x={x + barWidth / 2}
          y={by - 22}
          text-anchor="middle"
          font-size="8"
          font-family="DM Sans, sans-serif"
          fill="#1e3a2a"
          font-weight="600"
        >Flip</text>
      {/if}
    {/each}

    <!-- Month labels: every 6th -->
    {#each safeRows as row, i}
      {#if (i + 1) % 6 === 0}
        <text
          x={barX(i) + barWidth / 2}
          y={height - 2}
          text-anchor="middle"
          font-size="9"
          font-family="DM Sans, sans-serif"
          fill="#9ca3af"
        >Mo{row.month}</text>
      {/if}
    {/each}
  </svg>
</div>

<style>
  .chart-wrap {
    width: 100%;
    overflow: hidden;
  }
</style>
