<script lang="ts">
  import { onMount } from 'svelte';
  import PageNav from '$lib/components/PageNav.svelte';
  import NavigationDrawer from '$lib/components/NavigationDrawer.svelte';
  import ChecklistProgress from '$lib/components/checklist/ChecklistProgress.svelte';
  import ChecklistFilters from '$lib/components/checklist/ChecklistFilters.svelte';
  import ChecklistPhase from '$lib/components/checklist/ChecklistPhase.svelte';
  import ChecklistCostSummary from '$lib/components/checklist/ChecklistCostSummary.svelte';
  import CoPilotChat from '$lib/components/CoPilotChat.svelte';
  import { sanitizeCopilotText } from '$lib/utils/copilot-sanitize';
  import { PHASES, ALL_ITEMS, getItemsForConcept } from '$lib/data/checklist-data';
  import type { ItemState } from '$lib/data/checklist-data';

  // ─── State ──────────────────────────────────────────────────────────────────
  let items  = $state<ItemState[]>([]);
  let filter = $state('now');  // CL2: Default to "Do Now" (This Week), not "All"

  // Session context (from localStorage — same as other /app/* pages)
  let locationName  = $state('');
  let conceptLabel  = $state('Specialty Coffee');
  let hasSession    = $state(false);
  let firstName     = $state('');

  // ─── Derived ────────────────────────────────────────────────────────────────
  const filteredItems = $derived(
    filter === 'all'  ? items :
    filter === 'done' ? items.filter(i => i.done) :
    filter === 'todo' ? items.filter(i => !i.done) :
    items.filter(i => i.priority === filter)
  );

  // ─── Init ───────────────────────────────────────────────────────────────────
  onMount(() => {
    // 1. Build item list from template, filtered by concept
    const conceptKey = (() => {
      try {
        const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
        return lp.conceptType || 'specialty_coffee';
      } catch { return 'specialty_coffee'; }
    })();
    let initial: ItemState[] = getItemsForConcept(conceptKey).map(item => ({ ...item, done: false, notes: '' }));

    // 2. Restore done/notes from localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('re2_checklist') || 'null');
      if (saved?.items) {
        initial = initial.map(item => {
          const s = saved.items.find((si: { id: string }) => si.id === item.id);
          return s ? { ...item, done: Boolean(s.done), notes: s.notes || '' } : item;
        });
      }
    } catch {}

    items = initial;

    // 3. Read session context (same keys as business-plan page)
    try {
      const sess = JSON.parse(localStorage.getItem('re2_session')   || '{}');
      const lp   = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
      locationName = sess.analyzedAddress || sess.address || '';
      conceptLabel = sess.conceptLabel || lp.conceptLabel || 'Specialty Coffee';
      hasSession   = locationName.length > 0 || (sess.locationIQ ?? 0) > 0;
    } catch {}

    // 4. Load firstName from Clerk
    try {
      const cu = (window as any).Clerk?.user;
      if (cu?.firstName) firstName = cu.firstName;
      else if (cu?.fullName) firstName = cu.fullName.split(' ')[0];
    } catch {}

    // 5. Mark page visited (NavigationDrawer uses this for unlock state)
    localStorage.setItem('re2_checklist_visited', 'true');
  });

  // ─── Save ───────────────────────────────────────────────────────────────────
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function schedSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const payload = { items: items.map(i => ({ id: i.id, done: i.done, notes: i.notes })) };
      localStorage.setItem('re2_checklist', JSON.stringify(payload));

      // Sync to Supabase via Brain API (debounced 2s)
      const locationId = (() => {
        try {
          const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
          return sess.geoid || sess.analyzedAddress || '';
        } catch { return ''; }
      })();
      if (locationId) {
        fetch('/api/checklist-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationId,
            items: items.map(i => ({ itemId: i.id, done: i.done, notes: i.notes })),
          }),
        }).catch(() => {}); // Silent fail — localStorage is primary
      }
    }, 300);
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────
  let highlightId = $state('');

  function toggleDone(id: string) {
    const item = items.find(i => i.id === id);
    if (item) {
      item.done = !item.done;
      schedSave();
      // MF-02: Auto-highlight next unchecked "Do Now" item
      if (item.done) {
        const next = items.find(i => !i.done && i.priority === 'now' && i.id !== id);
        highlightId = next?.id ?? '';
        if (highlightId) setTimeout(() => { highlightId = ''; }, 2000);
      }
    }
  }

  function updateNotes(id: string, notes: string) {
    const item = items.find(i => i.id === id);
    if (item) { item.notes = notes; schedSave(); }
  }

  function setFilter(f: string) { filter = f; }

  // A6: Next Up card (first unchecked "Do Now" item)
  const nextItem = $derived.by(() => {
    const nowItems = items.filter(i => !i.done && i.priority === 'now');
    return nowItems.length > 0 ? nowItems[0] : null;
  });

  // PA-04: Quick Wins (free + <1 week, not done)
  const quickWins = $derived(items.filter(i => !i.done && i.costHigh === 0 && i.weeks < 1));

  // CL3: First incomplete phase (for default-open logic)
  const firstIncompletePhaseId = $derived.by(() => {
    for (const p of PHASES) {
      const pi = items.filter(i => i.phase === p.id);
      if (pi.length > 0 && !pi.every(i => i.done)) return p.id;
    }
    return '';
  });

  // ─── CoPilot ───────────────────────────────────────────────────────────────
  let copilotOpen = $state(true); // Default OPEN — this is the feature

  // Phase-aware greetings
  const phaseGreetings: Record<string, string> = {
    entity:    'I can help with entity formation, EINs, finding a lawyer, and what to watch out for in NYC commercial leases.',
    lease:     'I know NYC zoning, rent benchmarks, BID zones, and what to look for on site visits. Ask me anything about finding your space.',
    design:    'Buildout is where budgets get real. I can help with cost estimates, permit timelines, and TI allowances.',
    permits:   'I know the permit timelines, costs, and gotchas for every NYC agency. Tell me your business type and I\'ll map out your critical path.',
    finance:   'Financing and insurance can be confusing. I can walk you through what you actually need and how to budget.',
    ops:       'Operations setup is about systems, staff, and suppliers. I can help you prioritize before opening.',
    marketing: 'Pre-launch marketing is where excitement meets reality. I can help you plan a realistic strategy.',
    opening:   'Almost there! I can help with final inspections, CRT filing, insurance, and everything before opening day.',
  };

  // Phase-aware suggested prompts
  const phasePromptMap: Record<string, string[]> = {
    entity:    ['What kind of entity should I form?', 'How much does a CRE lawyer cost?', 'What is a personal guaranty?', 'Do I need an EIN first?'],
    lease:     ['How do I know if the rent is fair?', 'What is a good occupancy cost ratio?', 'What should I check on a site visit?', 'Is there a tax on commercial rent?'],
    design:    ['How much does buildout cost per SF?', 'What is a TI allowance?', 'Do I need an architect?', 'How long does a DOB permit take?'],
    permits:   ['What permits do I need to open?', 'How long for a health dept license?', 'What is a Certificate of Occupancy?', 'How do I get a liquor license?'],
    finance:   ['What insurance do I need?', 'How do SBA loans work?', 'What is my total occupancy cost?', 'How much reserve should I keep?'],
    ops:       ['What systems do I need before opening?', 'How do I find suppliers in NYC?', 'What staff do I need on day one?', 'How do I set up payroll?'],
    marketing: ['How do I market before opening?', 'Should I do a soft opening?', 'How much for pre-launch marketing?', 'What social strategy works locally?'],
    opening:   ['What final inspections do I need?', 'Do I need to file for CRT?', 'What is my first CRT deadline?', 'What ongoing compliance to track?'],
  };

  // Derive current phase from checklist progress
  function getCurrentPhase(): string {
    return firstIncompletePhaseId || 'entity';
  }

  const copilotInitialMessages = $derived((() => {
    const phase = getCurrentPhase();
    const msgs: Array<{ role: 'bot'; text: string }> = [];
    const greeting = phaseGreetings[phase] || phaseGreetings.entity;
    const bizLabel = conceptLabel || 'your business';

    msgs.push({ role: 'bot', text: `I'm your launch guide for **${bizLabel}** in NYC. ${greeting}` });

    const doneCount = items.filter(i => i.done).length;
    const totalCount = items.length;
    if (totalCount > 0 && doneCount > 0) {
      msgs.push({ role: 'bot', text: `You've completed **${doneCount} of ${totalCount}** tasks. Keep going!` });
    }

    return msgs;
  })());

  const copilotSuggestedPrompts = $derived((() => {
    const phase = getCurrentPhase();
    return (phasePromptMap[phase] || phasePromptMap.entity).slice(0, 4);
  })());

  async function handleChecklistCoPilot(text: string): Promise<string> {
    let lp: Record<string, any> = {};
    let sess: Record<string, any> = {};
    try {
      lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
      sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
    } catch {}

    try {
      const res = await fetch('/api/copilot/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask_question',
          question: text,
          context: {
            businessType: lp.businessType || lp.conceptType || 'specialty_coffee',
            businessSubType: lp.businessSubType || '',
            address: sess.analyzedAddress || sess.address || lp.lastAddress || '',
            borough: sess.borough || '',
            rentBudget: lp.financialGoals?.monthlyRentBudget || undefined,
            startupCapital: lp.financialGoals?.startupCapital || lp.budget || undefined,
            activePhase: getCurrentPhase(),
            activeTask: nextItem?.name || '',
            completedCount: items.filter(i => i.done).length,
            totalCount: items.length,
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
      console.error('[ChecklistCoPilot] Error:', e);
      return 'Connection error — please try again.';
    }
  }
</script>

<svelte:head>
  <title>Launch Checklist — RE²</title>
</svelte:head>

<div class="cl-page">
  <NavigationDrawer />

  <!-- No-session nudge -->
  {#if !hasSession && items.length > 0}
    <div class="cl-no-session">
      <span>You haven't analyzed a location yet.</span>
      <a href="/app/location" class="cl-no-session-btn">→ Analyze a location first</a>
    </div>
  {/if}

  <!-- Progress strip -->
  {#if items.length > 0}
    <ChecklistProgress {items} {locationName} {conceptLabel} />
    <!-- CL7: Sticky money tracker directly under progress -->
    <ChecklistCostSummary {items} />
  {/if}

  <!-- Filter chips -->
  <ChecklistFilters {items} activeFilter={filter} onFilterChange={setFilter} />

  <!-- A6: Next Up card (pinned above main list) -->
  {#if nextItem && items.length > 0}
    <div class="cl-next-up">
      <div class="next-up-label">Next Up</div>
      <div class="next-up-card">
        <div class="next-up-info">
          <div class="next-up-title">{nextItem.name}</div>
          <div class="next-up-meta">
            {#if nextItem.costLow === nextItem.costHigh && nextItem.costHigh === 0}
              <span>Free</span>
            {:else}
              <span>${nextItem.costLow.toLocaleString()}–${nextItem.costHigh.toLocaleString()}</span>
            {/if}
            <span>·</span>
            <span>{nextItem.weeks < 1 ? '< 1 week' : nextItem.weeks === 1 ? '1 week' : nextItem.weeks + ' weeks'}</span>
          </div>
        </div>
        <button class="next-up-start" onclick={() => { toggleDone(nextItem.id); }}>
          I'm working on this →
        </button>
      </div>
    </div>
  {/if}

  <!-- PA-04: Quick Wins -->
  {#if quickWins.length > 0}
    <div class="cl-quick-wins">
      <div class="qw-label">⚡ Start here <span class="qw-count">{quickWins.length} tasks, all free, all under 10 minutes</span></div>
      <div class="qw-chips">
        {#each quickWins.slice(0, 5) as qw}
          <button class="qw-chip" onclick={() => toggleDone(qw.id)}>
            {qw.name} →
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Main layout: content + CoPilot -->
  <div class="cl-layout">
    <!-- Main content -->
    <div class="cl-content">
      {#each PHASES as phase (phase.id)}
        {@const phaseVisible = filteredItems.filter(i => i.phase === phase.id)}
        {@const phaseDone    = items.filter(i => i.phase === phase.id && i.done).length}
        {@const phaseTotal   = items.filter(i => i.phase === phase.id).length}

        {#if phaseVisible.length > 0}
          <ChecklistPhase
            {phase}
            items={phaseVisible}
            allItems={items}
            doneCount={phaseDone}
            totalCount={phaseTotal}
            onToggleDone={toggleDone}
            onUpdateNotes={updateNotes}
            {highlightId}
            defaultOpen={phase.id === firstIncompletePhaseId || (phaseDone < phaseTotal && phaseDone > 0)}
          />
        {/if}
      {/each}

      <!-- Empty state when filter has no results -->
      {#if filteredItems.length === 0 && items.length > 0}
        <div class="cl-empty">
          <div class="cl-empty-icon">✓</div>
          <div class="cl-empty-msg">
            {filter === 'done' ? 'No tasks marked done yet — keep going!' : 'No tasks match this filter.'}
          </div>
          <button class="cl-empty-reset" onclick={() => setFilter('all')}>Show all tasks</button>
        </div>
      {/if}

      <div class="cl-page-nav-wrap">
        <PageNav
          backHref="/app/dashboard"
          backLabel="Dashboard"
          nextHref="/app/dashboard"
          nextLabel="Dashboard"
        />
      </div>
    </div>

    <!-- ═══ RIGHT SIDEBAR: CHECKLIST CO-PILOT ═══ -->
    <aside class="cl-copilot-wrap" class:collapsed={!copilotOpen}>
      <button class="cl-copilot-toggle" onclick={() => copilotOpen = !copilotOpen}
        title={copilotOpen ? 'Hide guide' : 'Ask RE²D2'}>
        {#if copilotOpen}
          <span class="toggle-close">✕</span>
        {:else}
          <span class="toggle-sparkle">✨</span>
          <span class="toggle-text">Ask RE²D2</span>
        {/if}
      </button>
      {#if copilotOpen}
        <!-- Mentor greeting (warm, phase-aware — sits above chat) -->
        <div class="mentor-greeting">
          <div class="mentor-avi">RE²</div>
          <div class="mentor-body">
            <div class="mentor-name">RE²D2 Launch Guide</div>
            <div class="mentor-msg">
              {#each copilotInitialMessages as m}
                <p>{sanitizeCopilotText(m.text)}</p>
              {/each}
            </div>
          </div>
        </div>
        <!-- CoPilotChat with empty initialMessages so suggestedPrompts chips render -->
        <CoPilotChat
          title=""
          subtitle=""
          initialMessages={[]}
          suggestedPrompts={copilotSuggestedPrompts}
          onSendMessage={handleChecklistCoPilot}
          accentColor="#1B3A5C"
        />
      {/if}
    </aside>
  </div>
</div>

<style>
  :global(body) {
    background: #FAFAF8;
  }

  .cl-page {
    min-height: 100vh;
    background: #FAFAF8;
    display: flex;
    flex-direction: column;
  }

  /* No-session */
  .cl-no-session {
    background: #fffbeb;
    border-bottom: 1px solid #fde68a;
    padding: 10px 32px;
    display: flex;
    align-items: center;
    gap: 16px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #92400e;
  }

  .cl-no-session-btn {
    background: #92400e;
    color: #fff;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }

  .cl-no-session-btn:hover { opacity: 0.85; }

  /* Layout: content + copilot */
  .cl-layout {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  /* Content area */
  .cl-content {
    flex: 1;
    max-width: 880px;
    padding: 28px 32px 60px;
    min-width: 0;
    overflow-y: auto;
  }

  /* Empty state */
  .cl-empty {
    text-align: center;
    padding: 48px 24px;
    background: #fff;
    border: 1px solid #E9ECEF;
    border-radius: 12px;
    margin-bottom: 24px;
  }

  .cl-empty-icon {
    font-size: 36px;
    color: #27AE60;
    margin-bottom: 12px;
  }

  .cl-empty-msg {
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    color: #6C757D;
    margin-bottom: 16px;
  }

  .cl-empty-reset {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #2E75B6;
    background: none;
    border: 1px solid #2E75B6;
    border-radius: 8px;
    padding: 6px 16px;
    cursor: pointer;
  }

  .cl-empty-reset:hover { background: #EBF5FB; }

  /* PA-04: Quick Wins */
  .cl-quick-wins {
    padding: 0 32px 16px;
  }

  .qw-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #1B3A5C;
    margin-bottom: 8px;
  }

  .qw-count {
    font-weight: 400;
    color: #6C757D;
    font-size: 12px;
    margin-left: 6px;
  }

  .qw-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .qw-chip {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #27AE60;
    background: #F0FAF5;
    border: 1px solid #27AE60;
    border-radius: 20px;
    padding: 5px 14px;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }

  .qw-chip:hover {
    background: #27AE60;
    color: #fff;
  }

  /* A6: Next Up card */
  .cl-next-up {
    padding: 0 32px 20px;
  }

  .next-up-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6C757D;
    margin-bottom: 8px;
  }

  .next-up-card {
    background: linear-gradient(135deg, #EAFAF1 0%, #EBF5FB 100%);
    border: 1px solid #27AE60;
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .next-up-info {
    flex: 1;
    min-width: 0;
  }

  .next-up-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 16px;
    font-weight: 700;
    color: #27AE60;
    margin-bottom: 4px;
  }

  .next-up-meta {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #6C757D;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .next-up-start {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    background: #27AE60;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s;
  }

  .next-up-start:hover {
    background: #229954;
  }

  .cl-page-nav-wrap {
    margin-top: 8px;
  }

  /* ═══ Co-Pilot sidebar ═══ */
  .cl-copilot-wrap {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: 320px;
    min-width: 320px;
    border-left: 1px solid #e5e7eb;
    background: #f8f9fb;
    position: relative;
    order: 1;
    height: calc(100vh - 56px);
    overflow: hidden;
  }

  .cl-copilot-wrap.collapsed {
    width: 0;
    min-width: 0;
    border-left: none;
    overflow: visible;
  }

  /* Toggle button */
  .cl-copilot-toggle {
    position: absolute;
    left: -32px;
    top: 12px;
    border-radius: 8px 0 0 8px;
    background: #1B3A5C;
    color: #fff;
    border: 1px solid #2a5a8c;
    border-right: none;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    z-index: 2;
    transition: background 0.15s, width 0.2s;
    padding: 0;
    white-space: nowrap;
    overflow: hidden;
  }

  .toggle-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    font-size: 13px;
  }

  .toggle-sparkle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 32px;
    font-size: 13px;
    flex-shrink: 0;
  }

  .toggle-text {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.2px;
    padding-right: 10px;
  }

  /* When collapsed, expand toggle to show label */
  .cl-copilot-wrap.collapsed .cl-copilot-toggle {
    left: -120px;
    width: 120px;
  }

  .cl-copilot-toggle:hover { background: #2a5a8c; }

  /* ── Mentor greeting (warm, not chatbot) ── */
  .mentor-greeting {
    display: flex;
    gap: 10px;
    padding: 16px 14px 12px;
    background: linear-gradient(135deg, #1B3A5C 0%, #2a5a8c 100%);
    color: #fff;
    flex-shrink: 0;
  }

  .mentor-avi {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: #34C759;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
    letter-spacing: -0.3px;
  }

  .mentor-body { flex: 1; min-width: 0; }

  .mentor-name {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .mentor-msg {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    line-height: 1.5;
    opacity: 0.92;
  }

  .mentor-msg p {
    margin: 0 0 4px;
  }

  .mentor-msg p:last-child { margin-bottom: 0; }

  /* ── Override CoPilotChat internals ── */
  .cl-copilot-wrap :global(.copilot-chat) {
    border-radius: 0;
    box-shadow: none;
    flex: 1;
    min-height: 0;
    max-height: none;
  }

  /* Hide the empty CoPilotChat header (we have our own mentor header) */
  .cl-copilot-wrap :global(.copilot-header) {
    display: none;
  }

  .cl-copilot-wrap :global(.messages-area) {
    min-height: 120px;
  }

  .cl-copilot-wrap :global(.chips-container) {
    border-top: none;
    padding: 10px 14px 8px;
    background: #f0f4f8;
  }

  .cl-copilot-wrap :global(.chip) {
    font-size: 11px;
    padding: 5px 10px;
    background: #fff;
    border-color: #c8d4e0;
    color: #1B3A5C;
  }

  .cl-copilot-wrap :global(.chip:hover:not(:disabled)) {
    border-color: #1B3A5C;
    color: #1B3A5C;
    background: #e8eef5;
  }

  /* Print */
  @media print {
    .cl-no-session,
    .cl-page-nav-wrap,
    .cl-copilot-wrap { display: none; }
  }

  @media (max-width: 768px) {
    .cl-layout { flex-direction: column; }
    .cl-content { padding: 16px 14px 48px; }
    .cl-no-session { padding: 10px 16px; }
    .cl-next-up { padding: 0 14px 16px; }
    .next-up-card { flex-direction: column; align-items: flex-start; }
    .next-up-start { align-self: flex-start; }
    .cl-copilot-wrap { display: none; }
  }
</style>
