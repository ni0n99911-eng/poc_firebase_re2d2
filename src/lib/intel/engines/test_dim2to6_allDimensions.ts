/**
 * Quick test script for Coffee Dimensions 2–6
 *
 * Tests all dimension logic with mock data — no SvelteKit imports needed.
 * Run: npx tsx src/lib/intel/engines/test_dim2to6_allDimensions.ts
 */

// ── Inline helpers (same as geo-math.ts) ──

function clamp(v: number, min = 0, max = 100): number {
	return Math.max(min, Math.min(max, isNaN(v) ? min : v));
}

function scoreLinear(value: number, low: number, high: number): number {
	if (high === low) return 50;
	const normalized = Math.max(0, Math.min(1, (value - low) / (high - low)));
	return Math.round(normalized * 100);
}

// ══════════════════════════════════════════════════════
// DIM 2: Daily Ritual Density
// ══════════════════════════════════════════════════════

function testDailyRitualDensity() {
	console.log('═══════════════════════════════════════════════════════════');
	console.log('  Dim 2: Daily Ritual Density (rdScore) — 25% weight');
	console.log('═══════════════════════════════════════════════════════════\n');

	// Score formula from segment-intel.ts:
	// pop <= 500:      score = (pop/500) * 40
	// 500 < pop <= 1500: score = 40 + ((pop-500)/1000) * 30
	// pop > 1500:       score = 70 + ((pop-1500)/3000) * 30
	function ritualScore(pop: number): number {
		return clamp(Math.round(
			pop <= 500 ? (pop / 500) * 40
			: pop <= 1500 ? 40 + ((pop - 500) / 1000) * 30
			: 70 + ((pop - 1500) / 3000) * 30
		), 0, 100);
	}

	const CONV_STANDARD = { office: 0.60, gym: 0.35, college: 0.45, cowork: 0.80 };
	const CONV_PREMIUM  = { office: 0.28, gym: 0.55, college: 0.12, cowork: 0.80 };

	console.log('─── Scoring Curve ───\n');
	console.log('  Daily Pop'.padEnd(14) + 'Score'.padEnd(8) + 'Tier');
	console.log('  ' + '─'.repeat(55));
	for (const pop of [50, 200, 500, 800, 1000, 1500, 2000, 3000, 5000]) {
		const s = ritualScore(pop);
		const tier = s >= 80 ? 'Very High' : s >= 60 ? 'Strong' : s >= 40 ? 'Moderate' : 'Low';
		console.log(`  ${pop.toLocaleString().padEnd(12)}${String(s).padEnd(8)}${tier}`);
	}

	console.log('\n─── Conversion Rate Impact (Standard vs Premium) ───\n');
	console.log('  ' + 'Anchor'.padEnd(15) + 'Standard'.padEnd(12) + 'Premium'.padEnd(12) + 'Std Pop'.padEnd(10) + 'Prem Pop');
	console.log('  ' + '─'.repeat(55));
	const anchors = [
		{ name: 'Office (50)', std: CONV_STANDARD.office, prem: CONV_PREMIUM.office, base: 50 },
		{ name: 'Gym (200)', std: CONV_STANDARD.gym, prem: CONV_PREMIUM.gym, base: 200 },
		{ name: 'College (500)', std: CONV_STANDARD.college, prem: CONV_PREMIUM.college, base: 500 },
		{ name: 'Cowork (100)', std: CONV_STANDARD.cowork, prem: CONV_PREMIUM.cowork, base: 100 },
	];
	for (const a of anchors) {
		console.log(`  ${a.name.padEnd(15)}${(a.std * 100 + '%').padEnd(12)}${(a.prem * 100 + '%').padEnd(12)}${Math.round(a.base * a.std).toString().padEnd(10)}${Math.round(a.base * a.prem)}`);
	}

	// Scenario tests
	console.log('\n─── Scenario Tests ───\n');
	const scenarios = [
		{ name: 'Midtown office district', pop: 4200, ticket: 5.00 },
		{ name: 'Williamsburg mixed-use', pop: 1800, ticket: 7.50 },
		{ name: 'Residential Brooklyn', pop: 600, ticket: 5.00 },
		{ name: 'Industrial area', pop: 150, ticket: 5.00 },
	];
	for (const s of scenarios) {
		const score = ritualScore(s.pop);
		console.log(`  📍 ${s.name} (${s.pop.toLocaleString()} daily pop, $${s.ticket} ticket)`);
		console.log(`     Score: ${score}/100 — ${score >= 80 ? 'Very High' : score >= 60 ? 'Strong' : score >= 40 ? 'Moderate' : 'Low'}`);
		console.log(`     Signal: ${score < 40 ? '⚠️  Thin ritual anchors' : '✅  Adequate ritual density'}\n`);
	}
}

// ══════════════════════════════════════════════════════
// DIM 3: Competition Context
// ══════════════════════════════════════════════════════

