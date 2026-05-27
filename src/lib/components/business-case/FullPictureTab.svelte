<script lang="ts">
  import type { BusinessCaseStore } from '$lib/stores/business-case-store.svelte';
  import type { FinancialModel, YearRow } from '$lib/stores/business-case-store.svelte';

  interface Props {
    store: BusinessCaseStore;
    model: FinancialModel;
    isLoading?: boolean;
  }

  let { store, model, isLoading = false }: Props = $props();

  // ─── 5-year table ────────────────────────────────────────────────────────────
  const yearRows = $derived<YearRow[]>(model.yearRows?.length ? model.yearRows : stubYearRows());

  function stubYearRows(): YearRow[] {
    const rev1 = store.annualRevenue;
    const growth = [1, 1.12, 1.22, 1.30, 1.36];
    return growth.map((g, i) => {
      const rev = rev1 * g;
      const cogs = store.annualCOGS * g;
      const gp = rev - cogs;
      const labor = store.annualLabor * (1 + i * 0.05);
      const opex = store.annualOpEx * (1 + i * 0.03);
      const rent = store.annualRent * (1 + i * 0.02);
      const ebitda = gp - labor - opex - rent;
      const interest = i === 0 ? (model.loanAmount ?? 0) * ((model.loanRate ?? 0) / 100) * 0.9 : 0;
      const da = (model.loanAmount ?? 0) * 0.05;
      const ni = ebitda - interest - da;
      const loanPay = model.loanMonthlyPayment ?? 0;
      const dscr = loanPay > 0 ? (ebitda / 12) / loanPay : 0;
      return { year: i + 1, revenue: rev, cogs, grossProfit: gp, rent, labor, opex,
               ebitda, interest, da, netIncome: ni, ownersDraw: Math.max(0, ni * 0.6), dscr };
    });
  }

  // ─── DSCR ────────────────────────────────────────────────────────────────────
  const dscrY1 = $derived(yearRows[0]?.dscr ?? 0);
  const dscrColor = $derived(
    dscrY1 >= 1.25 ? '#166534' :
    dscrY1 >= 1.00 ? '#d97706' : '#dc2626'
  );
  const dscrBg = $derived(
    dscrY1 >= 1.25 ? '#f0fdf4' :
    dscrY1 >= 1.00 ? '#fffbeb' : '#fef2f2'
  );
  const dscrLabel = $derived(
    dscrY1 >= 1.25 ? 'Bankable' :
    dscrY1 >= 1.00 ? 'Borderline' : 'Below Threshold'
  );

  // Width of the DSCR gauge fill — cap at 200% for display
  const dscrGaugePct = $derived(Math.min(100, (dscrY1 / 2) * 100));

  // ─── Loan serviceability ──────────────────────────────────────────────────────
  const loanMonthlyPayment = $derived(model.loanMonthlyPayment ?? calcMonthlyPayment(
    model.loanAmount ?? 0, model.loanRate ?? 7, model.loanTermYears ?? 10
  ));
  function calcMonthlyPayment(p: number, r: number, y: number): number {
    const mr = r / 100 / 12;
    const n = y * 12;
    if (mr === 0 || n === 0) return p / Math.max(1, n);
    return p * (mr * Math.pow(1 + mr, n)) / (Math.pow(1 + mr, n) - 1);
  }

  const y1MonthlyProfit = $derived((yearRows[0]?.netIncome ?? 0) / 12);
  const isServiceable = $derived(y1MonthlyProfit >= loanMonthlyPayment);

  // First year where debt is covered (scan yearRows)
  const firstCoverageYear = $derived.by(() => {
    for (const row of yearRows) {
      if ((row.netIncome / 12) >= loanMonthlyPayment) return row.year;
    }
    return null;
  });

  // ─── Formal break-even ────────────────────────────────────────────────────────
  const monthlyFixedCosts = $derived(
    store.monthlyRent + store.monthlyOpEx + loanMonthlyPayment
  );
  const contributionMargin = $derived.by(() => {
    const ticket = store.avgTicket;
    const cogs = store.cogsPercent / 100;
    if (ticket <= 0) return 0;
    return ticket * (1 - cogs);
  });
  const breakEvenUnitsMonth = $derived(
    contributionMargin > 0 ? Math.ceil(monthlyFixedCosts / contributionMargin) : 0
  );
  const breakEvenRevenueMonth = $derived(breakEvenUnitsMonth * store.avgTicket);

  // ─── Go / No-Go Risk Rating ───────────────────────────────────────────────────
  const breakEvenMonth = $derived(model.breakEvenMonth ?? store.breakEvenMonth ?? 0);
  const rentRatio = $derived(
    store.monthlyRevenue > 0 ? store.monthlyRent / store.monthlyRevenue : 0
  );

  const riskRating = $derived.by((): 'not-recommended' | 'high-risk' | 'medium-risk' | 'low-risk' => {
    if (dscrY1 < 0.8 || breakEvenMonth >= 60) return 'not-recommended';
    if (dscrY1 < 1.0 || breakEvenMonth >= 48 || rentRatio > 0.18) return 'high-risk';
    if (dscrY1 < 1.25 || breakEvenMonth >= 36 || rentRatio > 0.12) return 'medium-risk';
    return 'low-risk';
  });

  const ratingConfig: Record<string, { label: string; color: string; bg: string; border: string; prose: string }> = {
    'not-recommended': {
      label: 'Not Recommended',
      color: '#991b1b',
      bg: '#fef2f2',
      border: '#fca5a5',
      prose: 'This business, as currently modelled, does not meet the minimum financial thresholds required for institutional lending. The DSCR is below the SBA minimum and/or the path to profitability exceeds five years. Significant changes to the revenue model, cost structure, or financing terms are required before this application could be considered.',
    },
    'high-risk': {
      label: 'High Risk',
      color: '#92400e',
      bg: '#fffbeb',
      border: '#fde68a',
      prose: 'This application carries above-average risk. Debt service coverage is below the standard 1.25× SBA threshold or the break-even timeline is extended. A lender would likely require additional collateral, a co-borrower, or a reduced loan amount. The borrower should address cost reduction or revenue validation before applying.',
    },
    'medium-risk': {
      label: 'Medium Risk',
      color: '#1d4ed8',
      bg: '#eff6ff',
      border: '#bfdbfe',
      prose: 'This business meets some but not all standard lending criteria. DSCR approaches the 1.25× benchmark and the break-even timeline is within an acceptable range. A conventional or SBA lender may approve with conditions — such as additional equity injection, stronger personal credit, or demonstrated operating history.',
    },
    'low-risk': {
      label: 'Low Risk',
      color: '#166534',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      prose: 'This application meets or exceeds standard lending criteria. DSCR is above 1.25×, the break-even timeline is within two years, and rent-to-revenue is within the safe range. This business plan is suitable for submission to an SBA lender or conventional bank. Ensure all projections are supported by market data and signed lease terms.',
    },
  };
  const rc = $derived(ratingConfig[riskRating]);

  // ─── Evidence for/against (Go/No-Go detail) ──────────────────────────────
  const evidenceFor     = $derived(model.evidenceFor ?? []);
  const evidenceAgainst = $derived(model.evidenceAgainst ?? []);

  // ─── Funding gap ─────────────────────────────────────────────────────────
  const gapToFund = $derived(model.gapToFund ?? 0);

  // ─── Occupancy cost breakdown (UX-3.3 / B3-2.3) ─────────────────────────
  // Brain 3 emits the full 6-line shape: baseRent, taxPassThrough, crt, bid,
  // insurance, cam, total — plus gate flags (crtApplies, bidName) and tooltip
  // text (insuranceNote, camNote). Per R1/R2, only render a line when > 0
  // (except baseRent which is always shown when the breakdown exists).
  const occBreakdown = $derived(model.occupancyCostBreakdown);
  const hasOccBreakdown = $derived(
    !!occBreakdown && (
      occBreakdown.baseRent > 0 ||
      occBreakdown.taxPassThrough > 0 ||
      occBreakdown.crt > 0 ||
      occBreakdown.bid > 0 ||
      occBreakdown.insurance > 0 ||
      occBreakdown.cam > 0
    )
  );

  // ─── Market Events ───────────────────────────────────────────────────────
  const marketEvents = $derived(model.marketEvents ?? []);

  // ─── Total Interest (lifetime cost of loan) ─────────────────────────────
  const totalInterest = $derived(model.totalInterest ?? 0);

  // ─── Expand/collapse table rows ───────────────────────────────────────────────
  let expandedYear = $state(0);

  // ─── Formatters ──────────────────────────────────────────────────────────────
  function fmt(n: number): string {
    return '$' + Math.round(n).toLocaleString();
  }
  function fmtK(n: number | null | undefined): string {
    if (n == null || isNaN(Number(n))) return '—';
    const v = Number(n);
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(1) + 'M';
    if (abs >= 1_000)     return sign + '$' + Math.round(abs / 1_000) + 'K';
    return sign + '$' + Math.round(abs).toLocaleString();
  }
  function dscrFmt(d: number): string {
    return isNaN(d) || d === 0 ? '—' : d.toFixed(2) + '×';
  }
  function dscrRowColor(d: number): string {
    if (d >= 1.25) return '#166534';
    if (d >= 1.0)  return '#d97706';
    return '#dc2626';
  }

  // ─── Print ───────────────────────────────────────────────────────────────────
  function handlePrint() {
    window.print();
  }
