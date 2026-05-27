<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import NavigationDrawer from '$lib/components/NavigationDrawer.svelte';
	import { getDecisionState, blockTierLabel, fitTierLabel, fitGrade, fitGradeCapped, fitMeaningShort } from '$lib/utils/decision-engine';
	import { tierFor } from '$lib/intel/tiers';
	import ScoreMetaLine from '$lib/components/ScoreMetaLine.svelte';
	import { formatConcept } from '$lib/utils/conceptNames';
	import { getDashboardHeadline, getTodaysInsight, type DashboardHeadline, type TodaysInsight } from '$lib/intel/dashboard-brain';
	import { authedFetch } from '$lib/authed-fetch';
	import { getVerdict, computeKillFactors, computeFounderMod, type SixScores, type LaunchpadData } from '$lib/scoring-utils.svelte';
	import { computeSteadyStateRevenue, RAMP_FACTORS, CONCEPT_KPIS } from '$lib/constants/conceptKPIs';

	/**
	 * 04.22.2026 Deprecating: recanonicalizeScores — client-side Fit IQ recalculation.
	 *
	 * This function used a rogue formula (locationIQ * 0.75 + visionAdj + founderMod)
	 * to re-derive fitIQ on the client, causing data drift between the Dashboard and
	 * the Location page (which uses the canonical server-computed Fit IQ from
	 * computeCanonicalFitIQ in $lib/intel/scoring/bundle-builder.ts).
	 *
	 * The canonical Fit IQ formula is: Math.round(locationIQ * 0.60 + visionIQ * 0.40)
	 * and lives ONLY in bundle-builder.ts. The Dashboard must never override it.
	 *
	 * Replacement: readStoredFitScores() — trusts the server-persisted fitScore.
	 * If fitScore is missing (legacy data), falls back to locationIQ score unchanged
	 * until the user triggers a re-score which will populate the canonical fitScore.
	 */
	/* 04.22.2026 Deprecated: recanonicalizeScores — rogue 0.75x formula
	function recanonicalizeScores(locations: any[], launchpad: LaunchpadData): any[] {
		return locations.map(loc => {
			if (!loc.sixScores) return loc;
			const six: SixScores = loc.sixScores;
			const founderMod = computeFounderMod(six, launchpad);
			const locationIQ = loc.score ?? 0;
			const visionIQ = loc.visionScore ?? 50;
			const base = loc._rawFitBase ?? Math.round(locationIQ * 0.75);
			const visionAdj = visionIQ > 0 ? Math.round((visionIQ - 50) * 0.20) : -8;
			const fitIQ = Math.max(0, Math.min(100, Math.round(base + visionAdj + founderMod)));
			return { ...loc, fitScore: fitIQ };
		});
	}
	*/

	/**
	 * readStoredFitScores — reads the server-persisted fitScore without modification.
	 *
	 * If a location has a fitScore from the server (set by buildLocationScoreBundle
	 * via api/location-iq or api/re-score), it is used as-is.
	 * If fitScore is missing (legacy scored-before-04.22.2026 data), fitScore
	 * stays 0 and the UI shows "—" with a "Re-score" badge. We do NOT silently
	 * substitute locationIQ as Fit — that would be a data integrity lie.
	 */
	function readStoredFitScores(locations: any[]): any[] {
		return locations.map(loc => {
			// If fitScore already exists from the server, trust it blindly
			if (loc.fitScore != null && loc.fitScore > 0) return loc;
			// 04.22.2026: Strict mode — do NOT invent fitScore from locationIQ.
			// Legacy locations show fitScore=0 → UI renders "—" + "Re-score" badge.
			return { ...loc, fitScore: 0 };
		});
	}

	// ── SVG ring constants ────────────────────────────────────────────────────
	// Big ring (Your Score): r=33, circ=2*π*33≈207.3
	// Small ring (component scores): r=22, circ=2*π*22≈138.2
	const CIRC_LG = 207.3;
	const CIRC_SM = 138.2;

	function ringOffset(score: number, circ: number): number {
		return circ * (1 - Math.max(0, Math.min(100, score || 0)) / 100);
	}

	function fitRingColor(v: number): string {
		if (v >= 75) return '#15803d';
		if (v >= 55) return '#d97706';
		if (v >= 40) return '#c06a2a';
		return '#dc2626';
	}

	// FIX-025 + UX-April10: fitTierLabel, fitGrade, fitMeaningShort now imported from
	// decision-engine.ts (single source of truth for BR-1 verdict vocabulary).

	function fitTierStyle(v: number): string {
		if (v >= 75) return 'background:#dcfce7;color:#15803d';
		if (v >= 65) return 'background:#e8edf2;color:#374151';  // Fix 5: blue-gray for Viable
		if (v >= 50) return 'background:#fef3c7;color:#92400e';
		return 'background:#fee2e2;color:#991b1b';
	}

	// Use canonical blockTierLabel from decision-engine (BR-5 spec)
	// locTierLabel kept as alias for existing template references
	function locTierLabel(v: number): string { return blockTierLabel(v) || 'Developing'; }

	// BL-B1: replaced local ternary with canonical tierFor('visionIQ') — was Well-Defined/Clear/Developing/Unclear
	function visTierLabel(v: number): string {
		return v > 0 ? tierFor(v, 'visionIQ').label : '—';
	}

	function verdictPillClass(v: number): string {
		if (v >= 75) return 'pill-green';
		if (v >= 65) return 'pill-viable';  // Fix 5: calmer blue-gray, not amber warning
		if (v >= 50) return 'pill-amber';
		return 'pill-red';
	}

	function verdictEmoji(v: number): string {
		if (v >= 65) return '✅';  // Fix 5: Viable is positive, not a warning
		if (v >= 50) return '⚠️';
		return '❌';
	}

	// R5-3: Use tier labels instead of hardcoded fake percentiles.
	// fitTierLabel() is already imported from decision-engine.
	function fitBenchmark(v: number): string {
		return fitTierLabel(v);
	}

	// ── Time / address helpers ────────────────────────────────────────────────
	function timeAgo(ts: number | string): string {
		if (!ts) return '—';
		// scoredAt is stored as a numeric string (epoch ms) — must parse via Number() first.
		// new Date("1775244895448") → NaN; Number("1775244895448") → valid epoch.
		const t = typeof ts === 'number' ? ts : (isFinite(Number(ts)) ? Number(ts) : new Date(ts).getTime());
		if (!t || isNaN(t)) return '—';
		const diff = Date.now() - t;
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return hrs === 1 ? '1h ago' : `${hrs}h ago`;
		const days = Math.floor(hrs / 24);
		return days === 1 ? 'Yesterday' : `${days} days ago`;
	}

	function shortAddr(addr: string): string {
		return (addr || '').split(',')[0];
	}

	function fmtMoney(n: number): string {
		if (n === null || n === undefined || (n === 0 && !n)) return '—';
		const abs = Math.abs(n);
		let str: string;
		if (abs >= 1_000_000) str = `$${(abs / 1_000_000).toFixed(1)}M`;
		else if (abs >= 1_000) str = `$${Math.round(abs / 1_000)}K`;
		else str = `$${abs}`;
		return n < 0 ? `(${str})` : str;
	}

	function greeting(): string {
		const h = new Date().getHours();
		if (h < 12) return 'Good morning';
		if (h < 17) return 'Good afternoon';
		return 'Good evening';
	}

	// ── Document tag config ───────────────────────────────────────────────────
	type DocTag = 'marketing' | 'legal' | 'financial' | 'property';
	interface DocEntry { name: string; url: string; tag: DocTag; uploadedAt: string; }

	const DOC_TAGS: { key: DocTag; label: string; icon: string; style: string }[] = [
		{ key: 'marketing', label: 'Marketing', icon: '📄', style: 'background:#dbeafe;color:#1d4ed8;border-color:#93c5fd' },
		{ key: 'legal',     label: 'Legal',     icon: '📋', style: 'background:#ede9fe;color:#6d28d9;border-color:#c4b5fd' },
		{ key: 'financial', label: 'Financial', icon: '💰', style: 'background:#dcfce7;color:#15803d;border-color:#86efac' },
		{ key: 'property',  label: 'Property',  icon: '🏢', style: 'background:#fef3c7;color:#92400e;border-color:#fcd34d' },
	];

	function docTagStyle(tag: DocTag): string {
		return DOC_TAGS.find(t => t.key === tag)?.style ?? '';
	}
	function docTagIcon(tag: DocTag): string {
		return DOC_TAGS.find(t => t.key === tag)?.icon ?? '📄';
	}
	function docTagLabel(tag: DocTag): string {
		return DOC_TAGS.find(t => t.key === tag)?.label ?? tag;
	}

	function uniqueDocTags(docs: DocEntry[]): DocTag[] {
		if (!docs?.length) return [];
		return [...new Set(docs.map(d => d.tag))];
	}

	// ── Reactive state ────────────────────────────────────────────────────────
	let mounted      = $state(false);
	let firstName    = $state('');
	let allLocations: any[] = $state([]);

	// ── Checklist progress (for dashboard CTA) ───────────────────────────────
	let checklistDone  = $state(0);
	let checklistTotal = $state(0);

	// ── Shortlist: filter + sort ──────────────────────────────────────────────
	type FilterMode = 'all' | 'starred' | 'pinned';
	type SortMode = 'fit' | 'location' | 'date' | 'revenue';
	let filterMode = $state<FilterMode>('all');
	let sortMode   = $state<SortMode>('fit');

	// ── Helpers: localStorage write ──────────────────────────────────────────
	function _lsUpdateLoc(addr: string, patch: Record<string, unknown>) {
		try {
			const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
			const locs: any[] = lp.scoredLocations || [];
			const idx = locs.findIndex((l: any) => l.addr === addr);
			if (idx >= 0) {
				Object.assign(locs[idx], patch);
				lp.scoredLocations = locs;
				localStorage.setItem('re2_launchpad', JSON.stringify(lp));
			}
		} catch {}
	}

	function togglePin(loc: any) {
		loc.pinned = !loc.pinned;
		_lsUpdateLoc(loc.addr, { pinned: loc.pinned });
		allLocations = [...allLocations];
		// Persist to DB (optimistic — fire-and-forget)
		authedFetch('/api/deals/update-location', {
			method: 'PATCH',
			body: JSON.stringify({ addr: loc.addr, pinned: loc.pinned }),
		}).catch(() => {});
	}

	function toggleStar(loc: any) {
		loc.starred = !loc.starred;
		_lsUpdateLoc(loc.addr, { starred: loc.starred });
		allLocations = [...allLocations];
		// Persist to DB (optimistic — fire-and-forget)
		authedFetch('/api/deals/update-location', {
			method: 'PATCH',
			body: JSON.stringify({ addr: loc.addr, starred: loc.starred }),
		}).catch(() => {});
	}

	// Status label mapping (Brain spec → display label)
	const STATUS_LABELS: Record<string, string> = {
		watching:     'Exploring',
		touring:      'Touring',
		negotiating:  'In Negotiation',
		signed:       'Signed ✓',
		passed:       'Not Pursuing',
		lost:         'Lost',
	};
	const STATUS_ORDER = ['watching', 'touring', 'negotiating', 'signed', 'passed', 'lost'] as const;
	type DealStatus = typeof STATUS_ORDER[number];

	function updateStatus(loc: any, status: DealStatus) {
		loc.dealStatus = status;
		_lsUpdateLoc(loc.addr, { dealStatus: status });
		allLocations = [...allLocations];
		authedFetch('/api/deals/update-location', {
			method: 'PATCH',
			body: JSON.stringify({ addr: loc.addr, status }),
		}).catch(() => {});
	}

	// Note debounce timers keyed by addr
	const _noteTimers: Record<string, ReturnType<typeof setTimeout>> = {};
	function onNoteBlur(loc: any, note: string) {
		loc.dealNote = note;
		_lsUpdateLoc(loc.addr, { dealNote: note });
		clearTimeout(_noteTimers[loc.addr]);
		_noteTimers[loc.addr] = setTimeout(() => {
			authedFetch('/api/deals/update-location', {
				method: 'PATCH',
				body: JSON.stringify({ addr: loc.addr, note }),
			}).catch(() => {});
		}, 600);
	}

	function removeLocation(loc: any) {
		// Optimistic: remove from list immediately
		allLocations = allLocations.filter((l: any) => l.addr !== loc.addr);
		_lsUpdateLoc(loc.addr, {}); // marker — actual removal below
		try {
			const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
			lp.scoredLocations = (lp.scoredLocations || []).filter((l: any) => l.addr !== loc.addr);
			localStorage.setItem('re2_launchpad', JSON.stringify(lp));
		} catch {}
		// Persist delete to DB
		authedFetch('/api/deals/remove-location', {
			method: 'DELETE',
			body: JSON.stringify({ addr: loc.addr }),
		}).catch(() => {});
	}

	let filteredLocations: any[] = $derived.by(() => {
		// 'all' = Starred/Progressing tab → show every scored location
		// 'pinned' = Shortlisted tab → show only pinned
		// 'starred' = (legacy / direct set) → show only starred
		let locs = filterMode === 'pinned'   ? allLocations.filter((l: any) => l.pinned)
		         : filterMode === 'starred'  ? allLocations.filter((l: any) => l.starred)
		         : allLocations; // 'all' — primary view shows everything
		// Sort — use Number() for string epoch timestamps
		const toEpoch = (ts: any) => typeof ts === 'number' ? ts : (isFinite(Number(ts)) ? Number(ts) : new Date(ts || 0).getTime());
		const sorters: Record<SortMode, (a: any, b: any) => number> = {
			fit:      (a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0),
			location: (a, b) => (b.score ?? 0) - (a.score ?? 0),
			date:     (a, b) => toEpoch(b.scoredAt) - toEpoch(a.scoredAt),
			revenue:  (a, b) => (b.businessCase?.revenueY1 ?? 0) - (a.businessCase?.revenueY1 ?? 0),
		};
		const sorted = [...locs].sort(sorters[sortMode]);
		// Pinned cards always float to the top
		return sorted.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
	});

	let pinnedCount  = $derived(allLocations.filter((l: any) => l.pinned).length);
	let starredCount = $derived(allLocations.filter((l: any) => l.starred).length);

	// ── Shortlist Compare (BR-10) ─────────────────────────────────────────────
	// Verdict-led side-by-side grid for 2–3 pinned locations. Triggered by the
	// ⊞ Compare button in the filter tab row (global scope, visible whenever
	// pinnedCount >= 2 regardless of active filter tab). Renders inline above
	// the concept groups so the founder sees the comparison at the same layer
	// they pinned from, not in a modal that hides the context.
	let showCompare = $state(false);
	// Stable column order: pinned cards in the order they appear in allLocations
	// (which already floats pinned to the top), capped at 3 so the grid doesn't
	// overflow on narrow viewports. Rebuilds whenever pins change.
	let compareLocations = $derived(
		allLocations.filter((l: any) => l.pinned).slice(0, 3)
	);
	// Auto-close when the user unpins below 2 cards — "nothing to compare" is
	// a worse UX than just collapsing the panel silently.
	$effect(() => {
		if (showCompare && compareLocations.length < 2) {
			showCompare = false;
		}
	});
	// Winner logic: per metric row, highest value gets the .cmp-winner class.
	// Ties produce no winner anywhere on that row (no false precision). Vision
	// IQ of 0 is "—" in the render and excluded from winner logic for that row
	// specifically, so a partial-Vision location doesn't skew the badge.
	//
	// UX-A (April 11): panel now calls POST /api/shortlist/compare when it opens
	// so Dashboard + PDF export + email digest + CoPilot "A or B" all share one
	// source of truth. Client-side winnerCol() is retained as fallback for when
	// the endpoint is unreachable / rate-limited / still loading — the server
	// mirrors this exact logic so the visual "Best" badge stays consistent.
	function winnerColClient(metric: 'fit' | 'location' | 'vision'): number {
		const vals = compareLocations.map((loc: any) => {
			if (metric === 'fit') return Number(loc.fitScore ?? 0);
			if (metric === 'location') return Number(loc.score ?? 0);
			if (metric === 'vision') return Number(loc.visionScore ?? 0);
			return 0;
		});
		// Vision: locations reporting 0 don't count for winner at all
		const eligible = metric === 'vision'
			? vals.map((v, i) => (v > 0 ? { v, i } : null)).filter(Boolean) as Array<{ v: number; i: number }>
			: vals.map((v, i) => ({ v, i }));
		if (eligible.length === 0) return -1;
		const max = Math.max(...eligible.map(e => e.v));
		if (max <= 0) return -1;
		const topIndexes = eligible.filter(e => e.v === max).map(e => e.i);
		// Tie → no winner. Otherwise return the single winning column.
		return topIndexes.length === 1 ? topIndexes[0] : -1;
	}

	// ── UX-A: /api/shortlist/compare envelope ─────────────────────────────────
	// Stateless server compute that mirrors winnerColClient() and adds
	// cross-location narrative + kill-factor-aware overall pick. Cached per
	// (addr + fit/loc/vis + pinned-count) so unpinning/repinning refetches.
	type CompareWinner = {
		index: number | null;
		addr: string | null;
		score: number | null;
		margin: number | null;
		reason: string;
	};
	type CompareOverall = { index: number | null; addr: string | null; reasoning: string };
	type CompareEnvelope = {
		locations: Array<{
			addr: string;
			scores: { locationIQ: number; fitIQ: number; visionIQ: number };
			verdict: { tier: string; grade: string; line: string };
			killFactors: Array<{ signal: string; label: string; value: number; flag: string }>;
		}>;
		winners: {
			fit: CompareWinner;
			location: CompareWinner;
			vision: CompareWinner;
			overall: CompareOverall;
		};
		narrative: string;
	};
	let compareEnvelope = $state<CompareEnvelope | null>(null);
	let compareEnvelopeKey = $state<string>('');
	let compareEnvelopeLoading = $state(false);
	let compareEnvelopeError = $state<string | null>(null);

	function buildCompareKey(locs: any[]): string {
		return locs
			.map((l) =>
				[
					l.addr ?? '',
					Number(l.fitScore ?? 0),
					Number(l.score ?? 0),
					Number(l.visionScore ?? 0)
				].join('|')
			)
			.join('::');
	}

	async function loadCompareEnvelope(): Promise<void> {
		if (compareLocations.length < 2) return;
		const key = buildCompareKey(compareLocations);
		if (key === compareEnvelopeKey && compareEnvelope) return; // cache hit
		compareEnvelopeLoading = true;
		compareEnvelopeError = null;
		try {
			const payload = {
				locations: compareLocations.map((loc: any) => ({
					addr: loc.addr,
					locationIQ: Number(loc.score ?? 0),
					fitIQ: Number(loc.fitScore ?? 0),
					visionIQ: Number(loc.visionScore ?? 0),
					sixScores: loc.sixScores ?? {},
					scoredAt: loc.scoredAt ?? null,
					businessType: loc.businessType ?? null
				}))
			};
			const res = await fetch('/api/shortlist/compare', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				compareEnvelopeError = `HTTP ${res.status}`;
				compareEnvelope = null;
				compareEnvelopeKey = '';
				return;
			}
			compareEnvelope = (await res.json()) as CompareEnvelope;
			compareEnvelopeKey = key;
		} catch (e) {
			compareEnvelopeError = e instanceof Error ? e.message : 'fetch failed';
			compareEnvelope = null;
			compareEnvelopeKey = '';
		} finally {
			compareEnvelopeLoading = false;
		}
	}

	// Fire the server call when the panel opens, and when pinned cards change
	// while it's open. Endpoint is rate-limited at 30/min so the cache key check
	// inside loadCompareEnvelope prevents duplicate fetches.
	$effect(() => {
		if (showCompare && compareLocations.length >= 2) {
			void loadCompareEnvelope();
		} else {
			// Clear stale envelope so a re-open refetches cleanly.
			compareEnvelope = null;
			compareEnvelopeKey = '';
			compareEnvelopeError = null;
		}
	});

	// Envelope-first winner lookup with client fallback. Server mirrors client
	// logic exactly so these always agree; the fallback covers network failure
	// or the brief window before the first fetch resolves.
	function winnerCol(metric: 'fit' | 'location' | 'vision'): number {
		if (compareEnvelope?.winners) {
			const w = compareEnvelope.winners[metric];
			return w?.index ?? -1;
		}
		return winnerColClient(metric);
	}

	// Upload drawer
	let uploadDrawerOpen = $state(false);
	let uploadDrawerLoc  = $state<any>(null);
	let uploadTag        = $state<DocTag>('marketing');

	function openUploadDrawer(loc: any) {
		uploadDrawerLoc = loc;
		uploadTag = 'marketing';
		uploadDrawerOpen = true;
	}
	function closeUploadDrawer() {
		uploadDrawerOpen = false;
		uploadDrawerLoc = null;
	}

	let uploadingFiles = $state(false);

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = Array.from(input.files || []);
		if (!files.length || !uploadDrawerLoc) return;
		uploadingFiles = true;
		try {
			const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
			const locs: any[] = lp.scoredLocations || [];
			const idx = locs.findIndex((l: any) => l.addr === uploadDrawerLoc.addr);
			if (idx < 0) { uploadingFiles = false; return; }
			if (!locs[idx].documents) locs[idx].documents = [];

			for (const f of files) {
				const docEntry = {
					name: f.name,
					url: '',
					tag: uploadTag,
					uploadedAt: new Date().toISOString(),
				};
				const docIdx = locs[idx].documents.length;
				locs[idx].documents.push(docEntry);

				// T3: Upload to Supabase Storage via vault API
				try {
					const form = new FormData();
					form.append('file', f);
					form.append('property_addr', uploadDrawerLoc.addr || '');
					form.append('title', f.name);
					form.append('tags', uploadTag);
					const res = await authedFetch('/api/vault/upload', {
						method: 'POST',
						body: form,
					});
					if (res.ok) {
						const data = await res.json();
						// Write Supabase Storage path back to scoredLocations
						if (data.storagePath) {
							locs[idx].documents[docIdx].url = data.storagePath;
						}
					}
				} catch (uploadErr) {
					console.debug('[dashboard] vault upload failed:', uploadErr);
				}
			}
			lp.scoredLocations = locs;
			localStorage.setItem('re2_launchpad', JSON.stringify(lp));
			// 04.22.2026: Route through readStoredFitScores to enforce strict fitScore policy
			allLocations = readStoredFitScores([...locs]);
		} catch {}
		uploadingFiles = false;
		input.value = '';
	}

	// Export Brief — same rich HTML as Location IQ "↗ Export Brief" button
	// Reads re2_session if address matches (full data); falls back to scoredLocations[] only.
	function exportFullBrief(loc: any) {
		const fitIQ      = loc.fitScore     ?? 0;
		const locationIQ = loc.score        ?? 0;
		const visionIQ   = loc.visionScore  ?? 0;
		const conceptType = loc.conceptType || 'specialty_coffee';
		const addr = loc.addr || '';
		const addrLine1 = addr.split(',')[0];
		const addrRest  = addr.split(',').slice(1).join(',').trim();

		// Try to hydrate rich data from re2_session
		let six   = { transit: 0, vibrancy: 0, demographics: 0, safety: 0, momentum: 0, competition: 0 };
		let neighborhood = '';
		let differentiators = '';
		let avgCheck = '';
		let bizName  = '';
		let visionBizTypeLabel = formatConcept(conceptType);

		try {
			const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
			bizName = (lp.businessName as string) || '';
		} catch {}
		try {
			const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
			if (sess.analyzedAddress === addr) {
				six            = sess.sixScores || six;
				neighborhood   = sess.neighborhood || sess.primaryHood || '';
				differentiators = sess.visionDifferentiators || sess.differentiators || '';
				avgCheck       = sess.visionAvgCheck || sess.avgCheck || '';
			}
		} catch {}

		const hasSix = Object.values(six).some(v => (v as number) > 0);
		const today  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
		const titleName = bizName || ('Your ' + visionBizTypeLabel);
		const awningLabel = bizName.length > 18 ? bizName.substring(0, 16) + '...' : (bizName || visionBizTypeLabel);

		// Helpers — EF-4: use canonical fitTierLabel / blockTierLabel so tier
		// vocabulary can never drift from the rest of the app.
		const _fitTier  = (s: number) => s > 0 ? fitTierLabel(s) : '—';
		const _locTier  = (s: number) => blockTierLabel(s) || '—';
		// BL-B1: replaced local ternary with canonical tierFor('visionIQ') — was Well-Defined/Clear/Developing/Needs Input
		const _visTier  = (s: number) => s > 0 ? tierFor(s, 'visionIQ').label : '—';
		const _sigFill  = (s: number) => s >= 70 ? 'g' : s >= 45 ? 'a' : 'r';
		const _sigCol   = (s: number) => s >= 70 ? '#15803d' : s >= 45 ? '#d97706' : '#ef4444';
		const _tierLbl  = (s: number) => tierFor(s, 'lens').label;
		const _tierCls  = (s: number) => { const c = tierFor(s, 'lens').color; return c === 'green' ? 'tier-green' : c === 'amber' ? 'tier-amber' : c === 'red' ? 'tier-red' : 'tier-neutral'; };
		const fitVerdict = (fit: number) => fit >= 75 ? 'Strong Path. Excellent fundamentals and concept alignment for this block.'
			: fit >= 65 ? 'Viable. This location works — with the right setup, you\'re above average.'
			: fit >= 50 ? 'Tight. The block has potential — refine your concept details to improve alignment.'
			: fit >= 40 ? 'Stretch. Location fundamentals and concept fit need significant work.'
			: 'Rethink. Consider adjusting your vision or exploring other blocks.';
		const fitColor = fitIQ >= 65 ? '#15803d' : fitIQ >= 45 ? '#c06a2a' : '#dc2626';
		const verdictHeadline = fitIQ >= 75 ? '&#x2705; Strong Path — Fundamentals are strong. Ready to act.'
			: fitIQ >= 65 ? '&#x2705; Viable — This location works. Optimize your concept to go from good to great.'
			: fitIQ >= 50 ? '&#x26A0;&#xFE0F; Tight — Has potential. Significant refinements needed.'
			: fitIQ >= 40 ? '&#x26A0;&#xFE0F; Stretch — Meaningful gaps. Address before committing.'
			: '&#x26A0;&#xFE0F; Rethink — Signals are weak. Explore other options.';

		// Narrative — EF-2 (April 11) confidence guard.
		// When Vision is preliminary/empty we must NOT emit the "well-defined customer"
		// copy — that's a hallucination. Fall back to an honest "scoring without Vision"
		// notice that matches the PRELIM tag the score badge displays.
		const hasCustomDiff = differentiators.trim().length > 3;
		const conceptFriendly = visionBizTypeLabel.toLowerCase();
		const _visionIsPrelimLocal = visionIQ < 30 || (!hasCustomDiff && !avgCheck);
		const narrativeP1 = _visionIsPrelimLocal
			? '<strong>' + (bizName || 'This concept') + '</strong> is being scored '
				+ 'against a generic ' + conceptFriendly + ' profile — concept details '
				+ '(concept angle, average check, differentiators) haven\'t been filled in yet. '
				+ 'Add them to sharpen this result by ~8 points and unlock concept-aware narrative.'
			: '<strong>' + (bizName || 'This concept') + '</strong> — '
				+ (hasCustomDiff
					? 'a ' + conceptFriendly + ' with a distinct angle: ' + differentiators.trim().toLowerCase()
					: 'a ' + conceptFriendly + ' concept with a clear market position')
				+ '. ' + (avgCheck ? 'At an average check of ' + avgCheck + ', this' : 'This')
				+ ' is a deliberate market position.';
		const narrativeP2 = 'The data below tells the story: this block '
			+ (locationIQ >= 65 ? 'has strong fundamentals' : 'has workable fundamentals')
			+ ' and the concept ' + (fitIQ >= 65 ? 'aligns well with them.' : 'needs sharpening to align.');

		// Pills
		const pillsHtml = (bizName ? '<span class="hero-pill">' + bizName + '</span>' : '')
			+ '<span class="hero-pill">' + visionBizTypeLabel + '</span>'
			+ (differentiators.trim() ? '<span class="hero-pill">' + differentiators.trim().split(/[\s,;]+/).slice(0,3).join(' · ') + '</span>' : '');

		// Signal rows
		const sigs: Array<{icon: string; name: string; desc: string; val: number}> = [
			{ icon: '&#x1F687;', name: 'Accessibility',       desc: 'Transit access &middot; foot traffic potential', val: Math.round(six.transit      || 0) },
			{ icon: '&#x1F465;', name: 'Demographics Match',  desc: 'Age + income fit for this concept',              val: Math.round(six.demographics || 0) },
			{ icon: '&#x1F3D8;', name: 'Neighbourhood Energy',desc: 'Vibrancy &middot; street-level activity',        val: Math.round(six.vibrancy     || 0) },
			{ icon: '&#x1F4CA;', name: 'Market Proof',        desc: 'Do similar businesses thrive here?',            val: Math.round(six.competition  || 0) },
			{ icon: '&#x1F6E1;', name: 'Safety',              desc: 'Reported incidents &middot; time of day fit',    val: Math.round(six.safety       || 0) },
			{ icon: '&#x1F4C8;', name: 'Momentum',            desc: 'Neighbourhood growth trajectory',               val: Math.round(six.momentum     || 0) },
		].filter(s => s.val > 0);

		const sigRowsHtml = hasSix ? sigs.map(s =>
			'<div class="sig-row">'
			+ '<div class="sig-icon">' + s.icon + '</div>'
			+ '<div class="sig-info"><div class="sig-name">' + s.name + '</div><div class="sig-desc">' + s.desc + '</div></div>'
			+ '<div class="sig-track"><div class="sig-fill ' + _sigFill(s.val) + '" style="width:' + s.val + '%"></div></div>'
			+ '<span class="sig-tier ' + _tierCls(s.val) + '">' + _tierLbl(s.val) + '</span>'
			+ '<div class="sig-val" style="color:' + _sigCol(s.val) + '">' + s.val + '</div>'
			+ '</div>'
		).join('\n')
		: '<p style="font-size:12px;color:#9ca3af;padding:8px 0">Re-run analysis from the location detail page to populate signal detail.</p>';

		// Concept rows
		const cRows = [
			{ icon: '&#x1F3EA;', label: 'Business Type', val: visionBizTypeLabel },
			...(differentiators.trim() ? [{ icon: '&#x2B50;', label: 'Differentiator', val: differentiators.trim() }] : []),
			...(avgCheck ? [{ icon: '&#x1F4B0;', label: 'Average Check', val: avgCheck }] : []),
		];
		const conceptRowsHtml = cRows.map(r =>
			'<div class="concept-row">'
			+ '<div class="concept-key">' + r.icon + ' ' + r.label + '</div>'
			+ '<div class="concept-val">' + r.val + '</div>'
			+ '</div>'
		).join('\n');

		// Vision note
		const visionTrioHtml = visionIQ > 0
			? '<div class="sc-row"><div class="sc-lbl">Concept Detail</div><div class="sc-right"><div class="sc-num" style="color:#d97706">' + visionIQ + '</div><div class="sc-tier" style="background:#fef3c7;color:#92400e">' + _visTier(visionIQ) + '</div></div></div>'
			: '';

		const stepDiffHtml = hasCustomDiff
			? 'Your angle is <strong>' + differentiators.trim().split(/[\s,;]+/).slice(0,4).join(' ') + '</strong>. Name it on your signage, menu, and every customer touchpoint from day one.'
			: "Sharpen your differentiator — it's the one thing that makes you unmissable.";

		const html = '<!DOCTYPE html>\n'
			+ '<html lang="en">\n<head>\n<meta charset="UTF-8">\n'
			+ '<title>RE\u00B2 Location Brief \u2014 ' + titleName + '</title>\n'
			+ '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
			+ '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">\n'
			+ '<style>\n'
			+ '*{box-sizing:border-box;margin:0;padding:0}\n'
			+ ':root{--dg:#1e3a2a;--sage:#4a7c5c;--brand:#15803d;--gold:#d97706;--ink:#111827;--t2:#4b5563;--t3:#9ca3af;--bdr:#e5e7eb;--surf:#f9fafb}\n'
			+ 'html,body{font-family:\'Inter\',sans-serif;background:#eeede8;color:var(--ink);-webkit-font-smoothing:antialiased;padding:48px 24px}\n'
			+ '.page{width:860px;margin:0 auto;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.12),0 4px 16px rgba(0,0,0,.06)}\n'
			+ '.hero{background:var(--dg);display:grid;grid-template-columns:1fr 280px;min-height:280px}\n'
			+ '.hero-left{padding:36px 40px 32px;display:flex;flex-direction:column;justify-content:space-between}\n'
			+ '.hero-eyebrow{display:flex;align-items:center;gap:10px;margin-bottom:24px}\n'
			+ '.hero-logo{font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;color:rgba(255,255,255,.9);letter-spacing:-.3px}\n'
			+ '.hero-logo sup{font-size:10px;color:rgba(255,255,255,.4);vertical-align:super}\n'
			+ '.hero-sep{width:1px;height:16px;background:rgba(255,255,255,.15)}\n'
			+ '.hero-doc-type{font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,.35)}\n'
			+ '.hero-title{font-family:\'Playfair Display\',serif;font-size:42px;font-weight:700;color:#fff;line-height:1.05;letter-spacing:-1.5px;margin-bottom:10px}\n'
			+ '.hero-title em{font-style:italic;font-weight:400;color:rgba(255,255,255,.55)}\n'
			+ '.hero-pills{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px}\n'
			+ '.hero-pill{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;color:rgba(255,255,255,.65)}\n'
			+ '.hero-addr{font-size:13px;color:rgba(255,255,255,.5);font-weight:500;display:flex;align-items:center;gap:6px}\n'
			+ '.hero-right{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;background:linear-gradient(160deg,#2a4a38 0%,#1a3226 100%)}\n'
			+ '.sv-sky{position:absolute;top:0;left:0;right:0;height:50%;background:linear-gradient(180deg,#1a2d40 0%,#253d2c 100%)}\n'
			+ '.sv-scene{position:relative;z-index:2;width:100%;display:flex;flex-direction:column;align-items:center}\n'
			+ '.sv-brow{display:flex;align-items:flex-end;width:100%;gap:0}\n'
			+ '.sv-side{flex:1;background:linear-gradient(180deg,#4a5568 0%,#2d3748 100%);opacity:.5}\n'
			+ '.sv-side.l{height:110px;border-radius:2px 0 0 0}.sv-side.r{height:80px;border-radius:0 2px 0 0}\n'
			+ '.sv-sf{width:148px;flex-shrink:0;position:relative}\n'
			+ '.sv-face{height:154px;background:linear-gradient(180deg,#b8956a 0%,#a07850 100%);position:relative;display:flex;flex-direction:column;align-items:center}\n'
			+ '.sv-face::before{content:\'\';position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.06) 0,rgba(0,0,0,.06) 12px,transparent 12px,transparent 24px),repeating-linear-gradient(90deg,rgba(0,0,0,.04) 0,rgba(0,0,0,.04) 1px,transparent 1px,transparent 40px)}\n'
			+ '.sv-awn{width:100%;height:38px;background:var(--dg);display:flex;align-items:center;justify-content:center;position:relative;z-index:1}\n'
			+ '.sv-awn::after{content:\'\';position:absolute;bottom:-9px;left:0;right:0;height:9px;background:repeating-linear-gradient(90deg,var(--dg) 0,var(--dg) 18px,transparent 18px,transparent 36px)}\n'
			+ '.sv-awn-txt{font-family:\'Playfair Display\',serif;font-size:10px;font-weight:700;color:rgba(255,255,255,.9);letter-spacing:.4px;position:relative;z-index:1}\n'
			+ '.sv-wins{display:flex;gap:8px;margin-top:24px;position:relative;z-index:1}\n'
			+ '.sv-win{width:40px;height:62px;background:rgba(180,220,255,.3);border:2px solid rgba(255,255,255,.25);border-radius:2px 2px 0 0;position:relative}\n'
			+ '.sv-win::before{content:\'\';position:absolute;top:50%;left:0;right:0;height:1.5px;background:rgba(255,255,255,.2)}\n'
			+ '.sv-win::after{content:\'\';position:absolute;top:0;bottom:0;left:50%;width:1.5px;background:rgba(255,255,255,.2)}\n'
			+ '.sv-door{width:26px;height:44px;background:rgba(30,58,42,.8);border:2px solid rgba(255,255,255,.2);border-radius:2px 2px 0 0;position:absolute;bottom:0;left:50%;transform:translateX(-50%)}\n'
			+ '.sv-walk{height:20px;background:linear-gradient(180deg,#999 0%,#777 100%);width:100%}\n'
			+ '.sv-cap{background:rgba(0,0,0,.35);width:100%;padding:7px 12px;display:flex;align-items:center;justify-content:space-between}\n'
			+ '.sv-cap-addr{font-size:10px;font-weight:600;color:rgba(255,255,255,.55);letter-spacing:.4px}\n'
			+ '.sv-cap-badge{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.3)}\n'
			+ '.narrative{padding:36px 40px 28px;border-bottom:1px solid var(--bdr)}\n'
			+ '.nar-open{display:flex;align-items:flex-start;gap:18px;margin-bottom:20px}\n'
			+ '.nar-qmark{font-family:\'Playfair Display\',serif;font-size:72px;color:#e5e7eb;line-height:.7;flex-shrink:0;margin-top:8px;user-select:none}\n'
			+ '.nar-body{font-family:\'Playfair Display\',serif;font-size:17px;font-weight:400;color:var(--ink);line-height:1.7}\n'
			+ '.nar-body strong{font-weight:700;color:var(--dg)}.nar-body em{font-style:italic;color:var(--gold)}\n'
			+ '.nar-detail{font-size:13px;color:var(--t2);line-height:1.75;margin-top:14px;padding-left:22px;border-left:3px solid #e5e7eb}\n'
			+ '.verdict{padding:0 40px 28px;display:grid;grid-template-columns:1fr auto;gap:22px;align-items:start;border-bottom:1px solid var(--bdr)}\n'
			+ '.v-hl{font-family:\'Playfair Display\',serif;font-size:22px;font-weight:700;color:var(--dg);line-height:1.2;margin-bottom:6px}\n'
			+ '.v-sub{font-size:13px;color:var(--t2);line-height:1.65;max-width:450px}\n'
			+ '.score-trio{display:flex;flex-direction:column;gap:8px;flex-shrink:0;min-width:192px}\n'
			+ '.sc-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-radius:8px;border:1px solid var(--bdr);background:var(--surf)}\n'
			+ '.sc-row.primary{background:#f0fdf4;border-color:#86efac}\n'
			+ '.sc-lbl{font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.8px}\n'
			+ '.sc-right{display:flex;align-items:center;gap:7px}\n'
			+ '.sc-num{font-size:21px;font-weight:900;line-height:1}\n'
			+ '.sc-tier{font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;white-space:nowrap}\n'
			+ '.data-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid var(--bdr)}\n'
			+ '.d-panel{padding:24px 40px;border-right:1px solid var(--bdr)}\n'
			+ '.d-panel:last-child{border-right:none}\n'
			+ '.p-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--t3);margin-bottom:14px;display:flex;align-items:center;gap:8px}\n'
			+ '.p-lbl::after{content:\'\';flex:1;height:1px;background:var(--bdr)}\n'
			+ '.sig-row{display:flex;align-items:center;gap:9px;margin-bottom:10px}\n'
			+ '.sig-icon{font-size:12px;width:16px;text-align:center;flex-shrink:0}\n'
			+ '.sig-info{flex:1;min-width:0}\n'
			+ '.sig-name{font-size:12px;font-weight:600;color:var(--ink);line-height:1.2}\n'
			+ '.sig-desc{font-size:10px;color:var(--t3);margin-top:2px}\n'
			+ '.sig-track{width:64px;flex-shrink:0;height:5px;background:#ebebeb;border-radius:3px;overflow:hidden}\n'
			+ '.sig-fill{height:100%;border-radius:3px}\n'
			+ '.sig-fill.g{background:#22c55e}.sig-fill.a{background:#f59e0b}.sig-fill.r{background:#ef4444}\n'
			+ '.sig-val{font-size:12px;font-weight:800;width:24px;text-align:right;flex-shrink:0}\n'
			+ '.sig-tier{font-size:10px;font-weight:700;padding:2px 5px;border-radius:3px;white-space:nowrap;flex-shrink:0;width:56px;text-align:center}\n'
			+ '.tier-green{background:#dcfce7;color:#166534}.tier-amber{background:#fef3c7;color:#92400e}\n'
			+ '.tier-red{background:#fee2e2;color:#991b1b}.tier-neutral{background:#e0f2fe;color:#0c4a6e}\n'
			+ '.concept-row{display:flex;align-items:flex-start;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f3f3f0;gap:8px}\n'
			+ '.concept-row:last-child{border-bottom:none}\n'
			+ '.concept-key{font-size:12px;color:var(--t2);font-weight:500;display:flex;align-items:center;gap:5px}\n'
			+ '.concept-val{font-size:12px;font-weight:700;color:var(--dg);text-align:right}\n'
			+ '.next{padding:24px 40px 28px;border-bottom:1px solid var(--bdr)}\n'
			+ '.next-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--t3);margin-bottom:16px;display:flex;align-items:center;gap:8px}\n'
			+ '.next-lbl::after{content:\'\';flex:1;height:1px;background:var(--bdr)}\n'
			+ '.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}\n'
			+ '.step{background:var(--surf);border:1px solid var(--bdr);border-radius:10px;padding:14px}\n'
			+ '.step-n{font-size:9px;font-weight:800;letter-spacing:1px;color:var(--brand);margin-bottom:5px}\n'
			+ '.step-t{font-size:13px;font-weight:700;color:var(--dg);margin-bottom:5px;line-height:1.3}\n'
			+ '.step-d{font-size:12px;color:var(--t2);line-height:1.6}\n'
			+ 'footer{padding:16px 40px;display:flex;align-items:center;justify-content:space-between;background:#fafaf8;border-top:1px solid var(--bdr)}\n'
			+ '.f-brand{font-family:\'Playfair Display\',serif;font-size:14px;font-weight:700;color:var(--dg);display:flex;align-items:center;gap:5px}\n'
			+ '.f-brand sup{font-size:8px;color:var(--t3);vertical-align:super}\n'
			+ '.f-meta{font-size:10px;color:var(--t3);text-align:center;max-width:360px;line-height:1.5}\n'
			+ '.f-date{font-size:10px;color:var(--t3);font-weight:600;text-align:right}\n'
			+ '@media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0}}\n'
			+ '</style>\n</head>\n<body>\n<div class="page">\n\n'
			+ '<div class="hero"><div class="hero-left">'
			+ '<div class="hero-eyebrow"><div class="hero-logo">RE<sup>2</sup></div><div class="hero-sep"></div><div class="hero-doc-type">Founder&#x27;s Location Brief</div></div>'
			+ '<div><div class="hero-title">' + addrLine1 + '<br><em>' + (addrRest || neighborhood || 'New York') + '</em></div>'
			+ '<div class="hero-pills">' + pillsHtml + '</div>'
			+ '<div class="hero-addr">&#x1F4CD; ' + addr + '</div></div>'
			+ '</div>'
			+ '<div class="hero-right"><div class="sv-sky"></div><div class="sv-scene"><div class="sv-brow">'
			+ '<div class="sv-side l"></div>'
			+ '<div class="sv-sf"><div class="sv-face"><div class="sv-awn"><span class="sv-awn-txt">' + awningLabel + '</span></div>'
			+ '<div class="sv-wins"><div class="sv-win"></div><div class="sv-win"></div></div><div class="sv-door"></div></div>'
			+ '<div class="sv-walk"></div></div>'
			+ '<div class="sv-side r"></div></div>'
			+ '<div class="sv-cap"><div class="sv-cap-addr">' + addrLine1 + ' &middot; ' + (neighborhood || addrRest || 'NYC') + '</div><div class="sv-cap-badge">Location Brief</div></div>'
			+ '</div></div></div>\n\n'
			+ '<div class="narrative"><div class="nar-open"><div class="nar-qmark">&#x201C;</div><div>'
			+ '<div class="nar-body">' + narrativeP1 + '</div>'
			+ '<div class="nar-detail">' + narrativeP2 + '</div>'
			+ '</div></div></div>\n\n'
			+ '<div class="verdict"><div>'
			+ '<div class="v-hl">' + verdictHeadline + '</div>'
			+ '<div class="v-sub">' + fitVerdict(fitIQ) + '</div>'
			+ '</div><div class="score-trio">'
			+ '<div class="sc-row primary"><div class="sc-lbl">Your Score</div><div class="sc-right"><div class="sc-num" style="color:' + fitColor + '">' + fitIQ + '</div><div class="sc-tier" style="background:' + (fitIQ >= 65 ? '#dcfce7' : '#fef3c7') + ';color:' + (fitIQ >= 65 ? '#15803d' : '#92400e') + '">' + _fitTier(fitIQ) + '</div></div></div>'
			+ '<div class="sc-row"><div class="sc-lbl">Block Score</div><div class="sc-right"><div class="sc-num" style="color:#4a7c5c">' + locationIQ + '</div><div class="sc-tier" style="background:#d1fae5;color:#1e5c3a">' + _locTier(locationIQ) + '</div></div></div>'
			+ visionTrioHtml
			+ '</div></div>\n\n'
			+ '<div class="data-grid">'
			+ '<div class="d-panel"><div class="p-lbl">What the block is telling us</div>' + sigRowsHtml + '</div>'
			+ '<div class="d-panel"><div class="p-lbl">The concept as scored</div>' + conceptRowsHtml + '</div>'
			+ '</div>\n\n'
			+ '<div class="next"><div class="next-lbl">What to do next</div><div class="steps">'
			+ '<div class="step"><div class="step-n">STEP 01</div><div class="step-t">Run your competitive audit</div><div class="step-d">Walk every comparable business within 400m. Map what they don&#x27;t do. The gap you find is your positioning strategy.</div></div>'
			+ '<div class="step"><div class="step-n">STEP 02</div><div class="step-t">Own your differentiator fully</div><div class="step-d">' + stepDiffHtml + '</div></div>'
			+ '<div class="step"><div class="step-n">STEP 03</div><div class="step-t">Model break-even at peak</div><div class="step-d">Build your break-even model at 60% of peak-hour capacity.' + (avgCheck ? ' At ' + avgCheck + ' average check, you know your revenue ceiling.' : ' Set your average check, then model backwards from your rent.') + '</div></div>'
			+ '</div></div>\n\n'
			+ '<footer><div class="f-brand">RE<sup>2</sup> <span style="font-family:Inter;font-size:10px;color:#9ca3af;font-weight:500">resquared.io</span></div>'
			+ '<div class="f-meta">AI-generated location intelligence. Not investment advice. Data sourced from US Census, Google Places, NYC DOHMH &amp; RE&#xB2; proprietary scoring. For personal use only.</div>'
			+ '<div class="f-date">' + today + '<br><span style="color:#d1d5db">Confidential</span></div>'
			+ '</footer>\n\n</div>\n</body>\n</html>';

		const blob = new Blob([html], { type: 'text/html' });
		const url  = URL.createObjectURL(blob);
		const w    = window.open(url, '_blank');
		if (!w) window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
		setTimeout(() => URL.revokeObjectURL(url), 10000);
	}

	// ── Derived: concept groups ───────────────────────────────────────────────
	// Session-level concept fallback for locations missing conceptType
	let _sessionConceptFallback = $state('');
	$effect(() => {
		try {
			const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
			_sessionConceptFallback = sess.canonicalConcept || sess.bizType || sess.visionBizType || '';
		} catch {}
	});

	let conceptGroups: Array<[string, any[]]> = $derived.by(() => {
		const groups: Record<string, any[]> = {};
		for (const loc of filteredLocations) {
			const key = loc.conceptType || loc.bizType || loc.personaType || loc.personaKey || _sessionConceptFallback || 'unknown';
			if (!groups[key]) groups[key] = [];
			groups[key].push(loc);
		}
		// Within each group, preserve the global sort order (already sorted by filteredLocations)
		// Sort groups by best fitScore in group desc
		return Object.entries(groups).sort(([, a], [, b]) => {
			const bestA = Math.max(...a.map((l: any) => l.fitScore ?? 0));
			const bestB = Math.max(...b.map((l: any) => l.fitScore ?? 0));
			return bestB - bestA;
		});
	});

	// ── Derived: progress step (5A audit) ────────────────────────────────────
	let hasLocationIQ = $derived(allLocations.length > 0);
	let hasBusinessCase = $derived(allLocations.some((l: any) => l.businessCase && !l.businessCase?.isPartialSeed));
	let hasChecklistStarted = $derived(checklistDone > 0);

	// 3-step model: Dashboard is the hub, not a step.
	// 1 = Get your Fit Score, 2 = Build a Business Case, 3 = Prepare for Launch
	let progressStep = $derived.by((): { current: number; total: number; label: string; next: string } => {
		if (!hasLocationIQ) return { current: 0, total: 3, label: 'Get started', next: 'Get your Score' };
		if (!hasBusinessCase) return { current: 1, total: 3, label: 'Location scored', next: 'Build a Business Case' };
		if (!hasChecklistStarted) return { current: 2, total: 3, label: 'Business Case built', next: 'Prepare for Launch' };
		return { current: 3, total: 3, label: 'You\'re launch-ready', next: 'You\'re launch-ready' };
	});

	// Primary concept name for greeting
	let _primaryConcept = $derived.by((): string => {
		if (!allLocations.length) return '';
		const first = allLocations[0];
		return first?.conceptType || first?.bizType || first?.personaType || _sessionConceptFallback || '';
	});

	// ── Derived: summary strip ────────────────────────────────────────────────
	let summaryBestFit = $derived(
		allLocations.reduce((m: number, l: any) => Math.max(m, l.fitScore ?? 0), 0)
	);
	let summaryBestFitLoc = $derived(
		allLocations.find((l: any) => (l.fitScore ?? 0) === summaryBestFit) ?? null
	);
	let summaryConceptCount = $derived(
		new Set(allLocations.map((l: any) => l.conceptType || l.bizType || 'unknown')).size
	);
	// Exclude partial seeds (seeded from targetRevY1 before BC page is visited) — they have costsY1=0 and are not real model results
	let locationsWithCase: any[] = $derived(
		allLocations.filter((l: any) => l.businessCase && !l.businessCase.isPartialSeed)
	);
	let summaryBestRevLoc = $derived(
		locationsWithCase.length > 0
			? locationsWithCase.reduce((best: any, l: any) =>
				(l.businessCase?.revenueY1 ?? 0) > (best.businessCase?.revenueY1 ?? 0) ? l : best,
				locationsWithCase[0])
			: null
	);
	let summaryAvgBreakEven = $derived(
		locationsWithCase.length > 0
			? Math.round(locationsWithCase.reduce((s: number, l: any) => s + (l.businessCase?.breakEvenMonths ?? 0), 0) / locationsWithCase.length)
			: 0
	);
	// Fix 8: Rough Y1 revenue estimate from concept defaults (shown before BC is built)
	let roughRevenueY1 = $derived.by((): { low: number; high: number } | null => {
		if (!_primaryConcept) return null;
		const kpi = CONCEPT_KPIS[_primaryConcept];
		if (!kpi) return null;
		const steady = computeSteadyStateRevenue(_primaryConcept);
		const ramp = RAMP_FACTORS[kpi.revenueModel]?.[0] ?? 0.62;
		const y1 = Math.round(steady * ramp);
		return { low: Math.round(y1 * 0.8), high: Math.round(y1 * 1.2) };
	});
	let summaryLastActivity = $derived.by((): string => {
		if (!allLocations.length) return '—';
		const ts = allLocations
			.map((l: any) => {
				const t = l.scoredAt;
				// R-14 FIX: scoredAt is stored as String(Date.now()) — a numeric string.
				// new Date("1746390000000") returns Invalid Date; must parse via Number() first.
				if (typeof t === 'number') return t;
				const n = Number(t);
				return isFinite(n) && n > 0 ? n : 0;
			})
			.filter(n => n > 0);
		if (!ts.length) return '—';
		return timeAgo(Math.max(...ts));
	});

	// ── Brain: Dashboard headline + Today's Insight ──────────────────────────
	let _bestLoc = $derived(summaryBestFitLoc as any);
	let _bestSix = $derived<Record<string, number>>(_bestLoc?.sixScores ?? {});
	let _bestFit = $derived<number>(_bestLoc?.fitScore ?? 0);
	let _bestLoc$ = $derived<number>(_bestLoc?.score ?? 0);
	let _bestVision = $derived<number>(_bestLoc?.visionScore ?? 0);
	let _visionIsPrelim = $derived(_bestVision < 30 || !_bestLoc);
	let _hasBC  = $derived(!!(_bestLoc?.businessCase?.revenueY1 > 0 && !_bestLoc?.businessCase?.isPartialSeed));
	let _bestDecision = $derived(
		_bestFit > 0 && _bestLoc?.conceptType
			? getDecisionState(_bestFit, _bestLoc$, _bestVision, _bestSix, {}, _bestLoc?.conceptType, _visionIsPrelim)
			: null
	);
	let _hasKill = $derived(_bestDecision?.state === 'do_not_pursue' || _bestDecision?.state === 'high_risk');

	let dashboardHeadline = $derived<DashboardHeadline>(
		getDashboardHeadline({
			hasScore:        allLocations.length > 0,
			visionIsPrelim:  _visionIsPrelim,
			hasBusinessCase: _hasBC,
			hasKillFactor:   _hasKill,
			killFactorName:  _hasKill ? _bestDecision?.reasons?.[0]?.split(' ').slice(0, 3).join(' ') : undefined,
			locationCount:   allLocations.length,
			bestFitIQ:       _bestFit,
			bestLocationIQ:  _bestLoc$,
			breakEvenMonth:  (_bestLoc as any)?.businessCase?.breakEvenMonth ?? null,
		})
	);

	let todaysInsight = $derived<TodaysInsight | null>(
		_bestFit > 0 && _bestDecision && _bestLoc?.conceptType
			? getTodaysInsight({
				decisionState:      _bestDecision,
				coaching:           null,
				visionIsPrelim:     _visionIsPrelim,
				visionCompletionPct: _visionIsPrelim ? 40 : 100,
				sixScores:          _bestSix,
				fitSubScores:       _bestLoc?.fitSubScores ?? {},
				concept:            _bestLoc?.conceptType ?? 'default',
				locationIQ:         _bestLoc$,
				fitIQ:              _bestFit,
			})
			: null
	);

	// UX-FIX-01: Mapper fix notification banner
	let showMapperBanner = $state(false);
	function dismissMapperBanner() {
		try { localStorage.setItem('re2_mapper_fix_dismissed', '1'); } catch {}
		showMapperBanner = false;
	}

	// UX-FIX-05: Dashboard insight null — show contextual CTA instead
	// (handled in template below)

	// ── Mount ─────────────────────────────────────────────────────────────────
	onMount(() => {
		mounted = true;
		try {
			if (!localStorage.getItem('re2_mapper_fix_dismissed')) showMapperBanner = true;
		} catch {}


		// Load firstName from Clerk
		try {
			const cu = (window as any).Clerk?.user;
			if (cu?.firstName) firstName = cu.firstName;
			else if (cu?.fullName) firstName = cu.fullName.split(' ')[0];
		} catch {}

		// Load checklist progress for dashboard CTA
		try {
			const saved = JSON.parse(localStorage.getItem('re2_checklist') || 'null');
			if (saved?.items) {
				checklistTotal = saved.items.length;
				checklistDone = saved.items.filter((i: { done: boolean }) => i.done).length;
			}
		} catch {}

		// Load all scored locations
		// F-003: DB fallback — if localStorage is empty, fetch from Supabase before showing empty state
		let hadLocalStorage = false;
		try {
			const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
			const rawLocations = lp.scoredLocations || [];
			// 04.22.2026 Deprecating: was recanonicalizeScores(rawLocations, lp) which used
			// a rogue 0.75x formula to re-derive fitIQ. Now uses readStoredFitScores()
			// which trusts the server-persisted fitScore. See bundle-builder.ts.
			allLocations = readStoredFitScores(rawLocations);
			hadLocalStorage = allLocations.length > 0;
		} catch {}

		// No hard redirect — returning users stay on dashboard (empty state shown below)
		// New users reach dashboard via onboarding flow naturally

		if (!hadLocalStorage) {
			// F-003: localStorage empty — try DB before showing "Add your first location" CTA
			(async () => {
				try {
					const res = await authedFetch('/api/session-sync', { timeout: 6_000 });
					if (!res.ok) return;
					const { found, shortlistedLocations } = await res.json();
					if (!found || !Array.isArray(shortlistedLocations) || !shortlistedLocations.length) return;
					// Hydrate localStorage and render
					const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
					lp.scoredLocations = shortlistedLocations;
					localStorage.setItem('re2_launchpad', JSON.stringify(lp));
					// 04.22.2026: Route through readStoredFitScores to enforce strict fitScore policy
					allLocations = readStoredFitScores(shortlistedLocations);
				} catch {}
			})();
		} else {
			// Background Supabase sync (M015 — cross-device merge) — only when localStorage had data
			(async () => {
				try {
					const res = await authedFetch('/api/session-sync', { timeout: 6_000 });
					if (!res.ok) return;
					const { found, shortlistedLocations } = await res.json();
					if (!found || !Array.isArray(shortlistedLocations) || !shortlistedLocations.length) return;

					const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
					const local: any[] = lp.scoredLocations || [];
					// Build a map of local records for fast lookup
					const localByAddr = new Map(local.map((l: any) => [l.addr, l]));
					const remoteAddrs = new Set(shortlistedLocations.map((l: any) => l.addr));
					// Merge: remote is authoritative for scoring fields; local fields not in Supabase
					// (businessCase, documents, starred, pinned) are preserved from local record
					const mergedRemote = shortlistedLocations.map((r: any) => {
						const loc = localByAddr.get(r.addr);
						if (!loc) return r;
						return {
							...r,
							businessCase: loc.businessCase ?? r.businessCase,
							documents:    loc.documents    ?? r.documents,
							starred:      loc.starred      ?? r.starred,
							pinned:       loc.pinned       ?? r.pinned,
						};
					});
					const localOnly = local.filter((l: any) => !remoteAddrs.has(l.addr));
					const merged = [...mergedRemote, ...localOnly];
					lp.scoredLocations = merged;
					localStorage.setItem('re2_launchpad', JSON.stringify(lp));
					// 04.22.2026: Route through readStoredFitScores to enforce strict fitScore policy
					allLocations = readStoredFitScores(merged);
				} catch {}
			})();
		}
	});
