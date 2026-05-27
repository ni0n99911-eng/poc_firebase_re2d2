#!/usr/bin/env node
/**
 * Wave 1 smoke tests — post-deploy verification.
 *
 * Covers the three acceptance checks from
 * .auto-memory/project_wave1_smoke_tests.md:
 *
 *   Test 1: BR-N /api/health surfaces schools cache with ttlHours === 168
 *   Test 2: BR-L Location IQ bit-identity across repeat calls
 *   Test 3: BR-M BC rev_per_sf_floor FLAG (imports a TS module, requires tsx)
 *
 * Run from repo root:
 *
 *   # Tests 1+2 (pure fetch, works in plain Node >=20)
 *   CLERK_JWT=eyJ... BASE_URL=https://resquared.io \
 *     node scripts/wave1-smoke.mjs
 *
 *   # Test 3 (static rule call, requires tsx for TS import)
 *   npx tsx scripts/wave1-smoke.mjs --test3-only
 *
 * Exit codes:
 *   0 — all requested tests pass
 *   1 — any test failed (details printed before exit)
 *   2 — setup/config error (missing env vars, bad URL)
 */

const args = new Set(process.argv.slice(2));
const TEST3_ONLY = args.has('--test3-only');
const BASE_URL = (process.env.BASE_URL || 'https://resquared.io').replace(/\/$/, '');
const JWT = process.env.CLERK_JWT || '';

let hardFail = false;
const results = [];

function log(label, status, detail) {
	const mark = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '·';
	results.push({ label, status, detail });
	console.log(`  ${mark} ${label} — ${status}${detail ? ': ' + detail : ''}`);
	if (status === 'FAIL') hardFail = true;
}

function requireEnvForApi() {
	if (!JWT) {
		console.error('[wave1-smoke] FATAL — CLERK_JWT env var is required for Tests 1/2.');
		console.error('  Sign in to resquared.io, open DevTools → Application → Cookies,');
		console.error('  copy the __session (or Clerk JWT) value, and re-run with:');
		console.error('    CLERK_JWT=<value> node scripts/wave1-smoke.mjs');
		process.exit(2);
	}
}

async function authedFetch(path, init = {}) {
	const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
	const headers = {
		'Accept': 'application/json',
		'Authorization': `Bearer ${JWT}`,
		...(init.headers || {}),
	};
	const res = await fetch(url, { ...init, headers });
	const body = await res.text();
	let json;
	try { json = JSON.parse(body); } catch { json = null; }
	return { ok: res.ok, status: res.status, body, json };
}

// ── Test 1 ───────────────────────────────────────────────────────────────────
async function test1_healthSchoolsTtl() {
	console.log('\n[Test 1] BR-N — /api/health caches.schools.ttlHours === 168');
	const r = await authedFetch('/api/health');
	if (!r.ok) {
		log('health endpoint reachable', 'FAIL', `HTTP ${r.status}`);
		return;
	}
	log('health endpoint reachable', 'PASS', `HTTP ${r.status}`);

	const caches = r.json?.caches;
	if (!caches || typeof caches !== 'object') {
		log('caches object present', 'FAIL', 'missing or not an object');
		return;
	}
	log('caches object present', 'PASS');

	const schools = caches.schools;
	if (!schools || typeof schools !== 'object') {
		log('caches.schools present', 'FAIL', 'missing — BR-N regression');
		return;
	}
	log('caches.schools present', 'PASS');

	if (schools.ttlHours === 168) {
		log('ttlHours === 168', 'PASS');
	} else {
		log('ttlHours === 168', 'FAIL', `got ${JSON.stringify(schools.ttlHours)} — TTL.SCHOOLS misconfigured`);
	}

	const req = ['entries', 'hits', 'misses', 'hitRate'];
	for (const k of req) {
		if (typeof schools[k] === 'number') {
			log(`caches.schools.${k} is number`, 'PASS', String(schools[k]));
		} else {
			log(`caches.schools.${k} is number`, 'FAIL', `got ${typeof schools[k]}`);
		}
	}
}

// ── Test 2 ───────────────────────────────────────────────────────────────────
const BIT_IDENTITY_TARGETS = [
	// Coffee shop block — standard control case
	{ label: '273 5th Ave coffee', lat: 40.7411, lng: -73.9883, type: 'cafe' },
	// Retail block — will exercise Rule 3 rev-per-SF floor if benchmarks are low
	{ label: 'SoHo retail',        lat: 40.7230, lng: -74.0020, type: 'retail_general' },
	// Fitness block — exercises Rule 17 school proximity + Rule 2 rent
	{ label: 'UWS fitness',        lat: 40.7850, lng: -73.9750, type: 'fitness_studio' },
];

async function fetchLocationIQ(target) {
	const qs = new URLSearchParams({
		lat: String(target.lat),
		lng: String(target.lng),
		type: target.type,
	});
	const r = await authedFetch(`/api/location-iq?${qs}`);
	return r;
}

