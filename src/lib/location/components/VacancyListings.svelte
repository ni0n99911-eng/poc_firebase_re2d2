<script lang="ts">
	import { authedFetch } from '$lib/authed-fetch';

	/**
	 * VacancyListings — shows nearby likely-vacant storefronts
	 * with prominent starburst "LIKELY AVAILABLE" / "COMING AVAILABLE" badges.
	 *
	 * Appears inline after analysis results in both AddressAnalyzer
	 * and NeighborhoodScanner expanded panels.
	 */

	interface VacancySignal {
		source: string;
		signal: string;
		confidence: string;
		leadTime: string;
		detail: string;
		score: number;
		detectedAt: string;
	}

	interface VacancyListing {
		id: string;
		address: string;
		lat: number;
		lng: number;
		vacancyScore: number;
		status: 'likely_available' | 'coming_available';
		signals: VacancySignal[];
		signalCount: number;
		sqft: number | null;
		bldgClass: string | null;
		zoneDist: string | null;
		yearBuilt: number | null;
		ownerName: string | null;
		retailArea: number | null;
		previousTenant: string | null;
		previousType: string | null;
		closedDate: string | null;
		distance: number;
		daysOnMarket: number;
	}

	let {
		lat,
		lng,
		radius = 500,
		compact = false
	}: {
		lat: number;
		lng: number;
		radius?: number;
		compact?: boolean;
	} = $props();

	let listings = $state<VacancyListing[]>([]);
	let loading = $state(false);
	let fetched = $state(false);
	let error = $state('');
	let expanded = $state<string | null>(null);
	let totalScanned = $state(0);
	let totalSignals = $state(0);

	$effect(() => {
		if (lat && lng && !fetched) {
			fetchVacancies();
		}
	});

	async function fetchVacancies() {
		if (loading) return;
		loading = true;
		error = '';
		try {
			const res = await authedFetch(`/api/vacancies?lat=${lat}&lng=${lng}&radius=${radius}`);
			if (!res.ok) throw new Error('Failed to load');
			const data = await res.json();
			listings = data.listings || [];
			totalScanned = data.totalScanned || 0;
			totalSignals = data.signalBreakdown?.totalSignals || 0;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		}
		loading = false;
		fetched = true;
	}

	function toggleExpand(id: string) {
		expanded = expanded === id ? null : id;
	}

	function formatDist(m: number): string {
		if (m < 100) return 'Right here';
		if (m < 1000) return `${Math.round(m)}m away`;
		return `${(m / 1000).toFixed(1)}km away`;
	}

	function formatSqft(sqft: number | null): string {
		if (!sqft) return '—';
		return sqft.toLocaleString() + ' sqft';
	}

	function confidenceColor(c: string): string {
		if (c === 'high') return 'var(--v-green)';
		if (c === 'medium') return 'var(--v-gold)';
		return 'var(--v-muted)';
	}

	function sourceIcon(src: string): string {
		const icons: Record<string, string> = {
			'acris': '📄', 'dob': '🏗️', 'google': '📍',
			'dca': '📋', 'pluto': '🏢', 'churn-model': '🔮'
		};
		return icons[src] || '📡';
	}
</script>

