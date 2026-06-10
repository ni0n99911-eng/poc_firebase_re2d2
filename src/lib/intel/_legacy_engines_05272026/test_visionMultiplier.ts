/**
 * Quick test script for Coffee Vision Multiplier
 *
 * Tests the vision multiplier logic across all tiers with various
 * raw composite scores to show the full impact range.
 *
 * Run: npx tsx src/lib/intel/engines/test_visionMultiplier.ts
 */

// ── Inline the logic (same as the module, no $lib alias needed) ──

type VisionTier = 'commodity' | 'standard' | 'differentiated' | 'highly_differentiated';

const VISION_MULTIPLIERS: Record<VisionTier, number> = {
	commodity: 0.60,
	standard: 0.85,
	differentiated: 1.00,
	highly_differentiated: 1.12,
};

const TIER_LABELS: Record<VisionTier, string> = {
	commodity: 'Commodity ($3–$4.50)',
	standard: 'Standard ($4.50–$6.50)',
	differentiated: 'Differentiated ($6.50–$8.50)',
	highly_differentiated: 'Highly Diff. ($8.50+)',
};

function scoreToGrade(score: number): string {
	if (score >= 93) return 'A+';
	if (score >= 87) return 'A';
	if (score >= 80) return 'A-';
	if (score >= 73) return 'B+';
	if (score >= 67) return 'B';
	if (score >= 60) return 'B-';
	if (score >= 53) return 'C+';
	if (score >= 47) return 'C';
	if (score >= 40) return 'C-';
	if (score >= 30) return 'D';
	return 'F';
}

function applyVision(rawComposite: number, tier: VisionTier): { iq: number; grade: string } {
	const mult = VISION_MULTIPLIERS[tier];
	const product = rawComposite * mult;
	const iq = isNaN(product) ? 50 : Math.round(Math.max(5, Math.min(98, product)));
	return { iq, grade: scoreToGrade(iq) };
}

const TIERS: VisionTier[] = ['commodity', 'standard', 'differentiated', 'highly_differentiated'];

// ── Tests ──

console.log('═══════════════════════════════════════════════════════════');
console.log('  Coffee Vision Multiplier — Test Results');
console.log('═══════════════════════════════════════════════════════════\n');

// Test 1: Multiplier Table
console.log('─── Test 1: Vision Multiplier Table ───\n');
console.log('  Tier'.padEnd(32) + 'Multiplier'.padEnd(14) + 'Spread vs Differentiated');
console.log('  ' + '─'.repeat(65));
for (const tier of TIERS) {
	const mult = VISION_MULTIPLIERS[tier];
	const spread = Math.round((mult / VISION_MULTIPLIERS['differentiated'] - 1) * 100);
	console.log(
		`  ${TIER_LABELS[tier].padEnd(30)}${mult.toFixed(2).padEnd(14)}${spread >= 0 ? '+' : ''}${spread}%`
	);
}

// Test 2: Full Matrix — Raw Composite × Vision Tier
console.log('\n─── Test 2: Location IQ Matrix (Raw Composite × Vision Tier) ───\n');

const rawScores = [95, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 30, 20];

// Header
let header = '  Raw'.padEnd(8);
for (const tier of TIERS) {
	const shortLabel = tier === 'commodity' ? 'Commodity' :
		tier === 'standard' ? 'Standard' :
		tier === 'differentiated' ? 'Diff.' : 'HighDiff';
	header += `${shortLabel} (×${VISION_MULTIPLIERS[tier]})`.padEnd(18);
}
console.log(header);
console.log('  ' + '─'.repeat(76));

for (const raw of rawScores) {
	let line = `  ${String(raw).padEnd(6)}`;
	for (const tier of TIERS) {
		const { iq, grade } = applyVision(raw, tier);
		line += `${iq} ${grade}`.padEnd(18);
	}
	console.log(line);
}

// Test 3: Same Location, Different Concepts
console.log('\n─── Test 3: Same Location, Different Concepts ───\n');

const locationScenarios = [
	{ name: 'Times Square (prime)', raw: 82 },
	{ name: 'Williamsburg Ave (good)', raw: 65 },
	{ name: 'Residential side st (weak)', raw: 45 },
];

for (const loc of locationScenarios) {
	console.log(`  📍 ${loc.name} — raw composite: ${loc.raw}\n`);
	for (const tier of TIERS) {
		const { iq, grade } = applyVision(loc.raw, tier);
		const diff = iq - loc.raw;
		const bar = '█'.repeat(Math.max(1, Math.round(iq / 3)));
		console.log(
			`     ${TIER_LABELS[tier].padEnd(30)} → ${String(iq).padEnd(4)} ${grade.padEnd(4)} (${diff >= 0 ? '+' : ''}${diff})  ${bar}`
		);
	}
	console.log();
}

// Test 4: Grade Boundary Analysis
console.log('─── Test 4: Grade Boundary Impact ───\n');
console.log('  Which raw composite is needed to hit each grade, by tier:\n');

const gradeTargets = [
	{ grade: 'A-', min: 80 },
	{ grade: 'B+', min: 73 },
	{ grade: 'B',  min: 67 },
	{ grade: 'B-', min: 60 },
	{ grade: 'C+', min: 53 },
	{ grade: 'C',  min: 47 },
];

let gradeHeader = '  Grade'.padEnd(10);
for (const tier of TIERS) {
	const shortLabel = tier === 'commodity' ? 'Commodity' :
		tier === 'standard' ? 'Standard' :
		tier === 'differentiated' ? 'Diff.' : 'HighDiff';
	gradeHeader += shortLabel.padEnd(14);
}
console.log(gradeHeader);
console.log('  ' + '─'.repeat(62));

for (const target of gradeTargets) {
	let line = `  ${target.grade.padEnd(8)}`;
	for (const tier of TIERS) {
		const mult = VISION_MULTIPLIERS[tier];
		const rawNeeded = Math.ceil(target.min / mult);
		const reachable = rawNeeded <= 100;
		line += `${reachable ? String(rawNeeded) : '---'}`.padEnd(14);
	}
	console.log(line);
}

// Test 5: Edge Cases
console.log('\n─── Test 5: Edge Cases ───\n');
const edgeCases = [
	{ name: 'Perfect score (100)', raw: 100, tier: 'highly_differentiated' as VisionTier },
	{ name: 'Near-zero (5)', raw: 5, tier: 'commodity' as VisionTier },
	{ name: 'NaN input', raw: NaN, tier: 'standard' as VisionTier },
	{ name: 'Zero composite', raw: 0, tier: 'differentiated' as VisionTier },
	{ name: 'Ceiling test (98 max)', raw: 100, tier: 'differentiated' as VisionTier },
];

for (const e of edgeCases) {
	const { iq, grade } = applyVision(e.raw, e.tier);
	console.log(`  ${e.name.padEnd(30)} → IQ: ${iq}, Grade: ${grade}`);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  All vision multiplier tests completed.');
console.log('═══════════════════════════════════════════════════════════');
