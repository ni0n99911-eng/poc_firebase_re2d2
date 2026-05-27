<script lang="ts">
	import type { LocationIntelReport } from '../../intel/index';

	interface Props {
		scores: Record<string, number>;
		spokeLabels: string[];
		confidence: Record<string, number>;
		liveIntel: LocationIntelReport | null;
		personaType: string;
		expanded?: boolean;
		allSectionsLoaded?: boolean;  // R5-2: cap badge at ESTIMATED while sections still loading
	}

	let { scores = {}, spokeLabels = [], confidence = {}, liveIntel, personaType, expanded = $bindable(false), allSectionsLoaded = true } = $props();

	const indexNames = ['transit', 'competition', 'demographics', 'vibrancy', 'safety', 'momentum'];

	// R5-2: Loading-aware confidence badge — prevents "CONFIRMED" while sections are still loading
	function getConfidenceBadge(conf: number): { label: string; icon: string; color: string } {
		if (!allSectionsLoaded) {
			// Cap at ESTIMATED while any section is still loading, regardless of numeric confidence
			if (conf >= 50) return { label: 'ESTIMATED', icon: '⚠️', color: 'yellow' };
			return { label: 'APPROXIMATED', icon: '⚠️', color: 'orange' };
		}
		if (conf >= 80) return { label: 'CONFIRMED', icon: '✅', color: 'green' };
		if (conf >= 50) return { label: 'ESTIMATED', icon: '⚠️', color: 'yellow' };
		return { label: 'APPROXIMATED', icon: '⚠️', color: 'orange' };
	}

	// Derive receipt data for each index
	let receipts = $derived.by(() => {
		const items: Array<{
			index: string;
			label: string;
			score: number;
			conf: number;
			badge: { label: string; icon: string; color: string };
			inputs: Array<{ label: string; value: string; source: string; confidence: number }>;
			method: string;
		}> = [];

		indexNames.forEach((idx, i) => {
			const score = scores[idx] ?? 0;
			const conf = confidence[idx] ?? 50;
			const badge = getConfidenceBadge(conf);
			const label = spokeLabels[i] || idx;

			let inputs: Array<{ label: string; value: string; source: string; confidence: number }> = [];
			let method = '';

			// ── TRANSIT ──
			if (idx === 'transit' && liveIntel?.mtaRidership) {
				const mta = liveIntel.mtaRidership;
				inputs = [
					{
						label: 'Station Count',
						value: `${mta.stationCount} stations nearby`,
						source: 'MTA Data',
						confidence: 95
					},
					{
						label: 'Daily Ridership',
						value: `${(mta.totalDailyRidership / 1000).toFixed(0)}k trips/day`,
						source: 'MTA Ridership',
						confidence: 85
					},
					{
						label: 'Walk Score',
						value: `${liveIntel.walkScore?.walkScore ?? 'N/A'}/100`,
						source: 'Walk Score API',
						confidence: 80
					},
					{
						label: 'Transit Score',
						value: `${mta.transitScore}/100`,
						source: 'Walk Score Transit',
						confidence: 75
					},
					{
						label: 'Peak Hour Ratio',
						value: `${(mta.peakHourRatio * 100).toFixed(0)}% of daily traffic`,
						source: 'MTA Analysis',
						confidence: 60
					}
				];
				method = 'Weighted combination of station proximity, ridership volumes, and pedestrian accessibility. Higher scores indicate better access to transit and walkable neighborhoods.';
			} else if (idx === 'transit') {
				inputs = [
					{
						label: 'Walk Score',
						value: `${liveIntel?.walkScore?.walkScore ?? 'N/A'}/100`,
						source: 'Walk Score API',
						confidence: 80
					}
				];
				method = 'Transit score based on available Walk Score data. Data sources not yet loaded.';
			}

			// ── COMPETITION ──
			if (idx === 'competition' && liveIntel?.marketDensity) {
				const market = liveIntel.marketDensity;
				const categoryItems = market.categories.slice(0, 3).map((cat) => ({
					label: `${cat.category}`,
					value: `${cat.count} locations`,
					source: 'Google Places',
					confidence: 85
				}));
				inputs = [
					{
						label: 'Total Businesses',
						value: `${market.totalBusinesses} nearby`,
						source: 'Google Places',
						confidence: 85
					},
					...categoryItems,
					{
						label: 'Commercial Vitality',
						value: `${market.commercialVitality}/100`,
						source: 'Market Analysis',
						confidence: 70
					},
					{
						label: 'Avg Rating',
						value: `${market.avgOverallRating.toFixed(1)}/5.0`,
						source: 'Google Reviews',
						confidence: 80
					}
				];
				method = 'Analysis of competitor density, category diversity, and business health. Lower competition + higher vitality = higher score.';
			} else if (idx === 'competition') {
				method = 'Competition score pending market density data.';
				inputs = [];
			}

			// ── DEMOGRAPHICS ──
			if (idx === 'demographics' && liveIntel?.census) {
				const census = liveIntel.census;
				inputs = [
					{
						label: 'Median Income',
						value: `$${(census.medianHouseholdIncome / 1000).toFixed(0)}k`,
						source: 'US Census (ACS)',
						confidence: 95
					},
					{
						label: 'Population Density',
						value: `${census.populationDensity.toFixed(0)}/sq mi`,
						source: 'US Census',
						confidence: 95
					},
					{
						label: 'Bachelor\'s+',
						value: `${census.bachelorsPlusPercent}%`,
						source: 'US Census Education',
						confidence: 90
					},
					{
						label: 'Population Growth',
						value: `${census.populationGrowthPercent > 0 ? '+' : ''}${census.populationGrowthPercent.toFixed(1)}% YoY`,
						source: 'Census Analysis',
						confidence: 75
					}
				];
				method = 'Demographic strength based on income, education, and population density. Higher income + education + growth = stronger consumer base.';
			} else if (idx === 'demographics') {
				method = 'Demographic score pending census data.';
				inputs = [];
			}

			// ── VIBRANCY ──
			if (idx === 'vibrancy' && liveIntel?.foursquare) {
				const fs = liveIntel.foursquare;
				inputs = [
					{
						label: 'Restaurant/Bar Count',
						value: `${fs.restaurants ?? 0} + ${fs.bars ?? 0} bars`,
						source: 'Foursquare API',
						confidence: 80
					},
					{
						label: 'Nightlife Density',
						value: `${fs.nightlifeScore ?? 'N/A'}/100`,
						source: 'Foursquare Ratings',
						confidence: 70
					},
					{
						label: 'Avg Venue Rating',
						value: `${(fs.avgRating ?? 0).toFixed(1)}/5.0`,
						source: 'Foursquare Reviews',
						confidence: 75
					}
				];
				method = 'Vibrancy measured by density and quality of food, beverage, and nightlife venues. Higher count + ratings = more active neighborhood.';
			} else if (idx === 'vibrancy' && liveIntel?.liquorLicenses) {
				const licenses = liveIntel.liquorLicenses;
				inputs = [
					{
						label: 'Liquor Licenses',
						value: `${licenses.licenseCount ?? 0} active licenses`,
						source: 'NYC DCA',
						confidence: 90
					},
					{
						label: 'License Density',
						value: `${(licenses.densityPerSqMi ?? 0).toFixed(0)}/sq mi`,
						source: 'DCA Analysis',
						confidence: 85
					}
				];
				method = 'Vibrancy indicator based on licensed establishments. Pending full Foursquare data.';
			} else if (idx === 'vibrancy') {
				method = 'Vibrancy score pending venue data.';
				inputs = [];
			}

			// ── SAFETY ──
			if (idx === 'safety' && liveIntel?.crime) {
				const crime = liveIntel.crime;
				inputs = [
					{
						label: 'Crime Score',
						value: `${crime.crimeScore}/100`,
						source: 'NYPD Complaints',
						confidence: 90
					},
					{
						label: 'Total Incidents',
						value: `${crime.totalCount} (last 12mo)`,
						source: 'NYPD Data',
						confidence: 90
					},
					{
						label: 'Violent Crimes',
						value: `${crime.violentCount} incidents`,
						source: 'NYPD Classification',
						confidence: 85
					},
					{
						label: 'Property Crimes',
						value: `${crime.propertyCount} incidents`,
						source: 'NYPD Classification',
						confidence: 85
					},
					{
						label: 'Crime Density',
						value: `${crime.densityPerSqMi.toFixed(1)}/sq mi`,
						source: 'NYPD Analysis',
						confidence: 80
					}
				];
				method = 'Safety score weighted by incident counts and density. Lower crimes + lower density = safer neighborhood.';
			} else if (idx === 'safety') {
				method = 'Safety score pending crime data.';
				inputs = [];
			}

			// ── MOMENTUM ──
			if (idx === 'momentum' && liveIntel?.momentum) {
				const momentum = liveIntel.momentum;
				inputs = [
					{
						label: 'Trend Direction',
						value: momentum.direction.charAt(0).toUpperCase() + momentum.direction.slice(1),
						source: 'Momentum Analysis',
						confidence: 85
					},
					{
						label: 'DOB Permits',
						value: `${momentum.dobTrend.changePercent > 0 ? '+' : ''}${momentum.dobTrend.changePercent.toFixed(0)}% trend`,
						source: 'NYC DOB',
						confidence: 80
					},
					{
						label: 'New Licenses',
						value: `${momentum.dcaTrend.changePercent > 0 ? '+' : ''}${momentum.dcaTrend.changePercent.toFixed(0)}% trend`,
						source: 'NYC DCA',
						confidence: 75
					},
					{
						label: 'Complaint Trend',
						value: `${momentum.complaintsTrend.changePercent > 0 ? '+' : ''}${momentum.complaintsTrend.changePercent.toFixed(0)}%`,
						source: 'NYC 311',
						confidence: 70
					}
				];
				method = 'Momentum score based on permit growth, business openings, and complaint trends. Growing permits + licenses = neighborhood development.';
			} else if (idx === 'momentum') {
				method = 'Momentum score pending development data.';
				inputs = [];
			}

			items.push({
				index: idx,
				label,
				score,
				conf,
				badge,
				inputs,
				method
			});
		});

		return items;
	});

	// Derive missing data sources
	let missingDataPoints = $derived.by(() => {
		const gaps: string[] = [];

		if (!liveIntel?.pedestrian) {
			gaps.push('Direct foot traffic measurement (SafeGraph/Placer.ai)');
		}
		if (!liveIntel?.pluto) {
			gaps.push('Building type & mixed-use classification (PLUTO)');
		}
		if (!liveIntel?.sidewalkCafes) {
			gaps.push('Outdoor dining density & permit trends');
		}
		if (!liveIntel?.dcaLicenses) {
			gaps.push('Food service & restaurant license pipeline');
		}
		if (!liveIntel?.inspections) {
			gaps.push('Historical health inspection scores');
		}

		return gaps.length > 0
			? gaps
			: ['All major data sources loaded. Coverage is comprehensive.'];
	});

	let expandedIndex = $state<string | null>(null);

	function toggleIndex(idx: string) {
		expandedIndex = expandedIndex === idx ? null : idx;
	}
