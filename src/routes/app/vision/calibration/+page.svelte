<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { loadLaunchPadData, saveLaunchPadData } from '$lib/launchpad-store';
	import EMC2Button from '$lib/components/EMC2Button.svelte';
	import { scoreAllNeighborhoods, getScoreLabel } from '$lib/_deprecated_04.19.2026_scoring';

	let saveStatus = $state('');
	let loaded = $state(false);

	function triggerSave() {
		saveStatus = 'Saving...';
		saveLaunchPadData({
			businessType,
			weights
		});
		setTimeout(() => { saveStatus = 'Auto-saved ✓'; }, 300);
		setTimeout(() => { saveStatus = ''; }, 2500);
	}

	let saveTimer = null;
	function autoSave() {
		if (!loaded) return;
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(triggerSave, 1000);
	}

	let businessType = $state('Specialty Coffee/Café');

	const businessTypes = [
		'Specialty Coffee/Café',
		'Restaurant',
		'Retail',
		'Fitness',
		'Prof Services',
		'Grocery',
		'Salon',
		'Other'
	];

	const defaultWeightsByType = {
		'Specialty Coffee/Café': {
			l0_macro: 10,
			l1_city: 15,
			l2_block: 18,
			l3_planfit: 18,
			l4_talent: 10,
			l5_resilience: 10,
			l6_zoning: 7,
			l7_feel: 12
		},
		'Restaurant': {
			l0_macro: 10,
			l1_city: 14,
			l2_block: 20,
			l3_planfit: 22,
			l4_talent: 10,
			l5_resilience: 8,
			l6_zoning: 6,
			l7_feel: 10
		},
		'Fitness': {
			l0_macro: 12,
			l1_city: 16,
			l2_block: 16,
			l3_planfit: 18,
			l4_talent: 12,
			l5_resilience: 10,
			l6_zoning: 6,
			l7_feel: 10
		}
	};

	const getDefaultWeights = (type) => {
		return defaultWeightsByType[type] || defaultWeightsByType['Specialty Coffee/Café'];
	};

	let weights = $state(getDefaultWeights(businessType));

	const balanceWeights = (changedKey, newValue) => {
		weights[changedKey] = Math.max(0, Math.min(newValue, 100));

		const min = changedKey === 'l7_feel' ? 0 : 5;
		const max = changedKey === 'l7_feel' ? 25 : 100;
		weights[changedKey] = Math.max(min, Math.min(newValue, max));

		const total = Object.values(weights).reduce((a, b) => a + b, 0);
		if (total !== 100) {
			const scaleFactor = (100 - weights[changedKey]) / (total - weights[changedKey]);
			for (const key in weights) {
				if (key !== changedKey) {
					weights[key] = Math.round(weights[key] * scaleFactor);
				}
			}
			const newTotal = Object.values(weights).reduce((a, b) => a + b, 0);
			if (newTotal !== 100) {
				const diff = 100 - newTotal;
				const keysToAdjust = Object.keys(weights).filter((k) => k !== changedKey);
				if (keysToAdjust.length > 0) {
					const adjustKey = keysToAdjust[0];
					weights[adjustKey] += diff;
				}
			}
		}
	};

	const resetWeights = () => {
		weights = getDefaultWeights(businessType);
		triggerSave();
	};

	$effect(() => {
		weights = getDefaultWeights(businessType);
	});

	$effect(() => {
		void businessType; void JSON.stringify(weights);
		autoSave();
	});

	let weightColors = [
		'#e74c3c',
		'#f39c12',
		'#f1c40f',
		'#27ae60',
		'#3498db',
		'#9b59b6',
		'#1abc9c',
		'#34495e'
	];

	let lpData = $state(null);

	onMount(() => {
		const data = loadLaunchPadData();
		lpData = data;
		if (data.lastSaved > 0) {
			businessType = data.businessType || businessType;
			weights = { ...weights, ...data.weights };
		}
		loaded = true;
	});

	// Live score preview — recomputes when weights change
	const liveScores = $derived.by(() => {
		if (!loaded || !lpData) return null;
		// Build temporary lpData with current weights
		const tempData = { ...lpData, weights, businessType };
		const scored = scoreAllNeighborhoods(tempData);
		if (scored.length === 0) return null;
		return scored.slice(0, 3).map(n => ({
			name: n.name,
			score: n.overallScore,
			vlf: n.vlf,
			glf: n.glf,
			rr: n.rr,
			label: getScoreLabel(n.overallScore)
		}));
	});
</script>

<svelte:head><title>RE² — Concept: Engine Calibration</title></svelte:head>