</script>

<div class="fp-tab">

  <!-- ── 1. DSCR Gauge ──────────────────────────────────────────────────────── -->
  <section class="fp-section" style="background:{dscrBg}; border-color:{dscrColor}40">
    <div class="fps-header">
      <span class="fps-title">Debt Service Coverage Ratio (DSCR)</span>
      {#if isLoading}
        <span class="fps-pill">Calculating…</span>
      {/if}
    </div>

    <div class="fp-dscr-row">
      <div class="fp-dscr-value" style="color:{dscrColor}">{dscrFmt(dscrY1)}</div>
      <div class="fp-dscr-badge" style="background:{dscrColor}; color:#fff">{dscrLabel}</div>
    </div>

    <!-- Gauge bar -->
    <div class="fp-dscr-gauge">
      <div class="fp-gauge-track">
        <div class="fp-gauge-fill" style="width:{dscrGaugePct}%; background:{dscrColor}"></div>
        <!-- 1.0 threshold marker -->
        <div class="fp-gauge-mark fp-gauge-mark--1" title="1.0x"></div>
        <!-- 1.25 threshold marker -->
        <div class="fp-gauge-mark fp-gauge-mark--125" title="1.25x (SBA minimum)"></div>
      </div>
      <div class="fp-gauge-labels">
        <span>0</span>
        <span class="fp-gauge-mark-label" style="left:50%">1.0×</span>
        <span class="fp-gauge-mark-label" style="left:62.5%">1.25×</span>
        <span style="margin-left:auto">2.0×</span>
      </div>
    </div>

    <p class="fp-dscr-note">Banks require DSCR ≥ 1.25× for SBA loan approval. Below 1.0× means the business cannot service the debt from Year-1 earnings.</p>
  </section>

  <!-- ── 2. 5-Year Revenue, Cost & Profit Table ─────────────────────────────── -->
  <section class="fp-section">
    <div class="fps-header">
      <span class="fps-title">5-Year Revenue, Cost &amp; Profit Table</span>
    </div>

    <div class="fp-table-wrap">
      <table class="fp-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Revenue</th>
            <th title="Annual rent — escalates each year using your Lease Terms input">Rent</th>
            <th>Total Costs</th>
            <th>Net Profit</th>
            <th>Owner Draw</th>
            <th>DSCR</th>
          </tr>
        </thead>
        <tbody>
          {#each yearRows as row}
            <tr class={row.year === 1 ? 'fp-row-y1' : ''}>
              <td>
                <button class="fp-year-btn" onclick={() => expandedYear = expandedYear === row.year ? 0 : row.year}>
                  Yr {row.year} {expandedYear === row.year ? '▲' : '▼'}
                </button>
              </td>
              <td>{fmtK(row.revenue)}</td>
              <td class="fp-rent-col">{fmtK(row.rent)}</td>
              <td>{fmtK((row.cogs ?? 0) + (row.labor ?? 0) + (row.rent ?? 0) + (row.opex ?? 0))}</td>
              <td class={row.netIncome >= 0 ? 'fp-pos' : 'fp-neg'}>{fmtK(row.netIncome)}</td>
              <td>{fmtK(row.ownersDraw)}</td>
              <td style="color:{dscrRowColor(row.dscr)}; font-weight:600">{dscrFmt(row.dscr)}</td>
            </tr>
            {#if expandedYear === row.year}
              <tr class="fp-expanded-row">
                <td colspan="7">
                  <div class="fp-expanded-grid">
                    <div class="fp-exp-item"><span>COGS</span><span>{fmtK(row.cogs)}</span></div>
                    <div class="fp-exp-item"><span>Rent</span><span>{fmtK(row.rent)}</span></div>
                    <div class="fp-exp-item"><span>Labor</span><span>{fmtK(row.labor)}</span></div>
                    <div class="fp-exp-item"><span>OpEx</span><span>{fmtK(row.opex)}</span></div>
                    <div class="fp-exp-item"><span>Interest</span><span>{fmtK(row.interest)}</span></div>
                    <div class="fp-exp-item"><span>EBITDA</span><span>{fmtK(row.ebitda)}</span></div>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
    <p class="fp-note">Tap a year to expand cost detail. Year 1 is highlighted. Rent column shows annual rent after lease escalation. DSCR = EBITDA ÷ Monthly Debt Service.</p>
  </section>

  <!-- ── 3. Loan Serviceability + Formal Break-Even ──────────────────────────── -->
  <div class="fp-two-col">

    <!-- Loan serviceability -->
    <section class="fp-section">
      <div class="fps-title">Loan Serviceability</div>
      <div class="fp-loan-detail">
        <div class="fp-loan-row">
          <span>Monthly loan payment</span>
          <span class="fp-loan-val">{fmt(loanMonthlyPayment)}</span>
        </div>
        <div class="fp-loan-row">
          <span>Year-1 monthly profit</span>
          <span class="fp-loan-val" class:fp-pos={y1MonthlyProfit >= 0} class:fp-neg={y1MonthlyProfit < 0}>{fmt(y1MonthlyProfit)}</span>
        </div>
        <div class="fp-loan-divider"></div>
        <div class="fp-loan-verdict" class:fp-verdict--yes={isServiceable} class:fp-verdict--no={!isServiceable}>
          {#if isServiceable}
            ✓ Year-1 income covers the loan payment.
          {:else if firstCoverageYear !== null}
            ✗ Covered from Year {firstCoverageYear} — not Year 1. Plan cash reserves.
          {:else}
            ✗ Projections don't show the loan being covered within 5 years.
          {/if}
        </div>
      </div>
      <p class="fp-note">
        Loan: {fmt(model.loanAmount ?? 0)} at {(model.loanRate ?? 7).toFixed(1)}% over {model.loanTermYears ?? 10} years.{#if totalInterest > 0} Total interest paid: {fmtK(totalInterest)}.{/if}
      </p>
    </section>

    <!-- Formal break-even -->
    <section class="fp-section">
      <div class="fps-title">Break-Even Analysis</div>
      <div class="fp-be-grid">
        <div class="fp-be-row">
          <span>Monthly fixed costs</span>
          <span>{fmt(monthlyFixedCosts)}</span>
        </div>
        <div class="fp-be-row">
          <span>Contribution margin / unit</span>
          <span>{fmt(contributionMargin)}</span>
        </div>
        <div class="fp-be-row fp-be-row--total">
          <span>Break-even units / month</span>
          <span>{breakEvenUnitsMonth > 0 ? breakEvenUnitsMonth.toLocaleString() : '—'}</span>
        </div>
        <div class="fp-be-row fp-be-row--total">
          <span>Break-even revenue / month</span>
          <span>{breakEvenRevenueMonth > 0 ? fmt(breakEvenRevenueMonth) : '—'}</span>
        </div>
      </div>
      <p class="fp-note">Fixed costs ÷ contribution margin per unit. Contribution margin = ticket × (1 − COGS %).</p>
    </section>

  </div>

  <!-- ── 3b. Occupancy Cost Breakdown ──────────────────────────────────────── -->
  {#if hasOccBreakdown}
    <section class="fp-section">
      <div class="fps-title">Total Occupancy Cost</div>
      <div class="fp-occ-grid">
        {#if occBreakdown.baseRent > 0}
          <div class="fp-occ-row">
            <span>Base rent</span>
            <span>{fmt(occBreakdown.baseRent)}/mo</span>
          </div>
        {/if}
        {#if occBreakdown.taxPassThrough > 0}
          <div class="fp-occ-row">
            <span>Property tax</span>
            <span>{fmt(occBreakdown.taxPassThrough)}/mo</span>
          </div>
        {/if}
        {#if occBreakdown.crtApplies && occBreakdown.crt > 0}
          <div class="fp-occ-row">
            <span>
              CRT
              <span class="fp-occ-info" title="Commercial Rent Tax — Manhattan below 96th St, 3.9% on rent above $250K/yr.">ⓘ</span>
            </span>
            <span>{fmt(occBreakdown.crt)}/mo</span>
          </div>
        {/if}
        {#if occBreakdown.bid > 0}
          <div class="fp-occ-row">
            <span>
              BID
              {#if occBreakdown.bidName}<span class="fp-occ-info" title={occBreakdown.bidName}>ⓘ</span>{/if}
            </span>
            <span>{fmt(occBreakdown.bid)}/mo</span>
          </div>
        {/if}
        {#if occBreakdown.insurance > 0}
          <div class="fp-occ-row">
            <span>
              Insurance
              {#if occBreakdown.insuranceNote}<span class="fp-occ-info" title={occBreakdown.insuranceNote}>ⓘ</span>{/if}
            </span>
            <span>{fmt(occBreakdown.insurance)}/mo</span>
          </div>
        {/if}
        {#if occBreakdown.cam > 0}
          <div class="fp-occ-row">
            <span>
              CAM
              {#if occBreakdown.camNote}<span class="fp-occ-info" title={occBreakdown.camNote}>ⓘ</span>{/if}
            </span>
            <span>{fmt(occBreakdown.cam)}/mo</span>
          </div>
        {/if}
        <div class="fp-occ-row fp-occ-row--total">
          <span>Total occupancy</span>
          <span>{fmt(occBreakdown.total)}/mo</span>
        </div>
      </div>
      {#if occBreakdown.taxPassThrough > 0}
        <p class="fp-note">Co-op buildings pass through property taxes — budget 10–20% above base rent.</p>
      {/if}
    </section>
  {/if}

  <!-- ── 3c. Funding Gap ─────────────────────────────────────────────────── -->
  {#if gapToFund > 0}
    <section class="fp-section" style="background:#fffbeb; border-color:#fde68a">
      <div class="fps-title" style="color:#92400e">Funding Gap</div>
      <div class="fp-gap-value">{fmtK(gapToFund)}</div>
      <p class="fp-gap-note">
        Total cash needed exceeds your personal investment plus loan amount by this much.
        You'll need to close this gap through additional savings, investors, or grant programs before signing a lease.
      </p>
    </section>
  {/if}

  <!-- ── 4. Go / No-Go Risk Rating ────────────────────────────────────────────── -->
  <section class="fp-section fp-gng-section" style="background:{rc.bg}; border-color:{rc.border}">
    <div class="fps-header">
      <span class="fps-title" style="color:{rc.color}">Go / No-Go Risk Rating</span>
      <button class="fp-print-btn" onclick={handlePrint}>🖨 Print / Export</button>
    </div>

    <div class="fp-gng-badge" style="background:{rc.color}; color:#fff">{rc.label}</div>

    <p class="fp-gng-prose">{rc.prose}</p>

    <div class="fp-gng-metrics">
      <div class="fp-gm-item">
        <span class="fp-gm-label">DSCR Y1</span>
        <span class="fp-gm-val" style="color:{dscrColor}">{dscrFmt(dscrY1)}</span>
      </div>
      <div class="fp-gm-item">
        <span class="fp-gm-label">Break-Even</span>
        <span class="fp-gm-val">
          {breakEvenMonth > 0 ? 'Month ' + breakEvenMonth : '—'}
        </span>
      </div>
      <div class="fp-gm-item">
        <span class="fp-gm-label">Rent / Revenue</span>
        <span class="fp-gm-val" style="color:{rentRatio > 0.15 ? '#dc2626' : '#166534'}">
          {Math.round(rentRatio * 100)}%
        </span>
      </div>
      <div class="fp-gm-item">
        <span class="fp-gm-label">Loan Serviceable</span>
        <span class="fp-gm-val" style="color:{isServiceable ? '#166534' : '#dc2626'}">
          {isServiceable ? 'Year 1' : firstCoverageYear ? 'Year ' + firstCoverageYear : 'No'}
        </span>
      </div>
    </div>

    <!-- Evidence For / Against -->
    {#if evidenceFor.length > 0 || evidenceAgainst.length > 0}
      <div class="fp-evidence">
        {#if evidenceFor.length > 0}
          <div class="fp-ev-col fp-ev-col--for">
            <div class="fp-ev-header">Working in Your Favor</div>
            {#each evidenceFor as item}
              <div class="fp-ev-item fp-ev-item--for">✓ {item}</div>
            {/each}
          </div>
        {/if}
        {#if evidenceAgainst.length > 0}
          <div class="fp-ev-col fp-ev-col--against">
            <div class="fp-ev-header">Working Against You</div>
            {#each evidenceAgainst as item}
              <div class="fp-ev-item fp-ev-item--against">✗ {item}</div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </section>

  <!-- ── 5. Market Events (What Could Go Wrong) ──────────────────────────── -->
  {#if marketEvents.length > 0}
    <section class="fp-section">
      <div class="fps-header">
        <span class="fps-title">What Could Go Wrong</span>
      </div>
      <p class="fp-note" style="margin-bottom:4px">Real-world shocks sized to your numbers. Plan for at least the top two.</p>

      <div class="fp-events-list">
        {#each marketEvents as evt}
          <div class="fp-event-card">
            <div class="fp-evt-top">
              <span class="fp-evt-risk">{evt.risk}</span>
              <span class="fp-evt-impact">{fmtK(evt.dollarImpact)}</span>
            </div>
            <div class="fp-evt-meaning">{evt.meaning}</div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

</div>

<style>
  .fp-tab {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* Section card */
  .fp-section {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .fps-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .fps-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
  }

  .fps-pill {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    background: #fef9c3;
    color: #854d0e;
    border-radius: 20px;
    padding: 2px 10px;
  }

  /* ─── DSCR gauge ──────────────────────────────────────────────────────────── */
  .fp-dscr-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .fp-dscr-value {
    font-family: 'DM Sans', sans-serif;
    font-size: 48px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .fp-dscr-badge {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 700;
    border-radius: 6px;
    padding: 4px 12px;
    letter-spacing: 0.02em;
  }

  .fp-dscr-gauge {
    margin-top: 4px;
  }

  .fp-gauge-track {
    position: relative;
    height: 10px;
    background: #e5e7eb;
    border-radius: 5px;
    overflow: hidden;
  }

  .fp-gauge-fill {
    height: 100%;
    border-radius: 5px;
    transition: width 0.5s ease;
  }

  /* 1.0× = 50% position, 1.25× = 62.5% position (out of 2.0 max) */
  .fp-gauge-mark {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: rgba(255,255,255,0.7);
  }

  .fp-gauge-mark--1   { left: 50%; }
  .fp-gauge-mark--125 { left: 62.5%; }

  .fp-gauge-labels {
    display: flex;
    align-items: center;
    margin-top: 4px;
    position: relative;
    font-family: 'DM Sans', sans-serif;
    font-size: 10px;
    color: #9ca3af;
  }

  .fp-gauge-mark-label {
    position: absolute;
    transform: translateX(-50%);
    font-family: 'DM Sans', sans-serif;
    font-size: 10px;
    color: #9ca3af;
  }

  .fp-dscr-note {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #6b7280;
    line-height: 1.5;
    margin: 0;
  }

  /* ─── 5-year table ───────────────────────────────────────────────────────── */
  .fp-table-wrap {
    overflow-x: auto;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  .fp-table {
    width: 100%;
    border-collapse: collapse;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
  }

  .fp-table thead tr { background: #f9fafb; }

  .fp-table th {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
    text-align: right;
    white-space: nowrap;
  }

  .fp-table th:first-child { text-align: left; }

  .fp-table td {
    padding: 9px 12px;
    text-align: right;
    border-top: 1px solid #f3f4f6;
    color: #374151;
    white-space: nowrap;
  }

  .fp-table td:first-child { text-align: left; }
  .fp-row-y1 td { background: #f0fdf4; }

  .fp-year-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #1e3a2a;
    padding: 0;
    text-align: left;
  }

  .fp-expanded-row td {
    background: #f9fafb;
    padding: 0;
  }

  .fp-expanded-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: #e5e7eb;
  }

  .fp-exp-item {
    background: #f9fafb;
    padding: 6px 12px;
    display: flex;
    justify-content: space-between;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #6b7280;
  }

  .fp-exp-item span:last-child { font-weight: 600; color: #374151; }

  .fp-pos { color: #166534; font-weight: 600; }
  .fp-neg { color: #dc2626; font-weight: 600; }

  /* UX-EF: rent column — faint accent so escalation trajectory is visible */
  .fp-rent-col { color: #78350f; }

  .fp-note {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #9ca3af;
    line-height: 1.5;
    margin: 0;
  }

  /* ─── Two-column row ─────────────────────────────────────────────────────── */
  .fp-two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  @media (max-width: 680px) {
    .fp-two-col { grid-template-columns: 1fr; }
  }

  /* ─── Loan serviceability ────────────────────────────────────────────────── */
  .fp-loan-detail {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .fp-loan-row {
    display: flex;
    justify-content: space-between;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #4b5563;
  }

  .fp-loan-val {
    font-weight: 600;
    color: #111827;
  }

  .fp-loan-divider {
    height: 1px;
    background: #e5e7eb;
    margin: 4px 0;
  }

  .fp-loan-verdict {
    border-radius: 8px;
    padding: 10px 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
  }

  .fp-verdict--yes { background: #f0fdf4; color: #166534; }
  .fp-verdict--no  { background: #fef2f2; color: #991b1b; }

  /* ─── Break-even ─────────────────────────────────────────────────────────── */
  .fp-be-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .fp-be-row {
    display: flex;
    justify-content: space-between;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #4b5563;
    padding: 2px 0;
  }

  .fp-be-row--total {
    font-weight: 700;
    color: #111827;
    border-top: 1px solid #e5e7eb;
    padding-top: 8px;
    margin-top: 2px;
  }

  /* ─── Go/No-Go risk rating ───────────────────────────────────────────────── */
  .fp-gng-section {
    /* background / border-color set inline */
  }

  .fp-gng-badge {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 700;
    border-radius: 6px;
    padding: 5px 14px;
    display: inline-block;
    letter-spacing: 0.02em;
    align-self: flex-start;
  }

  .fp-gng-prose {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #374151;
    line-height: 1.7;
    margin: 0;
  }

  .fp-gng-metrics {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    background: rgba(255,255,255,0.55);
    border-radius: 8px;
    padding: 12px 14px;
    margin-top: 4px;
  }

  @media (max-width: 600px) {
    .fp-gng-metrics { grid-template-columns: 1fr 1fr; }
  }

  .fp-gm-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .fp-gm-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
  }

  .fp-gm-val {
    font-family: 'DM Sans', sans-serif;
    font-size: 16px;
    font-weight: 800;
    color: #111827;
  }

  /* ─── Print button ───────────────────────────────────────────────────────── */
  .fp-print-btn {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    background: #fff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 5px 12px;
    cursor: pointer;
    color: #374151;
    transition: background 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .fp-print-btn:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  /* ─── Occupancy cost ──────────────────────────────────────────────────── */
  .fp-occ-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .fp-occ-row {
    display: flex;
    justify-content: space-between;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #4b5563;
    padding: 4px 0;
  }

  .fp-occ-row span:last-child { font-weight: 600; color: #111827; }

  .fp-occ-row--total {
    border-top: 1px solid #e5e7eb;
    padding-top: 8px;
    margin-top: 2px;
    font-weight: 700;
    color: #111827;
  }

  /* UX-3.3: Info tooltip for CRT / BID / Insurance / CAM labels */
  .fp-occ-info {
    display: inline-block;
    margin-left: 4px;
    width: 14px;
    height: 14px;
    line-height: 14px;
    text-align: center;
    font-size: 10px;
    color: #6b7280;
    border: 1px solid #d1d5db;
    border-radius: 50%;
    cursor: help;
    user-select: none;
  }
  .fp-occ-info:hover { color: #111827; border-color: #9ca3af; }

  /* ─── Funding Gap ──────────────────────────────────────────────────────── */
  .fp-gap-value {
    font-family: 'DM Sans', sans-serif;
    font-size: 36px;
    font-weight: 800;
    color: #92400e;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .fp-gap-note {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #92400e;
    line-height: 1.5;
    margin: 0;
  }

  /* ─── Evidence for/against ─────────────────────────────────────────────── */
  .fp-evidence {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 6px;
  }

  @media (max-width: 600px) {
    .fp-evidence { grid-template-columns: 1fr; }
  }

  .fp-ev-col {
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .fp-ev-col--for     { background: #f0fdf4; }
  .fp-ev-col--against { background: #fef2f2; }

  .fp-ev-header {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .fp-ev-col--for .fp-ev-header     { color: #166534; }
  .fp-ev-col--against .fp-ev-header { color: #991b1b; }

  .fp-ev-item {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    line-height: 1.5;
  }

  .fp-ev-item--for     { color: #166534; }
  .fp-ev-item--against { color: #991b1b; }

  /* ─── Market Events ────────────────────────────────────────────────────── */
  .fp-events-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .fp-event-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .fp-evt-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .fp-evt-risk {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #111827;
  }

  .fp-evt-impact {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 800;
    color: #dc2626;
    white-space: nowrap;
  }

  .fp-evt-meaning {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #6b7280;
    line-height: 1.5;
  }

  /* ─── Print styles ────────────────────────────────────────────────────────── */
  @media print {
    .fp-print-btn { display: none; }
    .fp-tab { gap: 10px; }
    .fp-section { border-radius: 4px; box-shadow: none; break-inside: avoid; }
  }
</style>
