<script lang="ts">
  import { onMount } from 'svelte';
  import PageNav from '$lib/components/PageNav.svelte';
  import { createBusinessCaseStore } from '$lib/stores/business-case-store.svelte';
  import BusinessCaseSidebar from '$lib/components/business-case/BusinessCaseSidebar.svelte';
  import SnapshotTab from '$lib/components/business-case/SnapshotTab.svelte';
  import StressTestTab from '$lib/components/business-case/StressTestTab.svelte';
  import FullPictureTab from '$lib/components/business-case/FullPictureTab.svelte';
  import CoPilotChat from '$lib/components/CoPilotChat.svelte';
  import type { FinancialModel } from '$lib/stores/business-case-store.svelte';
  import { apiFetch } from '$lib/api';
  import { fitTierLabel, fitGrade, fitMeaningShort } from '$lib/utils/decision-engine';

  let { data } = $props();

  // ─── Store ─────────────────────────────────────────────────────────────────
  const store = createBusinessCaseStore();

  // ─── UI state ──────────────────────────────────────────────────────────────
  let activeTab = $state<'snapshot' | 'stress' | 'full'>('snapshot');
  // enrichedModel: set only when "Run with Location Signals" is clicked.
  // Falls back to store.model (live $derived) so tabs always show real numbers.
  let enrichedModel = $state<FinancialModel | null>(null);
  let isModelLoading = $state(false);
  let modelError = $state('');
  let enriched = $state(false);  // true once server model has been fetched

  // ─── Tab config ────────────────────────────────────────────────────────────
  // BC10: Renamed tabs to match what founders actually ask
  const tabs = [
    { id: 'snapshot', label: 'Can I Afford This?' },
    { id: 'stress',   label: 'Will I Make Money?' },
    { id: 'full',     label: 'What Does the Bank Need?' },
  ] as const;

  // ─── Init ──────────────────────────────────────────────────────────────────
  // Derived from store so it stays in sync after initFromSession() populates data.
  // No separate localStorage read — store.initFromSession() is the single source of truth.
  const hasSession = $derived(store.locationIQ > 0 || store.analysisAddress.length > 0);

  onMount(() => {
    store.initFromSession();
  });

  // ─── Active model: enriched (server, includes location signals) OR live store ──
  // Tabs always get a non-null FinancialModel; no stub estimates needed.
  const activeModel = $derived(enrichedModel ?? store.model);

  // ─── Enrich with location signals (server call) ──────────────────────────
  // Sends transit/vibrancy/credit/sqft context that the client store doesn't have.
  async function runWithLocationSignals() {
    isModelLoading = true;
    modelError = '';
    try {
      let sess: Record<string, any> = {};
      let lp: Record<string, any> = {};
      try {
        sess = JSON.parse(localStorage.getItem('re2_session')   || '{}');
        lp   = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
      } catch {}

      const res = await apiFetch('/api/business-case-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyCustomers:  store.dailyCustomers,
          avgTicket:       store.avgTicket,
          cogsPercent:     store.cogsPercent,
          fullTimeStaff:   store.fullTimeStaff,
          fullTimeRate:    store.fullTimeRate,
          partTimeStaff:   store.partTimeStaff,
          partTimeRate:    store.partTimeRate,
          monthlyRent:     store.monthlyRent,
          monthlyOpEx:     store.monthlyOpEx,
          daysPerWeek:     store.daysPerWeek,
          loanRate:        store.loanRate,
          loanTermYears:   store.loanTermYears,
          loanAmount:      store.loanAmount,
          conceptKey:      store.conceptKey,
          // Location-context enrichment
          transitScore:        sess.sixScores?.transit   ?? 0,
          vibrancyScore:       sess.sixScores?.vibrancy  ?? 0,
          creditScore:         lp.creditScore || lp.financialGoals?.creditScore || 'good',
          squareFootage:       lp.squareFootage || lp.financialGoals?.squareFootage || 1000,
          personalInvestment:  lp.financialGoals?.personalInvestment || lp.personalInvestment || 50000,
          startupCapital:      lp.budget || lp.financialGoals?.startupCapital || 200000,
          hasPersonalGuarantee: lp.financialGoals?.hasPersonalGuarantee ?? true,
        }),
      });
      if (!res.ok) throw new Error(`Model API error (${res.status})`);
      enrichedModel = await res.json();
      enriched = true;
    } catch (e: any) {
      modelError = e.message ?? 'Failed to enrich model';
    } finally {
      isModelLoading = false;
    }
  }

  const editModeTab = $derived(activeTab === 'snapshot');

  // BC8: Sidebar collapse state — collapsed by default, open on Tab 1 (Snapshot)
  let sidebarOpen = $state(false);

  // RULE 1: Concept-specific occupancy cost ceilings (from 25 Vital Rules)
  // Total occupancy cost = rent as % of revenue. Concept-specific thresholds.
  const OCCUPANCY_CEILINGS: Record<string, number> = {
    full_service_restaurant: 0.10,  restaurant: 0.10,
    qsr: 0.08,  fast_casual: 0.08,  quick_service: 0.08,
    grocery: 0.05,
    retail: 0.15,  florist: 0.15,
    fitness: 0.25,  fitness_studio: 0.25,
    specialty_coffee: 0.12,  coffee_shop: 0.12,  cafe: 0.12,
    personal_services: 0.14,  spa_wellness: 0.14,  barbershop: 0.14,
    bar_nightlife: 0.12,  bar: 0.12,
    coworking: 0.15,
    medical_dental: 0.12,
  };
  const occupancyCeiling = $derived(OCCUPANCY_CEILINGS[store.conceptKey] ?? 0.15);

  // BC3: Verdict banner — green/amber/red based on net monthly + rent ratio + break-even
  // BR-UX-09: Banner now leads with "Grade X · Tier — meaning" pulled from decision-engine,
  // so it stays in lock-step with the Location Score hero vocabulary. The P&L-driven
  // detail sentence lives in `numbers` and follows after a dash.
  const verdictState = $derived.by(() => {
    const net = store.monthlyRevenue - store.monthlyTotal;
    const rentPct = store.monthlyRevenue > 0 ? (store.monthlyRent / store.monthlyRevenue) : 0;
    const bem = activeModel?.breakEvenMonth ?? store.breakEvenMonth ?? 0;
    const ceilingPct = Math.round(occupancyCeiling * 100);
    const fit = Math.round(store.fitIQ ?? 0);
    const grade = fit > 0 ? fitGrade(fit) : '';
    const tier = fit > 0 ? fitTierLabel(fit) : '';
    const meaning = fit > 0 ? fitMeaningShort(fit) : '';
    // label lead-in: "Grade B · Viable — This works. Sharpen..." when we have a fit score
    const gradeLead = fit > 0 ? `Grade ${grade} · ${tier} — ${meaning}` : '';
    // RULE 1: NONVIABLE — rent exceeds ceiling by >50%
    if (rentPct > occupancyCeiling * 1.5 && store.monthlyRevenue > 0) return { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', label: 'Rent is too high for this concept.', detail: `Your rent is ${Math.round(rentPct * 100)}% of revenue — the ceiling for this business type is ${ceilingPct}%. Consider a cheaper space or higher revenue.`, grade, tier, meaning, gradeLead };
    if (net <= 0 || bem > 12) return { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', label: 'Your numbers need work.', detail: 'Adjust your inputs until the monthly profit goes positive.', grade, tier, meaning, gradeLead };
    // RULE 1: HIGH_RENT_RISK — rent exceeds ceiling
    if (rentPct > occupancyCeiling) return { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Rent is eating your margin.', detail: `Rent is ${Math.round(rentPct * 100)}% of revenue (${ceilingPct}% ceiling for this type). Plan for a ${bem}-month ramp.`, grade, tier, meaning, gradeLead };
    if (bem > 9) return { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Your numbers are tight.', detail: `Plan for a ${bem}-month ramp. Rent is ${Math.round(rentPct * 100)}% of revenue (under the ${ceilingPct}% ceiling).`, grade, tier, meaning, gradeLead };
    return { color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', label: 'Your numbers work.', detail: `Break-even by Month ${bem} with $${Math.round(net).toLocaleString()}/mo profit. Rent is ${Math.round(rentPct * 100)}% of revenue (${ceilingPct}% ceiling).`, grade, tier, meaning, gradeLead };
  });

  function fmtScore(n: number): string {
    return n > 0 ? String(Math.round(n)) : '–';
  }

  // ─── Co-Pilot sidebar ──────────────────────────────────────────────────────
  let copilotOpen = $state(false);
  let strategyInitialMessage = $state('');

  async function handleCopilotStrategy(strategy: 'negotiate_rent' | 'increase_revenue' | 'rent_benchmarks') {
    copilotOpen = true;
    strategyInitialMessage = 'Loading…';

    // Source geoid + sqft from localStorage. The business-case store doesn't
    // expose either (it only holds the P&L inputs). The prior code read
    // store?.geoid and store?.sqft which were always undefined — strategy
    // requests silently 400'd with empty strings.
    let geoid = '';
    let sqft = 0;
    let businessTypeFromLp = '';
    if (typeof localStorage !== 'undefined') {
      try {
        const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
        const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
        geoid = sess.geoid || '';
        sqft = lp.squareFootage || lp.financialGoals?.squareFootage || 0;
        businessTypeFromLp = lp.businessType || sess.bizType || sess.visionBizType || '';
      } catch {}
    }
    if (!geoid) {
      strategyInitialMessage = 'Run a location analysis first so I can tailor the strategy to your market.';
      return;
    }

    try {
      const res = await apiFetch('/api/copilot/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'strategy_playbook',
          strategy,
          geoid,
          page: 'business-plan',
          launchpad: {
            businessType: store.conceptKey || businessTypeFromLp || '',
            avgTicket: store.avgTicket || 0,
            dailyCustomers: store.dailyCustomers || 0,
            daysPerWeek: store.daysPerWeek || 6,
            monthlyRent: store.monthlyRent || 0,
            sqft,
          },
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({} as any));
        console.error('[RentPlay] Strategy request failed', res.status, errBody);
        strategyInitialMessage = `Strategy couldn't load (${res.status}). ${errBody?.error || 'Try again in a moment.'}`;
        return;
      }
      const data = await res.json();
      strategyInitialMessage = data.message || 'Strategy unavailable for this scenario.';
    } catch (err) {
      console.error('[RentPlay] Strategy fetch failed:', err);
      strategyInitialMessage = 'Connection issue — strategy couldn\'t load. Please try again.';
    }
  }

  // Build initial greeting messages from current store state
  const copilotInitialMessages = $derived((() => {
    const msgs: Array<{ role: 'bot'; text: string }> = [];
    if (store.conceptLabel && store.analysisAddress) {
      msgs.push({ role: 'bot', text: `I'm looking at the numbers for your **${store.conceptLabel}** at **${store.analysisAddress}**.` });
    } else if (store.conceptLabel) {
      msgs.push({ role: 'bot', text: `I'm ready to help with your **${store.conceptLabel}** business case.` });
    } else {
      msgs.push({ role: 'bot', text: 'Run a location analysis first, then I can help with your numbers.' });
    }
    const net = store.monthlyRevenue - store.monthlyTotal;
    if (store.dailyCustomers > 0) {
      if (net > 0) {
        msgs.push({ role: 'bot', text: `You're projecting **$${Math.round(net).toLocaleString()}/mo profit**. Want me to stress-test those numbers?` });
      } else if (net < 0) {
        msgs.push({ role: 'bot', text: `Right now you're showing a **$${Math.abs(Math.round(net)).toLocaleString()}/mo gap**. Let's figure out how to close it.` });
      }
    }
    return msgs;
  })());

  const copilotSuggestedPrompts = $derived((() => {
    const prompts: string[] = [];
    const net = store.monthlyRevenue - store.monthlyTotal;
    if (net < 0) {
      prompts.push('How do I get to break-even?');
      prompts.push('What if I cut rent by 20%?');
    } else {
      prompts.push('Is my rent too high?');
      prompts.push('What if I raise prices 15%?');
    }
    prompts.push('How many customers do I really need?');
    return prompts;
  })());

  async function handleBizCoPilotMessage(text: string): Promise<string> {
    if (!store.conceptKey) return 'Set up your business concept first so I can answer questions.';

    let sess: Record<string, any> = {};
    let lp: Record<string, any> = {};
    try {
      sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
      lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
    } catch {}

    const geoid = sess.geoid || '';

    // Detect what-if vs general question
    const isWhatIf = /what if|what would|if i|suppose|scenario|change|increase|decrease|lower|raise|cut/i.test(text);

    try {
      const res = await apiFetch('/api/copilot/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geoid,
          page: 'business-plan',
          question: text,
          action: isWhatIf ? 'what_if' : 'ask_question',
          financialData: {
            revenue: store.monthlyRevenue,
            expenses: store.monthlyTotal,
            breakEven: activeModel?.breakEvenMonth ?? store.breakEvenMonth ?? 0,
            rent: store.monthlyRent,
            avgTransaction: store.avgTicket,
            dailyCustomers: store.dailyCustomers,
            staffCount: (store.fullTimeStaff || 0) + (store.partTimeStaff || 0),
            staffCost: ((store.fullTimeStaff || 0) * (store.fullTimeRate || 0) + (store.partTimeStaff || 0) * (store.partTimeRate || 0)) * 160,
            cogs: store.cogsPercent,
            margin: 1 - (store.cogsPercent || 0.30),
            monthlyFixedCosts: store.monthlyOpEx,
          },
          launchpad: {
            businessType: store.conceptKey || lp.businessType || 'specialty_coffee',
            budget: lp.budget || '',
            rent: String(store.monthlyRent || lp.rent || ''),
            ownerType: lp.ownerType || '',
            hours: lp.hours || '',
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        return err.error || 'Something went wrong. Try again.';
      }

      const data = await res.json();
      return data.message || 'No response from copilot.';
    } catch (e: any) {
      console.error('[BizCoPilot] Error:', e);
      return 'Connection error — please try again.';
    }
  }
</script>

<svelte:head>
  <title>Business Case — RE²</title>
</svelte:head>

<div class="bc-page">
  <PageNav
    backHref="/app/location"
    backLabel="Your Score"
    nextHref="/app/dashboard"
    nextLabel="Dashboard"
  />

  <!-- ── No-session banner ───────────────────────────────────────────────── -->
  {#if !hasSession}
    <div class="bc-no-session">
      <span>You haven't run a location analysis yet.</span>
      <a href="/app/location" class="bc-no-session-btn">→ Analyze a location first</a>
    </div>
  {/if}

  <!-- ── Hero Header ─────────────────────────────────────────────────────── -->
  <header class="bc-hero">
    <div class="bc-hero-inner">
      <div class="bc-hero-left">
        <div class="bc-eyebrow">Business Case</div>
        <h1 class="bc-headline">{store.conceptLabel}</h1>
        {#if store.analysisAddress}
          <div class="bc-address-row">
            <span class="bc-address">{store.analysisAddress}</span>
            <a
              href="/app/location?addr={encodeURIComponent(store.analysisAddress)}"
              class="bc-loc-link"
            >View your score →</a>
          </div>
        {/if}
      </div>

      {#if store.fitIQ > 0}
        {@const _bcFit = Math.round(store.fitIQ)}
        {@const _bcGrade = fitGrade(_bcFit)}
        {@const _bcTier = fitTierLabel(_bcFit)}
        <div class="bc-scores-wrap">
          <div class="bc-scores">
            <div class="bc-score-chip">
              <span class="bcs-num">{fmtScore(store.fitIQ)}</span>
              <span class="bcs-label">Your Score</span>
              <span class="bcs-grade">Grade {_bcGrade}</span>
            </div>
          </div>
          <div class="bc-scores-ctx">{_bcTier} — {_bcFit}/100 from your location analysis</div>
        </div>
      {/if}
    </div>
  </header>

  <!-- BC3: Verdict banner -->
  <!-- BR-UX-09: Leads with "Grade X · Tier — meaning" (from decision-engine), then the
       P&L-specific label + detail. Keeps this surface in lock-step with Location Score. -->
  {#if hasSession && store.dailyCustomers > 0}
    <div class="bc-verdict" style="background:{verdictState.bg}; border-color:{verdictState.border}">
      <span class="bc-verdict-icon" style="color:{verdictState.color}">{verdictState.color === '#166534' ? '✓' : verdictState.color === '#d97706' ? '⚠' : '✗'}</span>
      <div class="bc-verdict-text">
        {#if verdictState.gradeLead}
          <span class="bc-verdict-gradelead">{verdictState.gradeLead}</span>
        {/if}
        <span class="bc-verdict-label" style="color:{verdictState.color}">{verdictState.label}</span>
        <span class="bc-verdict-detail">{verdictState.detail}</span>
      </div>
    </div>
  {/if}

  <!-- ── Main layout: Sidebar + Content ─────────────────────────────────── -->
  <div class="bc-layout">
    <!-- BC8: Collapsible sidebar with toggle -->
    <div class="bc-sidebar-wrap" class:collapsed={!sidebarOpen}>
      <button class="bc-sidebar-toggle" onclick={() => sidebarOpen = !sidebarOpen}>
        {#if sidebarOpen}<span class="toggle-close">✕</span>{:else}<span class="toggle-icon">⚙</span> Adjust Numbers{/if}
      </button>
      {#if sidebarOpen}
        <BusinessCaseSidebar {store} editMode={editModeTab} />
      {/if}
    </div>

    <!-- Content pane -->
    <div class="bc-content">

      <!-- Tab bar -->
      <nav class="bc-tabs">
        {#each tabs as tab}
          <button
            class="bc-tab"
            class:bc-tab--active={activeTab === tab.id}
            onclick={() => activeTab = tab.id}
          >
            {tab.label}
          </button>
        {/each}

        <div class="bc-tab-spacer"></div>
        {#if hasSession}
          <button
            class="bc-run-btn"
            class:bc-run-btn--done={enriched}
            onclick={runWithLocationSignals}
            disabled={isModelLoading}
            title="Re-runs the model using your location's transit + vibrancy signals"
          >
            {#if isModelLoading}
              Calculating…
            {:else if enriched}
              ✓ Location data applied
            {:else}
              Use my location data
            {/if}
          </button>
        {/if}
      </nav>

      {#if modelError}
        <div class="bc-error-banner">{modelError}</div>
      {/if}

      <!-- Tab body -->
      <div class="bc-tab-body">
        {#if activeTab === 'snapshot'}
          <SnapshotTab onCopilotStrategy={handleCopilotStrategy} {store} model={activeModel} isLoading={isModelLoading} />
        {:else if activeTab === 'stress'}
          <StressTestTab {store} model={activeModel} isLoading={isModelLoading} />
        {:else if activeTab === 'full'}
          <FullPictureTab {store} model={activeModel} isLoading={isModelLoading} />
        {/if}
      </div>
    </div>

    <!-- ═══ RIGHT SIDEBAR: BUSINESS CO-PILOT ═══ -->
    <div class="bc-copilot-wrap" class:collapsed={!copilotOpen}>
      <button class="bc-copilot-toggle" onclick={() => copilotOpen = !copilotOpen} title={copilotOpen ? 'Hide Co-Pilot' : 'Ask Co-Pilot'}>
        {#if copilotOpen}<span class="toggle-close">✕</span>{:else}<span class="toggle-sparkle">✨</span><span class="toggle-label">Ask RE²D2</span>{/if}
      </button>
      {#if copilotOpen}
        <CoPilotChat
          title="Business Co-Pilot"
          subtitle="Ask about your numbers"
          initialMessages={copilotInitialMessages}
          suggestedPrompts={copilotSuggestedPrompts}
          onSendMessage={handleBizCoPilotMessage}
          accentColor="#4a7c5c"
        />
      {/if}
    </div>
  </div>
</div>

<style>
  /* ═══ V3 Design Tokens ═══ */
  :global(body) {
    background: #faf7f2;
  }

  .bc-page {
    --sage: #4a7c5c;
    --deep-green: #1a3a2a;
    --bg: #faf7f2;
    --surface: #ffffff;
    --border: #e8e2d8;
    --text-primary: #1a3a2a;
    --text-secondary: #666;
    --text-muted: #999;
    --radius: 10px;

    min-height: 100vh;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--text-primary);
  }

  /* ═══ No-session banner ═══ */
  .bc-no-session {
    background: #fffbeb;
    border-bottom: 1px solid #fde68a;
    padding: 10px 32px;
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 13px;
    color: #92400e;
  }
  .bc-no-session-btn {
    background: #92400e;
    color: #fff;
    border-radius: 20px;
    padding: 6px 16px;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    transition: opacity 0.2s;
  }
  .bc-no-session-btn:hover { opacity: 0.85; }

  /* ═══ Hero — V3 gradient ═══ */
  .bc-hero {
    background: linear-gradient(135deg, #1a3a2a 0%, #2d5a3e 50%, #4a7c5c 100%);
    color: #fff;
  }
  .bc-hero-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 28px 32px 24px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 24px;
    flex-wrap: wrap;
  }
  .bc-eyebrow {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: rgba(255,255,255,0.55);
    margin-bottom: 6px;
  }
  .bc-headline {
    font-family: 'DM Serif Display', serif;
    font-size: 26px;
    font-weight: 700;
    margin: 0 0 6px;
    line-height: 1.15;
  }
  .bc-address-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 2px;
  }
  .bc-address {
    font-size: 13px;
    opacity: 0.65;
  }
  .bc-loc-link {
    font-size: 11px;
    font-weight: 600;
    color: white;
    text-decoration: none;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 20px;
    padding: 4px 14px;
    white-space: nowrap;
    transition: all 0.2s;
  }
  .bc-loc-link:hover {
    background: rgba(255,255,255,0.2);
    border-color: rgba(255,255,255,0.45);
  }

  /* Score chips — V3 stat block style */
  .bc-scores-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }
  .bc-scores {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  .bc-scores-ctx {
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    text-align: right;
  }
  .bc-score-chip {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 64px;
  }
  .bcs-num {
    font-family: 'DM Serif Display', serif;
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
    color: white;
  }
  .bcs-label {
    font-size: 10px;
    color: rgba(255,255,255,0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .bcs-grade {
    display: inline-block;
    margin-top: 4px;
    background: white;
    color: #1a3a2a;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
    letter-spacing: 0.3px;
  }

  /* ═══ Verdict banner — card treatment ═══ */
  .bc-verdict {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 32px;
    border-bottom: 1px solid;
    border-left: 4px solid;
    margin: 0;
    font-family: 'DM Sans', sans-serif;
  }
  .bc-verdict-icon {
    font-size: 18px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .bc-verdict-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .bc-verdict-gradelead {
    font-size: 13px;
    font-weight: 600;
    color: #111827;
    letter-spacing: 0.1px;
    margin-bottom: 2px;
  }
  .bc-verdict-label {
    font-size: 15px;
    font-weight: 700;
  }
  .bc-verdict-detail {
    font-size: 13px;
    color: #4b5563;
    line-height: 1.5;
  }

  /* ═══ Layout ═══ */
  .bc-layout {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  /* ═══ Sidebar — warm toggle ═══ */
  .bc-sidebar-wrap {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    background: var(--surface);
  }
  .bc-sidebar-wrap.collapsed { width: auto; }

  .bc-sidebar-toggle {
    font-size: 12px;
    font-weight: 600;
    color: var(--deep-green);
    background: #f0faf4;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: 10px 16px;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .bc-sidebar-toggle:hover { background: #dcfce7; }
  .bc-sidebar-toggle .toggle-icon { font-size: 13px; }
  .bc-sidebar-toggle .toggle-close { font-size: 14px; }

  /* ═══ Content ═══ */
  .bc-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  }

  /* ═══ Tab bar — V3 style ═══ */
  .bc-tabs {
    display: flex;
    align-items: center;
    gap: 0;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    padding: 0 28px;
    flex-shrink: 0;
  }
  .bc-tab {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 14px 0;
    margin-right: 28px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
  }
  .bc-tab:hover { color: var(--text-primary); }
  .bc-tab--active {
    color: var(--text-primary);
    font-weight: 600;
    border-bottom-color: var(--sage);
  }
  .bc-tab-spacer { flex: 1; }

  /* Run button — V3 pill */
  .bc-run-btn {
    font-size: 12px;
    font-weight: 600;
    background: var(--sage);
    color: #fff;
    border: none;
    border-radius: 20px;
    padding: 7px 18px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
  }
  .bc-run-btn:hover:not(:disabled) { background: #3d6b4e; }
  .bc-run-btn:disabled { opacity: 0.4; cursor: default; }
  .bc-run-btn--done {
    background: #166534;
  }

  /* Error banner */
  .bc-error-banner {
    background: #fef2f2;
    border-bottom: 1px solid #fca5a5;
    padding: 8px 28px;
    font-size: 12px;
    color: #991b1b;
    flex-shrink: 0;
  }

  /* Tab body */
  .bc-tab-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 28px 48px;
    background: var(--surface);
  }

  /* ═══ Co-Pilot sidebar — V3 sparkle toggle ═══ */
  .bc-copilot-wrap {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: 340px;
    border-left: 1px solid var(--border);
    background: var(--surface);
    position: relative;
    transition: width 0.2s ease;
  }
  .bc-copilot-wrap.collapsed { width: 0; overflow: hidden; }

  .bc-copilot-toggle {
    position: absolute;
    left: -1px;
    top: 12px;
    transform: translateX(-100%);
    height: 36px;
    border-radius: 20px 0 0 20px;
    background: var(--deep-green);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.1);
    border-right: none;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 12px 0 10px;
    z-index: 2;
    transition: all 0.2s;
    white-space: nowrap;
    overflow: hidden;
    max-width: 36px;
  }
  .bc-copilot-toggle:hover {
    background: #2d5a3e;
    max-width: 160px;
  }
  .bc-copilot-toggle .toggle-sparkle { font-size: 14px; flex-shrink: 0; }
  .bc-copilot-toggle .toggle-label {
    font-size: 11px;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .bc-copilot-toggle:hover .toggle-label { opacity: 1; }
  .bc-copilot-toggle .toggle-close {
    font-size: 14px;
    width: 100%;
    text-align: center;
  }

  .bc-copilot-wrap :global(.copilot-chat) {
    border-radius: 0;
    box-shadow: none;
    min-height: 100%;
    max-height: none;
    height: 100%;
  }
  .bc-copilot-wrap :global(.copilot-header) {
    border-radius: 0;
  }

  /* ═══ Responsive ═══ */
  @media (max-width: 900px) {
    .bc-hero-inner {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }
    .bc-scores-wrap { align-items: flex-start; }
    .bc-scores-ctx { text-align: left; }
  }

  @media (max-width: 768px) {
    .bc-layout {
      flex-direction: column;
      height: auto;
    }
    .bc-hero-inner { padding: 20px 16px 18px; }
    .bc-headline { font-size: 22px; }
    .bc-tabs { padding: 0 16px; }
    .bc-tab { margin-right: 18px; }
    .bc-tab-body { padding: 16px 16px 40px; }
    .bc-verdict { padding: 12px 16px; }
    .bc-copilot-wrap { display: none; }
    .bc-copilot-toggle { display: none; }
    .bc-sidebar-wrap.collapsed { display: none; }
  }
</style>
