<script lang="ts">
	/**
	 * Weight Slider UI — lets users tune the 6-index weights
	 * per concept type, with real-time normalization and distribution bar.
	 *
	 * Svelte 5 runes — $state, $derived, $props.
	 */

	type IndexName = 'transit' | 'demographics' | 'competition' | 'vibrancy' | 'safety' | 'momentum';
	type ConceptType = 'specialty_coffee' | 'qsr' | 'full_service_restaurant' | 'fitness_studio' | 'retail' | 'bar_nightlife' | 'coworking';

	interface ConceptPreset {
		label: string;
		weights: Record<IndexName, number>;
	}

	const PRESETS: Record<ConceptType, ConceptPreset> = {
		specialty_coffee:        { label: 'Specialty Coffee / Café',    weights: { transit: 25, demographics: 20, competition: 20, vibrancy: 15, safety: 10, momentum: 10 } },
		qsr:                     { label: 'Quick-Service Restaurant',   weights: { transit: 25, demographics: 15, competition: 25, vibrancy: 15, safety: 10, momentum: 10 } },
		full_service_restaurant: { label: 'Full-Service Restaurant',    weights: { transit: 15, demographics: 25, competition: 20, vibrancy: 15, safety: 10, momentum: 15 } },
		fitness_studio:          { label: 'Fitness Studio',             weights: { transit: 20, demographics: 25, competition: 25, vibrancy: 10, safety: 10, momentum: 10 } },
		retail:                  { label: 'Retail',                     weights: { transit: 25, demographics: 20, competition: 15, vibrancy: 20, safety: 10, momentum: 10 } },
		bar_nightlife:           { label: 'Bar / Nightlife',            weights: { transit: 15, demographics: 15, competition: 15, vibrancy: 30, safety: 10, momentum: 15 } },
		coworking:               { label: 'Co-Working Space',           weights: { transit: 25, demographics: 20, competition: 20, vibrancy: 10, safety: 10, momentum: 15 } }
	};

	const INDEX_META: { key: IndexName; label: string; icon: string; color: string; desc: string }[] = [
		{ key: 'transit',       label: 'Transit',       icon: '🚇', color: '#3b82f6', desc: 'MTA ridership + pedestrian counts + Walk Score' },
		{ key: 'demographics',  label: 'Demographics',  icon: '👥', color: '#8b5cf6', desc: 'Income, education, housing, population density' },
		{ key: 'competition',   label: 'Competition',   icon: '⚔️', color: 'var(--danger)', desc: 'Competitor density, how crowded the market is, gaps' },
		{ key: 'vibrancy',      label: 'Concept Pulse', icon: '✨', color: '#f59e0b', desc: 'How alive your trade-area ring is — sized to your concept, not the whole neighborhood' },
		{ key: 'safety',        label: 'Safety',        icon: '🛡️', color: '#10b981', desc: 'Crime data, 311 complaints, DOB violations' },
		{ key: 'momentum',      label: 'Momentum',      icon: '📈', color: '#ec4899', desc: 'New permits, business growth, complaint trends' }
	];

	let {
		conceptType = $bindable('specialty_coffee' as ConceptType),
		weights = $bindable({ ...PRESETS.specialty_coffee.weights }),
		onchange = () => {}
	} = $props();

	let expanded = $state(false);
	let isCustom = $state(false);

	let total = $derived(Object.values(weights).reduce((a, b) => a + b, 0));
	let normalizedWeights = $derived(
		Object.fromEntries(
			Object.entries(weights).map(([k, v]) => [k, total > 0 ? v / total : 1 / 6])
		) as Record<IndexName, number>
	);

	function selectConcept(ct: ConceptType) {
		conceptType = ct;
		weights = { ...PRESETS[ct].weights };
		isCustom = false;
		onchange();
	}

	function adjustWeight(key: IndexName, value: number) {
		weights = { ...weights, [key]: value };
		isCustom = true;
		onchange();
	}

	function resetToPreset() {
		weights = { ...PRESETS[conceptType].weights };
		isCustom = false;
		onchange();
	}
</script>

