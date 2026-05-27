<script lang="ts">
	import type { LocationHistoryData, HistoricalBusiness } from '$lib/intel/location-history';
	import { onMount } from 'svelte';

	interface Props {
		address: string;
		lat: number;
		lng: number;
		concept?: string;
	}

	let { address, lat, lng }: Props = $props();

	let data    = $state<LocationHistoryData | null>(null);
	let loading = $state(true);

	let highTurnover  = $derived(data?.highTurnover ?? false);
	let turnoverCount = $derived(data ? Math.max(0, (data.totalCount || 1) - 1) : 0);
	let hasData       = $derived(data !== null && (data.totalCount > 0 || data.businesses.length > 0));

	onMount(async () => {
		try {
			const r = await fetch(
				`/api/location-history?address=${encodeURIComponent(address)}&lat=${lat}&lng=${lng}`,
				{ signal: AbortSignal.timeout(12000) }
			);
			data = r.ok ? await r.json() : null;
		} catch {
			data = null;
		} finally {
			loading = false;
		}
	});

	function statusDot(b: HistoricalBusiness): string {
		if (b.status === 'active') return '🟢';
		if (b.status === 'closed') return '🔴';
		return '⚪';
	}

	function categoryIcon(cat: string): string {
		const c = (cat || '').toLowerCase();
		if (c.includes('coffee') || c.includes('café') || c.includes('cafe')) return '☕';
		if (c.includes('pizza')) return '🍕';
		if (c.includes('bar') || c.includes('wine') || c.includes('cocktail')) return '🍷';
		if (c.includes('bakery') || c.includes('donut') || c.includes('pastry')) return '🥐';
		if (c.includes('chicken') || c.includes('burger') || c.includes('sandwich')) return '🍔';
		if (c.includes('restaurant') || c.includes('diner') || c.includes('bistro')) return '🍽';
		if (c.includes('gym') || c.includes('fitness') || c.includes('yoga')) return '💪';
		if (c.includes('spa') || c.includes('salon') || c.includes('nail') || c.includes('beauty')) return '💅';
		if (c.includes('retail') || c.includes('boutique') || c.includes('clothing')) return '🛍';
		if (c.includes('grocery') || c.includes('market') || c.includes('deli')) return '🛒';
		if (c.includes('pharmacy') || c.includes('medical') || c.includes('health')) return '💊';
		return '🏪';
	}
</script>

