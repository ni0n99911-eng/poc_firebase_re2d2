<script lang="ts">
	let {
		locationScore = 0,
		fitScore = 0,
		locationSubScores = {} as Record<string, number>,
		fitSubScores = {} as Record<string, number>,
		spokeLabels = ['Market Proof', 'Accessibility', 'Pulse', 'Demographics', 'Competition', 'Price Fit'],
		personaType = 'coffee',
		conceptShort = 'your concept',
	}: {
		locationScore?: number;
		fitScore?: number;
		locationSubScores?: Record<string, number>;
		fitSubScores?: Record<string, number>;
		spokeLabels?: string[];
		personaType?: string;
		conceptShort?: string;
	} = $props();

	// Cycle 2H dimensions — concept-aware sub-scores
	const indexOrder = ['market_proof', 'accessibility', 'vibrancy', 'demographics', 'competition', 'price_income_fit'];

	// Ring colors per sub-index: Market Proof (green), Accessibility (blue), Vibrancy (orange), Demographics (purple), Competition (red), Price Fit (indigo)
	const subColors = ['#34C759', '#007AFF', '#FF9500', '#AF52DE', '#FF3B30', '#5856D6'];
	const subIcons = ['🏪', '🚶', '✨', '👥', '⚔️', '💰'];

	// SVG ring config
	const ringSize = 160;
	const rcx = ringSize / 2;
	const rcy = ringSize / 2;
	const strokeW = 14;
	const radius = 64;
	const circumference = 2 * Math.PI * radius;

	// Location ring
	let locProgress = $derived(locationScore / 100);
	let locDashOffset = $derived(circumference * (1 - locProgress));
	let locColor = $derived(
		locationScore >= 75 ? '#34C759' : locationScore >= 55 ? '#FF9500' : '#FF3B30'
	);
	// R5-4: Unified tier labels (removed conflicting letter grades A+/A/B+/B/C+/C/D)
	let locGrade = $derived(tierLabel(locationScore));

	// Fit ring
	let fitProgress = $derived(fitScore / 100);
	let fitDashOffset = $derived(circumference * (1 - fitProgress));
	let fitColor = $derived(
		fitScore >= 75 ? '#34C759' : fitScore >= 55 ? '#FF9500' : '#FF3B30'
	);
	// R5-4: Unified tier labels (removed conflicting letter grades)
	let fitGrade = $derived(tierLabel(fitScore));

	// Sub-score rows (merged view below both rings)
	let subRows = $derived.by(() => {
		return indexOrder.map((key, i) => ({
			key,
			label: i < spokeLabels.length ? spokeLabels[i] : key,
			icon: subIcons[i],
			color: subColors[i],
			locVal: locationSubScores[key] ?? 0,
			fitVal: fitSubScores[key] ?? 0,
		}));
	});

	function tierLabel(s: number): string {
		if (s >= 85) return 'Excellent';
		if (s >= 70) return 'Great';
		if (s >= 50) return 'Good';
		if (s >= 30) return 'Fair';
		return 'Poor';
	}
	function tierClass(s: number): string {
		if (s >= 85) return 'tier-excellent';
		if (s >= 70) return 'tier-great';
		if (s >= 50) return 'tier-good';
		if (s >= 30) return 'tier-fair';
		return 'tier-poor';
	}

	// Animation
	let mounted = $state(false);
	$effect(() => {
		const t = setTimeout(() => { mounted = true; }, 50);
		return () => clearTimeout(t);
	});
</script>

