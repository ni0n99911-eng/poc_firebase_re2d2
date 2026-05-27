<script lang="ts">
	import type { LocationStore } from '../store.svelte';
	import { geocode, scanArea, getConceptScanRadius, fetchLiveIntel, enrichStationsFromMTA } from '../api/geo';
	import { blockScore, calculateVLF, calculateGLF, calculateRR, calculatePoS, buildL2FromScan } from '../scoring/engines';
	import { computeLocationScore } from '$lib/re2-scores';
	import { getScoreColor as _getScoreColor, getScoreGrade } from '$lib/constants/scoreUtils';

	let { store }: { store: LocationStore } = $props();

	let showOverlay = $state(false);
	let analyzingSet = $state<Set<number>>(new Set()); // which slots are currently analyzing
	let newAddr = $state(''); // input for adding a new address

	// Reactive slots: each slot has address + result
	let slots = $state<Array<{ addr: string; result: any | null; status: 'idle' | 'analyzing' | 'done' | 'error' }>>([
		{ addr: '', result: null, status: 'idle' }
	]);

	// Pre-fill primary from store if available
	$effect(() => {
		if (store.searchResult && slots[0].status === 'idle' && !slots[0].addr) {
			const enriched: any = { ...store.searchResult };
			if (store.vlfData) enriched.vlfData = store.vlfData;
			if (store.glfData) enriched.glfData = store.glfData;
			if (store.rrData) enriched.rrData = store.rrData;
			if (store.posData) enriched.posData = store.posData;
			if (store.searchResult.liveIntel) {
				try {
					enriched.locIQ = computeLocationScore(store.searchResult.liveIntel, store.bizType || 'coffee');
				} catch (_) {}
			}
			slots[0] = { addr: store.searchResult.addr || '', result: enriched, status: 'done' };
			slots = [...slots]; // force reactivity
		}
	});

	function addSlot() {
		const addr = newAddr.trim();
		if (!addr || slots.length >= 4) return;
		// Don't add duplicates
		if (slots.some(s => s.addr.toLowerCase() === addr.toLowerCase())) {
			newAddr = '';
			return;
		}
		slots = [...slots, { addr, result: null, status: 'idle' }];
		newAddr = '';
	}

	function removeSlot(idx: number) {
		if (idx === 0) return; // can't remove primary
		slots = slots.filter((_, i) => i !== idx);
	}

	async function analyzeSlot(idx: number): Promise<void> {
		const slot = slots[idx];
		if (!slot || !slot.addr.trim() || slot.status === 'analyzing') return;

		slots[idx] = { ...slot, status: 'analyzing' };
		slots = [...slots];

		try {
			const geo = await geocode(slot.addr);
			const compRadius = getConceptScanRadius(store.bizCategory);
			const [rawData, liveIntel] = await Promise.all([
				scanArea(geo.lat, geo.lon, compRadius, store.bizCategory),
				fetchLiveIntel(geo.lat, geo.lon, store.bizType, slot.addr)
			]);
			const data = enrichStationsFromMTA(rawData, liveIntel);

			const sc = blockScore(data, liveIntel);
			const fullAddr = geo.display || slot.addr;
			const vlfData = calculateVLF(data, store.vision, { bizType: store.bizType, targetRevY1: store.targetRevY1, location: fullAddr }, liveIntel);
			const glfData = calculateGLF(data, {
				bizType: store.bizType, targetTicket: store.targetTicket, targetTxns: store.targetTxns,
				targetRevY1: store.targetRevY1, numLocations: store.numLocations,
				estimatedRent: store.estimatedRent || undefined, searchAddr: fullAddr
			}, { lcs: store.lcs }, liveIntel ? {
				mtaDailyRidership: liveIntel.mtaRidership?.totalDailyRidership,
				pedestrianCount: liveIntel.pedestrian?.totalPedestrians,
				pedestrianScore: liveIntel.pedestrian?.footTrafficScore
			} : null);
			const rrData = calculateRR(data, {
				differentiator: store.differentiator, liveIntel, searchAddr: fullAddr,
				lcs: store.lcs, vision: store.vision,
				estimatedRent: store.estimatedRent || undefined, targetRevY1: store.targetRevY1
			});

			let locIQ = null;
			if (liveIntel) {
				locIQ = computeLocationScore(liveIntel, store.bizType || 'coffee');
			}

			const completeness = data.cafes.length > 0 && data.stations.length > 0 ? 'Full' : 'Moderate';
			const posData = calculatePoS(vlfData.vlf, glfData.glf, rrData.rr, completeness);

			const result = { addr: slot.addr, geo, data, score: sc, vlfData, glfData, rrData, posData, liveIntel, locIQ };

			slots[idx] = { addr: slot.addr, result, status: 'done' };
			slots = [...slots];

			// If primary, sync to store
			if (idx === 0) {
				store.primaryResult = result;
				store.searchResult = result;
				store.vlfData = vlfData;
				store.glfData = glfData;
				store.rrData = rrData;
				store.posData = posData;
				store.layerScores = { ...store.layerScores, L2: buildL2FromScan(data, sc, liveIntel) };
			}
		} catch (e) {
			console.error('Compare error:', e);
			slots[idx] = { ...slot, status: 'error' };
			slots = [...slots];
		}
	}

	async function analyzeAll() {
		const pending = slots
			.map((s, i) => ({ s, i }))
			.filter(({ s }) => s.addr.trim() && s.status !== 'done' && s.status !== 'analyzing');

		if (pending.length === 0) return;

		// Analyze all pending in parallel
		await Promise.allSettled(pending.map(({ i }) => analyzeSlot(i)));
	}

	let analyzedCount = $derived(slots.filter(s => s.status === 'done').length);
	let pendingCount = $derived(slots.filter(s => s.addr.trim() && s.status !== 'done' && s.status !== 'analyzing').length);
	let analyzingCount = $derived(slots.filter(s => s.status === 'analyzing').length);
	let canAddMore = $derived(slots.length < 4);

	// canonical DECISION_STATES thresholds via scoreUtils
	function getScoreColor(score: number): string { return _getScoreColor(score); }
	function getGrade(score: number): string { return getScoreGrade(score); }

	function getScore(slot: typeof slots[0]): number {
		return slot.result?.locIQ?.score ?? slot.result?.posData?.base ?? 0;
	}

	function getBest(metric: string): number {
		let best = -1;
		let bestIdx = -1;
		slots.forEach((s, i) => {
			if (!s.result) return;
			let val = 0;
			if (metric === 'score') val = getScore(s);
			else if (metric === 'vlf') val = s.result.vlfData?.vlf ?? 0;
			else if (metric === 'glf') val = s.result.glfData?.glf ?? 0;
			else if (metric === 'risk') val = s.result.rrData?.rr ?? 0;
			if (val > best) { best = val; bestIdx = i; }
		});
		return bestIdx;
	}
