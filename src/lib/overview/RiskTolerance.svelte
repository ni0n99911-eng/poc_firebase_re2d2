<script>
	import '../overview/shared.css';

	let {
		riskTolerance = $bindable()
	} = $props();
</script>

<section class="section">
	<div class="section-context-paragraph">
		Describe your risk appetite and timeline expectations. Conservative operators need predictable neighborhoods; aggressive operators can take bets on emerging areas.
	</div>
	<div class="section-header">
		<h2>Risk Tolerance & Timeline</h2>
	</div>

	<div class="section-content">
		<!-- Risk Level Slider -->
		<div class="form-group" style="margin-bottom: 2rem;">
			<div class="label-with-helper">
				<label style="margin-bottom: 0.5rem;">Risk Appetite: Conservative ↔ Aggressive</label>
				<span class="input-helper">Affects neighborhood stability scores and growth projections</span>
			</div>
			<div class="risk-slider-container">
				<div class="risk-label">Conservative</div>
				<input
					type="range"
					min="10"
					max="90"
					bind:value={riskTolerance.riskLevel}
					class="risk-slider"
				/>
				<div class="risk-label">Aggressive</div>
			</div>
			<div class="risk-value-display">
				Current Risk Level: <strong>{riskTolerance.riskLevel}%</strong>
				<span class="risk-description">
					{#if riskTolerance.riskLevel < 35}
						Very Conservative — Established areas, proven concepts
					{:else if riskTolerance.riskLevel < 55}
						Balanced — Mix of stable and emerging neighborhoods
					{:else if riskTolerance.riskLevel < 75}
						Growth-oriented — Willing to bet on emerging areas
					{:else}
						Aggressive — High-growth, early-stage neighborhoods
					{/if}
				</span>
			</div>
		</div>

		<!-- Break-even & Burn Rate -->
		<div class="grid grid-2col">
			<div class="form-group">
				<label for="maxBurn">Max Monthly Burn During Ramp-up</label>
				<input
					type="number"
					id="maxBurn"
					bind:value={riskTolerance.maxMonthlyBurn}
					placeholder="15000"
					min="5000"
					step="1000"
				/>
				<span class="input-helper">Maximum acceptable monthly cash burn before profitability</span>
			</div>

			<div class="form-group">
				<label for="breakEven">Break-even Timeline Tolerance</label>
				<select bind:value={riskTolerance.breakEvenTimeframe} id="breakEven">
					<option value="12mo">12 months</option>
					<option value="18mo">18 months</option>
					<option value="24mo">24 months</option>
					<option value="36mo">36 months</option>
				</select>
				<span class="input-helper">How long until you expect to reach break-even</span>
			</div>
		</div>
	</div>
</section>

<style>
	.label-with-helper {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.risk-slider-container {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.8rem;
	}

	.risk-label {
		font-size: 13px;
		color: var(--text-secondary, #5A6578);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		white-space: nowrap;
		width: 100px;
	}

	.risk-slider {
		flex: 1;
		height: 6px;
		border-radius: 3px;
		background: linear-gradient(to right, #EF4444 0%, #F59E0B 50%, #10B981 100%);
		outline: none;
		-webkit-appearance: none;
		appearance: none;
	}

	.risk-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #FFFFFF;
		cursor: pointer;
		border: 2px solid var(--text, #1A202C);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.risk-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #FFFFFF;
		cursor: pointer;
		border: 2px solid var(--text, #1A202C);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.risk-value-display {
		font-size: 14px;
		color: var(--text-secondary, #5A6578);
		padding-top: 0.5rem;
		border-top: 1px solid var(--border, #E0E5ED);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.risk-value-display strong {
		color: var(--text, #1A202C);
		font-size: 16px;
	}

	.risk-description {
		font-size: 13px;
		color: var(--text-secondary, #5A6578);
		font-weight: 600;
		margin-left: 1rem;
	}
</style>
