<script lang="ts">
	// 04.19.2026 18:00 - FactorDrilldown Component Story/Test Harness
	import FactorDrilldown from './FactorDrilldown.svelte';
	import type { EvidencePayload } from '$lib/utils/decision-engine';
	import { LocationAnalysisStore } from '../location-analysis.svelte';

	// Mock Store
	const store = new LocationAnalysisStore();

	// Mock Payload representing typical RE² inference output
	const mockEvidence: EvidencePayload = {
		helping: [
			{ label: 'Foot Traffic', copy: 'Extremely dense pedestrian zone.', value: 85 },
			{ label: 'Demographics', copy: 'Target income brackets align perfectly.', value: 72 },
			{ label: 'Proximity', copy: 'Close to major transit hubs.', value: 60 }
		],
		hurting: [
			{ label: 'Competition', copy: 'Saturated with direct competitors.', value: 40 },
			{ label: 'Crime', copy: 'High reported property crime locally.', value: 35 }
		]
	};
</script>

<div style="background: #111; padding: 2rem; border-radius: 8px;">
	<h2 style="color: white; margin-bottom: 1rem;">FactorDrilldown Harness</h2>
	<FactorDrilldown {store} evidence={mockEvidence} />
</div>
