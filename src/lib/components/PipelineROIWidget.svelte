<script lang="ts">
	import { onMount } from 'svelte';

	let counts: Record<string, number> = $state({});
	let total = $state(0);
	let loaded = $state(false);

	onMount(async () => {
		try {
			const res = await fetch('/api/deals');
			if (res.ok) {
				const data = await res.json();
				counts = data.counts || {};
				total = (data.pipeline || []).length;
				loaded = true;
			}
		} catch {
			// silent — widget is non-critical
		}
	});
</script>

{#if loaded && total > 0}
<div class="roi-widget">
	<div class="roi-widget-hdr">
		<span class="roi-widget-title">Your Pipeline</span>
		<a href="/app/pipeline" class="roi-widget-link">View all →</a>
	</div>
	<div class="roi-widget-row">
		<div class="roi-step">
			<span class="roi-step-n">{total}</span>
			<span class="roi-step-l">Scored</span>
		</div>
		<span class="roi-sep">→</span>
		<div class="roi-step">
			<span class="roi-step-n">{(counts.touring || 0) + (counts.negotiating || 0)}</span>
			<span class="roi-step-l">In Progress</span>
		</div>
		<span class="roi-sep">→</span>
		<div class="roi-step {counts.signed > 0 ? 'signed' : ''}">
			<span class="roi-step-n">{counts.signed || 0}</span>
			<span class="roi-step-l">Signed</span>
		</div>
	</div>
	{#if (counts.watching || 0) > 0}
	<div class="roi-widget-sub">{counts.watching} watching · {counts.touring || 0} touring · {counts.negotiating || 0} negotiating</div>
	{/if}
</div>
{/if}

<style>
.roi-widget {
	background: white;
	border: 1px solid #E5E7EB;
	border-radius: 12px;
	padding: 16px;
	margin-bottom: 16px;
}
.roi-widget-hdr {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12px;
}
.roi-widget-title {
	font-size: 12px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.07em;
	color: #6B7280;
}
.roi-widget-link {
	font-size: 12px;
	color: #0071E3;
	text-decoration: none;
	font-weight: 500;
}
.roi-widget-row {
	display: flex;
	align-items: center;
	gap: 12px;
}
.roi-step {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
}
.roi-step-n {
	font-size: 24px;
	font-weight: 700;
	color: #111827;
	line-height: 1;
}
.roi-step-l {
	font-size: 10px;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: #9CA3AF;
	font-weight: 600;
}
.roi-sep { font-size: 14px; color: #D1D5DB; }
.roi-step.signed .roi-step-n { color: #15803d; }
.roi-widget-sub {
	font-size: 11px;
	color: #9CA3AF;
	margin-top: 8px;
	padding-top: 8px;
	border-top: 1px solid #F3F4F6;
}
</style>
