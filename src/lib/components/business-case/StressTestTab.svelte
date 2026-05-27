<script lang="ts">
  import type { BusinessCaseStore } from '$lib/stores/business-case-store.svelte';
  import type { FinancialModel } from '$lib/stores/business-case-store.svelte';

  interface Props {
    store: BusinessCaseStore;
    model: FinancialModel;
    isLoading?: boolean;
  }

  let { store, model, isLoading = false }: Props = $props();

  // ─── 1. Monthly In vs Out ────────────────────────────────────────────────────
  const monthlyIn  = $derived(store.monthlyRevenue);
  const monthlyOut = $derived(store.monthlyTotal);
  const monthlyDelta = $derived(monthlyIn - monthlyOut);

  // Bar widths — largest bar = 100%, other scales proportionally
  const maxBar = $derived(Math.max(monthlyIn, monthlyOut, 1));
  const inPct  = $derived(Math.round((monthlyIn  / maxBar) * 100));
  const outPct = $derived(Math.round((monthlyOut / maxBar) * 100));

  // ─── 2. Three Futures (monthly profit at 3 revenue scenarios) ────────────────
  // Conservative = 80% of current revenue, Optimistic = 125%
  const conMonthly  = $derived(monthlyIn * 0.80 - monthlyOut);
  const baseMonthly = $derived(monthlyDelta);
  const optMonthly  = $derived(monthlyIn * 1.25 - monthlyOut);

  // ─── 3. Buffer months ────────────────────────────────────────────────────────
  // How many consecutive worst-case months can you fund from your cash buffer?
  const bufferMonths = $derived.by(() => {
    const cashBuffer = model.cashNeeded - model.startupCosts;
    const monthlyLoss = Math.abs(conMonthly);
    if (conMonthly >= 0 || cashBuffer <= 0 || monthlyLoss <= 0) return null;
    return Math.floor(cashBuffer / monthlyLoss);
  });

  // ─── 4. Break-even / payback month ───────────────────────────────────────────
  const breakEvenMonth = $derived(model.breakEvenMonth ?? store.breakEvenMonth ?? null);
  const bemColor = $derived(
    !breakEvenMonth      ? '#6b7280'  :
    breakEvenMonth <= 24 ? '#166534'  :
    breakEvenMonth <= 48 ? '#d97706'  : '#dc2626'
  );

  // ─── 5. Kill factor — highest priority risk ───────────────────────────────────
  const rentRatio = $derived(
    monthlyIn > 0 ? store.monthlyRent / monthlyIn : 0
  );
  const killFactor = $derived.by((): string | null => {
    if (rentRatio > 0.12 && monthlyIn > 0 && store.monthlyRent > 0) {
      return `Rent is ${Math.round(rentRatio * 100)}% of revenue — above the 12% safe limit. Negotiate rent before signing.`;
    }
    if (breakEvenMonth !== null && breakEvenMonth >= 48) {
      return `Takes ${breakEvenMonth} months to break even — that's ${Math.round(breakEvenMonth / 12)} years of losses to fund.`;
    }
    if (bufferMonths !== null && bufferMonths <= 3) {
      return `Worst case burns through your buffer in just ${bufferMonths} months. You need more runway.`;
    }
    return null;
  });

  // ─── 6. Max Loss Breakdown (how much you could lose if this fails) ──────────
  const maxLossBreak = $derived(model.maxLossBreakdown);
  const maxLossTotal = $derived(maxLossBreak?.total ?? 0);

  // ─── 7. Sensitivity — months of runway at −20% ────────────────────────────
  // B3-1.2: null means runway is covered (positive cashflow under stress).
  // Distinguishes "never runs out" from "runs out at month 60" — previously
  // both returned 60, so UX couldn't tell them apart.
  const sensitivityMonths = $derived<number | null>(model.sensitivityMonths ?? null);
  const sensColor = $derived(
    sensitivityMonths === null || sensitivityMonths >= 12 ? '#166534' :
    sensitivityMonths >= 6  ? '#d97706' : '#dc2626'
  );

  // ─── 8. Year-3 take-home + Year-5 valuation ──────────────────────────────
  const takeHomeY3  = $derived(model.takeHomeY3 ?? 0);
  const valuationY5 = $derived(model.valuationY5 ?? 0);

  // ─── Show detail table toggle ─────────────────────────────────────────────────
  let showDetailTable = $state(false);

  // ─── Zero state ──────────────────────────────────────────────────────────────
  const hasData = $derived(monthlyIn > 0 || monthlyOut > 0);

  // ─── Formatters ──────────────────────────────────────────────────────────────
  function fmtMoney(n: number, short = false): string {
    if (isNaN(n)) return '—';
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    if (short && abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(1) + 'M';
    if (short && abs >= 1_000)     return sign + '$' + Math.round(abs / 1_000) + 'K';
    return sign + '$' + Math.round(abs).toLocaleString();
  }

  function futureColor(v: number): string {
    if (v > 0) return '#166534';
    if (v > -500) return '#d97706';
    return '#dc2626';
  }

  function futureBg(v: number): string {
    if (v > 0)    return '#f0fdf4';
    if (v > -500) return '#fffbeb';
    return '#fef2f2';
  }
</script>

<div class="stress-tab">
  {#if isLoading}
    <div class="st-loading">Calculating with location signals…</div>
  {/if}

  {#if !hasData}
    <div class="st-zero">
      Enter your revenue and cost assumptions on the left to see how the business holds up under different conditions.
    </div>
  {:else}

    <!-- ── 1. Monthly Money In vs. Money Out ─────────────────────────────────── -->
    <div class="st-section">
      <div class="sts-title">Monthly Money In vs. Money Out</div>
      <div class="sts-subtitle">If the green bar is longer, you're covering your costs.</div>

      <div class="st-bars">
        <div class="stb-row">
          <div class="stb-label stb-label--in">Money In</div>
          <div class="stb-track">
            <div class="stb-fill stb-fill--in" style="width:{inPct}%"></div>
          </div>
          <div class="stb-amount">{fmtMoney(monthlyIn, true)}</div>
        </div>
        <div class="stb-row">
          <div class="stb-label stb-label--out">Money Out</div>
          <div class="stb-track">
            <div class="stb-fill stb-fill--out" style="width:{outPct}%"></div>
          </div>
          <div class="stb-amount">{fmtMoney(monthlyOut, true)}</div>
        </div>
      </div>

      <div class="st-delta" class:st-delta--pos={monthlyDelta >= 0} class:st-delta--neg={monthlyDelta < 0}>
        {#if monthlyDelta >= 0}
          ✓ You're covering costs with <strong>{fmtMoney(monthlyDelta, true)}/month</strong> to spare.
        {:else}
          You're <strong>{fmtMoney(Math.abs(monthlyDelta), true)}/month short</strong> of covering costs at these numbers — adjust the sliders to close the gap.
        {/if}
      </div>
    </div>

    <!-- ── 2. Your 3 Futures ──────────────────────────────────────────────────── -->
    <div class="st-section">
      <div class="sts-title">Your 3 Futures</div>
      <div class="sts-subtitle">Monthly profit (or loss) under three scenarios.</div>

      <div class="st-futures">
        <div class="stf-col" style="background:{futureBg(conMonthly)}">
          <div class="stf-scenario">If it's slow…</div>
          <div class="stf-sub">−20% fewer customers</div>
          <div class="stf-value" style="color:{futureColor(conMonthly)}">
            {conMonthly >= 0 ? '+' : ''}{fmtMoney(conMonthly, true)}/mo
          </div>
        </div>
        <div class="stf-col stf-col--base" style="background:{futureBg(baseMonthly)}">
          <div class="stf-scenario">If it's normal…</div>
          <div class="stf-sub">Your current plan</div>
          <div class="stf-value" style="color:{futureColor(baseMonthly)}">
            {baseMonthly >= 0 ? '+' : ''}{fmtMoney(baseMonthly, true)}/mo
          </div>
        </div>
        <div class="stf-col" style="background:{futureBg(optMonthly)}">
          <div class="stf-scenario">If it takes off…</div>
          <div class="stf-sub">+25% more customers</div>
          <div class="stf-value" style="color:{futureColor(optMonthly)}">
            {optMonthly >= 0 ? '+' : ''}{fmtMoney(optMonthly, true)}/mo
          </div>
        </div>
      </div>
    </div>

    <!-- ── 3. Buffer ───────────────────────────────────────────────────────────── -->
    <div class="st-section">
      <div class="sts-title">How Many Bad Months Can You Handle?</div>
      <div class="sts-subtitle">Consecutive worst-case months your cash buffer can cover.</div>

      {#if bufferMonths === null}
        <div class="st-buffer-ok">
          <span class="stb-ok-icon">✓</span>
          Even in the slow scenario you stay above zero — your buffer covers any slow month.
        </div>
      {:else}
        <div class="st-buffer-count" class:st-buffer-tight={bufferMonths <= 3}>
          <span class="stbc-num" class:stbc-num--tight={bufferMonths <= 3}>{bufferMonths}</span>
          <span class="stbc-label">months of buffer</span>
        </div>
        {#if bufferMonths <= 3}
          <div class="stbc-warn">Thin — consider raising more cash or cutting fixed costs before launch.</div>
        {:else if bufferMonths <= 6}
          <div class="stbc-note">Watchable — aim for at least 6 months of buffer before you open.</div>
        {:else}
          <div class="stbc-note-ok">Good cushion — you can absorb a slow start.</div>
        {/if}
      {/if}
    </div>

    <!-- ── 4. Payback month ───────────────────────────────────────────────────── -->
    {#if breakEvenMonth !== null}
      <div class="st-section">
        <div class="sts-title">When Does the Business Pay You Back?</div>
        <div class="sts-subtitle">The month when total money out equals total money in — including all startup costs.</div>

        <div class="st-bem">
          <span class="st-bem-num" style="color:{bemColor}">Month {breakEvenMonth}</span>
          {#if breakEvenMonth <= 24}
            <span class="st-bem-tag st-bem-tag--green">On track</span>
          {:else if breakEvenMonth <= 48}
            <span class="st-bem-tag st-bem-tag--amber">Plan carefully</span>
          {:else}
            <span class="st-bem-tag st-bem-tag--red">High risk</span>
          {/if}
        </div>
      </div>
    {/if}

    <!-- ── 5. Kill factor ─────────────────────────────────────────────────────── -->
    {#if killFactor}
      <div class="st-kill">
        <div class="stk-header">
          <span class="stk-icon">🚨</span>
          <span class="stk-title">The One Thing That Could Kill This</span>
        </div>
        <div class="stk-body">{killFactor}</div>
      </div>
    {/if}

    <!-- ── 6. Maximum Loss Exposure ──────────────────────────────────────────── -->
    {#if maxLossTotal > 0}
      <div class="st-section">
        <div class="sts-title">If This Fails, What Could You Lose?</div>
        <div class="sts-subtitle">Total personal exposure if you close after 24 months.</div>

        <div class="st-loss-total">{fmtMoney(maxLossTotal, true)}</div>

        {#if maxLossBreak}
          <div class="st-loss-grid">
            {#if maxLossBreak.equity > 0}
              <div class="st-loss-row">
                <span>Your cash invested</span>
                <span>{fmtMoney(maxLossBreak.equity, true)}</span>
              </div>
            {/if}
            {#if maxLossBreak.buildout > 0}
              <div class="st-loss-row">
                <span>Buildout (can't recover)</span>
                <span>{fmtMoney(maxLossBreak.buildout, true)}</span>
              </div>
            {/if}
            {#if maxLossBreak.loans > 0}
              <div class="st-loss-row">
                <span>Outstanding loan balance</span>
                <span>{fmtMoney(maxLossBreak.loans, true)}</span>
              </div>
            {/if}
            {#if maxLossBreak.pg > 0}
              <div class="st-loss-row">
                <span>Lease personal guarantee</span>
                <span>{fmtMoney(maxLossBreak.pg, true)}</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- ── 7. Runway at −20% ─────────────────────────────────────────────────── -->
    <!-- B3-1.2: null = runway covered (infinite) — show positive message, no Dangerous badge. -->
    {#if sensitivityMonths === null}
      <div class="st-section">
        <div class="sts-title">How Long Can You Survive a Slow Start?</div>
        <div class="sts-subtitle">Months before cash runs out if revenue stays 20% below plan.</div>
        <div class="st-sens-row">
          <span class="st-sens-label" style="color:#166534; font-weight:600">Runway covered — positive cashflow even under 20% revenue stress.</span>
          <span class="st-sens-tag" style="background:#dcfce7; color:#166534">Comfortable</span>
        </div>
      </div>
    {:else if sensitivityMonths > 0}
      <div class="st-section">
        <div class="sts-title">How Long Can You Survive a Slow Start?</div>
        <div class="sts-subtitle">Months before cash runs out if revenue stays 20% below plan.</div>

        <div class="st-sens-row">
          <span class="st-sens-num" style="color:{sensColor}">{sensitivityMonths}</span>
          <span class="st-sens-label">months of runway</span>
          {#if sensitivityMonths >= 12}
            <span class="st-sens-tag" style="background:#dcfce7; color:#166534">Comfortable</span>
          {:else if sensitivityMonths >= 6}
            <span class="st-sens-tag" style="background:#fef9c3; color:#854d0e">Tight</span>
          {:else}
            <span class="st-sens-tag" style="background:#fee2e2; color:#991b1b">Dangerous</span>
          {/if}
        </div>
      </div>
    {/if}

    <!-- ── 8. The Long View — Year 3 + Year 5 ───────────────────────────────── -->
    {#if takeHomeY3 !== 0 || valuationY5 > 0}
      <div class="st-section">
        <div class="sts-title">The Long View</div>
        <div class="sts-subtitle">What this business could look like if you stick with it.</div>

        <div class="st-longview">
          {#if takeHomeY3 !== 0}
            <div class="st-lv-col">
              <div class="st-lv-label">Year 3 Take-Home</div>
              <div class="st-lv-value" style="color:{takeHomeY3 >= 0 ? '#166534' : '#dc2626'}">{fmtMoney(takeHomeY3, true)}</div>
              <div class="st-lv-note">Annual owner's draw after 3 full years of operation.</div>
            </div>
          {/if}
          {#if valuationY5 > 0}
            <div class="st-lv-col">
              <div class="st-lv-label">Year 5 Business Value</div>
              <div class="st-lv-value" style="color:#1e3a2a">{fmtMoney(valuationY5, true)}</div>
              <div class="st-lv-note">Estimated sale price at exit (3× EBITDA).</div>
            </div>
          {/if}
        </div>
      </div>
    {/if}

  {/if}
</div>

<style>
  .stress-tab {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .st-loading {
    background: #fef9c3;
    border: 1px solid #fde68a;
    border-radius: 8px;
    padding: 9px 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #854d0e;
    font-weight: 500;
  }

  .st-zero {
    background: #f9fafb;
    border: 1px dashed #d1d5db;
    border-radius: 10px;
    padding: 28px 24px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #9ca3af;
    text-align: center;
    line-height: 1.6;
  }

  /* Section card */
  .st-section {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sts-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
  }

  .sts-subtitle {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #6b7280;
    margin-top: -4px;
  }

  /* ─── Monthly bars ─────────────────────────────────────────────────────────── */
  .st-bars {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .stb-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stb-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    min-width: 72px;
  }

  .stb-label--in  { color: #166534; }
  .stb-label--out { color: #991b1b; }

  .stb-track {
    flex: 1;
    height: 14px;
    background: #f3f4f6;
    border-radius: 7px;
    overflow: hidden;
  }

  .stb-fill {
    height: 100%;
    border-radius: 7px;
    transition: width 0.4s ease;
  }

  .stb-fill--in  { background: #16a34a; }
  .stb-fill--out { background: #dc2626; }

  .stb-amount {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #111827;
    min-width: 56px;
    text-align: right;
  }

  .st-delta {
    border-radius: 8px;
    padding: 10px 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    line-height: 1.5;
  }

  .st-delta--pos { background: #f0fdf4; color: #166534; }
  .st-delta--neg { background: #fef2f2; color: #991b1b; }

  /* ─── 3 Futures ─────────────────────────────────────────────────────────── */
  .st-futures {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin-top: 4px;
  }

  @media (max-width: 560px) {
    .st-futures { grid-template-columns: 1fr; }
  }

  .stf-col {
    border-radius: 10px;
    padding: 14px 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stf-col--base {
    box-shadow: 0 0 0 2px #d1d5db;
  }

  .stf-scenario {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #111827;
  }

  .stf-sub {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #6b7280;
    margin-bottom: 4px;
  }

  .stf-value {
    font-family: 'DM Sans', sans-serif;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  /* ─── Buffer ─────────────────────────────────────────────────────────────── */
  .st-buffer-ok {
    background: #f0fdf4;
    border-radius: 8px;
    padding: 12px 16px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #166534;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stb-ok-icon { font-size: 16px; }

  .st-buffer-count {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .stbc-num {
    font-family: 'DM Sans', sans-serif;
    font-size: 48px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #1e3a2a;
  }

  .stbc-num--tight { color: #dc2626; }

  .stbc-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: #6b7280;
  }

  .stbc-warn {
    background: #fef2f2;
    border-radius: 6px;
    padding: 8px 12px;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #991b1b;
  }

  .stbc-note {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #d97706;
  }

  .stbc-note-ok {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #166534;
  }

  /* ─── Break-even ─────────────────────────────────────────────────────────── */
  .st-bem {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .st-bem-num {
    font-family: 'DM Sans', sans-serif;
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .st-bem-tag {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 700;
    border-radius: 6px;
    padding: 3px 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .st-bem-tag--green { background: #dcfce7; color: #166534; }
  .st-bem-tag--amber { background: #fef9c3; color: #854d0e; }
  .st-bem-tag--red   { background: #fee2e2; color: #991b1b; }

  /* ─── Kill factor ────────────────────────────────────────────────────────── */
  .st-kill {
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 12px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .stk-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stk-icon { font-size: 16px; }

  .stk-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #991b1b;
  }

  .stk-body {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #7f1d1d;
    line-height: 1.5;
  }

  /* ─── Max Loss ─────────────────────────────────────────────────────────── */
  .st-loss-total {
    font-family: 'DM Sans', sans-serif;
    font-size: 36px;
    font-weight: 800;
    color: #dc2626;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .st-loss-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
  }

  .st-loss-row {
    display: flex;
    justify-content: space-between;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #4b5563;
    padding: 4px 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .st-loss-row span:last-child {
    font-weight: 600;
    color: #111827;
  }

  /* ─── Sensitivity ──────────────────────────────────────────────────────── */
  .st-sens-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }

  .st-sens-num {
    font-family: 'DM Sans', sans-serif;
    font-size: 48px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .st-sens-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: #6b7280;
  }

  .st-sens-tag {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 700;
    border-radius: 6px;
    padding: 3px 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* ─── Long View (Y3 + Y5) ─────────────────────────────────────────────── */
  .st-longview {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  @media (max-width: 560px) {
    .st-longview { grid-template-columns: 1fr; }
  }

  .st-lv-col {
    background: #f9fafb;
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .st-lv-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
  }

  .st-lv-value {
    font-family: 'DM Sans', sans-serif;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .st-lv-note {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #9ca3af;
    line-height: 1.4;
  }
</style>