<section class="weight-panel" class:expanded>
	<button class="panel-toggle" onclick={() => expanded = !expanded}>
		<span class="toggle-icon">{expanded ? '▾' : '▸'}</span>
		<span class="toggle-label">Scoring Weights</span>
		<span class="toggle-concept">{PRESETS[conceptType].label}{isCustom ? ' (custom)' : ''}</span>
	</button>

	{#if expanded}
		<div class="panel-body">
			<!-- Concept type selector -->
			<div class="concept-row">
				{#each Object.entries(PRESETS) as [ct, preset]}
					<button
						class="concept-chip"
						class:active={conceptType === ct && !isCustom}
						onclick={() => selectConcept(ct as ConceptType)}
					>
						{preset.label}
					</button>
				{/each}
			</div>

			<!-- Distribution bar -->
			<div class="dist-bar">
				{#each INDEX_META as idx}
					<div
						class="dist-segment"
						style="width: {normalizedWeights[idx.key] * 100}%; background: {idx.color};"
						title="{idx.label}: {Math.round(normalizedWeights[idx.key] * 100)}%"
					></div>
				{/each}
			</div>
			<div class="dist-labels">
				{#each INDEX_META as idx}
					<span style="color: {idx.color}; flex: {normalizedWeights[idx.key]};">{Math.round(normalizedWeights[idx.key] * 100)}%</span>
				{/each}
			</div>

			<!-- Sliders -->
			<div class="sliders-grid">
				{#each INDEX_META as idx}
					<div class="slider-item">
						<div class="slider-header">
							<span class="slider-icon">{idx.icon}</span>
							<span class="slider-label">{idx.label}</span>
							<span class="slider-pct" style="color: {idx.color}">{Math.round(normalizedWeights[idx.key] * 100)}%</span>
						</div>
						<input
							type="range"
							min="0"
							max="50"
							value={weights[idx.key]}
							oninput={(e) => adjustWeight(idx.key, parseInt(e.currentTarget.value))}
							class="slider"
							style="--track-color: {idx.color};"
						/>
						<div class="slider-desc">{idx.desc}</div>
					</div>
				{/each}
			</div>

			{#if isCustom}
				<div class="reset-row">
					<button class="btn-reset" onclick={resetToPreset}>
						Reset to {PRESETS[conceptType].label} defaults
					</button>
				</div>
			{/if}
		</div>
	{/if}
</section>

<style>
	.weight-panel {
		background: #ffffff;
		border: 1px solid var(--border, #d2d2d7);
		border-radius: 14px;
		margin-bottom: 18px;
		overflow: hidden;
	}

	.panel-toggle {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 16px 20px;
		background: transparent;
		border: none;
		color: var(--text, var(--text));
		cursor: pointer;
		font-family: inherit;
		text-align: left;
	}

	.panel-toggle:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.toggle-icon {
		font-size: 12px;
		color: var(--muted, var(--text-secondary));
		width: 16px;
	}

	.toggle-label {
		font-size: 14px;
		font-weight: 800;
		letter-spacing: 0.5px;
		text-transform: uppercase;
	}

	.toggle-concept {
		font-size: 12px;
		color: var(--cyan, var(--accent));
		font-family: 'DM Mono', 'Courier New', monospace;
		margin-left: auto;
	}

	.panel-body {
		padding: 0 20px 20px;
	}

	/* Concept chips */
	.concept-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 16px;
	}

	.concept-chip {
		padding: 6px 12px;
		background: #f5f5f7;
		border: 1px solid var(--border, #d2d2d7);
		border-radius: 6px;
		color: #6e6e73;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}

	.concept-chip:hover {
		border-color: #0071E3;
		color: #1d1d1f;
	}

	.concept-chip.active {
		background: rgba(0, 113, 227, 0.1);
		border-color: #0071E3;
		color: #0071E3;
	}

	/* Distribution bar */
	.dist-bar {
		display: flex;
		height: 8px;
		border-radius: 4px;
		overflow: hidden;
		gap: 1px;
		margin-bottom: 4px;
	}

	.dist-segment {
		transition: width 0.25s ease;
		opacity: 0.85;
		min-width: 2px;
	}

	.dist-labels {
		display: flex;
		margin-bottom: 16px;
		font-family: 'DM Mono', 'Courier New', monospace;
		font-size: 10px;
		font-weight: 600;
		text-align: center;
	}

	.dist-labels span {
		text-align: center;
		transition: flex 0.25s ease;
	}

	/* Sliders */
	.sliders-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		margin-bottom: 12px;
	}

	.slider-item {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.slider-header {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.slider-icon {
		font-size: 14px;
	}

	.slider-label {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--sub, var(--text-secondary));
	}

	.slider-pct {
		margin-left: auto;
		font-family: 'DM Mono', 'Courier New', monospace;
		font-size: 13px;
		font-weight: 700;
	}

	.slider {
		width: 100%;
		height: 4px;
		background: #e5e5e9;
		border-radius: 2px;
		outline: none;
		-webkit-appearance: none;
		appearance: none;
		cursor: pointer;
	}

	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		background: var(--track-color, var(--cyan, var(--accent)));
		border-radius: 50%;
		cursor: pointer;
		transition: transform 0.15s;
	}

	.slider::-webkit-slider-thumb:hover {
		transform: scale(1.2);
	}

	.slider::-moz-range-thumb {
		width: 14px;
		height: 14px;
		background: var(--track-color, var(--cyan, var(--accent)));
		border-radius: 50%;
		border: none;
		cursor: pointer;
	}

	.slider-desc {
		font-size: 11px;
		color: var(--muted, var(--text-secondary));
		line-height: 1.3;
		font-family: 'DM Mono', 'Courier New', monospace;
	}

	/* Reset */
	.reset-row {
		text-align: center;
		margin-top: 8px;
	}

	.btn-reset {
		padding: 6px 14px;
		font-size: 11px;
		background: #f5f5f7;
		border: 1px solid #d2d2d7;
		color: #6e6e73;
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
		transition: all 0.15s;
	}

	.btn-reset:hover {
		border-color: #0071E3;
		color: #1d1d1f;
	}

	@media (max-width: 768px) {
		.sliders-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.concept-row {
			gap: 4px;
		}
		.concept-chip {
			font-size: 10px;
			padding: 5px 8px;
		}
	}

	@media (max-width: 480px) {
		.sliders-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