<div class="dual-rings" class:mounted>
	<!-- Two rings side by side -->
	<div class="rings-row">
		<!-- Location IQ -->
		<div class="ring-card">
			<div class="ring-wrap">
				<svg viewBox="0 0 {ringSize} {ringSize}" width="{ringSize}" height="{ringSize}">
					<circle cx={rcx} cy={rcy} r={radius} fill="none" stroke="rgba(0,0,0,0.06)" stroke-width={strokeW} />
					<circle
						cx={rcx} cy={rcy} r={radius}
						fill="none"
						stroke={locColor}
						stroke-width={strokeW}
						stroke-linecap="round"
						stroke-dasharray={circumference}
						stroke-dashoffset={mounted ? locDashOffset : circumference}
						transform="rotate(-90 {rcx} {rcy})"
						class="arc"
					/>
				</svg>
				<div class="ring-center">
					<span class="ring-num" style="color: {locColor}">{locationScore}</span>
				</div>
			</div>
			<div class="ring-label">Your Score</div>
			<div class="ring-grade" style="color: {locColor}">{locGrade}</div>
			<div class="ring-sub">How strong is this spot?</div>
		</div>

		<!-- Fit IQ -->
		<div class="ring-card">
			<div class="ring-wrap">
				<svg viewBox="0 0 {ringSize} {ringSize}" width="{ringSize}" height="{ringSize}">
					<circle cx={rcx} cy={rcy} r={radius} fill="none" stroke="rgba(0,0,0,0.06)" stroke-width={strokeW} />
					<circle
						cx={rcx} cy={rcy} r={radius}
						fill="none"
						stroke={fitColor}
						stroke-width={strokeW}
						stroke-linecap="round"
						stroke-dasharray={circumference}
						stroke-dashoffset={mounted ? fitDashOffset : circumference}
						transform="rotate(-90 {rcx} {rcy})"
						class="arc"
						style="transition-delay: 200ms;"
					/>
				</svg>
				<div class="ring-center">
					<span class="ring-num" style="color: {fitColor}">{fitScore}</span>
				</div>
			</div>
			<div class="ring-label">Breakdown</div>
			<div class="ring-grade" style="color: {fitColor}">{fitGrade}</div>
			<div class="ring-sub">How right for {conceptShort}?</div>
		</div>
	</div>

	<!-- Sub-score breakdown -->
	<div class="sub-scores">
		{#each subRows as row}
			<div class="sub-row">
				<div class="sub-label">
					<span class="sub-icon">{row.icon}</span>
					<span class="sub-name">{row.label}</span>
				</div>
				<div class="sub-bars">
					<div class="sub-track">
						<div class="sub-fill loc" style="width: {mounted ? row.locVal : 0}%; background: {row.color}; transition-delay: {300 + subRows.indexOf(row) * 50}ms;"></div>
					</div>
					<div class="sub-track">
						<div class="sub-fill fit" style="width: {mounted ? row.fitVal : 0}%; background: {row.color}; opacity: 0.5; transition-delay: {350 + subRows.indexOf(row) * 50}ms;"></div>
					</div>
				</div>
				<span class="sub-tier {tierClass(row.fitVal)}">{tierLabel(row.fitVal)}</span>
				<div class="sub-vals">
					<span class="sub-val" style="color: {row.locVal >= 70 ? '#34C759' : row.locVal >= 50 ? '#FF9500' : '#FF3B30'}">{row.locVal}</span>
					<span class="sub-sep">/</span>
					<span class="sub-val" style="color: {row.fitVal >= 70 ? '#34C759' : row.fitVal >= 50 ? '#FF9500' : '#FF3B30'}">{row.fitVal}</span>
				</div>
			</div>
		{/each}
		<div class="sub-legend">
			<span class="legend-dot loc"></span> Location
			<span class="legend-dot fit"></span> Fit
		</div>
	</div>
</div>

<style>
	.dual-rings {
		background: var(--surface, #FFFFFF);
		border-radius: 20px;
		padding: 32px 28px 24px;
		border: 1px solid var(--border, #E0E5ED);
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
		margin: 0 auto 24px;
	}

	/* ── Side-by-side rings ── */
	.rings-row {
		display: flex;
		justify-content: center;
		gap: 32px;
		margin-bottom: 28px;
	}

	.ring-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.ring-wrap {
		position: relative;
		width: 160px;
		height: 160px;
		margin-bottom: 12px;
	}

	.ring-wrap svg {
		display: block;
	}

	.arc {
		transition: stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
	}

	.ring-center {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-align: center;
	}

	.ring-num {
		font-size: 42px;
		font-weight: 800;
		letter-spacing: -2px;
		font-feature-settings: 'tnum';
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.ring-label {
		font-size: 15px;
		font-weight: 700;
		color: var(--text, #1A202C);
		letter-spacing: -0.3px;
	}

	.ring-grade {
		font-size: 18px;
		font-weight: 800;
		margin-top: 2px;
	}

	.ring-sub {
		font-size: 12px;
		color: var(--text-secondary, #5A6578);
		margin-top: 2px;
		font-weight: 500;
	}

	/* ── Sub-score breakdown ── */
	.sub-scores {
		border-top: 1px solid var(--border-subtle, #EBF0F5);
		padding-top: 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.sub-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.sub-label {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 130px;
		flex-shrink: 0;
	}

	.sub-icon {
		font-size: 13px;
		width: 18px;
		text-align: center;
	}

	.sub-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--text, #1A202C);
		letter-spacing: -0.2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sub-bars {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.sub-track {
		height: 4px;
		background: var(--surface-alt, #F0F3F7);
		border-radius: 2px;
		overflow: hidden;
	}

	.sub-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
		min-width: 1px;
	}

	.sub-vals {
		display: flex;
		align-items: center;
		gap: 2px;
		width: 56px;
		flex-shrink: 0;
		justify-content: flex-end;
	}

	.sub-val {
		font-size: 13px;
		font-weight: 700;
		font-feature-settings: 'tnum';
		font-variant-numeric: tabular-nums;
	}

	.sub-sep {
		font-size: 11px;
		color: var(--border, #E0E5ED);
	}

	.sub-tier {
		font-size: 10px;
		font-weight: 700;
		padding: 1px 5px;
		border-radius: 3px;
		white-space: nowrap;
		flex-shrink: 0;
		text-align: center;
	}
	.tier-excellent { background: #dcfce7; color: #166534; }
	.tier-great { background: #d1fae5; color: #065f46; }
	.tier-good { background: #e0f2fe; color: #0c4a6e; }
	.tier-fair { background: #fef3c7; color: #92400e; }
	.tier-poor { background: #fee2e2; color: #991b1b; }

	.sub-legend {
		display: flex;
		align-items: center;
		gap: 12px;
		justify-content: center;
		margin-top: 8px;
		font-size: 11px;
		color: var(--text-secondary, #5A6578);
		font-weight: 500;
	}

	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		display: inline-block;
		margin-right: 4px;
	}

	.legend-dot.loc {
		background: #007AFF;
	}

	.legend-dot.fit {
		background: #007AFF;
		opacity: 0.4;
	}

	/* ── Mobile ── */
	@media (max-width: 520px) {
		.dual-rings {
			padding: 24px 16px 20px;
			border-radius: 16px;
		}

		.rings-row {
			gap: 16px;
		}

		.ring-wrap {
			width: 130px;
			height: 130px;
		}

		.ring-wrap svg {
			width: 130px;
			height: 130px;
		}

		.ring-num {
			font-size: 34px;
		}

		.sub-label {
			width: 100px;
		}

		.sub-name {
			font-size: 11px;
		}
	}
</style>