</script>

<!-- Trigger Button -->
<div class="compare-trigger">
	<button class="compare-btn" onclick={() => showOverlay = true}>
		Compare locations{analyzedCount > 0 ? ` (${analyzedCount})` : ''}
	</button>
</div>

<!-- Overlay -->
{#if showOverlay}
	<div class="overlay-backdrop" onclick={() => showOverlay = false}>
		<div class="overlay-panel" onclick={(e) => e.stopPropagation()}>
			<div class="overlay-header">
				<h2>Compare Locations</h2>
				<p class="overlay-desc">Add up to 4 addresses, then compare side by side.</p>
				<button class="overlay-close" onclick={() => showOverlay = false}>×</button>
			</div>

			<!-- Address List -->
			<div class="address-list">
				{#each slots as slot, idx}
					<div class="address-chip" class:primary={idx === 0} class:done={slot.status === 'done'} class:analyzing={slot.status === 'analyzing'} class:error={slot.status === 'error'}>
						<div class="chip-left">
							<span class="chip-index">{idx === 0 ? 'P' : idx}</span>
							{#if slot.status === 'done'}
								<span class="chip-score" style="background: {getScoreColor(getScore(slot))}">{getScore(slot)}</span>
							{:else if slot.status === 'analyzing'}
								<span class="chip-spinner"></span>
							{/if}
						</div>
						<span class="chip-addr" title={slot.addr}>{slot.addr || 'No address'}</span>
						<div class="chip-right">
							{#if slot.status === 'done'}
								<span class="chip-grade" style="color: {getScoreColor(getScore(slot))}">Grade {getGrade(getScore(slot))}</span>
							{:else if slot.status === 'analyzing'}
								<span class="chip-status">Analyzing...</span>
							{:else if slot.status === 'error'}
								<span class="chip-status error-text">Failed</span>
							{:else}
								<span class="chip-status">Pending</span>
							{/if}
							{#if idx > 0}
								<button class="chip-remove" onclick={() => removeSlot(idx)} title="Remove">×</button>
							{/if}
						</div>
					</div>
				{/each}

				<!-- Add address row -->
				{#if canAddMore}
					<div class="add-row">
						<div class="add-input-wrap">
							<span class="add-input-icon">📍</span>
							<input
								type="text"
								placeholder="Type an address to compare (e.g. 123 Broadway, New York)"
								bind:value={newAddr}
								onkeydown={(e) => { if (e.key === 'Enter') addSlot(); }}
							/>
						</div>
						<button class="add-btn" onclick={addSlot} disabled={!newAddr.trim()}>
							<span class="add-btn-plus">+</span>
							Add Location
						</button>
					</div>
					<p class="add-hint">{4 - slots.length} slot{4 - slots.length !== 1 ? 's' : ''} remaining · Press Enter or click to add</p>
				{:else}
					<p class="max-notice">All 4 location slots filled</p>
				{/if}
			</div>

			<!-- Action Bar -->
			<div class="action-bar">
				{#if pendingCount > 0 || analyzingCount > 0}
					<button class="action-btn primary-action" onclick={analyzeAll} disabled={analyzingCount > 0 || pendingCount === 0}>
						{#if analyzingCount > 0}
							Analyzing {analyzingCount} location{analyzingCount > 1 ? 's' : ''}...
						{:else}
							Compare {pendingCount === slots.length ? 'All' : pendingCount} Location{pendingCount > 1 ? 's' : ''}
						{/if}
					</button>
				{:else if analyzedCount >= 2}
					<div class="action-done">All {analyzedCount} locations analyzed</div>
				{/if}
			</div>

			<!-- Results Comparison -->
			{#if analyzedCount >= 1}
				<div class="results-section">
					{#if analyzedCount >= 2}
						<div class="results-summary">
							Side-by-side comparison
						</div>
					{/if}
					<div class="results-scroll">
						<div class="results-grid" style="grid-template-columns: repeat({analyzedCount}, minmax(240px, 1fr))">
							{#each slots as slot, idx}
								{#if slot.result}
									{@const locScore = getScore(slot)}
									{@const res = slot.result}
									{@const isBestScore = getBest('score') === idx}
									{@const isBestVlf = getBest('vlf') === idx}
									{@const isBestGlf = getBest('glf') === idx}
									{@const isBestRisk = getBest('risk') === idx}
									<div class="result-card" class:primary-card={idx === 0} class:best-overall={isBestScore && analyzedCount > 1}>
										{#if idx === 0}<div class="card-badge primary-badge">Primary</div>{/if}
										{#if isBestScore && analyzedCount > 1}<div class="card-badge best-badge">Best Match</div>{/if}
										<div class="result-addr" title={slot.addr}>{slot.addr}</div>

										<!-- Location IQ Score -->
										<div class="result-score-ring">
											<svg viewBox="0 0 80 80" width="80" height="80">
												<circle cx="40" cy="40" r="34" fill="none" stroke="#e5e5ea" stroke-width="5" />
												<circle cx="40" cy="40" r="34" fill="none"
													stroke={getScoreColor(locScore)}
													stroke-width="5"
													stroke-linecap="round"
													stroke-dasharray="{(locScore / 100) * 213.6} 213.6"
													transform="rotate(-90 40 40)"
												/>
											</svg>
											<div class="ring-center">
												<span class="ring-number" style="color: {getScoreColor(locScore)}">{locScore}</span>
											</div>
										</div>
										<div class="result-grade" style="color: {getScoreColor(locScore)}">
											Grade {getGrade(locScore)}
										</div>

										<!-- Metrics -->
										<div class="metrics">
											<div class="metric" class:best={isBestVlf}>
												<span class="metric-label">Vision Fit</span>
												<span class="metric-value">{res.vlfData?.vlf ?? '—'}</span>
											</div>
											<div class="metric" class:best={isBestGlf}>
												<span class="metric-label">Financials</span>
												<span class="metric-value">{res.glfData?.glf ?? '—'}</span>
											</div>
											<div class="metric" class:best={isBestRisk}>
												<span class="metric-label">Risk Score</span>
												<span class="metric-value">{res.rrData?.rr ?? '—'}</span>
											</div>
											<div class="metric">
												<span class="metric-label">Competitors</span>
												<span class="metric-value">{res.data?.cafes?.length ?? '—'}</span>
											</div>
											<div class="metric">
												<span class="metric-label">Transit</span>
												<span class="metric-value">{res.data?.stations?.length ?? '—'} stations</span>
											</div>
											{#if res.liveIntel?.walkScore}
												<div class="metric">
													<span class="metric-label">Walk Score</span>
													<span class="metric-value">{res.liveIntel.walkScore.walkScore}</span>
												</div>
											{/if}
											{#if res.liveIntel?.census}
												<div class="metric">
													<span class="metric-label">Median Income</span>
													<span class="metric-value">${Math.round(res.liveIntel.census.medianHouseholdIncome / 1000)}k</span>
												</div>
											{/if}
										</div>

										<!-- Verdict -->
										<div class="result-verdict" style="border-color: {getScoreColor(locScore)}">
											{locScore >= 70 ? 'Strong location' : locScore >= 55 ? 'Has potential' : 'Challenging'}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				</div>
			{:else if slots.length <= 1 && slots[0].status === 'idle'}
				<div class="results-empty">
					<p>Add addresses above to start comparing locations.</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Trigger Button */
	.compare-trigger {
		margin: 12px 0;
	}
	.compare-btn {
		background: var(--surface, #fff);
		border: 1px solid #d2d2d7;
		border-radius: 10px;
		padding: 10px 20px;
		font-size: 14px;
		font-weight: 500;
		color: #0071E3;
		cursor: pointer;
		transition: all 0.15s ease;
		width: 100%;
	}
	.compare-btn:hover {
		border-color: #0071E3;
		background: rgba(0, 113, 227, 0.05);
	}

	/* Overlay */
	.overlay-backdrop {
		position: fixed;
		top: 0; left: 0; right: 0; bottom: 0;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}
	.overlay-panel {
		background: #fff;
		border-radius: 16px;
		width: 100%;
		max-width: 1200px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
		padding: 28px;
	}
	.overlay-header {
		position: relative;
		margin-bottom: 20px;
	}
	.overlay-header h2 {
		font-size: 20px;
		font-weight: 600;
		color: #1d1d1f;
		margin: 0 0 4px 0;
	}
	.overlay-desc {
		font-size: 14px;
		color: #6e6e73;
		margin: 0;
	}
	.overlay-close {
		position: absolute;
		top: -4px; right: -4px;
		width: 32px; height: 32px;
		border: none;
		background: #f5f5f7;
		border-radius: 50%;
		font-size: 18px;
		color: #6e6e73;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s ease;
	}
	.overlay-close:hover {
		background: #e5e5ea;
		color: #1d1d1f;
	}

	/* Address Chips */
	.address-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}
	.address-chip {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		background: #f5f5f7;
		border-radius: 10px;
		border: 1px solid #e5e5ea;
		transition: all 0.15s ease;
	}
	.address-chip.primary {
		border-color: #0071E3;
		background: rgba(0, 113, 227, 0.04);
	}
	.address-chip.done {
		border-color: #34C759;
		background: rgba(52, 199, 89, 0.04);
	}
	.address-chip.analyzing {
		border-color: #FF9500;
		background: rgba(255, 149, 0, 0.04);
	}
	.address-chip.error {
		border-color: #FF3B30;
		background: rgba(255, 59, 48, 0.04);
	}

	.chip-left {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.chip-index {
		width: 22px; height: 22px;
		border-radius: 6px;
		background: #d2d2d7;
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.address-chip.primary .chip-index {
		background: #0071E3;
	}
	.chip-score {
		min-width: 28px; height: 22px;
		border-radius: 6px;
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 4px;
	}
	.chip-spinner {
		width: 18px; height: 18px;
		border: 2px solid #e5e5ea;
		border-top-color: #FF9500;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	.chip-addr {
		flex: 1;
		font-size: 13px;
		font-weight: 500;
		color: #1d1d1f;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.chip-right {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}
	.chip-grade {
		font-size: 11px;
		font-weight: 700;
	}
	.chip-status {
		font-size: 11px;
		font-weight: 500;
		color: #6e6e73;
	}
	.chip-status.error-text {
		color: #FF3B30;
	}
	.chip-remove {
		width: 24px; height: 24px;
		border: none;
		background: none;
		color: #a1a1a6;
		font-size: 16px;
		cursor: pointer;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.1s ease;
	}
	.chip-remove:hover {
		background: rgba(255, 59, 48, 0.08);
		color: #FF3B30;
	}

	/* Add Row */
	.add-row {
		display: flex;
		gap: 10px;
		align-items: stretch;
		margin-top: 4px;
	}
	.add-input-wrap {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 14px;
		border: 2px dashed #d2d2d7;
		border-radius: 12px;
		background: #fff;
		transition: all 0.15s ease;
	}
	.add-input-wrap:focus-within {
		border-color: #0071E3;
		border-style: solid;
		box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1);
	}
	.add-input-icon {
		font-size: 16px;
		flex-shrink: 0;
	}
	.add-input-wrap input {
		flex: 1;
		padding: 12px 0;
		border: none;
		font-size: 14px;
		color: #1d1d1f;
		background: transparent;
		outline: none;
		font-family: inherit;
	}
	.add-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 12px 20px;
		background: #0071E3;
		color: #fff;
		border: none;
		border-radius: 12px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
		flex-shrink: 0;
		box-shadow: 0 2px 8px rgba(0, 113, 227, 0.3);
	}
	.add-btn:hover:not(:disabled) {
		background: #0077ed;
		box-shadow: 0 4px 12px rgba(0, 113, 227, 0.4);
		transform: translateY(-1px);
	}
	.add-btn:active:not(:disabled) {
		transform: translateY(0);
	}
	.add-btn:disabled {
		background: #d2d2d7;
		color: #a1a1a6;
		cursor: not-allowed;
		box-shadow: none;
	}
	.add-btn-plus {
		font-size: 18px;
		font-weight: 700;
		line-height: 1;
	}
	.add-hint {
		font-size: 11px;
		color: #a1a1a6;
		text-align: center;
		margin: 6px 0 0 0;
	}
	.max-notice {
		font-size: 12px;
		color: #a1a1a6;
		text-align: center;
		margin: 4px 0 0 0;
	}

	/* Action Bar */
	.action-bar {
		margin-bottom: 20px;
		display: flex;
		justify-content: center;
	}
	.action-btn {
		padding: 12px 32px;
		border-radius: 12px;
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		border: none;
		transition: all 0.15s ease;
	}
	.primary-action {
		background: #0071E3;
		color: #fff;
	}
	.primary-action:hover:not(:disabled) {
		background: #0077ed;
	}
	.primary-action:disabled {
		background: #FF9500;
		cursor: wait;
	}
	.action-done {
		font-size: 13px;
		font-weight: 500;
		color: #34C759;
		padding: 8px 0;
	}

	/* Results */
	.results-section {
		border-top: 1px solid #e5e5ea;
		padding-top: 20px;
	}
	.results-summary {
		font-size: 13px;
		font-weight: 600;
		color: #6e6e73;
		margin-bottom: 12px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.results-scroll {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		padding-bottom: 4px;
	}
	.results-grid {
		display: grid;
		gap: 16px;
		min-width: min-content;
	}
	.result-card {
		background: #f5f5f7;
		border-radius: 12px;
		padding: 20px 16px;
		text-align: center;
		position: relative;
		border: 1px solid #e5e5ea;
		min-width: 240px;
	}
	.result-card.primary-card {
		border-color: #0071E3;
		background: rgba(0, 113, 227, 0.03);
	}
	.result-card.best-overall {
		border-color: #34C759;
		box-shadow: 0 0 0 1px rgba(52, 199, 89, 0.2);
	}
	.card-badge {
		position: absolute;
		top: -8px;
		padding: 2px 10px;
		color: #fff;
		font-size: 10px;
		font-weight: 600;
		border-radius: 10px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.primary-badge {
		left: 16px;
		background: #0071E3;
	}
	.best-badge {
		right: 16px;
		background: #34C759;
	}
	.result-addr {
		font-size: 13px;
		font-weight: 600;
		color: #1d1d1f;
		margin-bottom: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.result-score-ring {
		position: relative;
		width: 80px; height: 80px;
		margin: 0 auto 8px;
	}
	.ring-center {
		position: absolute;
		top: 50%; left: 50%;
		transform: translate(-50%, -50%);
	}
	.ring-number {
		font-size: 24px;
		font-weight: 800;
	}
	.result-grade {
		font-size: 12px;
		font-weight: 700;
		margin-bottom: 16px;
	}

	/* Metrics */
	.metrics {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
	}
	.metric {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 10px;
		background: #fff;
		border-radius: 6px;
		font-size: 12px;
	}
	.metric.best {
		background: rgba(52, 199, 89, 0.08);
		border: 1px solid rgba(52, 199, 89, 0.2);
	}
	.metric-label { color: #6e6e73; }
	.metric-value { font-weight: 600; color: #1d1d1f; }
	.metric.best .metric-value { color: #34C759; }

	.result-verdict {
		padding: 8px 12px;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 600;
		border: 1px solid;
		color: #1d1d1f;
	}

	.results-empty {
		text-align: center;
		padding: 32px 16px;
		color: #6e6e73;
		font-size: 14px;
	}

	/* Tablet */
	@media (max-width: 1024px) {
		.overlay-panel { max-width: 95vw; }
	}

	/* Mobile */
	@media (max-width: 768px) {
		.overlay-panel {
			padding: 16px;
			max-height: 95vh;
			max-width: 100vw;
			border-radius: 12px;
		}
		.overlay-backdrop { padding: 8px; }
		.results-grid {
			grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)) !important;
		}
		.result-card { min-width: 220px; }
		.add-row { flex-wrap: wrap; }
		.add-input-wrap { width: 100%; flex: none; }
		.add-btn { width: 100%; justify-content: center; }
		.chip-addr { font-size: 12px; }
	}
</style>