<div class="page">
	<!-- Page Header -->
	<div class="page-header">
		<div class="breadcrumbs">
			<a href="/app/vision/founder" class="breadcrumb completed">✓ Founder</a>
			<span class="breadcrumb-arrow">→</span>
			<a href="/app/vision/concept" class="breadcrumb completed">✓ Concept</a>
			<span class="breadcrumb-arrow">→</span>
			<a href="/app/vision/financial" class="breadcrumb completed">✓ Financial</a>
			<span class="breadcrumb-arrow">→</span>
			<a href="/app/vision/calibration" class="breadcrumb active">Calibration</a>
		</div>
		<h1>ENGINE CALIBRATION</h1>
		<p class="subtitle">Alignment Engine Weights (L0-L7)</p>
	</div>

	{#if saveStatus}
		<div class="save-indicator">{saveStatus}</div>
	{/if}

	<div class="content">
		<!-- Alignment Engine Weights -->
		<section class="section weight-section">
			<div class="section-context-paragraph">
				These weights determine how the algorithm scores locations for YOUR specific business. A coffee shop needs foot traffic above all else. A destination restaurant cares more about transit access and reputation. Adjust these to match what matters most to you.
			</div>
			<div class="section-header">
				<div>
					<h2>Alignment Engine Weights</h2>
					<p class="weight-subtitle">Adjust how much each factor matters for YOUR specific business</p>
				</div>
				<button class="btn-reset" onclick={() => resetWeights()}>Reset to Default</button>
			</div>

			<div class="section-content">
				<!-- Business Type Selector -->
				<div class="form-group" style="margin-bottom: 2rem;">
					<label for="businessType">Business Type (to auto-load preset weights)</label>
					<select bind:value={businessType} id="businessType" oninput={triggerSave}>
						{#each businessTypes as type}
							<option value={type}>{type}</option>
						{/each}
					</select>
				</div>

				<!-- Sliders Grid -->
				<div class="sliders-grid">
					<div class="slider-item">
						<div class="slider-label">L0 Macro Climate</div>
						<div class="slider-value">{weights.l0_macro}%</div>
						<input
							type="range"
							min="0"
							max="100"
							value={weights.l0_macro}
							onchange={(e) => { balanceWeights('l0_macro', parseInt(e.target.value)); triggerSave(); }}
							class="slider"
						/>
						<div class="slider-desc">Economic climate & market trends</div>
					</div>

					<div class="slider-item">
						<div class="slider-label">L1 City Dynamics</div>
						<div class="slider-value">{weights.l1_city}%</div>
						<input
							type="range"
							min="0"
							max="100"
							value={weights.l1_city}
							onchange={(e) => { balanceWeights('l1_city', parseInt(e.target.value)); triggerSave(); }}
							class="slider"
						/>
						<div class="slider-desc">Urban development & growth</div>
					</div>

					<div class="slider-item">
						<div class="slider-label">L2 Block Intelligence</div>
						<div class="slider-value">{weights.l2_block}%</div>
						<input
							type="range"
							min="0"
							max="100"
							value={weights.l2_block}
							onchange={(e) => { balanceWeights('l2_block', parseInt(e.target.value)); triggerSave(); }}
							class="slider"
						/>
						<div class="slider-desc">Foot traffic & demographics</div>
					</div>

					<div class="slider-item">
						<div class="slider-label">L3 Plan Fit</div>
						<div class="slider-value">{weights.l3_planfit}%</div>
						<input
							type="range"
							min="0"
							max="100"
							value={weights.l3_planfit}
							onchange={(e) => { balanceWeights('l3_planfit', parseInt(e.target.value)); triggerSave(); }}
							class="slider"
						/>
						<div class="slider-desc">Space size & rent alignment</div>
					</div>

					<div class="slider-item">
						<div class="slider-label">L4 Talent</div>
						<div class="slider-value">{weights.l4_talent}%</div>
						<input
							type="range"
							min="0"
							max="100"
							value={weights.l4_talent}
							onchange={(e) => { balanceWeights('l4_talent', parseInt(e.target.value)); triggerSave(); }}
							class="slider"
						/>
						<div class="slider-desc">Labor availability & wages</div>
					</div>

					<div class="slider-item">
						<div class="slider-label">L5 Resilience</div>
						<div class="slider-value">{weights.l5_resilience}%</div>
						<input
							type="range"
							min="0"
							max="100"
							value={weights.l5_resilience}
							onchange={(e) => { balanceWeights('l5_resilience', parseInt(e.target.value)); triggerSave(); }}
							class="slider"
						/>
						<div class="slider-desc">Economic stability & diversity</div>
					</div>

					<div class="slider-item">
						<div class="slider-label">L6 Zoning & Legal</div>
						<div class="slider-value">{weights.l6_zoning}%</div>
						<input
							type="range"
							min="0"
							max="100"
							value={weights.l6_zoning}
							onchange={(e) => { balanceWeights('l6_zoning', parseInt(e.target.value)); triggerSave(); }}
							class="slider"
						/>
						<div class="slider-desc">Zoning compliance & permits</div>
					</div>

					<div class="slider-item">
						<div class="slider-label">L7 Feel</div>
						<div class="slider-value">{weights.l7_feel}%</div>
						<input
							type="range"
							min="0"
							max="25"
							value={weights.l7_feel}
							onchange={(e) => { balanceWeights('l7_feel', parseInt(e.target.value)); triggerSave(); }}
							class="slider"
						/>
						<div class="slider-desc">Neighborhood vibe & culture</div>
					</div>
				</div>

				<!-- Weight Bar Visualization -->
				<div class="weight-bar-container">
					<div class="weight-bar-bg">
						{#each Object.entries(weights) as [key, value], idx}
							<div
								class="weight-segment"
								style="width: {value}%; background-color: {weightColors[idx]}"
								title="{key}: {value}%"
							></div>
						{/each}
					</div>
					<div class="weight-labels">
						<span>L0</span>
						<span>L1</span>
						<span>L2</span>
						<span>L3</span>
						<span>L4</span>
						<span>L5</span>
						<span>L6</span>
						<span>L7</span>
					</div>
				</div>

				<!-- Total Verification -->
				<div class="weight-total" style="margin-top: 2rem;">
					<strong>Total Weight:</strong> {Object.values(weights).reduce((a, b) => a + b, 0)}%
				</div>

				<!-- Live Score Preview -->
				{#if liveScores && liveScores.length > 0}
					<div class="sensitivity-panel">
						<h3 class="sensitivity-title">Live Score Preview</h3>
						<p class="sensitivity-desc">See how your weight changes affect neighborhood scores in real time.</p>
						<div class="sensitivity-scores">
							{#each liveScores as hood}
								<div class="sensitivity-card">
									<div class="sensitivity-name">{hood.name}</div>
									<div class="sensitivity-score" style="color: {hood.label.color}">{hood.score}</div>
									<div class="sensitivity-label" style="color: {hood.label.color}; background: {hood.label.bgColor}">{hood.label.label}</div>
									<div class="sensitivity-breakdown">
										<span title="Concept-Location Fit">VLF {hood.vlf}</span>
										<span title="Goal Feasibility">GLF {hood.glf}</span>
										<span title="Risk & Resilience">R&R {hood.rr}</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</section>

		<!-- E=MC² Button — Evaluate My Concept Clarity -->
		<EMC2Button
			expansionText="Evaluate My Concept Clarity"
			steps={['Validating founder profile...', 'Checking concept consistency...', 'Assessing financial alignment...', 'Computing vision readiness...']}
			onTrigger={async () => {
				triggerSave();
			}}
		/>

		<!-- Navigation -->
		<div class="nav-footer">
			<a href="/app/vision/financial" class="nav-link">← Back: Financial</a>
			<a href="/app/vision/review" class="nav-link primary">Next: Review →</a>
		</div>
	</div>
</div>

<style>
	:global(body) {
		background-color: var(--bg);
		color: var(--text);
	}

	.save-indicator {
		position: fixed;
		top: 60px;
		right: 24px;
		background: var(--green-soft);
		color: var(--success);
		padding: 6px 16px;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 500;
		z-index: 100;
		animation: fadeIn 0.3s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.5rem 1rem;
		background-color: var(--bg);
		color: var(--text);
	}

	.page-header {
		margin-bottom: 2rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 1rem;
	}

	.breadcrumbs {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		font-size: 13px;
	}

	.breadcrumb {
		color: var(--text-tertiary);
		text-decoration: none;
		transition: color 0.2s;
	}

	.breadcrumb:hover {
		color: var(--text-secondary);
	}

	.breadcrumb.active {
		color: var(--success);
		font-weight: 600;
	}

	.breadcrumb.completed {
		color: var(--success);
	}

	.breadcrumb-arrow {
		color: var(--border);
	}

	.page-header h1 {
		font-family: 'Syne', sans-serif;
		font-size: 22px;
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		color: var(--text);
		letter-spacing: 0.5px;
	}

	.page-header .subtitle {
		font-family: 'Courier New', monospace;
		font-size: 15px;
		margin: 0;
		color: var(--text-secondary);
		letter-spacing: 0.3px;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.section {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
	}

	.weight-section {
	}

	.section-context-paragraph {
		padding: 1rem;
		background-color: var(--surface-alt);
		border-bottom: 1px solid var(--border);
		font-size: 15px;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.section-header {
		padding: 1rem;
		background-color: var(--surface);
		border-bottom: 1px solid var(--border);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.section-header h2 {
		font-size: 15px;
		font-weight: 700;
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		color: var(--text-secondary);
	}

	.weight-subtitle {
		font-family: 'Courier New', monospace;
		font-size: 14px;
		color: var(--text-secondary);
		margin: 0.4rem 0 0 0;
		letter-spacing: 0.3px;
	}

	.btn-reset {
		font-size: 14px;
		padding: 0.4rem 0.8rem;
		background-color: var(--bg);
		border: 1px solid var(--border);
		color: var(--text);
		cursor: pointer;
		border-radius: 2px;
		font-weight: 600;
		transition: all 0.2s;
	}

	.btn-reset:hover {
		background-color: var(--surface);
		border-color: var(--border-hover);
	}

	.section-content {
		padding: 1rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.form-group label {
		font-family: 'Courier New', monospace;
		font-size: 15px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
	}

	.form-group input,
	.form-group select {
		padding: 12px 16px;
		background-color: var(--bg);
		border: 1px solid var(--border);
		color: var(--text);
		font-size: 15px;
		font-family: inherit;
		border-radius: 2px;
		transition: all 0.2s;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--danger);
		background-color: var(--surface);
	}

	.sliders-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1.2rem;
		margin-bottom: 1.5rem;
	}

	.slider-item {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.slider-label {
		font-size: 15px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
	}

	.slider-value {
		font-family: 'Courier New', monospace;
		font-size: 15px;
		font-weight: 700;
		color: var(--text);
	}

	.slider {
		width: 100%;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		outline: none;
		-webkit-appearance: none;
		appearance: none;
	}

	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		background: var(--danger);
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.2s;
	}

	.slider::-webkit-slider-thumb:hover {
		background: #FF453A;
		transform: scale(1.1);
	}

	.slider::-moz-range-thumb {
		width: 14px;
		height: 14px;
		background: var(--danger);
		border-radius: 50%;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.slider::-moz-range-thumb:hover {
		background: #FF453A;
		transform: scale(1.1);
	}

	.slider-desc {
		font-family: 'Courier New', monospace;
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.2;
	}

	.weight-bar-container {
		margin-top: 1.5rem;
	}

	.weight-bar-bg {
		display: flex;
		height: 20px;
		background-color: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: 2px;
		overflow: hidden;
		gap: 0;
	}

	.weight-segment {
		flex: 1;
		transition: width 0.3s ease;
		opacity: 0.9;
	}

	.weight-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 0.4rem;
		font-family: 'Courier New', monospace;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.weight-total {
		padding: 0.8rem 1rem;
		background-color: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		text-align: center;
		font-size: 14px;
		color: var(--text-secondary);
	}

	.weight-total strong {
		color: var(--text);
	}

	.nav-footer {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}

	.nav-link {
		padding: 0.8rem 1.5rem;
		background-color: var(--surface);
		border: 1px solid var(--border);
		color: var(--text);
		text-decoration: none;
		border-radius: 4px;
		font-weight: 600;
		transition: all 0.2s;
		font-size: 14px;
	}

	.nav-link:hover {
		border-color: var(--danger);
		color: var(--danger);
	}

	.nav-link.primary {
		background-color: var(--danger);
		border-color: var(--danger);
		color: #fff;
	}

	.nav-link.primary:hover {
		background-color: #FF453A;
		border-color: #FF453A;
	}

	@media (max-width: 1024px) {
		.sliders-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 768px) {
		.sliders-grid {
			grid-template-columns: 1fr;
		}

		.nav-footer {
			flex-direction: column;
		}

		.section-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.btn-reset {
			align-self: flex-start;
		}
	}

	/* Sensitivity Panel */
	.sensitivity-panel {
		margin-top: 2rem;
		background: var(--surface-alt);
		border-radius: 12px;
		padding: 1.25rem;
		border: 1px solid var(--border);
	}
	.sensitivity-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 4px 0;
	}
	.sensitivity-desc {
		font-size: 12px;
		color: var(--text-secondary);
		margin: 0 0 1rem 0;
	}
	.sensitivity-scores {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	.sensitivity-card {
		flex: 1;
		min-width: 140px;
		background: var(--surface);
		border-radius: 10px;
		padding: 12px;
		text-align: center;
	}
	.sensitivity-name {
		font-size: 11px;
		color: var(--text-secondary);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		margin-bottom: 6px;
	}
	.sensitivity-score {
		font-size: 32px;
		font-weight: 800;
		line-height: 1;
		margin-bottom: 4px;
	}
	.sensitivity-label {
		display: inline-block;
		font-size: 10px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 10px;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		margin-bottom: 8px;
	}
	.sensitivity-breakdown {
		display: flex;
		gap: 8px;
		justify-content: center;
		font-size: 10px;
		color: var(--text-tertiary);
	}
	.sensitivity-breakdown span {
		background: var(--surface-alt);
		padding: 2px 6px;
		border-radius: 4px;
	}
</style>
