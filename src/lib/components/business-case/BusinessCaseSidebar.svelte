<script lang="ts">
  import type { BusinessCaseStore } from '$lib/stores/business-case-store.svelte';

  interface Props {
    store: BusinessCaseStore;
    editMode?: boolean;   // Tab 1 = edit, Tabs 2-3 = read-only summary
  }

  let { store, editMode = true }: Props = $props();

  function fmt(n: number): string {
    return '$' + Math.round(n).toLocaleString();
  }

  function n(e: Event): number {
    return +((e.target as HTMLInputElement).value);
  }

  // {@const} is invalid at template top-level — compute here instead
  const netMonthly = $derived(store.monthlyRevenue - store.monthlyTotal);

  // ── UX-EF full wire-up (BR-B' + BR-M2 landed April 11, 2026) ──
  // Lease Terms section is now live. Base rent + annual escalation are always
  // visible; percentage rent is gated behind a teaching disclosure because
  // most NYC leases don't have it. Unit conversion: store holds decimals
  // (0.03 = 3%); UI displays percentages (3.0). Breakpoint is direct dollars.
  let leaseTermsExpanded = $state(false);

  // Display-side accessors (decimal → percent for the UI, percent → decimal
  // on write-back). Separate local derivations avoid re-entrancy when the
  // user types intermediate values like "3." or "" into the number inputs.
  //
  // BR-M2 getter note: `escalationPct` is the RAW founder input (0 when
  // unset). `effectiveEscalationPct` is what the engine actually uses,
  // falling back to the concept default (~0.03) when raw is 0. The input
  // value= stays bound to the raw field so typing/clearing feels natural;
  // the visible label shows the effective % so first-load reads "3%/yr
  // (concept default)" instead of an empty "—".
  const escalationRawDisplay = $derived(
    store.escalationPct > 0 ? +(store.escalationPct * 100).toFixed(2) : 0
  );
  const escalationEffectiveDisplay = $derived(
    +(store.effectiveEscalationPct * 100).toFixed(2)
  );
  const escalationIsDefault = $derived(store.escalationPct <= 0);
  const pctRentRateDisplay = $derived(
    store.percentageRentRate > 0 ? +(store.percentageRentRate * 100).toFixed(2) : 0
  );

  function onEscalationInput(e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    const parsed = raw === '' ? 0 : Math.max(0, Math.min(15, +raw || 0));
    store.escalationPct = parsed / 100;
  }
  function onPctRentRateInput(e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    const parsed = raw === '' ? 0 : Math.max(0, Math.min(20, +raw || 0));
    store.percentageRentRate = parsed / 100;
  }
  function onPctRentBreakpointInput(e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    const parsed = raw === '' ? 0 : Math.max(0, +raw || 0);
    store.percentageRentBreakpoint = parsed;
  }

  // ── Lease-related validation banners ──
  // UX-EF reads validations by code and renders matching severity banners.
  // percentage_rent: live (BR-B' shipped in PR #93 / 2091379).
  //   WARNING = dormant clause, FLAG = triggers within Y1–Y3.
  // rent_escalation_stress: live (BR-M2 shipped in 7f7822e on the
  //   brain/wave1-br-m2-rent-escalation-gate branch). FLAG emits when
  //   Year-3 projected rent exceeds the concept occupancy ceiling at
  //   the founder's escalation pct.
  const pctRentValidation = $derived(
    store.validations?.find(v => v.field === 'percentage_rent') ?? null
  );
  const escalationStressValidation = $derived(
    store.validations?.find(v => v.field === 'rent_escalation_stress') ?? null
  );
</script>