function extractBitIdentityFields(json) {
	if (!json) return null;
	// sixIndex + iq are the authoritative score bundles
	const six = json.sixIndex || {};
	const iq = {
		niq: json.niq ?? null,
		siq: json.siq ?? null,
		tiq: json.tiq ?? null,
		liq: json.liq ?? null,
		locationIQ: six.locationIQ ?? json.iq ?? null,
	};
	return iq;
}

async function test2_locationIqBitIdentity() {
	console.log('\n[Test 2] BR-L — Location IQ bit-identity across repeat calls');
	for (const target of BIT_IDENTITY_TARGETS) {
		const r1 = await fetchLocationIQ(target);
		if (!r1.ok) {
			log(`${target.label} first call`, 'FAIL', `HTTP ${r1.status}`);
			continue;
		}
		const r2 = await fetchLocationIQ(target);
		if (!r2.ok) {
			log(`${target.label} second call`, 'FAIL', `HTTP ${r2.status}`);
			continue;
		}
		const a = extractBitIdentityFields(r1.json);
		const b = extractBitIdentityFields(r2.json);
		if (!a || !b) {
			log(`${target.label} payload shape`, 'FAIL', 'missing iq fields');
			continue;
		}
		const keys = ['niq', 'siq', 'tiq', 'liq', 'locationIQ'];
		const mismatches = keys.filter(k => Number(a[k]) !== Number(b[k]));
		if (mismatches.length === 0) {
			log(`${target.label} bit-identical`, 'PASS', `niq=${a.niq} siq=${a.siq} tiq=${a.tiq} liq=${a.liq} LIQ=${a.locationIQ}`);
		} else {
			log(
				`${target.label} bit-identical`,
				'FAIL',
				mismatches.map(k => `${k}:${a[k]}→${b[k]}`).join(' '),
			);
		}
	}
}

// ── Test 3 ───────────────────────────────────────────────────────────────────
// This one needs to import the TypeScript vital-rules module directly. Only
// works when run under tsx (`npx tsx scripts/wave1-smoke.mjs --test3-only`)
// because plain Node can't resolve .ts files. Runs in isolation — does not
// hit any API.
async function test3_rule3Floor() {
	console.log('\n[Test 3] BR-M — rule3RevPerSFFloor FLAG surfaces on failing concepts');
	let rule3RevPerSFFloor;
	try {
		// Intentional dynamic import so pure-Node runs of Tests 1+2 don't crash
		const mod = await import('../src/lib/intel/vital-rules.ts');
		rule3RevPerSFFloor = mod.rule3RevPerSFFloor;
	} catch (e) {
		log(
			'vital-rules TS import',
			'SKIP',
			'run with `npx tsx scripts/wave1-smoke.mjs --test3-only` to enable',
		);
		return;
	}

	if (typeof rule3RevPerSFFloor !== 'function') {
		log('rule3RevPerSFFloor export', 'FAIL', 'not a function');
		return;
	}
	log('rule3RevPerSFFloor export', 'PASS');

	// Concepts that should trip the floor per the memory spec
	const candidates = ['retail_general', 'salon_barber', 'fitness_studio'];
	let anyFired = false;
	for (const concept of candidates) {
		try {
			const result = rule3RevPerSFFloor({ businessType: concept, concept });
			if (result && result.fail === true) {
				anyFired = true;
				log(`${concept} trips floor`, 'PASS', result.message || '(no message)');
			} else {
				log(`${concept} trips floor`, '·', 'did not trip (benchmark may be above floor)');
			}
		} catch (e) {
			log(`${concept} trips floor`, 'FAIL', String(e?.message || e));
		}
	}

	if (!anyFired) {
		log(
			'rev_per_sf_floor FLAG fires on at least one concept',
			'FAIL',
			'none of the 3 candidate concepts tripped the floor — check REV_PER_SF_FLOORS table',
		);
	} else {
		log('rev_per_sf_floor FLAG fires on at least one concept', 'PASS');
	}
}

// ── Runner ───────────────────────────────────────────────────────────────────
(async () => {
	console.log(`[wave1-smoke] BASE_URL=${BASE_URL}`);
	if (!TEST3_ONLY) {
		requireEnvForApi();
		await test1_healthSchoolsTtl();
		await test2_locationIqBitIdentity();
	}
	await test3_rule3Floor();

	console.log('\n── Summary ──────────────────────────────');
	const pass = results.filter(r => r.status === 'PASS').length;
	const fail = results.filter(r => r.status === 'FAIL').length;
	const skip = results.filter(r => r.status !== 'PASS' && r.status !== 'FAIL').length;
	console.log(`  PASS: ${pass}   FAIL: ${fail}   SKIP/INFO: ${skip}`);

	if (hardFail) {
		console.error('[wave1-smoke] At least one test FAILED. See details above.');
		process.exit(1);
	}
	console.log('[wave1-smoke] All requested tests passed.');
	process.exit(0);
})().catch((err) => {
	console.error('[wave1-smoke] Runner crashed:', err);
	process.exit(1);
});
