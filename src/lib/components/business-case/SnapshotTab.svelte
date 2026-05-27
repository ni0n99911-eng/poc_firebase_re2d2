<script lang="ts">
  import type { BusinessCaseStore } from '$lib/stores/business-case-store.svelte';
  import type { FinancialModel } from '$lib/stores/business-case-store.svelte';

  interface Props {
    store: BusinessCaseStore;
    model: FinancialModel;
    isLoading?: boolean;
    // BUG-FIX (2026-04-17): was missing from Props — caused ReferenceError when
    // SnapshotTab is rendered from the dashboard without this prop. The template
    // uses onCopilotStrategy?.() (optional call) but the variable must be in
    // scope first; without the prop declaration it simply doesn't exist.
    onCopilotStrategy?: (strategy: string) => void;
  }

  let { store, model, isLoading = false, onCopilotStrategy }: Props = $props();

  // ─── Metric values (prefer model when enriched, fall back to store) ─────────
  // B3-1.1 fix: hero must show costToOpen (startupCosts + contingency), not startupCosts alone.
  // model.startupCosts excludes contingency ($258K); model.costToOpen includes it ($284K).
  const costToOpen    = $derived(model.costToOpen > 0 ? model.costToOpen : (store.costToOpen ?? 0));
  const cashNeeded    = $derived(model.cashNeeded    > 0 ? model.cashNeeded   : (store.cashNeeded  ?? 0));
  const dailyTarget   = $derived(model.breakEvenPerDay > 0 ? model.breakEvenPerDay : (store.breakEvenPerDay ?? 0));
  const breakEvenBase = $derived(model.breakEvenMonth ?? store.breakEvenMonth ?? 0);

  // ─── Break-even month colour band ────────────────────────────────────────────
  const bemColor = $derived(
    !breakEvenBase    ? '#6b7280' :
    breakEvenBase <= 12 ? '#166534' :
    breakEvenBase <= 24 ? '#d97706' : '#dc2626'
  );
  const bemBg = $derived(
    !breakEvenBase    ? '#f9fafb' :
    breakEvenBase <= 12 ? '#f0fdf4' :
    breakEvenBase <= 24 ? '#fffbeb' : '#fef2f2'
  );
  const bemBorder = $derived(
    !breakEvenBase    ? '#e5e7eb' :
    breakEvenBase <= 12 ? '#bbf7d0' :
    breakEvenBase <= 24 ? '#fde68a' : '#fca5a5'
  );

  // ─── Scenario range for break-even month ─────────────────────────────────────
  // model.scenarios row with label 'Break-Even Month' has con / base / opt as strings
  const bemRow = $derived(model.scenarios?.find(r => r.label === 'Break-Even Month'));

  // ─── UX-6: Editorial label for Optimistic scenario ───────────────────────────
  // B2-CARRY-2: Brain 2 populates editorialLabel when editorial momentum is detected.
  // Render "Based on {editorialLabel} momentum." below the Best (optimistic) row.
  const optEditorialLabel = $derived(
    store.scenarios?.optimistic?.editorialLabel ?? null
  );

  // ─── Kill chip: rent > 12% of revenue ────────────────────────────────────────
  const rentRatio = $derived(
    store.monthlyRevenue > 0 ? (store.monthlyRent / store.monthlyRevenue) : 0
  );
  const showKillChip = $derived(rentRatio > 0.12 && store.monthlyRevenue > 0 && store.monthlyRent > 0);

  // ─── Use of Funds — where the startup money goes ──────────────────────────
  const useOfFunds = $derived(model.useOfFunds);
  const hasUseOfFunds = $derived(useOfFunds && useOfFunds.total > 0);

  // ─── Zero state: no inputs yet ───────────────────────────────────────────────
  const hasData = $derived(store.dailyCustomers > 0 && store.avgTicket > 0);

  // ─── Formatters ──────────────────────────────────────────────────────────────
  function fmtMoney(n: number): string {
    if (!n || isNaN(n)) return '—';
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return '$' + Math.round(n / 1_000) + 'K';
    return '$' + Math.round(n).toLocaleString();
  }
</script>