<aside class="bc-sidebar">
  <div class="bs-header">
    <div class="bs-title">Your Numbers</div>
    <div class="bs-concept">{store.conceptLabel}</div>
    {#if store.analysisAddress}
      <div class="bs-addr">{store.analysisAddress.split(',')[0]}</div>
    {/if}
  </div>

  {#if editMode}
    <!-- ── Revenue Drivers ── -->
    <div class="bs-section">
      <div class="bs-section-label">What You Sell</div>

      <div class="bs-field">
        <div class="bs-field-top">
          <span>Daily Customers</span>
          <span class="bs-field-val">{store.dailyCustomers}</span>
        </div>
        <input type="range" min="20" max="600" step="5"
          value={store.dailyCustomers}
          oninput={(e) => store.dailyCustomers = n(e)} />
      </div>

      <div class="bs-field">
        <div class="bs-field-top">
          <span>Average Sale</span>
          <span class="bs-field-val">${store.avgTicket.toFixed(2)}</span>
        </div>
        <input type="range" min="3" max="200" step="0.5"
          value={store.avgTicket}
          oninput={(e) => store.avgTicket = n(e)} />
      </div>

      <div class="bs-field">
        <div class="bs-field-top">
          <span>Days Open / Week</span>
          <span class="bs-field-val">{store.daysPerWeek} days</span>
        </div>
        <input type="range" min="3" max="7" step="1"
          value={store.daysPerWeek}
          oninput={(e) => store.daysPerWeek = n(e)} />
      </div>

      <div class="bs-field">
        <div class="bs-field-top">
          <span>Product Cost</span>
          <span class="bs-field-val">{store.cogsPercent}% of each sale</span>
        </div>
        <input type="range" min="10" max="70" step="1"
          value={store.cogsPercent}
          oninput={(e) => store.cogsPercent = n(e)} />
      </div>
    </div>

    <!-- ── Lease Terms (UX-EF skeleton) ── -->
    <!--
      UX-EF: Hybrid lease terms section. Base rent + annual escalation always
      visible. Percentage rent gated behind a teaching disclosure toggle — the
      label itself ("Does your lease have percentage rent?") is the teaching
      surface. Skeleton ships layout only; bindings land after BR-B'.
    -->
    <div class="bs-section">
      <div class="bs-section-label">Lease Terms</div>

      <div class="bs-field">
        <div class="bs-field-top">
          <span>Base monthly rent</span>
          <span class="bs-field-val">{fmt(store.monthlyRent)}</span>
        </div>
        <input type="range" min="0" max="30000" step="250"
          value={store.monthlyRent}
          oninput={(e) => store.monthlyRent = n(e)} />
        <input type="number" class="bs-num-full" min="0" step="100"
          value={store.monthlyRent}
          oninput={(e) => store.monthlyRent = n(e)} />
      </div>

      <div class="bs-field">
        <div class="bs-field-top">
          <span>
            Annual escalation %
            <span class="bs-lt-hint" title="How much your rent goes up each year. Standard NYC commercial leases are 3%.">ⓘ</span>
          </span>
          <span class="bs-field-val">
            {escalationEffectiveDisplay}%/yr
            {#if escalationIsDefault}
              <span class="bs-field-val-sub">concept default</span>
            {/if}
          </span>
        </div>
        <input type="number" class="bs-num-full" min="0" max="15" step="0.25"
          placeholder={String(escalationEffectiveDisplay)}
          value={escalationRawDisplay || ''}
          oninput={onEscalationInput}
          aria-label="Annual rent escalation percent" />
      </div>

      <!-- Percentage rent disclosure toggle -->
      <button
        type="button"
        class="bs-lt-disclosure"
        class:is-open={leaseTermsExpanded}
        aria-expanded={leaseTermsExpanded}
        aria-controls="bs-lt-pct-panel"
        onclick={() => leaseTermsExpanded = !leaseTermsExpanded}
      >
        <span class="bs-lt-disclosure-label">Does your lease have percentage rent?</span>
        <span class="bs-lt-disclosure-chev" aria-hidden="true">→</span>
      </button>

      {#if leaseTermsExpanded}
        <div id="bs-lt-pct-panel" class="bs-lt-pct-panel">
          <p class="bs-lt-teach">
            Some leases charge extra rent when your sales cross a certain threshold.
            If your lease has "percentage rent" or "overage rent" clauses, enter the
            % and the sales threshold here. Most leases don't have this — check your
            term sheet.
          </p>

          <div class="bs-field">
            <div class="bs-field-top">
              <span>Percentage rent rate</span>
              <span class="bs-field-val">
                {#if pctRentRateDisplay > 0}
                  {pctRentRateDisplay}%
                {:else}
                  —
                {/if}
              </span>
            </div>
            <input type="number" class="bs-num-full" min="0" max="20" step="0.25"
              placeholder="e.g. 6"
              value={pctRentRateDisplay || ''}
              oninput={onPctRentRateInput}
              aria-label="Percentage rent rate" />
          </div>

          <div class="bs-field">
            <div class="bs-field-top">
              <span>Annual sales breakpoint</span>
              <span class="bs-field-val">
                {#if store.percentageRentBreakpoint > 0}
                  {fmt(store.percentageRentBreakpoint)}
                {:else}
                  —
                {/if}
              </span>
            </div>
            <input type="number" class="bs-num-full" min="0" step="10000"
              placeholder="e.g. 500000"
              value={store.percentageRentBreakpoint || ''}
              oninput={onPctRentBreakpointInput}
              aria-label="Annual sales breakpoint in dollars" />
          </div>
        </div>
      {/if}

      <!-- ── UX-EF: Lease-related validation banners ── -->
      {#if pctRentValidation}
        <div
          class="bs-lease-banner"
          class:bs-lease-banner--warn={pctRentValidation.severity === 'WARNING'}
          class:bs-lease-banner--flag={pctRentValidation.severity === 'FLAG'}
          class:bs-lease-banner--block={pctRentValidation.severity === 'BLOCK'}
          role="status"
          aria-live="polite"
        >
          <div class="bs-lease-banner-icon" aria-hidden="true">
            {pctRentValidation.severity === 'WARNING' ? 'ⓘ' : '⚠'}
          </div>
          <div class="bs-lease-banner-body">
            <div class="bs-lease-banner-title">
              {#if pctRentValidation.severity === 'WARNING'}
                Percentage rent clause — dormant
              {:else}
                Percentage rent triggers at current projections
              {/if}
            </div>
            <div class="bs-lease-banner-copy">{pctRentValidation.message}</div>
          </div>
        </div>
      {/if}

      {#if escalationStressValidation}
        <div
          class="bs-lease-banner"
          class:bs-lease-banner--warn={escalationStressValidation.severity === 'WARNING'}
          class:bs-lease-banner--flag={escalationStressValidation.severity === 'FLAG'}
          class:bs-lease-banner--block={escalationStressValidation.severity === 'BLOCK'}
          role="status"
          aria-live="polite"
        >
          <div class="bs-lease-banner-icon" aria-hidden="true">⚠</div>
          <div class="bs-lease-banner-body">
            <div class="bs-lease-banner-title">Escalation stress</div>
            <div class="bs-lease-banner-copy">{escalationStressValidation.message}</div>
          </div>
        </div>
      {/if}
    </div>

    <!-- ── Fixed Costs / Month ── -->
    <div class="bs-section">
      <div class="bs-section-label">What You Pay Every Month</div>

      <div class="bs-field">
        <div class="bs-field-top">
          <span>Other Monthly Costs</span>
          <span class="bs-field-val">{fmt(store.monthlyOpEx)}</span>
        </div>
        <input type="range" min="0" max="20000" step="250"
          value={store.monthlyOpEx}
          oninput={(e) => store.monthlyOpEx = n(e)} />
        <input type="number" class="bs-num-full" min="0" step="100"
          value={store.monthlyOpEx}
          oninput={(e) => store.monthlyOpEx = n(e)} />
      </div>
    </div>

    <!-- ── Team ── -->
    <div class="bs-section">
      <div class="bs-section-label">Team</div>

      <div class="bs-field">
        <div class="bs-field-top">
          <span>Full-time staff</span>
          <span class="bs-field-val">{store.fullTimeStaff} × ${store.fullTimeRate}/hr</span>
        </div>
        <input type="range" min="0" max="10" step="1"
          value={store.fullTimeStaff}
          oninput={(e) => store.fullTimeStaff = n(e)} />
      </div>

      <div class="bs-field">
        <div class="bs-field-top">
          <span>FT hourly rate</span>
          <span class="bs-field-val">${store.fullTimeRate}/hr</span>
        </div>
        <input type="range" min="15" max="60" step="1"
          value={store.fullTimeRate}
          oninput={(e) => store.fullTimeRate = n(e)} />
      </div>

      <div class="bs-field">
        <div class="bs-field-top">
          <span>Part-time staff</span>
          <span class="bs-field-val">{store.partTimeStaff} × ${store.partTimeRate}/hr</span>
        </div>
        <input type="range" min="0" max="15" step="1"
          value={store.partTimeStaff}
          oninput={(e) => store.partTimeStaff = n(e)} />
      </div>

      <div class="bs-field">
        <div class="bs-field-top">
          <span>PT hourly rate</span>
          <span class="bs-field-val">${store.partTimeRate}/hr</span>
        </div>
        <input type="range" min="12" max="50" step="1"
          value={store.partTimeRate}
          oninput={(e) => store.partTimeRate = n(e)} />
      </div>
    </div>

    <!-- ── Financing ── -->
    <div class="bs-section">
      <div class="bs-section-label">Financing</div>

      <div class="bs-field">
        <div class="bs-field-top">
          <span>Loan Amount</span>
          <span class="bs-field-val">{fmt(store.loanAmount)}</span>
        </div>
        <input type="range" min="50000" max="750000" step="10000"
          value={store.loanAmount}
          oninput={(e) => store.loanAmount = n(e)} />
      </div>

      <div class="bs-field">
        <div class="bs-field-top">
          <span>Interest Rate</span>
          <span class="bs-field-val">{store.loanRate.toFixed(1)}%</span>
        </div>
        <input type="range" min="4" max="14" step="0.25"
          value={store.loanRate}
          oninput={(e) => store.loanRate = n(e)} />
      </div>

      <div class="bs-field">
        <div class="bs-field-top">
          <span>Loan Term</span>
          <span class="bs-field-val">{store.loanTermYears} years</span>
        </div>
        <input type="range" min="5" max="25" step="5"
          value={store.loanTermYears}
          oninput={(e) => store.loanTermYears = n(e)} />
      </div>
    </div>
  {/if}

  <!-- ── Live P&L Summary (always visible) ── -->
  <div class="bs-pnl">
    <!-- BC5: Friendly P&L — no jargon, no minus signs -->
    <div class="bs-section-label">Your Monthly Picture</div>

    <div class="bs-pnl-row">
      <span>You bring in</span>
      <span class="bs-pnl-pos">{fmt(store.monthlyRevenue)}</span>
    </div>
    <div class="bs-pnl-row indent">
      <span>Ingredients & supplies</span>
      <span>{fmt(store.monthlyCOGS)}</span>
    </div>
    <div class="bs-pnl-row indent">
      <span>Your team</span>
      <span>{fmt(store.monthlyLabor)}</span>
    </div>
    <div class="bs-pnl-row indent">
      <span>Rent</span>
      <span>{fmt(store.monthlyRent)}</span>
    </div>
    <div class="bs-pnl-row indent">
      <span>Everything else</span>
      <span>{fmt(store.monthlyOpEx)}</span>
    </div>
    <div class="bs-pnl-divider"></div>

    <div class="bs-pnl-row total">
      <span>You keep</span>
      <span class={netMonthly >= 0 ? 'bs-pnl-pos' : 'bs-pnl-neg'}>{fmt(netMonthly)}</span>
    </div>

    {#if store.locationIQ > 0}
      <div class="bs-pnl-divider"></div>
      <div class="bs-pnl-row" style="margin-top:4px">
        <span style="font-size:11px;color:#9ca3af">Score</span>
        <span style="font-weight:700;color:#1e3a2a">{Math.round(store.locationIQ)}</span>
      </div>
    {/if}
  </div>

  {#if !editMode && store.analysisAddress}
    <div class="bs-ctx-row">
      <span class="bs-ctx-label">Location</span>
      <span class="bs-ctx-val">{store.analysisAddress.split(',')[0]}</span>
    </div>
  {/if}
</aside>

<style>
  .bc-sidebar {
    width: 272px;
    flex-shrink: 0;
    background: #fff;
    border-right: 1px solid #e5e7eb;
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .bs-header {
    background: #1e3a2a;
    color: #fff;
    padding: 16px 18px 14px;
    flex-shrink: 0;
  }

  .bs-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.6;
    margin-bottom: 3px;
  }

  .bs-concept {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 17px;
    font-weight: 600;
    line-height: 1.2;
  }

  .bs-addr {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    opacity: 0.55;
    margin-top: 3px;
  }

  .bs-section {
    padding: 12px 14px 8px;
    border-bottom: 1px solid #f3f4f6;
  }

  .bs-section-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #9ca3af;
    margin-bottom: 10px;
  }

  .bs-field {
    margin-bottom: 11px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .bs-field-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .bs-field-top span:first-child {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #374151;
  }

  .bs-field-val {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: #1e3a2a;
  }

  /* UX-EF: small italic hint next to a field value (e.g. "concept default") */
  .bs-field-val-sub {
    font-weight: 400;
    font-style: italic;
    color: #9ca3af;
    margin-left: 4px;
  }

  input[type="range"] {
    width: 100%;
    accent-color: #1e3a2a;
    height: 3px;
    cursor: pointer;
  }

  .bs-num-full {
    width: 100%;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 5px;
    padding: 4px 7px;
    color: #111827;
    margin-top: 3px;
    box-sizing: border-box;
  }

  .bs-num-full:disabled {
    background: #f9fafb;
    color: #9ca3af;
    cursor: not-allowed;
  }

  /* ── Lease Terms disclosure (UX-EF) ── */
  .bs-lt-hint {
    font-size: 10px;
    color: #9ca3af;
    margin-left: 3px;
    cursor: help;
  }

  .bs-lt-disclosure {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #fafaf9;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 8px 10px;
    margin-top: 8px;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #374151;
    text-align: left;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .bs-lt-disclosure:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
  }

  .bs-lt-disclosure:focus-visible {
    outline: 2px solid #1e3a2a;
    outline-offset: 2px;
  }

  .bs-lt-disclosure.is-open {
    background: #f1f5f2;
    border-color: #c7d4ca;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .bs-lt-disclosure-label {
    font-weight: 500;
  }

  .bs-lt-disclosure-chev {
    display: inline-block;
    font-size: 13px;
    color: #6b7280;
    transition: transform 0.2s ease;
  }

  .bs-lt-disclosure.is-open .bs-lt-disclosure-chev {
    transform: rotate(90deg);
    color: #1e3a2a;
  }

  .bs-lt-pct-panel {
    border: 1px solid #c7d4ca;
    border-top: none;
    border-radius: 0 0 6px 6px;
    padding: 10px 10px 4px;
    background: #fafaf9;
    margin-top: -1px;
    margin-bottom: 4px;
  }

  .bs-lt-teach {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    line-height: 1.45;
    color: #6b7280;
    margin: 0 0 10px;
  }

  /* ── UX-EF: Lease validation banners ── */
  .bs-lease-banner {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 12px;
    margin: 10px 0 0;
    border-radius: 6px;
    border: 1px solid;
    font-family: 'DM Sans', sans-serif;
  }
  .bs-lease-banner--warn {
    background: #fffbeb;
    border-color: #fde68a;
    color: #78350f;
  }
  .bs-lease-banner--flag {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #7f1d1d;
  }
  .bs-lease-banner--block {
    background: #7f1d1d;
    border-color: #991b1b;
    color: #fff;
  }
  .bs-lease-banner-icon {
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
    padding-top: 2px;
  }
  .bs-lease-banner-body {
    flex: 1;
    min-width: 0;
  }
  .bs-lease-banner-title {
    font-weight: 600;
    font-size: 12px;
    margin: 0 0 3px;
    letter-spacing: 0.01em;
  }
  .bs-lease-banner-copy {
    font-size: 11px;
    line-height: 1.45;
    opacity: 0.95;
  }

  /* P&L Summary */
  .bs-pnl {
    padding: 12px 14px 12px;
    border-bottom: 1px solid #f3f4f6;
    background: #fafaf9;
  }

  .bs-pnl-row {
    display: flex;
    justify-content: space-between;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #4b5563;
    padding: 2px 0;
  }

  .bs-pnl-row.indent {
    padding-left: 10px;
    font-size: 11px;
    color: #9ca3af;
  }

  .bs-pnl-row.total {
    font-weight: 700;
    font-size: 13px;
    color: #111827;
    padding-top: 4px;
  }

  .bs-pnl-pos { color: #166534; font-weight: 600; }
  .bs-pnl-neg { color: #dc2626; font-weight: 600; }

  .bs-pnl-divider {
    height: 1px;
    background: #e5e7eb;
    margin: 5px 0;
  }

  /* Context rows */
  .bs-ctx-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 14px;
  }

  .bs-ctx-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #9ca3af;
  }

  .bs-ctx-val {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #374151;
    font-weight: 500;
  }
</style>