</script>

<svelte:head><title>RE² — Dashboard</title></svelte:head>

<NavigationDrawer />

<!-- UX-FIX-01: Mapper fix notification banner (one-time, dismissable) -->
{#if showMapperBanner}
<div class="mapper-banner">
	<div class="mapper-banner-text">
		<strong>Scores updated.</strong> We've improved how we identify competitors for your concept type. Your location scores have been recalculated with more accurate data.
	</div>
	<button class="mapper-banner-dismiss" onclick={dismissMapperBanner} aria-label="Dismiss">✕</button>
</div>
{/if}

<div class="dash-page">

	<!-- ══ PAGE HEADER (5A + 5G: greeting + progress indicator) ═══════════ -->
	<div class="page-hdr">
		<div class="page-hdr-left">
			<div class="page-greeting">
				{#if firstName}Hi {firstName} —{:else}{greeting()} —{/if}
				{#if allLocations.length > 0 && _primaryConcept}
					here's where your <em>{formatConcept(_primaryConcept)}</em> stands.
				{:else}
					let's find your perfect location.
				{/if}
			</div>
			<div class="page-sub">
				{#if allLocations.length > 0}
					Step {progressStep.current} of {progressStep.total} complete — {progressStep.label}. Next: {progressStep.next}
				{:else}
					{progressStep.next}
				{/if}
			</div>
		</div>
		{#if allLocations.length > 0}
		<div class="page-hdr-actions">
			<a href="/app/onboarding?fresh=true" class="btn-primary">＋ New Analysis</a>
		</div>
		{/if}
	</div>

	<!-- ══ SUMMARY STRIP (5B: unlock teasers + Fit IQ ring + Next Step) ══ -->
	<div class="summary-strip">
		<!-- Card 1: Your Score with ring + letter grade -->
		<div class="sum-card highlight">
			<div class="sum-label">Best Score</div>
			{#if summaryBestFit > 0}
				<div class="sum-ring-row">
					<div class="sum-ring-wrap">
						<svg class="sum-ring" viewBox="0 0 80 80" width="56" height="56">
							<circle cx="40" cy="40" r="33" fill="none" stroke="#e5e7eb" stroke-width="5" />
							<circle cx="40" cy="40" r="33" fill="none" stroke={fitRingColor(summaryBestFit)} stroke-width="5"
								stroke-dasharray={CIRC_LG} stroke-dashoffset={ringOffset(summaryBestFit, CIRC_LG)}
								stroke-linecap="round" transform="rotate(-90 40 40)" />
							<text x="40" y="40" text-anchor="middle" dominant-baseline="central"
								font-size="20" font-weight="900" fill={fitRingColor(summaryBestFit)}>{summaryBestFit}</text>
						</svg>
						<div class="sum-grade-badge">{fitGrade(summaryBestFit)}</div>
					</div>
					<div class="sum-ring-info">
						<div class="sum-ring-tier" style={fitTierStyle(summaryBestFit)}>Grade {fitGrade(summaryBestFit)} · {fitTierLabel(summaryBestFit)}</div>
						<div class="sum-sub">{shortAddr(summaryBestFitLoc?.addr ?? '')}</div>
						<div class="sum-meaning">{fitMeaningShort(summaryBestFit)}</div>
					</div>
				</div>
			{:else}
				<div class="sum-val">—</div>
				<div class="sum-sub">Paste an address — we'll tell you if it's the right spot in under 30 seconds.</div>
			{/if}
		</div>

		<!-- Card 2: Locations Scored -->
		<div class="sum-card">
			<div class="sum-label">Locations Scored</div>
			<div class="sum-val">{allLocations.length}</div>
			<div class="sum-sub">Across {summaryConceptCount} concept{summaryConceptCount !== 1 ? 's' : ''}</div>
		</div>

		<!-- Card 3: Revenue Y1 — unlock teaser when empty -->
		<div class="sum-card" class:sum-card-locked={!summaryBestRevLoc}>
			<div class="sum-label">Best Est. Revenue Y1</div>
			{#if summaryBestRevLoc}
				<div class="sum-val green">{fmtMoney(summaryBestRevLoc.businessCase.revenueY1)}</div>
				<div class="sum-sub">From Business Case · {shortAddr(summaryBestRevLoc.addr)}</div>
			{:else if roughRevenueY1}
				<!-- Fix 8: Rough estimate from concept defaults instead of padlock -->
				<div class="sum-val muted">~{fmtMoney(roughRevenueY1.low)}–{fmtMoney(roughRevenueY1.high)}</div>
				<div class="sum-sub">Estimated based on your concept. <a href="/app/business-plan" class="sum-refine-link">Refine in Business Case →</a></div>
			{:else}
				<div class="sum-unlock-teaser">
					<span class="sum-lock-icon">🔒</span>
					<span>Est. Revenue Y1 — complete your Business Case to unlock</span>
				</div>
			{/if}
		</div>

		<!-- Card 4: Next Step (replaces Break-Even when unavailable) -->
		<div class="sum-card" class:sum-card-next={!summaryAvgBreakEven}>
			{#if summaryAvgBreakEven > 0}
				<div class="sum-label">Avg Break-Even</div>
				<div class="sum-val gold">{summaryAvgBreakEven} mo</div>
				<div class="sum-sub">Across {locationsWithCase.length} location{locationsWithCase.length !== 1 ? 's' : ''} with financials</div>
			{:else}
				<div class="sum-label">Your Next Step</div>
				<a href={progressStep.current < 2 ? '/app/business-plan' : '/app/checklist'} class="sum-next-link">
					{progressStep.next} →
				</a>
			{/if}
		</div>
	</div>

	<!-- ══ BRAIN: CELEBRATION BANNER + PROGRESS STEPPER + INSIGHT (5C + 5D) ══ -->
	{#if allLocations.length > 0}
	<div class="brain-strip">
		<div class="brain-headline">
			<!-- 5C: Celebration copy with specific location data -->
			<div class="brain-hl-text">
				{#if summaryBestFitLoc}
					You scored {shortAddr(summaryBestFitLoc.addr)} — Your Score {summaryBestFit}/100, {fitTierLabel(summaryBestFit)}.
					{#if !hasBusinessCase}
						Now let's see if the numbers work.
					{:else if !hasChecklistStarted}
						Numbers look good. Time to plan your launch.
					{:else}
						You're building momentum.
					{/if}
				{:else}
					{dashboardHeadline.text}
				{/if}
			</div>
			<!-- Fix 6: Inline progress dots replace full stepper (reduces vertical space, kills nav duplication) -->
			<div class="brain-stepper-inline">
				<span class="bsi-dot" class:done={hasLocationIQ}>{hasLocationIQ ? '✓' : '1'}</span>
				<span class="bsi-line" class:done={hasLocationIQ}></span>
				<span class="bsi-dot" class:done={hasBusinessCase}>{hasBusinessCase ? '✓' : '2'}</span>
				<span class="bsi-line" class:done={hasBusinessCase}></span>
				<span class="bsi-dot" class:done={hasChecklistStarted}>{hasChecklistStarted ? '✓' : '3'}</span>
			</div>
			{#if !hasBusinessCase}
				<a href="/app/business-plan" class="brain-next-cta">Build your Business Case →</a>
			{:else if !hasChecklistStarted}
				<a href="/app/checklist" class="brain-next-cta">Prepare for Launch →</a>
			{/if}
		</div>
		<!-- 5D: Restructured insight as headline → context → action -->
		{#if todaysInsight}
		<div class="brain-insight brain-insight--{todaysInsight.color}">
			<div class="brain-insight-eyebrow">Today's Insight</div>
			<div class="brain-insight-text">{todaysInsight.text}</div>
			{#if todaysInsight.color === 'red' || todaysInsight.color === 'amber'}
				<div class="brain-insight-action">
					{#if _bestSix.safety < 60 && _bestSix.safety > 0}
						On your site visit, check: corner position, street lighting, nearby daytime anchors.
					{:else}
						Review your analysis detail to see what to address first.
					{/if}
				</div>
				<!-- D4: pass the address so the link lands on the actual analysis, not an empty location page -->
				<a href={summaryBestFitLoc?.addr ? `/app/location?addr=${encodeURIComponent(summaryBestFitLoc.addr)}` : '/app/location'} class="brain-insight-cta">See full analysis →</a>
			{/if}
		</div>
		{:else}
		<div class="brain-insight brain-insight--neutral">
			<div class="brain-insight-eyebrow">Today's Insight</div>
			<div class="brain-insight-text">Score your first location to unlock personalized insights.</div>
			<a href="/app/onboarding" class="brain-insight-cta">Analyze a location →</a>
		</div>
		{/if}
	</div>
	{/if}

	<!-- ══ LAUNCH CHECKLIST CTA (5E: quick wins, not total count) ══════════ -->
	{#if allLocations.length > 0}
	<a href="/app/checklist" class="checklist-cta">
		<div class="checklist-cta-icon">🚀</div>
		<div class="checklist-cta-body">
			{#if checklistDone > 0}
				<div class="checklist-cta-title">Launch Checklist — {checklistDone}/{checklistTotal} complete</div>
				<div class="checklist-cta-sub">Continue working through your pre-launch tasks</div>
			{:else}
				<div class="checklist-cta-title">Your first 3 steps are free and take under an hour</div>
				<div class="checklist-cta-sub">Start with Legal — Get an EIN, finalize budget, claim your Google profile</div>
			{/if}
		</div>
		<div class="checklist-cta-progress">
			{#if checklistTotal > 0}
				<div class="checklist-cta-ring">
					<svg viewBox="0 0 36 36" width="40" height="40">
						<circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" stroke-width="3" />
						<circle cx="18" cy="18" r="15" fill="none" stroke="#22c55e" stroke-width="3"
							stroke-dasharray="{94.2}" stroke-dashoffset="{94.2 * (1 - checklistDone / checklistTotal)}"
							stroke-linecap="round" transform="rotate(-90 18 18)" />
					</svg>
					<span class="checklist-cta-pct">{Math.round((checklistDone / checklistTotal) * 100)}%</span>
				</div>
			{/if}
			<span class="checklist-cta-arrow">→</span>
		</div>
	</a>
	{/if}

	<!-- ══ FILTER / SORT BAR ════════════════════════════════════════════════ -->
	<div class="filter-bar">
		<div class="filter-tabs">
			<button class="filter-tab" class:active={filterMode === 'all'} type="button" onclick={() => filterMode = 'all'}>
				All ({allLocations.length})
			</button>
			<button class="filter-tab" class:active={filterMode === 'starred'} type="button" onclick={() => filterMode = 'starred'}>
				⭐ Starred ({starredCount})
			</button>
			<button class="filter-tab" class:active={filterMode === 'pinned'} type="button" onclick={() => filterMode = 'pinned'}>
				📌 Shortlisted ({pinnedCount})
			</button>
			<!-- BR-10: Compare button — global scope. Visible whenever at least 2
				 locations are pinned, regardless of active filter tab. Hidden below 2
				 pins because there's nothing to compare. -->
			{#if pinnedCount >= 2}
				<button
					class="filter-tab filter-tab-compare"
					class:active={showCompare}
					type="button"
					onclick={() => showCompare = !showCompare}
					title="Side-by-side comparison of your shortlisted locations"
				>
					⊞ Compare{showCompare ? ' ✕' : ''}
				</button>
			{/if}
		</div>
		<div class="sort-group">
			<span class="sort-label">Sort by</span>
			<button class="sort-btn" class:active={sortMode === 'fit'} type="button" onclick={() => sortMode = 'fit'}>Score</button>
			<button class="sort-btn" class:active={sortMode === 'date'} type="button" onclick={() => sortMode = 'date'}>Recent</button>
			<button class="sort-btn" class:active={sortMode === 'revenue'} type="button" onclick={() => sortMode = 'revenue'}>Revenue</button>
		</div>
	</div>

	{#if filterMode === 'all' && allLocations.length === 0}
		<div class="empty-shortlist" style="border-color:#4a7c5c;background:#f0faf4">
			<div class="empty-shortlist-icon">📍</div>
			<div class="empty-shortlist-title">No locations scored yet</div>
			<div class="empty-shortlist-text">Score your first location to see your dashboard come alive.</div>
			<a href="/app/onboarding?fresh=true" class="empty-shortlist-btn">Run your first analysis →</a>
		</div>
	{/if}
	{#if filterMode === 'starred' && starredCount === 0}
		<div class="empty-shortlist" style="border-color:#fbbf24;background:#fffbeb">
			<div class="empty-shortlist-icon">⭐</div>
			<div class="empty-shortlist-title">No starred locations yet</div>
			<div class="empty-shortlist-text">Tap ⭐ on any location card to mark it as active and track it here.</div>
			<button class="empty-shortlist-btn" type="button" onclick={() => filterMode = 'all'}>← View all locations</button>
		</div>
	{/if}
	{#if filterMode === 'pinned' && pinnedCount === 0}
		<div class="empty-shortlist">
			<div class="empty-shortlist-icon">📌</div>
			<div class="empty-shortlist-title">No shortlisted locations yet</div>
			<div class="empty-shortlist-text">Click 📌 on any location card to add it to your shortlist.</div>
			<button class="empty-shortlist-btn" type="button" onclick={() => filterMode = 'all'}>← View all locations</button>
		</div>
	{/if}

	<!-- ══ BR-10: SHORTLIST COMPARE PANEL ═══════════════════════════════════ -->
	{#if showCompare && compareLocations.length >= 2}
		{@const fitWinner = winnerCol('fit')}
		{@const locWinner = winnerCol('location')}
		{@const visWinner = winnerCol('vision')}
		<div class="cmp-panel" role="region" aria-label="Shortlisted locations comparison">
			<div class="cmp-hdr">
				<div>
					<div class="cmp-title">Comparing {compareLocations.length} shortlisted location{compareLocations.length === 1 ? '' : 's'}</div>
					<div class="cmp-sub">Verdict-led read. "Best" badges mark the strongest column per row — ties and missing data show no badge.</div>
				</div>
				<button class="cmp-close" type="button" onclick={() => showCompare = false} aria-label="Close comparison">✕</button>
			</div>

			<!-- UX-A: Server narrative + overall pick from /api/shortlist/compare -->
			{#if compareEnvelopeLoading && !compareEnvelope}
				<div class="cmp-narrative cmp-narrative-loading">Computing comparison…</div>
			{:else if compareEnvelope?.narrative}
				<div class="cmp-narrative">
					{#if compareEnvelope.winners.overall.index != null}
						<span class="cmp-narrative-badge">Pick</span>
					{/if}
					<span class="cmp-narrative-text">{compareEnvelope.narrative}</span>
				</div>
			{:else if compareEnvelopeError}
				<div class="cmp-narrative cmp-narrative-error">Showing client-computed winners (server unavailable).</div>
			{/if}

			<div class="cmp-scroll">
				<div class="cmp-grid" style="grid-template-columns: 160px repeat({compareLocations.length}, minmax(220px, 1fr));">
					<!-- Column headers: address + rank pill -->
					<div class="cmp-cell cmp-row-label cmp-row-hdr"></div>
					{#each compareLocations as loc, ci (loc.addr)}
						<div class="cmp-cell cmp-col-hdr">
							<div class="cmp-col-addr">{shortAddr(loc.addr)}</div>
							<div class="cmp-col-sub">{loc.addr.split(',').slice(1, 3).join(',').trim() || '—'}</div>
						</div>
					{/each}

					<!-- Row 1: Verdict (headline, drives the whole decision) -->
					<div class="cmp-cell cmp-row-label">Verdict</div>
					{#each compareLocations as loc, ci (loc.addr + ':verdict')}
						{@const _fit = Number(loc.fitScore ?? 0)}
						{@const _six = ((loc as any).sixScores ?? {}) as SixScores}
						<div class="cmp-cell cmp-verdict">
							{#if _fit > 0}
								<div class="cmp-verdict-pill {verdictPillClass(_fit)}">{verdictEmoji(_fit)} {fitTierLabel(_fit)}</div>
								<div class="cmp-verdict-line">{getVerdict({ locationIQ: Number(loc.score ?? 0), fitIQ: _fit, visionIQ: Number(loc.visionScore ?? 0) }, _six)}</div>
							{:else}
								<div class="cmp-verdict-pill pill-muted">Not scored</div>
							{/if}
						</div>
					{/each}

					<!-- Row 2: Fit IQ / Your Score (primary metric) -->
					<div class="cmp-cell cmp-row-label">Your Score <span class="cmp-row-hint">primary</span></div>
					{#each compareLocations as loc, ci (loc.addr + ':fit')}
						{@const _fit = Number(loc.fitScore ?? 0)}
						<div class="cmp-cell cmp-metric cmp-metric-primary" class:cmp-winner={fitWinner === ci}>
							<div class="cmp-metric-val">
								{_fit > 0 ? _fit : '—'}
								{#if _fit > 0}<span class="cmp-metric-max">/100</span>{/if}
							</div>
							{#if _fit > 0}
								<!-- D11: Cap grade by kill factors + survival to avoid misleading "A" -->
								<div class="cmp-metric-tier">Grade {fitGradeCapped(_fit, loc.sixScores, loc.sixScores?.survivalRate)} · {fitBenchmark(_fit)}</div>
							{/if}
							{#if fitWinner === ci}<span class="cmp-best">Best</span>{/if}
						</div>
					{/each}

					<!-- UX-07: Vision IQ tier pill row (BL-B1 vocabulary) -->
					<div class="cmp-cell cmp-row-label">Concept Fit</div>
					{#each compareLocations as loc, ci (loc.addr + ':vis')}
						{@const _vis = Number(loc.visionScore ?? 0)}
						{@const _vt = _vis > 0 ? tierFor(_vis, 'visionIQ') : null}
						<div class="cmp-cell cmp-metric">
							{#if _vis > 0 && _vt}
								<div class="cmp-metric-val">{_vis}<span class="cmp-metric-max">/100</span></div>
								<div class="cmp-tier-pill cmp-tier-{_vt.color}">{_vt.label}</div>
							{:else}
								<div class="cmp-metric-val cmp-muted">—</div>
							{/if}
						</div>
					{/each}

					<!-- Row 5: Kill factors (the actual decision-breakers) -->
					<div class="cmp-cell cmp-row-label">Kill factors</div>
					{#each compareLocations as loc, ci (loc.addr + ':kill')}
						{@const _six = ((loc as any).sixScores ?? {}) as SixScores}
						{@const _flags = Number(loc.fitScore ?? 0) > 0 ? computeKillFactors(_six) : []}
						{@const _killsOnly = _flags.filter(f => f.flag === 'kill')}
						{@const _cautions = _flags.filter(f => f.flag === 'caution')}
						<div class="cmp-cell cmp-kill">
							{#if _killsOnly.length === 0 && _cautions.length === 0}
								<div class="cmp-kill-clean">✓ No flags</div>
							{:else}
								{#each _killsOnly.slice(0, 2) as kf (kf.signal)}
									<div class="cmp-kill-item cmp-kill-red">🚨 {kf.label}</div>
								{/each}
								{#each _cautions.slice(0, 2 - _killsOnly.length) as kf (kf.signal)}
									<div class="cmp-kill-item cmp-kill-amber">⚠️ {kf.label}</div>
								{/each}
								{#if _killsOnly.length + _cautions.length > 2}
									<div class="cmp-kill-more">+{_killsOnly.length + _cautions.length - 2} more</div>
								{/if}
							{/if}
						</div>
					{/each}

					<!-- Row 6: Scored timestamp -->
					<div class="cmp-cell cmp-row-label">Scored</div>
					{#each compareLocations as loc, ci (loc.addr + ':ts')}
						<div class="cmp-cell cmp-ts">
							{loc.scoredAt ? timeAgo(loc.scoredAt) : '—'}
						</div>
					{/each}

					<!-- Row 7: Full report CTA -->
					<div class="cmp-cell cmp-row-label"></div>
					{#each compareLocations as loc, ci (loc.addr + ':cta')}
						<div class="cmp-cell cmp-cta-cell">
							<a class="cmp-cta" href="/app/location?addr={encodeURIComponent(loc.addr)}">View full report →</a>
						</div>
					{/each}
				</div>
			</div>

			<div class="cmp-footer">
				{#if compareLocations.length < 3 && pinnedCount < 3}
					<span class="cmp-footer-hint">Shortlist up to 3 locations to compare all of them side-by-side.</span>
				{:else if compareLocations.length === 3}
					<span class="cmp-footer-hint">Showing 3 of {pinnedCount} shortlisted — unpin one to swap it out.</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- ══ CONCEPT GROUPS ═══════════════════════════════════════════════════ -->
	{#each conceptGroups as [conceptKey, locations], gi}
		<div class="section-hdr" class:section-hdr-first={gi === 0}>
			<div class="section-badge" style="background:{gi === 0 ? '#1e3a2a' : gi === 1 ? '#4a7c5c' : '#6b7280'}">
				{formatConcept(conceptKey)}
			</div>
			<div class="section-count">{locations.length} location{locations.length !== 1 ? 's' : ''}</div>
			<div class="section-line"></div>
			{#if locations.length < 3}
				<a href="/app/location?concept={conceptKey}" class="section-add">＋ Add location for this concept</a>
			{/if}
		</div>

		{#each locations as loc, li}
			<!-- D1: Guard against malformed entries — without this a single bad row
			     crashes the entire #each loop and no cards render at all. -->
			{#if loc && typeof loc.addr === 'string' && loc.addr.length > 0}
			{@const fit  = loc.fitScore  ?? 0}
			{@const liq  = loc.score     ?? 0}
			{@const vis  = loc.visionScore ?? 0}
			{@const visPrelim = vis === 0}
			{@const decision = getDecisionState(fit, liq, vis, {}, {}, conceptKey || 'specialty_coffee', visPrelim)}
			{@const _locSix  = (loc as any).sixScores ?? {}}
			{@const _verdict = fit > 0 ? getVerdict({ locationIQ: liq, fitIQ: fit, visionIQ: vis }, _locSix) : null}
			{@const _killFlags = fit > 0 ? computeKillFactors(_locSix) : []}
			{@const docs = (loc.documents ?? []) as DocEntry[]}
			{@const tags = uniqueDocTags(docs)}
			{@const isStale = loc.scoredAt && (Date.now() - Number(loc.scoredAt)) > 7 * 24 * 3600 * 1000}

			<div class="loc-card" class:top-pick={li === 0 && fit >= 70} class:pinned-card={loc.pinned}>
				<!-- ── Card header ──────────────────────────────────────────── -->
				<div class="loc-card-hdr" class:starred-card-hdr={loc.starred} class:pinned-card-hdr={loc.pinned}>
					<div class="loc-rank" class:gold-rank={li === 0}>#{li + 1}</div>
					<div class="loc-addr-block">
						<div class="loc-addr-line">
							{shortAddr(loc.addr)}
							{#if loc.starred}<span class="starred-chip">⭐ Active</span>{/if}
							{#if loc.pinned}<span class="shortlisted-chip">📌 Shortlisted</span>{/if}
						</div>
						<div class="loc-addr-sub">
							{loc.addr.split(',').slice(1, 3).join(',').trim() || loc.addr}
						</div>
					</div>
						{#if fit > 0}
						<div class="loc-verdict-pill {verdictPillClass(fit)}">
							{verdictEmoji(fit)} {decision.headline}
						</div>
						<!-- Fix 5: Benchmark context -->
						<div class="loc-benchmark">{fit}/100 — {fitBenchmark(fit)}</div>
					{:else}
						<!-- 04.22.2026: Strict mode — legacy location without server fitScore -->
						<div class="loc-verdict-pill" style="background:#f1f5f9;color:#64748b;font-size:0.78rem;border:1px dashed #cbd5e1">
							Re-score needed
						</div>
						<div class="loc-benchmark" style="color:#94a3b8;font-size:0.72rem">Location IQ: {liq}/100 — Fit not yet computed</div>
					{/if}
					<!-- Document category tags -->
					<div class="loc-doc-tags">
						{#if tags.length > 0}
							{#each tags as tag}
								<span class="doc-tag" style={docTagStyle(tag)}>
									{docTagIcon(tag)} {docTagLabel(tag)}
								</span>
							{/each}
						{/if}
					</div>
					<!-- Fix 8: Only show CRM icons for 2+ locations -->
					<div class="hdr-icon-btns">
						{#if allLocations.length >= 2}
							<button class="icon-btn star-btn" class:active={loc.starred} type="button"
								title={loc.starred ? 'Remove star' : 'Star'}
								onclick={() => toggleStar(loc)}>
								{loc.starred ? '⭐' : '☆'}
							</button>
							<button class="icon-btn pin-btn-icon" class:active={loc.pinned} type="button"
								title={loc.pinned ? 'Unpin' : 'Shortlist'}
								onclick={() => togglePin(loc)}>
								{loc.pinned ? '📌' : '📍'}
							</button>
						{/if}
						<button class="icon-btn remove-btn" type="button"
							title="Remove from list"
							onclick={() => removeLocation(loc)}>
							×
						</button>
					</div>
				</div>

				<!-- ── Card body (Audit v2: scores elevated, slim card, progressive disclosure) ── -->
				<div class="loc-card-body">

					<!-- OSR-03: One verdict row replaces 3 ring badges -->
					<div class="loc-hero-row">
						<div class="loc-score-single">
							<span class="loc-score-num" style="color:{fitRingColor(fit)}">{fit > 0 ? fit : '—'}</span>
							<span class="loc-score-of">/100</span>
							{#if liq > 0}<span class="loc-sub-score">Loc {liq}</span>{/if}
							{#if vis > 0}<span class="loc-sub-score">Concept {vis}{visPrelim ? '✦' : ''}</span>{/if}
						</div>
						<div class="loc-hero-rec">
							<div class="loc-rec-text">
								{#if _verdict}
									{_verdict}
								{:else if decision.summary}
									{decision.summary}
								{:else}
									Complete your concept details to unlock the full analysis.
								{/if}
							</div>
							<!-- Fix 7+9: Flag chips with expandable mitigation -->
							{#if _killFlags.length > 0}
								<div class="loc-flag-chips">
									{#each _killFlags as kf}
										<details class="loc-flag-detail">
											<summary class="loc-flag-chip {kf.flag === 'kill' ? 'chip-kill' : 'chip-watch'}">
												{kf.label} ({kf.value}) — {kf.recommendation?.split('.')[0] || 'review before committing'}
											</summary>
											<div class="loc-flag-expand">
												{kf.recommendation || 'Check this metric before committing to a lease.'}
												<!-- D4: pass the per-card address -->
												<a href={loc?.addr ? `/app/location?addr=${encodeURIComponent(loc.addr)}` : '/app/location'} class="flag-expand-link">See full analysis →</a>
											</div>
										</details>
									{/each}
								</div>
							{/if}
						</div>
					</div>

					<!-- F-24: Kill factor summary chips (compact, non-expandable) -->
					{#if _killFlags.length > 0}
						<div class="loc-kill-chips">
							{#each _killFlags.slice(0, 3) as kf}
								<span class="loc-kill-chip {kf.flag === 'kill' ? 'chip-kill' : 'chip-watch'}">
									{kf.label} <span class="chip-score">{kf.value}</span>
								</span>
							{/each}
							{#if _killFlags.length > 3}
								<span class="loc-kill-chip chip-watch">+{_killFlags.length - 3} more</span>
							{/if}
						</div>
					{/if}

					<!-- Row 2: Status + primary CTA + text links (Fix 1+3+4) -->
					<div class="loc-action-row">
						<!-- Fix 4: Status line + action line separated -->
						<div class="loc-status-text">
							{#if loc.businessCase && !loc.businessCase.isPartialSeed}
								<div class="loc-fin-summary">
									{fmtMoney(loc.businessCase.revenueY1)} rev · {fmtMoney(loc.businessCase.profitY1)} profit · {loc.businessCase.breakEvenMonths ? `~${loc.businessCase.breakEvenMonths}mo break-even` : ''}
								</div>
							{:else}
								<div class="loc-scored-line">✓ Scored {timeAgo(loc.scoredAt)}</div>
								<div class="loc-next-line">
									{#if vis === 0}
										<strong>Next:</strong> Finish your concept profile to unlock the business case
									{:else}
										<strong>Next:</strong> <a href="/app/business-plan">See if the numbers work →</a>
									{/if}
								</div>
							{/if}
							{#if isStale}
								<span class="stale-badge">STALE</span>
							{/if}
						</div>
						<!-- Fix 3: ONE primary CTA only -->
						<div class="loc-primary-cta">
							{#if !loc.businessCase || loc.businessCase?.isPartialSeed}
								<a href="/app/business-plan" class="loc-btn-primary">
									Build Business Case →
								</a>
							{:else}
								<a href="/app/location?addr={encodeURIComponent(loc.addr)}" class="loc-btn-primary">
									See Full Analysis →
								</a>
							{/if}
						</div>
						<!-- Fix 1+A1: Text links row, not ghost buttons -->
						<div class="loc-text-links">
							<a href="/app/location?addr={encodeURIComponent(loc.addr)}">Analysis</a>
							<span class="loc-link-dot">·</span>
							<button type="button" onclick={() => exportFullBrief(loc)}>Export</button>
							<span class="loc-link-dot">·</span>
							<button type="button" onclick={() => openUploadDrawer(loc)}>Docs{#if docs.length > 0} ({docs.length}){/if}</button>
						</div>
					</div>

					<!-- Fix 5+8: Power-user features behind toggle (hidden for < 2 locations) -->
					{#if allLocations.length >= 2}
					<details class="loc-details">
						<summary class="loc-details-toggle">Show details</summary>
						<div class="loc-details-body">
							<!-- Pipeline status -->
							<div class="loc-detail-row">
								<select class="deal-status-inline"
									value={loc.dealStatus || 'watching'}
									onchange={(e) => updateStatus(loc, (e.target as HTMLSelectElement).value as DealStatus)}>
									{#each STATUS_ORDER as s}
									<option value={s}>{STATUS_LABELS[s]}</option>
									{/each}
								</select>
								<button class="icon-btn star-btn" class:active={loc.starred} type="button"
									onclick={() => toggleStar(loc)}>
									{loc.starred ? '⭐' : '☆'}
								</button>
								<button class="icon-btn pin-btn-icon" class:active={loc.pinned} type="button"
									onclick={() => togglePin(loc)}>
									{loc.pinned ? '📌' : '📍'}
								</button>
							</div>
							<!-- Note -->
							<textarea
								class="loc-note-input"
								rows="2"
								placeholder="Add a note about this location…"
								value={loc.dealNote || ''}
								onblur={(e) => onNoteBlur(loc, (e.target as HTMLTextAreaElement).value)}
							></textarea>
							<!-- Fix 2: Plain English upload prompt -->
							{#if docs.length === 0}
								<button class="doc-nudge-inline" type="button" onclick={() => openUploadDrawer(loc)}>
									Have a lease or floor plan? Upload for a deeper analysis.
								</button>
							{/if}
						</div>
					</details>
					{/if}
				</div>
				<!-- /card body -->
			</div>
			<!-- /loc-card -->
			{/if}
			<!-- /D1 guard -->
		{/each}
	{/each}

</div>
<!-- /dash-page -->

<!-- ══ UPLOAD DRAWER ══════════════════════════════════════════════════════ -->
{#if uploadDrawerOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="upload-overlay" onclick={closeUploadDrawer}></div>
	<div class="upload-drawer" role="dialog" aria-label="Upload documents">
		<div class="upload-drawer-hdr">
			<div>
				<div class="upload-drawer-title">Upload Documents</div>
				{#if uploadDrawerLoc}
					<div class="upload-drawer-sub">{shortAddr(uploadDrawerLoc.addr)}</div>
				{/if}
			</div>
			<button class="upload-drawer-close" type="button" onclick={closeUploadDrawer}>✕</button>
		</div>

		<!-- Tag selector -->
		<div class="upload-tag-section">
			<div class="upload-tag-label">Select category</div>
			<div class="upload-tag-row">
				{#each DOC_TAGS as t}
					<button
						class="upload-tag-btn"
						class:selected={uploadTag === t.key}
						style={uploadTag === t.key ? t.style : ''}
						type="button"
						onclick={() => uploadTag = t.key}
					>
						{t.icon} {t.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Drop zone / file input -->
		<label class="upload-dropzone">
			<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" onchange={handleFileSelect} style="display:none"/>
			<div class="upload-dropzone-icon">📁</div>
			<div class="upload-dropzone-text">Click to select files</div>
			<div class="upload-dropzone-sub">PDF, images, Word, Excel · Tagged as <strong>{DOC_TAGS.find(t => t.key === uploadTag)?.label}</strong></div>
		</label>

		<!-- Existing docs for this location -->
		{#if uploadDrawerLoc}
			{@const locDocs = (allLocations.find((l: any) => l.addr === uploadDrawerLoc.addr)?.documents ?? []) as DocEntry[]}
			{#if locDocs.length > 0}
				<div class="upload-file-list">
					<div class="upload-file-list-label">Uploaded ({locDocs.length})</div>
					{#each locDocs as doc}
						<div class="upload-file-row">
							<span class="upload-file-tag" style={docTagStyle(doc.tag)}>{docTagIcon(doc.tag)}</span>
							<span class="upload-file-name">{doc.name}</span>
							<span class="upload-file-date">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
						</div>
					{/each}
				</div>
			{:else}
				<div class="upload-empty">No documents uploaded yet.</div>
			{/if}
		{/if}
	</div>
{/if}

<style>
	/* ── Layout ─────────────────────────────────────────────────────────── */
	.dash-page {
		max-width: 1080px;
		margin: 0 auto;
		padding: 32px 24px 80px;
		font-family: 'Inter', sans-serif;
		color: #111827;
	}

	/* ── Page header ─────────────────────────────────────────────────────── */
	.page-hdr {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 28px;
		gap: 20px;
	}
	.page-greeting {
		font-family: 'Playfair Display', serif;
		font-size: 28px;
		font-weight: 700;
		color: #111827;
		line-height: 1.2;
		margin-bottom: 5px;
	}
	.page-greeting em { font-style: italic; font-weight: 400; color: #4a7c5c; }
	.page-sub { font-size: 14px; color: #4b5563; }
	.page-hdr-actions { flex-shrink: 0; }
	.btn-primary {
		display: inline-block;
		padding: 9px 20px;
		border-radius: 9px;
		background: #1e3a2a;
		color: #fff;
		font-size: 14px;
		font-weight: 700;
		border: none;
		cursor: pointer;
		text-decoration: none;
		white-space: nowrap;
		transition: background 0.15s;
	}
	.btn-primary:hover { background: #15803d; }

	/* ── Summary strip (5B) ──────────────────────────────────────────────── */
	.sum-ring-row { display: flex; align-items: center; gap: 12px; }
	.sum-ring-wrap { position: relative; flex-shrink: 0; }
	.sum-ring { flex-shrink: 0; }
	.sum-grade-badge {
		position: absolute;
		top: -4px;
		right: -6px;
		min-width: 22px;
		height: 22px;
		padding: 0 5px;
		border-radius: 50%;
		background: #1a3a2a;
		color: white;
		font-family: 'DM Serif Display', serif;
		font-size: 13px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 6px rgba(0,0,0,0.2);
		border: 2px solid white;
	}
	.sum-ring-info { min-width: 0; }
	.sum-ring-tier {
		display: inline-block;
		font-size: 11px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 12px;
		margin-bottom: 3px;
	}
	.sum-meaning {
		font-size: 11px;
		color: #4b5563;
		line-height: 1.4;
		margin-top: 4px;
		max-width: 220px;
	}
	.sum-card-locked {
		border-style: dashed;
		border-color: #d1d5db;
		background: #fafaf8;
	}
	.sum-unlock-teaser {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: #6b7280;
		line-height: 1.5;
		margin-top: 4px;
	}
	.sum-lock-icon { font-size: 16px; flex-shrink: 0; }
	.sum-card-next {
		border-color: #86efac;
		background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
	}
	.sum-next-link {
		display: block;
		font-size: 14px;
		font-weight: 700;
		color: #15803d;
		text-decoration: none;
		margin-top: 8px;
		line-height: 1.4;
	}
	.sum-next-link:hover { text-decoration: underline; }

	/* Brain strip (5C) */
	/* Compact brain strip — audit: reclaim vertical space */
	.brain-strip { display: flex; gap: 14px; margin-bottom: 16px; align-items: stretch; }
	.brain-headline { flex: 1; background: #1e3a2a; border-radius: 10px; padding: 12px 18px; }
	.brain-hl-text { font-size: 14px; font-weight: 600; color: #fff; letter-spacing: -0.2px; line-height: 1.4; }

	/* 5C: Progress stepper */
	/* Fix 6: Compact inline progress dots */
	.brain-stepper-inline {
		display: flex;
		align-items: center;
		gap: 0;
		margin-top: 8px;
	}
	.bsi-dot {
		width: 18px; height: 18px; border-radius: 50%;
		display: inline-flex; align-items: center; justify-content: center;
		font-size: 9px; font-weight: 800;
		background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.4);
		flex-shrink: 0;
	}
	.bsi-dot.done { background: #22c55e; color: #fff; }
	.bsi-line { width: 14px; height: 2px; background: rgba(255,255,255,0.12); margin: 0 3px; flex-shrink: 0; }
	.bsi-line.done { background: #22c55e; }
	.brain-next-cta {
		display: inline-block;
		margin-top: 8px;
		padding: 6px 14px;
		font-size: 12px;
		font-weight: 700;
		color: #1e3a2a;
		background: #fff;
		border-radius: 8px;
		text-decoration: none;
		box-shadow: 0 1px 4px rgba(0,0,0,0.15);
		transition: background 0.15s;
	}
	.brain-next-cta:hover { background: #f0fdf4; }

	/* Brain insight (5D) */
	.brain-insight { flex: 0 0 340px; border-radius: 12px; padding: 16px 18px; border-left: 4px solid; }
	.brain-insight--green { background: #f0fdf4; border-color: #22c55e; }
	.brain-insight--amber { background: #fffbeb; border-color: #f59e0b; }
	.brain-insight--red     { background: #fff5f5; border-color: #ef4444; }
	.brain-insight--neutral { background: #f9f7f4; border-color: #e8e2d8; }
	.brain-insight-eyebrow { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: #9ca3af; margin-bottom: 6px; }
	.brain-insight-text { font-size: 12px; line-height: 1.6; color: #1e3a2a; font-weight: 500; }
	.brain-insight-action { font-size: 11px; line-height: 1.5; color: #4b5563; margin-top: 8px; font-style: italic; }
	.brain-insight-cta { display: inline-block; margin-top: 8px; font-size: 12px; font-weight: 700; color: #1e3a2a; text-decoration: none; border-bottom: 1px solid #1e3a2a; }
	.brain-insight-cta:hover { opacity: 0.75; }

	/* ── Launch Checklist CTA ─────────────────────────────────────────── */
	.checklist-cta {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px 22px;
		margin-bottom: 24px;
		background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0faf4 100%);
		border: 1px solid #bbf7d0;
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.2s, box-shadow 0.2s;
		cursor: pointer;
	}
	.checklist-cta:hover {
		border-color: #86efac;
		box-shadow: 0 2px 12px rgba(34, 197, 94, 0.12);
	}
	.checklist-cta-icon {
		font-size: 24px;
		flex-shrink: 0;
	}
	.checklist-cta-body {
		flex: 1;
		min-width: 0;
	}
	.checklist-cta-title {
		font-size: 14px;
		font-weight: 700;
		color: #1e3a2a;
		letter-spacing: -0.2px;
	}
	.checklist-cta-sub {
		font-size: 12px;
		color: #4b5563;
		margin-top: 2px;
	}
	.checklist-cta-progress {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-shrink: 0;
	}
	.checklist-cta-ring {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.checklist-cta-pct {
		position: absolute;
		font-size: 10px;
		font-weight: 800;
		color: #15803d;
	}
	.checklist-cta-arrow {
		font-size: 18px;
		font-weight: 700;
		color: #22c55e;
		transition: transform 0.15s;
	}
	.checklist-cta:hover .checklist-cta-arrow {
		transform: translateX(3px);
	}
	@media (max-width: 768px) {
		.checklist-cta { padding: 12px 16px; }
		.checklist-cta-ring { display: none; }
	}

	/* UX-FIX-01: Mapper fix banner */
	.mapper-banner { display: flex; align-items: center; gap: 14px; padding: 12px 20px; background: #E8F5E9; border-bottom: 1px solid #c8e6c9; font-size: 13px; color: #1b5e20; }
	.mapper-banner-text { flex: 1; line-height: 1.5; }
	.mapper-banner-dismiss { flex-shrink: 0; background: none; border: none; font-size: 16px; color: #4caf50; cursor: pointer; padding: 2px 6px; border-radius: 4px; }
	.mapper-banner-dismiss:hover { background: rgba(0,0,0,0.06); }

	.summary-strip {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
		margin-bottom: 32px;
	}
	.sum-card {
		background: #fff;
		border-radius: 12px;
		border: 1px solid #e5e7eb;
		padding: 16px 18px;
	}
	.sum-card.highlight { border-color: #86efac; background: #f0fdf4; }
	.sum-label {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		color: #9ca3af;
		margin-bottom: 8px;
	}
	.sum-val {
		font-size: 26px;
		font-weight: 900;
		color: #111827;
		line-height: 1;
		margin-bottom: 4px;
	}
	.sum-val.green { color: #15803d; }
	.sum-val.gold  { color: #d97706; }
	.sum-val.muted { color: #6b7280; font-size: 22px; font-weight: 700; }  /* Fix 8: rough estimate */
	.sum-sub { font-size: 12px; color: #9ca3af; }
	.sum-refine-link { color: #1e3a2a; font-weight: 600; text-decoration: none; border-bottom: 1px solid #1e3a2a; }
	.sum-refine-link:hover { opacity: 0.75; }

	/* ── Section header ─────────────────────────────────────────────────── */
	.section-hdr {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 14px;
		margin-top: 36px;
	}
	.section-hdr-first { margin-top: 0; }
	.section-badge {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 1px;
		text-transform: uppercase;
		padding: 3px 10px;
		border-radius: 20px;
		color: #fff;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.section-count { font-size: 13px; color: #9ca3af; font-weight: 500; white-space: nowrap; }
	.section-line { flex: 1; height: 1px; background: #e5e7eb; }
	.section-add {
		font-size: 12px;
		font-weight: 600;
		color: #15803d;
		cursor: pointer;
		white-space: nowrap;
		text-decoration: none;
	}
	.section-add:hover { text-decoration: underline; }

	/* ── Location card ──────────────────────────────────────────────────── */
	.loc-card {
		background: #fff;
		border-radius: 14px;
		border: 1px solid #e5e7eb;
		margin-bottom: 12px;
		overflow: hidden;
		transition: box-shadow 0.15s;
	}
	.loc-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.07); }
	.loc-card.top-pick { border-color: #86efac; }

	/* Card header */
	.loc-card-hdr {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 20px 12px;
		border-bottom: 1px solid #f3f3f0;
		flex-wrap: wrap;
	}
	.loc-rank { font-size: 11px; font-weight: 800; color: #9ca3af; width: 24px; flex-shrink: 0; }
	.loc-rank.gold-rank { color: #d97706; }
	.loc-addr-block { flex: 1; min-width: 0; }
	.loc-addr-line {
		font-size: 16px;
		font-weight: 700;
		color: #111827;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.loc-addr-sub { font-size: 12px; color: #9ca3af; margin-top: 2px; }
	.loc-verdict-pill {
		font-size: 11px;
		font-weight: 700;
		padding: 3px 10px;
		border-radius: 20px;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.pill-green  { background: #dcfce7; color: #15803d; }
	.pill-viable { background: #e8edf2; color: #374151; }  /* Fix 5: blue-gray, not amber */
	.pill-amber  { background: #fef3c7; color: #92400e; }
	.pill-red    { background: #fee2e2; color: #991b1b; }
	.loc-benchmark { font-size: 11px; color: #6b7280; font-weight: 500; margin-top: 2px; }

	/* Doc tags in header */
	.loc-doc-tags { display: flex; gap: 5px; flex-wrap: wrap; flex-shrink: 0; }
	.doc-tag {
		font-size: 10px;
		font-weight: 700;
		padding: 2px 7px;
		border-radius: 10px;
		letter-spacing: 0.3px;
		border: 1px solid transparent;
	}
	.doc-tag-none { font-size: 11px; color: #9ca3af; font-weight: 500; }

	/* Card body — Audit v2: scores elevated, slim, progressive disclosure */
	.loc-card-body {
		display: flex;
		flex-direction: column;
	}

	/* Hero row: elevated scores + recommendation side by side */
	.loc-hero-row {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		padding: 16px 20px;
		border-bottom: 1px solid #f3f3f0;
	}
	.loc-hero-rec {
		flex: 1;
		min-width: 0;
	}
	.loc-hero-rec .loc-rec-text {
		font-size: 13px;
		color: #1e3a2a;
		font-weight: 500;
		line-height: 1.5;
	}
	/* Fix 7+9: Flag chips with expandable mitigation */
	.loc-flag-chips {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 8px;
	}
	.loc-flag-detail {
		border-radius: 6px;
		overflow: hidden;
	}
	.loc-flag-chip {
		font-size: 11px;
		font-weight: 500;
		padding: 3px 8px;
		border-radius: 6px;
		line-height: 1.4;
		cursor: pointer;
		list-style: none;
		transition: background 0.15s;
	}
	.loc-flag-chip::-webkit-details-marker { display: none; }
	.loc-flag-chip::marker { content: ''; }
	.loc-flag-chip:hover { filter: brightness(0.96); }
	.loc-flag-chip.chip-kill { background: #fef3c7; color: #92400e; }
	.loc-flag-chip.chip-watch { background: #f0f4f1; color: #4b5563; }
	.loc-flag-expand {
		font-size: 12px;
		color: #4b5563;
		line-height: 1.5;
		padding: 6px 10px 8px;
		background: #fafaf9;
		border-top: 1px solid rgba(0,0,0,0.05);
	}
	.flag-expand-link {
		display: inline-block;
		margin-top: 4px;
		font-size: 11px;
		font-weight: 600;
		color: #15803d;
		text-decoration: none;
	}
	.flag-expand-link:hover { text-decoration: underline; }

	/* Action row: status text + primary CTA + text links */
	.loc-action-row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 20px;
		border-bottom: 1px solid #f3f3f0;
	}
	.loc-status-text {
		flex: 1;
		min-width: 0;
	}
	.loc-scored-line { font-size: 12px; color: #9ca3af; }
	.loc-next-line { font-size: 13px; color: #111827; margin-top: 2px; }
	.loc-next-line a { color: #15803d; text-decoration: none; font-weight: 600; }
	.loc-next-line a:hover { text-decoration: underline; }
	.loc-fin-summary { font-size: 13px; color: #111827; font-weight: 500; }
	.loc-primary-cta { flex-shrink: 0; }

	/* Fix 1+A1: Text links, not ghost buttons */
	.loc-text-links {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.loc-text-links a, .loc-text-links button {
		font-size: 12px;
		font-weight: 500;
		color: #6b7280;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-decoration: none;
	}
	.loc-text-links a:hover, .loc-text-links button:hover { color: #111827; text-decoration: underline; }
	.loc-link-dot { font-size: 10px; color: #d1d5db; }

	/* Fix 5+8: Progressive disclosure details toggle */
	.loc-details { border-bottom: 1px solid #f3f3f0; }
	.loc-details-toggle {
		display: block;
		padding: 8px 20px;
		font-size: 12px;
		font-weight: 600;
		color: #9ca3af;
		cursor: pointer;
		user-select: none;
		list-style: none;
	}
	.loc-details-toggle::-webkit-details-marker { display: none; }
	.loc-details-toggle::before { content: '▸ '; }
	.loc-details[open] .loc-details-toggle::before { content: '▾ '; }
	.loc-details-body {
		padding: 0 20px 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.loc-detail-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.deal-status-inline {
		font-size: 12px;
		padding: 3px 8px;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		background: #fff;
		color: #4b5563;
		cursor: pointer;
	}

	/* OSR-03: Single verdict score replaces 3 ring badges */
	.loc-score-single {
		display: flex;
		align-items: baseline;
		gap: 4px;
		flex-shrink: 0;
	}
	.loc-score-num {
		font-size: 28px;
		font-weight: 800;
		line-height: 1;
	}
	.loc-score-of {
		font-size: 13px;
		font-weight: 600;
		color: #9ca3af;
	}
	.loc-sub-score {
		font-size: 10.5px;
		font-weight: 600;
		color: #9ca3af;
		padding: 2px 6px;
		background: #f3f4f6;
		border-radius: 4px;
		margin-left: 4px;
		white-space: nowrap;
	}

	/* ── Primary CTA button (5F) ───────────────────────────────────────── */
	.loc-btn-primary {
		display: block;
		width: 100%;
		padding: 10px 16px;
		background: #1e3a2a;
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		text-align: center;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		text-decoration: none;
		margin-bottom: 6px;
		transition: background 0.15s;
	}
	.loc-btn-primary:hover { background: #15803d; }
	.loc-btn-secondary {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 5px 10px;
		font-size: 11px;
		font-weight: 600;
		color: #4b5563;
		background: none;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		cursor: pointer;
		text-decoration: none;
		transition: border-color 0.15s;
	}
	.loc-btn-secondary:hover { border-color: #9ca3af; }

	/* ── Compact score chip (UXFIX-01) — kept for backward compat ───── */
	.score-chip-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}
	.score-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: #f0f4f1;
		border: 1px solid #d1e0d5;
		border-radius: 20px;
		padding: 6px 12px;
		font-size: 13px;
		font-weight: 600;
		color: #1e3a2a;
		white-space: nowrap;
	}
	.score-chip-seg {
		display: inline-flex;
		align-items: baseline;
		gap: 3px;
	}
	.score-chip-label {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #6b7280;
	}
	.score-chip-val {
		font-size: 15px;
		font-weight: 800;
		color: #1e3a2a;
		line-height: 1;
	}
	.score-chip-seg--fit .score-chip-val { font-size: 17px; }
	.score-chip-dot { color: #c9d8cc; font-size: 14px; }
	.score-chip-expand { font-size: 10px; color: #9ca3af; margin-left: 2px; }
	.stale-badge {
		display: inline-block;
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #9ca3af;
		background: #e5e7eb;
		padding: 2px 6px;
		border-radius: 4px;
		margin-left: 4px;
	}
	.ring-wrap-sm, .ring-wrap-lg {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}
	.ring-wrap-sm svg, .ring-wrap-lg svg { display: block; }
	.ring-lbl {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		color: #9ca3af;
		text-align: center;
		white-space: nowrap;
	}
	.ring-tier {
		font-size: 9px;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 8px;
		text-align: center;
		white-space: nowrap;
	}
	.ring-num-sm {
		font-family: 'Inter', sans-serif;
		font-size: 14px;
		font-weight: 900;
	}
	.ring-num-lg {
		font-family: 'Inter', sans-serif;
		font-size: 22px;
		font-weight: 900;
	}
	.ring-divider {
		width: 1px;
		height: 48px;
		background: #f3f3f0;
		flex-shrink: 0;
		align-self: center;
	}

	/* ── Financials panel ────────────────────────────────────────────────── */
	.loc-financials {
		padding: 14px 20px;
		border-right: 1px solid #f3f3f0;
	}
	.loc-fin-label {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: #9ca3af;
		margin-bottom: 10px;
	}
	.loc-fin-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 5px;
	}
	.loc-fin-key { font-size: 12px; color: #4b5563; }
	.loc-fin-val { font-size: 13px; font-weight: 700; color: #111827; }
	.loc-fin-val.green { color: #15803d; }
	.loc-fin-val.red   { color: #dc2626; }
	.loc-fin-note {
		font-size: 11px;
		color: #9ca3af;
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px solid #f3f3f0;
		font-style: italic;
	}
	.loc-fin-empty {
		padding: 14px 20px;
		border-right: 1px solid #f3f3f0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 6px;
	}
	.loc-fin-empty-text { font-size: 12px; color: #9ca3af; line-height: 1.5; }
	.loc-fin-empty-cta {
		font-size: 12px;
		font-weight: 600;
		color: #15803d;
		text-decoration: none;
	}
	.loc-fin-empty-cta:hover { text-decoration: underline; }

	/* ── Recommendation ─────────────────────────────────────────────────── */
	.loc-recommendation {
		padding: 14px 20px;
		border-right: 1px solid #f3f3f0;
	}
	.loc-rec-label {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: #9ca3af;
		margin-bottom: 8px;
	}
	.loc-rec-text { font-size: 13px; color: #4b5563; line-height: 1.55; }
	/* F-24: Kill factor chips on Dashboard shortlist cards */
	.loc-kill-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
	.loc-kill-chip {
		display: inline-flex; align-items: center; gap: 4px;
		padding: 3px 8px; border-radius: 20px;
		font-size: 10.5px; font-weight: 600; cursor: default;
		white-space: nowrap;
	}
	.chip-kill { background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.25); color: #dc2626; }
	.chip-watch { background: rgba(217,119,6,0.08); border: 1px solid rgba(217,119,6,0.25); color: #d97706; }
	.chip-score { font-size: 9.5px; font-weight: 700; opacity: 0.75; }

	/* ── Document nudge ──────────────────────────────────────────────────── */
	.doc-nudge {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0 14px 10px;
		padding: 10px 14px;
		background: #f0fdf4;
		border: 1px dashed #86efac;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.15s;
	}
	.doc-nudge:hover { background: #dcfce7; border-color: #4ade80; }
	.doc-nudge-icon { font-size: 18px; flex-shrink: 0; }
	.doc-nudge-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.doc-nudge-text strong { font-size: 12px; color: #15803d; font-weight: 700; }
	.doc-nudge-text span { font-size: 11px; color: #4b7c5c; line-height: 1.4; }
	.doc-nudge-cta {
		font-size: 11px;
		font-weight: 700;
		color: #15803d;
		white-space: nowrap;
		flex-shrink: 0;
	}

	/* ── Doc nudge inline ───────────────────────────────────────────────── */
	.doc-nudge-inline {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 10px;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 11.5px;
		font-weight: 500;
		color: #4a7c5c;
		text-align: left;
		transition: color 0.15s;
		line-height: 1.3;
	}
	.doc-nudge-inline:hover { color: #1e3a2a; }
	.doc-nudge-inline-icon { font-size: 13px; flex-shrink: 0; }
	.doc-nudge-inline-arrow {
		font-size: 12px;
		opacity: 0.6;
		margin-left: auto;
		flex-shrink: 0;
		transition: opacity 0.15s, transform 0.15s;
	}
	.doc-nudge-inline:hover .doc-nudge-inline-arrow { opacity: 1; transform: translateX(2px); }

	/* ── Actions column ──────────────────────────────────────────────────── */
	.loc-actions {
		padding: 14px 14px;
		display: flex;
		flex-direction: column;
		gap: 7px;
		justify-content: center;
		min-width: 148px;
		flex-shrink: 0;
	}
	.loc-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 7px 11px;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 600;
		border: 1.5px solid #e5e7eb;
		background: #fff;
		color: #111827;
		cursor: pointer;
		text-decoration: none;
		white-space: nowrap;
		transition: all 0.12s;
	}
	.loc-btn:hover { border-color: #4a7c5c; color: #1e3a2a; background: #f9fafb; }
	.loc-btn.primary { background: #1e3a2a; color: #fff; border-color: #1e3a2a; }
	.loc-btn.primary:hover { background: #15803d; border-color: #15803d; }

	/* ── Upload drawer ───────────────────────────────────────────────────── */
	.upload-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.35);
		z-index: 200;
	}
	.upload-drawer {
		position: fixed;
		top: 0;
		right: 0;
		width: 380px;
		height: 100vh;
		background: #fff;
		z-index: 201;
		box-shadow: -4px 0 32px rgba(0,0,0,0.12);
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}
	.upload-drawer-hdr {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 24px 24px 16px;
		border-bottom: 1px solid #f3f4f6;
		flex-shrink: 0;
	}
	.upload-drawer-title { font-size: 17px; font-weight: 800; color: #111827; }
	.upload-drawer-sub { font-size: 12px; color: #9ca3af; margin-top: 3px; }
	.upload-drawer-close {
		background: none;
		border: none;
		font-size: 18px;
		color: #9ca3af;
		cursor: pointer;
		padding: 0 4px;
		line-height: 1;
	}
	.upload-drawer-close:hover { color: #111827; }

	/* Tag selector */
	.upload-tag-section { padding: 16px 24px; border-bottom: 1px solid #f3f4f6; flex-shrink: 0; }
	.upload-tag-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 10px; }
	.upload-tag-row { display: flex; gap: 8px; flex-wrap: wrap; }
	.upload-tag-btn {
		font-size: 12px;
		font-weight: 600;
		padding: 5px 12px;
		border-radius: 20px;
		border: 1.5px solid #e5e7eb;
		background: #fff;
		color: #4b5563;
		cursor: pointer;
		transition: all 0.12s;
	}
	.upload-tag-btn:hover { border-color: #9ca3af; }
	.upload-tag-btn.selected { font-weight: 700; }

	/* Drop zone */
	.upload-dropzone {
		margin: 16px 24px;
		border: 2px dashed #d1d5db;
		border-radius: 12px;
		padding: 28px 20px;
		text-align: center;
		cursor: pointer;
		transition: border-color 0.15s;
		flex-shrink: 0;
	}
	.upload-dropzone:hover { border-color: #4a7c5c; }
	.upload-dropzone-icon { font-size: 28px; margin-bottom: 8px; }
	.upload-dropzone-text { font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 4px; }
	.upload-dropzone-sub { font-size: 12px; color: #9ca3af; line-height: 1.5; }

	/* Uploaded file list */
	.upload-file-list { padding: 0 24px 24px; }
	.upload-file-list-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: #9ca3af;
		margin-bottom: 10px;
	}
	.upload-file-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 0;
		border-bottom: 1px solid #f3f4f6;
		font-size: 13px;
	}
	.upload-file-tag { font-size: 14px; }
	.upload-file-name { flex: 1; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.upload-file-date { font-size: 11px; color: #9ca3af; flex-shrink: 0; }
	.upload-empty { padding: 16px 24px; font-size: 13px; color: #9ca3af; }

	/* ── Responsive: collapse card body columns at narrow widths ─────────── */
	/* ── Filter / Sort bar ───────────────────────────────────────────────── */
	.filter-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 24px;
		flex-wrap: wrap;
	}
	.filter-tabs {
		display: flex;
		gap: 4px;
		background: #f3f4f6;
		border-radius: 10px;
		padding: 3px;
	}
	.filter-tab {
		font-size: 13px;
		font-weight: 600;
		padding: 6px 16px;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: #6b7280;
		cursor: pointer;
		transition: all 0.12s;
		white-space: nowrap;
	}
	.filter-tab:hover { color: #111827; }
	.filter-tab.active {
		background: #fff;
		color: #111827;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
	}
	.filter-tab-compare {
		margin-left: 4px;
		border-left: 1px solid #e5e7eb;
		padding-left: 14px;
	}
	.filter-tab-compare.active {
		background: #1e3a2a;
		color: #fff;
		box-shadow: 0 1px 3px rgba(30, 58, 42, 0.25);
	}
	.filter-tab-compare:hover:not(.active) { color: #1e3a2a; }
	.sort-group {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.sort-label {
		font-size: 11px;
		font-weight: 600;
		color: #9ca3af;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		margin-right: 4px;
	}
	.sort-btn {
		font-size: 12px;
		font-weight: 600;
		padding: 4px 12px;
		border-radius: 16px;
		border: 1.5px solid #e5e7eb;
		background: #fff;
		color: #6b7280;
		cursor: pointer;
		transition: all 0.12s;
		white-space: nowrap;
	}
	.sort-btn:hover { border-color: #9ca3af; color: #111827; }
	.sort-btn.active {
		background: #1e3a2a;
		color: #fff;
		border-color: #1e3a2a;
	}

	/* ── Header icon buttons (star + shortlist) ─────────────────────────── */
	.hdr-icon-btns {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
		align-items: center;
	}
	.icon-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 1.5px solid #e5e7eb;
		background: #f9fafb;
		font-size: 15px;
		cursor: pointer;
		transition: all 0.15s;
		flex-shrink: 0;
		font-family: inherit;
		line-height: 1;
	}
	.icon-btn:hover { background: #f3f4f6; border-color: #9ca3af; }
	.star-btn.active { background: #fef9c3; border-color: #fbbf24; }
	.star-btn:hover  { background: #fef9c3; border-color: #fbbf24; }
	.pin-btn-icon.active { background: #fef3c7; border-color: #f59e0b; }
	.pin-btn-icon:hover  { background: #fef3c7; border-color: #f59e0b; }
	.remove-btn {
		color: #9ca3af;
		font-size: 18px;
		font-weight: 400;
	}
	.remove-btn:hover { background: #fee2e2; border-color: #fca5a5; color: #dc2626; }

	/* Deal status chip */
	.deal-status-chip {
		appearance: none;
		-webkit-appearance: none;
		height: 28px;
		padding: 0 10px 0 8px;
		border-radius: 20px;
		border: 1.5px solid #e5e7eb;
		background: #f9fafb;
		font-family: 'DM Sans', sans-serif;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		color: #374151;
		white-space: nowrap;
	}
	.deal-status-chip--watching     { background: #f0f9ff; color: #0369a1; border-color: #bae6fd; }
	.deal-status-chip--touring      { background: #fef3c7; color: #92400e; border-color: #fde68a; }
	.deal-status-chip--negotiating  { background: #f5f3ff; color: #6d28d9; border-color: #ddd6fe; }
	.deal-status-chip--signed       { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
	.deal-status-chip--passed       { background: #f3f4f6; color: #6b7280; border-color: #d1d5db; }
	.deal-status-chip--lost         { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }

	/* Inline note */
	.loc-note-wrap { margin-top: 6px; }
	.loc-note-input {
		width: 100%;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 6px 10px;
		font-family: 'DM Sans', sans-serif;
		font-size: 12px;
		color: #374151;
		background: #fafafa;
		resize: vertical;
		min-height: 42px;
	}
	.loc-note-input:focus {
		outline: none;
		border-color: #1e3a2a;
		background: #fff;
	}
	.loc-note-input::placeholder { color: #d1d5db; }

	/* Card border states */
	.loc-card.pinned-card { border: 2px solid #f59e0b; background: #fffdf5; }
	.loc-card-hdr.starred-card-hdr { background: #fefce8; }
	.loc-card-hdr.pinned-card-hdr  { background: #fffbeb; }

	/* Status chips in address line */
	.starred-chip {
		display: inline-block;
		margin-left: 8px;
		padding: 1px 7px;
		border-radius: 10px;
		font-size: 10px;
		font-weight: 700;
		background: #fef9c3;
		color: #a16207;
		border: 1px solid #fbbf24;
		vertical-align: middle;
	}
	.shortlisted-chip {
		display: inline-block;
		margin-left: 6px;
		padding: 1px 7px;
		border-radius: 10px;
		font-size: 10px;
		font-weight: 700;
		background: #fef3c7;
		color: #92400e;
		border: 1px solid #fcd34d;
		vertical-align: middle;
	}

	/* ── Empty shortlist state ────────────────────────────────────────────── */
	.empty-shortlist {
		text-align: center;
		padding: 48px 24px;
		background: #fefce8;
		border: 1px dashed #fbbf24;
		border-radius: 14px;
		margin-bottom: 24px;
	}
	.empty-shortlist-icon { font-size: 32px; margin-bottom: 12px; }
	.empty-shortlist-title { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 6px; }
	.empty-shortlist-text { font-size: 13px; color: #6b7280; max-width: 380px; margin: 0 auto 16px; line-height: 1.5; }
	.empty-shortlist-btn {
		font-size: 13px;
		font-weight: 600;
		padding: 7px 18px;
		border-radius: 8px;
		border: 1.5px solid #e5e7eb;
		background: #fff;
		color: #111827;
		cursor: pointer;
	}
	.empty-shortlist-btn:hover { border-color: #4a7c5c; color: #1e3a2a; }

	@media (max-width: 860px) {
		.loc-card-body {
			grid-template-columns: 1fr;
		}
		.loc-scores {
			grid-column: 1 / -1;
			border-right: none;
			border-bottom: 1px solid #f3f3f0;
		}
		.loc-intel {
			grid-column: 1 / -1;
			border-right: none;
			border-bottom: 1px solid #f3f3f0;
		}
		.loc-actions {
			grid-column: 1 / -1;
			flex-direction: row;
			flex-wrap: wrap;
			min-width: 0;
		}
		.summary-strip { grid-template-columns: repeat(2, 1fr); }
		.upload-drawer { width: 100vw; }
		.filter-bar { flex-direction: column; align-items: flex-start; }
	}
	/* ── Mobile: score chip + meta-line (390px) ── */
	@media (max-width: 480px) {
		.score-chip { flex-wrap: wrap; gap: 4px; }
		.score-chip-val { font-size: 14px; }
		.score-chip-seg--fit .score-chip-val { font-size: 15px; }
		.score-chip-wrap { align-items: flex-start; }
	}

	/* UXFIX-05: Block label badge inside Loc chip */
	.score-chip-block-label {
		display: block;
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #4a7c5c;
		margin-top: 1px;
		white-space: nowrap;
	}

	/* ══ BR-10: SHORTLIST COMPARE PANEL ════════════════════════════════════ */
	.cmp-panel {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 14px;
		padding: 20px 22px;
		margin: 0 0 28px;
		box-shadow: 0 2px 12px rgba(15, 23, 42, 0.05);
	}
	.cmp-hdr {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		padding-bottom: 14px;
		border-bottom: 1px solid #f1f5f9;
		margin-bottom: 16px;
	}
	.cmp-title {
		font-size: 16px;
		font-weight: 700;
		color: #0f172a;
		letter-spacing: -0.01em;
	}
	.cmp-sub {
		font-size: 12px;
		color: #64748b;
		margin-top: 3px;
		max-width: 560px;
		line-height: 1.4;
	}
	.cmp-close {
		background: transparent;
		border: 1px solid #e5e7eb;
		color: #6b7280;
		width: 28px;
		height: 28px;
		border-radius: 8px;
		font-size: 14px;
		cursor: pointer;
		flex: none;
		transition: all 0.12s;
	}
	.cmp-close:hover { background: #f3f4f6; color: #111827; }
	.cmp-narrative {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		margin: 0 0 14px;
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 10px;
		font-size: 13px;
		color: #14532d;
		line-height: 1.45;
	}
	.cmp-narrative-badge {
		display: inline-block;
		padding: 2px 8px;
		background: #1e3a2a;
		color: #fff;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		border-radius: 999px;
		flex: none;
	}
	.cmp-narrative-text {
		flex: 1;
	}
	.cmp-narrative-loading {
		background: #f8fafc;
		border-color: #e2e8f0;
		color: #64748b;
		font-style: italic;
	}
	.cmp-narrative-error {
		background: #fffbeb;
		border-color: #fde68a;
		color: #92400e;
		font-size: 12px;
	}
	.cmp-scroll {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		margin: 0 -6px;
		padding: 0 6px;
	}
	.cmp-grid {
		display: grid;
		row-gap: 0;
		column-gap: 0;
		min-width: 560px;
	}
	.cmp-cell {
		padding: 14px 14px;
		border-bottom: 1px solid #f1f5f9;
		font-size: 13px;
		color: #0f172a;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 4px;
		justify-content: flex-start;
	}
	.cmp-row-label {
		font-size: 11px;
		font-weight: 700;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.6px;
		background: #fafafa;
		border-right: 1px solid #f1f5f9;
		justify-content: center;
	}
	.cmp-row-hint {
		display: inline-block;
		margin-left: 6px;
		font-size: 9px;
		font-weight: 600;
		color: #9ca3af;
		letter-spacing: 0.8px;
	}
	.cmp-row-hdr {
		background: transparent;
		border-right: 1px solid transparent;
		border-bottom: 1px solid transparent;
	}
	.cmp-col-hdr {
		border-bottom: 2px solid #e5e7eb;
		padding-bottom: 12px;
	}
	.cmp-col-addr {
		font-size: 14px;
		font-weight: 700;
		color: #0f172a;
		line-height: 1.25;
	}
	.cmp-col-sub {
		font-size: 11px;
		color: #94a3b8;
		line-height: 1.3;
	}
	.cmp-verdict {
		gap: 6px;
	}
	.cmp-verdict-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.2px;
		width: fit-content;
		background: #f3f4f6;
		color: #374151;
	}
	.cmp-verdict-pill.pill-muted {
		background: #f3f4f6;
		color: #9ca3af;
	}
	.cmp-verdict-line {
		font-size: 12px;
		color: #475569;
		line-height: 1.4;
	}
	.cmp-metric {
		gap: 3px;
		justify-content: center;
	}
	.cmp-metric-primary .cmp-metric-val {
		font-size: 28px;
		font-weight: 800;
		color: #0f172a;
		letter-spacing: -0.02em;
		line-height: 1;
	}
	.cmp-metric-val {
		font-size: 18px;
		font-weight: 700;
		color: #0f172a;
		line-height: 1.1;
	}
	.cmp-metric-val.cmp-metric-sub {
		font-size: 16px;
		font-weight: 600;
		color: #475569;
	}
	.cmp-metric-max {
		font-size: 11px;
		font-weight: 500;
		color: #94a3b8;
		margin-left: 2px;
	}
	/* UX-07: Comparison tier pills (visionIQ) */
	.cmp-tier-pill {
		display: inline-block;
		font-size: 10px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 4px;
		margin-top: 2px;
	}
	.cmp-tier-green  { background: #dcfce7; color: #166534; }
	.cmp-tier-amber  { background: #fef3c7; color: #92400e; }
	.cmp-tier-red    { background: #fee2e2; color: #991b1b; }
	.cmp-tier-neutral { background: #e0f2fe; color: #0c4a6e; }
	.cmp-muted { color: #cbd5e1; }
	.cmp-metric-tier {
		font-size: 11px;
		color: #64748b;
		font-weight: 500;
	}
	.cmp-metric-muted { color: #9ca3af; font-style: italic; }
	.cmp-winner {
		background: linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 100%);
	}
	.cmp-best {
		position: absolute;
		top: 8px;
		right: 8px;
		display: inline-block;
		padding: 2px 8px;
		background: #1e3a2a;
		color: #fff;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		border-radius: 999px;
	}
	.cmp-kill { gap: 5px; }
	.cmp-kill-clean {
		font-size: 12px;
		color: #059669;
		font-weight: 600;
	}
	.cmp-kill-item {
		font-size: 11px;
		font-weight: 600;
		padding: 3px 8px;
		border-radius: 6px;
		line-height: 1.3;
		width: fit-content;
	}
	.cmp-kill-red {
		background: #fef2f2;
		color: #b91c1c;
		border: 1px solid #fecaca;
	}
	.cmp-kill-amber {
		background: #fffbeb;
		color: #b45309;
		border: 1px solid #fde68a;
	}
	.cmp-kill-more {
		font-size: 10px;
		color: #94a3b8;
		font-weight: 600;
	}
	.cmp-ts {
		font-size: 12px;
		color: #64748b;
		justify-content: center;
	}
	.cmp-cta-cell {
		padding: 12px 14px 14px;
		border-bottom: none;
		justify-content: center;
	}
	.cmp-cta {
		display: inline-flex;
		align-items: center;
		padding: 7px 12px;
		background: #1e3a2a;
		color: #fff;
		font-size: 12px;
		font-weight: 600;
		border-radius: 8px;
		text-decoration: none;
		width: fit-content;
		transition: background 0.12s;
	}
	.cmp-cta:hover { background: #152a1e; }
	.cmp-footer {
		margin-top: 14px;
		padding-top: 12px;
		border-top: 1px solid #f1f5f9;
	}
	.cmp-footer-hint {
		font-size: 11px;
		color: #94a3b8;
		font-style: italic;
	}

	/* UXFIX-11: 375px mobile viewport fixes */
	@media (max-width: 400px) {
		.dash-page { padding: 20px 16px 80px; }
		.page-hdr { flex-direction: column; gap: 10px; }
		.page-hdr-actions { align-self: flex-start; }
		.page-greeting { font-size: 22px; }
		.brain-strip { flex-direction: column; }
		.brain-insight { flex: none; width: 100%; }
		.summary-strip { grid-template-columns: 1fr 1fr; gap: 8px; }
		.sum-card { padding: 12px 14px; }
		.sum-val { font-size: 20px !important; }

		/* UX-C: compare panel at 375px — header stacks, narrative wraps,
		   grid stays horizontally scrollable via .cmp-scroll (min-width 560px) */
		.cmp-panel { padding: 16px 14px; margin: 0 0 20px; }
		.cmp-hdr { flex-direction: column; align-items: stretch; gap: 10px; padding-bottom: 12px; margin-bottom: 12px; }
		.cmp-close { align-self: flex-end; }
		.cmp-title { font-size: 15px; }
		.cmp-sub { font-size: 11px; max-width: none; }
		.cmp-narrative { flex-wrap: wrap; padding: 10px 12px; gap: 8px; }
		.cmp-narrative-text { flex: 1 1 100%; }
	}
</style>