<div class="snap-tab">
  {#if isLoading}
    <div class="snap-loading-pill">Calculating with location signals…</div>
  {/if}

  {#if !hasData}
    <div class="snap-zero">
      Use the sliders on the left to enter your daily customers, ticket size, and costs. Your numbers appear here instantly.
    </div>
  {:else}

    <!-- 2×2 grid -->
    <div class="snap-grid">

      <!-- Cell 1: Money to open -->
      {#if costToOpen > 0}
        <div class="snap-cell">
          <div class="sc-num">{fmtMoney(costToOpen)}</div>
          <div class="sc-label">Money to Open the Doors</div>
          <div class="sc-note">Everything you need before opening day — buildout, equipment, permits, deposits, and first month's rent.</div>
        </div>
      {/if}

      <!-- Cell 2: Survival cash -->
      {#if cashNeeded > 0}
        <div class="snap-cell">
          <div class="sc-num">{fmtMoney(cashNeeded)}</div>
          <div class="sc-label">Total Cash You'll Need</div>
          <div class="sc-note">Your safety net: startup costs + 6 months of runway to cover early losses.</div>
        </div>
      {/if}

      <!-- Cell 3: Daily target -->
      {#if dailyTarget > 0}
        <div class="snap-cell">
          <div class="sc-num">{fmtMoney(dailyTarget)}<span class="sc-suffix">/day</span></div>
          <div class="sc-label">Your Daily Target</div>
          <div class="sc-note">The amount you need to ring up every single day to not lose money. Post it on the register. Check it at 6pm.</div>
        </div>
      {/if}

      <!-- Cell 4: Break-even month -->
      {#if breakEvenBase > 0}
        <div class="snap-cell snap-cell--bem" style="background:{bemBg}; border-color:{bemBorder}">
          <div class="sc-num" style="color:{bemColor}">Month {breakEvenBase}</div>
          <div class="sc-label">When You Start Keeping Money</div>
          <div class="sc-note">The month the business pays for itself. After this point, profit is yours.</div>
          <!-- BC7: Break-even benchmark context -->
          <div class="sc-benchmark">
            {#if breakEvenBase <= 6}
              Most businesses in NYC break even in 6-12 months — you're ahead of the curve.
            {:else if breakEvenBase <= 12}
              Most businesses in NYC break even in 6-12 months — you're right on track.
            {:else}
              Most businesses in NYC break even in 6-12 months. Consider adjusting your numbers to get closer.
            {/if}
          </div>

          {#if bemRow}
            <div class="sc-range">
              <div class="scr-row">
                <span class="scr-tag scr-tag--opt">Best</span>
                <span class="scr-val">{bemRow.optimistic}</span>
              </div>
              {#if optEditorialLabel}
                <!-- UX-6: editorial label from Brain 2 — only when non-null (R1) -->
                <div class="scr-editorial">Based on {optEditorialLabel} momentum.</div>
              {/if}
              <div class="scr-row">
                <span class="scr-tag scr-tag--base">Base</span>
                <span class="scr-val scr-val--base">{bemRow.base}</span>
              </div>
              <div class="scr-row">
                <span class="scr-tag scr-tag--con">Slow</span>
                <span class="scr-val">{bemRow.conservative}</span>
              </div>
            </div>
          {/if}
        </div>
      {/if}

    </div>

    <!-- BC6: Rent warning reframed with actions -->
    {#if showKillChip}
      <div class="snap-kill">
        <span class="sk-icon">⚠</span>
        <div class="sk-body">
          <strong>Your rent-to-revenue ratio is {Math.round(rentRatio * 100)}%</strong> — most successful operators keep this under 12%. This is common at this stage and fixable. Tenants in this area typically negotiate 15–25% off asking rent. Ask RE²D2 how:
          <div class="sk-actions">
            <button class="sk-action" onclick={() => onCopilotStrategy?.("negotiate_rent")}>How do I bring rent down? →</button>
            <button class="sk-action" onclick={() => onCopilotStrategy?.("increase_revenue")}>How do I make more revenue? →</button>
            <button class="sk-action" onclick={() => onCopilotStrategy?.("rent_benchmarks")}>Is my rent fair for this area? →</button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Use of Funds -->
    {#if hasUseOfFunds}
      <div class="snap-funds">
        <div class="sf-title">Where Your Startup Money Goes</div>
        <div class="sf-grid">
          {#if useOfFunds.buildout > 0}
            <div class="sf-row"><span>Buildout</span><span>{fmtMoney(useOfFunds.buildout)}</span></div>
          {/if}
          {#if useOfFunds.equipment > 0}
            <div class="sf-row"><span>Equipment</span><span>{fmtMoney(useOfFunds.equipment)}</span></div>
          {/if}
          {#if useOfFunds.permits > 0}
            <div class="sf-row"><span>Permits &amp; licenses</span><span>{fmtMoney(useOfFunds.permits)}</span></div>
          {/if}
          {#if useOfFunds.deposit > 0}
            <div class="sf-row"><span>Security deposit</span><span>{fmtMoney(useOfFunds.deposit)}</span></div>
          {/if}
          {#if useOfFunds.workingCapital > 0}
            <div class="sf-row"><span>Working capital buffer</span><span>{fmtMoney(useOfFunds.workingCapital)}</span></div>
          {/if}
          {#if useOfFunds.contingency > 0}
            <div class="sf-row"><span>Contingency (10%)</span><span>{fmtMoney(useOfFunds.contingency)}</span></div>
          {/if}
          <div class="sf-row sf-row--total"><span>Total</span><span>{fmtMoney(useOfFunds.total)}</span></div>
        </div>
      </div>
    {/if}

  {/if}
</div>

<style>
  .snap-tab {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .snap-loading-pill {
    background: #fef9c3;
    border: 1px solid #fde68a;
    border-radius: 8px;
    padding: 9px 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #854d0e;
    font-weight: 500;
  }

  .snap-zero {
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

  /* 2×2 grid */
  .snap-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  @media (max-width: 620px) {
    .snap-grid { grid-template-columns: 1fr; }
  }

  .snap-cell {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px 22px 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* .snap-cell--bem: background and border-color set inline via style= */

  /* Large number */
  .sc-num {
    font-family: 'DM Sans', sans-serif;
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #1e3a2a;
    line-height: 1;
  }

  .sc-suffix {
    font-size: 18px;
    font-weight: 500;
    opacity: 0.55;
    margin-left: 2px;
  }

  /* Label */
  .sc-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #111827;
    margin-top: 2px;
  }

  /* Explainer note */
  .sc-note {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #6b7280;
    line-height: 1.5;
  }

  /* Scenario range (cell 4) */
  .sc-range {
    margin-top: 10px;
    border-top: 1px solid rgba(0,0,0,0.07);
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .scr-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .scr-tag {
    font-family: 'DM Sans', sans-serif;
    font-size: 10px;
    font-weight: 700;
    border-radius: 4px;
    padding: 1px 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex-shrink: 0;
    min-width: 36px;
    text-align: center;
  }

  .scr-tag--opt  { background: #dcfce7; color: #166534; }
  .scr-tag--base { background: #f3f4f6; color: #374151; }
  .scr-tag--con  { background: #fee2e2; color: #991b1b; }

  .scr-val {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #4b5563;
  }

  .scr-val--base {
    font-weight: 600;
    color: #1e3a2a;
  }

  /* UX-6: editorial citation line below Best (optimistic) scenario — muted, same weight as sc-note */
  .scr-editorial {
    font-size: 10.5px;
    color: #6b7280;
    font-style: italic;
    padding: 0 0 4px 2px;
    line-height: 1.4;
  }

  /* Kill chip */
  .snap-kill {
    background: #fff7ed;
    border: 1px solid #fed7aa;
    border-radius: 10px;
    padding: 12px 16px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .sk-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .sk-body {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #92400e;
    line-height: 1.5;
  }

  /* BC6: Action chips in rent warning */
  .sk-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }

  .sk-action {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #92400e;
    background: rgba(146, 64, 14, 0.08);
    border: 1px solid rgba(146, 64, 14, 0.2);
    border-radius: 6px;
    padding: 5px 10px;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
    transition: background 0.15s;
  }

  .sk-action:hover {
    background: rgba(146, 64, 14, 0.15);
  }

  /* BC7: Benchmark context */
  .sc-benchmark {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: #166534;
    background: rgba(22, 101, 52, 0.06);
    border-radius: 6px;
    padding: 6px 10px;
    margin-top: 4px;
    line-height: 1.4;
  }

  /* ─── Use of Funds ─────────────────────────────────────────────────────── */
  .snap-funds {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sf-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
  }

  .sf-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sf-row {
    display: flex;
    justify-content: space-between;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #4b5563;
    padding: 3px 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .sf-row span:last-child {
    font-weight: 600;
    color: #111827;
  }

  .sf-row--total {
    border-top: 1px solid #d1d5db;
    border-bottom: none;
    padding-top: 8px;
    margin-top: 4px;
    font-weight: 700;
    color: #111827;
  }

  .sf-row--total span:last-child {
    font-weight: 800;
    color: #1e3a2a;
    font-size: 15px;
  }
</style>