{#if loading}
	<div class="vl-section">
		<div class="vl-loading">
			<div class="vl-pulse"></div>
			Scanning for available spaces nearby...
		</div>
	</div>
{:else if fetched && listings.length === 0}
	<div class="vl-section">
		<div class="vl-header">
			<div class="vl-title">
				<span class="vl-icon">🏪</span>
				Spaces Near This Address
			</div>
		</div>
		<div class="vl-empty">
			No available spaces detected within {radius}m right now.
			{#if totalScanned > 0} Scanned {totalScanned} properties and found {totalSignals} signal{totalSignals !== 1 ? 's' : ''} (none above threshold).{/if}
			Our pipeline checks ACRIS leases, DOB permits, business licenses, and Google Maps — check back soon.
		</div>
	</div>
{:else if listings.length > 0}
	<div class="vl-section" class:compact>
		<div class="vl-header">
			<div class="vl-title">
				<span class="vl-icon">🏪</span>
				Spaces Near This Address
			</div>
			<div class="vl-count">
				{listings.length} space{listings.length !== 1 ? 's' : ''} detected
			</div>
		</div>

		<div class="vl-grid">
			{#each listings as listing}
				<button
					class="vl-card"
					class:expanded={expanded === listing.id}
					onclick={() => toggleExpand(listing.id)}
				>
					<!-- Starburst Badge -->
					<div class="starburst" class:likely={listing.status === 'likely_available'} class:coming={listing.status === 'coming_available'}>
						<div class="starburst-inner">
							<span class="starburst-text">
								{listing.status === 'likely_available' ? 'LIKELY' : 'COMING'}
							</span>
							<span class="starburst-sub">
								{listing.status === 'likely_available' ? 'AVAILABLE' : 'AVAILABLE'}
							</span>
						</div>
					</div>

					<div class="vl-card-body">
						<!-- Address & Key Info -->
						<div class="vl-card-top">
							<div class="vl-addr">{listing.address}</div>
							<div class="vl-meta">
								{#if listing.sqft}
									<span class="vl-chip">{formatSqft(listing.sqft)}</span>
								{/if}
								{#if listing.zoneDist}
									<span class="vl-chip">{listing.zoneDist}</span>
								{/if}
								<span class="vl-chip dist">{formatDist(listing.distance)}</span>
							</div>
						</div>

						<!-- Previous Tenant -->
						{#if listing.previousTenant}
							<div class="vl-prev">
								Previously: <strong>{listing.previousTenant}</strong>
								{#if listing.previousType}
									<span class="vl-prev-type">({listing.previousType})</span>
								{/if}
							</div>
						{/if}

						<!-- Signal Summary -->
						<div class="vl-signals-summary">
							<div class="vl-score-ring" class:hot={listing.vacancyScore >= 70} class:warm={listing.vacancyScore >= 40 && listing.vacancyScore < 70}>
								{listing.vacancyScore}
							</div>
							<div class="vl-signal-dots">
								{#each listing.signals.slice(0, 4) as signal}
									<span class="vl-signal-dot" title="{signal.signal}" style="color: {confidenceColor(signal.confidence)}">
										{sourceIcon(signal.source)}
									</span>
								{/each}
								{#if listing.signals.length > 4}
									<span class="vl-more">+{listing.signals.length - 4}</span>
								{/if}
							</div>
							<div class="vl-tap-hint">tap for details →</div>
						</div>
					</div>

					<!-- Expanded Detail Panel -->
					{#if expanded === listing.id}
						<div class="vl-detail" onclick={(e) => e.stopPropagation()}>
							<div class="vl-detail-title">Why we think this is available</div>

							<div class="vl-signal-list">
								{#each listing.signals as signal}
									<div class="vl-signal-row">
										<span class="vl-signal-icon">{sourceIcon(signal.source)}</span>
										<div class="vl-signal-info">
											<div class="vl-signal-name">{signal.signal}</div>
											<div class="vl-signal-detail">{signal.detail}</div>
										</div>
										<span class="vl-conf" style="color: {confidenceColor(signal.confidence)}">
											{signal.confidence.toUpperCase()}
										</span>
									</div>
								{/each}
							</div>

							{#if listing.ownerName || listing.yearBuilt}
								<div class="vl-property-info">
									<div class="vl-detail-title" style="margin-top:12px">Property Details</div>
									<div class="vl-prop-grid">
										{#if listing.ownerName}
											<div class="vl-prop"><span class="vl-prop-label">Owner</span><span class="vl-prop-val">{listing.ownerName}</span></div>
										{/if}
										{#if listing.yearBuilt}
											<div class="vl-prop"><span class="vl-prop-label">Built</span><span class="vl-prop-val">{listing.yearBuilt}</span></div>
										{/if}
										{#if listing.retailArea}
											<div class="vl-prop"><span class="vl-prop-label">Retail Area</span><span class="vl-prop-val">{formatSqft(listing.retailArea)}</span></div>
										{/if}
										{#if listing.bldgClass}
											<div class="vl-prop"><span class="vl-prop-label">Class</span><span class="vl-prop-val">{listing.bldgClass}</span></div>
										{/if}
									</div>
								</div>
							{/if}

							<div class="vl-next-steps">
								<div class="vl-detail-title" style="margin-top:12px">Next Steps</div>
								<div class="vl-tips">
									<div class="vl-tip">🔍 Search this address on LoopNet or 42floors for active listings</div>
									{#if listing.ownerName}
										<div class="vl-tip">📞 Contact owner ({listing.ownerName}) — try property records for contact info</div>
									{/if}
									<div class="vl-tip">📊 Run a full location analysis on this exact address</div>
								</div>
							</div>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	</div>
{:else if fetched && !error}
	<!-- No vacancies found — that's fine, don't show anything -->
{/if}

<style>
	.vl-section {
		margin: 20px 0;
		--v-green: var(--success);
		--v-gold: var(--warning);
		--v-red: var(--danger);
		--v-muted: var(--text-secondary);
		--v-bg: var(--surface);
		--v-bg2: #13131c;
		--v-border: var(--border);
		--v-text: var(--text);
		--v-sub: var(--text-secondary);
	}

	.vl-section.compact { margin: 12px 0; }

	.vl-loading {
		display: flex; align-items: center; gap: 10px;
		padding: 16px 20px; background: var(--v-bg2);
		border: 1px solid var(--v-border); border-radius: 10px;
		font-size: 13px; color: var(--v-sub);
	}
	.vl-pulse {
		width: 8px; height: 8px; border-radius: 50%;
		background: var(--v-gold); animation: vpulse 1.5s infinite;
	}
	@keyframes vpulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

	.vl-empty {
		font-size: 13px; color: var(--v-sub); line-height: 1.6;
		padding: 12px 16px; background: var(--v-bg2);
		border: 1px dashed var(--v-border); border-radius: 8px;
	}

	.vl-header {
		display: flex; justify-content: space-between; align-items: center;
		margin-bottom: 14px;
	}
	.vl-title {
		font-size: 16px; font-weight: 800; color: var(--v-text);
		display: flex; align-items: center; gap: 8px;
	}
	.vl-icon { font-size: 20px; }
	.vl-count {
		font-size: 12px; color: var(--v-gold);
		font-family: 'DM Mono', monospace; font-weight: 600;
	}

	.vl-grid { display: flex; flex-direction: column; gap: 12px; }

	/* ── Card ── */
	.vl-card {
		position: relative; overflow: visible;
		background: var(--v-bg2); border: 1px solid var(--v-border);
		border-radius: 14px; padding: 20px 20px 16px 20px;
		cursor: pointer; transition: all 0.2s;
		text-align: left; font-family: inherit; color: inherit;
		width: 100%;
	}
	.vl-card:hover { border-color: var(--v-gold); transform: translateY(-1px); box-shadow: 0 4px 20px rgba(251, 191, 36, 0.1); }
	.vl-card.expanded { border-color: var(--v-gold); }

	/* ── STARBURST BADGE ── */
	.starburst {
		position: absolute; top: -14px; right: 16px;
		width: 72px; height: 72px;
		z-index: 2;
	}
	.starburst::before {
		content: '';
		position: absolute; inset: 0;
		background: var(--v-gold);
		clip-path: polygon(
			50% 0%, 63% 10%, 78% 2%, 81% 18%, 98% 22%,
			90% 37%, 100% 50%, 90% 63%, 98% 78%,
			81% 82%, 78% 98%, 63% 90%, 50% 100%,
			37% 90%, 22% 98%, 19% 82%, 2% 78%,
			10% 63%, 0% 50%, 10% 37%, 2% 22%,
			19% 18%, 22% 2%, 37% 10%
		);
		animation: starRotate 20s linear infinite;
	}
	.starburst.likely::before { background: linear-gradient(135deg, var(--success), #10b981); }
	.starburst.coming::before { background: linear-gradient(135deg, var(--warning), #f59e0b); }

	@keyframes starRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

	.starburst-inner {
		position: absolute; inset: 6px;
		display: flex; flex-direction: column;
		align-items: center; justify-content: center;
		z-index: 3;
	}
	.starburst-text {
		font-size: 10px; font-weight: 900;
		color: var(--bg); letter-spacing: 0.5px;
		line-height: 1;
	}
	.starburst-sub {
		font-size: 7px; font-weight: 800;
		color: var(--bg); letter-spacing: 0.5px;
		line-height: 1; margin-top: 1px;
	}

	/* ── Card Content ── */
	.vl-card-body { padding-right: 60px; }
	.vl-addr { font-size: 16px; font-weight: 700; color: var(--v-text); margin-bottom: 6px; }
	.vl-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
	.vl-chip {
		font-size: 11px; padding: 3px 8px;
		background: rgba(255,255,255,0.06); border-radius: 4px;
		color: var(--v-sub); font-family: 'DM Mono', monospace;
	}
	.vl-chip.dist { color: var(--v-gold); }

	.vl-prev { font-size: 12px; color: var(--v-sub); margin-bottom: 8px; }
	.vl-prev strong { color: var(--v-text); }
	.vl-prev-type { color: var(--v-muted); }

	.vl-signals-summary {
		display: flex; align-items: center; gap: 10px;
		padding-top: 8px; border-top: 1px solid var(--v-border);
	}
	.vl-score-ring {
		width: 36px; height: 36px; border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
		font-size: 13px; font-weight: 800;
		font-family: 'DM Mono', monospace;
		border: 2px solid var(--v-muted); color: var(--v-muted);
		flex-shrink: 0;
	}
	.vl-score-ring.hot { border-color: var(--v-green); color: var(--v-green); }
	.vl-score-ring.warm { border-color: var(--v-gold); color: var(--v-gold); }

	.vl-signal-dots { display: flex; gap: 4px; align-items: center; }
	.vl-signal-dot { font-size: 14px; }
	.vl-more { font-size: 11px; color: var(--v-muted); font-family: 'DM Mono', monospace; }
	.vl-tap-hint { margin-left: auto; font-size: 11px; color: var(--v-muted); font-style: italic; }

	/* ── Expanded Detail ── */
	.vl-detail {
		margin-top: 14px; padding-top: 14px;
		border-top: 1px solid var(--v-border);
	}
	.vl-detail-title {
		font-size: 12px; font-weight: 700;
		color: var(--v-gold); text-transform: uppercase;
		letter-spacing: 0.5px; margin-bottom: 10px;
		font-family: 'DM Mono', monospace;
	}

	.vl-signal-list { display: flex; flex-direction: column; gap: 8px; }
	.vl-signal-row {
		display: flex; align-items: flex-start; gap: 10px;
		padding: 10px 12px; background: var(--v-bg);
		border-radius: 8px; border: 1px solid var(--v-border);
	}
	.vl-signal-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
	.vl-signal-info { flex: 1; }
	.vl-signal-name { font-size: 13px; font-weight: 700; color: var(--v-text); }
	.vl-signal-detail { font-size: 12px; color: var(--v-sub); margin-top: 2px; line-height: 1.4; }
	.vl-conf {
		font-size: 10px; font-weight: 700;
		font-family: 'DM Mono', monospace;
		flex-shrink: 0; letter-spacing: 0.5px;
	}

	.vl-prop-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
	.vl-prop {
		display: flex; flex-direction: column; gap: 2px;
		padding: 8px 10px; background: var(--v-bg);
		border-radius: 6px; border: 1px solid var(--v-border);
	}
	.vl-prop-label { font-size: 10px; color: var(--v-muted); font-family: 'DM Mono', monospace; letter-spacing: 0.5px; text-transform: uppercase; }
	.vl-prop-val { font-size: 13px; font-weight: 600; color: var(--v-text); }

	.vl-tips { display: flex; flex-direction: column; gap: 6px; }
	.vl-tip {
		font-size: 13px; color: var(--v-sub); padding: 8px 12px;
		background: var(--v-bg); border-radius: 8px;
		border-left: 3px solid var(--v-gold);
	}

	@media (max-width: 600px) {
		.starburst { width: 60px; height: 60px; top: -12px; right: 10px; }
		.starburst-text { font-size: 8px; }
		.starburst-sub { font-size: 6px; }
		.vl-card-body { padding-right: 50px; }
		.vl-addr { font-size: 14px; }
		.vl-prop-grid { grid-template-columns: 1fr; }
	}
</style>