function testCompetitionContext() {
	console.log('═══════════════════════════════════════════════════════════');
	console.log('  Dim 3: Competition Context (ccScore) — 15% weight');
	console.log('═══════════════════════════════════════════════════════════\n');

	const SENTIMENT_ADJ: Record<string, number> = {
		great: +15, good: +5, caution: -5, warning: -15
	};

	console.log('─── Sentiment Adjustment Table ───\n');
	console.log('  Sentiment'.padEnd(14) + 'Adj'.padEnd(8) + 'Meaning');
	console.log('  ' + '─'.repeat(60));
	console.log('  great       +15     Chain-heavy or underserved — big opportunity');
	console.log('  good        +5      Moderate gap — room for quality');
	console.log('  caution     -5      Competitive — need differentiation');
	console.log('  warning     -15     Saturated with quality — significant headwind');

	console.log('\n─── Scenario Tests ───\n');
	const scenarios = [
		{ name: 'Chain-heavy (Dunkin area)', baseComp: 65, sentiment: 'great' as const },
		{ name: 'Moderate competition', baseComp: 55, sentiment: 'good' as const },
		{ name: 'Saturated specialty district', baseComp: 40, sentiment: 'warning' as const },
		{ name: 'Zero competitors', baseComp: 40, sentiment: 'great' as const },
		{ name: '3 quality competitors', baseComp: 85, sentiment: 'caution' as const },
		{ name: '12+ competitors, rated 4.5+', baseComp: 25, sentiment: 'warning' as const },
	];

	for (const s of scenarios) {
		const adj = SENTIMENT_ADJ[s.sentiment];
		const finalScore = Math.max(0, Math.min(100, s.baseComp + adj));
		console.log(`  📍 ${s.name}`);
		console.log(`     Base: ${s.baseComp} → Sentiment: ${s.sentiment} (${adj >= 0 ? '+' : ''}${adj}) → Final: ${finalScore}`);
		console.log();
	}
}

// ══════════════════════════════════════════════════════
// DIM 4: Street-Side
// ══════════════════════════════════════════════════════

function testStreetSide() {
	console.log('═══════════════════════════════════════════════════════════');
	console.log('  Dim 4: Street-Side (ssScore) — 10% weight');
	console.log('═══════════════════════════════════════════════════════════\n');

	const DEFAULT = 50;
	const WARNING_THRESHOLD = 35;

	console.log('─── Scenario Tests ───\n');
	const scenarios = [
		{ name: 'Corner spot, wide sidewalk', ssScore: 82, hasData: true },
		{ name: 'Mid-block, good visibility', ssScore: 65, hasData: true },
		{ name: 'Scaffolding in front', ssScore: 28, hasData: true },
		{ name: 'No street-side data', ssScore: null, hasData: false },
		{ name: 'Narrow side street', ssScore: 42, hasData: true },
	];

	for (const s of scenarios) {
		const score = s.ssScore ?? DEFAULT;
		const warning = s.hasData && score < WARNING_THRESHOLD;
		console.log(`  📍 ${s.name}`);
		console.log(`     Score: ${score}/100 ${!s.hasData ? '(default — no data)' : ''}`);
		console.log(`     Signal: ${warning ? '⚠️  Poor street-side conditions' : '✅  Acceptable'}\n`);
	}
}

// ══════════════════════════════════════════════════════
// DIM 5: Demographics Fit
// ══════════════════════════════════════════════════════

function testDemographicsFit() {
	console.log('═══════════════════════════════════════════════════════════');
	console.log('  Dim 5: Demographics Fit (dfScore) — 10% weight');
	console.log('═══════════════════════════════════════════════════════════\n');

	console.log('─── Premium Income Scale ($50K–$200K → 0–100) ───\n');
	console.log('  Median Income'.padEnd(18) + 'Premium Score'.padEnd(16) + 'Assessment');
	console.log('  ' + '─'.repeat(55));
	for (const income of [35000, 50000, 75000, 100000, 125000, 150000, 200000, 250000]) {
		const premScore = scoreLinear(income, 50000, 200000);
		const assessment = premScore >= 70 ? 'Supports premium' : premScore >= 40 ? 'Possible' : 'Risky for premium';
		console.log(`  $${(income/1000).toFixed(0)}K`.padEnd(18) + `${premScore}`.padEnd(16) + assessment);
	}

	console.log('\n─── Scenario Tests (standard vs premium ticket) ───\n');
	const scenarios = [
		{ name: 'UES Manhattan', baseDemScore: 78, income: 145000 },
		{ name: 'Williamsburg', baseDemScore: 72, income: 95000 },
		{ name: 'East New York', baseDemScore: 35, income: 42000 },
		{ name: 'Midtown (high density, high income)', baseDemScore: 82, income: 180000 },
	];

	for (const s of scenarios) {
		const standardScore = s.baseDemScore;
		const premiumIncomeScore = scoreLinear(s.income, 50000, 200000);
		const premiumScore = Math.round(s.baseDemScore * 0.65 + premiumIncomeScore * 0.35);

		console.log(`  📍 ${s.name} ($${(s.income/1000).toFixed(0)}K median income)`);
		console.log(`     Standard ($5 ticket): ${standardScore}/100 (base demographics, unchanged)`);
		console.log(`     Premium ($9 ticket):  ${premiumScore}/100 (65% base + 35% income[${premiumIncomeScore}])`);
		console.log(`     Δ Premium shift: ${premiumScore - standardScore >= 0 ? '+' : ''}${premiumScore - standardScore} points\n`);
	}
}