</script>

<div class="receipts-container" class:expanded>
	<div class="receipts-header">
		<span class="receipts-title">The Receipts</span>
		<span class="receipts-subtitle">Where these scores come from</span>
	</div>

	{#each receipts as receipt}
		<div class="receipt-index">
			<button class="receipt-index-header" onclick={() => toggleIndex(receipt.index)}>
				<div class="receipt-score-line">
					<span class="receipt-label">{receipt.label}</span>
					<span class="receipt-score">{receipt.score.toFixed(0)}/100</span>
				</div>
				<div class="receipt-confidence">
					<span class="confidence-badge {receipt.badge.color}">
						{receipt.badge.icon} {receipt.badge.label}
					</span>
					<span class="confidence-pct">{receipt.conf.toFixed(0)}% confidence</span>
					<span class="expand-arrow">{expandedIndex === receipt.index ? '▾' : '▸'}</span>
				</div>
			</button>

			{#if expandedIndex === receipt.index}
				<div class="receipt-details">
					<!-- LEVEL 2: INPUTS -->
					{#if receipt.inputs.length > 0}
						<div class="level-section">
							<div class="level-title">The Inputs</div>
							<div class="inputs-list">
								{#each receipt.inputs as input}
									<div class="input-item">
										<div class="input-label">{input.label}</div>
										<div class="input-value">
											<code>{input.value}</code>
											<span class="input-source">from {input.source}</span>
										</div>
										<div class="input-confidence">
											{#if input.confidence >= 80}
												<span class="conf-tag confirmed">✓ Confirmed</span>
											{:else if input.confidence >= 50}
												<span class="conf-tag estimated">⚠ Estimated</span>
											{:else}
												<span class="conf-tag approximated">⚠ Approximated</span>
											{/if}
											<span class="conf-pct">{input.confidence}%</span>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<div class="level-section">
							<div class="level-title">The Inputs</div>
							<div class="no-data">No detailed inputs available for {receipt.label} yet.</div>
						</div>
					{/if}

					<!-- LEVEL 3: METHOD -->
					<div class="level-section">
						<div class="level-title">The Method</div>
						<div class="method-text">{receipt.method}</div>
					</div>
				</div>
			{/if}
		</div>
	{/each}

	<!-- WHAT WE DON'T HAVE -->
	<div class="missing-section">
		<div class="missing-header">
			<span class="missing-icon">❓</span>
			<span class="missing-title">What We Don't Have</span>
		</div>
		<div class="missing-content">
			<div class="missing-list">
				{#each missingDataPoints as point}
					<div class="missing-item">{point}</div>
				{/each}
			</div>
			<div class="missing-tip">
				<span class="tip-icon">💡</span>
				<span class="tip-text"
					>To verify our estimates: Visit at 7:30am on a weekday to observe traffic patterns. Talk to 3–5 business owners to calibrate our competitive & demographic assumptions.</span
				>
			</div>
		</div>
	</div>
</div>

<style>
	.receipts-container {
		background: var(--surface, #ffffff);
		border: 1px solid var(--border);
		border-radius: 16px;
		overflow: hidden;
		margin-bottom: 20px;
	}

	.receipts-header {
		padding: 18px 24px;
		border-bottom: 1px solid var(--border);
		background: rgba(59, 130, 246, 0.02);
	}

	.receipts-title {
		display: block;
		font-size: 16px;
		font-weight: 700;
		color: var(--text-bright, var(--text));
		margin-bottom: 4px;
	}

	.receipts-subtitle {
		font-size: 13px;
		color: var(--text-secondary, #5A6578);
	}

	/* ── Receipt Index ── */
	.receipt-index {
		border-bottom: 1px solid var(--border);
	}

	.receipt-index:last-of-type {
		border-bottom: none;
	}

	.receipt-index-header {
		display: block;
		width: 100%;
		padding: 16px 24px;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		color: var(--text, #1A202C);
		transition: background 0.15s ease;
	}

	.receipt-index-header:hover {
		background: var(--surface-alt, #F0F3F7);
	}

	.receipt-score-line {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 8px;
	}

	.receipt-label {
		font-size: 15px;
		font-weight: 600;
		color: var(--text-bright, var(--text));
	}

	.receipt-score {
		font-size: 18px;
		font-weight: 700;
		color: #3B82F6;
		font-family: 'Monaco', 'Courier New', monospace;
	}

	.receipt-confidence {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		font-size: 12px;
	}

	.confidence-badge {
		padding: 2px 8px;
		border-radius: 12px;
		font-weight: 600;
		white-space: nowrap;
	}

	.confidence-badge.green {
		background: rgba(52, 211, 153, 0.12);
		color: var(--green, var(--success));
		border: 1px solid rgba(52, 211, 153, 0.2);
	}

	.confidence-badge.yellow {
		background: rgba(251, 191, 36, 0.12);
		color: var(--yellow, var(--warning));
		border: 1px solid rgba(251, 191, 36, 0.2);
	}

	.confidence-badge.orange {
		background: rgba(249, 115, 22, 0.12);
		color: #f97316;
		border: 1px solid rgba(249, 115, 22, 0.2);
	}

	.confidence-pct {
		color: var(--muted, #6b6f7f);
		font-size: 11px;
	}

	.expand-arrow {
		color: var(--muted, #6b6f7f);
		margin-left: 4px;
		transition: transform 0.2s ease;
	}

	/* ── Receipt Details ── */
	.receipt-details {
		padding: 0 24px 16px 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.level-section {
		padding: 14px 16px;
		background: rgba(0, 0, 0, 0.03);
		border: 1px solid var(--border);
		border-radius: 10px;
	}

	.level-title {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		color: var(--muted, #6b6f7f);
		margin-bottom: 10px;
		font-weight: 700;
	}

	.inputs-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.input-item {
		padding: 10px;
		background: rgba(0, 0, 0, 0.02);
		border-radius: 6px;
		border: 1px solid var(--border);
	}

	.input-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.4px;
		color: var(--muted, #6b6f7f);
		margin-bottom: 4px;
	}

	.input-value {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 6px;
	}

	code {
		font-size: 13px;
		font-family: 'Monaco', 'Courier New', monospace;
		color: var(--cyan, #0071e3);
		font-weight: 600;
	}

	.input-source {
		font-size: 11px;
		color: var(--muted, #6b6f7f);
	}

	.input-confidence {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 10px;
	}

	.conf-tag {
		padding: 1px 6px;
		border-radius: 4px;
		font-weight: 600;
		white-space: nowrap;
	}

	.conf-tag.confirmed {
		background: rgba(52, 211, 153, 0.15);
		color: var(--green, var(--success));
	}

	.conf-tag.estimated {
		background: rgba(251, 191, 36, 0.15);
		color: var(--yellow, var(--warning));
	}

	.conf-tag.approximated {
		background: rgba(249, 115, 22, 0.15);
		color: #f97316;
	}

	.conf-pct {
		color: var(--muted, #6b6f7f);
		font-size: 10px;
		margin-left: auto;
	}

	.method-text {
		font-size: 13px;
		line-height: 1.6;
		color: var(--text, #d4d6e3);
	}

	.no-data {
		font-size: 13px;
		color: var(--muted, #6b6f7f);
		font-style: italic;
		padding: 4px 0;
	}

	/* ── Missing Section ── */
	.missing-section {
		background: rgba(249, 115, 22, 0.03);
		border: 1px solid rgba(249, 115, 22, 0.15);
		border-radius: 0 0 16px 16px;
		overflow: hidden;
	}

	.missing-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 24px;
		border-bottom: 1px solid rgba(249, 115, 22, 0.15);
	}

	.missing-icon {
		font-size: 16px;
	}

	.missing-title {
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #f97316;
	}

	.missing-content {
		padding: 16px 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.missing-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.missing-item {
		font-size: 13px;
		color: var(--text, #d4d6e3);
		padding-left: 20px;
		position: relative;
	}

	.missing-item::before {
		content: '–';
		position: absolute;
		left: 6px;
		color: #f97316;
		font-weight: 600;
	}

	.missing-tip {
		display: flex;
		gap: 10px;
		padding: 12px 14px;
		background: rgba(0, 113, 227, 0.06);
		border: 1px solid rgba(0, 113, 227, 0.15);
		border-radius: 8px;
		font-size: 13px;
	}

	.tip-icon {
		font-size: 14px;
		flex-shrink: 0;
	}

	.tip-text {
		color: var(--text, #d4d6e3);
		line-height: 1.5;
	}

	@media (max-width: 700px) {
		.receipt-index-header {
			padding: 12px 16px;
		}

		.receipt-details {
			padding: 0 16px 12px 16px;
		}

		.level-section {
			padding: 10px 12px;
		}

		.receipt-label {
			font-size: 14px;
		}

		.receipt-score {
			font-size: 16px;
		}

		.missing-content {
			padding: 12px 16px;
		}
	}
</style>
