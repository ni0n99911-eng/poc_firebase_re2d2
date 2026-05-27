<script lang="ts">
  import type { ItemState } from '$lib/data/checklist-data';

  let {
    item,
    onToggleDone,
    onUpdateNotes,
    highlight = false,
    blockedBy = '',
  }: {
    item: ItemState;
    onToggleDone: (id: string) => void;
    onUpdateNotes: (id: string, notes: string) => void;
    highlight?: boolean;
    blockedBy?: string;
  } = $props();

  let expanded = $state(false);

  function fmtCost(low: number, high: number): string {
    if (high === 0) return 'Free';
    if (low === high) return `$${low.toLocaleString()}`;
    return `$${low.toLocaleString()}–$${high.toLocaleString()}`;
  }

  function fmtWeeks(w: number): string {
    if (w < 1) return '< 1 week';
    if (w === 1) return '1 week';
    return `${w} weeks`;
  }

  function fmtProType(t: string): string {
    return t.replace(/_/g, ' ');
  }

  const priorityLabel = $derived(
    item.priority === 'now'  ? 'Do Now'  :
    item.priority === 'soon' ? 'Do Soon' : 'Later'
  );

  const costStr  = $derived(fmtCost(item.costLow, item.costHigh));
  const weekStr  = $derived(fmtWeeks(item.weeks));
</script>

