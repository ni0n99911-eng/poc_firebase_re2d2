<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { apiFetch } from '$lib/api';
	// BR-UX-10: canonical grade / tier via decision-engine.
	import { fitGrade, fitTierLabel } from '$lib/utils/decision-engine';

	const addr = $derived(page.url.searchParams.get('addr') ?? '');

	let address = $state('');
	let neighborhood = $state('');
	let primaryLocationIQ = $state(0);
	let primaryFitIQ = $state(0);
	let primarySixScores = $state<Record<string, number>>({});

	// Compare addresses — primary is always the analyzed location
	interface CompareEntry {
		addr: string;
		locationIQ: number;
		fitIQ: number;
		survivalRate: number;
		scores: Record<string, number>;
		loading?: boolean;
		error?: string;
	}

	let compareList = $state<CompareEntry[]>([]);
	let newAddrInput = $state('');
	let addingAddr = $state(false);
	let addError = $state('');
	let aiNarrative = $state('');
	let aiLoading = $state(false);

	// Derived: Fit IQ final row values (cannot use {@const} outside a block in markup)
	let fitScores = $derived(compareList.map(e => e.fitIQ));
	let maxFit = $derived(Math.max(...(compareList.length ? compareList.map(e => e.fitIQ) : [0])));
	let fitGap = $derived(compareList.length >= 2 ? compareList[0].fitIQ - compareList[1].fitIQ : null);

	// BR-UX-10: reframe fitGap as tier movement (e.g. "Grade B → Grade A", "Tight → Viable").
	let tierMovement = $derived.by(() => {
		if (compareList.length < 2) return null;
		const a = compareList[0].fitIQ;
		const b = compareList[1].fitIQ;
		if (a <= 0 || b <= 0) return null;
		const gA = fitGrade(a);
		const gB = fitGrade(b);
		const tA = fitTierLabel(a);
		const tB = fitTierLabel(b);
		return {
			gradeA: gA,
			gradeB: gB,
			tierA: tA,
			tierB: tB,
			sameTier: tA === tB,
			direction: a > b ? 'leads' : a < b ? 'trails' : 'ties'
		};
	});

	function gradeForScore(s: number): string {
		return s > 0 ? fitGrade(s) : '';
	}
	function tierForScore(s: number): string {
		return s > 0 ? fitTierLabel(s) : '';
	}

	const DIMS = [
		{ key: 'survivalRate', label: 'Survival Rate', highlight: true },
		{ key: 'transit', label: 'Transit' },
		{ key: 'demographics', label: 'Demographics' },
		{ key: 'competition', label: 'Competition' },
		{ key: 'vibrancy', label: 'Concept Pulse' },
		{ key: 'safety', label: 'Safety' },
		{ key: 'momentum', label: 'Momentum' },
	];

	const RANK_COLORS = ['#4a7c5c', '#2563EB', '#e8a838', '#8a8a8a', '#e8345a'];

	function gapColor(gap: number): string {
		if (gap > 0) return 'gap-pos';
		if (gap < 0) return 'gap-neg';
		return 'gap-tie';
	}

	function scoreColorStyle(s: number): string {
		if (s >= 70) return 'color:#4a7c5c';
		if (s >= 50) return 'color:#e8a838';
		return 'color:#e8345a';
	}

	function getDimScore(entry: CompareEntry, key: string): number {
		if (key === 'survivalRate') return entry.survivalRate;
		return Math.round(entry.scores[key] ?? 0);
	}

	async function addAndAnalyzeAddress() {
		const inputAddr = newAddrInput.trim();
		if (!inputAddr || addingAddr || compareList.length >= 5) return;

		addingAddr = true;
		addError = '';

		// Add a placeholder loading chip immediately
		const placeholder: CompareEntry = {
			addr: inputAddr,
			locationIQ: 0,
			fitIQ: 0,
			survivalRate: 0,
			scores: {},
			loading: true
		};
		compareList = [...compareList, placeholder];
		newAddrInput = '';

		try {
			// Step 1: Geocode the new address via Nominatim proxy
			const geoRes = await apiFetch(`/api/geo?type=nominatim&q=${encodeURIComponent(inputAddr)}&limit=1`);
			if (!geoRes.ok) throw new Error('Geocoding failed');
			const geoData = await geoRes.json();
			if (!Array.isArray(geoData) || geoData.length === 0) throw new Error('Address not found in NYC');

			const { lat: newLatStr, lon: newLonStr, display_name } = geoData[0];
			const newLat = parseFloat(newLatStr);
			const newLng = parseFloat(newLonStr);

			// Step 2: Get concept type from session
			let concept = 'specialty_coffee';
			try {
				const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
				concept = sess.canonicalConcept || sess.visionBizType || sess.bizType || sess.businessType || 'specialty_coffee';
			} catch { /* use default */ }

			// Step 3: Score via block-group-intel (pre-computed, <2s, no cross-location comparison needed —
			//   primary location scores are already in compareList[0] from localStorage)
			const bgRes = await apiFetch(`/api/block-group-intel?lat=${newLat}&lng=${newLng}&concept=${encodeURIComponent(concept)}`);
			if (!bgRes.ok) throw new Error('Could not score this location — it may be outside NYC');
			const bgData = await bgRes.json();
			if (!bgData.scores) throw new Error('No score data for this address');

			// Step 4: Map BlockGroupScores keys → compare dimension keys
			// scores.six_index holds the 6 sub-dimensions; survival_rate is a separate field
			const s = bgData.scores as { location_iq?: number; location_iq_v2?: number; survival_rate?: number; six_index?: { transit?: number; demographics?: number; competition?: number; vibrancy?: number; safety?: number; momentum?: number } };
			const six = s.six_index ?? {};
			const dimScores: Record<string, number> = {
				transit:      Math.round(six.transit      ?? 0),
				demographics: Math.round(six.demographics ?? 0),
				competition:  Math.round(six.competition  ?? 0),
				vibrancy:     Math.round(six.vibrancy     ?? 0),
				safety:       Math.round(six.safety       ?? 0),
				momentum:     Math.round(six.momentum     ?? 0),
			};
			const survivalRate = Math.round(s.survival_rate ?? 0);
			const locationIQ   = Math.round(s.location_iq ?? s.location_iq_v2 ?? 0);
			const resolvedAddr = display_name?.split(',').slice(0, 2).join(',') || inputAddr;

			// Replace placeholder with real scored entry
			compareList = compareList.map(e =>
				e.addr === inputAddr && e.loading
					? { addr: resolvedAddr, locationIQ, fitIQ: locationIQ, survivalRate, scores: dimScores }
					: e
			);

			// Auto-trigger AI comparison now that we have 2 locations
			if (compareList.length >= 2 && !aiNarrative) {
				fetchAIComparison();
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Could not score this address';
			addError = msg;
			// Remove the failed placeholder
			compareList = compareList.filter(e => !(e.addr === inputAddr && e.loading));
		}

		addingAddr = false;
	}

	async function fetchAIComparison() {
		if (compareList.length < 2) return;
		aiLoading = true;
		try {
			const res = await apiFetch('/api/ai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'compare',
					locations: compareList.map(e => ({
						address: e.addr,
						locationIQ: e.locationIQ,
						fitIQ: e.fitIQ,
						survivalRate: e.survivalRate,
						scores: e.scores
					}))
				})
			});
			if (res.ok) {
				const data = await res.json();
				aiNarrative = data.narrative || data.text || '';
			}
		} catch { /* silently skip */ }
		aiLoading = false;
	}

	// Produces a consistent ≤14-char label for table column headers.
	// Strips geocoding comma-artifacts (e.g. "215, West 90th" → "215 West 90th"),
	// then trims at the last whole-word boundary that fits within 14 characters.
	function shortAddr(addr: string): string {
		const firstPart = addr.split(/,\s*(?=New York|NY\s|\d{5})/i)[0];
		const street = firstPart.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
		if (street.length <= 14) return street;
		const words = street.split(' ');
		let result = '';
		for (const w of words) {
			const candidate = result ? `${result} ${w}` : w;
			if (candidate.length > 14) break;
			result = candidate;
		}
		return result || street.slice(0, 14);
	}

	onMount(() => {
		try {
			const loc = JSON.parse(localStorage.getItem('re2_selected_location') || '{}');
			address = loc.addr || '';
			neighborhood = loc.neighborhood || '';
		} catch {}
		try {
			const session = JSON.parse(localStorage.getItem('re2_session') || '{}');
			primaryLocationIQ = session.locationIQ || 0;
			primaryFitIQ = session.fitScore || 0;
			primarySixScores = session.sixScores || {};
		} catch {}
		try {
			const intel = JSON.parse(localStorage.getItem('re2_location_intel') || '{}');
			const sr = intel.survivalRate ?? intel.survival_rate ?? 0;
			if (address) {
				compareList = [{
					addr: address,
					locationIQ: primaryLocationIQ,
					fitIQ: primaryFitIQ,
					survivalRate: Math.round(sr),
					scores: primarySixScores
				}];
			}
		} catch {
			if (address) {
				compareList = [{
					addr: address,
					locationIQ: primaryLocationIQ,
					fitIQ: primaryFitIQ,
					survivalRate: 0,
					scores: primarySixScores
				}];
			}
		}
	});
