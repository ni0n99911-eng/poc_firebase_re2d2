/**
 * Quick test script for Coffee Dimension 1: Morning Foot Traffic
 *
 * Tests the threshold logic directly (no SvelteKit imports needed)
 * and simulates full scoring with mock intel data.
 *
 * Run: npx tsx src/lib/intel/engines/test_dim1_morningFootTraffic.ts
 */

// ── Inline the threshold logic (same as the module, no $lib alias needed) ──

interface MorningFootTrafficThreshold {
	minPassersby: number;
	score: number;
	label: string;
}

const MORNING_FOOT_TRAFFIC_THRESHOLDS: MorningFootTrafficThreshold[] = [
	{ minPassersby: 10000, score: 95, label: 'Exceptional — major transit hub' },
	{ minPassersby: 5000,  score: 88, label: 'Excellent — high-volume commercial corridor' },
	{ minPassersby: 3000,  score: 72, label: 'Strong — reliable morning foot traffic' },
	{ minPassersby: 1500,  score: 52, label: 'Moderate — needs destination appeal' },
	{ minPassersby: 500,   score: 30, label: 'Weak — low walk-in potential' },
];

const MORNING_FOOT_TRAFFIC_FLOOR_SCORE = 12;

function applyThresholds(morningRaw: number): { score: number; label: string } {
	for (const tier of MORNING_FOOT_TRAFFIC_THRESHOLDS) {
		if (morningRaw >= tier.minPassersby) {
			return { score: tier.score, label: tier.label };
		}
	}
	return { score: MORNING_FOOT_TRAFFIC_FLOOR_SCORE, label: 'Very low — unlikely viable for walk-in coffee' };
}

// ── Inline the rush traffic extrapolation (simplified from segment-intel.ts) ──

function clamp(v: number, min = 0, max = 100): number {
	return Math.max(min, Math.min(max, isNaN(v) ? min : v));
}

interface MockIntel {
	mtaRidership?: { totalDailyRidership: number; stationCount: number };
	pedestrian?: { totalPedestrians: number; avgAMCount?: number; avgPMCount?: number; countLocationCount: number; footTrafficScore: number };
	census?: { populationDensity: number; daytimePopulationRatio?: number; medianHouseholdIncome: number };
}

function extrapolateMorningRaw(intel: MockIntel): { morningRaw: number; confidence: string; breakdown: string[] } {
	let morningRaw = 0;
	let confidence = 'estimated';
	const breakdown: string[] = [];

	if (intel.mtaRidership && intel.mtaRidership.totalDailyRidership > 0) {
		const dailyRiders = intel.mtaRidership.totalDailyRidership;
		const morningPeakRiders = dailyRiders * 0.32 * 0.83;
		morningRaw = morningPeakRiders * 0.20;
		confidence = 'moderate';
		breakdown.push(`MTA: ${dailyRiders.toLocaleString()} daily riders → ${Math.round(morningPeakRiders).toLocaleString()} morning peak → ${Math.round(morningRaw).toLocaleString()} walk-by (20% conversion)`);
	}

	if (intel.pedestrian && intel.pedestrian.totalPedestrians > 0) {
		const pedMorning = intel.pedestrian.avgAMCount || intel.pedestrian.totalPedestrians * 0.45;
		if (morningRaw > 0) {
			const mtaPortion = morningRaw;
			morningRaw = morningRaw * 0.6 + pedMorning * 0.4;
			confidence = 'high';
			breakdown.push(`Pedestrian: ${Math.round(pedMorning).toLocaleString()} AM count → blended 60/40 with MTA (${Math.round(mtaPortion)} × 0.6 + ${Math.round(pedMorning)} × 0.4 = ${Math.round(morningRaw)})`);
		} else {
			morningRaw = pedMorning;
			confidence = 'moderate';
			breakdown.push(`Pedestrian only: ${Math.round(pedMorning).toLocaleString()} AM count`);
		}
	}

	if (morningRaw === 0 && intel.census) {
		const density = intel.census.populationDensity || 0;
		const daytimeRatio = intel.census.daytimePopulationRatio || 1.0;
		morningRaw = density * daytimeRatio * 0.02;
		breakdown.push(`Census fallback: density ${density} × daytime ratio ${daytimeRatio} × 0.02 = ${Math.round(morningRaw)}`);
	}

	morningRaw = Math.round(clamp(morningRaw, 0, 50000));
	return { morningRaw, confidence, breakdown };
}