<div class="task" class:done={item.done} class:expanded class:highlight class:priority-now={item.priority === 'now' && !item.done} class:priority-soon={item.priority === 'soon' && !item.done} class:expensive={item.costHigh >= 10000 && !item.done}>
  <!-- Checkbox -->
  <button
    class="task-check"
    class:checked={item.done}
    role="checkbox"
    aria-checked={item.done}
    aria-label={item.done ? `Unmark: ${item.name}` : `Mark complete: ${item.name}`}
    onclick={(e) => { e.stopPropagation(); onToggleDone(item.id); }}
  ></button>

  <!-- Task body (click to expand notes) -->
  <div
    class="task-body"
    role="button"
    tabindex="0"
    aria-expanded={expanded}
    onclick={() => (expanded = !expanded)}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expanded = !expanded; } }}
  >
    <!-- CL6: Badge above title -->
    <div class="task-badge-row">
      <div class="task-priority {item.priority}">{priorityLabel}</div>
      <div class="task-meta-inline">
        <span>{costStr}</span><span>·</span><span>{weekStr}</span>
        {#if item.proType}<span>·</span><span>{fmtProType(item.proType)}</span>{/if}
      </div>
    </div>
    <div class="task-name">{item.name}</div>
    {#if blockedBy}
      <div class="task-blocked-bar">
        <span class="blocked-icon">⚠</span> Complete "{blockedBy}" first
      </div>
    {/if}
    {#if item.desc}
      <div class="task-desc" class:truncated={!expanded}>{item.desc}</div>
    {/if}

    {#if expanded}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="task-notes" role="presentation" onclick={(e) => e.stopPropagation()}>
        <textarea
          placeholder="Add your notes, contacts, or links here..."
          value={item.notes}
          oninput={(e) => onUpdateNotes(item.id, (e.target as HTMLTextAreaElement).value)}
          aria-label="Notes for {item.name}"
        ></textarea>
      </div>
    {/if}
  </div>

  <!-- Right column (IH-03: removed duplicate cost badge, IH-06: hidden Find a Pro until marketplace ships) -->
  <div class="task-right">
  </div>
</div>

<style>
  .task {
    background: #fff;
    border: 1px solid #E9ECEF;
    border-radius: 12px;
    padding: 14px 18px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    transition: box-shadow 0.2s, border-color 0.2s;
  }

  .task:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border-color: #DEE2E6;
  }

  .task.highlight {
    border-color: #27AE60;
    box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.15);
    animation: highlight-fade 2s ease-out forwards;
  }

  @keyframes highlight-fade {
    0% { box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.3); }
    100% { box-shadow: 0 0 0 0 rgba(39, 174, 96, 0); }
  }

  .task.priority-now {
    border-left: 4px solid #E74C3C;
  }

  .task.priority-soon {
    border-left: 4px solid #F39C12;
  }

  .task.expensive {
    background: #FFFDF5;
  }

  .task.done {
    background: #F8FFF9;
    border-left: 4px solid #27AE60;
  }

  .task.done .task-name {
    color: #27AE60;
  }

  /* Checkbox */
  .task-check {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 2px solid #DEE2E6;
    background: none;
    flex-shrink: 0;
    margin-top: 1px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    padding: 0;
    position: relative;
  }

  .task-check:hover {
    border-color: #27AE60;
  }

  .task-check.checked {
    background: #27AE60;
    border-color: #27AE60;
  }

  .task-check.checked::after {
    content: '✓';
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    animation: check-bounce 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }

  @keyframes check-bounce {
    0% { transform: scale(0.5); opacity: 0; }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
  }

  .task-check.checked {
    position: relative;
  }

  .task-check.checked::before {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: 8px;
    background: radial-gradient(circle, rgba(39, 174, 96, 0.3) 0%, rgba(39, 174, 96, 0) 70%);
    opacity: 0;
    animation: ripple-out 0.6s ease-out;
  }

  @keyframes ripple-out {
    0% { transform: scale(0); opacity: 1; }
    100% { transform: scale(1); opacity: 0; }
  }

  /* Task body */
  .task-body {
    flex: 1;
    min-width: 0;
    cursor: pointer;
    outline: none;
  }

  .task-body:focus-visible {
    outline: 2px solid #2E75B6;
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* CL6: Badge row above title */
  .task-badge-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .task-name {
    font-family: 'DM Sans', sans-serif;
    font-size: 16px;
    font-weight: 700;
    color: #212529;
    margin-bottom: 4px;
  }

  .task-priority {
    font-family: 'DM Sans', sans-serif;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 8px;
    border-radius: 10px;
    flex-shrink: 0;
    border: 1px solid transparent;
  }

  .task-priority.now   { background: #FDEDEC; color: #C0392B; border-color: #F5B7B1; }
  .task-priority.soon  { background: #FEF9E7; color: #D68910; border-color: #F9E79F; }
  .task-priority.later { background: #EBF5FB; color: #2E75B6; border-color: #AED6F1; }

  .task-meta-inline {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #ADB5BD;
  }

  /* CL6: Yellow dependency bar */
  .task-blocked-bar {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #92400E;
    font-weight: 600;
    background: #FFFBEB;
    border: 1px solid #FDE68A;
    border-radius: 6px;
    padding: 5px 10px;
    margin-bottom: 6px;
  }

  .blocked-icon { font-size: 12px; }

  .task-desc {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #6C757D;
    margin-bottom: 4px;
    line-height: 1.5;
  }

  /* CL6: Truncate description until expanded */
  .task-desc.truncated {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Notes */
  .task-notes {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #F1F3F5;
  }

  .task-notes textarea {
    width: 100%;
    border: 1px solid #E9ECEF;
    border-radius: 8px;
    padding: 8px 12px;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: #343A40;
    resize: vertical;
    min-height: 56px;
    background: #F8F9FA;
  }

  .task-notes textarea::placeholder { color: #ADB5BD; }

  .task-notes textarea:focus {
    outline: none;
    border-color: #2E75B6;
    box-shadow: 0 0 0 3px rgba(46, 117, 182, 0.1);
    background: #fff;
  }

  /* Right column */
  .task-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex-shrink: 0;
  }

  .find-pro {
    padding: 5px 12px;
    border-radius: 7px;
    border: 1px solid #2E75B6;
    color: #2E75B6;
    background: #fff;
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .find-pro:hover:not(:disabled) {
    background: #2E75B6;
    color: #fff;
  }

  .find-pro.coming-soon {
    border-color: #DEE2E6;
    color: #ADB5BD;
    cursor: default;
  }

  .find-pro.coming-soon:hover {
    background: #fff;
    color: #ADB5BD;
  }

  .cost-badge {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: #6C757D;
    background: #F1F3F5;
    padding: 2px 8px;
    border-radius: 5px;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .task-meta { flex-direction: column; gap: 3px; }
    .task-right { flex-direction: row; align-items: center; gap: 8px; }
    .find-pro { display: none; } /* hide on mobile until marketplace ships */
  }
</style>
