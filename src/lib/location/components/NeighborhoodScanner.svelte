<script lang="ts">
	import type { LocationStore, ScrapeResult } from '../store.svelte';
	import { HOODS, HOOD_DATA } from '../data/constants';
	import { scanArea, getConceptScanRadius, fetchLiveIntel, enrichStationsFromMTA, intelToHoodScores } from '../api/geo';
	import { blockScore } from '../scoring/engines';
	import { fmtD, fitClass, scoreColor } from '../utils/helpers';
	import VacancyListings from './VacancyListings.svelte';

	let { store }: { store: LocationStore } = $props();

	async function doScanNeighborhood() {
		const selectedHood = HOODS.find(h => h.name === store.selectedNeighborhood);
		if (!selectedHood) { alert('Neighborhood not found'); return; }

		store.scraping = true;
		try {
			const hoodRadius = getConceptScanRadius(store.bizCategory);
			const dataPromise = scanArea(selectedHood.lat, selectedHood.lon, hoodRadius, store.bizCategory);
			const intelPromise = fetchLiveIntel(selectedHood.lat, selectedHood.lon, store.bizType, selectedHood.name + ', New York, NY');
			const [rawData, liveIntel] = await Promise.all([dataPromise, intelPromise]);
			const data = enrichStationsFromMTA(rawData, liveIntel);
			const sc = blockScore(data);
			store.scrapeResults = { ...store.scrapeResults, [selectedHood.name]: { data, score: sc, ts: Date.now(), error: null, liveIntel } };
		} catch (e: unknown) {
			store.scrapeResults = { ...store.scrapeResults, [selectedHood.name]: { error: e instanceof Error ? e.message : String(e), score: { total: 0, grade: 'C', comp: 0, gym: 0, yoga: 0, health: 0, transit: 0, wellness: 0 }, ts: Date.now(), data: null } };
		}
		store.scraping = false;
		store.expandedHood = store.selectedNeighborhood;
	}

	async function doScrape() {
		const hoods = HOODS.filter(h => h.borough === store.scrapeBorough);
		store.scraping = true;
		store.scrapeQueue = hoods.map(h => h.name);
		const scrapeRadius = getConceptScanRadius(store.bizCategory);
		for (let i = 0; i < hoods.length; i++) {
			const h = hoods[i];
			store.scrapeQueue = hoods.slice(i).map(x => x.name);
			try {
				const dataPromise = scanArea(h.lat, h.lon, scrapeRadius, store.bizCategory);
				const intelPromise = fetchLiveIntel(h.lat, h.lon, store.bizType, h.name + ', New York, NY');
				const [rawData, liveIntel] = await Promise.all([dataPromise, intelPromise]);
				const data = enrichStationsFromMTA(rawData, liveIntel);
				const sc = blockScore(data);
				store.scrapeResults = { ...store.scrapeResults, [h.name]: { data, score: sc, ts: Date.now(), error: null, liveIntel } };
			} catch (e: unknown) {
				store.scrapeResults = { ...store.scrapeResults, [h.name]: { error: e instanceof Error ? e.message : String(e), score: { total: 0, grade: 'C', comp: 0, gym: 0, yoga: 0, health: 0, transit: 0, wellness: 0 }, ts: Date.now(), data: null } };
			}
		}
		store.scraping = false;
		store.scrapeQueue = [];
	}

	function toggleHoodExpand(name: string) {
		store.expandedHood = store.expandedHood === name ? null : name;
		store.selectedNeighborhood = name;
	}

	function handleHoodClick(hoodName: string) {
		const res = store.scrapeResults[hoodName];
		if (res?.data) {
			toggleHoodExpand(hoodName);
		} else {
			store.selectedNeighborhood = hoodName;
			doScanNeighborhood();
		}
	}

	function getHoodCompositeScore(hoodName: string): number {
		const hd = HOOD_DATA[hoodName];
		if (!hd) return 0;
		const rentScore = Math.max(0, 100 - hd.rentPSF / 2);
		const wageScore = Math.max(0, 100 - hd.wageBase / 0.3);
		return Math.max(0, Math.min(100, Math.round(hd.demScore * 0.3 + rentScore * 0.2 + hd.trend * 0.2 + hd.crimeScore * 0.15 + wageScore * 0.15)));
	}

	let hoods = $derived(
		HOODS.filter(h => h.borough === store.scrapeBorough)
			.sort((a, b) => {
				const sa = store.scrapeResults[a.name];
				const sb = store.scrapeResults[b.name];
				if (sa && sb) return sb.score.total - sa.score.total;
				if (sa) return -1;
				if (sb) return 1;
				return 0;
			})
	);

	let top3 = $derived(
		hoods.slice(0, 3).filter(h => store.scrapeResults[h.name]?.score)
	);

	let hoodNames = $derived(
		HOODS.map(h => h.name).filter((v, i, a) => a.indexOf(v) === i).sort()
	);
