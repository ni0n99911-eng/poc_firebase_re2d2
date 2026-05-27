<script lang="ts">
  interface Props {
    label: string;
    value: string | number;
    color?: string;       // border color, default #1e3a2a
    soWhat?: string;      // explanatory line below
    prefix?: string;      // e.g. '$'
    suffix?: string;      // e.g. 'mo'
    sublabel?: string;    // small text beneath label
  }

  let { label, value, color = '#1e3a2a', soWhat, prefix = '', suffix = '', sublabel }: Props = $props();
</script>

<div class="number-card" style="--card-color: {color}">
  <div class="nc-label">{label}</div>
  {#if sublabel}
    <div class="nc-sublabel">{sublabel}</div>
  {/if}
  <div class="nc-value">{prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</div>
  {#if soWhat}
    <div class="nc-so-what">{soWhat}</div>
  {/if}
</div>

<style>
  .number-card {
    background: #fff;
    border-left: 3px solid var(--card-color);
    border-radius: 10px;
    padding: 18px 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .nc-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6b7280;
  }

  .nc-sublabel {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #9ca3af;
  }

  .nc-value {
    font-family: 'DM Sans', sans-serif;
    font-size: 52px;
    font-weight: 700;
    line-height: 1;
    color: #111827;
    margin: 6px 0 4px;
  }

  .nc-so-what {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #4b5563;
    line-height: 1.4;
  }
</style>
