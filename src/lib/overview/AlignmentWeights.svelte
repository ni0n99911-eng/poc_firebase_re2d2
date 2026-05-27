<script>
	import '../overview/shared.css';

	let {
		weights = $bindable(),
		onbalance,
		onreset,
		onsave
	} = $props();
</script>

<section class="section weight-section">
	<div class="section-context-paragraph">
		These weights determine how the algorithm scores locations for YOUR specific business. A coffee shop needs foot traffic above all else. A destination restaurant cares more about transit access and reputation. Adjust these to match what matters most to you.
	</div>
	<div class="section-header">
		<div>
			<h2>Alignment Engine Weights</h2>
			<p class="weight-subtitle">Adjust how much each factor matters for YOUR specific business</p>
		</div>
		<button class="btn-reset" onclick={() => { onreset(); onsave(); }}>Reset to Default</button>
	</div>

	<div class="section-content">
		<div class="sliders-grid">
			{#each [
				{ key: 'l0_macro', label: 'L0 Macro Climate', desc: 'Economic climate & market trends', max: 100 },
				{ key: 'l1_city', label: 'L1 City Dynamics', desc: 'Urban development & growth', max: 100 },
				{ key: 'l2_block', label: 'L2 Block Intelligence', desc: 'Local foot traffic & density', max: 100 },
				{ key: 'l3_planfit', label: 'L3 Business Plan Fit', desc: 'Alignment with your plan', max: 100 },
				{ key: 'l4_talent', label: 'L4 Talent Accessibility', desc: 'Quality staff availability', max: 100 },
				{ key: 'l5_resilience', label: 'L5 Resilience & Wildcards', desc: 'Risk mitigation factors', max: 100 },
				{ key: 'l6_zoning', label: 'L6 Zoning & Physical Risk', desc: 'Regulatory & environmental risks', max: 100 },
				{ key: 'l7_feel', label: 'L7 Location Feel', desc: 'Your gut feeling about this location', max: 25 }
			] as item}
				<div class="slider-item">
					<div class="slider-label">{item.label}</div>
					<div class="slider-value">{weights[item.key]}%</div>
					<input
						type="range"
						min="0"
						max={item.max}
						value={weights[item.key]}
						onchange={(e) => { onbalance(item.key, parseInt(e.target.value)); onsave(); }}
						class="slider"
					/>
					<div class="slider-desc">{item.desc}</div>
				</div>
			{/each}
		</div>

		<!-- Weight Distribution Bar -->
		<div class="weight-bar-container">
			<div class="weight-bar-bg">
				<div class="weight-segment" style="width: {weights.l0_macro}%; background-color: #e74c3c;" title="L0"></div>
				<div class="weight-segment" style="width: {weights.l1_city}%; background-color: #e67e22;" title="L1"></div>
				<div class="weight-segment" style="width: {weights.l2_block}%; background-color: #f39c12;" title="L2"></div>
				<div class="weight-segment" style="width: {weights.l3_planfit}%; background-color: #27ae60;" title="L3"></div>
				<div class="weight-segment" style="width: {weights.l4_talent}%; background-color: #2980b9;" title="L4"></div>
				<div class="weight-segment" style="width: {weights.l5_resilience}%; background-color: #8e44ad;" title="L5"></div>
				<div class="weight-segment" style="width: {weights.l6_zoning}%; background-color: #c0392b;" title="L6"></div>
				<div class="weight-segment" style="width: {weights.l7_feel}%; background-color: #d35400;" title="L7"></div>
			</div>
			<div class="weight-labels">
				<span>L0</span><span>L1</span><span>L2</span><span>L3</span>
				<span>L4</span><span>L5</span><span>L6</span><span>L7</span>
			</div>
		</div>
	</div>
</section>

<style>
	.weight-subtitle {
		font-family: 'Courier New', monospace;
		font-size: 14px;
		color: #888;
		margin: 0.4rem 0 0 0;
		letter-spacing: 0.3px;
	}

	.btn-reset {
		font-size: 14px;
		padding: 0.4rem 0.8rem;
		background-color: var(--surface-alt, #F0F3F7);
		border: 1px solid var(--border, #E0E5ED);
		color: var(--text-secondary, #5A6578);
		cursor: pointer;
		border-radius: 2px;
		font-weight: 600;
		transition: all 0.2s;
	}

	.btn-reset:hover {
		background-color: var(--surface, #FFFFFF);
		border-color: var(--border-hover, #D4DBE5);
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
		color: var(--text-secondary, #5A6578);
	}

	.slider-value {
		font-family: 'Courier New', monospace;
		font-size: 15px;
		font-weight: 700;
		color: var(--text, #1A202C);
	}

	.slider {
		width: 100%;
		height: 4px;
		background: var(--surface-alt, #F0F3F7);
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
		background: #EF4444;
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.2s;
	}

	.slider::-webkit-slider-thumb:hover {
		background: #F87171;
		transform: scale(1.1);
	}

	.slider::-moz-range-thumb {
		width: 14px;
		height: 14px;
		background: #EF4444;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.slider::-moz-range-thumb:hover {
		background: #F87171;
		transform: scale(1.1);
	}

	.slider-desc {
		font-family: 'Courier New', monospace;
		font-size: 13px;
		color: var(--text-secondary, #5A6578);
		line-height: 1.2;
	}

	.weight-bar-container {
		margin-top: 1.5rem;
	}

	.weight-bar-bg {
		display: flex;
		height: 20px;
		background-color: var(--surface-alt, #F0F3F7);
		border: 1px solid var(--border, #E0E5ED);
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
		color: var(--text-secondary, #5A6578);
		color: #888;
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

		.btn-reset {
			align-self: flex-start;
		}
	}
</style>
