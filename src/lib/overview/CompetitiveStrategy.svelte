<script>
	import '../overview/shared.css';

	let {
		competitiveStrategy = $bindable()
	} = $props();
</script>

<section class="section">
	<div class="section-context-paragraph">
		Define your competitive positioning and target customer segments. The algorithm uses these to score locations for your specific strategic fit, not generic viability.
	</div>
	<div class="section-header">
		<h2>Competitive Strategy</h2>
	</div>

	<div class="section-content">
		<!-- Key Differentiators -->
		<div class="subsection">
			<h3 class="subsection-title">Your Key Differentiators (select all that apply)</h3>
			<div class="checkbox-grid">
				<div class="checkbox-item">
					<input type="checkbox" id="diff-unique" bind:checked={competitiveStrategy.differentiators.uniqueProduct} />
					<label for="diff-unique">Unique product or service</label>
				</div>
				<div class="checkbox-item">
					<input type="checkbox" id="diff-price" bind:checked={competitiveStrategy.differentiators.priceLeader} />
					<label for="diff-price">Price leader / value positioning</label>
				</div>
				<div class="checkbox-item">
					<input type="checkbox" id="diff-premium" bind:checked={competitiveStrategy.differentiators.premiumExperience} />
					<label for="diff-premium">Premium experience / brand</label>
				</div>
				<div class="checkbox-item">
					<input type="checkbox" id="diff-health" bind:checked={competitiveStrategy.differentiators.healthWellness} />
					<label for="diff-health">Health / wellness focus</label>
				</div>
				<div class="checkbox-item">
					<input type="checkbox" id="diff-tech" bind:checked={competitiveStrategy.differentiators.technologyDriven} />
					<label for="diff-tech">Technology-driven innovation</label>
				</div>
				<div class="checkbox-item">
					<input type="checkbox" id="diff-community" bind:checked={competitiveStrategy.differentiators.communityHub} />
					<label for="diff-community">Community hub / gathering place</label>
				</div>
			</div>
		</div>

		<!-- Target Customer Segments -->
		<div class="subsection">
			<h3 class="subsection-title">Target Customer Segments (select all that apply)</h3>
			<div class="checkbox-grid">
				<div class="checkbox-item">
					<input type="checkbox" id="seg-office" bind:checked={competitiveStrategy.targetSegments.officeWorkers} />
					<label for="seg-office">Office / corporate workers</label>
				</div>
				<div class="checkbox-item">
					<input type="checkbox" id="seg-families" bind:checked={competitiveStrategy.targetSegments.families} />
					<label for="seg-families">Families with children</label>
				</div>
				<div class="checkbox-item">
					<input type="checkbox" id="seg-students" bind:checked={competitiveStrategy.targetSegments.students} />
					<label for="seg-students">Students / academic community</label>
				</div>
				<div class="checkbox-item">
					<input type="checkbox" id="seg-health" bind:checked={competitiveStrategy.targetSegments.healthEnthusiasts} />
					<label for="seg-health">Health / fitness enthusiasts</label>
				</div>
				<div class="checkbox-item">
					<input type="checkbox" id="seg-remote" bind:checked={competitiveStrategy.targetSegments.remoteWorkers} />
					<label for="seg-remote">Remote / freelance workers</label>
				</div>
				<div class="checkbox-item">
					<input type="checkbox" id="seg-tourists" bind:checked={competitiveStrategy.targetSegments.tourists} />
					<label for="seg-tourists">Tourists / visitors</label>
				</div>
			</div>
		</div>
	</div>
</section>