// ══════════════════════════════════════════════════════
// DIM 6: Base Viability
// ══════════════════════════════════════════════════════

function testBaseViability() {
	console.log('═══════════════════════════════════════════════════════════');
	console.log('  Dim 6: Base Viability (bvScore) — 10% weight');
	console.log('═══════════════════════════════════════════════════════════\n');

	console.log('─── Formula: survivalRate × 0.50 + neighborhoodHealth × 0.50 ───\n');

	console.log('  Survival'.padEnd(12) + 'Nbhd Health'.padEnd(14) + 'bvScore'.padEnd(10) + 'Signals');
	console.log('  ' + '─'.repeat(55));
	const scenarios = [
		{ sr: 75, nh: 80, name: 'Thriving area' },
		{ sr: 60, nh: 65, name: 'Solid neighborhood' },
		{ sr: 52, nh: 60, name: 'Average (defaults)' },
		{ sr: 45, nh: 50, name: 'Below average' },
		{ sr: 30, nh: 35, name: 'Struggling area' },
		{ sr: 20, nh: 25, name: 'High-risk area' },
	];

	for (const s of scenarios) {
		const bvScore = Math.round(s.sr * 0.5 + s.nh * 0.5);
		const warnings: string[] = [];
		if (s.sr < 40) warnings.push('⚠️ Low survival');
		if (s.nh < 40) warnings.push('⚠️ Weak health');
		console.log(`  ${String(s.sr).padEnd(12)}${String(s.nh).padEnd(14)}${String(bvScore).padEnd(10)}${warnings.join(', ') || '✅ OK'}`);
	}

	console.log('\n─── Default Handling ───\n');
	console.log('  When no precomputed data available:');
	console.log('    survivalRate = 52 (default)');
	console.log('    neighborhoodHealth = 60 (default)');
	console.log(`    bvScore = ${Math.round(52 * 0.5 + 60 * 0.5)} (neutral — doesn't help or hurt)\n`);
}

// ══════════════════════════════════════════════════════
// COMPOSITE IMPACT
// ══════════════════════════════════════════════════════

function testCompositeImpact() {
	console.log('═══════════════════════════════════════════════════════════');
	console.log('  Full Composite: All 6 Dimensions → Location IQ');
	console.log('═══════════════════════════════════════════════════════════\n');

	interface Scenario {
		name: string;
		ft: number; rd: number; cc: number; ss: number; df: number; bv: number;
		vision: string; mult: number;
	}

	const scenarios: Scenario[] = [
		{ name: 'Times Sq — differentiated', ft: 95, rd: 85, cc: 70, ss: 55, df: 75, bv: 65, vision: 'differentiated', mult: 1.00 },
		{ name: 'Times Sq — commodity',      ft: 95, rd: 85, cc: 70, ss: 55, df: 75, bv: 65, vision: 'commodity', mult: 0.60 },
		{ name: 'Williamsburg — standard',    ft: 52, rd: 60, cc: 65, ss: 65, df: 72, bv: 60, vision: 'standard', mult: 0.85 },
		{ name: 'Residential — differentiated',ft: 30, rd: 40, cc: 80, ss: 50, df: 68, bv: 55, vision: 'differentiated', mult: 1.00 },
		{ name: 'Industrial — commodity',     ft: 12, rd: 20, cc: 40, ss: 35, df: 35, bv: 38, vision: 'commodity', mult: 0.60 },
	];

	const weights = { ft: 0.30, rd: 0.25, cc: 0.15, ss: 0.10, df: 0.10, bv: 0.10 };

	for (const s of scenarios) {
		const raw = s.ft * weights.ft + s.rd * weights.rd + s.cc * weights.cc +
			s.ss * weights.ss + s.df * weights.df + s.bv * weights.bv;
		const final = Math.round(Math.max(5, Math.min(98, raw * s.mult)));
		const grade = final >= 93 ? 'A+' : final >= 87 ? 'A' : final >= 80 ? 'A-'
			: final >= 73 ? 'B+' : final >= 67 ? 'B' : final >= 60 ? 'B-'
			: final >= 53 ? 'C+' : final >= 47 ? 'C' : final >= 40 ? 'C-'
			: final >= 30 ? 'D' : 'F';

		console.log(`  📍 ${s.name}`);
		console.log(`     FT:${s.ft} RD:${s.rd} CC:${s.cc} SS:${s.ss} DF:${s.df} BV:${s.bv}`);
		console.log(`     Raw composite: ${raw.toFixed(1)} × ${s.mult} (${s.vision}) = ${final} → Grade ${grade}\n`);
	}
}

// ── Run all tests ──

testDailyRitualDensity();
testCompetitionContext();
testStreetSide();
testDemographicsFit();
testBaseViability();
testCompositeImpact();

console.log('═══════════════════════════════════════════════════════════');
console.log('  All dimension tests completed.');
console.log('═══════════════════════════════════════════════════════════');
