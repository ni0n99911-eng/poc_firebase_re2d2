<script lang="ts">
  import type { ItemState } from '$lib/data/checklist-data';

  let {
    items,
    activeFilter,
    onFilterChange,
  }: {
    items: ItemState[];
    activeFilter: string;
    onFilterChange: (filter: string) => void;
  } = $props();

  const doneCount  = $derived(items.filter(i => i.done).length);
  const todoCount  = $derived(items.length - doneCount);
  const totalCount = $derived(items.length);

  const nowCount   = $derived(items.filter(i => i.priority === 'now').length);
  const soonCount  = $derived(items.filter(i => i.priority === 'soon').length);
  const laterCount = $derived(items.filter(i => i.priority === 'later').length);

  const FILTERS = $derived([
    { id: 'all',   label: `All (${totalCount})` },
    { id: 'todo',  label: `To Do (${todoCount})` },
    { id: 'done',  label: `Done (${doneCount})` },
    { id: 'now',   label: `Do Now (${nowCount})` },
    { id: 'soon',  label: `Do Soon (${soonCount})` },
    { id: 'later', label: `Do Later (${laterCount})` },
  ]);
</script>

<div class="filters" role="group" aria-label="Filter tasks">
  {#each FILTERS as f}
    <button
      class="filter-chip"
      class:active={activeFilter === f.id}
      onclick={() => onFilterChange(f.id)}
    >{f.label}</button>
  {/each}
</div>

<style>
  .filters {
    padding: 14px 32px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    background: #FAFAF8;
    border-bottom: 1px solid #E9ECEF;
    flex-shrink: 0;
    position: sticky;
    top: 52px;
    z-index: 50;
  }

  .filter-chip {
    padding: 5px 14px;
    border-radius: 20px;
    border: 1px solid #DEE2E6;
    background: #fff;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: #495057;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    white-space: nowrap;
  }

  .filter-chip:hover {
    border-color: #2E75B6;
    color: #2E75B6;
  }

  .filter-chip.active {
    background: #1B3A5C;
    color: #fff;
    border-color: #1B3A5C;
  }

  @media (max-width: 768px) {
    .filters { padding: 10px 16px; }
  }
</style>