// ── Test Scenarios ──────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════');
console.log('  Coffee Dim 1: Morning Foot Traffic — Test Results');
console.log('═══════════════════════════════════════════════════════════\n');

// Test 1: Pure threshold logic
console.log('─── Test 1: Threshold Lookup (applyThresholds) ───\n');
const thresholdTests = [15000, 10000, 7500, 5000, 4000, 3000, 2000, 1500, 800, 500, 200, 50, 0];
console.log(
	'  Passersby'.padEnd(14) +
	'Score'.padEnd(8) +
	'Label'
);
console.log('  ' + '─'.repeat(60));
for (const raw of thresholdTests) {
	const { score, label } = applyThresholds(raw);
	console.log(
		`  ${raw.toLocaleString().padEnd(12)}${String(score).padEnd(8)}${label}`
	);
}

// Test 2: Full pipeline with mock intel scenarios
console.log('\n─── Test 2: Full Pipeline (extrapolation → threshold) ───\n');

const scenarios: { name: string; intel: MockIntel }[] = [
	{
		name: 'Times Square (major hub)',
		intel: {
			mtaRidership: { totalDailyRidership: 180000, stationCount: 4 },
			pedestrian: { totalPedestrians: 45000, avgAMCount: 22000, countLocationCount: 3, footTrafficScore: 95 },
		},
	},
	{
		name: 'Union Square (strong transit)',
		intel: {
			mtaRidership: { totalDailyRidership: 85000, stationCount: 2 },
			pedestrian: { totalPedestrians: 18000, avgAMCount: 8000, countLocationCount: 2, footTrafficScore: 80 },
		},
	},
	{
		name: 'Williamsburg Bedford Ave (neighborhood)',
		intel: {
			mtaRidership: { totalDailyRidership: 28000, stationCount: 1 },
			pedestrian: { totalPedestrians: 6000, countLocationCount: 1, footTrafficScore: 60 },
		},
	},
	{
		name: 'Residential side street (MTA only)',
		intel: {
			mtaRidership: { totalDailyRidership: 8000, stationCount: 1 },
		},
	},
	{
		name: 'Pedestrian-only area (no subway)',
		intel: {
			pedestrian: { totalPedestrians: 4000, avgAMCount: 2000, countLocationCount: 1, footTrafficScore: 55 },
		},
	},
	{
		name: 'Deep residential (census fallback only)',
		intel: {
			census: { populationDensity: 25000, daytimePopulationRatio: 0.8, medianHouseholdIncome: 65000 },
		},
	},
	{
		name: 'Industrial/low density area',
		intel: {
			census: { populationDensity: 5000, daytimePopulationRatio: 1.5, medianHouseholdIncome: 55000 },
		},
	},
];

for (const scenario of scenarios) {
	const { morningRaw, confidence, breakdown } = extrapolateMorningRaw(scenario.intel);
	const { score, label } = applyThresholds(morningRaw);

	console.log(`  📍 ${scenario.name}`);
	console.log(`     Morning passersby: ${morningRaw.toLocaleString()}`);
	console.log(`     Score: ${score}/100 — ${label}`);
	console.log(`     Confidence: ${confidence}`);
	console.log(`     Signal: ${score < 40 ? '⚠️  Low morning foot traffic warning' : '✅  No warning signal'}`);
	for (const line of breakdown) {
		console.log(`     📊 ${line}`);
	}
	console.log();
}

// Test 3: Dimension weight impact on composite
console.log('─── Test 3: Impact on Coffee Composite (30% weight) ───\n');
console.log(
	'  ftScore'.padEnd(12) +
	'Contribution'.padEnd(16) +
	'Impact on final (with 65 base from other dims)'
);
console.log('  ' + '─'.repeat(65));

const otherDimsBase = 65; // assume other 5 dims avg 65
for (const ftScore of [95, 88, 72, 52, 30, 12]) {
	const contribution = ftScore * 0.30;
	const otherContribution = otherDimsBase * 0.70;
	const composite = Math.round(contribution + otherContribution);
	const diff = composite - otherDimsBase;
	console.log(
		`  ${String(ftScore).padEnd(12)}${contribution.toFixed(1).padEnd(16)}${composite} (${diff >= 0 ? '+' : ''}${diff} from base)`
	);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  All tests completed.');
console.log('═══════════════════════════════════════════════════════════');