</script>

<svelte:head>
	<title>RE² — Compare Mode</title>
</svelte:head>

<div class="brain-page">
	<!-- TOOL STRIP -->
	<div class="tools-strip">
		<a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Overview</a>
		<div class="tools-sep"></div>
		<a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab back-tab">← Score</a>
		<div class="tools-sep"></div>
		<a href="/app/brain/compare{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab active">Compare</a>
		<a href="/app/brain/success-map{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Success Map</a>
		<a href="/app/brain/daypart{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Daypart Traffic</a>
		<a href="/app/brain/segments{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Segment Intel</a>
		<a href="/app/brain/street{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Street View</a>
		<a href="/app/brain/transparency{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Score Breakdown</a>
	</div>
	<!-- PAGE BODY -->
	<div class="page-body">
		<div class="page-title-row">
			<span class="page-label">Compare Mode</span>
		</div>
		<div class="page-title">Side-by-Side Location Comparison</div>
		<div class="page-desc">Compare up to 5 locations head-to-head. Survival Rate leads the table — it's the highest-weight predictor of real business outcomes.</div>

		{#if !address}
			<div class="no-data-state">
				<p>No location has been analyzed yet. <a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}">Analyze a location</a> to start comparing.</p>
			</div>
		{:else}
			<div class="compare-frame">
				<!-- Address chips + add button -->
				<div class="compare-topbar">
					{#each compareList as entry, i}
						<div class="compare-addr-chip" class:chip-loading={entry.loading}>
							<span class="rank" style="background:{RANK_COLORS[i] ?? '#8a8a8a'}">{i + 1}</span>
							{entry.loading ? 'Scoring…' : (entry.addr.length > 28 ? entry.addr.slice(0, 26) + '…' : entry.addr)}
						</div>
					{/each}
					{#if compareList.length < 5}
						<div class="add-addr-row">
							<input
								class="add-addr-input"
								placeholder="+ Add address to compare"
								bind:value={newAddrInput}
								disabled={addingAddr}
								onkeydown={(e) => { if (e.key === 'Enter') addAndAnalyzeAddress(); }}
							/>
							<button
								class="add-addr-btn"
								disabled={addingAddr || !newAddrInput.trim()}
								onclick={addAndAnalyzeAddress}
							>
								{addingAddr ? '…' : 'Add'}
							</button>
						</div>
						{#if addError}
							<div class="add-error">{addError}</div>
						{/if}
					{/if}
				</div>

				{#if compareList.length > 0}
					<!-- Score hero row (grade + tier pill replaces raw "Your Score" label) -->
					<div class="compare-hero" style="grid-template-columns: repeat({compareList.length}, 1fr)">
						{#each compareList as entry, i}
							<div class="compare-hero-cell">
								<div class="compare-score-big" style={scoreColorStyle(entry.fitIQ)}>{entry.fitIQ || '—'}</div>
								{#if entry.fitIQ > 0}
									{@const g = gradeForScore(entry.fitIQ)}
									<span class="compare-grade-pill grade-{g.toLowerCase()}">Grade {g} · {tierForScore(entry.fitIQ)}</span>
								{:else}
									<div class="compare-score-label">Your Score</div>
								{/if}
							</div>
						{/each}
					</div>
					{#if tierMovement}
						<div class="compare-tier-movement">
							{#if tierMovement.sameTier}
								Both in <strong>{tierMovement.tierA}</strong> territory (Grade {tierMovement.gradeA} vs Grade {tierMovement.gradeB}) — a {fitGap !== null && fitGap >= 0 ? '+' : ''}{fitGap}-point difference within the same tier.
							{:else}
								Location 1 is <strong>Grade {tierMovement.gradeA} · {tierMovement.tierA}</strong> vs Location 2 at <strong>Grade {tierMovement.gradeB} · {tierMovement.tierB}</strong> — tier movement of {fitGap !== null && fitGap >= 0 ? '+' : ''}{fitGap} points.
							{/if}
						</div>
					{/if}

					<!-- H2H table -->
					<div class="h2h-scroll">
						<table class="h2h-table">
							<thead>
								<tr>
									<th style="width:140px; text-align:left">Dimension</th>
									{#each compareList as entry, i}
										<th class="addr-col-th">{shortAddr(entry.addr)}</th>
									{/each}
									{#if compareList.length >= 2}
										<th style="width:80px">GAP ①vs②<div style="font-size:9px;color:#9ca3af;font-weight:400;letter-spacing:0">+ means loc 1 leads</div></th>
									{/if}
								</tr>
							</thead>
							<tbody>
								{#each DIMS as dim}
									{@const scores = compareList.map(e => getDimScore(e, dim.key))}
									{@const maxScore = Math.max(...scores)}
									{@const gap1v2 = compareList.length >= 2 ? scores[0] - scores[1] : null}
									<tr class:highlight-row={dim.highlight}>
										<td class:dim-highlight={dim.highlight} style={dim.highlight ? 'color:#e8a838;font-weight:700' : ''}>{dim.label}</td>
										{#each scores as s, i}
											<td class:h2h-winner={s === maxScore && s > 0} style={dim.highlight ? 'font-weight:700' : ''}>
												{s > 0 ? s : '—'}
											</td>
										{/each}
										{#if gap1v2 !== null}
											<td>
												{#if gap1v2 !== 0 && scores[0] > 0 && scores[1] > 0}
													<span class="h2h-gap {gapColor(gap1v2)}">{gap1v2 > 0 ? '+' : ''}{gap1v2}</span>
												{:else}
													<span class="h2h-gap gap-tie">—</span>
												{/if}
											</td>
										{/if}
									</tr>
								{/each}
								<!-- Fit IQ final row -->
								<tr class="final-row">
									<td style="font-weight:700">Your Score (Final)</td>
									{#each fitScores as s}
										<td class:h2h-winner={s === maxFit && s > 0} style="font-weight:800">{s > 0 ? s : '—'}</td>
									{/each}
									{#if fitGap !== null}
										<td>
											{#if fitGap !== 0 && fitScores[0] > 0 && fitScores[1] > 0}
												<span class="h2h-gap {gapColor(fitGap)}">{fitGap > 0 ? '+' : ''}{fitGap}</span>
											{:else}
												<span class="h2h-gap gap-tie">—</span>
											{/if}
										</td>
									{/if}
								</tr>
							</tbody>
						</table>
					</div>

					<!-- AI Comparison Narrative -->
					{#if compareList.length >= 2}
						<div class="compare-rec">
							<div class="compare-rec-header">
								<span class="compare-rec-title">RE² Recommendation</span>
								{#if !aiNarrative && !aiLoading}
									<button class="gen-btn" onclick={fetchAIComparison}>Generate Analysis</button>
								{/if}
							</div>
							{#if aiLoading}
								<div class="ai-loading">Analyzing locations…</div>
							{:else if aiNarrative}
								<div class="compare-rec-body">{aiNarrative}</div>
							{:else}
								<div class="compare-rec-placeholder">Add a second location above and click "Generate Analysis" to get an AI comparison.</div>
							{/if}
						</div>
					{:else}
						<div class="compare-rec compare-rec-empty">
							Add a second address above to unlock side-by-side comparison and AI recommendation.
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	:root {
		--sage: #4a7c5c;
		--hot-pink: #e8345a;
		--deep-green: #1a3a2a;
		--marigold: #e8a838;
		--accent: var(--sage);
		--bg: #faf7f2;
		--surface: #ffffff;
		--text: #2c2c2c;
		--text-light: #666666;
		--border: #e8e2d8;
		--sage-light: #e8f2ec;
		--sage-bg: rgba(74, 124, 92, 0.08);
	}
	.brain-page { min-height: 100vh; background: var(--bg); font-family: 'DM Sans', -apple-system, sans-serif; color: var(--text); }
	.topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: rgba(250,247,242,0.96); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); height: 56px; position: sticky; top: 0; z-index: 200; }
	.topbar-left { display: flex; align-items: center; gap: 16px; }
	.logo { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 400; color: var(--text); text-decoration: none; letter-spacing: -0.3px; }
	.logo sup { color: var(--hot-pink); font-size: 11px; }
	.sep { width: 1px; height: 20px; background: var(--border); }
	.addr { font-size: 13px; color: var(--text-light); font-weight: 600; }
	.addr-sub { font-size: 11px; color: var(--text-light); margin-left: 6px; font-weight: 400; }
	.addr-empty { font-style: italic; opacity: 0.5; }
	.topbar-right { display: flex; gap: 8px; align-items: center; }
	.tb-btn { font-size: 12px; padding: 6px 14px; border-radius: 8px; text-decoration: none; border: 1px solid var(--border); color: var(--text-light); background: var(--surface); cursor: pointer; font-family: inherit; font-weight: 500; transition: all 0.2s; }
	.tb-btn.pri { background: var(--deep-green); color: white; border-color: var(--deep-green); font-weight: 600; }
	.tb-btn:hover { border-color: var(--sage); }
	.tb-btn.pri:hover { background: #0f2218; }
	.tools-strip { display: flex; align-items: center; gap: 2px; padding: 0 14px; background: var(--surface); border-bottom: 1px solid var(--border); height: 42px; overflow-x: auto; flex-shrink: 0; position: sticky; top: 56px; z-index: 190; }
	.tools-strip::-webkit-scrollbar { display: none; }
	.tool-tab { display: flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; color: var(--text-light); text-decoration: none; white-space: nowrap; transition: all 0.15s; border: 1px solid transparent; font-family: inherit; }
	.tool-tab:hover { background: #f5f0e8; color: var(--text); }
	.tool-tab.active { background: var(--deep-green); color: white; }
	.tools-sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; flex-shrink: 0; }
	.page-body { max-width: 1100px; margin: 0 auto; padding: 28px 24px 80px; }
	.page-title-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
	.page-label { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--sage); background: var(--sage-bg); padding: 3px 10px; border-radius: 4px; }
	.page-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 400; letter-spacing: -0.3px; color: var(--text); margin-bottom: 4px; }
	.page-desc { color: var(--text-light); font-size: 13px; margin-bottom: 24px; max-width: 700px; line-height: 1.5; }
	.no-data-state { padding: 40px; text-align: center; color: var(--text-light); font-size: 14px; }
	.no-data-state a { color: var(--sage); }

	.compare-frame { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
	.compare-topbar { display: flex; align-items: center; gap: 8px; padding: 14px 20px; background: #f5f0e8; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
	.compare-addr-chip { display: flex; align-items: center; gap: 8px; padding: 7px 14px; background: #ede8e0; border: 1px solid var(--border); border-radius: 10px; font-size: 13px; font-weight: 600; }
	.chip-loading { opacity: 0.6; animation: pulse-dot 1.5s infinite; }
	.rank { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; flex-shrink: 0; }
	.add-addr-row { flex: 1; min-width: 200px; display: flex; gap: 6px; }
	.add-addr-input { flex: 1; padding: 7px 14px; border: 1px dashed var(--border); border-radius: 10px; font-size: 13px; background: var(--surface); font-family: inherit; color: var(--text); outline: none; }
	.add-addr-input:focus { border-color: var(--sage); }
	.add-addr-input:disabled { opacity: 0.6; cursor: not-allowed; }
	.add-addr-btn { padding: 7px 16px; border-radius: 10px; background: var(--deep-green); color: white; border: none; cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit; flex-shrink: 0; }
	.add-addr-btn:hover:not(:disabled) { background: #0f2218; }
	.add-addr-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.add-error { font-size: 12px; color: var(--hot-pink); padding: 4px 4px 0; width: 100%; }

	.compare-hero { display: grid; gap: 1px; background: var(--border); }
	.compare-hero-cell { background: var(--surface); padding: 20px 14px; text-align: center; }
	.compare-score-big { font-size: 36px; font-weight: 800; letter-spacing: -1px; }
	.compare-score-label { font-size: 11px; color: var(--text-light); margin-top: 2px; }
	/* BR-UX-10: grade pill replaces raw "Your Score" label */
	.compare-grade-pill {
		display: inline-block;
		margin-top: 6px;
		padding: 3px 10px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 700;
		white-space: nowrap;
	}
	.compare-grade-pill.grade-a { background: #d1fae5; color: #065f46; }
	.compare-grade-pill.grade-b { background: #e0f2fe; color: #075985; }
	.compare-grade-pill.grade-c { background: #fef3c7; color: #92400e; }
	.compare-grade-pill.grade-d { background: #ffedd5; color: #9a3412; }
	.compare-grade-pill.grade-f { background: #fee2e2; color: #991b1b; }
	.compare-tier-movement {
		margin: 14px 0 6px;
		padding: 10px 14px;
		background: rgba(0, 232, 204, 0.06);
		border: 1px solid rgba(0, 232, 204, 0.18);
		border-radius: 8px;
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-primary, #111827);
	}
	.compare-tier-movement strong { color: var(--text-primary, #111827); font-weight: 700; }

	.h2h-scroll { overflow-x: auto; }
	.h2h-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
	.h2h-table th, .h2h-table td { padding: 11px 14px; text-align: center; font-size: 13px; border-bottom: 1px solid var(--border); }
	.h2h-table th { background: #f5f0e8; font-weight: 600; color: var(--text-light); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
	.addr-col-th { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.h2h-table th:first-child, .h2h-table td:first-child { text-align: left; font-weight: 600; }
	.h2h-winner { background: var(--sage-bg); color: var(--sage); font-weight: 700; border-left: 2px solid rgba(74,124,92,0.3); }
	.highlight-row { background: rgba(232,168,56,0.04); }
	.final-row { background: #f5f0e8; }
	.h2h-gap { font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; }
	.gap-pos { background: var(--sage-bg); color: var(--sage); }
	.gap-neg { background: rgba(232,52,90,0.08); color: var(--hot-pink); }
	.gap-tie { background: #ede8e0; color: var(--text-light); }

	.compare-rec { margin: 0 20px 20px; padding: 20px 24px; background: #f5f0e8; border-radius: 12px; border-left: 3px solid var(--sage); }
	.compare-rec-empty { color: var(--text-light); font-size: 13px; border-left-color: var(--border); margin-top: 16px; }
	.compare-rec-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
	.compare-rec-title { font-size: 14px; font-weight: 700; }
	.gen-btn { font-size: 12px; padding: 6px 14px; border-radius: 8px; background: var(--deep-green); color: white; border: none; cursor: pointer; font-family: inherit; font-weight: 600; }
	.gen-btn:hover { background: #0f2218; }
	.compare-rec-body { font-size: 13px; color: var(--text-light); line-height: 1.6; }
	.compare-rec-placeholder { font-size: 13px; color: var(--text-light); font-style: italic; }
	.ai-loading { font-size: 13px; color: var(--text-light); }
</style>