</script>

<div class="section">
	<div class="section-header">
		<div class="pane-label">🗺️ NEIGHBORHOOD SCANNER</div>
		<div class="section-desc">Click any neighborhood below to scan it, or use the dropdown to select one. The primary location above feeds Recommendations and Financials.</div>
	</div>

	<div class="scanner-controls">
		<select bind:value={store.selectedNeighborhood}>
			{#each hoodNames as name}
				<option value={name}>{name}</option>
			{/each}
		</select>
		<button class="btn btn-cyan btn-sm" onclick={doScanNeighborhood} disabled={store.scraping}>SCAN THIS NEIGHBORHOOD</button>
		<button class="btn btn-sec btn-sm" onclick={doScrape} disabled={store.scraping}>
			{store.scraping ? `SCANNING ${store.scrapeQueue.length} LEFT...` : 'SCAN ALL NEIGHBORHOODS'}
		</button>
	</div>

	<div class="hood-grid">
		{#each hoods as hood}
			{@const res = store.scrapeResults[hood.name]}
			{@const scanning = store.selectedNeighborhood === hood.name && store.scraping}
			{@const queued = store.scrapeQueue.indexOf(hood.name) > 0}
			{@const fc = res?.score ? fitClass(res.score.grade) : 'grey'}
			{@const isExpanded = store.expandedHood === hood.name && res?.data}

			<div
				class="hood-card"
				class:selected={store.selectedNeighborhood === hood.name}
				class:expanded={isExpanded}
				class:hood-scanning={scanning}
				onclick={() => handleHoodClick(hood.name)}
			>
				<div class="fit-dot {fc}"></div>
				<div class="hood-info">
					<div class="hood-name">
						{hood.name}
						{#if res?.score}
							<span class="hood-grade" style="color:{scoreColor(res.score.total)}">
								{res.score.grade === 'A' ? 'STRONG FIT' : res.score.grade === 'B' ? 'MODERATE FIT' : 'WEAK FIT'}
							</span>
						{/if}
					</div>

					{#if res && !res.error && res.data}
						<div class="hood-stats">
							<span>☕ {res.data.cafes.length} cafes</span>
							<span>💪 {res.data.gyms.length} gyms</span>
							<span>🧘 {res.data.yoga.length} yoga</span>
							<span>🚇 {res.data.stations.length} stations</span>
						</div>
					{:else if res?.error}
						<div style="font-size:12px;color:var(--redtag);font-family:'DM Mono',monospace">Error: {res.error.substring(0, 50)}</div>
					{:else if scanning}
						<div style="font-size:13px;color:var(--gold);font-family:'DM Mono',monospace">⏳ Scanning Overpass API — finding cafes, gyms, transit...</div>
					{:else if queued}
						<div class="hood-stats"><span style="color:var(--muted)">⏳ Queued</span></div>
					{:else}
						{@const hd = HOOD_DATA[hood.name]}
						{#if hd}
							{@const compositeScore = getHoodCompositeScore(hood.name)}
							<div class="hood-stats">
								<div style="margin-bottom:8px;font-weight:600;font-size:18px;color:{scoreColor(compositeScore)}">{compositeScore}</div>
								<span style="font-size:12px;color:var(--sub);display:block;margin-bottom:6px">Rent: ${hd.rentPSF}/sqft</span>
								<span style="font-size:12px;color:var(--sub);display:block;margin-bottom:6px">Demo: {hd.demScore} | Trend: {hd.trend}</span>
								<span style="color:var(--cyan);font-size:12px">Click for detailed analysis →</span>
							</div>
						{:else}
							<div class="hood-stats"><span style="color:var(--cyan);font-size:13px">Click to scan live data →</span></div>
						{/if}
					{/if}

					<!-- Expanded Detail Panel -->
					{#if isExpanded && res?.data}
						{@const sc = res.score}
						{@const hd = HOOD_DATA[hood.name] || { demScore: 60, rentPSF: 100, trend: 60, crimeScore: 60, wageBase: 16 }}
						{@const li = res.liveIntel || null}
						{@const demScore = li?.census ? intelToHoodScores(li).demScore : hd.demScore}
						{@const crimeVal = li?.crime ? li.crime.crimeScore : hd.crimeScore}

						<div class="hood-detail">
							{#if li}
								<div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--cyan);margin-bottom:8px;letter-spacing:1px">● LIVE DATA FROM CENSUS + NYPD + WALK SCORE</div>
							{/if}

							<div style="margin-bottom:14px">
								<span class="hood-verdict {fc}">
									{sc.total}/100 — {sc.grade === 'A' ? 'STRONG GO' : sc.grade === 'B' ? 'PROCEED WITH CAUTION' : 'HIGH RISK'}
								</span>
							</div>

							{#if li}
								<div class="live-data-grid">
									{#if li.census}
										<div class="data-box"><div class="data-box-label">MED. INCOME</div><div class="data-box-val" style="color:var(--green)">${Math.round(li.census.medianHouseholdIncome / 1000)}k</div></div>
										<div class="data-box"><div class="data-box-label">POPULATION</div><div class="data-box-val">{li.census.totalPopulation.toLocaleString()}</div></div>
									{/if}
									{#if li.crime}
										<div class="data-box"><div class="data-box-label">SAFETY SCORE</div><div class="data-box-val" style="color:{scoreColor(li.crime.crimeScore)}">{li.crime.crimeScore}</div></div>
									{/if}
									{#if li.walkScore}
										<div class="data-box"><div class="data-box-label">WALK SCORE</div><div class="data-box-val" style="color:{scoreColor(li.walkScore.walkScore)}">{li.walkScore.walkScore}</div></div>
									{/if}
								</div>
							{/if}

							<!-- Metric Grid -->
							<div class="hood-detail-grid">
								{#each [
									{ l: 'COMPETITION', v: sc.comp, c: 'var(--cyan)', explain: `${res.data.cafes.length + res.data.gyms.length + res.data.yoga.length + res.data.health.length} competitors nearby — ${sc.comp >= 70 ? 'low competition, good' : 'high competition, risky'}` },
									{ l: 'WELLNESS ECO', v: sc.wellness, c: 'var(--purple)', explain: `${res.data.gyms.length} gyms + ${res.data.yoga.length} yoga — ${sc.wellness >= 60 ? 'strong wellness traffic' : 'weak wellness traffic'}` },
									{ l: 'TRANSIT ACCESS', v: sc.transit, c: 'var(--gold)', explain: `${res.data.stations.length} subway stations — ${sc.transit >= 60 ? 'excellent foot traffic' : 'limited foot traffic'}` },
									{ l: 'SAFETY', v: crimeVal, c: 'var(--green)', explain: li?.crime ? `${li.crime.totalCount} incidents in 6mo (${li.crime.violentCount} violent)` : 'Neighborhood safety estimate' },
									{ l: 'RENT / SQFT', v: hd.rentPSF, c: 'var(--red)', explain: `$${hd.rentPSF}/sqft avg — ${hd.rentPSF <= 120 ? 'affordable' : 'premium pricing'}` },
									{ l: 'DEMOGRAPHICS', v: demScore, c: 'var(--blue)', explain: li?.census ? `$${Math.round(li.census.medianHouseholdIncome / 1000)}k income, ${li.census.bachelorsPlusPercent}% college-educated` : 'Income, age, wellness index alignment' },
								] as m}
									<div class="hood-metric">
										<div class="hood-metric-label">{m.l}</div>
										<div class="hood-metric-val" style="color:{m.c}">{m.v}</div>
										<div class="hood-metric-bar"><div class="hood-metric-fill" style="width:{m.v}%;background:{m.c}"></div></div>
										<div style="font-size:11px;color:var(--sub);margin-top:4px;line-height:1.4">{m.explain}</div>
									</div>
								{/each}
							</div>

							<!-- POI Lists -->
							{#if res.data.cafes.length > 0}
								<div class="hood-poi-list">
									<div class="poi-title">☕ NEARBY CAFES ({res.data.cafes.length})</div>
									{#each res.data.cafes.slice(0, 5) as c}
										<div class="hood-poi-item"><span class="hood-poi-name">{c.name}</span><span class="hood-poi-dist">{fmtD(c.dist)}</span></div>
									{/each}
									{#if res.data.cafes.length > 5}<div style="font-size:11px;color:var(--muted);padding:4px 0">+{res.data.cafes.length - 5} more...</div>{/if}
								</div>
							{/if}
							{#if res.data.gyms.length > 0}
								<div class="hood-poi-list">
									<div class="poi-title">💪 NEARBY GYMS ({res.data.gyms.length})</div>
									{#each res.data.gyms.slice(0, 5) as g}
										<div class="hood-poi-item"><span class="hood-poi-name">{g.name}</span><span class="hood-poi-dist">{fmtD(g.dist)}</span></div>
									{/each}
								</div>
							{/if}
							{#if res.data.stations.length > 0}
								<div class="hood-poi-list">
									<div class="poi-title">🚇 TRANSIT STATIONS ({res.data.stations.length})</div>
									{#each res.data.stations.slice(0, 5) as s}
										<div class="hood-poi-item"><span class="hood-poi-name">{s.name}</span><span class="hood-poi-dist">{fmtD(s.dist)}</span></div>
									{/each}
								</div>
							{/if}

							<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
								<a class="broker-chip" href="https://www.loopnet.com/search/retail-space/{encodeURIComponent(hood.name + ' New York NY')}/for-lease/" target="_blank" onclick={(e) => e.stopPropagation()}>🔍 LoopNet</a>
								<a class="broker-chip" href="https://42floors.com/for-lease/retail/us/ny/new-york-city" target="_blank" onclick={(e) => e.stopPropagation()}>🔍 42floors</a>
							</div>

							<!-- Vacancy Listings for this neighborhood -->
							<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
							<div onclick={(e) => e.stopPropagation()} style="margin-top:16px">
								<VacancyListings lat={hood.lat} lng={hood.lon} radius={600} compact={true} />
							</div>
						</div>
					{/if}
				</div>

				<!-- Score Column -->
				{#if res?.score}
					<div class="hood-score {fc}">{res.score.total}</div>
				{:else if HOOD_DATA[hood.name]}
					{@const cs = getHoodCompositeScore(hood.name)}
					<div class="hood-score {cs >= 75 ? 'green' : cs >= 55 ? 'yellow' : 'red'}">{cs}</div>
				{:else}
					<div class="hood-score grey">--</div>
				{/if}

				{#if !isExpanded}
					<div class="hood-brokers">
						<a class="broker-chip" href="https://www.loopnet.com/search/retail-space/{encodeURIComponent(hood.name + ' New York NY')}/for-lease/" target="_blank" onclick={(e) => e.stopPropagation()}>LoopNet</a>
						<a class="broker-chip" href="https://42floors.com/for-lease/retail/us/ny/new-york-city" target="_blank" onclick={(e) => e.stopPropagation()}>42floors</a>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Top 3 Recommendations -->
	{#if top3.length > 0}
		<div class="top3-box">
			<div class="top3-title">TOP 3 RECOMMENDATIONS</div>
			<div class="top3-content">
				{#each top3 as hood, idx}
					{@const res = store.scrapeResults[hood.name]}
					{@const insight = idx === 0 ? 'Best overall fit. Lower rent, strong demographics.' : idx === 1 ? 'Your current target. Good but watch rent burden.' : 'Strong brand alignment but higher competition.'}
					<div style="margin-bottom:8px">
						<strong style="color:var(--text)">{idx + 1}. {hood.name} ({res.score.total})</strong> — {insight}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.section { background: var(--bg2); border: 1px solid var(--border); border-radius: 14px; padding: 28px; margin-bottom: 18px; }
	.section-header { border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px; }
	.pane-label { font-size: 10px; font-family: 'DM Mono', monospace; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
	.section-desc { font-size: 14px; color: var(--sub); line-height: 1.6; }

	.scanner-controls { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
	select { font-family: 'DM Mono', monospace; outline: none; font-size: 14px; background: var(--bg3); border: 1px solid var(--border); color: var(--text); padding: 12px 16px; border-radius: 8px; }
	.btn { padding: 14px 24px; border-radius: 10px; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; color: var(--text); cursor: pointer; font-family: inherit; border: none; transition: all 0.15s; }
	.btn-cyan { background: var(--cyan); color: #000; }
	.btn-cyan:hover { background: #33edd8; }
	.btn-sec { background: var(--bg3); border: 1px solid var(--border); color: var(--sub); }
	.btn-sec:hover { border-color: var(--cyan); color: var(--cyan); }
	.btn-sm { padding: 8px 16px; font-size: 11px; border-radius: 8px; }

	.hood-grid { display: flex; flex-direction: column; gap: 10px; }
	.hood-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 18px 22px; display: flex; align-items: center; gap: 16px; transition: all 0.15s; cursor: pointer; }
	.hood-card:hover { border-color: var(--cyan); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,232,204,0.08); }
	.hood-card.selected { border-color: var(--red); background: var(--bg3); box-shadow: 0 0 0 1px var(--red); }
	.hood-card.hood-scanning { animation: hood-pulse 1.5s ease-in-out infinite; }
	@keyframes hood-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }

	.fit-dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; border: 2px solid; }
	.fit-dot.green { background: var(--green); border-color: var(--green); }
	.fit-dot.yellow { background: var(--yellow); border-color: var(--yellow); }
	.fit-dot.red { background: var(--redtag); border-color: var(--redtag); }
	.fit-dot.grey { background: var(--border); border-color: var(--border); }

	.hood-info { flex: 1; min-width: 0; }
	.hood-name { font-size: 16px; font-weight: 700; }
	.hood-grade { font-size: 11px; font-weight: 600; margin-left: 8px; font-family: 'DM Mono', monospace; }
	.hood-stats { font-size: 12px; color: var(--muted); font-family: 'DM Mono', monospace; margin-top: 4px; display: flex; gap: 14px; flex-wrap: wrap; }

	.hood-score { font-size: 24px; font-weight: 800; font-family: 'DM Mono', monospace; flex-shrink: 0; width: 55px; text-align: right; }
	.hood-score.green { color: var(--green); }
	.hood-score.yellow { color: var(--yellow); }
	.hood-score.red { color: var(--redtag); }
	.hood-score.grey { color: var(--border); }

	.hood-brokers { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
	.broker-chip { font-size: 10px; padding: 4px 10px; border-radius: 4px; background: var(--bg3); border: 1px solid var(--border); color: var(--sub); font-family: 'DM Mono', monospace; text-decoration: none; transition: all 0.15s; }
	.broker-chip:hover { border-color: var(--cyan); color: var(--cyan); text-decoration: none; }

	/* Expanded Detail */
	.hood-detail { border-top: 1px solid var(--border); padding: 16px 0 0; margin-top: 14px; }
	.hood-verdict { display: inline-block; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; font-family: 'DM Mono', monospace; letter-spacing: 0.5px; }
	.hood-verdict.green { background: rgba(52,211,153,0.12); color: var(--green); border: 1px solid rgba(52,211,153,0.3); }
	.hood-verdict.yellow { background: rgba(251,191,36,0.12); color: var(--yellow); border: 1px solid rgba(251,191,36,0.3); }
	.hood-verdict.red { background: rgba(239,68,68,0.12); color: var(--redtag); border: 1px solid rgba(239,68,68,0.3); }

	.live-data-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
	.data-box { background: var(--bg3); border-radius: 8px; padding: 10px 12px; border: 1px solid var(--border); }
	.data-box-label { font-size: 11px; color: var(--muted); font-family: 'DM Mono', monospace; letter-spacing: 0.5px; margin-bottom: 4px; }
	.data-box-val { font-size: 18px; font-weight: 700; }

	.hood-detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
	@media (max-width: 600px) { .hood-detail-grid { grid-template-columns: repeat(2, 1fr); } }
	.hood-metric { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
	.hood-metric-label { font-size: 10px; color: var(--muted); font-family: 'DM Mono', monospace; letter-spacing: 0.5px; margin-bottom: 3px; }
	.hood-metric-val { font-size: 18px; font-weight: 700; }
	.hood-metric-bar { height: 5px; background: var(--border); border-radius: 3px; margin-top: 6px; overflow: hidden; }
	.hood-metric-fill { height: 100%; border-radius: 3px; transition: width 0.4s; }

	.hood-poi-list { margin-top: 10px; }
	.poi-title { font-size: 11px; color: var(--muted); font-family: 'DM Mono', monospace; letter-spacing: 1px; margin-bottom: 6px; }
	.hood-poi-item { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #ffffff06; font-size: 12px; }
	.hood-poi-item:last-child { border: none; }
	.hood-poi-name { color: var(--text); flex: 1; }
	.hood-poi-dist { color: var(--muted); font-family: 'DM Mono', monospace; font-size: 11px; }

	.top3-box { background: var(--bg3); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-top: 16px; border-left: 4px solid var(--cyan); }
	.top3-title { font-size: 11px; font-family: 'DM Mono', monospace; color: var(--cyan); letter-spacing: 1px; margin-bottom: 12px; font-weight: 700; }
	.top3-content { font-size: 11px; color: var(--sub); line-height: 1.6; }
</style>
