<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { ChecklistPhase, ItemState } from '$lib/data/checklist-data';
  import ChecklistItem from './ChecklistItem.svelte';

  let {
    phase,
    items,       // filtered items for this phase (respects active filter)
    allItems,    // ALL items (for dependency resolution)
    doneCount,   // done count from ALL items in this phase (unfiltered)
    totalCount,  // total items in this phase (unfiltered)
    onToggleDone,
    onUpdateNotes,
    highlightId = '',
    defaultOpen = true,
  }: {
    phase: ChecklistPhase;
    items: ItemState[];
    allItems: ItemState[];
    doneCount: number;
    totalCount: number;
    onToggleDone: (id: string) => void;
    onUpdateNotes: (id: string, notes: string) => void;
    highlightId?: string;
    defaultOpen?: boolean;
  } = $props();

  function getBlockedBy(item: ItemState): string {
    if (!item.dependsOn?.length) return '';
    const blocking = item.dependsOn.find(depId => {
      const dep = allItems.find(i => i.id === depId);
      return dep && !dep.done;
    });
    if (!blocking) return '';
    const dep = allItems.find(i => i.id === blocking);
    return dep?.name ?? '';
  }

  let open = $state(defaultOpen);

  const allDone = $derived(doneCount === totalCount && totalCount > 0);
  const phasePct = $derived(totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0);

  // PA-02: Phase celebration copy
  const celebrationLine = $derived.by(() => {
    if (!allDone) return '';
    const map: Record<string, string> = {
      'entity': 'Legal is locked in. One less thing to worry about.',
      'lease': 'Your space is secured. Time to build it out.',
      'design': 'Build-out planned. Now make it real.',
      'permits': 'All permits in hand. You\'re official.',
      'finance': 'Funded and protected. Smart move.',
      'ops': 'Operations ready. The machine is built.',
      'marketing': 'The buzz is building. Almost there.',
      'opening': 'Launch day is here! You did it. 🎉',
    };
    return map[phase.id] || 'Phase complete!';
  });
</script>

<section class="phase" aria-label={phase.name}>
  <button
    class="phase-header"
    class:all-done={allDone}
    onclick={() => (open = !open)}
    aria-expanded={open}
    aria-controls="phase-body-{phase.id}"
  >
    <div
      class="phase-icon"
      style="background: {phase.color}28; color: {phase.color}"
      aria-hidden="true"
    >{phase.icon}</div>
    <div class="phase-info">
      <div class="phase-name">{phase.name}</div>
      {#if phase.description}
        <div class="phase-desc">{phase.description}</div>
      {/if}
    </div>
    <div class="phase-progress-col">
      <div class="phase-count" aria-label="{doneCount} of {totalCount} complete">
        {doneCount}/{totalCount}
        {#if allDone}<span class="phase-done-badge">✓</span>{/if}
      </div>
      <div class="phase-mini-bar">
        <div class="phase-mini-fill" style="width: {phasePct}%; background: {phase.color}"></div>
      </div>
    </div>
    <span class="phase-chevron" class:open aria-hidden="true">▾</span>
  </button>

  {#if allDone && celebrationLine}
    <div class="phase-celebration" style="color: {phase.color}">
      {celebrationLine}
    </div>
  {/if}

  {#if open}
    <div
      id="phase-body-{phase.id}"
      class="task-list"
      transition:slide={{ duration: 180 }}
    >
      {#each items as item (item.id)}
        <ChecklistItem {item} {onToggleDone} {onUpdateNotes} highlight={item.id === highlightId} blockedBy={getBlockedBy(item)} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .phase {
    margin-bottom: 32px;
  }

  .phase-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    width: 100%;
    text-align: left;
    font-family: inherit;
    border-radius: 8px;
    transition: opacity 0.15s;
  }

  .phase-header:hover {
    opacity: 0.85;
  }

  .phase-header:focus-visible {
    outline: 2px solid #2E75B6;
    outline-offset: 2px;
  }

  .phase-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }

  .phase-info {
    flex: 1;
    text-align: left;
    min-width: 0;
  }

  .phase-name {
    font-family: 'DM Sans', sans-serif;
    font-size: 17px;
    font-weight: 700;
    color: #1B3A5C;
    text-align: left;
  }

  .phase-desc {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #6C757D;
    margin-top: 2px;
  }

  .phase-progress-col {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }

  .phase-count {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #ADB5BD;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .phase-mini-bar {
    width: 60px;
    height: 4px;
    background: #E9ECEF;
    border-radius: 2px;
    overflow: hidden;
  }

  .phase-mini-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s ease;
  }

  .phase-celebration {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    padding: 0 0 8px 50px;
  }

  .phase-done-badge {
    font-size: 10px;
    background: #EAFAF1;
    color: #27AE60;
    border-radius: 10px;
    padding: 1px 5px;
    font-weight: 700;
  }

  .phase-header.all-done {
    background: #F0FAF5;
    border-radius: 8px;
    padding: 8px 12px;
  }

  .phase-header.all-done .phase-name {
    color: #27AE60;
    font-weight: 700;
  }

  .phase-header.all-done .phase-icon {
    animation: phase-celebrate 0.6s ease-out;
  }

  @keyframes phase-celebrate {
    0% { transform: scale(1) rotate(0deg); }
    50% { transform: scale(1.15) rotate(10deg); }
    100% { transform: scale(1) rotate(0deg); }
  }

  .phase-chevron {
    font-size: 16px;
    color: #ADB5BD;
    transition: transform 0.2s ease;
    flex-shrink: 0;
    display: inline-block;
  }

  .phase-chevron.open {
    transform: rotate(0deg);
  }

  .phase-chevron:not(.open) {
    transform: rotate(-90deg);
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
</style>