{#if loading}
	<div class="lh-wrap lh-loading">
		<div class="lh-skeleton-hdr"></div>
		<div class="lh-skeleton-row"></div>
		<div class="lh-skeleton-row lh-skeleton-row--short"></div>
	</div>
{:else if hasData}
<div class="lh-wrap">

	<!-- Header -->
	<div class="lh-header">
		<div class="lh-header-left">
			<span class="lh-title">📍 Location History</span>
			<span class="lh-subtitle">Who was here before?</span>
		</div>
		<div class="lh-header-right">
			{#if highTurnover}
				<span class="lh-badge lh-badge--high">⚠ High Turnover</span>
			{:else if turnoverCount >= 1}
				<span class="lh-badge lh-badge--mid">{turnoverCount} change{turnoverCount !== 1 ? 's' : ''}</span>
			{:else}
				<span class="lh-badge lh-badge--stable">✓ Stable</span>
			{/if}
		</div>
	</div>

	<!-- Stats strip -->
	{#if data}
	<div class="lh-stats">
		<div class="lh-stat">
			<span class="lh-stat-val">{data.totalCount}</span>
			<span class="lh-stat-label">businesses on record</span>
		</div>
		{#if data.avgTenureLabel && data.avgTenureLabel !== 'Unknown'}
		<div class="lh-stat">
			<span class="lh-stat-val">{data.avgTenureLabel}</span>
			<span class="lh-stat-label">avg tenure</span>
		</div>
		{/if}
		{#if data.hasActiveOccupant}
		<div class="lh-stat">
			<span class="lh-stat-val lh-stat-val--green">Active</span>
			<span class="lh-stat-label">current occupant</span>
		</div>
		{/if}
	</div>
	{/if}

	<!-- Kill factor -->
	{#if highTurnover}
	<div class="lh-signal lh-signal--warn">
		⚠ High turnover at this address — {turnoverCount} tenant changes on record. Investigate why businesses keep leaving.
	</div>
	{/if}

	<!-- Business timeline -->
	{#if data && data.businesses.length > 0}
	<div class="lh-timeline">
		{#each data.businesses.slice(0, 8) as biz}
		<div class="lh-biz-row" class:lh-biz-active={biz.status === 'active'}>
			<span class="lh-biz-icon">{categoryIcon(biz.category)}</span>
			<div class="lh-biz-info">
				<span class="lh-biz-name">{biz.name}</span>
				<span class="lh-biz-cat">{biz.category}</span>
			</div>
			<div class="lh-biz-meta">
				<span class="lh-biz-tenure">{biz.tenureLabel}</span>
				{#if biz.openDate || biz.closeDate}
				<span class="lh-biz-dates">
					{biz.openDate ? biz.openDate.slice(0,4) : '?'}–{biz.closeDate ? biz.closeDate.slice(0,4) : 'now'}
				</span>
				{/if}
			</div>
			<span class="lh-biz-dot">{statusDot(biz)}</span>
		</div>
		{/each}
		{#if data.businesses.length > 8}
		<div class="lh-more">+{data.businesses.length - 8} more on record</div>
		{/if}
	</div>
	{/if}

	<div class="lh-source">NYC DOHMH Inspections · NYC DCA Business Licenses</div>

</div>
{/if}

<style>
	.lh-wrap {
		border: 1px solid #e0ddd7;
		border-radius: 12px;
		overflow: hidden;
		background: #faf9f7;
		margin-top: 14px;
	}

	.lh-loading { padding: 16px; }
	.lh-skeleton-hdr {
		height: 18px; width: 60%; background: #e8e5e0;
		border-radius: 6px; margin-bottom: 12px;
		animation: pulse 1.4s ease-in-out infinite;
	}
	.lh-skeleton-row {
		height: 12px; width: 100%; background: #efecea;
		border-radius: 4px; margin-bottom: 8px;
		animation: pulse 1.4s ease-in-out infinite;
	}
	.lh-skeleton-row--short { width: 70%; }
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.lh-header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 12px 14px 10px;
		border-bottom: 1px solid #eeece8;
	}
	.lh-header-left { display: flex; flex-direction: column; gap: 1px; }
	.lh-title { font-size: 13px; font-weight: 700; color: #2d2b27; }
	.lh-subtitle { font-size: 11px; color: #9ca3af; }

	.lh-badge {
		font-size: 10px; font-weight: 700; padding: 3px 8px;
		border-radius: 20px; letter-spacing: 0.3px;
	}
	.lh-badge--high { background: #fef3c7; color: #92400e; }
	.lh-badge--mid  { background: #eff6ff; color: #1d4ed8; }
	.lh-badge--stable { background: #dcfce7; color: #15803d; }

	.lh-stats {
		display: flex; gap: 0; border-bottom: 1px solid #eeece8;
	}
	.lh-stat {
		flex: 1; display: flex; flex-direction: column; align-items: center;
		padding: 10px 8px; border-right: 1px solid #eeece8;
		gap: 2px;
	}
	.lh-stat:last-child { border-right: none; }
	.lh-stat-val { font-size: 18px; font-weight: 800; color: #2d2b27; }
	.lh-stat-val--green { color: #15803d; font-size: 14px; font-weight: 700; }
	.lh-stat-label { font-size: 10px; color: #9ca3af; text-align: center; }

	.lh-signal {
		margin: 10px 14px; padding: 8px 12px; border-radius: 8px;
		font-size: 11px; font-weight: 500; line-height: 1.5;
	}
	.lh-signal--warn { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }

	.lh-timeline { padding: 8px 0; }
	.lh-biz-row {
		display: flex; align-items: center; gap: 10px;
		padding: 8px 14px;
		border-bottom: 1px solid #f5f4f1;
	}
	.lh-biz-row:last-child { border-bottom: none; }
	.lh-biz-active { background: #f0fdf4; }
	.lh-biz-icon { font-size: 16px; width: 20px; flex-shrink: 0; }
	.lh-biz-info { flex: 1; min-width: 0; }
	.lh-biz-name { display: block; font-size: 12px; font-weight: 600; color: #2d2b27; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.lh-biz-cat  { display: block; font-size: 10px; color: #9ca3af; }
	.lh-biz-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; flex-shrink: 0; }
	.lh-biz-tenure { font-size: 10px; font-weight: 600; color: #6b6860; }
	.lh-biz-dates  { font-size: 10px; color: #9ca3af; }
	.lh-biz-dot { font-size: 10px; flex-shrink: 0; }

	.lh-more { padding: 8px 14px; font-size: 11px; color: #9ca3af; text-align: center; }
	.lh-source { padding: 8px 14px; font-size: 9px; color: #c4c0ba; text-align: right; border-top: 1px solid #f0ede8; }

</style>
