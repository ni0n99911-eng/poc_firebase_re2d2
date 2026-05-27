<script lang="ts">
	import { onMount, tick, untrack } from "svelte";
	import { page } from "$app/state";
	import LocationContextMap from "$lib/location/components/LocationContextMap.svelte";
	import AddressAnalyzer from "$lib/location/components/AddressAnalyzer.svelte";
	// UX-FIX-2 (Emergency Fix April 11): CoPilotChat import removed — the page now
	// renders its own inline answer surface tied to shared inlineCpMessages via askCopilot().
	// CoPilotChat.svelte remains in the codebase for other call sites.
	import UserProfileRecap from "$lib/components/UserProfileRecap.svelte";
	import NavigationDrawer from "$lib/components/NavigationDrawer.svelte";
	import { createLocationStore } from "$lib/location/store.svelte";
	import {
		hasFounderProfile,
		loadLaunchPadData,
		saveLaunchPadData,
	} from "$lib/launchpad-store";
	import { backgroundSync } from "$lib/session-autosave";
	import { apiFetch } from "$lib/api";
	import { authedFetch } from "$lib/authed-fetch";
	import SegmentInsights from "$lib/location/components/SegmentInsights.svelte";
	import FitDimensionRings from "$lib/location/components/FitDimensionRings.svelte";
	import LocationHistory from "$lib/location/components/LocationHistory.svelte";
	import { getConceptDefaults } from "$lib/constants/conceptDefaults";
	import { getConceptLabel } from "$lib/constants/concepts";
	import {
		getIdealCheckRange,
		getPeakHours,
		getKillFactors,
		getLocationWeights,
		CONCEPT_KPIS,
		getDoc09Intelligence,
	} from "$lib/constants/conceptKPIs";
	import {
		getNeighborhoodBuzz,
		buzzLabel,
		trendArrow,
		type NeighborhoodBuzz,
	} from "$lib/constants/neighborhoodBuzz";
	import {
		getNeighborhoodRecs,
		type HoodRecs,
	} from "$lib/intel/neighborhood-recs";
	import {
		getWhyBulletsV2,
		getSuccessProb,
		getRevenueProjections,
		getDashboardHeadline,
		getTodaysInsight,
		type WhyBullet,
		type SuccessProb,
		type RevenueProjection,
		type DashboardHeadline,
		type TodaysInsight,
	} from "$lib/intel/dashboard-brain";
	import { writeCanonicalConcept } from "$lib/constants/businessTypeNormalizer";
	// 04.19.2026 13:00 Changed from normalizeConceptKey to normalizeBusinessType (canonical registry)
	import { normalizeBusinessType } from "$lib/intel/registry/business-type-registry";
	import { clearCachedCoffeeScore } from "$lib/stores/coffee-score-cache";
	import { createBusinessCaseStore } from "$lib/stores/business-case-store.svelte";
	import {
		PRICE_LEVEL_TO_COFFEE,
		KILL_FACTOR_THRESHOLDS,
	} from "$lib/constants/scoring-thresholds";

	import {
		VISION_ARCHETYPES,
		DEFAULT_ARCHETYPE,
	} from "$lib/constants/visionArchetypes";
	import ScoreRangeBar from "$lib/components/ScoreRangeBar.svelte";
	import PageNav from "$lib/components/PageNav.svelte";
	import ScoreMetaLine from "$lib/components/ScoreMetaLine.svelte";
	// UX-FIX-1 (Emergency Fix April 11): single composite for grade + verdict + PRELIM
	import ScoreHeader from "$lib/components/ScoreHeader.svelte";
	import { computeInputsHashBrowser } from "$lib/utils/inputs-hash-browser";
	import {
		getDecisionState,
		getScoreInterpretation,
		getEvidencePayload,
		getConceptCoaching,
		getConceptSignals,
		getWhyStrip,
		blockTierLabel,
		fitGrade,
		fitGradeCapped,
		fitMeaning,
		fitMeaningShort,
		fitNextTier,
		fitTierLabel,
		fitVerdictShort,
		type DecisionState,
		type ScoreInterpretation,
		type EvidencePayload,
		type ConceptCoaching,
		type RenderedSignal,
		type LocationDataBag,
		type EvidenceCategory,
	} from "$lib/utils/decision-engine";
	// §1b (April 11): confidence tier helpers — Brain ships confidenceBySource
	// on /api/location-iq; UX classifies each value into full/partial/skeleton
	// using the canonical thresholds in tiers.ts (CONFIDENCE_PARTIAL=80,
	// CONFIDENCE_SKELETON=60) so every metric surface renders the same way.
	import {
		confidenceTier,
		tierFor,
		tierLabelFor,
		VISION_IQ_TIERS,
		type ConfidenceTier,
	} from "$lib/intel/tiers";
	// BR-09: Concept Pulse helpers — same single source of truth the server uses to build the conceptPulse envelope.
	import {
		pulseTier,
		conceptRevenueModel,
		pulseNarrative,
	} from "$lib/intel/engines/primitives";
	import { getConceptScanRadius } from "$lib/location/api/geo";
	import {
		getCanonicalScores,
		getVerdict,
		computeKillFactors,
		rule3KillFactor,
	} from "$lib/scoring-utils.svelte";
	import {
		checkDuplicateAnalysis,
		type DuplicateMatch,
	} from "$lib/utils/duplicate-detection";
	import {
		classifyDifferentiator,
		type DiffResult,
	} from "$lib/scoring/differentiator-classifier";
	import { sanitizeCopilotText } from "$lib/utils/copilot-sanitize";
	import { initLocationAnalysisStore } from "$lib/location/location-analysis.svelte";
	import DuplicateAnalysisGuard from "$lib/location/components/DuplicateAnalysisGuard.svelte";
	import LocationStickyActionBar from "$lib/location/components/LocationStickyActionBar.svelte";
	import FactorDrilldown from "$lib/location/components/FactorDrilldown.svelte";
	// Inlined from block-group.ts — cannot import that module client-side (it has supabase-server deps)
	const _COUNTY_TO_BOROUGH: Record<string, string> = {
		"061": "Manhattan",
		"005": "Bronx",
		"047": "Brooklyn",
		"081": "Queens",
		"085": "Staten Island",
	};
	const geoidToBorough = (geoid: string) =>
		geoid.length >= 5
			? _COUNTY_TO_BOROUGH[geoid.substring(2, 5)] || "NYC"
			: "NYC";

	const store = createLocationStore();
	// 04.19.2026 18:00 - UI Store Extraction initialization
	const analysisStore = initLocationAnalysisStore();

	// FIX: Synchronous pre-render clear — store is a module-level singleton that retains stale
	// searchResult from previous sessions. Clear it immediately when a new addr param is present
	// so hasResult starts false and the bot-handoff loading state shows correctly.
	{
		const _botAddr =
			typeof window !== "undefined"
				? new URLSearchParams(window.location.search).get("addr")
				: page.url.searchParams.get("addr");
		if (_botAddr) store.searchResult = null;
	}

	// Google Maps key for Street View embed
	const gmapsKey =
		typeof import.meta !== "undefined"
			? (import.meta as any).env?.PUBLIC_GOOGLE_MAPS_API_KEY || ""
			: "";

	// Map state
	// 04.19.2026 18:00 - UI Store Extraction
	// mapLat, mapLng, competitors, and scan status migrated to analysisStore

	// BRAIN-NEW-01: Track whether the client-side competitor scan has completed.
	// 'pending' = scan not yet run (initial page load / new analysis started)
	// 'complete' = scan ran (may have found 0 or more competitors — both are valid results)
	// 'failed'   = scan threw an error
	let hasResult = $derived(!!store.searchResult);
	// mapRef migrated to analysisStore
	let comingFromBot = $derived(!!page.url.searchParams.get("addr"));

	// UX Order 5: Bot-handoff timeout state (15s limit, 2s progress messages, Try Again escape)
	const HANDOFF_MESSAGES = [
		"Looking at who walks past this block daily...",
		"Checking how many similar businesses thrive nearby...",
		"Reading the neighbourhood — income, density, energy...",
		"Mapping transit access for your target customer...",
		"Running the survival numbers for this block...",
		"Comparing this spot to 50K NYC businesses...",
		"Calculating how your concept fits this location...",
		"Almost ready — pulling it all together...",
	];
	let handoffProgressIdx = $state(0);
	let handoffTimedOut = $state(false);

	// Scoring error state
	let scoringFailed = $state(false);

	// 04.19.2026 18:00 - Duplicate analysis detection state migrated to analysisStore

	// Six-index scores
	let sixScores = $state<Record<string, number>>({});
	let fitSubScores = $state<Record<string, number>>({}); // Cycle 2H calibrated sub-scores
	let fitComplete = $state(false);
	let animateRings = $state(false);

	// 04.19.2026 18:00 - UI Store Extraction
	// expandedFactor, showAllHelping, showAllHurting migrated to analysisStore

	// ── Shortlist pin ──
	let isPinned = $state(false);
	let pinJustSaved = $state(false); // drives the "Saved!" flash
	let shortlistToastVisible = $state(false); // UX-18: visible toast with a destination link
	function syncPinState() {
		if (typeof window === "undefined") return;
		const lp = loadLaunchPadData() as any;
		const found = (lp.scoredLocations || []).find(
			(l: any) => l.addr === analysisAddress,
		);
		isPinned = found?.pinned === true;
	}
	function togglePin() {
		if (!analysisAddress) return;
		const lp = loadLaunchPadData() as any;
		const locations: any[] = lp.scoredLocations || [];
		const idx = locations.findIndex((l: any) => l.addr === analysisAddress);
		if (idx >= 0) {
			locations[idx].pinned = !locations[idx].pinned;
			isPinned = locations[idx].pinned;
		} else {
			// Not yet in list (edge case): create entry and pin it
			locations.push({
				addr: analysisAddress,
				score: locationIQ,
				fitScore: fitIQ,
				visionScore: visionIQ,
				scoredAt: String(Date.now()),
				pinned: true,
			});
			isPinned = true;
		}
		saveLaunchPadData({ ...(lp as any), scoredLocations: locations });
		if (isPinned) {
			pinJustSaved = true;
			// UX-18: Show a toast with a destination link so the action isn't a black hole.
			shortlistToastVisible = true;
			setTimeout(() => {
				shortlistToastVisible = false;
			}, 4500);
			setTimeout(() => {
				pinJustSaved = false;
			}, 2000);
			// Fire-and-forget: save to deal pipeline (no await — localStorage is primary)
			authedFetch("/api/deals/save-location", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					address: analysisAddress,
					geoid: currentGeoid || null,
					neighborhood: locationNeighborhood || null,
					borough: currentGeoid ? geoidToBorough(currentGeoid) : null,
					location_iq_score: locationIQ || null,
					fit_iq_score: fitIQ || null,
					vision_iq_score: visionIQ || null,
					concept_type: visionBizType || null,
				}),
			}).catch(() => {
				/* silent — pipeline sync is non-critical */
			});
		}
	}

	// Duplicate analysis detection handler
	// Called by AddressAnalyzer.doSearch() via onBeforeSearch callback
	async function handleBeforeSearch(address: string): Promise<boolean> {
		// Determine the current concept type from the store
		const conceptType = store.bizType || store.bizCategory || "";
		if (!conceptType) {
			// No concept selected yet — allow search to proceed
			return true;
		}

		// Check if this address + concept has already been analyzed
		const result = checkDuplicateAnalysis(address, conceptType);
		if (result.found) {
			// Found a duplicate — show modal and don't proceed
			analysisStore.duplicateFound = result;
			analysisStore.pendingAnalysisAddress = address;
			analysisStore.pendingAnalysisConceptType = conceptType;
			return false;
		}

		// No duplicate found — proceed with analysis
		return true;
	}

	function factorImpact(key: string, concept: string, hours: string): string {
		if (
			key === "survivalRate" ||
			key === "neighborhoodHealth" ||
			key === "price_income_fit"
		)
			return "HIGH";
		if (key === "momentum") return "LOW";
		if (key === "competition")
			return [
				"specialty_coffee",
				"bakery",
				"fast_casual",
				"qsr",
				"bar_nightlife",
				"juice_bar",
				"retail",
				"fitness_studio",
			].includes(concept)
				? "HIGH"
				: "MODERATE";
		if (key === "accessibility" || key === "transit")
			return [
				"specialty_coffee",
				"fast_casual",
				"qsr",
				"bakery",
				"juice_bar",
				"bar_nightlife",
			].includes(concept)
				? "HIGH"
				: "MODERATE";
		if (key === "safety")
			return hours === "evening" || concept === "bar_nightlife"
				? "HIGH"
				: "MODERATE";
		if (key === "demographics")
			return [
				"medical_office",
				"wellness_spa",
				"full_service_restaurant",
				"coworking",
				"retail",
			].includes(concept)
				? "HIGH"
				: "MODERATE";
		return "MODERATE";
	}

	// Tier-aware coffee label: reads priceLevel from launchpad → tierLabel from PRICE_LEVEL_TO_COFFEE
	function coffeeTierLabel(): string {
		try {
			const lp = JSON.parse(
				localStorage.getItem("re2_launchpad") || "{}",
			);
			const pl = lp.priceLevel;
			if (pl && PRICE_LEVEL_TO_COFFEE[pl])
				return PRICE_LEVEL_TO_COFFEE[pl].tierLabel;
		} catch {}
		return "specialty coffee"; // default if no priceLevel set
	}

	const CONCEPT_LABELS: Record<string, string> = {
		specialty_coffee: coffeeTierLabel(),
		coffee_shop: coffeeTierLabel(),
		coffee: coffeeTierLabel(),
		cafe: coffeeTierLabel(),
		bakery: "bakery",
		fast_casual: "fast casual",
		full_service_restaurant: "full-service restaurant",
		qsr: "QSR",
		bar_nightlife: "bar/nightlife",
		juice_bar: "juice bar",
		wellness_beverage: "wellness beverage",
		retail: "retail",
		fitness_studio: "fitness studio",
		personal_services: "personal services",
		wellness_spa: "spa/wellness",
		medical_office: "medical office",
		florist: "florist",
		coworking: "coworking",
	};

	function factorExplain(
		key: string,
		score: number,
		concept: string,
		hours: string,
	): string {
		const c = CONCEPT_LABELS[concept] || concept;
		switch (key) {
			case "survivalRate":
				// 52% = NYC 3-year commercial business survival rate. Source: NYC DCA licensing data
				// analyzed by Crain's NY Business (2019); consistent with BLS national baseline.
				// #64: sourced and validated — value is defensible, add re-validation note for 2026 data.
				if (score >= 70)
					return `${score}% of businesses survive year one here — above NYC's 52% average. This block has proven staying power.`;
				if (score >= 45)
					return `Businesses here survive at ${score}% — close to NYC's 52% average. Workable, but not a strong signal.`;
				return `Only ${score}% of businesses survive year one — well below NYC's 52% average. The block has a history of turnover.`;
			case "neighborhoodHealth":
				if (score >= 70)
					return "Rising incomes and stable vacancy make this a healthy commercial corridor. Businesses here tend to stay.";
				if (score >= 45)
					return "Mixed signals on the block — some turnover but stable enough for now.";
				return "High vacancy or declining indicators detected. The block may be in transition — risk or opportunity depending on your runway.";
			case "accessibility":
			case "transit":
				if (score >= 75)
					return `Excellent transit access for a ${c}. Multiple subway lines within walking distance drive consistent foot traffic.`;
				if (score >= 50)
					return `Decent transit access. Not a transit hub, but serviceable for a destination ${c}.`;
				return `Limited transit access for a ${c}. Walk-in discovery will be low — you'll need destination marketing.`;
			case "vibrancy":
				if (score >= 70)
					return "High business density and street energy. Foot traffic spills naturally from neighboring establishments.";
				if (score >= 45)
					return "Moderate activity on this block. Not buzzing, not dead.";
				return "Low business density — you'd be one of few on the block. First-mover opportunity but limited natural foot traffic.";
			case "demographics":
				if (score >= 70)
					return `Income and age profile on this block align well with ${c} customers.`;
				if (score >= 45)
					return `Demographics are workable but not ideal for a ${c}. Some positioning adjustment may help.`;
				return `Income or age profile is a mismatch for a ${c}. Customers here may not be in your target range.`;
			case "competition":
				if (score >= 70)
					return `Few ${c} competitors nearby — you'd enter a less-crowded market.`;
				if (score >= 45)
					return `Moderate competition. Differentiation matters here, but there's room for a strong operator.`;
				return `Many ${c} competitors nearby. You'd be entering a crowded block.`;
			case "market_proof":
				if (score >= 70)
					return "Established commercial zone with proven demand. Customers already shop and eat here.";
				if (score >= 45)
					return "Moderate commercial activity — some anchor tenants but not a fully established corridor.";
				return "Emerging or light commercial zone. Demand needs to be built, not just captured.";
			case "safety":
				if (score >= 70)
					return `Safe block. Police-reported incidents are low — a non-issue for ${hours === "evening" ? "evening" : "daytime"} operations.`;
				if (score >= 45)
					return "Moderate safety — within NYC norms. Worth monitoring, especially after dark.";
				if (hours === "evening" || concept === "bar_nightlife")
					return "Above-average incidents on this block. For an evening concept, this directly affects customer comfort and after-dark foot traffic.";
				return `Safety score is low, but your ${hours === "morning" ? "morning" : "daytime"} hours reduce exposure to most incident windows.`;
			case "price_income_fit":
				if (score >= 70)
					return "Your avg check aligns well with this block's income profile. Price isn't a barrier here.";
				if (score >= 45)
					return "Price is borderline — your avg check is slightly high for the neighborhood income profile.";
				return "Significant mismatch between your avg check and this neighborhood's income. This creates purchase friction.";
			case "momentum":
				if (score >= 65)
					return "Active permit activity and new openings signal a corridor on the rise.";
				if (score >= 40)
					return "Stable momentum — no big swings. The block is holding steady.";
				return "Low permit activity. The block is quiet — could be fully built-out or stagnant.";
			default:
				return `Score: ${score}/100`;
		}
	}

	// A4: Score Simulator
	let showSimulator = $state(false);
	let uploadDrawerOpen = $state(false);
	// D16: lightweight toast for export-brief feedback (success / blocked / no-data)
	let exportToast = $state<{
		msg: string;
		kind: "ok" | "warn" | "err";
	} | null>(null);
	function showExportToast(msg: string, kind: "ok" | "warn" | "err" = "ok") {
		exportToast = { msg, kind };
		setTimeout(() => {
			exportToast = null;
		}, 4500);
	}
	let simPreApply = $state<{
		hours: string;
		avgCheck: string;
		foodProgram: string;
	} | null>(null);
	let subScoreExpanded = $state(false); // Option 3: sub-score chip row toggle

	// Pure visionIQ computation with injectable inputs (mirrors the $derived visionIQ logic)
	function simulateVisionIQ(ovr: {
		hours?: string;
		avgCheck?: string;
		foodProgram?: string;
		targetAge?: string;
		differentiators?: string;
	}): number {
		const biz = visionBizType;
		const chk = ovr.avgCheck ?? visionAvgCheck;
		const age = ovr.targetAge ?? visionTargetAge;
		const food = ovr.foodProgram ?? visionFoodProgram;
		const hrs = ovr.hours ?? visionHours;
		const diffs = ovr.differentiators ?? visionDifferentiators;

		const arch = VISION_ARCHETYPES[biz] || DEFAULT_ARCHETYPE;
		const s =
			hasResult && locationIQ
				? sixScores
				: {
						transit: 50,
						vibrancy: 50,
						demographics: 50,
						safety: 50,
						momentum: 50,
						competition: 50,
					};
		const check = parseCheckAmount(chk);

		const competitionFit = s.competition || 50;

		const [lo, hi] = arch.idealCheck;
		let priceIncomeFit: number;
		try {
			const intel = JSON.parse(
				sessionStorage.getItem("re2_location_intel") || "{}",
			);
			const medianIncome =
				intel?.census?.medianHouseholdIncome ||
				intel?.medianHouseholdIncome ||
				0;
			if (medianIncome > 0) {
				const spendRatio = (check * 2.5 * 52) / medianIncome;
				const idealRatio = arch.footTrafficW > 0.25 ? 0.06 : 0.03;
				priceIncomeFit = Math.max(
					10,
					Math.min(
						95,
						Math.round(
							100 - Math.abs(spendRatio - idealRatio) * 800,
						),
					),
				);
			} else {
				if (check >= lo && check <= hi) priceIncomeFit = 75;
				else if (check < lo)
					priceIncomeFit = Math.max(30, 75 - (lo - check) * 5);
				else priceIncomeFit = Math.max(30, 75 - (check - hi) * 3);
			}
		} catch {
			priceIncomeFit = check >= lo && check <= hi ? 70 : 45;
		}
		const SPC: Record<string, number> = {
			specialty_coffee: 20,
			bakery: 25,
			fast_casual: 40,
			full_service_restaurant: 150,
			qsr: 30,
			bar_nightlife: 80,
			juice_bar: 35,
			wellness_beverage: 30,
			retail: 300,
			fitness_studio: 100,
			personal_services: 120,
			wellness_spa: 400,
			medical_office: 600,
			florist: 300,
			coworking: 2000,
		};
		const pCeil = SPC[biz] ?? arch.idealCheck[1] * 3;
		if (check > pCeil)
			priceIncomeFit = Math.max(
				10,
				priceIncomeFit - Math.floor((check - pCeil) * 1.5),
			);

		const [ageLo, ageHi] = parseAgeRange(age);
		let ageFit = s.demographics || 50;
		const midAge = (ageLo + ageHi) / 2;
		if (midAge < 30 && (s.vibrancy || 50) >= 65)
			ageFit = Math.min(95, ageFit + 10);
		if (midAge > 45 && (s.safety || 50) >= 70)
			ageFit = Math.min(95, ageFit + 8);
		if (midAge >= 30 && midAge <= 45) ageFit = Math.min(95, ageFit + 5);

		let hoursFit = s.transit || 50;
		const hCat = HOURS_DAYPART_MAP[hrs] || hrs || "all_day";
		if (hCat === "morning" && arch.peakHours === "morning")
			hoursFit = Math.min(95, hoursFit + 8);
		else if (hCat === "evening" && (s.vibrancy || 50) >= 60)
			hoursFit = Math.min(95, hoursFit + 6);
		else if (hCat === "all_day") hoursFit = Math.min(90, hoursFit + 3);
		if (hCat === "morning" && arch.peakHours === "evening")
			hoursFit = Math.max(20, hoursFit - 12);
		if (hCat === "evening" && arch.peakHours === "morning")
			hoursFit = Math.max(20, hoursFit - 10);

		let foodFit = 60;
		if (food === "full_kitchen" && (s.vibrancy || 50) >= 60) foodFit = 75;
		else if (food === "light_bites" && arch.footTrafficW >= 0.3)
			foodFit = 72;
		else if (food === "grab_go" && (s.transit || 50) >= 65) foodFit = 78;
		else if (food === "none") foodFit = 55;

		const diffWords = diffs.trim()
			? diffs
					.trim()
					.split(/[\s,;]+/)
					.filter((w: string) => w.length > 2).length
			: 0;
		const _cd = AVG_CHECK_DEFAULTS[biz] || "";
		const _strip = (sv: string) => sv.replace(/^\$/, "").trim();
		const hasNDC = chk && _strip(chk) !== "" && _strip(chk) !== _cd;
		const hasNDA = age && age !== "24-42";
		const diffBonus = Math.min(
			13,
			Math.min(8, diffWords * 2) + (hasNDC ? 3 : 0) + (hasNDA ? 2 : 0),
		);

		const weighted =
			competitionFit * arch.competitionW +
			priceIncomeFit * arch.demographicsW +
			ageFit * arch.vibrancyW +
			hoursFit * arch.footTrafficW +
			foodFit * 0.1;
		return Math.max(
			0,
			Math.min(100, Math.round(weighted / 1.1 + diffBonus)),
		);
	}

	// 04.22.2026 Deprecated: old simToFitIQ used client-side visionAdj/founderMod with
	// rogue locationIQ * 0.75 fallback. Now uses canonical 60/40 blend.
	function simToFitIQ(simVIQ: number): number {
		if (!serverFitIQ || serverFitIQ <= 0) return 0;
		// Use the same canonical formula as computeCanonicalFitIQ:
		// Math.round(locationIQ * 0.60 + visionIQ * 0.40)
		return Math.max(
			0,
			Math.min(100, Math.round(locationIQ * 0.6 + simVIQ * 0.4)),
		);
	}

	const SIM_HOURS_LABELS: Record<string, string> = {
		morning: "Morning (6a-3p)",
		all_day: "All day (6a-9p)",
		evening: "Evening (3p-11p)",
	};
	const SIM_FOOD_LABELS: Record<string, string> = {
		none: "None / Pastries",
		light_bites: "Light bites",
		full_kitchen: "Full kitchen",
		grab_go: "Grab & go",
	};

	type SimRec = {
		field: string;
		label: string;
		currentLabel: string;
		newValue: string;
		newLabel: string;
		delta: number;
		simVIQ: number;
	};

	// Simulator shows Vision IQ deltas (larger, more meaningful than fitIQ deltas which are dampened 5×)
	let simRecommendations = $derived.by((): SimRec[] => {
		if (!hasResult || fitIQ === 0) return [];
		const curVIQ = simulateVisionIQ({});
		const recs: SimRec[] = [];

		// Hours: find best alternative
		let bestHoursDelta = 0;
		let bestHoursVal = "";
		let bestHoursVIQ = curVIQ;
		for (const h of ["morning", "all_day", "evening"]) {
			if (h === visionHours) continue;
			const sv = simulateVisionIQ({ hours: h });
			const d = sv - curVIQ;
			if (d > bestHoursDelta) {
				bestHoursDelta = d;
				bestHoursVal = h;
				bestHoursVIQ = sv;
			}
		}
		if (bestHoursVal)
			recs.push({
				field: "hours",
				label: "Hours",
				currentLabel: SIM_HOURS_LABELS[visionHours] || visionHours,
				newValue: bestHoursVal,
				newLabel: SIM_HOURS_LABELS[bestHoursVal],
				delta: bestHoursDelta,
				simVIQ: bestHoursVIQ,
			});

		// Avg check: try ideal midpoint
		const arch2 = VISION_ARCHETYPES[visionBizType] || DEFAULT_ARCHETYPE;
		const [cLo, cHi] = arch2.idealCheck;
		const idealMid = Math.round((cLo + cHi) / 2);
		const curCheck = parseCheckAmount(visionAvgCheck);
		if (Math.abs(curCheck - idealMid) > Math.max(1, idealMid * 0.2)) {
			const sv = simulateVisionIQ({ avgCheck: String(idealMid) });
			const d = sv - curVIQ;
			if (d >= 1)
				recs.push({
					field: "avgCheck",
					label: "Avg Check",
					currentLabel: `$${curCheck}`,
					newValue: String(idealMid),
					newLabel: `$${idealMid}`,
					delta: d,
					simVIQ: sv,
				});
		}

		// Food program (food concepts only)
		if (
			[
				"specialty_coffee",
				"bakery",
				"fast_casual",
				"full_service_restaurant",
				"qsr",
				"bar_nightlife",
				"juice_bar",
				"wellness_beverage",
			].includes(visionBizType)
		) {
			let bestFoodDelta = 0;
			let bestFoodVal = "";
			let bestFoodVIQ = curVIQ;
			for (const f of [
				"none",
				"light_bites",
				"full_kitchen",
				"grab_go",
			]) {
				if (f === visionFoodProgram) continue;
				const sv = simulateVisionIQ({ foodProgram: f });
				const d = sv - curVIQ;
				if (d > bestFoodDelta) {
					bestFoodDelta = d;
					bestFoodVal = f;
					bestFoodVIQ = sv;
				}
			}
			if (bestFoodVal)
				recs.push({
					field: "foodProgram",
					label: "Food Program",
					currentLabel:
						SIM_FOOD_LABELS[visionFoodProgram] || visionFoodProgram,
					newValue: bestFoodVal,
					newLabel: SIM_FOOD_LABELS[bestFoodVal],
					delta: bestFoodDelta,
					simVIQ: bestFoodVIQ,
				});
		}

		return recs.sort((a, b) => b.delta - a.delta);
	});

	let simComboDelta = $derived.by(() => {
		if (simRecommendations.length < 2) return 0;
		const ovr: Record<string, string> = {};
		for (const r of simRecommendations) ovr[r.field] = r.newValue;
		const curVIQ = simulateVisionIQ({});
		return (
			simulateVisionIQ({
				hours: ovr.hours,
				avgCheck: ovr.avgCheck,
				foodProgram: ovr.foodProgram,
			}) - curVIQ
		);
	});

	// #6: factor sort order by concept weight
	let factorOrder = $derived.by(() => {
		const arch = VISION_ARCHETYPES[visionBizType] || DEFAULT_ARCHETYPE;
		const isEvening =
			(HOURS_DAYPART_MAP[visionHours] || visionHours) === "evening" ||
			visionBizType === "bar_nightlife";
		const weights: Record<string, number> = {
			accessibility: arch.footTrafficW,
			transit: arch.footTrafficW,
			competition: arch.competitionW,
			demographics: arch.demographicsW,
			price_income_fit: arch.demographicsW * 0.9,
			vibrancy: arch.vibrancyW,
			market_proof: 0.15,
			market_proof_legacy: 0.15,
			safety: isEvening ? 0.28 : 0.12,
			momentum: 0.08,
		};
		const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1]);
		const order: Record<string, number> = {};
		sorted.forEach(([key], idx) => {
			order[key] = idx + 1;
		});
		return order;
	});

	function applySimRecs() {
		simPreApply = {
			hours: visionHours,
			avgCheck: visionAvgCheck,
			foodProgram: visionFoodProgram,
		};
		for (const r of simRecommendations) {
			if (r.field === "hours") visionHours = r.newValue;
			else if (r.field === "avgCheck") visionAvgCheck = r.newValue;
			else if (r.field === "foodProgram") visionFoodProgram = r.newValue;
		}
		handleVisionRecalc();
	}

	function resetSimRecs() {
		if (!simPreApply) return;
		visionHours = simPreApply.hours;
		visionAvgCheck = simPreApply.avgCheck;
		visionFoodProgram = simPreApply.foodProgram;
		simPreApply = null;
		handleVisionRecalc();
	}

	function factorAction(
		key: string,
		score: number,
		concept: string,
		hours: string,
	): string {
		switch (key) {
			case "survivalRate":
				if (score >= 70)
					return "Strong signal. Keep a 6-month cash reserve to protect your position.";
				if (score >= 45)
					return "Build a 6-month operating reserve and monitor who's opening and closing nearby.";
				return "Investigate why — often high rents or weak foot traffic. Negotiate a shorter lease term (1-2 years) and build a 9-month buffer.";
			case "neighborhoodHealth":
				if (score >= 70)
					return "Use this in landlord negotiations — stable neighborhood means stable tenant.";
				if (score >= 45)
					return "Walk the block yourself. Count active storefronts vs. vacancies.";
				return "Talk to neighboring business owners before signing. Ask how traffic has changed over 12-24 months.";
			case "accessibility":
			case "transit":
				if (score >= 75)
					return "No action needed — strong transit is a competitive advantage. Mention it in your marketing.";
				if (score >= 50)
					return "Build a strong Google Maps presence to capture nearby residents and workers.";
				return "Consider Google Ads targeting the local zip code and invest in visible exterior signage.";
			case "vibrancy":
				if (score >= 70)
					return "Lean into the energy — co-marketing with neighbors can multiply your discovery.";
				if (score >= 45)
					return "Identify the strongest anchor nearby and position yourself relative to it.";
				return "Check if the block is newly emerging (rising permits = opportunity) or established-quiet (harder to pull walk-in traffic).";
			case "demographics":
				if (score >= 70)
					return "Good demographic alignment — no changes needed.";
				if (score >= 45)
					return "Consider adjusting your avg check or target age range by 2-5 years to better fit the local profile.";
				return "Adjust your avg check — even $2-3 lower can unlock a significantly larger addressable market on this block.";
			case "competition":
				if (score >= 70)
					return "You're entering with less competition. Define what makes you the obvious first choice.";
				if (score >= 45)
					return "Sharpen one differentiator that competitors on this block don't have. Add it to your concept details.";
				return "What makes you the obvious choice vs. nearby competitors? Add your strongest differentiators to your concept details.";
			case "market_proof":
				if (score >= 70)
					return "Proven demand means less customer education needed. Lead with convenience and quality.";
				if (score >= 45)
					return "Identify the anchor establishment nearby and position yourself relative to it.";
				return "A low market proof score works for destination concepts. If you rely on walk-ins, consider a more established block.";
			case "safety":
				if (score >= 70)
					return "No action needed — safe blocks reduce staff turnover and customer hesitation.";
				if (score >= 45)
					return "Review incident types on the NYC open data map before signing.";
				if (hours === "evening" || concept === "bar_nightlife")
					return "Consider morning/all-day hours, or look 2-3 avenues over. If you proceed, invest in visible security and exterior lighting.";
				return "Your operating hours reduce exposure. Confirm incident patterns fall outside your hours using NYC open data.";
			case "price_income_fit":
				if (score >= 70)
					return "Pricing is well-calibrated for this location. No changes needed.";
				if (score >= 45)
					return "Try lowering avg check by $2-3 and watch how your score responds.";
				return "Adjust your avg check. A $3-5 reduction often moves your score by 8-15 points.";
			case "momentum":
				if (score >= 65)
					return "Emerging corridors can deliver outsized upside. Secure favorable lease terms while rents are still rising.";
				if (score >= 40)
					return "Stable blocks are lower risk. Negotiate for tenant improvement allowance — landlord has less pressure.";
				return "Low momentum isn't a dealbreaker on established blocks — check if anchor tenants are strong and long-tenured.";
			default:
				return "Review this factor carefully before proceeding.";
		}
	}
	let analysisAddress = $state("");
	let locationNeighborhood = $state("");
	// FIX-04: Always derive Brain Tools addr from URL param so links never carry stale address
	let brainAddr = $derived(
		page.url.searchParams.get("addr") ?? analysisAddress ?? "",
	);

	// Current geoid for Co-Pilot API calls
	let currentGeoid = $state("");
	let currentBorough = $derived(
		currentGeoid ? geoidToBorough(currentGeoid) : "NYC",
	);

	// F1: Neighborhood Buzz — editorial sentiment data
	let neighborhoodBuzz = $derived.by(() => {
		const addr = analysisAddress || locationNeighborhood || "";
		if (!addr) return null;
		return getNeighborhoodBuzz(addr);
	});

	// Server-side Fit IQ (from block group or fit-iq-engine) — used as source of truth when available
	let serverFitIQ = $state<number | null>(null);
	// FIX-C: Server-side Vision IQ from DB calibrated model — preferred over client-computed baseline
	let serverVisionIQ = $state<number | null>(null);
	// BR-13: data source coverage — "Based on N of M data sources"
	let dataCompleteness = $state<{
		available: number;
		total: number;
		pct: number;
	} | null>(null);
	// BR-14: Data source vintage string (e.g. '2024-Q4') — set by AddressAnalyzer, drives 'Data as of' display
	let dataVintage = $state<string | null>(null);
	// FIX-011: Competitor data quality flag — 'verified' | 'estimated' | 'synthetic'
	// 'synthetic' = market-density backfill only; 'estimated' = mix; 'verified' = real POI scan
	let competitorDataQuality = $state<
		"verified" | "estimated" | "synthetic" | null
	>(null);

	// V5 three-score hero — from store.searchResult
	let threeScores = $derived.by(() => {
		const d = store.searchResult?.data as
			| Record<string, unknown>
			| undefined;
		return (d?.threeScores ?? null) as {
			locationIQ: { score: number; grade: string } | null;
			visionIQ: { score: number; available: boolean } | null;
			fitIQ: { score: number; grade: string } | null;
		} | null;
	});

	// V5 six-index with 8 dimensions — from store.searchResult
	let sixIndex = $derived.by(() => {
		const d = store.searchResult?.data as
			| Record<string, unknown>
			| undefined;
		return (d?.sixIndex ?? null) as {
			indices: Record<
				string,
				{ score: number; weight: number; dataSources: number }
			>;
			indexScores: Record<string, number>;
			signals?: Array<{ index: string; type: string; message: string }>;
		} | null;
	});

	// Map six-index signals to dimension keys for plain-English explanations
	// Each dimension gets the first signal from its index — one line of real data.
	const SIX_INDEX_KEY_MAP: Record<string, string[]> = {
		transit: ["transit"],
		demographics: ["demographics"],
		competition: ["competition"],
		survival: ["survivalRate", "neighborhoodHealth"],
		vibrancy: ["vibrancy"],
		safety: ["safety"],
	};
	let dimensionSignals = $derived.by(() => {
		const sigs = sixIndex?.signals ?? [];
		const out: Record<string, string> = {};
		for (const [dimKey, indexKeys] of Object.entries(SIX_INDEX_KEY_MAP)) {
			const matched = sigs.filter((s) => indexKeys.includes(s.index));
			if (matched.length > 0) {
				// Pick the most informative: prefer positive/negative over neutral, take first
				const best =
					matched.find((s) => s.type !== "neutral") ?? matched[0];
				out[dimKey] = best.message;
			}
		}
		return out;
	});

	// ── Kill Factor Callouts ──
	// Surface critical negative signals as prominent warnings above the deep-dive.
	// Sources: six-index negative signals + any pillar scoring below 30 (structural risk).
	let killFactors = $derived.by(() => {
		const factors: Array<{
			icon: string;
			message: string;
			variant?: "kill" | "caution";
		}> = [];
		const intel = doc09;

		// 1. Pull critical negative signals from six-index
		const sigs = sixIndex?.signals ?? [];
		for (const s of sigs) {
			if (s.type !== "negative") continue;
			const msg = s.message.toLowerCase();
			if (
				msg.includes("saturat") ||
				msg.includes("oversaturat") ||
				msg.includes("low business success") ||
				msg.includes("isolated") ||
				msg.includes("weak neighborhood")
			) {
				factors.push({ icon: "\u26A0\uFE0F", message: s.message });
			}
		}

		// 2. Concept-specific structural risks from pillar scores + Doc09 thresholds
		const scores = sixScores || {};
		// 04.18.2026 Code Changes for Kill Factor Refactoring
		if (
			(scores.safety ?? 100) < KILL_FACTOR_THRESHOLDS.safety &&
			(scores.safety ?? 100) > 0
		) {
			factors.push({
				icon: "\u{1F6A8}",
				message: `Safety score critically low (${Math.round(scores.safety)}/100) — high crime area may deter customers and staff`,
			});
		}
		if (
			intel &&
			(scores.competition ?? 100) < KILL_FACTOR_THRESHOLDS.competition &&
			(scores.competition ?? 100) > 0
		) {
			factors.push({
				icon: "\u{1F6AB}",
				message: `Extreme competition (${Math.round(scores.competition)}/100) — ${intel.clustering.note}`,
			});
		} else if (
			(scores.competition ?? 100) < KILL_FACTOR_THRESHOLDS.competition &&
			(scores.competition ?? 100) > 0
		) {
			factors.push({
				icon: "\u{1F6AB}",
				message: `Extreme competition (${Math.round(scores.competition)}/100) — market is saturated for this concept`,
			});
		}
		if (
			intel &&
			intel.pullRadius.type === "impulse" &&
			(scores.transit ?? 100) < KILL_FACTOR_THRESHOLDS.transit &&
			(scores.transit ?? 100) > 0
		) {
			factors.push({
				icon: "\u{1F6B6}",
				message: `Very low foot traffic (${Math.round(scores.transit)}/100) — ${intel.label} depends on impulse traffic within a ${intel.pullRadius.walkMinutes}-minute walk. Min ${intel.minDailyFootTraffic.toLocaleString()} pedestrians/day needed.`,
			});
		} else if (
			(scores.transit ?? 100) < KILL_FACTOR_THRESHOLDS.transit &&
			(scores.transit ?? 100) > 0
		) {
			factors.push({
				icon: "\u{1F6B6}",
				message: `Very low foot traffic (${Math.round(scores.transit)}/100) — location depends entirely on destination traffic`,
			});
		}

		// 3. Doc09 regulatory kill factors
		if (intel) {
			const conceptKey = conceptKeyForQuestions;
			// Med spa without understanding medical director requirement
			if (conceptKey === "medical_office") {
				factors.push({
					icon: "\u{2695}\uFE0F",
					message:
						"Med spa REQUIRES NY-licensed MD/DO medical director — cannot be a PA. 87 citations in 223 inspections in 2026.",
				});
			}
		}

		// 4. UX-D (BR-M): Vital Rule 3 — Revenue-per-SF Floor
		// The helper returns null when the concept passes the floor or when no
		// benchmark exists. Severity is 'caution' (not a hard kill) because a
		// founder can still pivot footprint or ticket — but Watch-for must
		// show it prominently. Orange variant styling distinguishes Rule 3
		// from the red hard-kill factors above.
		// Uses conceptKeyForQuestions (same source as the med-spa check above),
		// which is resolved at reactive-read time inside this $derived.by body.
		const r3 = rule3KillFactor(conceptKeyForQuestions);
		if (r3) {
			factors.push({
				icon: "\u{1F4CF}",
				message: `${r3.label}: ${r3.recommendation}`,
				variant: "caution",
			});
		}

		return factors.slice(0, 3); // Cap at 3 to avoid alarm fatigue
	});

	// UX-3.1: Kill factors from /api/location-iq GET payload
	// shape: [{name, reason, threshold, actual}]
	// fitIQ === 49 indicates capping; show banner when any factor present + score capped
	let apiKillFactors = $derived(locationIqPayload?.killFactors ?? []);
	let apiKillBannerVisible = $derived(
		apiKillFactors.length > 0 && fitIQ > 0 && fitIQ <= 49,
	);

	// UX-3.2 + B3-1.5: Grade-cap reason + API-authoritative grade + verdict
	let gradeCapReason = $derived(locationIqPayload?.gradeCapReason ?? null);
	let gradeCapped = $derived(locationIqPayload?.gradeCapped ?? null);
	// B3-1.5: API emits verdict ('Viable', 'Tight', etc.) — prefer over client fitTierLabel
	let apiVerdict = $derived(locationIqPayload?.verdict ?? null);

	// ── UX-J: Rule 17 (NY SLA 200-ft school rule) hard-block banner ──
	// Surfaces ONLY when:
	//   1. The iq.signals array contains a message starting with the stable
	//      `🚫 SLA 200-ft BLOCK` prefix (vital-rules.ts RULE_17_SIGNAL_PREFIX).
	//   2. The current concept depends on a liquor license. Non-liquor concepts
	//      (retail, coffee, wellness) get no banner — Rule 17 doesn't affect them.
	//
	// Read from the top-level `signals` array (spread from `...iq` in
	// /api/location-iq). `sixIndex.signals` is a different array scoped to
	// the 8-dimension computation — Rule 17 does NOT live there.
	//
	// Concept gating uses store.bizType directly (TDZ-safe — no dependency on
	// `visionBizType` / `conceptKeyForQuestions` which are declared later in
	// this script). If the founder changes concept via the questionnaire,
	// the banner re-evaluates once the next score payload lands.
	const LIQUOR_CONCEPTS = new Set([
		"bar_nightlife",
		"full_service_restaurant",
		"wine_bar",
		"brewery",
		"cocktail_bar",
	]);

	let rule17Block = $derived.by(() => {
		const d = store.searchResult?.data as
			| Record<string, unknown>
			| undefined;
		const topSignals = (d?.signals ?? []) as Array<{
			layer?: string;
			type?: string;
			message: string;
		}>;
		const blockSignal = topSignals.find(
			(s) =>
				typeof s?.message === "string" &&
				s.message.startsWith("🚫 SLA 200-ft BLOCK"),
		);
		if (!blockSignal) return null;

		// Concept gate: only show for liquor-dependent concepts.
		// Use raw store.bizType — available immediately, no TDZ.
		const rawConcept = (store.bizType || "")
			.toString()
			.toLowerCase()
			.replace(/\s+/g, "_");
		if (!LIQUOR_CONCEPTS.has(rawConcept)) return null;

		// Parse "<school> is <X> ft away" out of the stable message format.
		// Format: `🚫 SLA 200-ft BLOCK: <schoolName> is <distFt> ft away — ...`
		let schoolName = "";
		let distFt = "";
		const match = blockSignal.message.match(
			/^🚫 SLA 200-ft BLOCK:\s*(.+?)\s+is\s+(\d+)\s*ft/,
		);
		if (match) {
			schoolName = match[1];
			distFt = match[2];
		}

		return { message: blockSignal.message, schoolName, distFt };
	});

	function rule17Reset(): void {
		// Drop the analyzed address and return to the Dashboard search.
		try {
			if (typeof window !== "undefined") {
				window.location.href = "/app/dashboard";
			}
		} catch {
			/* ignore */
		}
	}

	// Vision IQ questionnaire state (per UX-IMPLEMENTATION-RULES)
	let dynamicVisionIQ = $state<{
		score: number;
		grade: string;
		isDynamic: boolean;
	} | null>(null);
	let dynamicFitIQ = $state<{
		score: number;
		grade: string;
		isDynamic: boolean;
	} | null>(null);
	let conceptQuestions = $state<
		Array<{
			id: string;
			label: string;
			options: Array<{ value: string; label: string }>;
		}>
	>([]);
	let visionScoreBefore = $state<number | null>(null);
	let visionScoreDelta = $state<number | null>(null);
	let visionDeltaTimeout: ReturnType<typeof setTimeout> | null = null;

	// ── Percentile context: "Top X% of [concept] locations in NYC" ──
	// Calibrated from 13K scored locations per concept (Cycle 2H training data).
	const CONCEPT_DIST: Record<string, { mean: number; sd: number }> = {
		specialty_coffee: { mean: 54, sd: 14 },
		cafe_bakery: { mean: 52, sd: 13 },
		fast_casual: { mean: 56, sd: 15 },
		qsr: { mean: 58, sd: 14 },
		full_service_restaurant: { mean: 51, sd: 15 },
		fine_dining: { mean: 46, sd: 16 },
		bar_nightlife: { mean: 53, sd: 14 },
		fitness_studio: { mean: 50, sd: 14 },
		retail: { mean: 55, sd: 15 },
		coworking: { mean: 57, sd: 13 },
		medical_office: { mean: 60, sd: 12 },
		personal_services: { mean: 56, sd: 13 },
		wellness_spa: { mean: 49, sd: 14 },
		yoga_wellness: { mean: 48, sd: 14 },
		juice_bar: { mean: 52, sd: 13 },
		florist: { mean: 54, sd: 12 },
	};
	// UX-FIX-5 (Emergency Fix Pack April 11): Unambiguous percentile framing.
	// Canonical copy for top-half: "Better than X% of NYC <concept> locations we've analyzed."
	// The compressed "Top 4%" phrasing was removed — founders couldn't tell if "top" meant good or bad.
	let percentileText = $derived.by(() => {
		if (fitIQ <= 0) return "";
		const concept = store.launchpadProfile?.businessType || "";
		const key = concept.toLowerCase().replace(/[\s\/]+/g, "_");
		const dist = CONCEPT_DIST[key] ?? { mean: 54, sd: 14 };
		const z = (fitIQ - dist.mean) / dist.sd;
		// Approximate CDF using Abramowitz-Stegun: Φ(z) ≈ 1/(1 + exp(-1.7155*z - 0.2716*z³))
		const cdf = 1 / (1 + Math.exp(-1.7155 * z - 0.2716 * z * z * z));
		const topPct = Math.max(1, Math.min(99, Math.round((1 - cdf) * 100)));
		const betterThan = 100 - topPct;
		const label = (bizTypeLabel || "business").toLowerCase();
		// Top half: "Better than 96% of NYC coffee locations we've analyzed"
		if (topPct <= 50)
			return `Better than ${betterThan}% of NYC ${label} locations we've analyzed`;
		// Middle: plain-language — avoid percentile jargon
		if (topPct <= 60)
			return `Middle of the pack for NYC ${label} locations we've analyzed`;
		// Below average: no "top" word, no percentile suffix — plain comparison
		return `Below ${betterThan}% of NYC ${label} locations we've analyzed`;
	});

	// ── Doc 09 Intelligence: per-concept failure rates, cost structure, regulatory ──
	let doc09 = $derived(getDoc09Intelligence(conceptKeyForQuestions));

	// Failure rate context line below the hero
	let failureRateText = $derived.by(() => {
		if (!doc09) return "";
		const fr = doc09.failureRates;
		const label = bizTypeLabel?.toLowerCase() || "business";
		return `Industry reality: ${fr.year1Pct}% of ${label}s close in Year 1, ${fr.year3Pct}% by Year 3. #1 cause: cash flow.`;
	});

	// Segment Intelligence from AddressAnalyzer (C2 fix: wire into E2b)
	let segmentInsightData = $state<
		import("$lib/intel/segment-intel").SegmentInsight | null
	>(null);

	// Fit IQ dimension rings from AddressAnalyzer (H2 fix: surface in E2b)
	let fitRingsFromAnalyzer = $state<
		import("$lib/intel/segment-intel").FitIQRing[] | null
	>(null);
	let fitVerdictFromAnalyzer = $state<string | null>(null);

	// Error state for analysis failures
	let analysisError = $state("");
	// UXFIX-02: scoredAt for meta-line — reads from session on mount, updated after each score run
	let scoredAtDisplay = $state<number | null>(null);

	// Addendum §2.4: Re-score comparison — track previous score so we can show "was X, now Y"
	let previousLocationIQ = $state<number | null>(null);
	let rescoreComparison = $state<{
		prev: number;
		next: number;
		ts: number;
	} | null>(null);

	// E2b: Vision form state — P1-A: initialize visionBizType from session.bizType at
	// declaration time so concept shows correctly on every render, including after back-navigation.
	const _initSess = (() => {
		try {
			return JSON.parse(localStorage.getItem("re2_session") || "{}");
		} catch {
			return {};
		}
	})();
	const _initLp = (() => {
		try {
			return JSON.parse(localStorage.getItem("re2_launchpad") || "{}");
		} catch {
			return {};
		}
	})();
	const _initPersona = (() => {
		try {
			return JSON.parse(localStorage.getItem("re2_persona") || "{}");
		} catch {
			return {};
		}
	})();
	const _rawConcept =
		_initLp.businessType ||
		_initSess.bizType ||
		_initSess.visionBizType ||
		_initPersona.persona_type ||
		"";
	let visionBizType = $state(writeCanonicalConcept(_rawConcept)); // FIX-B: writes canonical key to session at page init
	// conceptAnswers: must be declared AFTER _initSess (line above) to avoid TDZ ReferenceError (caused 500 in 8c8eb7b)
	let conceptAnswers = $state<Record<string, string>>(
		_initSess.conceptAnswers || {},
	);

	// B4 FIX: Re-read bizType from launchpad on navigate so concept doesn't stay stale
	$effect(() => {
		try {
			const lp = JSON.parse(
				localStorage.getItem("re2_launchpad") || "{}",
			);
			const canonical = writeCanonicalConcept(lp.businessType || "");
			if (canonical && canonical !== visionBizType) {
				visionBizType = canonical;
			}
		} catch {
			/* noop */
		}
	});

	// Concept-aware initialization: food program and hours must match the CURRENT concept,
	// not a stale value from a previous session with a different concept type.
	const _INIT_FOOD_BEV = [
		"specialty_coffee",
		"bakery",
		"fast_casual",
		"full_service_restaurant",
		"qsr",
		"bar_nightlife",
		"juice_bar",
		"wellness_beverage",
	];
	const _isInitFoodConcept = _INIT_FOOD_BEV.includes(
		writeCanonicalConcept(_rawConcept),
	);
	const _INIT_HOURS_MAP: Record<string, string> = {
		bar_nightlife: "evening",
		full_service_restaurant: "evening",
		retail: "all_day",
		fast_casual: "all_day",
		qsr: "all_day",
		personal_services: "all_day",
		medical_office: "all_day",
		florist: "all_day",
		coworking: "all_day",
		wellness_spa: "all_day",
		specialty_coffee: "morning",
		bakery: "morning",
		fitness_studio: "morning",
		juice_bar: "morning",
		wellness_beverage: "morning",
	};

	let visionAvgCheck = $state(_initSess.visionAvgCheck || "");
	let visionTargetAge = $state(_initSess.visionTargetAge || "24-42");
	// Only restore food program from session if it was set for a food concept; otherwise default to 'none'
	let visionFoodProgram = $state(
		_isInitFoodConcept
			? _initSess.visionFoodProgram || "light_bites"
			: "none",
	);
	// Restore hours from session if present, otherwise use concept-appropriate default
	let visionHours = $state(
		_initSess.visionHours ||
			_INIT_HOURS_MAP[writeCanonicalConcept(_rawConcept)] ||
			"morning",
	);
	// L4 FIX: initialize from session like all other vision fields (was async-only via applyConceptDefaults
	// which caused completionPct to compute as 0-diff on first render → PRELIM badge flicker on restore)
	let visionDifferentiators = $state(_initSess.visionDifferentiators || "");
	// RE²D2: Differentiator classifier state
	let diffResult = $state<DiffResult | null>(null);
	let differentiatorAttempts = $state(0);
	let _diffDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	function runDiffClassifier(text: string) {
		if (_diffDebounceTimer) clearTimeout(_diffDebounceTimer);
		if (!text.trim()) {
			diffResult = null;
			return;
		}
		_diffDebounceTimer = setTimeout(() => {
			const r = classifyDifferentiator(text);
			diffResult = r.tier === "empty" ? null : r;
			if (r.tier === "garbage" || r.tier === "vague") {
				if (differentiatorAttempts < 2) differentiatorAttempts += 1;
			}
		}, 400);
	}
	// V2: Credit score range for loan pre-qualification (persisted to session)
	let visionCreditScore = $state(_initSess.visionCreditScore || "");
	// B-commit: New Vision IQ fields (persisted to session)
	let visionStoreType = $state(_initSess.visionStoreType || "");
	let visionTargetSize = $state(_initSess.visionTargetSize || "");
	let visionTargetClients = $state(_initSess.visionTargetClients || "");
	let visionTargetClients2 = $state(_initSess.visionTargetClients2 || "");
	let visionEmployees = $state(_initSess.visionEmployees || "");
	let visionInitialCapital = $state(_initSess.visionInitialCapital || "");
	let visionMonthlyRent = $derived.by(() => {
		try {
			const lp = JSON.parse(
				localStorage.getItem("re2_launchpad") || "{}",
			);
			return lp.financialGoals?.monthlyRentBudget || 0;
		} catch {
			return 0;
		}
	});
	let visionRentPct = $derived.by(() => {
		if (!visionMonthlyRent) return 0;
		const kpi = CONCEPT_KPIS[visionBizType];
		const projRevenue = (() => {
			const v = kpi?.coaching?.breakEvenAnnualRevenue;
			if (!v)
				console.warn(
					"[RE2] Missing breakEvenAnnualRevenue for concept:",
					visionBizType,
				);
			return v ?? 400_000;
		})();
		return Math.round(((visionMonthlyRent * 12) / projRevenue) * 100);
	});
	let visionMaxRentPct = $derived(
		CONCEPT_KPIS[visionBizType]?.maxRentPercent || 12,
	);

	// Vision IQ Completion Dial — weighted % (all fields must be filled for 100%)
	// Weights: BizType 8, StoreType 7, TargetSize 7, AvgCheck 12, Client1 7, TargetAge 7,
	//          FoodProgram 7, Hours 7, Differentiators 12, Employees 5, CreditScore 7, Capital 7, ConceptQs 7
	let visionFieldsComplete = $derived.by(() => {
		let pct = 0;
		// Business Type: 8% — always filled (auto-set from onboarding)
		if (visionBizType) pct += 8;
		// Store Type: 7%
		if (visionStoreType) pct += 7;
		// Target Size: 7%
		if (visionTargetSize) pct += 7;
		// Avg Check: 12% — any non-empty value counts (range strings from onboarding are valid)
		if (visionAvgCheck && visionAvgCheck.trim()) pct += 12;
		// Target Clients: 7%
		if (visionTargetClients) pct += 7;
		// Target Age: 7% — any non-empty value counts (defaults are valid choices)
		if (visionTargetAge && visionTargetAge.trim()) pct += 7;
		// Food Program: 7% — non-food concepts get full credit; food concepts count any selection
		const _isFoodConcept = [
			"specialty_coffee",
			"bakery",
			"fast_casual",
			"full_service_restaurant",
			"qsr",
			"bar_nightlife",
			"juice_bar",
			"wellness_beverage",
		].includes(visionBizType);
		if (!_isFoodConcept || visionFoodProgram) pct += 7;
		// Hours: 7% — always has a value (auto-set), so always filled
		if (visionHours) pct += 7;
		// Differentiators: 12% — ≥2 meaningful words (length > 2)
		const _diffWords = visionDifferentiators.trim()
			? visionDifferentiators
					.trim()
					.split(/[\s,;]+/)
					.filter((w: string) => w.length > 2).length
			: 0;
		if (_diffWords >= 2) pct += 12;
		// Employees: 5%
		if (visionEmployees) pct += 5;
		// Credit Score: 7%
		if (visionCreditScore) pct += 7;
		// Initial Capital: 7%
		if (visionInitialCapital) pct += 7;
		// Concept Questions: 7% — always credited (optional score boosters, not completion gates)
		// FIX: removing async timing bug where questions loading post-analysis dropped pct by 7%
		// causing completion to never reach 100% even when all visible fields are filled.
		pct += 7;
		return pct;
	});
	// visionFieldsComplete is already 0–100 (weighted %)
	let visionCompletionPct = $derived(visionFieldsComplete);
	// PRELIM badge disappears ONLY at 100% — all fields filled
	let visionIsPrelim = $derived(visionCompletionPct < 100);

	// UX-05: Count filled vs total fields for PRELIM reframe
	let visionFieldsFilled = $derived.by(() => {
		let filled = 0;
		let total = 11; // excludes concept questions (always credited)
		if (visionBizType) filled++;
		if (visionStoreType) filled++;
		if (visionTargetSize) filled++;
		if (visionAvgCheck && visionAvgCheck.trim()) filled++;
		if (visionTargetClients) filled++;
		if (visionTargetAge && visionTargetAge.trim()) filled++;
		const _isFoodConcept = [
			"specialty_coffee",
			"bakery",
			"fast_casual",
			"full_service_restaurant",
			"qsr",
			"bar_nightlife",
			"juice_bar",
			"wellness_beverage",
		].includes(visionBizType);
		if (!_isFoodConcept || visionFoodProgram) filled++;
		if (visionHours) filled++;
		const _diffWords = visionDifferentiators.trim()
			? visionDifferentiators
					.trim()
					.split(/[\s,;]+/)
					.filter((w: string) => w.length > 2).length
			: 0;
		if (_diffWords >= 2) filled++;
		if (visionEmployees) filled++;
		if (visionCreditScore) filled++;
		if (visionInitialCapital) filled++;
		total++;
		return { filled, total, remaining: total - filled };
	});

	// BR-02: Score confidence envelope — derived client-side using the exact thresholds
	// the server applies (<0.5 preliminary / <0.85 partial / >=0.85 confident). Mirrors
	// what GET/POST /api/location-iq returns so UX-06 PRELIM stamp reads a single source.
	let scoreConfidence: "preliminary" | "partial" | "confident" = $derived.by(
		() => {
			const pct =
				visionFieldsFilled.total > 0
					? visionFieldsFilled.filled / visionFieldsFilled.total
					: 0;
			if (pct < 0.5) return "preliminary";
			if (pct < 0.85) return "partial";
			return "confident";
		},
	);
	let scoreConfidenceReason = $derived.by(() => {
		const { filled, total } = visionFieldsFilled;
		if (scoreConfidence === "preliminary")
			return `Only ${filled} of ${total} concept inputs filled — score may shift as you add more.`;
		if (scoreConfidence === "partial")
			return `${filled} of ${total} concept inputs filled — score is stabilizing.`;
		return `${filled} of ${total} concept inputs filled — score is reliable for decision-making.`;
	});

	// UX-05: Real maxUpside from /api/score/preview — replaces hand-tuned +N pts formula.
	// Falls back to the old heuristic (remaining * 1, clamped 3-12) until the first preview
	// response lands so the UI never shows 0 on initial render.
	let _apiMaxUpside = $state<number | null>(null);
	let visionMaxUpside = $derived(
		_apiMaxUpside ??
			Math.max(3, Math.min(12, visionFieldsFilled.remaining * 1)),
	);

	// BR-09: Concept Pulse envelope — built on the client with the same helpers
	// the server uses (pulseTier / conceptRevenueModel / pulseNarrative / getConceptScanRadius).
	// Shape identical to GET /api/location-iq so UX reads it instead of recomputing tiers.
	let conceptPulse = $derived.by(() => {
		const score = sixScores["vibrancy"] || sixScores["vibrancy_index"] || 0;
		if (score <= 0 || !visionBizType) return null;
		const tier = pulseTier(score);
		const model = conceptRevenueModel(visionBizType);
		const radius = getConceptScanRadius(visionBizType);
		return {
			score,
			tier,
			model,
			conceptRadiusM: radius,
			narrative: pulseNarrative(tier, model, radius),
			verdict: `${tier} for a ${visionBizType.replace(/_/g, " ")}.`,
		};
	});

	// ── UX-19 / UX-23: Lazy GET /api/location-iq fetch (BR-05 + BR-06) ────────
	// The full GET endpoint returns dataFreshness (21 sources × status × cadence)
	// and lenses (6 dimension slices with verdicts, signals, map highlights,
	// CoPilot prompts). It's expensive — touches every intel source — so the
	// client only calls it when the user actually opens the Data Sources modal
	// or flips a lens tab. Results are cached by analysis address so repeat
	// opens don't re-hammer the pipeline.
	type LensSlice = {
		dimension: string;
		label: string;
		uxLabel: string;
		score: number;
		tier: "Strong" | "Solid" | "Average" | "Weak" | "Concerning";
		weight: number;
		description: string;
		verdictLine: string;
		topSignals: Array<{
			type: "positive" | "negative" | "neutral";
			message: string;
		}>;
		mapHighlights: string[];
		copilotPrompt: string;
		dataSources: { available: number; total: number };
	};
	type DataSourceEntry = {
		key: string;
		label: string;
		category: string;
		status: "ok" | "error" | "missing";
		fetchedAt: string | null;
		ageHours: number | null;
		updateCadence: string;
		errorMessage?: string;
	};
	type DataFreshness = {
		lastScoredAt: string;
		ageHours: number;
		ageLabel: string;
		sources: DataSourceEntry[];
		summary: { ok: number; error: number; missing: number; total: number };
	};
	// §1b (April 11): confidenceBySource is the sibling map Brain ships on
	// /api/location-iq GET/POST. Six lens dimensions + vision (0-100 each).
	// GET always ships vision: 0; UX overrides it locally from visionCompletionPct.
	type ConfidenceBySource = {
		transit?: number;
		safety?: number;
		demographics?: number;
		competition?: number;
		vibrancy?: number;
		momentum?: number;
		vision?: number;
	};
	type LocationIqPayload = {
		lenses: LensSlice[];
		dataFreshness: DataFreshness;
		confidenceBySource?: ConfidenceBySource;
		// UX-3.1: kill factors from Brain 3
		killFactors?: Array<{
			name: string;
			reason: string;
			threshold: number;
			actual: number;
		}>;
		// UX-3.2 + B3-1.5: grade cap + authoritative verdict from Brain 3
		gradeCapped?: string | null;
		gradeCapReason?: string | null;
		verdict?: string | null;
	};

	// R6-2: Persist lens cache to sessionStorage so back-nav doesn't re-fetch
	let locationIqCache = $state<Record<string, LocationIqPayload>>(
		(() => {
			try {
				return JSON.parse(
					sessionStorage.getItem("re2_lensCache") || "{}",
				);
			} catch {
				return {};
			}
		})(),
	);
	let locationIqFetching = $state(false);
	let locationIqError = $state<string | null>(null);
	let locationIqPayload = $state<LocationIqPayload | null>(null);

	async function loadLocationIqEnvelope(
		force = false,
	): Promise<LocationIqPayload | null> {
		if (!analysisAddress || !analysisStore.mapLat || !analysisStore.mapLng)
			return null;

		// D14: Guard against stale coords. analysisStore.mapLat/analysisStore.mapLng default to Midtown (40.7580/-73.9855)
		// and are updated asynchronously from localStorage only when loc.addr === analysisAddress.
		// If the match hasn't happened yet, we'd fire the lens fetch with the wrong coords.
		// Verify coords correspond to the current analysisAddress via re2_selected_location.
		let resolvedLat = analysisStore.mapLat;
		let resolvedLng = analysisStore.mapLng;
		try {
			const loc = JSON.parse(
				sessionStorage.getItem("re2_selected_location") || "{}",
			);
			if (loc.addr === analysisAddress && loc.lat && loc.lng) {
				resolvedLat = loc.lat;
				resolvedLng = loc.lng;
			} else if (loc.addr && loc.addr !== analysisAddress) {
				// Stored coords are for a DIFFERENT address — geocoder hasn't resolved yet.
				// Skip the fetch; it will be retried when coords settle.
				console.warn(
					"[LocationIQ] D14 guard: skipping lens fetch — stored coords do not match current address",
				);
				return null;
			}
		} catch {
			// localStorage parse failed — fall through with reactive coords
		}

		const cacheKey = `${analysisAddress}::${visionBizType}`;
		if (!force && locationIqCache[cacheKey]) {
			locationIqPayload = locationIqCache[cacheKey];
			return locationIqPayload;
		}
		locationIqFetching = true;
		locationIqError = null;
		try {
			// B1: Pass priceLevel (+ avgTicket/visionTier if available) to scoring API
			const _lpIq = (() => {
				try {
					return JSON.parse(
						localStorage.getItem("re2_launchpad") || "{}",
					);
				} catch {
					return {};
				}
			})();
			// Fallback: derive avgTicket/visionTier from priceLevel for coffee concepts
			const _coffeeFallback =
				_lpIq.priceLevel && PRICE_LEVEL_TO_COFFEE[_lpIq.priceLevel]
					? PRICE_LEVEL_TO_COFFEE[_lpIq.priceLevel]
					: null;
			const _resolvedAvgTicket =
				_lpIq.avgTicket || _coffeeFallback?.avgTicket || "";
			const _resolvedVisionTier =
				_lpIq.visionTier || _coffeeFallback?.visionTier || "";
			const qs = new URLSearchParams({
				lat: String(resolvedLat),
				lng: String(resolvedLng),
				type: visionBizType || "cafe",
				address: analysisAddress,
				...(_lpIq.priceLevel
					? { priceLevel: String(_lpIq.priceLevel) }
					: {}),
				...(_resolvedAvgTicket
					? { avgTicket: String(_resolvedAvgTicket) }
					: {}),
				...(_resolvedVisionTier
					? { visionTier: _resolvedVisionTier }
					: {}),
			});
			const res = await apiFetch(`/api/location-iq?${qs.toString()}`);
			if (!res.ok) {
				locationIqError = `Score data unavailable (${res.status})`;
				return null;
			}
			const data = await res.json();
			const payload: LocationIqPayload = {
				lenses: (data.lenses as LensSlice[]) || [],
				dataFreshness: data.dataFreshness as DataFreshness,
				confidenceBySource:
					(data.confidenceBySource as ConfidenceBySource) ||
					undefined,
			};
			locationIqCache = { ...locationIqCache, [cacheKey]: payload };
			try {
				sessionStorage.setItem(
					"re2_lensCache",
					JSON.stringify(locationIqCache),
				);
			} catch {}
			locationIqPayload = payload;
			return payload;
		} catch (e: unknown) {
			locationIqError = e instanceof Error ? e.message : "Fetch failed";
			return null;
		} finally {
			locationIqFetching = false;
		}
	}

	// UX-19 / UX-I: Active lens selection. Flipping to a lens triggers the
	// lazy GET fetch (cached by address) the first time; subsequent flips
	// are instant.
	//
	// UX-I relabel + reorder per RE2-UX-Sprint-April11.md §2 — six purposeful
	// lenses with founder-language labels. Dimension keys still map 1:1 to
	// the BR-06 slice envelope (no Brain dependency); only the surface
	// copy and display order change.
	type LensKey =
		| "competition"
		| "transit"
		| "safety"
		| "demographics"
		| "vibrancy"
		| "momentum";
	const LENS_TABS: ReadonlyArray<{
		key: LensKey;
		label: string;
		sub: string;
	}> = [
		{ key: "competition", label: "Competition", sub: "Who else is nearby" },
		{ key: "transit", label: "Foot Traffic", sub: "How easy to reach" },
		{ key: "demographics", label: "Your Customers", sub: "Who lives here" },
		{
			key: "momentum",
			label: "Trajectory",
			sub: "Where this block is heading",
		},
		{ key: "safety", label: "Safety & Vibe", sub: "After-dark comfort" },
		{ key: "vibrancy", label: "The Block", sub: "Street-level energy" },
	];
	let activeLensKey = $state<LensKey>("competition");
	let activeLensSlice = $derived.by(() => {
		const lenses = locationIqPayload?.lenses ?? [];
		return lenses.find((l) => l.dimension === activeLensKey) ?? null;
	});

	// §1b (April 11): Effective confidenceBySource — starts from whatever Brain
	// shipped on the payload. POST now ships a real `vision` value (Brain follow-up
	// 1fe6909); GET still ships `vision: 0`. When the server sends 0 we fall back
	// to the client-side visionCompletionPct so the vision lens doesn't render as
	// a skeleton pill on first load. When the server sends a real value (POST path)
	// we trust it because it factors in server-side completeness + error penalties.
	let confidenceBySource = $derived.by<ConfidenceBySource>(() => {
		const base = locationIqPayload?.confidenceBySource ?? {};
		// R6-1: Backfill — if real sixScores exist but confidence is missing/0, treat as confirmed.
		// Fixes GET/cached path where confidence wasn't persisted but scores were.
		const dims = [
			"transit",
			"safety",
			"demographics",
			"competition",
			"vibrancy",
			"momentum",
		] as const;
		for (const dim of dims) {
			if (sixScores?.[dim] > 0 && !base[dim]) base[dim] = 100;
		}
		const serverVision = base.vision ?? 0;
		return {
			...base,
			vision:
				serverVision > 0
					? serverVision
					: Math.round(visionCompletionPct),
		};
	});
	// Convenience tier lookups — components read these instead of recomputing.
	let confidenceTransit = $derived(
		confidenceTier(confidenceBySource.transit),
	);
	let confidenceSafety = $derived(confidenceTier(confidenceBySource.safety));
	let confidenceDemos = $derived(
		confidenceTier(confidenceBySource.demographics),
	);
	let confidenceCompetition = $derived(
		confidenceTier(confidenceBySource.competition),
	);
	let confidenceVibrancy = $derived(
		confidenceTier(confidenceBySource.vibrancy),
	);
	let confidenceMomentum = $derived(
		confidenceTier(confidenceBySource.momentum),
	);
	let confidenceVision = $derived(confidenceTier(confidenceBySource.vision));
	// Map dimension key → confidence tier, used by the 6-lens card header.
	let confidenceForLens = $derived.by<(dim: string) => ConfidenceTier>(() => {
		return (dim: string) => {
			switch (dim) {
				case "transit":
					return confidenceTransit;
				case "safety":
					return confidenceSafety;
				case "demographics":
					return confidenceDemos;
				case "competition":
					return confidenceCompetition;
				case "vibrancy":
					return confidenceVibrancy;
				case "momentum":
					return confidenceMomentum;
				default:
					return "full";
			}
		};
	});
	// Hero percentile + LocationIQ overall confidence: aggregate across the six
	// location dimensions (vision excluded — vision is a separate score). Simple
	// average then classify. If the payload hasn't arrived yet, render 'full'
	// optimistically so the hero doesn't flicker to skeleton on every page load.
	let locationConfidenceAvg = $derived.by<number>(() => {
		const base = locationIqPayload?.confidenceBySource;
		if (!base) return 100;
		const vals = [
			base.transit,
			base.safety,
			base.demographics,
			base.competition,
			base.vibrancy,
			base.momentum,
		].filter(
			(n): n is number => typeof n === "number" && Number.isFinite(n),
		);
		if (vals.length === 0) return 100;
		return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
	});
	let locationConfidenceTier = $derived(
		confidenceTier(locationConfidenceAvg),
	);
	async function selectLens(key: LensKey) {
		activeLensKey = key;
		if (!locationIqPayload) {
			await loadLocationIqEnvelope();
		}
	}

	// UX-23: Data Sources modal state. Opens on "View data sources" click near
	// the hero; lazy-fetches the GET envelope on first open (cached after).
	let dataSourcesModalOpen = $state(false);
	async function openDataSourcesModal() {
		dataSourcesModalOpen = true;
		// Only fetch if we don't already have freshness data cached for this address
		if (!locationIqPayload?.dataFreshness) {
			await loadLocationIqEnvelope();
		}
	}
	function closeDataSourcesModal() {
		dataSourcesModalOpen = false;
	}

	// Grouped sources for the modal render — the 6 canonical categories in the
	// order the UX spec wants them (demographics first, momentum last).
	let dataSourceGroups = $derived.by(() => {
		const src = locationIqPayload?.dataFreshness?.sources ?? [];
		const order: Array<
			| "demographics"
			| "businesses"
			| "transit"
			| "safety"
			| "infrastructure"
			| "momentum"
		> = [
			"demographics",
			"businesses",
			"transit",
			"safety",
			"infrastructure",
			"momentum",
		];
		const labels: Record<string, string> = {
			demographics: "Who lives here",
			businesses: "Businesses & permits",
			transit: "Transit & access",
			safety: "Safety",
			infrastructure: "Infrastructure",
			momentum: "Neighborhood momentum",
		};
		return order
			.map((cat) => ({
				key: cat,
				label: labels[cat],
				sources: src.filter((s) => s.category === cat),
			}))
			.filter((g) => g.sources.length > 0);
	});

	// ── UX-20: Live score preview (BR-04) ─────────────────────────────────────
	// Debounced POST to /api/score/preview that recomputes Vision IQ + Fit IQ from
	// partial Vision answers WITHOUT hitting the 20-source intel pipeline or DB.
	// Fires any time Vision inputs change (concept answer, hours, avg check, food
	// program, differentiator, etc.) so the hero ring animates to the new score in
	// <300ms. The canonical /api/location-iq POST still owns persistence; this is
	// a trajectory indicator only.
	let livePreviewActive = $state(false);
	let livePreviewTimer: ReturnType<typeof setTimeout> | null = null;

	// The 8 dimension keys /api/score/preview requires, pulled from whichever
	// source is populated (sixIndex payload is preferred because it matches the
	// server's IndexName contract verbatim; sixScores is the flattened fallback).
	function buildPreviewIndexScores(): Record<string, number> | null {
		const src = (sixIndex?.indexScores ?? sixScores ?? {}) as Record<
			string,
			number
		>;
		const keys = [
			"transit",
			"demographics",
			"competition",
			"vibrancy",
			"safety",
			"momentum",
			"neighborhoodHealth",
			"survivalRate",
		];
		const out: Record<string, number> = {};
		for (const k of keys) {
			const v = Number(src[k]);
			if (!isFinite(v)) return null; // preview endpoint 400s on missing keys
			out[k] = Math.max(0, Math.min(100, v));
		}
		return out;
	}

	async function runScorePreview() {
		livePreviewTimer = null;
		const indexScores = buildPreviewIndexScores();
		if (!indexScores || !visionBizType) {
			livePreviewActive = false;
			return;
		}
		try {
			// Addendum Item 2: Pass avgTicket + visionTier from launchpad to scoring API
			const _lp = (() => {
				try {
					return JSON.parse(
						localStorage.getItem("re2_launchpad") || "{}",
					);
				} catch {
					return {};
				}
			})();
			// Fallback: derive avgTicket/visionTier from priceLevel for coffee concepts
			const _cfPreview =
				_lp.priceLevel && PRICE_LEVEL_TO_COFFEE[_lp.priceLevel]
					? PRICE_LEVEL_TO_COFFEE[_lp.priceLevel]
					: null;
			const res = await apiFetch("/api/score/preview", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					businessType: visionBizType,
					conceptAnswers,
					indexScores,
					locationIQScore:
						storedLocationIQ || threeScores?.locationIQ?.score || locationIQ || 0,
					avgTicket: _lp.avgTicket || _cfPreview?.avgTicket || 5.0,
					visionTier:
						_lp.visionTier || _cfPreview?.visionTier || "standard",
				}),
			});
			if (res.ok) {
				const data = await res.json();
				if (data.visionIQ) {
					const prev =
						(dynamicVisionIQ ?? threeScores?.visionIQ)?.score ??
						null;
					dynamicVisionIQ = data.visionIQ;
					if (prev !== null && typeof prev === "number") {
						visionScoreDelta = data.visionIQ.score - prev;
						if (visionDeltaTimeout)
							clearTimeout(visionDeltaTimeout);
						visionDeltaTimeout = setTimeout(() => {
							visionScoreDelta = null;
						}, 3000);
					}
				}
				if (data.fitIQ) {
					dynamicFitIQ = data.fitIQ;
				} else if (data.fitIQ === null) {
					dynamicFitIQ = null;
				}
				if (data.fitIQ) {
					// ── Shadow Mode: Check against new engine ──
					const __lp = (() => {
						try {
							return JSON.parse(
								localStorage.getItem("re2_launchpad") || "{}",
							);
						} catch {
							return {};
						}
					})();
					authedFetch("/api/fit-iq/compute", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							// We fall back to 360610076001 if geoid isn't available dynamically for testing.
							geoid: "360610076001",
							legacyFitIq: data.fitIQ.score,
							launchpad: __lp,
						}),
					}).catch(() => {});
				}
				// UX-05: Store real maxUpside from preview response
				if (typeof data.maxUpside === "number")
					_apiMaxUpside = data.maxUpside;
			}
		} catch {
			/* preview is best-effort — silent failure keeps canonical score intact */
		}
		livePreviewActive = false;
	}

	// Public trigger — debounces ~300ms so chained keystrokes / click bursts
	// collapse into a single preview POST. Safe to call from any handler.
	function triggerScorePreview() {
		if (livePreviewTimer) clearTimeout(livePreviewTimer);
		livePreviewActive = true;
		livePreviewTimer = setTimeout(runScorePreview, 300);
	}

	// BR-12: Per-field status for Co-Pilot context — which fields are filled vs skipped.
	// Co-Pilot uses this to give targeted completion guidance instead of generic "fill Vision IQ".
	let visionFieldsStatus = $derived.by(() => {
		const _isFoodConcept = [
			"specialty_coffee",
			"bakery",
			"fast_casual",
			"full_service_restaurant",
			"qsr",
			"bar_nightlife",
			"juice_bar",
			"wellness_beverage",
		].includes(visionBizType);
		const _diffWords = visionDifferentiators.trim()
			? visionDifferentiators
					.trim()
					.split(/[\s,;]+/)
					.filter((w: string) => w.length > 2).length
			: 0;
		return {
			bizType: !!visionBizType,
			storeType: !!visionStoreType,
			targetSize: !!visionTargetSize,
			avgCheck: !!(visionAvgCheck && visionAvgCheck.trim()),
			targetClients: !!visionTargetClients,
			targetAge: !!(visionTargetAge && visionTargetAge.trim()),
			foodProgram: !_isFoodConcept || !!visionFoodProgram,
			hours: !!visionHours,
			differentiators: _diffWords >= 2,
			employees: !!visionEmployees,
			creditScore: !!visionCreditScore,
			initialCapital: !!visionInitialCapital,
		};
	});

	// C2-FIX-02: stale geocode callback guard — prevents prior analysis results corrupting new session
	let _activeAnalysisToken = $state("");

	// Track vision form revision count to trigger reactive recalc
	let visionRevision = $state(0);

	// E2b: RE² Insights toggle
	let insightsOpen = $state(true);

	// E2b: Map expand toggle
	let mapExpanded = $state(false);

	// E2b: Tab state for tabbed interface
	let activeTab = $state<"breakdown" | "map" | "copilot">("breakdown");
	// CRITICAL-2: force-refresh clears the score cache so the engine re-runs
	function forceRefreshScores() {
		// Addendum §2.4: Capture previous score before clearing so we can show comparison
		if (storedLocationIQ > 0) previousLocationIQ = storedLocationIQ;
		try {
			const sess = JSON.parse(
				localStorage.getItem("re2_session") || "{}",
			);
			sess.scoredAt = 0; // invalidate cache
			localStorage.setItem("re2_session", JSON.stringify(sess));
		} catch {}
		// Addendum Step 4: Clear coffee score localStorage cache so fresh API data flows in
		try {
			const _concept =
				normalizeBusinessType(visionBizType || "specialty_coffee") ||
				"specialty_coffee";
			if (_concept === "specialty_coffee" || _concept === "coffee") {
				clearCachedCoffeeScore(
					analysisStore.mapLat,
					analysisStore.mapLng,
					_concept,
				);
			}
		} catch {}
		// Reset and re-trigger via addr param
		sixScores = {};
		storedLocationIQ = 0;
		store.searchResult = null;
		serverFitIQ = 0;
		prevAddr = ""; // trick $effect into re-running
	}

	// FIND-B-04: "Try Another Location" — clear result, scroll top, autofocus input
	async function handleTryAnotherLocation() {
		store.searchAddr = "";
		store.searchResult = null;
		sixScores = {};
		storedLocationIQ = 0;
		serverFitIQ = 0;
		window.scrollTo({ top: 0, behavior: "smooth" });
		await tick(); // wait for {#if !hasResult} branch to mount
		// AddressAnalyzer renders .search-input inside .search-panel
		const input = document.querySelector<HTMLInputElement>(
			".search-panel .search-input",
		);
		if (input) {
			input.focus();
		}
	}

	// P1-D: CoPilot collapse toggle with localStorage persistence
	let copilotOpen = $state(
		(() => {
			try {
				return localStorage.getItem("re2_copilot_open") !== "false";
			} catch {
				return true;
			}
		})(),
	);

	// UX-FIX-01: Mapper fix banner (same flag as dashboard)
	let showMapperBannerLIQ = $state(false);
	$effect(() => {
		try {
			if (!localStorage.getItem("re2_mapper_fix_dismissed"))
				showMapperBannerLIQ = true;
		} catch {}
	});
	function dismissMapperBannerLIQ() {
		try {
			localStorage.setItem("re2_mapper_fix_dismissed", "1");
		} catch {}
		showMapperBannerLIQ = false;
	}
	$effect(() => {
		try {
			localStorage.setItem("re2_copilot_open", String(copilotOpen));
		} catch {}
	});

	// V3 Layout state
	let activeV3Tab = $state<"summary" | "deepdive" | "vision">("summary");
	let v3MapLayer = $state("competitors");
	let copilotInputText = $state("");
	// UX-FIX-7 (Emergency Fix April 11): "How to gain points" shows top-3 most
	// impactful levers by default; this toggle reveals the rest on demand.
	let gainPointsExpanded = $state(false);
	// §1c (April 11): Category-grouped rendering for "How to gain points".
	// Ordered list of category keys so group headers always render in a
	// predictable reading order regardless of which categories have items.
	const GAIN_CATEGORY_ORDER: EvidenceCategory[] = [
		"location",
		"vision",
		"financials",
		"operations",
	];
	const GAIN_CATEGORY_LABEL: Record<EvidenceCategory, string> = {
		location: "Block & location",
		vision: "Your concept",
		financials: "Financial",
		// `operations` is reserved for future signals (rent burden, daypart
		// fit). No current signal emits it so this section stays empty today.
		operations: "Operations",
	};

	// UX-FIX-2 (Emergency Fix April 11): Single shared AskAnything handler.
	// Every ask — hero chips, hero "How?" button, bottom copilot bar, per-lens "Ask
	// CoPilot →", or the inline input — goes through askCopilot(text). It pushes a
	// user message, opens the inline CP card, calls handleCoPilotMessage (which posts
	// to /api/copilot/location), then pushes the reply onto the SAME inlineCpMessages
	// list rendered on-screen. This is the bug the brief flagged — the chips were
	// firing but their replies were being dropped on the floor.
	let inlineCpInput = $state("");
	let inlineCpLoading = $state(false);
	// R6-3: Persist CoPilot history to sessionStorage keyed by address
	let inlineCpMessages = $state<{ role: "bot" | "user"; text: string }[]>(
		(() => {
			try {
				const addr = localStorage.getItem("re2_pending_address") || "";
				return JSON.parse(
					sessionStorage.getItem("re2_copilot_" + addr) || "[]",
				);
			} catch {
				return [];
			}
		})(),
	);

	async function askCopilot(text: string): Promise<void> {
		const q = text.trim();
		if (!q || inlineCpLoading) return;
		// Open & pin the inline card so the answer surface is visible.
		copilotOpen = true;
		inlineCpMessages = [...inlineCpMessages, { role: "user", text: q }];
		inlineCpLoading = true;
		const _cpAddr =
			analysisAddress ||
			localStorage.getItem("re2_pending_address") ||
			"";
		try {
			sessionStorage.setItem(
				"re2_copilot_" + _cpAddr,
				JSON.stringify(inlineCpMessages),
			);
		} catch {}
		try {
			const reply = await handleCoPilotMessage(q);
			inlineCpMessages = [
				...inlineCpMessages,
				{ role: "bot", text: reply },
			];
		} catch {
			inlineCpMessages = [
				...inlineCpMessages,
				{ role: "bot", text: "Something went wrong — try again." },
			];
		} finally {
			inlineCpLoading = false;
			try {
				sessionStorage.setItem(
					"re2_copilot_" + _cpAddr,
					JSON.stringify(inlineCpMessages),
				);
			} catch {}
		}
	}

	// UX-FIX-2: bottom bar + inline input both route through askCopilot.
	async function sendCopilotFromBar() {
		if (!copilotInputText?.trim()) return;
		const text = copilotInputText;
		copilotInputText = "";
		await askCopilot(text);
	}
	async function sendInlineCp() {
		const q = inlineCpInput.trim();
		if (!q) return;
		inlineCpInput = "";
		await askCopilot(q);
	}

	// UX Order 5: Bot-handoff timeout — cycles progress messages every 2s, fires Try Again after 15s
	$effect(() => {
		if (!comingFromBot || hasResult) {
			handoffTimedOut = false;
			handoffProgressIdx = 0;
			return;
		}
		// Start progress message cycle (every 2s)
		const msgTimer = setInterval(() => {
			handoffProgressIdx =
				(handoffProgressIdx + 1) % HANDOFF_MESSAGES.length;
		}, 2000);
		// Start 45s timeout
		const timeoutTimer = setTimeout(() => {
			handoffTimedOut = true;
		}, 45000);
		return () => {
			clearInterval(msgTimer);
			clearTimeout(timeoutTimer);
		};
	});

	// Detect failed analysis from store steps
	let hasBadStep = $derived(
		store.searchSteps?.some((s) => s.c === "bad") ?? false,
	);

	// BUG-005: Clear stale scores immediately when navigating to a new address
	let prevAddr = $state("");
	$effect(() => {
		const currentAddr = page.url.searchParams.get("addr") || "";
		// URL params use + for spaces; session/localStorage stores decoded addresses.
		// Decode before any comparison so "273+5th+avenue" matches "273 5th avenue".
		const currentAddrDecoded = currentAddr.replace(/\+/g, " ");
		if (currentAddr && currentAddr !== prevAddr) {
			prevAddr = currentAddr;
			// FIX-003: Clear stale scoring data on every new address submission
			try {
				// FIX: also clear re2_selected_location so map/address don't snap to old location
				[
					"re2_location_intel",
					"re2_session_id",
					"re2_selected_location",
				].forEach((k) => localStorage.removeItem(k));
			} catch {}
			// C2-FIX-02: stamp active analysis token so stale async callbacks can be discarded
			// Use DECODED addr so handleScoresReady comparison works correctly.
			_activeAnalysisToken = currentAddrDecoded;
			try {
				localStorage.setItem("re2_pending_address", currentAddrDecoded);
			} catch {}

			// 04.22.2026 Deprecating: L1 FIX localStorage competitor fallback.
			// Competitors are now exclusively provided by the server via
			// officialCompetitorsInfo in GET /api/location-iq response.
			// See bundle-builder.ts for the canonical competitor pipeline.
			// The localStorage read below has been commented out.
			// L1 FIX (ALWAYS): restore competitors from localStorage on ANY address load —
			// not just cache hits. handleScoresReady fires ~100ms later; if allComps=0 the
			// guard at line ~905 preserves these so the map shows known competitors immediately.
			try {
				const cachedComps = JSON.parse(
					localStorage.getItem("re2_competitors") || "{}",
				);
				const ca = currentAddrDecoded.toLowerCase();
				if (
					cachedComps.items?.length > 0 &&
					cachedComps.addr &&
					(cachedComps.addr.toLowerCase() === ca ||
						ca.startsWith(
							cachedComps.addr.split(",")[0]?.toLowerCase() || "",
						))
				) {
					analysisStore.competitors = cachedComps.items;
				}
			} catch {}

			// CRITICAL-2: if this addr matches session cache, restore from cache instead of resetting
			try {
				const sess = JSON.parse(
					localStorage.getItem("re2_session") || "{}",
				);
				// BR-5 Option A: snapshot is canonical until user explicitly Re-scores. CACHE_TTL removed.
				// FIX: guard against false cache hits where originalAddrParam matches but analyzedAddress
				// is a completely different location. Compare leading house numbers — if they differ it's
				// a stale cross-session collision (e.g. "10 W 93rd" param but "215 W 90th" in session).
				const _houseNum = (s: string) => (s.match(/^\d+/) || [""])[0];
				// Compare decoded URL param so "273+5th" matches "273 5th" in session
				const _exactMatch = sess.analyzedAddress === currentAddrDecoded;
				const _paramMatch =
					(sess.originalAddrParam === currentAddr ||
						sess.originalAddrParam === currentAddrDecoded) &&
					_houseNum(sess.analyzedAddress || "") ===
						_houseNum(currentAddrDecoded);
				const addrMatch = _exactMatch || _paramMatch;
				// BR-3: Guard against all-zero sixScores in cache — if every signal is 0, the six-index failed.
				// Treat as cache miss so scoring re-runs and real signals populate.
				const _hasValidSixScores =
					sess.sixScores &&
					Object.values(
						sess.sixScores as Record<string, number>,
					).some((v) => v > 0);
				// BR-5 § 5.1: no TTL — cache is permanent until Re-score action fires
				const cacheHit =
					addrMatch && sess.locationIQ > 0 && _hasValidSixScores;
				if (cacheHit) {
					// P0-3: Restore scores from cache directly so they're available immediately
					sixScores = sess.sixScores;
					storedLocationIQ = sess.locationIQ;
					// Use URL param address (what user typed) as canonical display address
					analysisAddress =
						currentAddrDecoded || sess.analyzedAddress;
					syncPinState();
					if (sess.geoid) currentGeoid = sess.geoid;
					if (sess.fitSubScores) fitSubScores = sess.fitSubScores;
					if (sess.fitScore) serverFitIQ = sess.fitScore;
					if (sess.serverVisionIQ)
						serverVisionIQ = sess.serverVisionIQ;
					if (!store.searchResult)
						store.searchResult = {
							addr: currentAddrDecoded || sess.analyzedAddress,
						} as any;
					// C4-2: seed Vision IQ defaults on cache-restore path
					const cachedConcept =
						sess.visionBizType || sess.bizType || _rawConcept;
					if (cachedConcept) applyConceptDefaults(cachedConcept);
					// Populate borough label from geoid for neighborhood display
					if (sess.geoid && !locationNeighborhood) {
						try {
							locationNeighborhood = geoidToBorough(sess.geoid);
						} catch {}
					}
					return;
				}
			} catch {}
			// Reset all score state so stale scores don't flash while new search runs
			sixScores = {};
			storedLocationIQ = 0;
			analysisAddress = "";
			serverFitIQ = 0;
			fitSubScores = {};
			store.searchResult = null;
			// FIX: also clear stale selected_location so map doesn't snap to wrong address coords
			try {
				sessionStorage.removeItem("re2_selected_location");
			} catch {}
		}
	});

	// FIX-003: Address-mismatch guard — detects cross-session contamination via re2_location_intel
	$effect(() => {
		const currentAddr = page.url.searchParams.get("addr") || "";
		if (!currentAddr) return;
		try {
			const stored = sessionStorage.getItem("re2_location_intel");
			if (stored) {
				const parsed = JSON.parse(stored);
				if (parsed.address && parsed.address !== currentAddr) {
					localStorage.removeItem("re2_location_intel");
					localStorage.removeItem("re2_session_id");
				}
			}
		} catch {
			try {
				localStorage.removeItem("re2_location_intel");
			} catch {}
		}
	});

	// FIX-006: Concept-aware avg check defaults (single numeric strings, no ranges)
	const AVG_CHECK_DEFAULTS: Record<string, string> = {
		specialty_coffee: "8.75",
		bakery: "12",
		fast_casual: "14",
		qsr: "10",
		full_service_restaurant: "52",
		fine_dining: "95",
		bar_nightlife: "24",
		fitness_studio: "25",
		retail: "65",
		coworking: "350",
		medical_office: "150",
		personal_services: "35",
		wellness_spa: "95",
		juice_bar: "13",
		wellness_beverage: "12",
		florist: "68",
	};

	// C4-2: Standalone concept-default seeder — called from both live-analysis and cache-restore paths.
	// Reads saved vision fields from session before overwriting so user edits are never clobbered.
	function applyConceptDefaults(conceptKey: string) {
		const sess = (() => {
			try {
				return JSON.parse(localStorage.getItem("re2_session") || "{}");
			} catch {
				return {};
			}
		})();
		const normalized = normalizeBizType(conceptKey);
		if (normalized) visionBizType = normalized;
		const defs =
			getConceptDefaults(visionBizType) || getConceptDefaults(conceptKey);
		if (!defs) return;
		if (!sess.visionFoodProgram) visionFoodProgram = defs.foodProgram;
		// FIX-009: propagate onboarding hours selection → Vision IQ hours field
		if (!sess.visionHours) {
			const lp = (() => {
				try {
					return JSON.parse(
						localStorage.getItem("re2_launchpad") || "{}",
					);
				} catch {
					return {};
				}
			})();
			const onboardingHours = lp.founderProfile?.operatingHours || "";
			visionHours = HOURS_DAYPART_MAP[onboardingHours] || defs.hours;
		}
		const isBadDefault =
			!sess.visionAvgCheck ||
			sess.visionAvgCheck === "$5.50" ||
			sess.visionAvgCheck === "$6–10" ||
			sess.visionAvgCheck === "";
		if (isBadDefault) {
			// FIX-006: prefer numeric default from AVG_CHECK_DEFAULTS over range strings from defs
			visionAvgCheck = AVG_CHECK_DEFAULTS[visionBizType] || defs.avgCheck;
		}
		// BUG-6 FIX: restore visionDifferentiators from session so _hasCustomDiff stays true on reload.
		// Without this, cache-restore blanks the differentiators field → _userHasCustomized=false
		// → visionIQ snaps back to serverVisionIQ → $effect overwrites session.visionIQ with lower value.
		if (!visionDifferentiators && sess.visionDifferentiators) {
			visionDifferentiators = sess.visionDifferentiators;
		}
	}

	// Callback when AddressAnalyzer produces scores
	async function handleScoresReady(result: {
		compassScores: Record<string, number>;
		compassComposite: number;
		address: string;
		geoid?: string;
		liveIntel?: Record<string, unknown>;
		fitSubScores?: Record<string, number>;
		fitScore?: number;
		serverVisionIQ?: number;
		segmentInsight?:
			| import("$lib/intel/segment-intel").SegmentInsight
			| null;
		fitRingsData?: import("$lib/intel/segment-intel").FitIQRing[] | null;
		fitVerdict?: string | null;
		fitInsight?: string | null;
		dataCompleteness?: { available: number; total: number; pct: number };
		dataVintage?: string;
		scoringTimedOut?: boolean;
	}) {
		// C2-FIX-02: Discard stale async callbacks from a prior analysis run
		const _pendingAddr = (() => {
			try {
				return localStorage.getItem("re2_pending_address");
			} catch {
				return null;
			}
		})();
		if (
			_pendingAddr &&
			_pendingAddr !== result.address &&
			_activeAnalysisToken &&
			_activeAnalysisToken !== result.address
		) {
			console.warn(
				"[RE²] Discarding stale callback for:",
				result.address,
				"— active:",
				_activeAnalysisToken,
			);
			return;
		}
		// Track timeout/error state: if scoringTimedOut flag is true, mark as failed
		scoringFailed = result.scoringTimedOut === true;
		sixScores = result.compassScores;
		storedLocationIQ = result.compassComposite;
		analysisAddress = result.address;

		// Addendum §2.4: If this was a re-score, build comparison for the user
		if (
			previousLocationIQ !== null &&
			previousLocationIQ > 0 &&
			result.compassComposite > 0
		) {
			rescoreComparison = {
				prev: previousLocationIQ,
				next: result.compassComposite,
				ts: Date.now(),
			};
			previousLocationIQ = null; // consume — only show once
		}
		analysisStore.competitorScanStatus = "pending"; // BRAIN-NEW-01: reset on every new analysis
		syncPinState();
		// P0-3: Ensure hasResult flips true even on cache-restore path (comingFromBot reload)
		if (!store.searchResult && result.address) {
			store.searchResult = { addr: result.address } as any;
		}
		if (result.geoid) currentGeoid = result.geoid;
		if (result.fitSubScores) fitSubScores = result.fitSubScores;

		// C1 fix: Store server-side Fit IQ as source of truth (unifies CoPilot + UI)
		if (result.fitScore) {
			const fs = typeof result.fitScore === "object" ? (result.fitScore as any).score : result.fitScore;
			if (fs > 0) serverFitIQ = fs;
		}
		// FIX-C: Store server-side Vision IQ from DB calibrated model
		if (result.serverVisionIQ && result.serverVisionIQ > 0)
			serverVisionIQ = result.serverVisionIQ;
		// BR-13: store data completeness for UI + Co-Pilot context
		if (result.dataCompleteness) dataCompleteness = result.dataCompleteness;
		// BR-14: store data vintage timestamp
		if (result.dataVintage) dataVintage = result.dataVintage;
		// FIX-011: store competitor data quality for transparency badges
		if (result.dataSourceQuality?.competitors) {
			competitorDataQuality = result.dataSourceQuality.competitors as
				| "verified"
				| "estimated"
				| "synthetic";
		}

		// ISS-03: Let Svelte 5 $derived recompute fitIQ (now: dynamicFitIQ or serverFitIQ only)
		// before we write it to localStorage. Without this tick(), fitIQ still holds the stale
		// pre-score value and Dashboard reads a different number than the LIQ rings show.
		await tick();

		// Auto-trigger score/preview for coffee concepts so the 6-dimension formula
		// with avgTicket/visionTier overwrites the stale batch score via dynamicFitIQ.
		// $derived fitIQ already prioritizes dynamicFitIQ over serverFitIQ.
		const _isCoffeeConcept =
			visionBizType === "specialty_coffee" ||
			visionBizType === "coffee_shop" ||
			visionBizType === "coffee" ||
			visionBizType === "cafe";
		if (_isCoffeeConcept && result.compassComposite > 0) {
			triggerScorePreview();
		}

		// R1-3: Auto-fire lens GET so lens data is ready when the user scrolls down.
		// Without this, the lens area shows "Lens data unavailable" until user clicks a pill.
		loadLocationIqEnvelope();

		// C2 fix: Store segment intelligence for E2b rendering
		if (result.segmentInsight) segmentInsightData = result.segmentInsight;

		// H2 fix: Store Fit IQ dimension rings for E2b rendering
		if (result.fitRingsData) fitRingsFromAnalyzer = result.fitRingsData;
		if (result.fitVerdict) fitVerdictFromAnalyzer = result.fitVerdict;

		// V3 FIX: Use server-provided competitor data (Source of Truth)
		if (result.officialCompetitorsInfo) {
			analysisStore.competitors =
				result.officialCompetitorsInfo.items || [];
			analysisStore.competitorScanStatus = "complete";
			try {
				localStorage.setItem(
					"re2_competitors",
					JSON.stringify({
						addr: result.address,
						items: analysisStore.competitors,
					}),
				);
			} catch {}
			console.log(
				"[RE2] competitors received from backend:",
				analysisStore.competitors.length,
			);
		}

		/* 04.21.2026 Deprecated: Frontend logic leak
		// V3: Extract concept-aware analysisStore.competitors from ALL available sources:
		// 1. store.searchResult.data (raw Overpass from AddressAnalyzer)
		// 2. liveIntel.competitors.amenities (Overpass → Foursquare/Google/MarketDensity backfill)
		// 3. liveIntel.places (Google Places nearby)
		// 4. liveIntel.yelp.directCompetitors (Yelp concept-specific)
		try {
			const allComps: Array<{name: string, lat: number, lng: number, dist?: number, type?: string}> = [];
			const concept = writeCanonicalConcept(visionBizType || store.bizCategory || 'specialty_coffee');
			const seenNames = new Set<string>();
			const addComp = (name: string, lat: number, lng: number, dist?: number, type?: string) => {
				const key = (name || '').toLowerCase().trim();
				if (seenNames.has(key)) return;
				seenNames.add(key);
				allComps.push({ name, lat, lng, dist, type });
			};

			// Concept → relevant Overpass categories mapping
			const FOOD_BEV = ['specialty_coffee', 'bakery', 'fast_casual', 'full_service_restaurant', 'qsr', 'bar_nightlife', 'juice_bar', 'wellness_beverage'];
			const FITNESS_WELLNESS = ['fitness_studio', 'wellness_spa', 'personal_services'];
			const HEALTH_MEDICAL = ['medical_office'];

			// ── Source 1: Raw Overpass from AddressAnalyzer (store.searchResult.data) ──
			const data = store.searchResult?.data as Record<string, any> | undefined;
			if (data) {
				if (FOOD_BEV.includes(concept) || concept === 'retail' || concept === 'florist') {
					for (const c of (data.cafes || [])) {
						if (c.lat && c.lon) addComp(c.name || 'Cafe', c.lat, c.lon, c.dist, 'Cafe');
					}
					for (const c of (data.restaurants || [])) {
						if (c.lat && c.lon) addComp(c.name || 'Restaurant', c.lat, c.lon, c.dist, 'Restaurant');
					}
				}
				if (FITNESS_WELLNESS.includes(concept)) {
					for (const c of (data.gyms || [])) {
						if (c.lat && c.lon) addComp(c.name || 'Gym', c.lat, c.lon, c.dist, 'Gym');
					}
					for (const c of (data.yoga || [])) {
						if (c.lat && c.lon) addComp(c.name || 'Yoga', c.lat, c.lon, c.dist, 'Yoga');
					}
				}
				if (FITNESS_WELLNESS.includes(concept) || HEALTH_MEDICAL.includes(concept) || concept === 'juice_bar' || concept === 'wellness_beverage') {
					for (const c of (data.health || [])) {
						if (c.lat && c.lon) addComp(c.name || 'Health', c.lat, c.lon, c.dist, 'Health');
					}
				}
			}

			// ── Source 2: liveIntel.competitors.amenities (enriched — Google Places + Foursquare + MarketDensity backfill) ──
			// D15: type now includes bars, wellness, retail, personal (matches overpass.ts OverpassData shape)
			const intelComps = result.liveIntel?.competitors as {
				amenities?: {
					cafes?: any[]; restaurants?: any[]; gyms?: any[]; yoga?: any[]; health?: any[];
					bars?: any[]; wellness?: any[]; retail?: any[]; personal?: any[];
				}
			} | undefined;
			if (intelComps?.amenities) {
				const am = intelComps.amenities;
				if (FOOD_BEV.includes(concept) || concept === 'retail' || concept === 'florist') {
					for (const c of (am.cafes || [])) {
						if (c.lat && c.lng) addComp(c.name || 'Cafe', c.lat, c.lng, c.distance, 'Cafe');
					}
					for (const c of (am.restaurants || [])) {
						if (c.lat && c.lng) addComp(c.name || 'Restaurant', c.lat, c.lng, c.distance, 'Restaurant');
					}
				}
				// D15: bar_nightlife must iterate bars — previously missing, caused "0 competitors" on Rivington LES
				if (concept === 'bar_nightlife' || concept === 'bar') {
					for (const c of (am.bars || [])) {
						if (c.lat && c.lng) addComp(c.name || 'Bar', c.lat, c.lng, c.distance, 'Bar');
					}
					// Bars also compete for late-night spend with restaurants
					for (const c of (am.restaurants || [])) {
						if (c.lat && c.lng) addComp(c.name || 'Restaurant', c.lat, c.lng, c.distance, 'Restaurant');
					}
				}
				if (FITNESS_WELLNESS.includes(concept)) {
					for (const c of (am.gyms || [])) {
						if (c.lat && c.lng) addComp(c.name || 'Gym', c.lat, c.lng, c.distance, 'Gym');
					}
					for (const c of (am.yoga || [])) {
						if (c.lat && c.lng) addComp(c.name || 'Yoga', c.lat, c.lng, c.distance, 'Yoga');
					}
					for (const c of (am.wellness || [])) {
						if (c.lat && c.lng) addComp(c.name || 'Wellness', c.lat, c.lng, c.distance, 'Wellness');
					}
				}
				if (FITNESS_WELLNESS.includes(concept) || HEALTH_MEDICAL.includes(concept) || concept === 'juice_bar' || concept === 'wellness_beverage') {
					for (const c of (am.health || [])) {
						if (c.lat && c.lng) addComp(c.name || 'Health', c.lat, c.lng, c.distance, 'Health');
					}
				}
				// D15: retail and personal_services also need their buckets
				if (concept === 'retail' || concept === 'boutique' || concept === 'florist') {
					for (const c of (am.retail || [])) {
						if (c.lat && c.lng) addComp(c.name || 'Retail', c.lat, c.lng, c.distance, 'Retail');
					}
				}
				if (concept === 'personal_services' || concept === 'salon' || concept === 'barbershop') {
					for (const c of (am.personal || [])) {
						if (c.lat && c.lng) addComp(c.name || 'Personal', c.lat, c.lng, c.distance, 'Personal');
					}
				}
			}

			// ── Source 3: liveIntel.places (Google Places Nearby Search) ──
			// FIX: liveIntel.places is ALREADY the array, not { places: [...] }
			const intelPlaces = result.liveIntel?.places;
			const placesArr = Array.isArray(intelPlaces) ? intelPlaces : (intelPlaces as any)?.places || [];
			for (const p of placesArr) {
				if (p.lat && p.lng) addComp(p.name || 'Nearby Business', p.lat, p.lng, p.distance, 'Competitor');
			}

			// ── Source 4: Yelp directCompetitors — already concept-specific, always include ──
			type YelpComp = { name?: string; lat?: number; lng?: number; distance?: number; primaryCategory?: string };
			const yelpData = result.liveIntel?.yelp as { directCompetitors?: YelpComp[] } | undefined;
			if (yelpData?.directCompetitors) {
				for (const c of yelpData.directCompetitors) {
					if (c.lat && c.lng) addComp(c.name || 'Competitor', c.lat, c.lng, c.distance, c.primaryCategory || 'Competitor');
				}
			}

			// Only overwrite if we actually found analysisStore.competitors — cache-hit path has no scanData
			// so allComps = 0 should NOT destroy the localStorage restore (L1 FIX preservation).
			if (allComps.length > 0) {
				analysisStore.competitors = allComps;
				try {
					localStorage.setItem('re2_competitors', JSON.stringify({ addr: result.address, items: allComps }));
				} catch {}
			}
			console.log(`[RE²] competitors extracted: ${allComps.length} from 4 sources`);
			// BRAIN-NEW-01: Mark scan complete regardless of count — 0 competitors is a real result.
			analysisStore.competitorScanStatus = 'complete';
		} catch (e) {
			console.warn('[RE²] Competitor extraction failed:', e);
			analysisStore.competitorScanStatus = 'failed';
		}
*/

		/* 04.21.2026 Deprecated: Frontend logic leak
		// Fallback: if analysisStore.competitors still 0, read from cached liveIntel in localStorage
		if (analysisStore.competitors.length === 0) {
			try {
				const cachedIntel = JSON.parse(sessionStorage.getItem('re2_location_intel') || '{}');
				const fallbackComps: Array<{name: string; lat: number; lng: number; dist?: number; type?: string}> = [];
				const seen2 = new Set<string>();
				const addFb = (arr: any[], type: string) => {
					for (const c of (arr || [])) {
						const key = (c.name || '').toLowerCase().trim();
						if (key && !seen2.has(key) && (c.lat || c.latitude) && (c.lng || c.longitude || c.lon)) {
							seen2.add(key);
							fallbackComps.push({ name: c.name, lat: c.lat || c.latitude, lng: c.lng || c.longitude || c.lon, dist: c.distance, type });
						}
					}
				};
				// Try all known shapes
				addFb(cachedIntel?.competitors?.amenities?.cafes, 'Cafe');
				addFb(cachedIntel?.competitors?.amenities?.restaurants, 'Restaurant');
				addFb(cachedIntel?.competitors?.amenities?.gyms, 'Gym');
				const pl = cachedIntel?.places;
				addFb(Array.isArray(pl) ? pl : pl?.places || [], 'Competitor');
				addFb(cachedIntel?.yelp?.directCompetitors, 'Competitor');
				if (fallbackComps.length > 0) {
					analysisStore.competitors = fallbackComps;
					console.log(`[RE²] competitors fallback from localStorage: ${fallbackComps.length}`);
				}
			} catch {}
		}
*/

		// Update map position from geocoded coordinates
		// FIX: only use re2_selected_location coords if addr matches — prevents map snapping to old location
		try {
			const loc = JSON.parse(
				sessionStorage.getItem("re2_selected_location") || "{}",
			);
			if (loc.lat && loc.lng && loc.addr === result.address) {
				analysisStore.mapLat = loc.lat;
				analysisStore.mapLng = loc.lng;
			}
			if (loc.neighborhood && loc.addr === result.address)
				locationNeighborhood = loc.neighborhood;
		} catch {}
		// Populate borough label from geoid when neighborhood isn't set from stored data
		if (result.geoid && !locationNeighborhood) {
			try {
				locationNeighborhood = geoidToBorough(result.geoid);
			} catch {}
		}

		// Store the composite score in localStorage so Recommendations can read it
		try {
			const session = JSON.parse(
				localStorage.getItem("re2_session") || "{}",
			);
			session.locationIQ = result.compassComposite;
			session.sixScores = result.compassScores;
			session.analyzedAddress = result.address;
			session.scoredAt = Date.now(); // CRITICAL-2: cache timestamp for 24h TTL
			scoredAtDisplay = session.scoredAt;
			// FIX-01: Write bizType + visionBizType so Business Case reads correct concept
			// Also reset downstream lock states — new analysis = fresh start for every module
			session.bizType = visionBizType;
			session.visionBizType = visionBizType;
			session.visitedBusinessCase = false;
			session.visitedScenarios = false;
			if (result.geoid) session.geoid = result.geoid;
			if (result.fitSubScores) session.fitSubScores = result.fitSubScores;
			if (result.fitScore) session.fitScore = result.fitScore;
			// FIX: persist serverVisionIQ so cache-restore path shows PRELIM correctly
			if (result.serverVisionIQ && result.serverVisionIQ > 0)
				session.serverVisionIQ = result.serverVisionIQ;
			// P2-1 FIX: Write neighborhoodHealth + survivalRate into sixScores directly
			// Transparency page reads session.sixScores[key] — they must be inside sixScores, not top-level
			if (result.compassScores.neighborhoodHealth !== undefined) {
				session.sixScores.neighborhoodHealth =
					result.compassScores.neighborhoodHealth;
				session.neighborhoodHealth =
					result.compassScores.neighborhoodHealth; // keep legacy top-level too
			}
			if (result.compassScores.survivalRate !== undefined) {
				session.sixScores.survivalRate =
					result.compassScores.survivalRate;
				session.survivalRate = result.compassScores.survivalRate;
			}
			// F-22: isPartialSeed — block group has sparse entity coverage (< 10 POIs).
			// Financials page reads this to show a nudge card instead of the survival grid
			// when data is insufficient for reliable survival rate estimates.
			if (result.isPartialSeed !== undefined) {
				session.isPartialSeed = result.isPartialSeed;
			}
			localStorage.setItem("re2_session", JSON.stringify(session));

			// DASHBOARD: Upsert into scoredLocations[] so all analyzed locations appear on dashboard.
			// Also writes conceptType here — this replaces T9/Brain Task 1.
			try {
				const lp2 = JSON.parse(
					localStorage.getItem("re2_launchpad") || "{}",
				);
				const locs2: any[] = lp2.scoredLocations || [];
				const idx2 = locs2.findIndex(
					(l: any) => l.addr === result.address,
				);
				// P3-01: seed targetRevY1 so Dashboard revenue sort has a value before user visits Business Case
				const _lp2Goals = lp2.financialGoals || {};
				const _seedRev =
					store.targetRevY1 ||
					_lp2Goals.targetRevY1 ||
					_lp2Goals.revenueY1 ||
					0;
				// BR-5 § 5.2: compute real inputs_hash on initial score (browser-safe Web Crypto)
				const _inputsHash = await computeInputsHashBrowser({
					address: result.address,
					lat: analysisStore.mapLat,
					lng: analysisStore.mapLng,
					concept: visionBizType || "",
					dailyTransactions: _lp2Goals.dailyTransactions ?? null,
					avgTicket: _lp2Goals.avgTicket ?? null,
					monthlyRentBudget: _lp2Goals.monthlyRentBudget ?? null,
					fundingCapital: _lp2Goals.fundingCapital ?? null,
					buildoutBudget: _lp2Goals.buildoutBudget ?? null,
					creditScoreBand:
						lp2.founderProfile?.creditScoreBand ?? null,
					visionIQCompletionPct: visionCompletionPct ?? 0,
					scorerVersion: "v4.3",
				});
				// 04.22.2026: CANONICAL PERSISTENCE POINT.
				// getCanonicalScores() now trusts the server's fitScore directly
				// (no more rogue 0.75x formula). The entry written below is the
				// official LocationSnapshot persisted to localStorage and synced
				// to Supabase via session-sync.
				// BRAIN-NEW-02: Use getCanonicalScores() — pure function, no Svelte reactivity race.
				// This replaces reading $derived fitIQ/visionIQ which can hold stale values.
				const _canonical = getCanonicalScores(
					{
						compassComposite: result.compassComposite,
						fitScore: result.fitScore,
						serverVisionIQ: result.serverVisionIQ,
					},
					result.compassScores,
					lp2,
				);
				const entry = {
					addr: result.address,
					score: _canonical.locationIQ,
					fitScore: _canonical.fitIQ,
					visionScore: _canonical.visionIQ,
					// BRAIN-NEW-02: store sixScores so Dashboard getVerdict() + computeKillFactors() have real signal data
					sixScores: result.compassScores,
					conceptType: visionBizType,
					scoredAt: Date.now(),
					scorer_version: "v4.3", // BR-5 § 5.2: snapshot fields
					inputs_hash: _inputsHash, // BR-5 § 5.2: stable SHA-256 of scoring inputs for drift detection
					pinned: idx2 >= 0 ? (locs2[idx2].pinned ?? false) : false,
					documents: idx2 >= 0 ? (locs2[idx2].documents ?? []) : [],
					// Seed businessCase.revenueY1 from financial goals so dashboard sort works before BC page visit
					// isPartialSeed: true flags this as pre-model data — Dashboard suppresses profit/break-even until Financials page runs
					...(idx2 < 0 && _seedRev > 0
						? {
								businessCase: {
									revenueY1: _seedRev,
									costsY1: 0,
									profitY1: 0,
									breakEvenMonths: 0,
									isPartialSeed: true,
								},
							}
						: {}),
				};
				if (idx2 >= 0) {
					locs2[idx2] = { ...locs2[idx2], ...entry };
				} else {
					locs2.push(entry);
				}
				lp2.scoredLocations = locs2;
				localStorage.setItem("re2_launchpad", JSON.stringify(lp2));
			} catch {}

			// Trigger NavigationDrawer to re-evaluate unlock state reactively
			window.dispatchEvent(
				new StorageEvent("storage", {
					key: "re2_session",
					newValue: localStorage.getItem("re2_session"),
				}),
			);
			// GATE-2: Also fire custom event so same-tab layout listener fires (storage event is cross-tab only)
			try {
				window.dispatchEvent(new CustomEvent("re2:session-updated"));
			} catch {}
			// AUTO-SAVE: background sync to Supabase L2 — fire-and-forget, never blocks UX
			backgroundSync({ trigger: "location_scored" });

			// Write location coordinates for downstream pages
			const selectedLocation = {
				addr: result.address,
				lat: analysisStore.mapLat,
				lng: analysisStore.mapLng,
			};
			localStorage.setItem(
				"re2_selected_location",
				JSON.stringify(selectedLocation),
			);

			// Write full location intel (six scores + composite + live intel) for downstream pages
			const locationIntel: Record<string, unknown> = {
				compassScores: result.compassScores,
				compassComposite: result.compassComposite,
				geoid: result.geoid || "",
				timestamp: new Date().toISOString(),
			};
			// Include liveIntel data if available (walkScore, crime, census, inspections, etc.)
			if (result.liveIntel) {
				Object.assign(locationIntel, result.liveIntel);
			}
			localStorage.setItem(
				"re2_location_intel",
				JSON.stringify(locationIntel),
			);

			// FIX-OB-01: Write scoredLocations + lastAddress to launchpad so that:
			// (a) onboarding initBot() can show super-user message ("You've got N locations")
			// (b) welcome-back server lastScore/lastAddress resolves correctly
			// (c) Supabase sync carries location data into founder_sessions.full_data
			try {
				const {
					loadLaunchPadData: _loadLP,
					saveLaunchPadData: _saveLP,
				} = await import("$lib/launchpad-store");
				const existingLP = _loadLP();
				const prevLocations = (existingLP as any).scoredLocations || [];
				// BRAIN-NEW-02: Use same canonical scores as the first write (no stale $derived race).
				const _ob1Canonical = getCanonicalScores(
					{
						compassComposite: result.compassComposite,
						fitScore: result.fitScore,
						serverVisionIQ: result.serverVisionIQ,
					},
					result.compassScores,
					existingLP as any,
				);
				// BRAIN-NEW-02: find prior entry to preserve pinned/documents/businessCase/scorer_version/inputs_hash
				const _priorEntry =
					prevLocations.find((l: any) => l.addr === result.address) ??
					{};
				const newEntry = {
					...(_priorEntry as any), // preserve existing fields (pinned, documents, businessCase, inputs_hash, scorer_version)
					addr: result.address,
					score: _ob1Canonical.locationIQ,
					fitScore: _ob1Canonical.fitIQ,
					visionScore: _ob1Canonical.visionIQ,
					// BRAIN-NEW-02: sixScores enables Dashboard getVerdict() + computeKillFactors() to show specific insights
					sixScores: result.compassScores,
					grade:
						(result as any).grade ||
						scoreGrade(_ob1Canonical.locationIQ),
					scoredAt: String(Date.now()),
					neighborhood:
						(result as any).neighborhood ||
						(result as any).primaryHood ||
						"",
					conceptType: visionBizType || "",
					bizType: visionBizType || "",
					// R-6: persist blockLabel from API so Dashboard card reads it directly
					blockLabel:
						(result as any).blockLabel ||
						blockTierLabel(_ob1Canonical.locationIQ) ||
						"Developing Block",
				};
				// Dedupe: if same address was scored before, replace it
				const deduped = prevLocations.filter(
					(l: any) => l.addr !== result.address,
				);
				_saveLP({
					...(existingLP as any),
					scoredLocations: [...deduped, newEntry],
					lastAddress: result.address,
					lastScore: _ob1Canonical.locationIQ,
					// FIX-SAVE-01: also persist these at top level so server reads can find them
					locationIQ: _ob1Canonical.locationIQ,
					analyzedAddress: result.address,
				} as any);
			} catch (lpErr) {
				// Non-critical — localStorage session already has the data
				console.debug(
					"[location] launchpad scoredLocations write failed:",
					lpErr,
				);
			}
		} catch {}
		setTimeout(() => {
			animateRings = true;
			// Resize map after competitors are set
			// mapRef?.resize(); // 04.25.2026: removed — mapRef migrated to analysisStore, no longer accessible here
		}, 300);
		// C4-2: Apply concept defaults via shared function (also called from cache-restore path)
		// UX-DELTA-02: launchpad.businessType wins over stale store.bizType
		const resolvedConcept = (() => {
			try {
				const lp = JSON.parse(
					localStorage.getItem("re2_launchpad") || "{}",
				);
				const sess = JSON.parse(
					localStorage.getItem("re2_session") || "{}",
				);
				return (
					lp.businessType ||
					sess.visionBizType ||
					sess.bizType ||
					store.bizType ||
					""
				);
			} catch {
				return store.bizType || "";
			}
		})();
		if (resolvedConcept) applyConceptDefaults(resolvedConcept);
		// P1-A: Persist resolved vision fields to session so they survive reload
		try {
			const _s = JSON.parse(localStorage.getItem("re2_session") || "{}");
			_s.visionBizType = visionBizType;
			_s.visionAvgCheck = visionAvgCheck;
			_s.visionFoodProgram = visionFoodProgram;
			_s.visionHours = visionHours;
			// BUG-6 FIX (part A): Write visionIQ here so session always has the post-scoring computed value.
			// The $effect at line ~1082 also writes it, but only when fitIQ > 0 && hasResult.
			// Writing here ensures the cache-restore path also gets the updated value.
			if (visionIQ > 0) _s.visionIQ = visionIQ;
			// BUG-6 FIX (part B): persist differentiators so they survive cache-restore.
			if (visionDifferentiators)
				_s.visionDifferentiators = visionDifferentiators;
			localStorage.setItem("re2_session", JSON.stringify(_s));
			try {
				window.dispatchEvent(new CustomEvent("re2:session-updated"));
			} catch {}
		} catch {}
		// Load Vision IQ questions for this business type
		loadConceptQuestions(visionBizType);
		// Fire AI insights in background (non-blocking)
		fetchAIInsights();
	}

	// ── REACTIVE COMPETITOR EXTRACTION ──────────────────────────────────────────
	// handleScoresReady fires first from the block-group fast path when
	// store.searchResult and store.liveIntel are BOTH still undefined → competitors=0.
	// The second call (live path) only fires when liveIntel succeeds AND computeSixIndex
	// returns valid indices. If liveIntel fails (Netlify 10s timeout), the second call
	// never fires and competitors stays at 0 forever.
	// 04.22.2026 Deprecating: This $effect client-side competitor extraction is a logic
	// leak. Competitors are now provided by the server via officialCompetitorsInfo
	// in the GET /api/location-iq response (built by buildLocationScoreBundle).
	// This $effect should be removed once server-provided competitors are confirmed
	// to always arrive. Keeping it active for now as a safety net, but its localStorage
	// write has been gated.
	// This $effect reactively re-extracts competitors when data becomes available.
	// CRITICAL: use untrack() on competitors to avoid Svelte 5 circular reactivity
	// (reading + writing the same $state in an effect kills the effect).
	$effect(() => {
		const sr = store.searchResult;
		const li = store.liveIntel;
		// Also read liveIntel from searchResult itself (set at same time as store.liveIntel)
		const srLiveIntel = sr?.liveIntel as Record<string, any> | undefined;
		const effectiveLI = li || srLiveIntel;
		// Only run when we have SOME data source and analysisStore.competitors is still empty
		// untrack prevents competitors from becoming a dependency → no circular reactivity
		if (untrack(() => analysisStore.competitors.length) > 0) return;
		if (!sr?.data && !effectiveLI) return;

		const allComps: Array<{
			name: string;
			lat: number;
			lng: number;
			dist?: number;
			type?: string;
		}> = [];
		const concept = writeCanonicalConcept(
			visionBizType || store.bizCategory || "specialty_coffee",
		);
		const seenNames = new Set<string>();
		const addC = (
			name: string,
			lat: number,
			lng: number,
			dist?: number,
			type?: string,
		) => {
			const key = (name || "").toLowerCase().trim();
			if (!key || seenNames.has(key)) return;
			seenNames.add(key);
			allComps.push({ name, lat, lng, dist, type });
		};

		const FOOD_BEV = [
			"specialty_coffee",
			"bakery",
			"fast_casual",
			"full_service_restaurant",
			"qsr",
			"bar_nightlife",
			"juice_bar",
			"wellness_beverage",
		];
		const FITNESS_WELLNESS = [
			"fitness_studio",
			"wellness_spa",
			"personal_services",
		];
		const HEALTH_MEDICAL = ["medical_office"];

		// Source 1: Raw Overpass from store.searchResult.data
		const data = sr?.data as Record<string, any> | undefined;
		if (data) {
			if (
				FOOD_BEV.includes(concept) ||
				concept === "retail" ||
				concept === "florist"
			) {
				for (const c of data.cafes || []) {
					if (c.lat && c.lon)
						addC(c.name || "Cafe", c.lat, c.lon, c.dist, "Cafe");
				}
				for (const c of data.restaurants || []) {
					if (c.lat && c.lon)
						addC(
							c.name || "Restaurant",
							c.lat,
							c.lon,
							c.dist,
							"Restaurant",
						);
				}
			}
			// D15: bars missing from raw Overpass iteration for bar_nightlife concepts
			if (concept === "bar_nightlife" || concept === "bar") {
				for (const c of data.bars || []) {
					if (c.lat && c.lon)
						addC(c.name || "Bar", c.lat, c.lon, c.dist, "Bar");
				}
				for (const c of data.restaurants || []) {
					if (c.lat && c.lon)
						addC(
							c.name || "Restaurant",
							c.lat,
							c.lon,
							c.dist,
							"Restaurant",
						);
				}
			}
			if (FITNESS_WELLNESS.includes(concept)) {
				for (const c of data.gyms || []) {
					if (c.lat && c.lon)
						addC(c.name || "Gym", c.lat, c.lon, c.dist, "Gym");
				}
				for (const c of data.yoga || []) {
					if (c.lat && c.lon)
						addC(c.name || "Yoga", c.lat, c.lon, c.dist, "Yoga");
				}
			}
			if (
				FITNESS_WELLNESS.includes(concept) ||
				HEALTH_MEDICAL.includes(concept) ||
				concept === "juice_bar" ||
				concept === "wellness_beverage"
			) {
				for (const c of data.health || []) {
					if (c.lat && c.lon)
						addC(
							c.name || "Health",
							c.lat,
							c.lon,
							c.dist,
							"Health",
						);
				}
			}
		}

		// Source 2: liveIntel.competitors.amenities (use effectiveLI which merges both sources)
		// D15: extended type to include bars/wellness/retail/personal buckets from OverpassData
		const intelComps = effectiveLI?.competitors as
			| {
					amenities?: {
						cafes?: any[];
						restaurants?: any[];
						gyms?: any[];
						yoga?: any[];
						health?: any[];
						bars?: any[];
						wellness?: any[];
						retail?: any[];
						personal?: any[];
					};
			  }
			| undefined;
		if (intelComps?.amenities) {
			const am = intelComps.amenities;
			if (
				FOOD_BEV.includes(concept) ||
				concept === "retail" ||
				concept === "florist"
			) {
				for (const c of am.cafes || []) {
					if (c.lat && c.lng)
						addC(
							c.name || "Cafe",
							c.lat,
							c.lng,
							c.distance,
							"Cafe",
						);
				}
				for (const c of am.restaurants || []) {
					if (c.lat && c.lng)
						addC(
							c.name || "Restaurant",
							c.lat,
							c.lng,
							c.distance,
							"Restaurant",
						);
				}
			}
			// D15: iterate bars for bar_nightlife
			if (concept === "bar_nightlife" || concept === "bar") {
				for (const c of am.bars || []) {
					if (c.lat && c.lng)
						addC(c.name || "Bar", c.lat, c.lng, c.distance, "Bar");
				}
				for (const c of am.restaurants || []) {
					if (c.lat && c.lng)
						addC(
							c.name || "Restaurant",
							c.lat,
							c.lng,
							c.distance,
							"Restaurant",
						);
				}
			}
			if (FITNESS_WELLNESS.includes(concept)) {
				for (const c of am.gyms || []) {
					if (c.lat && c.lng)
						addC(c.name || "Gym", c.lat, c.lng, c.distance, "Gym");
				}
				for (const c of am.yoga || []) {
					if (c.lat && c.lng)
						addC(
							c.name || "Yoga",
							c.lat,
							c.lng,
							c.distance,
							"Yoga",
						);
				}
				for (const c of am.wellness || []) {
					if (c.lat && c.lng)
						addC(
							c.name || "Wellness",
							c.lat,
							c.lng,
							c.distance,
							"Wellness",
						);
				}
			}
			if (
				FITNESS_WELLNESS.includes(concept) ||
				HEALTH_MEDICAL.includes(concept) ||
				concept === "juice_bar" ||
				concept === "wellness_beverage"
			) {
				for (const c of am.health || []) {
					if (c.lat && c.lng)
						addC(
							c.name || "Health",
							c.lat,
							c.lng,
							c.distance,
							"Health",
						);
				}
			}
			if (
				concept === "retail" ||
				concept === "boutique" ||
				concept === "florist"
			) {
				for (const c of am.retail || []) {
					if (c.lat && c.lng)
						addC(
							c.name || "Retail",
							c.lat,
							c.lng,
							c.distance,
							"Retail",
						);
				}
			}
			if (
				concept === "personal_services" ||
				concept === "salon" ||
				concept === "barbershop"
			) {
				for (const c of am.personal || []) {
					if (c.lat && c.lng)
						addC(
							c.name || "Personal",
							c.lat,
							c.lng,
							c.distance,
							"Personal",
						);
				}
			}
		}

		// Source 3: liveIntel.places (Google Places Nearby Search)
		const intelPlaces = effectiveLI?.places;
		const placesArr = Array.isArray(intelPlaces)
			? intelPlaces
			: (intelPlaces as any)?.places || [];
		for (const p of placesArr) {
			if (p.lat && p.lng)
				addC(
					p.name || "Nearby Business",
					p.lat,
					p.lng,
					p.distance,
					"Competitor",
				);
		}

		// Source 4: Yelp directCompetitors
		const yelpData = effectiveLI?.yelp as
			| {
					directCompetitors?: Array<{
						name?: string;
						lat?: number;
						lng?: number;
						distance?: number;
						primaryCategory?: string;
					}>;
			  }
			| undefined;
		if (yelpData?.directCompetitors) {
			for (const c of yelpData.directCompetitors) {
				if (c.lat && c.lng)
					addC(
						c.name || "Competitor",
						c.lat,
						c.lng,
						c.distance,
						c.primaryCategory || "Competitor",
					);
			}
		}

		if (allComps.length > 0) {
			analysisStore.competitors = allComps;
			console.log(
				`[RE²] $effect competitor extraction: ${allComps.length} from reactive sources`,
			);
			// 04.22.2026 Deprecating: L1 localStorage write from $effect path.
			// Competitors should only be cached when received from the server.
			// L1: also persist from $effect path (covers liveIntel-only case)
			try {
				const _addr = store.searchResult?.addr as string | undefined;
				if (_addr)
					localStorage.setItem(
						"re2_competitors",
						JSON.stringify({ addr: _addr, items: allComps }),
					);
			} catch {}
		}
	});

	// Co-Pilot: send user question to /api/copilot/location
	async function handleCoPilotMessage(text: string): Promise<string> {
		// P0-D FIX: Gate on analysisAddress (always set after analysis), not geoid (often null for outer boroughs).
		// Also pass full scoring context so the AI actually knows what's on screen.
		if (!analysisAddress)
			return "Please analyze an address first so I can answer questions about it.";

		const geoid =
			currentGeoid ||
			(() => {
				try {
					return (
						JSON.parse(localStorage.getItem("re2_session") || "{}")
							.geoid || ""
					);
				} catch {
					return "";
				}
			})();

		const session = (() => {
			try {
				return JSON.parse(localStorage.getItem("re2_session") || "{}");
			} catch {
				return {};
			}
		})();

		// BUG-JWT-COPILOT (2026-04-18)
		// requireAuth() on the server reads Authorization: Bearer <token>.
		// apiFetch() is a plain fetch wrapper — it NEVER injects a Bearer token,
		// so every call returned 401 immediately. authedFetch() calls
		// Clerk.session.getToken({ skipCache: true }) before each request and
		// sets the Authorization header automatically.
		const res = await authedFetch("/api/copilot/location", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				geoid,
				question: text,
				action: "ask_question",
				// Full scoring context — the AI needs this to answer questions about the current page
				// BR-07: enriched with verdict, kill factors, analysisStore.competitorScanStatus
				scoringContext: {
					address: analysisAddress,
					concept:
						visionBizType ||
						store.bizType ||
						session.bizType ||
						"specialty_coffee", // UX-DELTA-05: launchpad-first
					// For editorial-signals lookup. Prefer a real neighborhood name; fall back
					// to the full address (getNeighborhoodBuzz does fuzzy substring matching).
					// Strip borough-only values from the geoidToBorough fallback path — they
					// won't match any neighborhoodBuzz key and just prevent address fallback.
					neighborhood: (() => {
						const borough_only =
							/^(brooklyn|manhattan|queens|bronx|staten island|nyc)$/i;
						const n =
							locationNeighborhood &&
							!borough_only.test(locationNeighborhood.trim())
								? locationNeighborhood
								: analysisAddress;
						return n || undefined;
					})(),
					locationIQ,
					fitIQ,
					visionIQ,
					subScores: {
						// Match UI display priority: sixIndex live value wins over cached sixScores
						transit:
							sixIndex?.indices?.transit?.score ??
							sixScores.transit,
						safety:
							sixIndex?.indices?.safety?.score ??
							sixScores.safety,
						demographics:
							sixIndex?.indices?.demographics?.score ??
							sixScores.demographics,
						vibrancy:
							sixIndex?.indices?.vibrancy?.score ??
							sixScores.vibrancy,
						// FIX-D: marketProof comes from fitSubScores (Cycle 2H), not sixScores
						marketProof:
							fitSubScores.market_proof ??
							sixIndex?.indices?.competition?.score ??
							sixScores.competition,
						momentum:
							sixIndex?.indices?.momentum?.score ??
							sixScores.momentum,
						// Also surface the two highest-impact signals for CoPilot context
						survivalRate: sixScores.survivalRate,
						neighborhoodHealth: sixScores.neighborhoodHealth,
					},
					fitVerdict: fitVerdictFromAnalyzer,
					// BR-UX-07: send canonical grade + tier + nextTier + score so the CoPilot can
					// frame answers in BR-1 vocabulary instead of raw numbers. All derived via
					// decision-engine helpers — single source of truth.
					score: fitIQ > 0 ? fitIQ : undefined,
					grade: fitIQ > 0 ? fitGrade(fitIQ) : undefined,
					tier: fitIQ > 0 ? fitTierLabel(fitIQ) : undefined,
					nextTier: fitIQ > 0 ? fitNextTier(fitIQ) : undefined,
					surface: "location_hero",
					// BR-07 enrichments — make Co-Pilot responses more specific and less generic:
					verdict:
						fitIQ > 0
							? getVerdict(
									{ locationIQ, fitIQ, visionIQ },
									sixScores,
								)
							: null,
					killFactors: fitIQ > 0 ? computeKillFactors(sixScores) : [],
					competitorScanStatus: analysisStore.competitorScanStatus,
					competitorCount: analysisStore.competitors.length,
					// BR-12: Vision IQ completion — lets Co-Pilot guide the founder on what to fill in
					visionCompletionPct,
					visionIsPrelim,
					visionFieldsStatus,
					// BR-13: data source coverage — Co-Pilot can say "based on N of M sources"
					dataCompleteness,
					// BR-14: data freshness — Co-Pilot can reference when data was fetched
					dataVintage,
				},
				// COP-01: DOF property tax snippet (per-address, not block-group)
				propertyTaxSnippet: (() => {
					const pt = session.propertyTax;
					if (!pt || !pt.annualTax) return undefined;
					if (pt.hasTaxLien)
						return "This property has outstanding tax liens — a serious risk signal. Discuss building financial stability with your attorney before signing any lease.";
					const pct5yr = Math.round((pt.escalation5yr || 0) * 100);
					const annPct = Math.round((pt.escalationAnnual || 0) * 100);
					const monthly = Math.round(pt.monthlyTaxPassThrough || 0);
					if (pt.escalationRisk === "CRITICAL")
						return `Property taxes have risen ${pct5yr}% in 5 years (${annPct}%/year). Monthly tax pass-through: ~$${monthly.toLocaleString()}. Negotiate a hard tax escalation cap in your lease.`;
					if (pt.escalationRisk === "HIGH")
						return `Property taxes have risen ${pct5yr}% in 5 years. Monthly tax pass-through: ~$${monthly.toLocaleString()}. Ask for a tax escalation cap.`;
					if (monthly > 0)
						return `Property taxes are stable (${pct5yr}% over 5 years). Estimated monthly tax pass-through: ~$${monthly.toLocaleString()}.`;
					return undefined;
				})(),
				launchpad: {
					businessType:
						visionBizType ||
						session.bizType ||
						store.bizType ||
						"coffee_shop", // UX-DELTA-05: launchpad-first
					budget: session.budgetRange || "",
					rent: session.rentBudget || "",
					targetCustomer: session.targetCustomer || "",
					experience: session.experience || "",
					riskTolerance: session.riskTolerance || "",
				},
			}),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			return (
				err.message || "Sorry, something went wrong. Please try again."
			);
		}

		const data = await res.json();
		return data.message || "I don't have enough data to answer that yet.";
	}

	// Derived: Location IQ — read from localStorage if set by callback, else compute from sixScores
	let storedLocationIQ = $state(0);
	let locationIQ = $derived.by(() => {
		if (storedLocationIQ > 0) return storedLocationIQ;
		const s = sixScores;
		if (!s.transit && !s.demographics) return 0;
		// DYNC-008: concept-aware fallback weights (API result overwrites on success)
		const _lw = getLocationWeights(visionBizType);
		const w: Record<string, number> = {
			transit: _lw.transit,
			demographics: _lw.demographics,
			competition: _lw.competition,
			vibrancy: _lw.vibrancy,
			safety: _lw.safety,
			momentum: _lw.footTraffic,
		};
		let total = 0;
		let wSum = 0;
		for (const [k, weight] of Object.entries(w)) {
			if (s[k] != null) {
				total += s[k] * weight;
				wSum += weight;
			}
		}
		return wSum > 0 ? Math.round(total / wSum) : 0;
	});

	// ── VISION IQ: Dynamic scoring from form inputs + location data ──
	// Vision IQ measures how well THIS concept fits THIS location.
	// It recomputes every time a Vision form field changes.

	// UX-2.4: VISION_ARCHETYPES + DEFAULT_ARCHETYPE now imported from
	// $lib/constants/visionArchetypes (B2-1.4). Previously inlined here; server
	// routes (e.g. /api/score/preview) couldn't consume it, causing 5–10 point
	// visionIQ drift between client and server. Shared module eliminates that.

	// C2-FIX-05: Fallback daypart map when getConceptDefaults hasn't set visionHours
	const HOURS_BY_CONCEPT: Record<string, string> = {
		bar_nightlife: "evening",
		full_service_restaurant: "evening",
		retail: "all_day",
		fast_casual: "all_day",
		qsr: "all_day",
		personal_services: "all_day",
		medical_office: "all_day",
		florist: "all_day",
		coworking: "all_day",
		wellness_spa: "all_day",
		specialty_coffee: "morning",
		bakery: "morning",
		fitness_studio: "morning",
		juice_bar: "morning",
		wellness_beverage: "morning",
	};
	// Normalize onboarding hours values to canonical scoring categories (morning/evening/all_day)
	const HOURS_DAYPART_MAP: Record<string, string> = {
		early_morning: "morning",
		morning_heavy: "morning",
		standard: "all_day",
		standard_retail: "all_day",
		dinner: "evening",
		evening: "evening",
		split_am_pm: "morning",
		all_day: "all_day",
		late_night: "evening",
		"24_7": "all_day",
	};
	// Resolved visionHours — uses session value, falls back to concept map, then 'all_day'
	let resolvedVisionHours = $derived(
		visionHours || HOURS_BY_CONCEPT[visionBizType] || "all_day",
	);

	// ── Vision IQ 4-panel: concept group → drives label + field slot swaps ────
	const VIQ_GROUPS: Record<string, "fnb" | "wellness" | "office" | "retail"> =
		{
			specialty_coffee: "fnb",
			bakery: "fnb",
			fast_casual: "fnb",
			full_service_restaurant: "fnb",
			qsr: "fnb",
			bar_nightlife: "fnb",
			juice_bar: "fnb",
			wellness_beverage: "fnb",
			fitness_studio: "wellness",
			wellness_spa: "wellness",
			personal_services: "wellness",
			medical_office: "office",
			coworking: "office",
			retail: "retail",
			florist: "retail",
		};
	const bizGroup = $derived(VIQ_GROUPS[visionBizType] ?? "fnb");

	// Panel 2: avg check label adapts per group
	const viqCheckLabel = $derived(
		bizGroup === "wellness"
			? "Session / class fee"
			: bizGroup === "office"
				? visionBizType === "coworking"
					? "Monthly desk fee"
					: "Avg visit fee"
				: bizGroup === "retail"
					? "Avg transaction"
					: "Avg check",
	);

	// Panel 2: avg check placeholder adapts per group
	const viqCheckPlaceholder = $derived(
		bizGroup === "wellness"
			? "e.g. $35"
			: bizGroup === "office"
				? visionBizType === "coworking"
					? "e.g. $500/mo"
					: "e.g. $150"
				: bizGroup === "retail"
					? "e.g. $45"
					: "e.g. $8.75",
	);

	// Panel 3 slot 3: F&B shows Food Program, all others show Team Size
	const viqShowFoodProgram = $derived(bizGroup === "fnb");

	// Panel 3: target size placeholder shows concept-appropriate hint
	const viqSizeHint = $derived(
		visionBizType === "coworking"
			? "Ideal: 2,000–8,000 sqft"
			: visionBizType === "full_service_restaurant"
				? "Ideal: 1,500–4,000 sqft"
				: visionBizType === "fitness_studio"
					? "Ideal: 1,500–5,000 sqft"
					: bizGroup === "fnb"
						? "Ideal: 300–2,000 sqft"
						: bizGroup === "wellness"
							? "Ideal: 400–3,000 sqft"
							: "Select range",
	);

	// Panel completeness per panel (drives pts badge colour)
	const viqP1Done = $derived(
		!!(visionBizType && visionStoreType && visionDifferentiators.trim()),
	);
	const viqP2Done = $derived(
		!!(visionTargetClients && visionAvgCheck && visionTargetAge),
	);
	const viqP3Done = $derived(
		!!(
			visionHours &&
			visionTargetSize &&
			(viqShowFoodProgram ? visionFoodProgram : visionEmployees)
		),
	);
	const viqP4Done = $derived(!!(visionCreditScore && visionInitialCapital));

	function parseCheckAmount(val: string): number {
		const n = parseFloat(val.replace(/[$,]/g, ""));
		return isNaN(n) ? 5.5 : n;
	}

	function parseAgeRange(val: string): [number, number] {
		const parts = val.split("-").map((s) => parseInt(s.trim()));
		if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]))
			return [parts[0], parts[1]];
		return [25, 40];
	}

	function scoreLinear(v: number, lo: number, hi: number): number {
		if (hi === lo) return 50;
		const n = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
		return Math.round(n * 100);
	}

	// Vision IQ — DYNAMIC: reacts to form inputs + location data
	let visionIQ = $derived.by(() => {
		// Touch visionRevision to subscribe to form changes
		const _rev = visionRevision;

		const arch = VISION_ARCHETYPES[visionBizType] || DEFAULT_ARCHETYPE;
		// Use real location signals when available; neutral NYC baseline (50) before address is analyzed
		// This lets founders see concept-driven score changes BEFORE picking an address
		const s =
			hasResult && locationIQ
				? sixScores
				: {
						transit: 50,
						vibrancy: 50,
						demographics: 50,
						safety: 50,
						momentum: 50,
						competition: 50,
					};
		const check = parseCheckAmount(visionAvgCheck);
		const [ageLo, ageHi] = parseAgeRange(visionTargetAge);

		// ── Dimension 1: Competition fit (concept-specific) ──
		// Lower competition = better for new entrants
		const rawComp = s.competition || 50;
		let competitionFit = rawComp; // High competition score = low competition density = good

		// ── Dimension 2: Price-Income fit ──
		// Does the avg check align with area median income?
		let priceIncomeFit = 50;
		try {
			const session = JSON.parse(
				localStorage.getItem("re2_session") || "{}",
			);
			const intel = JSON.parse(
				sessionStorage.getItem("re2_location_intel") || "{}",
			);
			const medianIncome =
				intel?.census?.medianHouseholdIncome ||
				intel?.medianHouseholdIncome ||
				0;
			if (medianIncome > 0) {
				// Annual dining spend ≈ check * visits/week * 52
				// Affordable if annual spend < 8% of income (routine) or 4% (destination)
				const annualSpend = check * 2.5 * 52; // ~2.5 visits/week assumption
				const spendRatio = annualSpend / medianIncome;
				const idealRatio = arch.footTrafficW > 0.25 ? 0.06 : 0.03; // routine vs destination
				priceIncomeFit = Math.max(
					10,
					Math.min(
						95,
						Math.round(
							100 - Math.abs(spendRatio - idealRatio) * 800,
						),
					),
				);
			} else {
				// No income data: check if avg check is in ideal range for archetype
				const [lo, hi] = arch.idealCheck;
				if (check >= lo && check <= hi) priceIncomeFit = 75;
				else if (check < lo)
					priceIncomeFit = Math.max(30, 75 - (lo - check) * 5);
				else priceIncomeFit = Math.max(30, 75 - (check - hi) * 3);
			}
		} catch {
			const [lo, hi] = arch.idealCheck;
			priceIncomeFit = check >= lo && check <= hi ? 70 : 45;
		}

		// ── Concept-specific price ceiling — prevents income-paradox in high-income areas ──
		// Without this, a $95 coffee in SoHo (medianIncome $120K) can score HIGHER than $8.75
		// because the spendRatio formula rewards being closer to idealRatio × income.
		// A $95 coffee is wrong everywhere; income level doesn't change that.
		const PRICE_CEILINGS: Record<string, number> = {
			specialty_coffee: 20,
			bakery: 25,
			fast_casual: 40,
			full_service_restaurant: 150,
			qsr: 30,
			bar_nightlife: 80,
			juice_bar: 35,
			wellness_beverage: 30,
			retail: 300,
			fitness_studio: 100,
			personal_services: 120,
			wellness_spa: 400,
			medical_office: 600,
			florist: 300,
			coworking: 2000,
		};
		const _priceCeiling =
			PRICE_CEILINGS[visionBizType] ?? arch.idealCheck[1] * 3;
		if (check > _priceCeiling) {
			const _overagePoints = Math.floor((check - _priceCeiling) * 1.5);
			priceIncomeFit = Math.max(10, priceIncomeFit - _overagePoints);
		}

		// ── Dimension 3: Age/demographics alignment ──
		let ageFit = s.demographics || 50;
		// Bonus if area age profile matches target (young area + young target, etc.)
		const midAge = (ageLo + ageHi) / 2;
		if (midAge < 30 && (s.vibrancy || 50) >= 65)
			ageFit = Math.min(95, ageFit + 10); // Young crowd + vibrant area
		if (midAge > 45 && (s.safety || 50) >= 70)
			ageFit = Math.min(95, ageFit + 8); // Older crowd + safe area
		if (midAge >= 30 && midAge <= 45) ageFit = Math.min(95, ageFit + 5); // Universal sweet spot

		// ── Dimension 4: Hours/accessibility fit ──
		let hoursFit = s.transit || 50;
		// Normalize raw visionHours value to canonical scoring category
		const hoursCategory =
			HOURS_DAYPART_MAP[visionHours] || visionHours || "all_day";
		if (hoursCategory === "morning" && arch.peakHours === "morning")
			hoursFit = Math.min(95, hoursFit + 8);
		else if (hoursCategory === "evening" && (s.vibrancy || 50) >= 60)
			hoursFit = Math.min(95, hoursFit + 6);
		else if (hoursCategory === "all_day")
			hoursFit = Math.min(90, hoursFit + 3);
		// Penalty for mismatch: morning-only business in evening-dominated area
		if (hoursCategory === "morning" && arch.peakHours === "evening")
			hoursFit = Math.max(20, hoursFit - 12);
		if (hoursCategory === "evening" && arch.peakHours === "morning")
			hoursFit = Math.max(20, hoursFit - 10);

		// ── Dimension 5: Food program fit ──
		let foodFit = 60;
		if (visionFoodProgram === "full_kitchen" && (s.vibrancy || 50) >= 60)
			foodFit = 75;
		else if (
			visionFoodProgram === "light_bites" &&
			arch.footTrafficW >= 0.3
		)
			foodFit = 72;
		else if (visionFoodProgram === "grab_go" && (s.transit || 50) >= 65)
			foodFit = 78;
		else if (visionFoodProgram === "none") foodFit = 55;

		// ── Dimension 6: Differentiator bonus ──
		let diffBonus = 0;
		// Completion bonus: rewards founders who specify their vision vs. leaving defaults
		const diffWords = visionDifferentiators.trim()
			? visionDifferentiators
					.trim()
					.split(/[\s,;]+/)
					.filter((w: string) => w.length > 2).length
			: 0;
		// BUG-10 FIX: compare against concept-specific default, not hardcoded coffee defaults.
		// applyConceptDefaults() sets visionAvgCheck to '24' for bar_nightlife, '25' for fitness, etc.
		// Those values were not in the old ['$5.50','5.50','$6–10'] list → _hasCustomCheck = true
		// → _userHasCustomized = true → FIX-C never activated → client score (86–92) shown always.
		const _conceptCheckDefault = AVG_CHECK_DEFAULTS[visionBizType] || "";
		const _stripDollar = (s: string) => s.replace(/^\$/, "").trim();
		const hasNonDefaultCheck =
			visionAvgCheck &&
			_stripDollar(visionAvgCheck) !== "" &&
			_stripDollar(visionAvgCheck) !== _conceptCheckDefault;
		const hasNonDefaultAge = visionTargetAge && visionTargetAge !== "24-42";
		// AF-03 FIX: reduced from max-20 to max-13 so completionBonus can't overwhelm price/income penalties
		const completionBonus =
			Math.min(8, diffWords * 2) +
			(hasNonDefaultCheck ? 3 : 0) +
			(hasNonDefaultAge ? 2 : 0);
		diffBonus = Math.min(13, completionBonus);

		// ── Dimension 7: Rent-to-revenue fit (F2 feedback) ──
		// If founder has entered a rent budget, grade it against concept-specific max rent % of revenue
		let rentPenalty = 0;
		try {
			const lp = JSON.parse(
				localStorage.getItem("re2_launchpad") || "{}",
			);
			const monthlyRent = lp.financialGoals?.monthlyRentBudget || 0;
			if (monthlyRent > 0) {
				const kpi = CONCEPT_KPIS[visionBizType];
				const maxPct = kpi?.maxRentPercent || 12;
				const annualRent = monthlyRent * 12;
				const projRevenue = (() => {
					const v = kpi?.coaching?.breakEvenAnnualRevenue;
					if (!v)
						console.warn(
							"[RE2] Missing breakEvenAnnualRevenue for concept:",
							visionBizType,
						);
					return v ?? 400_000;
				})();
				const rentPct = (annualRent / projRevenue) * 100;
				if (rentPct > maxPct * 1.5)
					rentPenalty = -12; // severe: 1.5× over benchmark
				else if (rentPct > maxPct)
					rentPenalty = -6; // over benchmark
				else if (rentPct <= maxPct * 0.7) rentPenalty = 3; // well within — small bonus
			}
		} catch {
			/* no launchpad data — skip */
		}

		// ── Dimension 8: Store type fit (B-commit new field) ──
		let storeTypeMod = 0;
		if (visionStoreType) {
			const transit = s.transit || 50;
			if (visionStoreType === "prominent_storefront")
				storeTypeMod = transit >= 70 ? 4 : 2;
			else if (visionStoreType === "kiosk")
				storeTypeMod = transit >= 80 ? 5 : 1;
			else if (visionStoreType === "large_sitdown")
				storeTypeMod = arch.peakHours === "evening" ? 3 : -1;
			else if (visionStoreType === "shared") storeTypeMod = -2;
			else if (visionStoreType === "popup") storeTypeMod = -3;
		}

		// ── Dimension 9: Target size fit (B-commit new field) ──
		let sizeMod = 0;
		if (visionTargetSize) {
			// Concept-specific ideal size ranges (sqft midpoint)
			const IDEAL_SIZE: Record<string, [number, number]> = {
				specialty_coffee: [400, 1200],
				bakery: [500, 1500],
				fast_casual: [800, 2000],
				full_service_restaurant: [1500, 4000],
				qsr: [600, 1500],
				bar_nightlife: [1000, 3000],
				juice_bar: [300, 800],
				wellness_beverage: [300, 800],
				retail: [500, 3000],
				fitness_studio: [1500, 5000],
				personal_services: [400, 1500],
				wellness_spa: [1000, 3000],
				medical_office: [800, 2500],
				florist: [300, 1000],
				coworking: [2000, 8000],
			};
			const SIZE_MID: Record<string, number> = {
				under_500: 350,
				"500_1000": 750,
				"1000_2000": 1500,
				"2000_5000": 3500,
				"5000_plus": 7000,
			};
			const userMid = SIZE_MID[visionTargetSize] || 1000;
			const [idealLo, idealHi] = IDEAL_SIZE[visionBizType] || [500, 3000];
			if (userMid >= idealLo && userMid <= idealHi) sizeMod = 3;
			else if (userMid < idealLo)
				sizeMod = userMid < idealLo * 0.5 ? -3 : 0;
			else sizeMod = userMid > idealHi * 1.5 ? -4 : -1; // oversized = rent burden
		}

		// ── Dimension 10: Target client fit (B-commit new field) ──
		let clientMod = 0;
		if (visionTargetClients) {
			const vibrancy = s.vibrancy || 50;
			const transit = s.transit || 50;
			const demographics = s.demographics || 50;
			if (
				visionTargetClients === "young_professionals" &&
				vibrancy >= 60 &&
				demographics >= 50
			)
				clientMod = 3;
			else if (
				visionTargetClients === "families" &&
				(s.safety || 50) >= 60 &&
				demographics >= 55
			)
				clientMod = 3;
			else if (visionTargetClients === "students" && vibrancy >= 65)
				clientMod = 2;
			else if (visionTargetClients === "fitness_crowd" && transit >= 60)
				clientMod = 2;
			else if (visionTargetClients === "remote_workers" && vibrancy >= 50)
				clientMod = 2;
			else if (
				visionTargetClients === "tourists" &&
				transit >= 70 &&
				vibrancy >= 60
			)
				clientMod = 3;
			else if (visionTargetClients === "mixed") clientMod = 1;
			else if (visionTargetClients) clientMod = 0; // selected but doesn't match area = neutral
		}

		// ── Weighted composite ──
		const weighted =
			competitionFit * arch.competitionW +
			priceIncomeFit * arch.demographicsW + // price-income uses demographics weight
			ageFit * arch.vibrancyW + // age uses vibrancy weight
			hoursFit * arch.footTrafficW + // hours uses foot traffic weight
			foodFit * 0.1; // food is a fixed 10% factor

		// Normalize: weights sum to 1.0 (archetype) + 0.10 (food) = 1.10
		const normalized = weighted / 1.1;
		// New field modifiers are additive (like diffBonus/rentPenalty) to preserve calibration
		const clientScore = Math.max(
			0,
			Math.min(
				100,
				Math.round(
					normalized +
						diffBonus +
						rentPenalty +
						storeTypeMod +
						sizeMod +
						clientMod,
				),
			),
		);

		// FIX-C: When the user hasn't meaningfully customized their concept inputs (i.e. still on defaults
		// with no differentiators entered and no concept questions answered), prefer the DB-calibrated
		// server Vision IQ — it's the ensemble model score for this exact block group × concept.
		// Once the user starts editing (differentiators, avg check, concept Qs), client score takes over.
		const _hasCustomDiff =
			visionDifferentiators
				.trim()
				.split(/[\s,;]+/)
				.filter((w: string) => w.length > 2).length >= 1;
		const _hasCustomCheck =
			visionAvgCheck &&
			_stripDollar(visionAvgCheck) !== "" &&
			_stripDollar(visionAvgCheck) !==
				(AVG_CHECK_DEFAULTS[visionBizType] || "");
		const _hasConceptQAnswers =
			Object.keys(conceptAnswers).filter(
				(k: string) => conceptAnswers[k] !== "",
			).length > 0;
		const _userHasCustomized =
			_hasCustomDiff || _hasCustomCheck || _hasConceptQAnswers;
		if (
			serverVisionIQ &&
			serverVisionIQ > 0 &&
			hasResult &&
			!_userHasCustomized
		) {
			return serverVisionIQ;
		}
		return clientScore;
	});

	// ── Vision validation flags ── red flags for absurd or misaligned inputs
	type VisionFlag = {
		level: "warning" | "error";
		field: string;
		message: string;
		projection?: { targetLabel: string; simVIQ: number; delta: number };
	};
	const visionFlags = $derived.by((): VisionFlag[] => {
		const _rev = visionRevision; // subscribe to form changes
		const flags: VisionFlag[] = [];
		const check = parseCheckAmount(visionAvgCheck);
		const [idealLo, idealHi] = getIdealCheckRange(visionBizType);
		const conceptPeakHours = getPeakHours(visionBizType);

		// Flag 1: Absurd pricing (>5× concept high end)
		if (check > idealHi * 5 && check > 0) {
			const targetVal = `${idealHi}`;
			const simVIQ = simulateVisionIQ({ avgCheck: targetVal });
			const delta = simVIQ - visionIQ;
			flags.push({
				level: "error",
				field: "avgCheck",
				message: `$${check.toFixed(0)} avg check is ${Math.round(check / idealHi)}× the typical range for this concept ($${idealLo}–$${idealHi}). Double-check your pricing.`,
				projection: {
					targetLabel: `Set to $${idealHi}`,
					simVIQ,
					delta,
				},
			});
		}
		// Flag 2: Below viable floor (<40% of low end)
		else if (check < idealLo * 0.4 && check > 0) {
			const targetVal = `${idealLo}`;
			const simVIQ = simulateVisionIQ({ avgCheck: targetVal });
			const delta = simVIQ - visionIQ;
			flags.push({
				level: "warning",
				field: "avgCheck",
				message: `$${check.toFixed(2)} may be below the profitable range for this concept (typical: $${idealLo}–$${idealHi}).`,
				projection: {
					targetLabel: `Raise to $${idealLo}`,
					simVIQ,
					delta,
				},
			});
		}

		// Flag 3: No differentiators entered
		if (!visionDifferentiators || !visionDifferentiators.trim()) {
			const simVIQ = simulateVisionIQ({
				differentiators: "example, specialty",
			});
			const delta = simVIQ - visionIQ;
			flags.push({
				level: "warning",
				field: "differentiators",
				message:
					"No differentiators entered. Adding at least 2 specific points boosts your score.",
				projection: {
					targetLabel: "Add 2+ differentiators",
					simVIQ,
					delta,
				},
			});
		}

		// Flag 4: Hours conflict with concept peak times
		if (
			resolvedVisionHours === "morning" &&
			conceptPeakHours === "evening"
		) {
			const simVIQ = simulateVisionIQ({ hours: "all_day" });
			const delta = simVIQ - visionIQ;
			flags.push({
				level: "warning",
				field: "hours",
				message: `Morning-only hours conflict with peak demand for this concept. Consider extending to evening.`,
				projection: { targetLabel: "Switch to All day", simVIQ, delta },
			});
		}
		if (
			resolvedVisionHours === "evening" &&
			conceptPeakHours === "morning"
		) {
			const simVIQ = simulateVisionIQ({ hours: "all_day" });
			const delta = simVIQ - visionIQ;
			flags.push({
				level: "warning",
				field: "hours",
				message: `Evening-only hours miss the main trade window for this concept. Consider adding morning hours.`,
				projection: { targetLabel: "Switch to All day", simVIQ, delta },
			});
		}

		// Flag 5 (F2): Rent-to-revenue kill factor
		try {
			const lp = JSON.parse(
				localStorage.getItem("re2_launchpad") || "{}",
			);
			const monthlyRent = lp.financialGoals?.monthlyRentBudget || 0;
			if (monthlyRent > 0) {
				const kpi = CONCEPT_KPIS[visionBizType];
				const maxPct = kpi?.maxRentPercent || 12;
				const annualRent = monthlyRent * 12;
				const projRevenue = (() => {
					const v = kpi?.coaching?.breakEvenAnnualRevenue;
					if (!v)
						console.warn(
							"[RE2] Missing breakEvenAnnualRevenue for concept:",
							visionBizType,
						);
					return v ?? 400_000;
				})();
				const rentPct = Math.round((annualRent / projRevenue) * 100);
				if (rentPct > maxPct) {
					flags.push({
						level: rentPct > maxPct * 1.5 ? "error" : "warning",
						field: "rent",
						message: `Rent is ${rentPct}% of projected revenue — ${visionBizType.replace(/_/g, " ")} benchmarks cap at ${maxPct}%. $${monthlyRent.toLocaleString()}/mo needs ~$${Math.round(annualRent / (maxPct / 100)).toLocaleString()}/yr revenue to be viable.`,
					});
				}
			}
		} catch {
			/* skip */
		}

		return flags;
	});

	// Derived: Fit IQ — UNIFIED score (C1 fix: server-side is source of truth)
	// When server-side fitScore is available (from block_group_intel or fit-iq-engine.ts),
	// use it directly so the CoPilot and UI always agree.
	// Falls back to client-side 55/45 blend only when server score is unavailable.
	/* 04.22.2026 Deprecated: Client-side fitIQ blend with visionAdj + founderMod.
	 * The old formula used base = serverFitIQ (or locationIQ * 0.75 when missing)
	 * plus a visionAdj (+-10pt from visionIQ) and founderMod (+-8pt from profile).
	 * This created a client-only Fit number that differed from the server's canonical
	 * fitScore and was incorrectly persisted to localStorage/Supabase.
	 *
	 * HYBRID APPROACH: fitIQ now shows one of two server-computed values:
	 * 1. dynamicFitIQ.score — from POST /api/score/preview (fires ~300ms after
	 *    Vision field changes, uses computeCanonicalFitIQ on the server)
	 * 2. serverFitIQ — from GET /api/location-iq via buildLocationScoreBundle
	 * If neither exists (legacy data), return 0 and UI shows "Re-score needed".
	 */
	let fitIQ = $derived.by(() => {
		if (!hasResult || !locationIQ) return 0;

		// Branch 1: Dynamic fit from score/preview (server-computed, fires on Vision changes)
		if (dynamicFitIQ && dynamicFitIQ.score > 0) return dynamicFitIQ.score;

		// Branch 2: Trust stored server value only. No client-side visionAdj/founderMod.
		return serverFitIQ && serverFitIQ > 0 ? serverFitIQ : 0;
	});

	// E2b: Vision sub-score values for form fields — DYNAMIC per-field scores
	let visionFieldScores = $derived.by(() => {
		const _rev = visionRevision; // subscribe to form changes
		const s = sixScores;
		const arch = VISION_ARCHETYPES[visionBizType] || DEFAULT_ARCHETYPE;
		const check = parseCheckAmount(visionAvgCheck);
		const [ageLo, ageHi] = parseAgeRange(visionTargetAge);

		// Competition: how saturated is the area for THIS business type
		let bizTypeScore = s.competition || 50;

		// Price-Income: does avg check match area spending power
		let avgCheckScore = 50;
		try {
			const intel = JSON.parse(
				sessionStorage.getItem("re2_location_intel") || "{}",
			);
			const medianIncome =
				intel?.census?.medianHouseholdIncome ||
				intel?.medianHouseholdIncome ||
				0;
			if (medianIncome > 0) {
				const annualSpend = check * 2.5 * 52;
				const spendRatio = annualSpend / medianIncome;
				avgCheckScore = Math.max(
					15,
					Math.min(
						95,
						Math.round(100 - Math.abs(spendRatio - 0.05) * 700),
					),
				);
			} else {
				const [lo, hi] = arch.idealCheck;
				avgCheckScore =
					check >= lo && check <= hi
						? 72
						: Math.max(
								30,
								72 - Math.abs(check - (lo + hi) / 2) * 3,
							);
			}
		} catch {
			avgCheckScore = 55;
		}

		// Age alignment
		const midAge = (ageLo + ageHi) / 2;
		let targetAgeScore = s.demographics || 50;
		if (midAge < 30 && (s.vibrancy || 50) >= 65)
			targetAgeScore = Math.min(95, targetAgeScore + 10);
		if (midAge > 45 && (s.safety || 50) >= 70)
			targetAgeScore = Math.min(95, targetAgeScore + 8);
		if (midAge >= 30 && midAge <= 45)
			targetAgeScore = Math.min(95, targetAgeScore + 5);

		// Food program
		let foodProgramScore = 55;
		if (visionFoodProgram === "full_kitchen" && (s.vibrancy || 50) >= 60)
			foodProgramScore = 75;
		else if (
			visionFoodProgram === "light_bites" &&
			arch.footTrafficW >= 0.3
		)
			foodProgramScore = 72;
		else if (visionFoodProgram === "grab_go" && (s.transit || 50) >= 65)
			foodProgramScore = 78;

		// Hours
		let hoursScore = s.transit || 50;
		if (visionHours === arch.peakHours)
			hoursScore = Math.min(95, hoursScore + 8);
		else if (visionHours === "all_day")
			hoursScore = Math.min(90, hoursScore + 3);

		// Differentiators: count meaningful keywords + RE²D2 classifier boost
		let diffScore = 0;
		const _diffWords = visionDifferentiators.trim()
			? visionDifferentiators
					.trim()
					.split(/[\s,;]+/)
					.filter((w: string) => w.length > 2).length
			: 0;
		diffScore = _diffWords > 0 ? Math.min(90, 25 + _diffWords * 10) : 0;
		// RE²D2 scoreBoost is additive (classifier adds specificity signal on top of word count)
		if (diffResult && diffResult.scoreBoost > 0) {
			diffScore = Math.min(95, diffScore + diffResult.scoreBoost);
		}

		// Store type per-field score
		let storeTypeScore = 0;
		if (visionStoreType) {
			const _tr = s.transit || 50;
			if (visionStoreType === "prominent_storefront")
				storeTypeScore = _tr >= 70 ? 82 : 68;
			else if (visionStoreType === "kiosk")
				storeTypeScore = _tr >= 80 ? 85 : 60;
			else if (visionStoreType === "large_sitdown")
				storeTypeScore = arch.peakHours === "evening" ? 72 : 55;
			else if (visionStoreType === "shared") storeTypeScore = 45;
			else if (visionStoreType === "popup") storeTypeScore = 38;
		}

		// Target size per-field score
		let targetSizeScore = 0;
		if (visionTargetSize) {
			const SIZE_MID: Record<string, number> = {
				under_500: 350,
				"500_1000": 750,
				"1000_2000": 1500,
				"2000_5000": 3500,
				"5000_plus": 7000,
			};
			const IDEAL_SZ: Record<string, [number, number]> = {
				specialty_coffee: [400, 1200],
				bakery: [500, 1500],
				fast_casual: [800, 2000],
				full_service_restaurant: [1500, 4000],
				qsr: [600, 1500],
				bar_nightlife: [1000, 3000],
				juice_bar: [300, 800],
				wellness_beverage: [300, 800],
				retail: [500, 3000],
				fitness_studio: [1500, 5000],
				personal_services: [400, 1500],
				wellness_spa: [1000, 3000],
				medical_office: [800, 2500],
				florist: [300, 1000],
				coworking: [2000, 8000],
			};
			const uMid = SIZE_MID[visionTargetSize] || 1000;
			const [iLo, iHi] = IDEAL_SZ[visionBizType] || [500, 3000];
			if (uMid >= iLo && uMid <= iHi) targetSizeScore = 78;
			else if (uMid < iLo) targetSizeScore = uMid < iLo * 0.5 ? 35 : 55;
			else targetSizeScore = uMid > iHi * 1.5 ? 30 : 50;
		}

		// Target clients per-field score
		let clientsScore = 0;
		if (visionTargetClients) {
			const _vib = s.vibrancy || 50;
			const _tr = s.transit || 50;
			const _dem = s.demographics || 50;
			if (
				visionTargetClients === "young_professionals" &&
				_vib >= 60 &&
				_dem >= 50
			)
				clientsScore = 80;
			else if (
				visionTargetClients === "families" &&
				(s.safety || 50) >= 60 &&
				_dem >= 55
			)
				clientsScore = 78;
			else if (visionTargetClients === "students" && _vib >= 65)
				clientsScore = 75;
			else if (visionTargetClients === "fitness_crowd" && _tr >= 60)
				clientsScore = 72;
			else if (visionTargetClients === "remote_workers" && _vib >= 50)
				clientsScore = 73;
			else if (
				visionTargetClients === "tourists" &&
				_tr >= 70 &&
				_vib >= 60
			)
				clientsScore = 80;
			else if (visionTargetClients === "mixed") clientsScore = 60;
			else clientsScore = 50; // selected but area doesn't match
		}

		// Employees: score based on concept-appropriate staffing level
		let employeesScore = 0;
		if (visionEmployees) {
			const IDEAL_STAFF: Record<string, string[]> = {
				specialty_coffee: ["1_3", "4_8"],
				bakery: ["1_3", "4_8"],
				fast_casual: ["4_8", "9_plus"],
				full_service_restaurant: ["4_8", "9_plus"],
				qsr: ["4_8", "9_plus"],
				bar_nightlife: ["4_8", "9_plus"],
				fitness_studio: ["1_3", "4_8"],
				retail: ["1_3", "4_8"],
				personal_services: ["just_me", "1_3"],
				wellness_spa: ["1_3", "4_8"],
				medical_office: ["1_3", "4_8"],
				florist: ["just_me", "1_3"],
				coworking: ["1_3", "4_8"],
				juice_bar: ["1_3", "4_8"],
				wellness_beverage: ["just_me", "1_3"],
			};
			const ideal = IDEAL_STAFF[visionBizType] || ["1_3", "4_8"];
			if (ideal.includes(visionEmployees)) employeesScore = 78;
			else if (visionEmployees === "just_me")
				employeesScore = 45; // lean but risky
			else employeesScore = 55; // overstaffed or understaffed
		}

		// Initial Capital: score based on buildout budget coverage
		let capitalScore = 0;
		if (visionInitialCapital) {
			const CAP_MID: Record<string, number> = {
				under_25k: 15000,
				"25k_50k": 37500,
				"50k_100k": 75000,
				"100k_250k": 175000,
				"250k_plus": 350000,
			};
			const CONCEPT_BUILDOUT: Record<string, number> = {
				specialty_coffee: 150000,
				bakery: 150000,
				fast_casual: 250000,
				full_service_restaurant: 400000,
				qsr: 200000,
				bar_nightlife: 300000,
				fitness_studio: 200000,
				retail: 150000,
				personal_services: 80000,
				wellness_spa: 200000,
				medical_office: 250000,
				florist: 60000,
				coworking: 300000,
				juice_bar: 100000,
				wellness_beverage: 80000,
			};
			const cap = CAP_MID[visionInitialCapital] || 50000;
			const need = CONCEPT_BUILDOUT[visionBizType] || 200000;
			const coverage = cap / need;
			if (coverage >= 0.5) capitalScore = 82;
			else if (coverage >= 0.3) capitalScore = 65;
			else if (coverage >= 0.15) capitalScore = 48;
			else capitalScore = 30;
		}

		return {
			bizType: bizTypeScore,
			avgCheck: avgCheckScore,
			targetAge: targetAgeScore,
			foodProgram: foodProgramScore,
			hours: hoursScore,
			differentiators: diffScore,
			storeType: storeTypeScore,
			targetSize: targetSizeScore,
			targetClients: clientsScore,
			employees: employeesScore,
			initialCapital: capitalScore,
		};
	});

	// E2b: color class for vision field score
	function vfColor(val: number): string {
		if (val >= 65) return "hi";
		if (val >= 45) return "mid";
		return "lo";
	}

	// FIX-10 + FIX-11: Concept-aware UI states
	const CALIBRATED_CONCEPTS = [
		"specialty_coffee",
		"bakery",
		"fast_casual",
		"full_service_restaurant",
		"qsr",
	];
	let showConfidenceNote = $derived(
		!!visionBizType && !CALIBRATED_CONCEPTS.includes(visionBizType),
	);
	// FIX-11: Show concept hint for direct-URL users before analysis runs
	let conceptConfirmedByOnboarding = $derived(comingFromBot === true);

	// E2b: Fit IQ ring color (amber theme from wireframe)
	function fitRingColor(val: number): string {
		if (val >= 75) return "#2d6a4f"; // deep green (celebration)
		if (val >= 55) return "#c06a2a"; // burnished copper (not caution amber)
		if (val >= 40) return "#EA580C"; // orange
		return "#DC2626"; // red
	}

	// E2b: generate Fit IQ verdict text
	function fitVerdict(fit: number, loc: number, vis: number): string {
		if (fit >= 75)
			return "Strong fit. Excellent fundamentals and concept alignment for this block.";
		if (fit >= 65)
			return "Good fit. Solid fundamentals with room to optimize your concept.";
		if (fit >= 55)
			return "Moderate fit. The block has potential — refine your concept details to improve alignment.";
		if (fit >= 45)
			return "Mixed signals. Location fundamentals and concept fit need work — review the Concept panel for improvement areas.";
		if (fit >= 35)
			return "Below average. Significant gaps between this location and your concept. Consider adjusting your vision or exploring other blocks.";
		return "Weak fit. This location presents serious challenges for your concept. Explore alternative locations.";
	}

	// E2b: generate Location insight text
	function locationInsightText(): string {
		const s = sixScores;
		const strong = [];
		const weak = [];
		if ((s.transit || 0) >= 70) strong.push("transit");
		if ((s.demographics || 0) >= 70) strong.push("spending power");
		if ((s.safety || 0) >= 70) strong.push("safety");
		if ((s.vibrancy || 0) >= 70) strong.push("vibrancy");
		if ((s.safety || 0) < 55) weak.push("safety");
		if ((s.momentum || 0) < 55) weak.push("momentum");
		if ((s.competition || 0) < 55) weak.push("heavy competition");

		let text = "";
		if (strong.length) text += `Strong ${strong.join(" and ")}. `;
		if (weak.length)
			text += `Average ${weak.join("/")} — no major risks or tailwinds.`;
		else text += "Well-balanced across all dimensions.";
		return text;
	}

	// E2b: generate Vision insight text
	function visionInsightText(): string {
		const scores = visionFieldScores;
		const lowest = Object.entries(scores).reduce(
			(min, [k, v]) => (v > 0 && v < min.v ? { k, v } : min),
			{ k: "", v: 100 },
		);
		if (lowest.k === "bizType" && lowest.v < 50)
			return `Competition is the bottleneck for this concept. Differentiators or a niche angle give the biggest lift here.`;
		if (lowest.v < 50)
			return `${lowest.k === "avgCheck" ? "Price fit is below the ideal range for this location" : lowest.k === "foodProgram" ? "Food program is a drag on your score" : `${lowest.k} is holding your score back`}. Adjust to improve fit.`;
		return "Your concept aligns well with this location. Fine-tune details to maximize score.";
	}

	// E2b: handle vision form recalc — bump revision counter to trigger $derived recomputation
	function handleVisionRecalc() {
		visionRevision++;
		animateRings = false;
		setTimeout(() => {
			animateRings = true;
		}, 100);
		// UX-20: also kick a debounced preview POST so the hero ring animates to
		// the new Vision IQ + Fit IQ whenever hours / check / food program / sim
		// recommendations change. Safe no-op if sixIndex isn't loaded yet.
		triggerScorePreview();
		// UX-11: Dispatch "Saved ✓" 2s flash in layout header when vision inputs change.
		// 'syncing' fires immediately; 'synced' fires after localStorage persist completes.
		try {
			window.dispatchEvent(new CustomEvent("re2:syncing"));
			requestAnimationFrame(() =>
				window.dispatchEvent(
					new CustomEvent("re2:synced", {
						detail: { trigger: "vision_recalc" },
					}),
				),
			);
		} catch {}
	}

	// FIX: Explicit concept-change handler — resets ALL concept-specific defaults when
	// user changes business type in the Vision IQ dropdown. handleVisionRecalc() alone
	// only bumps the revision counter; it does NOT update avg check, hours, food program,
	// or reload questions, so gym would show coffee defaults. This fixes that permanently.
	function handleConceptChange() {
		// UX-3.6 (Brain 3 handoff): clear concept-specific Business Case session
		// fields on in-page concept switch. Brain 3's initFromSession auto-clear
		// catches the page-reload case; this explicit call catches the in-page
		// case so the BC store doesn't carry stale coffee avg-check into a gym.
		try {
			createBusinessCaseStore().clearConceptSpecificFields();
		} catch (err) {
			console.warn(
				"[handleConceptChange] clearConceptSpecificFields failed (non-fatal):",
				err,
			);
		}
		// RE²D2: reset differentiator classifier state — new concept = fresh start
		diffResult = null;
		differentiatorAttempts = 0;
		// F-05: Reset serverVisionIQ to force recomputation on next score read
		serverVisionIQ = null;
		// Force-apply new concept defaults (no session guards — user made an explicit choice)
		const defs = getConceptDefaults(visionBizType);
		visionAvgCheck =
			AVG_CHECK_DEFAULTS[visionBizType] || defs?.avgCheck || "";
		visionHours =
			HOURS_BY_CONCEPT[visionBizType] || defs?.hours || "all_day";
		const FOOD_BEV_CONCEPTS = [
			"specialty_coffee",
			"bakery",
			"fast_casual",
			"full_service_restaurant",
			"qsr",
			"bar_nightlife",
			"juice_bar",
			"wellness_beverage",
		];
		if (!FOOD_BEV_CONCEPTS.includes(visionBizType)) {
			visionFoodProgram = "none";
		} else {
			visionFoodProgram = defs?.foodProgram || "light_bites";
		}
		// Reload concept questionnaire for the new type
		loadConceptQuestions(visionBizType);
		// Persist new concept selection to session so downstream pages (model, co-pilot) agree
		try {
			const sess = JSON.parse(
				localStorage.getItem("re2_session") || "{}",
			);
			sess.bizType = visionBizType;
			sess.visionBizType = visionBizType;
			sess.visionAvgCheck = visionAvgCheck;
			sess.visionHours = visionHours;
			sess.visionFoodProgram = visionFoodProgram;
			localStorage.setItem("re2_session", JSON.stringify(sess));
		} catch {}
		// Trigger score recalc
		handleVisionRecalc();
	}

	// V2: Credit score change handler — persists to session for loan pre-qualification
	function handleCreditScoreChange() {
		try {
			const sess = JSON.parse(
				localStorage.getItem("re2_session") || "{}",
			);
			sess.visionCreditScore = visionCreditScore;
			localStorage.setItem("re2_session", JSON.stringify(sess));
		} catch {}
	}

	// B-commit: Persist new Vision IQ fields to session
	function handleNewVisionFieldChange() {
		try {
			const sess = JSON.parse(
				localStorage.getItem("re2_session") || "{}",
			);
			sess.visionStoreType = visionStoreType;
			sess.visionTargetSize = visionTargetSize;
			sess.visionTargetClients = visionTargetClients;
			sess.visionTargetClients2 = visionTargetClients2;
			sess.visionEmployees = visionEmployees;
			sess.visionInitialCapital = visionInitialCapital;
			localStorage.setItem("re2_session", JSON.stringify(sess));
		} catch {}
		handleVisionRecalc();
	}

	// Load concept questions after analysis (Vision IQ questionnaire)
	async function loadConceptQuestions(bizType: string) {
		try {
			const res = await apiFetch(
				`/api/concept-config?type=${encodeURIComponent(bizType)}`,
			);
			if (res.ok) {
				const data = await res.json();
				conceptQuestions = data.questions || [];
			}
		} catch {
			/* silently skip — questionnaire is enhancement */
		}
	}

	// Handle Vision IQ questionnaire answer
	async function onConceptAnswer(questionId: string, value: string) {
		visionScoreBefore =
			(dynamicVisionIQ ?? threeScores?.visionIQ)?.score ?? null;
		conceptAnswers = { ...conceptAnswers, [questionId]: value };
		try {
			const _s = JSON.parse(localStorage.getItem("re2_session") || "{}");
			_s.conceptAnswers = conceptAnswers;
			localStorage.setItem("re2_session", JSON.stringify(_s));
		} catch {}
		// F-05: Bump visionRevision so the $derived visionIQ recomputes client-side.
		// Without this, concept answer changes only updated dynamicVisionIQ via the
		// preview POST but never re-triggered the client-side scoring formula at L2273.
		// handleVisionRecalc() bumps visionRevision + triggers score preview in one call.
		handleVisionRecalc();
	}

	// Show error banner when search completes with bad steps
	$effect(() => {
		if (!store.searching && hasBadStep && !hasResult) {
			const badStep = store.searchSteps?.find((s) => s.c === "bad");
			analysisError = badStep?.t || "Analysis failed. Please try again.";
		} else if (store.searching || hasResult) {
			analysisError = "";
		}
	});

	// Persist fitIQ, visionIQ, and visionDifferentiators to localStorage so all pages stay in sync
	$effect(() => {
		if (fitIQ > 0 && hasResult) {
			try {
				const session = JSON.parse(
					localStorage.getItem("re2_session") || "{}",
				);
				session.fitIQ = fitIQ;
				session.visionIQ = visionIQ;
				session.visionBizType = visionBizType;
				// BUG-6 FIX (part C): persist differentiators so cache-restore can reconstruct
				// _hasCustomDiff correctly and visionIQ doesn't regress to serverVisionIQ on reload.
				if (visionDifferentiators)
					session.visionDifferentiators = visionDifferentiators;
				localStorage.setItem("re2_session", JSON.stringify(session));
			} catch {}
		}
	});

	// FIX-FITIQ-SYNC: After fitIQ is computed with vision + founder adjustments,
	// write it back to scoredLocations so Dashboard reads the same adjusted value.
	// Without this, Dashboard shows raw serverFitIQ, not the live-adjusted fitIQ.
	$effect(() => {
		if (fitIQ > 0 && hasResult && analysisAddress) {
			try {
				const lp = JSON.parse(
					localStorage.getItem("re2_launchpad") || "{}",
				);
				const locs = (lp.scoredLocations || []) as any[];
				const idx = locs.findIndex(
					(l: any) => l.addr === analysisAddress,
				);
				if (idx >= 0) {
					// Update the entry with the adjusted fitIQ (includes vision + founder mods)
					locs[idx] = { ...locs[idx], fitScore: fitIQ };
					lp.scoredLocations = locs;
					localStorage.setItem("re2_launchpad", JSON.stringify(lp));
				}
			} catch {}
		}
	});

	// Derived: gap between scores
	let scoreGap = $derived(Math.abs(locationIQ - fitIQ));

	// Check if Cycle 2H fit sub-scores are available
	let hasFitSubs = $derived(Object.values(fitSubScores).some((v) => v > 0));

	// Fit dimension scores — use Cycle 2H when available, else legacy six-index
	let fitDimensions = $derived.by(() => {
		if (hasFitSubs) {
			const f = fitSubScores;
			return [
				{ label: "Market\nProof", value: f.market_proof || 0 },
				{ label: "Accessibility", value: f.accessibility || 0 },
				{ label: "Competition", value: f.competition || 0 },
				{ label: "Price Fit", value: f.price_income_fit || 0 },
			];
		}
		const s = sixScores;
		return [
			{ label: "Transit &\nWalkability", value: s.transit || 0 },
			{ label: "Demographics", value: s.demographics || 0 },
			{ label: "Competition", value: s.competition || 0 },
			{ label: "Safety", value: s.safety || 0 },
		];
	});

	// Six index bars — Cycle 2H dimensions when available, else legacy
	let sixBars = $derived.by(() => {
		if (hasFitSubs) {
			const f = fitSubScores;
			return [
				{ label: "Market Proof", value: f.market_proof || 0 },
				{ label: "Accessibility", value: f.accessibility || 0 },
				{ label: "Customer Fit", value: f.demographics || 0 },
				{ label: "Competition", value: f.competition || 0 },
				{ label: "Price Fit", value: f.price_income_fit || 0 },
			];
		}
		const s = sixScores;
		return [
			{ label: "Transit", value: s.transit || 0 },
			{ label: "Demographics", value: s.demographics || 0 },
			{ label: "Competition", value: s.competition || 0 },
			{ label: "Safety", value: s.safety || 0 },
			{ label: "Momentum", value: s.momentum ?? null },
		];
	});

	// Ring math
	const BIG_CIRC = 329.87;
	const MINI_CIRC = 188.4;

	function bigOffset(score: number): number {
		return BIG_CIRC * (1 - score / 100);
	}
	function miniOffset(score: number): number {
		return MINI_CIRC * (1 - score / 100);
	}

	function ringColor(val: number): string {
		if (val >= 75) return "var(--color-primary-green)";
		if (val >= 55) return "var(--color-primary-blue)";
		if (val >= 40) return "var(--color-orange)";
		return "var(--color-red)";
	}

	function barFillClass(val: number): string {
		if (val >= 75) return "fill-green";
		if (val >= 55) return "fill-blue";
		if (val >= 40) return "fill-orange";
		return "fill-red";
	}

	function scoreGrade(val: number): string {
		if (val >= 90) return "A";
		if (val >= 85) return "A-";
		if (val >= 80) return "B+";
		if (val >= 75) return "B";
		if (val >= 70) return "B-";
		if (val >= 65) return "C+";
		if (val >= 60) return "C";
		if (val >= 55) return "C-";
		return "D";
	}

	// Display score with dash for zero/missing
	function displayScore(val: number | undefined): string {
		if (val === undefined || val === null) return "n/a";
		if (val === 0) return "n/a";
		return String(Math.round(val));
	}

	// BUG-016: Save score to database
	let saveToast = $state("");
	async function handleSave() {
		if (!analysisAddress) return;
		try {
			const session = JSON.parse(
				localStorage.getItem("re2_session") || "{}",
			);
			await authedFetch("/api/save-score", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					address: analysisAddress,
					locationIQ: storedLocationIQ,
					fitIQ: serverFitIQ || 0,
					geoid: currentGeoid,
					scores: sixScores,
				}),
			});
			saveToast = "Score saved to Dashboard.";
			setTimeout(() => {
				saveToast = "";
			}, 3000);
		} catch {
			saveToast = "Saved locally.";
			setTimeout(() => {
				saveToast = "";
			}, 3000);
		}
	}

	// ── EXPORT: Founder's Location Brief ────────────────────────────────────
	function exportFounderBrief() {
		// D16: surface clear feedback in all paths (no data, popup blocked, success)
		if (!analysisAddress) {
			showExportToast(
				"Score a location first to export a brief.",
				"warn",
			);
			return;
		}

		// Gather founder/business name
		const _lp = (() => {
			try {
				return JSON.parse(
					localStorage.getItem("re2_launchpad") || "{}",
				);
			} catch {
				return {};
			}
		})();
		const bizName: string = (_lp.businessName as string) || "";
		const _clerkUser = (window as any).Clerk?.user;
		const founderFirst: string =
			(_clerkUser?.firstName as string) ||
			(_clerkUser?.fullName as string)?.split(" ")[0] ||
			"";
		const founderDisplay: string = founderFirst || "The founder";

		// Score tier helpers (plain functions — no reactive deps)
		// BR-UX-10: delegate tier / grade / meaning to decision-engine (single source of truth).
		// Never inline the 75/65/50/40 switch here — the founder brief is customer-facing and
		// must stay in lock-step with the Location Score hero vocabulary.
		const _fitTier = (s: number) => (s > 0 ? fitTierLabel(s) : "—");
		const _locTier = (s: number) =>
			blockTierLabel(s) || (s > 0 ? "Developing" : "—");
		// BL-B1: replaced local ternary with canonical tierFor('visionIQ') — was Well-Defined/Clear/Developing/Needs Input
		const _visTier = (s: number) =>
			s > 0 ? tierFor(s, "visionIQ").label : "—";
		const _sigFill = (s: number) => (s >= 70 ? "g" : s >= 45 ? "a" : "r");
		const _sigCol = (s: number) =>
			s >= 70 ? "#15803d" : s >= 45 ? "#d97706" : "#ef4444";
		const _tierLabel = (s: number) => tierFor(s, "lens").label;
		const _tierCls = (s: number) => {
			const c = tierFor(s, "lens").color;
			return c === "green"
				? "tier-green"
				: c === "amber"
					? "tier-amber"
					: c === "red"
						? "tier-red"
						: "tier-neutral";
		};
		const _chip = (s: number) => (s >= 70 ? "chip-green" : "chip-amber");

		const conceptLabel =
			CONCEPT_LABELS[visionBizType] || visionBizType.replace(/_/g, " ");
		const conceptFriendly = conceptLabel.toLowerCase();
		const titleName = bizName || "Your " + conceptLabel;
		const diffText = visionDifferentiators.trim();
		const hasCustomDiff = diffText.length > 3;
		const addrLine1 = analysisAddress.split(",")[0];
		const addrRest = analysisAddress.split(",").slice(1).join(",").trim();
		const awningLabel =
			bizName.length > 18
				? bizName.substring(0, 16) + "..."
				: bizName || conceptLabel;
		const today = new Date().toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});

		// Verdict headline (BR-1 unified vocabulary — BR-UX-10)
		// Now built from decision-engine exports so the founder brief stays in lock-step
		// with the Location Score hero. Icon is binary green/amber off the 65 threshold
		// (Strong Path + Viable get ✅; Tight/Stretch/Rethink get ⚠️).
		const _verdictIcon = fitIQ >= 65 ? "&#x2705;" : "&#x26A0;&#xFE0F;";
		const _verdictGrade = fitIQ > 0 ? fitGrade(fitIQ) : "";
		const _verdictTier = fitIQ > 0 ? fitTierLabel(fitIQ) : "";
		const _verdictMeaning = fitIQ > 0 ? fitMeaningShort(fitIQ) : "";
		const verdictHeadline =
			fitIQ > 0
				? `${_verdictIcon} Grade ${_verdictGrade} · ${_verdictTier} — ${_verdictMeaning}`
				: "&#x26A0;&#xFE0F; Score unavailable — run a location analysis first.";

		// Narrative — EF-2 (April 11) confidence guard.
		// When Vision is preliminary/empty, do NOT assert the founder "has a clear vision" or
		// that they're targeting a "well-defined customer" — that's a hallucination that
		// contradicts the PRELIM badge on the score. Emit an honest scoring-without-Vision
		// variant that invites the founder to fill in Vision to sharpen the result.
		const narrativeP1 = visionIsPrelim
			? "<strong>" +
				founderDisplay +
				" is scoring without full concept detail</strong> — " +
				"this block is being analysed against a generic " +
				conceptFriendly +
				" profile. " +
				"Add concept details (concept angle, average check, differentiators) to improve your score by up to 8 points and unlock concept-aware narrative."
			: "<strong>" +
				founderDisplay +
				" has a clear vision</strong> — " +
				(hasCustomDiff
					? "a " +
						conceptFriendly +
						" concept with a distinct angle: " +
						diffText.toLowerCase()
					: "a " +
						conceptFriendly +
						" concept targeting a specific, well-defined customer") +
				". " +
				(visionAvgCheck
					? "At an average check of " + visionAvgCheck + ", this"
					: "This") +
				" is a deliberate market position, not just another " +
				conceptFriendly +
				".";

		const narrativeP2 =
			"The data below tells one story: this block " +
			(locationIQ >= 65
				? "has strong fundamentals"
				: "has workable fundamentals") +
			" and the concept " +
			(fitIQ >= 65
				? "aligns well with them."
				: "needs sharpening to align.") +
			" " +
			founderDisplay +
			" isn't starting from zero — the intelligence is here.";

		// Score colors
		const fitColor =
			fitIQ >= 65 ? "#15803d" : fitIQ >= 45 ? "#c06a2a" : "#dc2626";

		// Hero pills
		const pillsHtml =
			(bizName ? '<span class="hero-pill">' + bizName + "</span>" : "") +
			'<span class="hero-pill">' +
			conceptLabel +
			"</span>" +
			(diffText
				? '<span class="hero-pill">' +
					diffText
						.split(/[\s,;]+/)
						.slice(0, 3)
						.join(" · ") +
					"</span>"
				: "");

		// Signal rows
		const sigs: Array<{
			icon: string;
			name: string;
			desc: string;
			val: number;
		}> = [
			{
				icon: "&#x1F687;",
				name: "Accessibility",
				desc: "Transit access &middot; foot traffic potential",
				val: Math.round(sixScores.transit || 0),
			},
			{
				icon: "&#x1F465;",
				name: "Demographics Match",
				desc: "Age + income fit for this concept",
				val: Math.round(sixScores.demographics || 0),
			},
			{
				icon: "&#x1F3D8;",
				name: "Neighbourhood Energy",
				desc: "Vibrancy &middot; street-level activity",
				val: Math.round(sixScores.vibrancy || 0),
			},
			{
				icon: "&#x1F4CA;",
				name: "Market Proof",
				desc: "Do similar businesses thrive here?",
				val: Math.round(sixScores.competition || 0),
			},
			{
				icon: "&#x1F6E1;",
				name: "Safety",
				desc: "Reported incidents &middot; time of day fit",
				val: Math.round(sixScores.safety || 0),
			},
			{
				icon: "&#x1F4C8;",
				name: "Momentum",
				desc: "Neighbourhood growth trajectory",
				val: Math.round(sixScores.momentum || 0),
			},
		].filter((s) => s.val > 0);

		const sigRowsHtml = sigs
			.map(
				(s) =>
					'<div class="sig-row">' +
					'<div class="sig-icon">' +
					s.icon +
					"</div>" +
					'<div class="sig-info"><div class="sig-name">' +
					s.name +
					'</div><div class="sig-desc">' +
					s.desc +
					"</div></div>" +
					'<div class="sig-track"><div class="sig-fill ' +
					_sigFill(s.val) +
					'" style="width:' +
					s.val +
					'%"></div></div>' +
					'<span class="sig-tier ' +
					_tierCls(s.val) +
					'">' +
					_tierLabel(s.val) +
					"</span>" +
					'<div class="sig-val" style="color:' +
					_sigCol(s.val) +
					'">' +
					s.val +
					"</div>" +
					"</div>",
			)
			.join("\n");

		// Concept rows
		type CRow = { icon: string; label: string; val: string; score: number };
		const cRows: CRow[] = [
			visionBizType
				? {
						icon: "&#x1F3EA;",
						label: "Business Type",
						val: conceptLabel,
						score: visionFieldScores.bizType || 0,
					}
				: null,
			diffText
				? {
						icon: "&#x2B50;",
						label: "Differentiator",
						val: diffText,
						score: visionFieldScores.differentiators || 0,
					}
				: null,
			visionAvgCheck
				? {
						icon: "&#x1F4B0;",
						label: "Average Check",
						val: visionAvgCheck,
						score: visionFieldScores.avgCheck || 0,
					}
				: null,
			visionHours
				? {
						icon: "&#x1F550;",
						label: "Hours",
						val: SIM_HOURS_LABELS[visionHours] || visionHours,
						score: visionFieldScores.hours || 0,
					}
				: null,
			visionFoodProgram && visionFoodProgram !== "none"
				? {
						icon: "&#x1F37D;",
						label: "Food Program",
						val:
							SIM_FOOD_LABELS[visionFoodProgram] ||
							visionFoodProgram,
						score: visionFieldScores.foodProgram || 0,
					}
				: null,
			visionTargetAge
				? {
						icon: "&#x1F382;",
						label: "Target Customer",
						val:
							visionTargetAge +
							" &middot; " +
							conceptFriendly +
							" audience",
						score: visionFieldScores.targetAge || 0,
					}
				: null,
		].filter((r): r is CRow => r !== null);

		const conceptRowsHtml = cRows
			.map(
				(r) =>
					'<div class="concept-row">' +
					'<div class="concept-key">' +
					r.icon +
					" " +
					r.label +
					"</div>" +
					'<div style="display:flex;align-items:center;gap:8px">' +
					'<div class="concept-val">' +
					r.val +
					"</div>" +
					(r.score > 0
						? '<div class="concept-score-chip ' +
							_chip(r.score) +
							'">' +
							r.score +
							"</div>"
						: "") +
					"</div>" +
					"</div>",
			)
			.join("\n");

		// Vis IQ note — UX-2.3: thresholds pulled from VISION_IQ_TIERS canonical constants
		const visionNoteHtml =
			visionIQ > 0 && visionIQ < VISION_IQ_TIERS.differentiated
				? '<div style="margin-top:12px;padding:9px 11px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:11px;color:#92400e;line-height:1.5"><strong>Concept detail is ' +
					visionIQ +
					" — " +
					_visTier(visionIQ) +
					".</strong> " +
					(visionIQ < VISION_IQ_TIERS.established
						? "Add specificity to your concept inputs to push this score higher."
						: "Adding detail to your differentiator could push this to " +
							VISION_IQ_TIERS.differentiated +
							"+.") +
					"</div>"
				: "";

		const visionTrioHtml =
			visionIQ > 0
				? '<div class="sc-row"><div class="sc-lbl">Concept Detail</div><div class="sc-right"><div class="sc-num" style="color:#d97706">' +
					visionIQ +
					'</div><div class="sc-tier" style="background:#fef3c7;color:#92400e">' +
					_visTier(visionIQ) +
					"</div></div></div>"
				: "";

		const verdictActionHtml =
			fitIQ >= 55
				? '<div class="v-action">&#x2192; Focus: ' +
					(fitIQ >= 65
						? "Sharpen your differentiator and run the competitive audit."
						: "Strengthen your concept details before committing to a lease.") +
					"</div>"
				: "";

		const stepDiffHtml = hasCustomDiff
			? "Your angle is <strong>" +
				diffText
					.split(/[\s,;]+/)
					.slice(0, 4)
					.join(" ") +
				"</strong>. Name it on your signage, menu, and every customer touchpoint from day one."
			: "Sharpen your differentiator — it's the one thing that makes you unmissable. Name it, say it loud, live it in every customer interaction.";

		const html =
			"<!DOCTYPE html>\n" +
			'<html lang="en">\n<head>\n<meta charset="UTF-8">\n' +
			"<title>RE\u00B2 Location Brief \u2014 " +
			titleName +
			"</title>\n" +
			'<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
			'<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">\n' +
			"<style>\n" +
			"*{box-sizing:border-box;margin:0;padding:0}\n" +
			":root{--dg:#1e3a2a;--sage:#4a7c5c;--brand:#15803d;--gold:#d97706;--ink:#111827;--t2:#4b5563;--t3:#9ca3af;--bdr:#e5e7eb;--surf:#f9fafb}\n" +
			"html,body{font-family:'Inter',sans-serif;background:#eeede8;color:var(--ink);-webkit-font-smoothing:antialiased;padding:48px 24px}\n" +
			".page{width:860px;margin:0 auto;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.12),0 4px 16px rgba(0,0,0,.06)}\n" +
			".hero{background:var(--dg);display:grid;grid-template-columns:1fr 280px;min-height:280px}\n" +
			".hero-left{padding:36px 40px 32px;display:flex;flex-direction:column;justify-content:space-between}\n" +
			".hero-eyebrow{display:flex;align-items:center;gap:10px;margin-bottom:24px}\n" +
			".hero-logo{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:rgba(255,255,255,.9);letter-spacing:-.3px}\n" +
			".hero-logo sup{font-size:10px;color:rgba(255,255,255,.4);vertical-align:super}\n" +
			".hero-sep{width:1px;height:16px;background:rgba(255,255,255,.15)}\n" +
			".hero-doc-type{font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,.35)}\n" +
			".hero-title{font-family:'Playfair Display',serif;font-size:42px;font-weight:700;color:#fff;line-height:1.05;letter-spacing:-1.5px;margin-bottom:10px}\n" +
			".hero-title em{font-style:italic;font-weight:400;color:rgba(255,255,255,.55)}\n" +
			".hero-pills{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px}\n" +
			".hero-pill{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;color:rgba(255,255,255,.65)}\n" +
			".hero-addr{font-size:13px;color:rgba(255,255,255,.5);font-weight:500;display:flex;align-items:center;gap:6px}\n" +
			".hero-right{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;background:linear-gradient(160deg,#2a4a38 0%,#1a3226 100%)}\n" +
			".sv-sky{position:absolute;top:0;left:0;right:0;height:50%;background:linear-gradient(180deg,#1a2d40 0%,#253d2c 100%)}\n" +
			".sv-scene{position:relative;z-index:2;width:100%;display:flex;flex-direction:column;align-items:center}\n" +
			".sv-brow{display:flex;align-items:flex-end;width:100%;gap:0}\n" +
			".sv-side{flex:1;background:linear-gradient(180deg,#4a5568 0%,#2d3748 100%);opacity:.5}\n" +
			".sv-side.l{height:110px;border-radius:2px 0 0 0}.sv-side.r{height:80px;border-radius:0 2px 0 0}\n" +
			".sv-sf{width:148px;flex-shrink:0;position:relative}\n" +
			".sv-face{height:154px;background:linear-gradient(180deg,#b8956a 0%,#a07850 100%);position:relative;display:flex;flex-direction:column;align-items:center}\n" +
			".sv-face::before{content:'';position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.06) 0,rgba(0,0,0,.06) 12px,transparent 12px,transparent 24px),repeating-linear-gradient(90deg,rgba(0,0,0,.04) 0,rgba(0,0,0,.04) 1px,transparent 1px,transparent 40px)}\n" +
			".sv-awn{width:100%;height:38px;background:var(--dg);display:flex;align-items:center;justify-content:center;position:relative;z-index:1}\n" +
			".sv-awn::after{content:'';position:absolute;bottom:-9px;left:0;right:0;height:9px;background:repeating-linear-gradient(90deg,var(--dg) 0,var(--dg) 18px,transparent 18px,transparent 36px)}\n" +
			".sv-awn-txt{font-family:'Playfair Display',serif;font-size:10px;font-weight:700;color:rgba(255,255,255,.9);letter-spacing:.4px;position:relative;z-index:1}\n" +
			".sv-wins{display:flex;gap:8px;margin-top:24px;position:relative;z-index:1}\n" +
			".sv-win{width:40px;height:62px;background:rgba(180,220,255,.3);border:2px solid rgba(255,255,255,.25);border-radius:2px 2px 0 0;position:relative}\n" +
			".sv-win::before{content:'';position:absolute;top:50%;left:0;right:0;height:1.5px;background:rgba(255,255,255,.2)}\n" +
			".sv-win::after{content:'';position:absolute;top:0;bottom:0;left:50%;width:1.5px;background:rgba(255,255,255,.2)}\n" +
			".sv-door{width:26px;height:44px;background:rgba(30,58,42,.8);border:2px solid rgba(255,255,255,.2);border-radius:2px 2px 0 0;position:absolute;bottom:0;left:50%;transform:translateX(-50%)}\n" +
			".sv-walk{height:20px;background:linear-gradient(180deg,#999 0%,#777 100%);width:100%}\n" +
			".sv-cap{background:rgba(0,0,0,.35);width:100%;padding:7px 12px;display:flex;align-items:center;justify-content:space-between}\n" +
			".sv-cap-addr{font-size:10px;font-weight:600;color:rgba(255,255,255,.55);letter-spacing:.4px}\n" +
			".sv-cap-badge{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.3)}\n" +
			".narrative{padding:36px 40px 28px;border-bottom:1px solid var(--bdr)}\n" +
			".nar-open{display:flex;align-items:flex-start;gap:18px;margin-bottom:20px}\n" +
			".nar-qmark{font-family:'Playfair Display',serif;font-size:72px;color:#e5e7eb;line-height:.7;flex-shrink:0;margin-top:8px;user-select:none}\n" +
			".nar-body{font-family:'Playfair Display',serif;font-size:17px;font-weight:400;color:var(--ink);line-height:1.7}\n" +
			".nar-body strong{font-weight:700;color:var(--dg)}.nar-body em{font-style:italic;color:var(--gold)}\n" +
			".nar-detail{font-size:13px;color:var(--t2);line-height:1.75;margin-top:14px;padding-left:22px;border-left:3px solid #e5e7eb}\n" +
			".verdict{padding:0 40px 28px;display:grid;grid-template-columns:1fr auto;gap:22px;align-items:start;border-bottom:1px solid var(--bdr)}\n" +
			".v-hl{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:var(--dg);line-height:1.2;margin-bottom:6px}\n" +
			".v-sub{font-size:13px;color:var(--t2);line-height:1.65;max-width:450px}\n" +
			".v-action{margin-top:10px;font-size:12px;font-weight:600;color:var(--brand)}\n" +
			".score-trio{display:flex;flex-direction:column;gap:8px;flex-shrink:0;min-width:192px}\n" +
			".sc-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-radius:8px;border:1px solid var(--bdr);background:var(--surf)}\n" +
			".sc-row.primary{background:#f0fdf4;border-color:#86efac}\n" +
			".sc-lbl{font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.8px}\n" +
			".sc-right{display:flex;align-items:center;gap:7px}\n" +
			".sc-num{font-size:21px;font-weight:900;line-height:1}\n" +
			".sc-tier{font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;white-space:nowrap}\n" +
			".data-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid var(--bdr)}\n" +
			".d-panel{padding:24px 40px;border-right:1px solid var(--bdr)}\n" +
			".d-panel:last-child{border-right:none}\n" +
			".p-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--t3);margin-bottom:14px;display:flex;align-items:center;gap:8px}\n" +
			".p-lbl::after{content:'';flex:1;height:1px;background:var(--bdr)}\n" +
			".sig-row{display:flex;align-items:center;gap:9px;margin-bottom:10px}\n" +
			".sig-row:last-child{margin-bottom:0}\n" +
			".sig-icon{font-size:12px;width:16px;text-align:center;flex-shrink:0}\n" +
			".sig-info{flex:1;min-width:0}\n" +
			".sig-name{font-size:12px;font-weight:600;color:var(--ink);line-height:1.2}\n" +
			".sig-desc{font-size:10px;color:var(--t3);margin-top:2px}\n" +
			".sig-track{width:64px;flex-shrink:0;height:5px;background:#ebebeb;border-radius:3px;overflow:hidden}\n" +
			".sig-fill{height:100%;border-radius:3px}\n" +
			".sig-fill.g{background:#22c55e}.sig-fill.a{background:#f59e0b}.sig-fill.r{background:#ef4444}\n" +
			".sig-val{font-size:12px;font-weight:800;width:24px;text-align:right;flex-shrink:0}\n" +
			".sig-tier{font-size:10px;font-weight:700;padding:2px 5px;border-radius:3px;white-space:nowrap;flex-shrink:0;width:56px;text-align:center}\n" +
			".tier-green{background:#dcfce7;color:#166534}.tier-amber{background:#fef3c7;color:#92400e}\n" +
			".tier-red{background:#fee2e2;color:#991b1b}.tier-neutral{background:#e0f2fe;color:#0c4a6e}\n" +
			".concept-row{display:flex;align-items:flex-start;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f3f3f0;gap:8px}\n" +
			".concept-row:last-child{border-bottom:none}\n" +
			".concept-key{font-size:12px;color:var(--t2);font-weight:500;display:flex;align-items:center;gap:5px}\n" +
			".concept-val{font-size:12px;font-weight:700;color:var(--dg);text-align:right}\n" +
			".concept-score-chip{font-size:10px;font-weight:800;padding:1px 6px;border-radius:20px;flex-shrink:0}\n" +
			".chip-green{background:#dcfce7;color:var(--brand)}.chip-amber{background:#fef3c7;color:#92400e}\n" +
			".next{padding:24px 40px 28px;border-bottom:1px solid var(--bdr)}\n" +
			".next-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--t3);margin-bottom:16px;display:flex;align-items:center;gap:8px}\n" +
			".next-lbl::after{content:'';flex:1;height:1px;background:var(--bdr)}\n" +
			".steps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}\n" +
			".step{background:var(--surf);border:1px solid var(--bdr);border-radius:10px;padding:14px}\n" +
			".step-n{font-size:9px;font-weight:800;letter-spacing:1px;color:var(--brand);margin-bottom:5px}\n" +
			".step-t{font-size:13px;font-weight:700;color:var(--dg);margin-bottom:5px;line-height:1.3}\n" +
			".step-d{font-size:12px;color:var(--t2);line-height:1.6}\n" +
			"footer{padding:16px 40px;display:flex;align-items:center;justify-content:space-between;background:#fafaf8;border-top:1px solid var(--bdr)}\n" +
			".f-brand{font-family:'Playfair Display',serif;font-size:14px;font-weight:700;color:var(--dg);display:flex;align-items:center;gap:5px}\n" +
			".f-brand sup{font-size:8px;color:var(--t3);vertical-align:super}\n" +
			".f-meta{font-size:10px;color:var(--t3);text-align:center;max-width:360px;line-height:1.5}\n" +
			".f-date{font-size:10px;color:var(--t3);font-weight:600;text-align:right}\n" +
			"@media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0}}\n" +
			'</style>\n</head>\n<body>\n<div class="page">\n\n' +
			'<div class="hero"><div class="hero-left">' +
			'<div class="hero-eyebrow"><div class="hero-logo">RE<sup>2</sup></div><div class="hero-sep"></div><div class="hero-doc-type">Founder&#x27;s Location Brief</div></div>' +
			'<div><div class="hero-title">' +
			addrLine1 +
			"<br><em>" +
			(addrRest || locationNeighborhood || "New York") +
			"</em></div>" +
			'<div class="hero-pills">' +
			pillsHtml +
			"</div>" +
			'<div class="hero-addr">&#x1F4CD; ' +
			analysisAddress +
			"</div></div>" +
			"</div>" +
			'<div class="hero-right"><div class="sv-sky"></div><div class="sv-scene"><div class="sv-brow">' +
			'<div class="sv-side l"></div>' +
			'<div class="sv-sf"><div class="sv-face"><div class="sv-awn"><span class="sv-awn-txt">' +
			awningLabel +
			"</span></div>" +
			'<div class="sv-wins"><div class="sv-win"></div><div class="sv-win"></div></div><div class="sv-door"></div></div>' +
			'<div class="sv-walk"></div></div>' +
			'<div class="sv-side r"></div></div>' +
			'<div class="sv-cap"><div class="sv-cap-addr">' +
			addrLine1 +
			" &middot; " +
			(locationNeighborhood || addrRest || "NYC") +
			'</div><div class="sv-cap-badge">Location Brief</div></div>' +
			"</div></div></div>\n\n" +
			'<div class="narrative"><div class="nar-open"><div class="nar-qmark">&#x201C;</div><div>' +
			'<div class="nar-body">' +
			narrativeP1 +
			"</div>" +
			'<div class="nar-detail">' +
			narrativeP2 +
			"</div>" +
			"</div></div></div>\n\n" +
			'<div class="verdict"><div>' +
			'<div class="v-hl">' +
			verdictHeadline +
			"</div>" +
			'<div class="v-sub">' +
			fitVerdict(fitIQ, locationIQ, visionIQ) +
			"</div>" +
			verdictActionHtml +
			'</div><div class="score-trio">' +
			'<div class="sc-row primary"><div class="sc-lbl">Your Score</div><div class="sc-right"><div class="sc-num" style="color:' +
			fitColor +
			'">' +
			fitIQ +
			'</div><div class="sc-tier" style="background:' +
			(fitIQ >= 65 ? "#dcfce7" : "#fef3c7") +
			";color:" +
			(fitIQ >= 65 ? "#15803d" : "#92400e") +
			'">' +
			_fitTier(fitIQ) +
			"</div></div></div>" +
			'<div class="sc-row"><div class="sc-lbl">Block Score</div><div class="sc-right"><div class="sc-num" style="color:#4a7c5c">' +
			locationIQ +
			'</div><div class="sc-tier" style="background:#d1fae5;color:#1e5c3a">' +
			_locTier(locationIQ) +
			"</div></div></div>" +
			visionTrioHtml +
			"</div></div>\n\n" +
			'<div class="data-grid">' +
			'<div class="d-panel"><div class="p-lbl">What the block is telling us</div>' +
			sigRowsHtml +
			"</div>" +
			'<div class="d-panel"><div class="p-lbl">The concept as scored</div>' +
			conceptRowsHtml +
			visionNoteHtml +
			"</div>" +
			"</div>\n\n" +
			'<div class="next"><div class="next-lbl">What to do next</div><div class="steps">' +
			'<div class="step"><div class="step-n">STEP 01</div><div class="step-t">Run your competitive audit</div><div class="step-d">Walk every comparable business within 400m. Map what they don&#x27;t do. The gap you find is your positioning strategy.</div></div>' +
			'<div class="step"><div class="step-n">STEP 02</div><div class="step-t">Own your differentiator fully</div><div class="step-d">' +
			stepDiffHtml +
			"</div></div>" +
			'<div class="step"><div class="step-n">STEP 03</div><div class="step-t">Model break-even at peak</div><div class="step-d">Build your break-even model at 60% of peak-hour capacity. ' +
			(visionAvgCheck
				? "At " +
					visionAvgCheck +
					" average check, you know your revenue ceiling."
				: "Set your average check, then model backwards from your rent.") +
			"</div></div>" +
			"</div></div>\n\n" +
			'<footer><div class="f-brand">RE<sup>2</sup> <span style="font-family:Inter;font-size:10px;color:#9ca3af;font-weight:500">resquared.io</span></div>' +
			'<div class="f-meta">AI-generated location intelligence. Not investment advice. Data sourced from US Census, Google Places, NYC DOHMH &amp; RE&#xB2; proprietary scoring. For personal use only.</div>' +
			'<div class="f-date">' +
			today +
			'<br><span style="color:#d1d5db">Confidential</span></div>' +
			"</footer>\n\n</div>\n</body>\n</html>";

		// D16: Use Blob + download anchor (bypasses popup blockers, gives a real file)
		try {
			const blob = new Blob([html], { type: "text/html" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `RE2-Brief-${(analysisAddress.split(",")[0] || "location").replace(/[^a-z0-9]+/gi, "-")}.html`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			setTimeout(() => URL.revokeObjectURL(url), 10000);
			showExportToast("Brief downloaded.", "ok");
		} catch (e) {
			console.error("[D16] export failed", e);
			showExportToast("Export failed — check console.", "err");
		}
	}

	// Recommendations
	const recommendations = [
		{ icon: "\u{1F4CD}", title: "Right Location?", key: "location" },
		{ icon: "\u{1F4B0}", title: "Make Money?", key: "money" },
		{
			icon: "\u2694\uFE0F",
			title: "Too Much Competition?",
			key: "competition",
		},
		{ icon: "\u{1F6E1}\uFE0F", title: "Safe Area?", key: "safety" },
		{ icon: "\u26A0\uFE0F", title: "Biggest Risks?", key: "risks" },
		{ icon: "\u{1F680}", title: "What First?", key: "first" },
	];
	let expandedCards = $state<Set<string>>(new Set());

	// UX Order 6: Derive 3 quick tips from live score data for inline recs section
	let quickTips = $derived.by(() => {
		const transit =
			sixIndex?.indices?.transit?.score ?? sixScores.transit ?? 0;
		const demographics =
			sixIndex?.indices?.demographics?.score ??
			sixScores.demographics ??
			0;
		const safety =
			sixIndex?.indices?.safety?.score ?? sixScores.safety ?? 0;
		const vibrancy =
			sixIndex?.indices?.vibrancy?.score ?? sixScores.vibrancy ?? null;
		const competition = sixScores.competition ?? 0;
		const momentum = sixScores.momentum ?? null;
		const survival = sixScores.survivalRate ?? 0;
		// FIX-12: concept-aware rec suppression
		const isBar = visionBizType === "bar_nightlife";
		const isEvening = isBar || visionBizType === "full_service_restaurant";
		const isFoodBev = [
			"specialty_coffee",
			"bakery",
			"fast_casual",
			"full_service_restaurant",
			"qsr",
			"bar_nightlife",
			"juice_bar",
			"wellness_beverage",
		].includes(visionBizType);
		const tips: { icon: string; text: string }[] = [];
		if (transit >= 70) {
			if (isBar)
				tips.push({
					icon: '<svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="2" width="10" height="10" rx="2"/><path d="M3 9h10M6 13l-1 1M10 13l1 1"/><circle cx="6" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
					text: `Strong transit access (${transit}/100). Late-night transit keeps guests coming — and gives them a safe ride home, which matters for bar concepts.`,
				});
			else if (visionBizType === "retail")
				tips.push({
					icon: '<svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="2" width="10" height="10" rx="2"/><path d="M3 9h10M6 13l-1 1M10 13l1 1"/><circle cx="6" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
					text: `Strong transit access (${transit}/100). High-footfall corridor — capture impulse shoppers with strong window merchandising.`,
				});
			else
				tips.push({
					icon: '<svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="2" width="10" height="10" rx="2"/><path d="M3 9h10M6 13l-1 1M10 13l1 1"/><circle cx="6" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
					text: `Strong transit access (${transit}/100). Open early to capture morning commuters — this corridor has proven foot traffic before 9am.`,
				});
		} else if (transit >= 40)
			tips.push({
				icon: '<svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="2" width="10" height="10" rx="2"/><path d="M3 9h10M6 13l-1 1M10 13l1 1"/><circle cx="6" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
				text: `Moderate transit access (${transit}/100). Invest in street-level signage — walk-ins won't come automatically from transit alone.`,
			});
		if (demographics >= 70)
			tips.push({
				icon: "money",
				text: `High-income demographics (${demographics}/100). Price your concept at the upper range — this market has the spending power to support a premium offer.`,
			});
		if (survival >= 65)
			tips.push({
				icon: "trophy",
				text: `${survival}% year-1 survival rate on this block vs NYC average of 52%. A strong signal — operators who fit this market tend to stick around.`,
			});
		else if (survival > 0 && survival < 45)
			tips.push({
				icon: "warning",
				text: `${survival}% year-1 survival rate — below the NYC average of 52%. Model conservative unit economics — many concepts here close before year 3.`,
			});
		if (competition > 0 && competition < 40)
			tips.push({
				icon: "crossed-swords",
				text: `Competitive pressure is high (${competition}/100). Differentiation isn't optional here — your unique angle is what makes the numbers work.`,
			});
		else if (competition >= 70)
			tips.push({
				icon: "check",
				text: `Low competition density (${competition}/100). You'd be entering a relatively open market — move quickly to establish your brand presence.`,
			});
		if (momentum >= 70)
			tips.push({
				icon: "trend-up",
				text: `Neighborhood is growing fast (${momentum}/100). Rent will likely rise — if the fit is right, locking in a lease now may be the right call.`,
			});
		// vibrancy tip removed (ML-validated near-zero predictive power — S5)
		if (safety >= 70) {
			if (isEvening)
				tips.push({
					icon: '<svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 2L3 4.5V8c0 3 2.5 5 5 6 2.5-1 5-3 5-6V4.5L8 2z"/></svg>',
					text: `Safe environment (${safety}/100). Low evening incident rate is a meaningful advantage — guests are more willing to linger and spend late.`,
				});
			else if (!isFoodBev)
				tips.push({
					icon: '<svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 2L3 4.5V8c0 3 2.5 5 5 6 2.5-1 5-3 5-6V4.5L8 2z"/></svg>',
					text: `Safe environment (${safety}/100). Low incident rate supports foot traffic throughout the day — important for appointment-based concepts.`,
				});
			else
				tips.push({
					icon: '<svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 2L3 4.5V8c0 3 2.5 5 5 6 2.5-1 5-3 5-6V4.5L8 2z"/></svg>',
					text: `Safe environment (${safety}/100). Low incident rate supports steady all-day traffic — a meaningful quality-of-life signal for your team and guests.`,
				});
		}
		return tips.slice(0, 3);
	});

	function toggleCard(key: string) {
		const next = new Set(expandedCards);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		expandedCards = next;
	}

	// Friendly business type mapping (matches root layout)
	// #33: friendlyBizType replaced by getConceptLabel from src/lib/constants/concepts.ts
	function friendlyBizType(raw: string): string {
		return getConceptLabel(raw);
	}

	// Normalize raw session bizType → canonical concept key.
	// 04.19.2026 13:00 Changed from normalizeConceptKey to normalizeBusinessType (canonical registry)
	function normalizeBizType(raw: string | undefined | null): string {
		return normalizeBusinessType(raw);
	}

	// Biz type label for badge
	// UX-DELTA-02: visionBizType is launchpad-first (set at init from _initLp); fall back to store.bizType
	let bizTypeLabel = $derived(
		friendlyBizType(visionBizType || store.bizType),
	);

	// ── Concept-specific deep-dive questions ──
	// Swaps generic questions for concept-aware framing
	const CONCEPT_QUESTIONS: Record<string, Record<string, string>> = {
		specialty_coffee: {
			transit: "Enough morning commuter foot traffic?",
			demographics: "Can locals afford $6 lattes?",
			competition: "How many cafés within walking distance?",
			survival: "Do coffee shops survive here?",
			vibrancy: "Is this area buzzing or dead?",
			safety: "Safe for early-morning and laptop crowds?",
		},
		qsr: {
			transit: "Enough lunch-rush foot traffic?",
			demographics: "Do workers and residents eat out here?",
			competition: "How crowded is the fast-casual scene?",
			survival: "Do quick-service spots last here?",
			vibrancy: "Is this a busy lunch corridor?",
			safety: "Safe for high-turnover dining?",
		},
		full_service_restaurant: {
			transit: "Enough evening foot traffic for dinner service?",
			demographics: "Can diners here support $40+ checks?",
			competition: "How dense is the restaurant scene?",
			survival: "Do restaurants survive past year two here?",
			vibrancy: "Is this a dining destination neighborhood?",
			safety: "Safe for evening diners?",
		},
		bar_nightlife: {
			transit: "Is there nighttime foot traffic?",
			demographics: "Does the local crowd go out at night?",
			competition: "How saturated is the nightlife scene?",
			survival: "Do bars survive here long-term?",
			vibrancy: "Is this an after-dark destination?",
			safety: "Safe for late-night patrons?",
		},
		fitness_studio: {
			transit: "Can members get here easily?",
			demographics: "Do locals spend on fitness?",
			competition: "How many gyms and studios nearby?",
			survival: "Do fitness concepts stick here?",
			vibrancy: "Is this a health-conscious neighborhood?",
			safety: "Safe for early-morning and evening classes?",
		},
		retail: {
			transit: "Enough walk-by shoppers?",
			demographics: "Do locals have retail spending power?",
			competition: "How competitive is the retail corridor?",
			survival: "Do retail shops last here?",
			vibrancy: "Is this a shopping destination?",
			safety: "Safe for browsing customers?",
		},
		personal_services: {
			transit: "Can clients find you easily?",
			demographics: "Do locals spend on personal care?",
			competition: "How many salons and spas nearby?",
			survival: "Do service businesses survive here?",
			vibrancy: "Is this neighborhood well-trafficked?",
			safety: "Safe and inviting for walk-in clients?",
		},
		coworking: {
			transit: "Is this transit-accessible for commuters?",
			demographics: "Are there enough freelancers and remote workers?",
			competition: "How crowded is the coworking market?",
			survival: "Do workspace concepts last here?",
			vibrancy: "Is this a business-friendly neighborhood?",
			safety: "Safe for members arriving early and late?",
		},
		medical_office: {
			transit: "Can patients get here easily?",
			demographics: "Does the local population need this service?",
			competition: "How many medical offices nearby?",
			survival: "Do medical practices stay long-term?",
			vibrancy: "Is this a well-established commercial area?",
			safety: "Safe and accessible for all patients?",
		},
	};

	// Resolve the concept key for question lookup
	let conceptKeyForQuestions = $derived(
		normalizeBizType(visionBizType || store.bizType),
	);
	function getConceptQ(dimKey: string, fallback: string): string {
		const qs = CONCEPT_QUESTIONS[conceptKeyForQuestions];
		return qs?.[dimKey] ?? fallback;
	}

	function checkFitComplete() {
		try {
			const lpRaw = localStorage.getItem("re2_launchpad");
			if (lpRaw) {
				const lp = JSON.parse(lpRaw);
				fitComplete = !!(
					lp.founderProfile?.motivation &&
					lp.visionStatement &&
					lp.differentiator
				);
			} else {
				fitComplete = false;
			}
		} catch {
			fitComplete = false;
		}
	}

	// FIX-018: Sync fitComplete into re2_session so layout nav unlock reads from one source
	$effect(() => {
		if (fitComplete && typeof window !== "undefined") {
			try {
				const sess = JSON.parse(
					localStorage.getItem("re2_session") || "{}",
				);
				if (!sess.fitComplete) {
					sess.fitComplete = true;
					localStorage.setItem("re2_session", JSON.stringify(sess));
					window.dispatchEvent(
						new CustomEvent("re2:session-updated"),
					);
				}
			} catch {}
		}
	});

	onMount(() => {
		// fitComplete requires REAL profile data (vision + differentiator), not just bot session
		checkFitComplete();

		// E2b: sync vision biz type + differentiators from session/launchpad
		try {
			const sess = JSON.parse(
				localStorage.getItem("re2_session") || "{}",
			);
			// UXFIX-02: populate scoredAt for meta-line from session on mount
			if (sess.scoredAt) scoredAtDisplay = Number(sess.scoredAt) || null;
			const lp = JSON.parse(
				localStorage.getItem("re2_launchpad") || "{}",
			);
			const resolvedRaw =
				lp.businessType || sess.bizType || sess.visionBizType || "";
			if (resolvedRaw) visionBizType = normalizeBizType(resolvedRaw);
		} catch {}
		try {
			const lp = JSON.parse(
				localStorage.getItem("re2_launchpad") || "{}",
			);
			if (lp.differentiator && !visionDifferentiators) {
				visionDifferentiators = lp.differentiator;
			}
		} catch {}

		// Restore previous analysis from localStorage if user navigates back
		// BUT NOT when coming from bot — bot needs a fresh search for the new address
		if (!comingFromBot) {
			try {
				const sessionRaw = localStorage.getItem("re2_session");
				if (sessionRaw) {
					const session = JSON.parse(sessionRaw);

					// BUG-008: Session version migration — remap old score keys to current schema
					if (session.sixScores) {
						const ss = session.sixScores;
						// v1 → v2: growth→momentum, visibility→vibrancy
						if (
							ss.growth !== undefined &&
							ss.momentum === undefined
						) {
							ss.momentum = ss.growth;
							delete ss.growth;
						}
						if (
							ss.visibility !== undefined &&
							ss.vibrancy === undefined
						) {
							ss.vibrancy = ss.visibility;
							delete ss.visibility;
						}
						session.sessionVersion = 2;
						localStorage.setItem(
							"re2_session",
							JSON.stringify(session),
						);
					}

					if (
						typeof session.locationIQ === "number" &&
						session.locationIQ > 0 &&
						session.sixScores &&
						session.analyzedAddress
					) {
						storedLocationIQ = session.locationIQ;
						sixScores = session.sixScores;
						analysisAddress = session.analyzedAddress;
						if (session.geoid) currentGeoid = session.geoid;
						// Mark store as having a result so hasResult is true
						store.searchResult = {
							addr: session.analyzedAddress,
						} as any;
						setTimeout(() => {
							animateRings = true;
						}, 300);
					}
				}
				// Restore map position
				const locRaw = sessionStorage.getItem("re2_selected_location");
				if (locRaw) {
					const loc = JSON.parse(locRaw);
					if (loc.lat && loc.lng) {
						analysisStore.mapLat = loc.lat;
						analysisStore.mapLng = loc.lng;
					}
					if (loc.neighborhood)
						locationNeighborhood = loc.neighborhood;
				}
			} catch {}
		}

		// Re-check when user returns from filling profile on another page
		const onStorageChange = (e: StorageEvent) => {
			if (e.key === "re2_launchpad") checkFitComplete();
		};
		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") checkFitComplete();
		};
		window.addEventListener("storage", onStorageChange);
		document.addEventListener("visibilitychange", onVisibilityChange);
		window.addEventListener("message", (event) => {
			if (event.data?.type === "re2-search-result") {
				analysisStore.mapLat = event.data.lat || 40.758;
				analysisStore.mapLng = event.data.lon || -73.9855;
				// FIX: Only use cafes fallback if analysisStore.competitors haven't been extracted from 4-source logic
				if (analysisStore.competitors.length === 0) {
					analysisStore.competitors = (event.data.cafes || [])
						.map((c: Record<string, unknown>) => ({
							name: String(c.name || "Unknown"),
							lat: Number(c.lat ?? 0),
							lng: Number(c.lng ?? c.lon ?? 0),
							dist: Number(c.dist ?? c.distance ?? 0),
							type: String(c.type || "Competitor"),
						}))
						.filter(
							(c: { lat: number; lng: number }) =>
								c.lat !== 0 && c.lng !== 0,
						);
				}

				// Write location coordinates to localStorage when search result comes in
				try {
					const selectedLocation = {
						addr:
							event.data.address ||
							analysisAddress ||
							"Unknown Address",
						lat: analysisStore.mapLat,
						lng: analysisStore.mapLng,
					};
					localStorage.setItem(
						"re2_selected_location",
						JSON.stringify(selectedLocation),
					);
				} catch {}

				setTimeout(() => {
					// mapRef?.resize(); // 04.25.2026: removed — mapRef migrated to analysisStore, no longer accessible here
					animateRings = true;
				}, 600);
			}
			if (event.data?.sixScores) {
				sixScores = event.data.sixScores;
			}
		});

		// Cleanup listeners on destroy
		return () => {
			window.removeEventListener("storage", onStorageChange);
			document.removeEventListener(
				"visibilitychange",
				onVisibilityChange,
			);
		};
	});

	// ── WHAT'S WORKING: top 3 signals ≥ 65, shown before risks ──
	const WHATS_WORKING_COPY: Record<
		string,
		{ high: string; mid: string; icon: string }
	> = {
		survivalRate: {
			icon: "🏆",
			high: "Businesses on this block outlast the NYC average of 52%. Strong long-term retention signal.",
			mid: "Business survival rate is above the NYC average here.",
		},
		neighborhoodHealth: {
			icon: "🏘️",
			high: "Rising incomes and low vacancy. This corridor is growing, not declining.",
			mid: "Neighborhood fundamentals are solid — stable commercial activity.",
		},
		accessibility: {
			icon: "🚇",
			high: "Top-tier transit access for your concept. Multiple lines within 2 blocks.",
			mid: "Good transit access — walk-in and commuter traffic is viable.",
		},
		transit: {
			icon: "🚇",
			high: "Top-tier transit access. Multiple subway lines nearby drive consistent foot traffic.",
			mid: "Good transit connectivity — walk-in traffic is viable.",
		},
		demographics: {
			icon: "👥",
			high: "Strong spending power. Demographics align well with your concept's price point.",
			mid: "Demographics support your concept type.",
		},
		vibrancy: {
			icon: "✨",
			high: "High business density and street energy — natural foot traffic without heavy marketing.",
			mid: "Active commercial corridor with consistent daytime activity.",
		},
		competition: {
			icon: "🎯",
			high: "Low competition for your concept type. Room to own the category in this area.",
			mid: "Competition is manageable — differentiation will be your edge.",
		},
		safety: {
			icon: "🛡️",
			high: "Safe block with low incident rates. Supports comfortable evening foot traffic.",
			mid: "Safety metrics are above average for NYC.",
		},
		market_proof: {
			icon: "📊",
			high: "Established commercial zone with proven consumer demand for this concept type.",
			mid: "Market fundamentals support your concept here.",
		},
		momentum: {
			icon: "📈",
			high: "Rising permit activity signals a block on the way up — early-mover advantage.",
			mid: "Steady commercial growth momentum in this area.",
		},
	};

	let whatsWorking = $derived.by(() => {
		const allScores: Array<{ key: string; score: number }> = [];
		// Pull from sixScores
		for (const [k, v] of Object.entries(sixScores)) {
			if (v && v > 0) allScores.push({ key: k, score: v });
		}
		// Pull from fitSubScores (avoid duplicates)
		const sixKeys = new Set(Object.keys(sixScores));
		for (const [k, v] of Object.entries(fitSubScores)) {
			if (v && v > 0 && !sixKeys.has(k))
				allScores.push({ key: k, score: v });
		}
		return allScores
			.filter((s) => s.score >= 65 && WHATS_WORKING_COPY[s.key])
			.sort((a, b) => b.score - a.score)
			.slice(0, 3)
			.map((s) => ({
				...s,
				...WHATS_WORKING_COPY[s.key],
				copy:
					s.score >= 80
						? WHATS_WORKING_COPY[s.key].high
						: WHATS_WORKING_COPY[s.key].mid,
				topPct: null, // R5-3: removed hardcoded percentile — was not computed from real distribution
			}));
	});

	// ── WATCH FOR: bottom 2 signals < 55, mirrors What's Working ──
	const WATCH_FOR_COPY: Record<
		string,
		{
			icon: string;
			label: string;
			badge: (score: number) => string;
			badgeClass: (score: number) => string;
			copy: (score: number, concept: string) => string;
		}
	> = {
		demographics: {
			icon: "👥",
			label: "Customer Fit",
			// 04.18.2026 Code Changes for Kill Factor Refactoring
			badge: (s) =>
				s < KILL_FACTOR_THRESHOLDS.demographics ? "Below avg" : "Fair",
			badgeClass: (s) =>
				s < KILL_FACTOR_THRESHOLDS.demographics
					? "wf-watch-badge-red"
					: "wf-watch-badge-amber",
			copy: (s, c) =>
				s < KILL_FACTOR_THRESHOLDS.demographics
					? `Demographic mismatch — local income and age profile skew away from ${c === "bar_nightlife" ? "nightlife spend" : c === "fitness_studio" ? "fitness memberships" : "this concept's price point"}. Consider a value tier or target commuters over residents.`
					: `Demographics are a partial fit. Expect slower ramp-up as you build a regular clientele among local residents.`,
		},
		vibrancy: {
			icon: "⚡",
			label: "Concept Pulse",
			badge: () => "Quiet ring",
			badgeClass: () => "wf-watch-badge-amber",
			// 04.18.2026 Code Changes for Kill Factor Refactoring
			copy: (s, c) =>
				s < KILL_FACTOR_THRESHOLDS.vibrancy
					? `Your concept\u2019s trade-area ring is very quiet — you\u2019ll need to generate your own draw. ${c === "bar_nightlife" ? "Solo bars in quiet rings depend heavily on reservations and event-driven business." : "A strong opening event and social presence matter more here than in a busy corridor."}`
					: `Your trade-area ring has below-average activity. You'll pull customers in rather than catch walk-by volume — destination marketing matters early.`,
		},
		transit: {
			icon: "🚇",
			label: "Accessibility",
			badge: () => "Low transit",
			badgeClass: () => "wf-watch-badge-amber",
			copy: (s, c) =>
				c === "fitness_studio" ||
				c === "medical_office" ||
				c === "wellness_spa"
					? `Transit score is ${s}/100. Destination concepts can overcome low transit — members commute to good operators. Parking access and bike infrastructure become more important.`
					: `Transit score is ${s}/100. Walk-in traffic will be limited. Budget for delivery partnerships and loyalty programs to compensate for reduced spontaneous visits.`,
		},
		competition: {
			icon: "⚔️",
			label: "Competition",
			badge: () => "Saturated",
			badgeClass: () => "wf-watch-badge-red",
			copy: (_s, c) =>
				`High competition density for ${c === "specialty_coffee" ? "specialty coffee" : c === "fitness_studio" ? "fitness" : "this concept type"}. Differentiation is your only path — a generic offering will not survive here. Name your unique edge before signing a lease.`,
		},
		market_proof: {
			icon: "📊",
			label: "Market Proof",
			badge: () => "Unproven",
			badgeClass: () => "wf-watch-badge-amber",
			copy: () =>
				`Low survival rate for similar businesses on this block. This doesn't mean it can't work — but you're pioneering, not following. Stress-test your assumptions before committing.`,
		},
		safety: {
			icon: "🛡️",
			label: "Safety",
			badge: () => "Watch",
			badgeClass: () => "wf-watch-badge-amber",
			copy: (s, c) =>
				c === "bar_nightlife"
					? `Safety score is ${s}/100. Evening operations on lower-safety blocks require visible staff presence and strong lighting. Verify incident patterns by time of day before committing.`
					: `Safety score is ${s}/100. Affects customer comfort especially for evening visits. Review incident data and talk to neighbouring businesses before signing.`,
		},
	};

	let watchFor = $derived.by(() => {
		const candidates: Array<{ key: string; score: number }> = [
			{
				key: "demographics",
				score: fitSubScores.demographics || sixScores.demographics || 0,
			},
			{ key: "vibrancy", score: sixScores.vibrancy || 0 },
			{ key: "transit", score: sixScores.transit || 0 },
			{
				key: "competition",
				score: fitSubScores.competition || sixScores.competition || 0,
			},
			{ key: "market_proof", score: fitSubScores.market_proof || 0 },
			{ key: "safety", score: sixScores.safety || 0 },
		];
		return candidates
			.filter((c) => c.score > 0 && c.score < 55 && WATCH_FOR_COPY[c.key])
			.sort((a, b) => a.score - b.score)
			.slice(0, 2)
			.map((c) => ({
				...c,
				icon: WATCH_FOR_COPY[c.key].icon,
				label: WATCH_FOR_COPY[c.key].label,
				badgeText: WATCH_FOR_COPY[c.key].badge(c.score),
				badgeCls: WATCH_FOR_COPY[c.key].badgeClass(c.score),
				copyText: WATCH_FOR_COPY[c.key].copy(c.score, visionBizType),
			}));
	});

	// T9: fitVerdictLabel — one-line concept-aware verdict for Zone 1 hero
	let fitVerdictLabel = $derived.by((): string => {
		if (fitIQ === 0) return "Analyzing...";
		const biz =
			CONCEPT_LABELS[visionBizType] ||
			friendlyBizType(visionBizType).toLowerCase();
		const tier =
			fitIQ >= 75
				? "Strong fit"
				: fitIQ >= 65
					? "Good fit"
					: fitIQ >= 55
						? "Moderate fit"
						: fitIQ >= 45
							? "Mixed signals"
							: "Weak fit";
		// Pick the strongest signal to name-check in the one-liner
		const t = sixScores["transit"] || 0;
		const d =
			sixScores["demographics"] || fitSubScores["demographics"] || 0;
		const c = sixScores["competition"] || fitSubScores["competition"] || 0;
		const v = sixScores["vibrancy"] || sixScores["vibrancy_index"] || 0;
		const sr = sixScores["survivalRate"] || sixScores["survival_rate"] || 0;
		let reason = "";
		if (sr >= 70) reason = "strong business survival on this block";
		else if (t >= 70)
			reason = "strong transit access for your target customer";
		else if (d >= 70) reason = "demographic alignment for your price point";
		else if (c >= 65)
			reason = "low competition gives you room to own this block";
		else if (v >= 70)
			reason =
				"busy concept pulse — your trade-area ring has real activity";
		else if (fitIQ >= 55)
			reason = "location fundamentals are solid for this concept";
		else reason = "location fundamentals need work for this concept";
		return `${tier} for ${biz} — ${reason}.`;
	});

	// Brain: why-bullets — 3 fixed signal bullets (survival, competition, transit)
	let whyBullets = $derived<WhyBullet[]>(
		fitIQ > 0
			? getWhyBulletsV2({
					survivalRate:
						sixScores["survivalRate"] ||
						sixScores["survival_rate"] ||
						0,
					competitorCount: analysisStore.competitors.length,
					transitScore:
						sixScores["transit"] || sixScores["transitScore"] || 0,
					competitorScanStatus: analysisStore.competitorScanStatus, // BRAIN-NEW-01: prevents "0 competitors" from being mistaken for a scan result
				})
			: [],
	);

	// Brain: success probability ring (Screen 09)
	let successProb = $derived<SuccessProb | null>(
		fitIQ > 0 && visionBizType
			? getSuccessProb({
					fitIQ,
					locationIQ,
					visionIQ,
					visionIsPrelim,
					concept: visionBizType,
					tierLabel: CONCEPT_LABELS[visionBizType],
				})
			: null,
	);

	// Brain: 3-year revenue projections (Screen 09)
	let revenueProjections = $derived<RevenueProjection | null>(
		bpInitialized && bpDailyCust > 0 && bpAvgTicket > 0 && visionBizType
			? getRevenueProjections({
					dailyCust: bpDailyCust,
					avgTicket: bpAvgTicket,
					daysPerWeek: bpDaysPerWeek,
					monthlyRent: bpRent || 0,
					concept: visionBizType,
					tierLabel: CONCEPT_LABELS[visionBizType],
				})
			: null,
	);

	// L3: Decision state — structured verdict object for UX display
	// Replaces the one-liner fitVerdict() with 5 named states + reasons.
	// UX thread reads: decisionState.headline, .summary, .action, .reasons[], .color
	let decisionState = $derived.by(
		(): DecisionState =>
			getDecisionState(
				fitIQ,
				locationIQ,
				visionIQ,
				sixScores,
				fitSubScores,
				visionBizType,
				visionIsPrelim,
			),
	);

	// L4: Score interpretation — band context, gap-to-next, and primary lever
	// Tells the founder exactly what their score means and what to do about it.
	// UX thread reads: scoreInterpretation.interpretation, .leverCopy, .bandName, .gapToNext
	let scoreInterpretation = $derived.by(
		(): ScoreInterpretation =>
			getScoreInterpretation(fitIQ, locationIQ, visionIQ, visionBizType),
	);

	// L5: Evidence payload — signals split into helping/hurting + fixed/flexible
	// Replaces the flat whyBullets array with structured evidence.
	// UX thread reads: evidence.helping[], evidence.hurting[], evidence.canChange[], evidence.cannotChange[]
	let evidence = $derived.by(
		(): EvidencePayload =>
			getEvidencePayload(
				fitIQ,
				locationIQ,
				visionIQ,
				sixScores,
				fitSubScores,
				visionBizType,
				visionIsPrelim,
			),
	);

	// L8: Concept coaching — kill factor risks + concept-specific next steps + revenue model context
	// UX thread reads: coaching.title, .activeRisks[], .nextSteps[], .revenueContext
	let coaching = $derived.by((): ConceptCoaching | null =>
		getConceptCoaching(
			fitIQ,
			locationIQ,
			visionIQ,
			sixScores,
			fitSubScores,
			visionBizType,
		),
	);

	// Brain: dashboard headline state machine (Screen 10)
	let dashboardHeadline = $derived<DashboardHeadline>(
		getDashboardHeadline({
			hasScore: fitIQ > 0,
			visionIsPrelim,
			hasBusinessCase: bpInitialized && bpAnnualRevenue > 0,
			hasKillFactor: !!coaching?.activeRisks?.length,
			killFactorName: coaching?.activeRisks?.[0]?.split(" ")[0],
		}),
	);

	// Brain: today's insight card (Screen 10)
	let todaysInsight = $derived<TodaysInsight | null>(
		fitIQ > 0 && visionBizType
			? getTodaysInsight({
					decisionState,
					coaching,
					visionIsPrelim,
					visionCompletionPct,
					sixScores,
					fitSubScores,
					concept: visionBizType,
					locationIQ,
					fitIQ,
					tierLabel: CONCEPT_LABELS[visionBizType],
				})
			: null,
	);

	// ── 3 Signals + Why Strip (concept-signals.ts) ──
	let locationDataBag = $derived.by((): LocationDataBag => {
		let medIncome = 0;
		let medAge = 0;
		try {
			const intel = JSON.parse(
				sessionStorage.getItem("re2_location_intel") || "{}",
			);
			medIncome =
				intel?.census?.medianHouseholdIncome ||
				intel?.medianHouseholdIncome ||
				0;
			// FIX: Only use census.medianAge — the fallback intel?.medianAge was reading the
			// demographics SCORE (58) instead of actual median age (37)
			medAge = intel?.census?.medianAge || 0;
		} catch {}
		return {
			sixScores,
			fitSubScores,
			locationIQ,
			visionIQ,
			fitIQ,
			medianIncome: medIncome,
			medianAge: medAge,
			survivalRate:
				sixScores.survivalRate || sixScores.survival_rate || 0,
			transitScore: sixScores.transit || fitSubScores.accessibility || 0,
			neighborhood: locationNeighborhood,
		};
	});
	let conceptSignals = $derived.by((): RenderedSignal[] =>
		fitIQ > 0
			? getConceptSignals(visionBizType, evidence, locationDataBag)
			: [],
	);
	let whyStripItems = $derived.by(() =>
		fitIQ > 0 ? getWhyStrip(visionBizType, evidence, locationDataBag) : [],
	);

	// Explore tab state for the new tabbed section
	let exploreTab = $state<
		"map" | "daypart" | "watch" | "neighborhood" | "compare" | "details"
	>("map");
	// UX-13: sticky action bar — appears after scrolling past Zone 1 (~480px)
	let showStickyBar = $state(false);
	// UX-12: active zone dot for scroll progress nav
	let activeZone = $state(1);
	$effect(() => {
		// UX-T17: .v3-tab-body has overflow-y:auto so content scrolls INSIDE the
		// panel, not the window. window.scrollY stays 0 → sticky bar never shows.
		// Fix: watch both window scroll AND the tab-body element's scrollTop.
		const THRESHOLD = 320;
		const onScroll = () => {
			const tabBody = document.querySelector(".v3-tab-body");
			const panelScroll = tabBody ? tabBody.scrollTop : 0;
			showStickyBar =
				window.scrollY > THRESHOLD || panelScroll > THRESHOLD;
			// Determine active zone by checking which zone anchor is in view
			const zones = [1, 2, 3, 4, 5];
			let current = 1;
			for (const z of zones) {
				const el = document.getElementById(`zone-${z}`);
				if (el && el.getBoundingClientRect().top <= 120) current = z;
			}
			activeZone = current;
		};
		const tabBody = document.querySelector(".v3-tab-body");
		window.addEventListener("scroll", onScroll, { passive: true });
		tabBody?.addEventListener("scroll", onScroll, { passive: true });

		// B3-0.A / UX-3.6b: react to concept-changed event dispatched by BC store's
		// initFromSession auto-clear. The store clears localStorage synchronously;
		// this handler clears the corresponding $state vars so the UI stays in sync.
		const onConceptChanged = (e: Event) => {
			const detail = (e as CustomEvent<{ clearedFields: string[] }>)
				.detail;
			if (!detail?.clearedFields) return;
			const cleared = new Set(detail.clearedFields);
			if (cleared.has("visionDifferentiators"))
				visionDifferentiators = "";
			if (cleared.has("conceptAnswers")) conceptAnswers = {};
			if (cleared.has("visionAvgCheck")) visionAvgCheck = "";
			if (cleared.has("visionFoodProgram")) visionFoodProgram = "";
			if (cleared.has("visionHours")) visionHours = "";
			if (cleared.has("visionTargetClients")) visionTargetClients = "";
			if (cleared.has("visionCreditScore")) visionCreditScore = "";
		};
		window.addEventListener("re2:concept-changed", onConceptChanged);

		return () => {
			window.removeEventListener("scroll", onScroll);
			tabBody?.removeEventListener("scroll", onScroll);
			window.removeEventListener("re2:concept-changed", onConceptChanged);
		};
	});

	// ── AI-Powered Panel Intelligence ──
	type AIVisionAnchor = {
		trends: Array<{ title: string; insight: string }>;
		demandSignal: string;
		differentiatorTip: string;
	} | null;
	type AIFitRecs = {
		recommendations: Array<{
			action: string;
			impact: string;
			priority: "high" | "medium" | "low";
		}>;
		overallAdvice: string;
	} | null;
	let aiVisionAnchor = $state<AIVisionAnchor>(null);
	let aiVisionLoading = $state(false);
	let aiFitRecs = $state<AIFitRecs>(null);
	let aiFitLoading = $state(false);
	// Deterministic neighborhood recs — no API call, always available
	let hoodRecs = $derived<HoodRecs | null>(
		hasResult && visionBizType
			? getNeighborhoodRecs(
					visionBizType,
					currentBorough || "NYC",
					locationNeighborhood || undefined,
				)
			: null,
	);

	async function fetchAIInsights() {
		if (!hasResult || !visionBizType) return;
		let medIncome = 0;
		try {
			const intel = JSON.parse(
				sessionStorage.getItem("re2_location_intel") || "{}",
			);
			medIncome = intel?.census?.medianHouseholdIncome || 0;
		} catch {}
		const hood = locationNeighborhood || "";
		const boro =
			currentBorough ||
			(currentGeoid ? geoidToBorough(currentGeoid) : "Manhattan");
		const conceptLabel = bizTypeLabel;
		const concept = visionBizType;

		// Fire 2 AI calls in parallel (neighborhoods now deterministic — no API call needed)
		aiVisionLoading = true;
		aiFitLoading = true;

		const visionPromise = apiFetch("/api/ai", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				action: "vision-anchor",
				conceptType: concept,
				conceptLabel,
				neighborhood: hood,
				borough: boro,
				differentiators: visionDifferentiators,
				targetClients: visionTargetClients,
				competitors: analysisStore.competitors.length,
				medianIncome: medIncome,
			}),
		})
			.then((r: any) => {
				if (r.success) aiVisionAnchor = r.data;
			})
			.catch(() => {})
			.finally(() => {
				aiVisionLoading = false;
			});

		const fitPromise = apiFetch("/api/ai", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				action: "fit-improvement",
				conceptType: concept,
				conceptLabel,
				neighborhood: hood,
				borough: boro,
				fitIQ,
				locationIQ,
				visionIQ,
				sixScores,
				monthlyRent: bpRent || 5000,
				avgCheck: bpAvgTicket || 0,
				competitors: analysisStore.competitors.length,
				differentiators: visionDifferentiators,
				medianIncome: medIncome,
			}),
		})
			.then((r: any) => {
				if (r.success) aiFitRecs = r.data;
			})
			.catch(() => {})
			.finally(() => {
				aiFitLoading = false;
			});

		await Promise.allSettled([visionPromise, fitPromise]);
	}

	// ── Quick P&L Side Panel ──
	let bpShowPanel = $state(false);
	// Concept-aware defaults for inputs
	const BP_DEFAULTS: Record<
		string,
		{
			dailyCust: number;
			avgTicket: number;
			cogs: number;
			laborPct: number;
			rent: number;
			opex: number;
			productMix: string;
		}
	> = {
		specialty_coffee: {
			dailyCust: 250,
			avgTicket: 8.75,
			cogs: 28,
			laborPct: 30,
			rent: 5000,
			opex: 2500,
			productMix: "70% bev / 30% food",
		},
		bakery: {
			dailyCust: 180,
			avgTicket: 12,
			cogs: 32,
			laborPct: 28,
			rent: 5000,
			opex: 2500,
			productMix: "60% baked / 40% bev",
		},
		fast_casual: {
			dailyCust: 120,
			avgTicket: 14,
			cogs: 30,
			laborPct: 28,
			rent: 10000,
			opex: 3500,
			productMix: "80% food / 20% bev",
		},
		full_service_restaurant: {
			dailyCust: 60,
			avgTicket: 45,
			cogs: 32,
			laborPct: 32,
			rent: 14000,
			opex: 5000,
			productMix: "65% food / 35% bev",
		},
		bar_nightlife: {
			dailyCust: 80,
			avgTicket: 18,
			cogs: 22,
			laborPct: 25,
			rent: 10000,
			opex: 3000,
			productMix: "80% bev / 20% food",
		},
		fitness_studio: {
			dailyCust: 40,
			avgTicket: 25,
			cogs: 10,
			laborPct: 35,
			rent: 7000,
			opex: 3000,
			productMix: "70% class / 30% retail",
		},
		retail: {
			dailyCust: 40,
			avgTicket: 55,
			cogs: 45,
			laborPct: 20,
			rent: 8000,
			opex: 3000,
			productMix: "85% product / 15% service",
		},
		personal_services: {
			dailyCust: 25,
			avgTicket: 65,
			cogs: 15,
			laborPct: 35,
			rent: 4000,
			opex: 2000,
			productMix: "80% service / 20% product",
		},
	};
	let bpDefaults = $derived(
		BP_DEFAULTS[visionBizType] || BP_DEFAULTS.specialty_coffee,
	);
	let bpDailyCust = $state(0);
	let bpAvgTicket = $state(0);
	let bpCogsPct = $state(0);
	let bpLaborPct = $state(0);
	let bpRent = $state(0);
	let bpOpex = $state(0);
	let bpFtEmployees = $state(2);
	let bpPtEmployees = $state(3);
	let bpDaysPerWeek = $state(6);
	let bpInitialized = $state(false);

	// Initialize BP fields from concept defaults (only once, on first open)
	function initBpFields() {
		if (bpInitialized) return;
		const d = bpDefaults;
		// Pull from vision fields if they exist, otherwise use concept defaults
		bpDailyCust = d.dailyCust;
		bpAvgTicket =
			parseFloat(visionAvgCheck?.replace("$", "") || "0") || d.avgTicket;
		bpCogsPct = d.cogs;
		bpLaborPct = d.laborPct;
		bpRent = d.rent;
		bpOpex = d.opex;
		const empCount =
			(
				{ just_me: 1, "1_3": 2, "4_8": 6, "9_plus": 12 } as Record<
					string,
					number
				>
			)[visionEmployees] || 4;
		bpFtEmployees = Math.max(1, Math.ceil(empCount * 0.4));
		bpPtEmployees = Math.max(0, empCount - bpFtEmployees);
		bpInitialized = true;
	}

	// P&L derived values
	let bpAnnualRevenue = $derived(
		bpDailyCust * bpAvgTicket * bpDaysPerWeek * 52,
	);
	let bpMonthlyRevenue = $derived(Math.round(bpAnnualRevenue / 12));
	let bpCogsCost = $derived(Math.round((bpAnnualRevenue * bpCogsPct) / 100));
	let bpLaborCost = $derived(
		Math.round((bpAnnualRevenue * bpLaborPct) / 100),
	);
	let bpAnnualRent = $derived(bpRent * 12);
	let bpAnnualOpex = $derived(bpOpex * 12);
	let bpTotalCosts = $derived(
		bpCogsCost + bpLaborCost + bpAnnualRent + bpAnnualOpex,
	);
	let bpPreTaxProfit = $derived(bpAnnualRevenue - bpTotalCosts);
	let bpMarginPct = $derived(
		bpAnnualRevenue > 0
			? Math.round((bpPreTaxProfit / bpAnnualRevenue) * 100)
			: 0,
	);

	// 3 smart recommendations based on inputs + location data
	let bpRecommendations = $derived.by(() => {
		if (!bpInitialized || bpAnnualRevenue <= 0) return [];
		const recs: {
			icon: string;
			title: string;
			body: string;
			type: "revenue" | "cost" | "positioning";
		}[] = [];
		const rentPct =
			bpAnnualRevenue > 0
				? Math.round((bpAnnualRent / bpAnnualRevenue) * 100)
				: 0;
		const kpi = CONCEPT_KPIS[visionBizType];
		const maxRent = kpi?.maxRentPercent || 12;
		// Revenue recommendation
		if (bpMarginPct < 10) {
			recs.push({
				icon: "📈",
				title: "Improve revenue",
				body: `At $${bpAvgTicket.toFixed(0)}/check × ${bpDailyCust}/day, you need either 15% more customers or a $${Math.round(bpAvgTicket * 0.15)} higher ticket to reach healthy margins.`,
				type: "revenue",
			});
		} else {
			const upsellTarget = Math.round(bpAvgTicket * 1.1);
			recs.push({
				icon: "📈",
				title: "Revenue growth lever",
				body: `A $${(upsellTarget - bpAvgTicket).toFixed(0)} upsell per transaction adds $${Math.round((upsellTarget - bpAvgTicket) * bpDailyCust * bpDaysPerWeek * 52).toLocaleString()}/yr. Consider add-ons, combos, or premium tiers.`,
				type: "revenue",
			});
		}
		// Cost recommendation
		if (rentPct > maxRent) {
			recs.push({
				icon: "✂️",
				title: "Pare costs — rent",
				body: `Rent is ${rentPct}% of revenue (target: <${maxRent}%). Negotiate free months, revenue share, or sublet unused hours. Every $500/mo saved = $6K/yr to margin.`,
				type: "cost",
			});
		} else if (bpCogsPct > 33) {
			recs.push({
				icon: "✂️",
				title: "Pare costs — COGS",
				body: `${bpCogsPct}% COGS is above the ${visionBizType === "retail" ? "40%" : "30%"} benchmark. Review supplier contracts, reduce waste, and consider a simpler menu to cut 3-5 points.`,
				type: "cost",
			});
		} else {
			recs.push({
				icon: "✂️",
				title: "Cost efficiency",
				body: `Your cost structure looks reasonable. Focus on labor scheduling — matching staff to peak hours can save 5-8% on labor without cutting service.`,
				type: "cost",
			});
		}
		// Positioning recommendation (uses location signals)
		const s = sixScores;
		let medIncome = 0;
		try {
			const intel = JSON.parse(
				sessionStorage.getItem("re2_location_intel") || "{}",
			);
			medIncome = intel?.census?.medianHouseholdIncome || 0;
		} catch {}
		if (s.transit >= 70 && s.vibrancy >= 60) {
			recs.push({
				icon: "🎯",
				title: "Winning position",
				body: `High-traffic, vibrant block. Lead with speed + visibility. Sidewalk signage, mobile ordering, and a distinctive storefront will capture walk-bys. Target the commuter rush.`,
				type: "positioning",
			});
		} else if (medIncome > 80000 && s.vibrancy < 50) {
			recs.push({
				icon: "🎯",
				title: "Winning position",
				body: `Affluent but quiet block. Build a destination. Focus on quality + experience + community events. Your repeat customer within 5 blocks is your revenue engine.`,
				type: "positioning",
			});
		} else {
			recs.push({
				icon: "🎯",
				title: "Winning position",
				body: `${analysisStore.competitors.length > 5 ? "Competitive block — your differentiator is everything. " : ""}Focus on the ${bpDailyCust * 0.3 < 20 ? "repeat customer" : "walk-by + regular"} mix. Match your hours to when ${locationNeighborhood || "this block"} is busiest.`,
				type: "positioning",
			});
		}
		return recs;
	});

	// ── Inline Compare Tab ──────────────────────────────────────────
	interface CompareEntry {
		addr: string;
		locationIQ: number;
		fitIQ: number;
		survivalRate: number;
		scores: Record<string, number>;
		loading?: boolean;
	}
	const COMPARE_DIMS = [
		{ key: "survivalRate", label: "Survival Rate", highlight: true },
		{ key: "transit", label: "Transit" },
		{ key: "demographics", label: "Demographics" },
		{ key: "competition", label: "Competition" },
		{ key: "vibrancy", label: "Concept Pulse" },
		{ key: "safety", label: "Safety" },
		{ key: "momentum", label: "Momentum" },
	];
	const COMPARE_RANK_COLORS = ["#4a7c5c", "#2563EB", "#e8a838"];

	let compareList = $state<CompareEntry[]>([]);
	let compareNewAddr = $state("");
	let compareAdding = $state(false);
	let compareAddError = $state("");
	let compareInited = $state(false);

	let compareFitScores = $derived(compareList.map((e) => e.fitIQ));
	let compareMaxFit = $derived(
		Math.max(
			...(compareList.length ? compareList.map((e) => e.fitIQ) : [0]),
		),
	);
	let compareFitGap = $derived(
		compareList.length >= 2
			? compareList[0].fitIQ - compareList[1].fitIQ
			: null,
	);

	function cmpGapCls(gap: number) {
		return gap > 0
			? "cmp-gap-pos"
			: gap < 0
				? "cmp-gap-neg"
				: "cmp-gap-tie";
	}
	function cmpScoreStyle(s: number) {
		return s >= 70
			? "color:#4a7c5c"
			: s >= 50
				? "color:#e8a838"
				: "color:#e8345a";
	}
	function cmpDimScore(entry: CompareEntry, key: string) {
		return key === "survivalRate"
			? entry.survivalRate
			: Math.round(entry.scores[key] ?? 0);
	}
	function cmpShortAddr(addr: string) {
		const first = addr.split(/,\s*(?=New York|NY\s|\d{5})/i)[0];
		const street = first.replace(/,/g, " ").replace(/\s+/g, " ").trim();
		if (street.length <= 16) return street;
		const words = street.split(" ");
		let result = "";
		for (const w of words) {
			const c = result ? `${result} ${w}` : w;
			if (c.length > 16) break;
			result = c;
		}
		return result || street.slice(0, 16);
	}

	// Init compare list with primary location when tab is first opened
	$effect(() => {
		if (exploreTab === "compare" && !compareInited && analysisAddress) {
			compareInited = true;
			try {
				const intel = JSON.parse(
					sessionStorage.getItem("re2_location_intel") || "{}",
				);
				const sr = Math.round(
					intel.survivalRate ?? intel.survival_rate ?? 0,
				);
				compareList = [
					{
						addr: analysisAddress,
						locationIQ,
						fitIQ,
						survivalRate: sr,
						scores: sixScores,
					},
				];
			} catch {
				compareList = [
					{
						addr: analysisAddress,
						locationIQ,
						fitIQ,
						survivalRate: 0,
						scores: sixScores,
					},
				];
			}
		}
	});

	async function compareAddAddress() {
		const inputAddr = compareNewAddr.trim();
		if (!inputAddr || compareAdding || compareList.length >= 3) return;
		compareAdding = true;
		compareAddError = "";
		compareList = [
			...compareList,
			{
				addr: inputAddr,
				locationIQ: 0,
				fitIQ: 0,
				survivalRate: 0,
				scores: {},
				loading: true,
			},
		];
		compareNewAddr = "";
		try {
			const geoRes = await apiFetch(
				`/api/geo?type=nominatim&q=${encodeURIComponent(inputAddr)}&limit=1`,
			);
			if (!geoRes.ok) throw new Error("Geocoding failed");
			const geoData = await geoRes.json();
			if (!Array.isArray(geoData) || geoData.length === 0)
				throw new Error("Address not found in NYC");
			const { lat: latStr, lon: lngStr, display_name } = geoData[0];
			let concept = "specialty_coffee";
			try {
				const sess = JSON.parse(
					localStorage.getItem("re2_session") || "{}",
				);
				concept =
					sess.canonicalConcept ||
					sess.visionBizType ||
					sess.bizType ||
					sess.businessType ||
					"specialty_coffee";
			} catch {}
			const bgRes = await apiFetch(
				`/api/block-group-intel?lat=${parseFloat(latStr)}&lng=${parseFloat(lngStr)}&concept=${encodeURIComponent(concept)}`,
			);
			if (!bgRes.ok)
				throw new Error(
					"Could not score this location — it may be outside NYC",
				);
			const bgData = await bgRes.json();
			if (!bgData.scores)
				throw new Error("No score data for this address");
			const s = bgData.scores as {
				location_iq?: number;
				location_iq_v2?: number;
				survival_rate?: number;
				six_index?: Record<string, number>;
			};
			const six = s.six_index ?? {};
			const dimScores: Record<string, number> = {
				transit: Math.round(six.transit ?? 0),
				demographics: Math.round(six.demographics ?? 0),
				competition: Math.round(six.competition ?? 0),
				vibrancy: Math.round(six.vibrancy ?? 0),
				safety: Math.round(six.safety ?? 0),
				momentum: Math.round(six.momentum ?? 0),
			};
			const sr = Math.round(s.survival_rate ?? 0);
			const liq = Math.round(s.location_iq ?? s.location_iq_v2 ?? 0);
			const resolvedAddr =
				display_name?.split(",").slice(0, 2).join(",") || inputAddr;
			compareList = compareList.map((e) =>
				e.addr === inputAddr && e.loading
					? {
							addr: resolvedAddr,
							locationIQ: liq,
							fitIQ: liq,
							survivalRate: sr,
							scores: dimScores,
						}
					: e,
			);
		} catch (err: unknown) {
			compareAddError =
				err instanceof Error
					? err.message
					: "Could not score this address";
			compareList = compareList.filter(
				(e) => !(e.addr === inputAddr && e.loading),
			);
		}
		compareAdding = false;
	}
</script>

<svelte:head>
	<title>RE\u00B2 \u2014 Location Intelligence</title>
	<link
		rel="stylesheet"
		href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"
	/>
</svelte:head>

<div class="location-page">
	<!--
		GAP-3 FIX (2026-04-18)
		Author:   Antigravity / Jared Claw
		Ticket:   Playwright B3-02 — "GAP 3 CONFIRMED: No Back to Dashboard button on Location IQ page"
		Problem:  After scoring a location, users had no visible way to return to the dashboard.
		          The only exit was the browser's native back button, which is a UX dead-end
		          especially on mobile or when the user navigated here from an external link.
		Fix:      Added a minimal "← Back to Dashboard" anchor above all content blocks.
		          Links to /app/route (the main dashboard route). No logic change.
		Verified: Playwright B3-02 will now detect this link and pass.
	-->
	<a href="/app/route" class="loc-back-link">← Back to Dashboard</a>
	{#if analysisError}
		<div class="analysis-error-banner">
			<span class="error-icon"
				><span class="icon" aria-hidden="true"
					><svg width="16" height="16" viewBox="0 0 16 16" fill="none"
						><path
							d="M8 2L1.5 13.5h13L8 2z"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linejoin="round"
						/><path
							d="M8 7v3M8 11.5v.5"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
						/></svg
					></span
				></span
			>
			<span class="error-text">{analysisError}</span>
			<button
				class="error-dismiss"
				onclick={() => {
					analysisError = "";
				}}>✕</button
			>
		</div>
	{/if}
	{#if !hasResult}
		<!-- ========== PRE-SEARCH / LOADING STATE ========== -->
		{#if comingFromBot}
			<!-- Coming from onboarding bot — show progress + 15s timeout escape -->
			{#if handoffTimedOut}
				<div class="bot-handoff bot-handoff-timeout">
					<div class="handoff-icon">⏱️</div>
					<div class="handoff-title">Taking longer than expected</div>
					<div class="handoff-msg">
						Some data sources may be slow right now. Try again or
						enter a different address.
					</div>
					<button
						class="handoff-retry"
						onclick={() => {
							window.location.href = "/app/location";
						}}>↺ Try Again</button
					>
				</div>
			{:else}
				<div class="bot-handoff">
					<AddressAnalyzer
						{store}
						onScoresReady={handleScoresReady}
						onBeforeSearch={handleBeforeSearch}
						searchOnly={true}
					/>
					<div class="handoff-progress">
						<span class="handoff-spinner"></span>
						<span class="handoff-progress-msg"
							>{HANDOFF_MESSAGES[handoffProgressIdx]}</span
						>
					</div>
				</div>
			{/if}
		{:else}
			<div class="pre-search">
				<div class="map-panel-hero">
					<!-- 04.19.2026 18:00 - Modular Map Extraction (State 0) -->
					<LocationContextMap
						store={analysisStore}
						compact={false}
						showPin={false}
					/>
					<div class="map-overlay">
						<!-- NAV-04: State 0 vs State 1 — different copy for no-concept vs has-concept -->
						{#if !visionBizType && !store.bizType}
							<h1 class="map-overlay-title">
								Tell us about your concept first
							</h1>
							<p class="map-overlay-sub">
								We need to know what kind of business you're
								opening before we can score a location. It takes
								about 2 minutes.
							</p>
							<a href="/app/onboarding" class="map-overlay-cta"
								>Get Started →</a
							>
						{:else}
							<div class="map-overlay-badge">{bizTypeLabel}</div>
							<h1 class="map-overlay-title">
								Should you sign this lease?
							</h1>
							<p class="map-overlay-sub">
								Enter an address. We'll check everything that
								matters for your concept &mdash; foot traffic,
								competition, safety, and more.
							</p>
						{/if}
					</div>
				</div>
				{#if visionBizType || store.bizType}
					<div class="search-panel">
						<AddressAnalyzer
							{store}
							onScoresReady={handleScoresReady}
							onBeforeSearch={handleBeforeSearch}
						/>
					</div>
				{/if}
			</div>
		{/if}
	{:else}
		<!-- ========== E2b SCORED STATE ========== -->

		<!-- TOPBAR REMOVED: double nav eliminated (Phase 1C). Save + nav via layout + score-actions bar below hero -->

		<!-- FIND-B-07: NavigationDrawer on location/results page -->
		<!-- NEW-01: pass live analysisAddress so drawer never shows stale address from re2_session -->
		<NavigationDrawer analyzedAddress={analysisAddress} />

		<!-- UX-FIX-01: Mapper fix banner on LIQ page -->
		{#if showMapperBannerLIQ}
			<div class="mapper-banner">
				<div class="mapper-banner-text">
					<strong>Scores updated.</strong> We've improved how we identify
					competitors for your concept type. Your scores have been recalculated
					with more accurate data.
				</div>
				<button
					class="mapper-banner-dismiss"
					onclick={dismissMapperBannerLIQ}
					aria-label="Dismiss">✕</button
				>
			</div>
		{/if}

		{#if saveToast}
			<div class="save-toast">{saveToast}</div>
		{/if}

		<!-- UX-18: Shortlist toast with destination link -->
		{#if shortlistToastVisible}
			<div class="shortlist-toast" role="status">
				<span>✓ Saved to shortlist.</span>
				<a href="/app/dashboard#shortlist" class="shortlist-toast-link"
					>View shortlist →</a
				>
			</div>
		{/if}

		<!-- ═══ V3: SPLIT FOCUS LAYOUT ═══ -->
		{@const _transitScore =
			sixScores["transit"] || sixScores["transitScore"] || 0}
		{@const _survivalScore =
			sixScores["survivalRate"] || sixScores["survival_rate"] || 0}
		{@const _demographicsScore = sixScores["demographics"] || 0}
		{@const _competitionScore = sixScores["competition"] || 0}
		{@const _vibrancyScore =
			sixScores["vibrancy"] || sixScores["vibrancy_index"] || 0}
		{@const _momentumScore = sixScores["momentum"] || 0}
		{@const _safetyScore = sixScores["safety"] || 0}
		{@const _addrShort = analysisAddress
			? analysisAddress.split(",")[0]
			: "Location"}
		{@const _addrRest = analysisAddress
			? analysisAddress.split(",").slice(1, 3).join(",").trim()
			: ""}
		{@const _NYC_SURVIVAL = 52}
		{@const _survDelta = _survivalScore - _NYC_SURVIVAL}
		{@const _survCmp =
			_survivalScore <= 0
				? ""
				: _survDelta >= 3
					? "Above average"
					: _survDelta <= -3
						? "Below average"
						: "Average"}
		{@const _fitBand =
			fitIQ >= 75
				? "strong"
				: fitIQ >= 65
					? "viable"
					: fitIQ >= 50
						? "tight"
						: fitIQ >= 40
							? "stretch"
							: "rethink"}
		<!-- B3-1.5: prefer API verdict ('Viable', 'Tight') over client-computed tier label -->
		{@const _fitLabel = apiVerdict || fitTierLabel(fitIQ)}
		<!-- B3-1.5: API emits gradeCapped when safety/survival forces a cap.
				     Prefer API value (authoritative) over client-computed fitGradeCapped(). -->
		{@const _fitGrade =
			gradeCapped || fitGradeCapped(fitIQ, sixScores, _survivalScore)}
		<!-- §1d (April 11): Hero verdict uses the new fitMeaning(score, ctx) signature.
				     watchOutCount is capped at 5 to match the Watch Out panel render cap
				     (evidence.hurting.slice(0, 5)) so the promise "we'll show you all of them"
				     doesn't outrun what the founder actually sees. fitVerdictShort replaces
				     the redundant "{fitIQ}/100 — {_fitLabel}." prefix with a single plain-
				     English sentence like "Workable specialty coffee location." — but only
				     when we have a concept label; otherwise we fall back to the tier prefix
				     because Brain's default concept="location" produces "location location." -->
		{@const _watchOutCount = Math.min(evidence.hurting.length, 5)}
		{@const _fitMeaning = fitMeaning(fitIQ, {
			watchOutCount: _watchOutCount,
		})}
		{@const _conceptForVerdict = CONCEPT_LABELS[visionBizType] || ""}
		{@const _fitVerdictShort = _conceptForVerdict
			? fitVerdictShort(fitIQ, _conceptForVerdict)
			: ""}
		{@const _fitNextTier = fitNextTier(fitIQ)}

		<!-- UX-J: Rule 17 hard-block banner. Hero-level, above the v3-hero ring.
				     Shows only for liquor-dependent concepts when the stable
				     '🚫 SLA 200-ft BLOCK' signal is present in iq.signals. -->
		{#if rule17Block}
			<div class="rule17-banner" role="alert" aria-live="assertive">
				<div class="rule17-banner-inner">
					<div class="rule17-banner-icon" aria-hidden="true">🚫</div>
					<div class="rule17-banner-body">
						<div class="rule17-banner-title">
							This location cannot get a liquor license
						</div>
						<div class="rule17-banner-copy">
							{#if rule17Block.schoolName && rule17Block.distFt}
								{rule17Block.schoolName} is {rule17Block.distFt}
								ft away. NY SLA 200-ft rule — zero exceptions.
							{:else}
								A school is within 200 ft of this address. NY
								SLA 200-ft rule — zero exceptions.
							{/if}
						</div>
					</div>
					<div class="rule17-banner-actions">
						<button
							type="button"
							class="rule17-btn rule17-btn-primary"
							onclick={rule17Reset}>Reset search</button
						>
						<button
							type="button"
							class="rule17-btn rule17-btn-ghost"
							onclick={() => {
								/* stay on page */
							}}>Proceed anyway</button
						>
					</div>
				</div>
			</div>
		{/if}

		<!-- UX-3.1: Kill factor banner — when API returns killFactors + fitIQ ≤ 49 -->
		{#if apiKillBannerVisible}
			<div class="kill-factor-banner" role="alert" aria-live="polite">
				<div class="kill-factor-banner-inner">
					<div class="kill-factor-banner-icon">⛔</div>
					<div class="kill-factor-banner-body">
						<div class="kill-factor-banner-title">
							Kill factor detected: {apiKillFactors[0].name}
						</div>
						<div class="kill-factor-banner-copy">
							Your Score capped at {fitIQ} — {apiKillFactors[0]
								.reason}{#if apiKillFactors.length > 1}<span
									class="kill-factor-more"
								>
									(+{apiKillFactors.length - 1} more)</span
								>{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- V3 HERO: Green strip with single Fit IQ ring + verdict + stats -->
		{#if fitIQ > 0 || locationIQ > 0}
			<div class="v3-hero">
				<div class="v3-hero-inner">
					<!-- Single Fit IQ ring -->
					<div class="v3-hero-ring-wrap">
						<svg
							width="120"
							height="120"
							viewBox="0 0 120 120"
							style="transform:rotate(-90deg)"
						>
							<circle
								cx="60"
								cy="60"
								r="52"
								fill="none"
								stroke="rgba(255,255,255,0.12)"
								stroke-width="6"
							/>
							<circle
								cx="60"
								cy="60"
								r="52"
								fill="none"
								stroke={fitIQ >= 65
									? "#34d399"
									: fitIQ >= 50
										? "#fbbf24"
										: "#f87171"}
								stroke-width="6"
								stroke-dasharray="326.7"
								stroke-dashoffset={326.7 * (1 - fitIQ / 100)}
								stroke-linecap="round"
							/>
						</svg>
						<div
							class="v3-hero-ring-num"
							class:is-live-preview={livePreviewActive}
						>
							{fitIQ}
						</div>
						<div class="v3-hero-ring-label">Your Score</div>
						<!-- UX-NEW-5 (H7): ring badge removed -->
						<!-- UX-3.2: grade-cap note from Brain 3 API -->
						{#if gradeCapped && gradeCapReason}
							<div
								class="v3-hero-grade-cap-note"
								title={gradeCapReason}
							>
								Grade capped at {gradeCapped}
							</div>
						{/if}
						<!-- UX-20: Live preview badge — shown while /api/score/preview is in flight -->
						{#if livePreviewActive}
							<div
								class="v3-hero-live-badge"
								title="Updating score from your new inputs…"
							>
								LIVE
							</div>
						{/if}
						<!-- UX-FIX-1 (Emergency Fix April 11): absolute-positioned PRELIM stamp
							     removed from the ring. It was competing with the score number visually.
							     The confidence state is now demoted into <ScoreHeader> as a muted amber
							     pill on the second line of the header, below Grade + Verdict. -->
					</div>

					<!-- Text block — leads with plain-language meaning -->
					<div class="v3-hero-text">
						<!-- UX-FIX-1: single composite header — baseline-aligned Grade + Verdict
							     + demoted PRELIM/PARTIAL stamp. Replaces the old .v3-hero-verdict-row
							     + .v3-hero-prelim-stamp duo that lived in two different spots. -->
						<ScoreHeader
							grade={_fitGrade}
							verdict={_fitLabel}
							verdictIcon={fitIQ >= 65
								? "✓"
								: fitIQ >= 50
									? "◑"
									: "✗"}
							confidence={scoreConfidence}
							confidenceReason={scoreConfidenceReason}
						/>
						<div class="v3-hero-addr">
							{_addrShort}
							{#if _addrRest}<span class="v3-hero-addr-sub">
									· {_addrRest}</span
								>{/if}
						</div>
						<!-- FIRST LINE: plain-language meaning. §1d (April 11): when we have a
							     concept label we use fitVerdictShort() for a single-sentence opener
							     ("Workable coffee location.") instead of the redundant "{score}/100 —
							     {tier}." prefix. fitMeaning already contains the watch-out suffix. -->
						<div class="v3-hero-meaning">
							{#if _fitVerdictShort}
								<strong>{_fitVerdictShort}</strong>
								{_fitMeaning}
							{:else}
								<strong>{fitIQ}/100 — {_fitLabel}</strong> · {_fitMeaning}
							{/if}
							<!-- UX-10: continuation when inputs <50% filled — directs the founder to Vision to sharpen the score -->
							{#if visionIsPrelim && visionCompletionPct < 50}
								{" "}Based on {visionFieldsFilled.filled} of {visionFieldsFilled.total}
								inputs —
								<button
									type="button"
									class="v3-hero-sharpen-link"
									onclick={() => {
										activeV3Tab = "vision";
									}}
									>add concept details to refine this score</button
								>.
							{/if}
						</div>
						{#if _fitNextTier && _fitNextTier.points > 0 && _fitNextTier.points <= 15}
							<div class="v3-hero-next-tier">
								You're <strong
									>{_fitNextTier.points}
									{_fitNextTier.points === 1
										? "point"
										: "points"}</strong
								>
								from <strong>{_fitNextTier.label}</strong>
								territory.
								<button
									type="button"
									class="v3-hero-howlink"
									onclick={() =>
										askCopilot(
											`How do I get from ${fitIQ} to ${_fitNextTier?.threshold ?? fitIQ}?`,
										)}>How? →</button
								>
							</div>
						{/if}
						<!-- §1b (April 11): Hero percentile respects confidence. If the aggregate
							     location-side reliability dial is in the "partial" band the percentile
							     line gets a ~ prefix + tooltip; in the "skeleton" band it renders as
							     a skeleton pill instead of a number. Full tier is the no-op default. -->
						<!-- R1-5: Hide when skeleton. UX-T11: suppress "Better than X%" phrasing
							     for Tight/Stretch/Rethink — replace with neutral range context. -->
						{#if percentileText && locationConfidenceTier !== "skeleton"}
							{@const _isLowVerdict = fitIQ > 0 && fitIQ < 65}
							{@const _displayPercentile = _isLowVerdict
								? `In the middle range for NYC ${CONCEPT_LABELS[visionBizType] || "locations"}`
								: percentileText}
							{#if locationConfidenceTier === "partial"}
								<div
									class="v3-hero-percentile v3-metric-partial"
									title="Preliminary — based on partial data, refreshing soon."
								>
									~ {_displayPercentile}
								</div>
							{:else}
								<div class="v3-hero-percentile">
									{_displayPercentile}
								</div>
							{/if}
						{/if}
						<div class="v3-hero-actions">
							<a
								href="/app/business-plan"
								class="v3-hero-btn v3-hero-btn-primary"
								>Build your Business Case →</a
							>
							<button
								class="v3-hero-btn v3-hero-btn-ghost"
								onclick={togglePin}
								type="button"
							>
								{#if isPinned}✓ Shortlisted{:else}⊕ Save to
									shortlist{/if}
							</button>
							<button
								class="v3-hero-btn v3-hero-btn-ghost"
								onclick={exportFounderBrief}
								type="button">↗ Export brief</button
							>
							<!-- UX-T2: Documents button removed (H9/R2) — no backend yet -->
						</div>
						<!-- UX-FIX-4 (Emergency Fix April 11): "Tip: Business case is more accurate" removed
							     from the score panel. It was a cross-module CTA injected before the founder
							     could form a mental model, and a blocker to glanceability. The nudge now lives
							     inside the Business Case tab as an inbound hint (see BC PRELIM banner). -->
						<!-- prettier-ignore -->
						<!-- (UX-13 removed — nudge relocated to BC tab) -->
					</div>

					<!-- UX-FIX-2 (Emergency Fix April 11): hero "Ask me anything" chips now
						     route every click through askCopilot(), which pushes both the user
						     question and the bot reply into inlineCpMessages — the rendered list
						     below the hero. Before this, chip clicks fired the API but dropped
						     the reply, so the founder saw nothing happen. -->
					<div class="v3-hero-cp-card">
						<div class="v3-hero-cp-head">
							<span class="v3-hero-cp-sparkle">✨</span>
							<span class="v3-hero-cp-title"
								>Ask about this location</span
							>
						</div>
						<div class="v3-hero-cp-sub">about {_addrShort}</div>
						<div class="v3-hero-cp-chips">
							<button
								type="button"
								class="v3-hero-cp-chip"
								disabled={inlineCpLoading}
								onclick={() =>
									askCopilot(`Why is this a ${fitIQ}?`)}
								>Why is this a {fitIQ}?</button
							>
							<button
								type="button"
								class="v3-hero-cp-chip"
								disabled={inlineCpLoading}
								onclick={() =>
									askCopilot(
										"How do I improve my chances of success here?",
									)}>How do I improve my chances?</button
							>
							<button
								type="button"
								class="v3-hero-cp-chip"
								disabled={inlineCpLoading}
								onclick={() =>
									askCopilot(
										"What would kill this location?",
									)}>What would kill this?</button
							>
						</div>
					</div>
				</div>

				<!-- Meta line -->
				<!-- UX-FIX-3 (Emergency Fix April 11): "View data sources" click-through removed (IP leak).
					     Kept as a trust pill only — the tooltip summarises the count; the full source list is
					     available only in the authenticated PDF export. -->
				<div class="v3-hero-meta">
					<ScoreMetaLine
						scoredAt={scoredAtDisplay}
						surface="ring"
						onRescore={() => {
							forceRefreshScores();
						}}
					/>
					{#if dataCompleteness && dataCompleteness.pct > 0}
						<span
							class="v3-data-pill v3-data-pill--static"
							title="Analyzed from 20+ live city + market data sources. Full list available in the exported brief."
						>
							Based on {dataCompleteness.available} of {dataCompleteness.total}
							data sources
						</span>
					{:else}
						<span
							class="v3-data-pill v3-data-pill--static"
							title="Analyzed from 20+ live city + market data sources. Full list available in the exported brief."
						>
							Analyzed from 20+ live city + market data sources
						</span>
					{/if}
				</div>
			</div>

			<!-- Addendum §2.4: Re-score comparison banner — never silently change a score -->
			{#if rescoreComparison}
				{@const delta = rescoreComparison.next - rescoreComparison.prev}
				{@const direction =
					delta > 0 ? "up" : delta < 0 ? "down" : "unchanged"}
				<div class="rescore-comparison rescore-comparison--{direction}">
					<span class="rescore-comparison__icon"
						>{direction === "up"
							? "↑"
							: direction === "down"
								? "↓"
								: "="}</span
					>
					<span class="rescore-comparison__text">
						Score updated — was <strong
							>{rescoreComparison.prev}</strong
						>, now
						<strong>{rescoreComparison.next}</strong
						>{#if delta !== 0}
							({delta > 0 ? "+" : ""}{delta}){/if}
					</span>
					<button
						type="button"
						class="rescore-comparison__dismiss"
						onclick={() => {
							rescoreComparison = null;
						}}
						aria-label="Dismiss">✕</button
					>
				</div>
			{/if}
		{/if}

		<!-- UX-FIX-2 (Emergency Fix April 11): Ask-Anything answer surface.
				     Renders the shared inlineCpMessages list — chips, hero "How?" link,
				     per-lens "Ask CoPilot →" buttons, and the bottom bar all push into
				     this list via askCopilot(). Collapsed when empty, auto-opens after
				     first question. -->
		{#if inlineCpMessages.length > 0 || inlineCpLoading}
			<div
				class="v3-ask-answer"
				role="log"
				aria-live="polite"
				aria-label="Co-Pilot answers"
			>
				<div class="v3-ask-answer-head">
					<span class="v3-ask-answer-sparkle" aria-hidden="true"
						>✨</span
					>
					<span class="v3-ask-answer-title">Co-Pilot</span>
					<button
						type="button"
						class="v3-ask-answer-clear"
						onclick={() => {
							inlineCpMessages = [];
						}}
						disabled={inlineCpMessages.length === 0 ||
							inlineCpLoading}>Clear</button
					>
				</div>
				<div class="v3-ask-answer-body">
					{#each inlineCpMessages as m, i (i)}
						<div class="v3-ask-msg v3-ask-msg--{m.role}">
							{#if m.role === "bot"}<span
									class="v3-ask-msg-avatar"
									aria-hidden="true">RE²</span
								>{/if}
							<div class="v3-ask-msg-bubble">
								{sanitizeCopilotText(m.text)}
							</div>
						</div>
					{/each}
					{#if inlineCpLoading}
						<div class="v3-ask-msg v3-ask-msg--bot">
							<span class="v3-ask-msg-avatar" aria-hidden="true"
								>RE²</span
							>
							<div
								class="v3-ask-msg-bubble v3-ask-msg-bubble--thinking"
							>
								<span class="v3-ask-dot"></span><span
									class="v3-ask-dot"
								></span><span class="v3-ask-dot"></span>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- V3 SPLIT: Left tabs + Right map -->
		{#if hasResult && fitIQ > 0}
			<div class="v3-split">
				<!-- ═══ LEFT PANEL: TABS ═══ -->
				<div class="v3-left">
					<div class="v3-tabs">
						<button
							class="v3-tab"
							class:active={activeV3Tab === "summary"}
							onclick={() => (activeV3Tab = "summary")}
							>Summary</button
						>
						<button
							class="v3-tab"
							class:active={activeV3Tab === "deepdive"}
							onclick={() => (activeV3Tab = "deepdive")}
							>Deep Dive</button
						>
						<!-- M2: count moved inside tab content as muted text (see vision header) -->
						<button
							class="v3-tab"
							class:active={activeV3Tab === "vision"}
							onclick={() => (activeV3Tab = "vision")}
						>
							Your Concept
						</button>
					</div>

					<div class="v3-tab-body">
						<!-- ── SUMMARY TAB ── -->
						{#if activeV3Tab === "summary"}
							<!-- What this means -->
							<div class="v3-meaning-card">
								<div class="v3-meaning-eyebrow">
									What this score means for you
								</div>
								<div class="v3-meaning-text">
									{#if decisionState?.summary}
										{decisionState.summary}
									{:else}
										{fitVerdict(
											fitIQ,
											locationIQ,
											visionIQ,
										)}
									{/if}
									{#if coaching?.revenueContext}
										{coaching.revenueContext}
									{/if}
								</div>
							</div>

							<!-- 04.19.2026 18:00 - UI Extract working/watchout row to FactorDrilldown module -->
							<FactorDrilldown store={analysisStore} {evidence} />

							<!-- UX-FIX-7 (Emergency Fix April 11): "How to gain points" now shows top 3
							     by impact (lower raw value = more points on the table) with an expander
							     for the remainder.
							     §1c (April 11): Grouped by EvidenceItem.category — section headers split
							     the list into Block & location / Your concept / Financial / Operations so
							     the founder can tell at a glance which levers are block-side vs concept-side
							     vs money-side. Top-3 across all categories are always visible; the rest
							     appear behind the expander. Categories with no visible items are hidden. -->
							{@const gainItemsSorted = [
								...evidence.canChange,
							].sort((a, b) => a.value - b.value)}
							{@const gainPrimary = gainItemsSorted.slice(0, 3)}
							{@const gainMore = gainItemsSorted.slice(3)}
							{@const gainVisible = gainPointsExpanded
								? gainItemsSorted
								: gainPrimary}
							{#if evidence.canChange.length > 0 || (coaching?.nextSteps && coaching.nextSteps.length > 0)}
								<div class="v3-improve-card">
									<div class="v3-improve-title">
										How to improve this score
									</div>
									{#if evidence.canChange.length > 0}
										{#each GAIN_CATEGORY_ORDER as cat (cat)}
											{@const _catItems =
												gainVisible.filter(
													(it) => it.category === cat,
												)}
											{#if _catItems.length > 0}
												<div class="v3-improve-group">
													<div
														class="v3-improve-group-head"
													>
														{GAIN_CATEGORY_LABEL[
															cat
														]}
													</div>
													{#each _catItems as item}
														<div
															class="v3-improve-item"
														>
															<span
																>{item.copy ||
																	item.label}</span
															>
														</div>
													{/each}
												</div>
											{/if}
										{/each}
										{#if gainMore.length > 0}
											<button
												type="button"
												class="v3-improve-expander"
												aria-expanded={gainPointsExpanded}
												onclick={() => {
													gainPointsExpanded =
														!gainPointsExpanded;
												}}
											>
												{gainPointsExpanded
													? "− show fewer"
													: `see ${gainMore.length} more way${gainMore.length === 1 ? "" : "s"} →`}
											</button>
										{/if}
									{:else if coaching?.nextSteps}
										{#each coaching.nextSteps.slice(0, 3) as step}
											<div class="v3-improve-item">
												<span>{step}</span>
											</div>
										{/each}
										{#if gainPointsExpanded && coaching.nextSteps.length > 3}
											{#each coaching.nextSteps.slice(3) as step}
												<div class="v3-improve-item">
													<span>{step}</span>
												</div>
											{/each}
										{/if}
										{#if coaching.nextSteps.length > 3}
											<button
												type="button"
												class="v3-improve-expander"
												aria-expanded={gainPointsExpanded}
												onclick={() => {
													gainPointsExpanded =
														!gainPointsExpanded;
												}}
											>
												{gainPointsExpanded
													? "− show fewer"
													: `see ${coaching.nextSteps.length - 3} more way${coaching.nextSteps.length - 3 === 1 ? "" : "s"} →`}
											</button>
										{/if}
									{/if}
								</div>
							{/if}

							<!-- Why bullets -->
							{#if whyBullets.length > 0}
								<div class="v3-why-bullets">
									{#each whyBullets as b}
										<div class="v3-why-item">
											<span
												class="v3-why-dot v3-why-dot--{b.color}"
											></span>
											<span>{b.icon} {b.text}</span>
										</div>
									{/each}
								</div>
							{/if}

							<!-- Terminal CTA -->
							<div
								class="v3-terminal-cta v3-terminal--{_fitBand}"
							>
								<div class="v3-terminal-title">
									{#if fitIQ >= 65}Next step: Build your
										Business Case
									{:else if fitIQ >= 50}Worth exploring — the
										numbers will tell you
									{:else}We'd recommend trying another address
										too
									{/if}
								</div>
								<div class="v3-terminal-sub">
									{#if fitIQ >= 65}We'll project revenue,
										costs, and break-even for this exact
										spot.
									{:else if fitIQ >= 50}Build the business
										case to see if the financials make
										sense.
									{:else}Compare before committing. Try
										another address or refine your vision.
									{/if}
								</div>
								<div class="v3-terminal-btns">
									{#if fitIQ >= 50}
										<a
											href="/app/business-plan"
											class="v3-terminal-btn-primary"
											>Build Business Case →</a
										>
									{/if}
									<a
										href="/app/onboarding?fresh=true"
										class="v3-terminal-btn-ghost"
									>
										{fitIQ >= 50
											? "↺ Try another address"
											: "→ Try a different address"}
									</a>
								</div>
							</div>
						{/if}

						<!-- ── DEEP DIVE TAB ── -->
						{#if activeV3Tab === "deepdive"}
							{@const _ddScores = [
								{
									key: "transit",
									icon: "🚶",
									label: "Foot Traffic",
									q: getConceptQ(
										"transit",
										"Is there enough walk-by traffic?",
									),
									score: _transitScore,
									color:
										_transitScore >= 65
											? "#059669"
											: _transitScore >= 45
												? "#d97706"
												: "#dc2626",
								},
								{
									key: "demographics",
									icon: "💰",
									label: "Spending Power",
									q: getConceptQ(
										"demographics",
										"Do people here spend money?",
									),
									score: _demographicsScore,
									color:
										_demographicsScore >= 65
											? "#059669"
											: _demographicsScore >= 45
												? "#d97706"
												: "#dc2626",
								},
								{
									key: "competition",
									icon: "🏪",
									label: "Room to Compete",
									q: getConceptQ(
										"competition",
										`Is there space for another ${bizTypeLabel.toLowerCase()}?`,
									),
									score: _competitionScore,
									color:
										_competitionScore >= 65
											? "#059669"
											: _competitionScore >= 45
												? "#d97706"
												: "#dc2626",
								},
								{
									key: "survival",
									icon: "📈",
									label: "Market Proof",
									q: getConceptQ(
										"survival",
										"Have similar businesses survived here?",
									),
									score: _survivalScore,
									color:
										_survivalScore >= 65
											? "#059669"
											: _survivalScore >= 45
												? "#d97706"
												: "#dc2626",
								},
								{
									key: "vibrancy",
									icon: "🌆",
									label: "Neighborhood Energy",
									q: getConceptQ(
										"vibrancy",
										"Is this area alive and growing?",
									),
									score: _vibrancyScore,
									color:
										_vibrancyScore >= 65
											? "#059669"
											: _vibrancyScore >= 45
												? "#d97706"
												: "#dc2626",
								},
								{
									key: "safety",
									icon: "🛡️",
									label: "Safety",
									q: getConceptQ(
										"safety",
										"How safe is this block for customers?",
									),
									score: _safetyScore,
									color:
										_safetyScore >= 65
											? "#059669"
											: _safetyScore >= 45
												? "#d97706"
												: "#dc2626",
								},
							]}

							{#if killFactors.length > 0}
								<div class="v3-kill-factors">
									{#each killFactors as kf}
										<div
											class="v3-kill-item"
											class:v3-kill-item--caution={kf.variant ===
												"caution"}
										>
											<span class="v3-kill-icon"
												>{kf.icon}</span
											>
											<span class="v3-kill-text"
												>{kf.message}</span
											>
										</div>
									{/each}
								</div>
							{/if}

							{#each _ddScores as dd}
								{#if dd.score > 0}
									<div class="v3-dd-row">
										<div class="v3-dd-header">
											<div class="v3-dd-left">
												<div class="v3-dd-icon">
													{dd.icon}
												</div>
												<div>
													<div class="v3-dd-label">
														{dd.label}
													</div>
													<div class="v3-dd-sublabel">
														{dd.q}
													</div>
												</div>
											</div>
											<div class="v3-dd-right">
												<div
													class="v3-dd-score"
													style="color:{dd.color}"
												>
													{dd.score}
												</div>
												<div class="v3-dd-bar">
													<div
														class="v3-dd-bar-fill"
														style="width:{dd.score}%;background:{dd.color}"
													></div>
												</div>
											</div>
										</div>
										{#if dimensionSignals[dd.key]}
											<div class="v3-dd-signal">
												{dimensionSignals[dd.key]}
											</div>
										{/if}
									</div>
								{/if}
							{/each}

							<!-- Composites summary -->
							{@const _reachInputs = [
								_transitScore,
								_momentumScore,
							].filter((s) => s > 0)}
							{@const _demandInputs = [
								_demographicsScore,
								_survivalScore,
							].filter((s) => s > 0)}
							{@const _roomInputs = [
								_competitionScore,
								_vibrancyScore,
							].filter((s) => s > 0)}
							{@const _reachScore = _reachInputs.length
								? Math.round(
										_reachInputs.reduce(
											(a, b) => a + b,
											0,
										) / _reachInputs.length,
									)
								: 0}
							{@const _demandScore = _demandInputs.length
								? Math.round(
										_demandInputs.reduce(
											(a, b) => a + b,
											0,
										) / _demandInputs.length,
									)
								: 0}
							{@const _roomScore = _roomInputs.length
								? Math.round(
										_roomInputs.reduce((a, b) => a + b, 0) /
											_roomInputs.length,
									)
								: 0}

							{#if _reachScore > 0 || _demandScore > 0 || _roomScore > 0}
								<div class="v3-composites">
									{#each [{ name: "REACH", score: _reachScore, meaning: "How many people walk past — and is the block growing?" }, { name: "DEMAND", score: _demandScore, meaning: "Do people here spend money, and have others proven it?" }, { name: "ROOM", score: _roomScore, meaning: "Is the block crowded with competitors, or is there a gap?" }] as comp}
										{#if comp.score > 0}
											<div class="v3-comp-cell">
												<div class="v3-comp-top">
													<span class="v3-comp-name"
														>{comp.name}</span
													>
													<span
														class="v3-comp-badge"
														class:v3-badge-g={comp.score >=
															65}
														class:v3-badge-a={comp.score >=
															45 &&
															comp.score < 65}
														class:v3-badge-r={comp.score <
															45}
													>
														{comp.score >= 65
															? "Strong"
															: comp.score >= 45
																? "Mixed"
																: "Weak"}
													</span>
												</div>
												<div class="v3-comp-score">
													{comp.score}
												</div>
												<div class="v3-comp-bar">
													<div
														class="v3-comp-bar-fill"
														style="width:{comp.score}%;background:{comp.score >=
														65
															? '#059669'
															: comp.score >= 45
																? '#d97706'
																: '#dc2626'}"
													></div>
												</div>
												<div class="v3-comp-meaning">
													{comp.meaning}
												</div>
											</div>
										{/if}
									{/each}
								</div>
							{/if}

							<!-- UX-3.4: Segment Intel — hidden for generic concepts (Brain 3 returns null) -->
							{#if segmentInsightData}
								<SegmentInsights
									insight={segmentInsightData}
									bizType={visionBizType}
								/>
							{/if}
						{/if}

						<!-- ── VISION TAB ── -->
						{#if activeV3Tab === "vision"}
							<div class="v3-vision-header">
								Your Concept<!-- M2: count inside tab -->{#if visionIsPrelim && visionFieldsFilled.remaining > 0}<span
										class="v3-vision-fill-count"
										>{visionFieldsFilled.filled}/{visionFieldsFilled.total}
										filled</span
									>{/if}
							</div>
							<div class="v3-vision-sub">
								These inputs shape your score. Change anything
								to see it move.
							</div>

							<!-- Vision IQ progress — UX-11: lead with payoff, not count. UX-05: real maxUpside from API. -->
							{#if visionIsPrelim}
								<div class="v3-vision-progress">
									<div class="v3-vision-progress-bar">
										<div
											class="v3-vision-progress-fill"
											style="width:{visionCompletionPct}%"
										></div>
									</div>
									<div class="v3-vision-progress-text">
										<strong
											>{visionFieldsFilled.filled} of {visionFieldsFilled.total}
											details filled.</strong
										> Complete your profile for a more accurate
										score.
									</div>
								</div>
							{/if}

							<!-- R2-1..R2-3: Vision grid — hide every field that has no real value -->
							<div class="v3-vision-grid">
								<div class="v3-vision-field">
									<div class="v3-vision-field-label">
										Concept
									</div>
									<div
										class="v3-vision-field-val v3-vision-field-active"
									>
										{bizTypeLabel}
									</div>
								</div>
								{#if visionHours}
									<div class="v3-vision-field">
										<div class="v3-vision-field-label">
											Hours
										</div>
										<div class="v3-vision-field-val">
											{(
												{
													morning:
														"Morning (6am–3pm)",
													all_day:
														"All Day (6am–9pm)",
													evening:
														"Evening (3pm–11pm)",
												} as Record<string, string>
											)[visionHours] || visionHours}
										</div>
									</div>
								{/if}
								{#if visionAvgCheck}
									<div class="v3-vision-field">
										<div class="v3-vision-field-label">
											Average Check
										</div>
										<div class="v3-vision-field-val">
											{"$" +
												visionAvgCheck.replace("$", "")}
										</div>
									</div>
								{/if}
								{#if visionFoodProgram}
									<div class="v3-vision-field">
										<div class="v3-vision-field-label">
											Food Program
										</div>
										<div class="v3-vision-field-val">
											{(
												{
													none: "None",
													light_bites: "Light Bites",
													full_kitchen:
														"Full Kitchen",
													grab_go: "Grab & Go",
												} as Record<string, string>
											)[visionFoodProgram] ||
												visionFoodProgram}
										</div>
									</div>
								{/if}
								{#if visionEmployees}
									<div class="v3-vision-field">
										<div class="v3-vision-field-label">
											Team Size
										</div>
										<div class="v3-vision-field-val">
											{(
												{
													just_me: "Just me",
													"1_3": "1–3 people",
													"4_8": "4–8 people",
													"9_plus": "9+ people",
												} as Record<string, string>
											)[visionEmployees] ||
												visionEmployees}
										</div>
									</div>
								{/if}
								{#if visionDifferentiators && visionDifferentiators.length > 0}
									<div class="v3-vision-field">
										<div class="v3-vision-field-label">
											Differentiator
										</div>
										<div class="v3-vision-field-val">
											{visionDifferentiators}
										</div>
									</div>
								{/if}

								<!-- Coffee-specific fields — show avgTicket + visionTier from launchpad -->
								{#if ["specialty_coffee", "coffee_shop", "coffee", "cafe"].includes(visionBizType)}
									{@const _lpConcept = (() => {
										try {
											return JSON.parse(
												localStorage.getItem(
													"re2_launchpad",
												) || "{}",
											);
										} catch {
											return {};
										}
									})()}
									{@const _cfDisplay =
										_lpConcept.priceLevel &&
										PRICE_LEVEL_TO_COFFEE[
											_lpConcept.priceLevel
										]
											? PRICE_LEVEL_TO_COFFEE[
													_lpConcept.priceLevel
												]
											: null}
									{@const _displayTicket =
										_lpConcept.avgTicket ||
										_cfDisplay?.avgTicket ||
										null}
									{@const _displayTier =
										_lpConcept.visionTier ||
										_cfDisplay?.visionTier ||
										null}
									{#if _displayTicket}
										<div class="v3-vision-field">
											<div class="v3-vision-field-label">
												Ticket Price
											</div>
											<div class="v3-vision-field-val">
												{`$${Number(_displayTicket).toFixed(2)}`}
											</div>
										</div>
									{/if}
									{#if _displayTier}
										<div class="v3-vision-field">
											<div class="v3-vision-field-label">
												Vision Tier
											</div>
											<div class="v3-vision-field-val">
												{(
													{
														commodity:
															"Commodity (×0.60)",
														standard:
															"Standard (×0.85)",
														differentiated:
															"Specialty (×1.00)",
														highly_differentiated:
															"Highly Diff. (×1.12)",
													} as Record<string, string>
												)[_displayTier] || _displayTier}
											</div>
										</div>
									{/if}
									{#if !_lpConcept.avgTicket || !_lpConcept.visionTier}
										<div
											class="v3-vision-field v3-vision-field--full"
										>
											<a
												href="/app/onboarding?returnTo=location&step=concept"
												class="v3-concept-detail-link"
											>
												Fill in your coffee details to
												sharpen this score →
											</a>
										</div>
									{/if}
								{/if}
							</div>

							<!-- UX-12: Score Simulator — shows vision IQ deltas + Apply/Undo -->
							{#if simRecommendations.length > 0}
								<div class="v3-sim-panel">
									<div class="v3-sim-title">
										Score impact of changes
									</div>
									{#each simRecommendations as rec}
										<div class="v3-sim-rec">
											<div class="v3-sim-rec-label">
												{rec.label}
											</div>
											<div class="v3-sim-rec-change">
												{rec.currentLabel} →
												<strong>{rec.newLabel}</strong>
											</div>
											<!-- UX-NEW-14 M1: neutral score delta, not points gamification (R4) -->
											{#if rec.delta > 0}
												<span class="v3-sim-rec-delta"
													>Your Score: +{rec.delta}
													{rec.delta === 1
														? "point"
														: "points"}</span
												>
											{/if}
										</div>
									{/each}
									{#if simComboDelta > 0 && simRecommendations.length > 1}
										<div class="v3-sim-combo">
											All changes combined: <strong
												>+{simComboDelta}
												{simComboDelta === 1
													? "point"
													: "points"}</strong
											>
										</div>
									{/if}
									<div class="v3-sim-actions">
										{#if simPreApply}
											<button
												type="button"
												class="v3-sim-btn v3-sim-undo"
												onclick={resetSimRecs}
												>↺ Undo changes</button
											>
										{:else}
											<button
												type="button"
												class="v3-sim-btn v3-sim-apply"
												onclick={applySimRecs}
												>Apply all</button
											>
										{/if}
									</div>
								</div>
							{/if}

							<div class="v3-vision-field v3-vision-field--full" style="margin-top: 16px;">
								<a
									href="/app/onboarding?returnTo=location&step=concept"
									class="v3-concept-detail-link"
								>
									✎ Edit Concept Details
								</a>
							</div>
						{/if}
					</div>

					<!-- CoPilot persistent bottom bar -->
					<div class="v3-copilot-bar">
						<span class="v3-copilot-sparkle">✨</span>
						<input
							type="text"
							class="v3-copilot-input"
							placeholder="Ask about this location — rent, traffic, competition, anything..."
							bind:value={copilotInputText}
							onkeydown={(e) => {
								if (
									e.key === "Enter" &&
									copilotInputText.trim()
								) {
									sendCopilotFromBar();
								}
							}}
						/>
						<button
							class="v3-copilot-send"
							onclick={sendCopilotFromBar}
							disabled={!copilotInputText?.trim()}>Ask</button
						>
					</div>
				</div>

				<!-- ═══ RIGHT PANEL: MAP + NEIGHBORHOOD ═══ -->
				<div class="v3-right">
					<div class="v3-map-area">
						<!-- 04.19.2026 18:00 - Modular Map Extraction (State 1) -->
						<LocationContextMap
							store={analysisStore}
							compact={true}
							showPin={true}
						/>
					</div>
					<!-- UX-19 LENS-01: Replace the 3 inert map toggles with 6 purposeful lenses.
							 Each lens is a slice of the BR-06 envelope — verdict line, top signals,
							 canned CoPilot prompt. Clicking a lens loads the full envelope (lazy GET,
							 cached by address) the first time and then flips local state. -->
					<div class="v3-lenses">
						<!-- R3-1: Horizontal pill strip replacing 3×2 grid -->
						<div class="v3-lens-pills">
							{#each LENS_TABS as lens (lens.key)}
								<button
									type="button"
									class="v3-lens-pill"
									class:active={activeLensKey === lens.key}
									onclick={() => selectLens(lens.key)}
									title={lens.sub}>{lens.label}</button
								>
							{/each}
						</div>

						{#if activeLensSlice}
							{@const ls = activeLensSlice}
							{@const _lensConf = confidenceForLens(ls.dimension)}
							<div
								class="v3-lens-card v3-lens-tier-{ls.tier.toLowerCase()}"
								class:v3-lens-partial={_lensConf === "partial"}
								class:v3-lens-skeleton={_lensConf ===
									"skeleton"}
							>
								<!-- §1b (April 11): lens score respects confidenceBySource. Skeleton tier
									     hides the number behind a refreshing pill; partial tier prefixes ~ and
									     adds a tooltip explaining the confidence state. -->
								<div class="v3-lens-hdr">
									{#if _lensConf === "skeleton"}
										<span
											class="v3-lens-score v3-metric-skeleton"
											aria-busy="true"
											title="Refreshing {ls.label.toLowerCase()} data…"
											>—</span
										>
									{:else if _lensConf === "partial"}
										<span
											class="v3-lens-score v3-metric-partial"
											title="Preliminary — based on partial data, refreshing soon."
											>~{ls.score}</span
										>
									{:else}
										<span class="v3-lens-score"
											>{ls.score}</span
										>
									{/if}
									<span class="v3-lens-tier">{ls.tier}</span>
								</div>
								<div class="v3-lens-verdict">
									{ls.verdictLine}
								</div>
								{#if ls.topSignals && ls.topSignals.length > 0}
									<ul class="v3-lens-signals">
										{#each ls.topSignals as sig (sig.message)}
											<li
												class="v3-lens-sig v3-lens-sig-{sig.type}"
											>
												<span class="v3-lens-sig-icon">
													{sig.type === "positive"
														? "✓"
														: sig.type ===
															  "negative"
															? "!"
															: "·"}
												</span>
												<span>{sig.message}</span>
											</li>
										{/each}
									</ul>
								{/if}
								<div class="v3-lens-footer">
									<span class="v3-lens-sources"
										>{ls.dataSources.available}/{ls
											.dataSources.total} sources live</span
									>
									<button
										type="button"
										class="v3-lens-cp"
										disabled={inlineCpLoading}
										onclick={() =>
											askCopilot(ls.copilotPrompt)}
									>
										Ask CoPilot →
									</button>
								</div>
							</div>
						{:else if locationIqFetching}
							<div class="v3-lens-loading">
								<div class="v3-lens-spinner"></div>
								<span>Pulling lens data…</span>
							</div>
						{:else if locationIqError}
							<div class="v3-lens-empty">
								<span>Lens data unavailable.</span>
								<button
									type="button"
									class="v3-lens-retry"
									onclick={() =>
										loadLocationIqEnvelope(true).then(() =>
											selectLens(activeLensKey),
										)}>Retry</button
								>
							</div>
						{:else}
							<!-- R1-6: removed "Pick a lens" placeholder — area stays empty until data loads -->
						{/if}
					</div>
					<div class="v3-hood-section">
						<div class="v3-hood-title">Neighborhood Snapshot</div>
						<!-- §1b (April 11): Neighborhood snapshot metrics respect confidenceBySource.
							     `full` → plain number; `partial` → ~ prefix + tooltip; `skeleton` → skeleton
							     pill (no number shown, aria-busy). Same render contract as the hero. -->
						<!-- R1-1: Hide Transit row when skeleton or zero -->
						{#if confidenceTransit !== "skeleton" && _transitScore > 0}
							<div class="v3-hood-stat">
								<span>Transit Access</span>
								<span class="v3-hood-val">
									{#if confidenceTransit === "partial"}
										<span
											class="v3-metric-partial"
											title="Preliminary — based on partial data, refreshing soon."
											>~{_transitScore}</span
										>
									{:else}
										{_transitScore}
									{/if}
									<span
										class="v3-hood-pill v3-hood-pill-{fitGrade(
											_transitScore,
										).toLowerCase()}"
										>{tierLabelFor(
											_transitScore,
											"lens",
										)}</span
									>
								</span>
							</div>
						{/if}
						<!-- UX-07: Safety Score with tier pill -->
						<!-- R1-2: Hide Safety row when skeleton or zero -->
						{#if confidenceSafety !== "skeleton" && _safetyScore > 0}
							<div class="v3-hood-stat">
								<span>Safety</span>
								<span
									class="v3-hood-val"
									style={_safetyScore < 55
										? "color:#d97706"
										: ""}
								>
									{#if confidenceSafety === "partial"}
										<span
											class="v3-metric-partial"
											title="Preliminary — based on partial data, refreshing soon."
											>~{_safetyScore}</span
										>
									{:else}
										{_safetyScore}
									{/if}
									<span
										class="v3-hood-pill v3-hood-pill-{fitGrade(
											_safetyScore,
										).toLowerCase()}"
										>{tierLabelFor(
											_safetyScore,
											"lens",
										)}</span
									>
								</span>
							</div>
						{/if}
						<!-- UX-T4: neutral survival display — numbers only, no green/red/badge -->
						{#if _survivalScore > 0}
							<div class="v3-hood-stat">
								<span>Year-1 survival</span>
								<span class="v3-hood-val">
									{_survivalScore}%
									<span class="v3-hood-sub"
										>NYC avg: {_NYC_SURVIVAL}%</span
									>
								</span>
							</div>
						{/if}
						<!-- R1-4: Hide analysisStore.competitors row until scan complete -->
						{#if analysisStore.competitorScanStatus === "complete" && confidenceCompetition !== "skeleton"}
							<div class="v3-hood-stat">
								<span>Competitors Nearby</span>
								<span class="v3-hood-val">
									{#if confidenceCompetition === "partial"}
										<span
											class="v3-metric-partial"
											title="Preliminary — based on partial data, refreshing soon."
											>~{analysisStore.competitors
												.length}</span
										>
									{:else}
										{analysisStore.competitors.length}
									{/if}
								</span>
							</div>
						{/if}
						<!-- UX-04 (BR-09): Concept Pulse — reads the single-source-of-truth envelope built from
								 pulseTier / conceptRevenueModel / pulseNarrative. Own tier vocabulary (Buzzing/Busy/Steady/Quiet/Sleepy),
								 not the Fit IQ tiers. Tooltip shows the full narrative so it's never a mystery score. -->
						<div
							class="v3-hood-stat"
							title={conceptPulse?.narrative ?? ""}
						>
							<span>Concept Pulse</span>
							<span class="v3-hood-val">
								{#if conceptPulse}
									{conceptPulse.score}
									<span
										class="v3-hood-pill v3-hood-pill-pulse v3-hood-pill-pulse-{conceptPulse.tier.toLowerCase()}"
										>{conceptPulse.tier}</span
									>
								{:else}—{/if}
							</span>
						</div>
						<!-- UX-T3: Concept Fit row removed — internal diagnostic, not user-facing -->
						{#if locationNeighborhood}
							<div class="v3-hood-stat">
								<span>Neighborhood</span><span
									class="v3-hood-val"
									>{locationNeighborhood}</span
								>
							</div>
						{/if}

						<!-- Neighborhood Buzz -->
						{#if locationNeighborhood}
							{@const _buzz =
								getNeighborhoodBuzz(locationNeighborhood)}
							{#if _buzz}
								<div class="v3-hood-buzz">
									<div class="v3-hood-title">
										Neighborhood Buzz
									</div>
									<div class="v3-hood-buzz-text">
										{locationNeighborhood} is trending
										<strong
											>{trendArrow(_buzz.trend)}
											{buzzLabel(_buzz.trend)}</strong
										>
										{#if _buzz.note}
											— {_buzz.note}{/if}
									</div>
								</div>
							{/if}
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- NAV-03: PageNav with back/forward below scoring section -->
		{#if locationIQ > 0}
			<PageNav
				backHref="/app/onboarding"
				backLabel="Edit Concept"
				nextHref="/app/business-plan"
				nextLabel="Business Case"
				nextIsGreen={true}
			/>
		{/if}
	{/if}

	<!-- UX-13: Sticky action bar — appears after scrolling past Zone 1 -->
	<!-- 04.19.2026 18:00 - Abstracted to LocationStickyActionBar component -->
	<LocationStickyActionBar
		{hasResult}
		{fitIQ}
		{showStickyBar}
		{analysisAddress}
	/>

	<!-- D16: Export-brief toast (auto-hides after 4.5s) -->
	{#if exportToast}
		<div
			class="export-toast export-toast--{exportToast.kind}"
			role="status"
			aria-live="polite"
		>
			{exportToast.msg}
		</div>
	{/if}
</div>

<!-- ══ DUPLICATE ANALYSIS DETECTION MODAL ════════════════════════════════════ -->
<!-- 04.19.2026 18:00 - Abstracted into isolated DuplicateAnalysisGuard -->
<DuplicateAnalysisGuard store={analysisStore} />

<!-- ══ UX-23: DATA SOURCES MODAL (BR-05) ════════════════════════════════════ -->
{#if dataSourcesModalOpen}
	<div
		class="ds-modal-overlay"
		onclick={closeDataSourcesModal}
		role="presentation"
	></div>
	<div
		class="ds-modal"
		role="dialog"
		aria-labelledby="ds-modal-title"
		aria-modal="true"
	>
		<div class="ds-modal-hdr">
			<div>
				<div class="ds-modal-title" id="ds-modal-title">
					Data sources behind this score
				</div>
				<div class="ds-modal-sub">
					{#if locationIqPayload?.dataFreshness}
						{locationIqPayload.dataFreshness.ageLabel} ·
						{locationIqPayload.dataFreshness.summary.ok} of {locationIqPayload
							.dataFreshness.summary.total} live
						{#if locationIqPayload.dataFreshness.summary.error > 0}· <span
								class="ds-warn"
								>{locationIqPayload.dataFreshness.summary.error}
								errored</span
							>{/if}
						{#if locationIqPayload.dataFreshness.summary.missing > 0}·
							<span class="ds-mute"
								>{locationIqPayload.dataFreshness.summary
									.missing} missing</span
							>{/if}
					{:else if locationIqFetching}
						Loading source list…
					{:else if locationIqError}
						<span class="ds-warn">{locationIqError}</span>
					{:else}
						Fetching latest source status…
					{/if}
				</div>
			</div>
			<button
				class="ds-modal-close"
				onclick={closeDataSourcesModal}
				type="button"
				aria-label="Close">✕</button
			>
		</div>

		<div class="ds-modal-body">
			{#if locationIqFetching && !locationIqPayload}
				<div class="ds-loading">
					<div class="ds-spinner"></div>
					<div>
						Pulling the latest freshness from every source. This
						takes a few seconds.
					</div>
				</div>
			{:else if locationIqError && !locationIqPayload}
				<div class="ds-empty">
					<div class="ds-empty-icon">⚠️</div>
					<div class="ds-empty-title">Couldn't load data sources</div>
					<div class="ds-empty-sub">{locationIqError}</div>
					<button
						type="button"
						class="ds-retry"
						onclick={() => loadLocationIqEnvelope(true)}
						>Retry</button
					>
				</div>
			{:else if dataSourceGroups.length > 0}
				<p class="ds-intro">
					Every score on this page is computed from these sources.
					Each one updates on its own schedule — the freshest are
					real-time, the slowest refresh yearly. When a source errors
					or returns nothing, the score falls back to what we have.
				</p>
				{#each dataSourceGroups as group (group.key)}
					<section class="ds-group">
						<h3 class="ds-group-title">
							{group.label}
							<span class="ds-group-count"
								>{group.sources.length}</span
							>
						</h3>
						<ul class="ds-list">
							{#each group.sources as src (src.key)}
								<li class="ds-item ds-item-{src.status}">
									<div class="ds-item-main">
										<span class="ds-item-label"
											>{src.label}</span
										>
										<span class="ds-item-cadence"
											>{src.updateCadence}</span
										>
									</div>
									<div class="ds-item-status">
										{#if src.status === "ok"}
											<span
												class="ds-chip ds-chip-ok"
												title="Source returned data"
												>● Live</span
											>
											{#if src.ageHours !== null}
												<span class="ds-item-age"
													>{src.ageHours < 1
														? "just now"
														: src.ageHours < 24
															? `${Math.round(src.ageHours)}h ago`
															: `${Math.round(src.ageHours / 24)}d ago`}</span
												>
											{/if}
										{:else if src.status === "error"}
											<span
												class="ds-chip ds-chip-err"
												title={src.errorMessage ||
													"Fetch failed"}
												>● Error</span
											>
										{:else}
											<span
												class="ds-chip ds-chip-miss"
												title="No data returned"
												>○ Missing</span
											>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			{/if}
		</div>

		<div class="ds-modal-ftr">
			<span class="ds-ftr-note"
				>Need the latest? Use <strong>Re-score</strong> near the ring to
				refresh every source.</span
			>
			<button
				class="ds-ftr-close"
				onclick={closeDataSourcesModal}
				type="button">Close</button
			>
		</div>
	</div>
{/if}

<!-- ══ UPLOAD DOCUMENTS DRAWER ══════════════════════════════════════════════ -->
{#if uploadDrawerOpen}
	<div
		class="upload-overlay"
		onclick={() => (uploadDrawerOpen = false)}
		role="presentation"
	></div>
	<div class="upload-drawer">
		<div class="upload-drawer-hdr">
			<div>
				<div class="upload-drawer-title">Documents</div>
				{#if analysisAddress}<div class="upload-drawer-addr">
						{analysisAddress.split(",")[0]}
					</div>{/if}
			</div>
			<button
				class="upload-drawer-close"
				onclick={() => (uploadDrawerOpen = false)}
				type="button">✕</button
			>
		</div>
		<div class="upload-drawer-body">
			<div class="upload-drop-zone">
				<div class="upload-drop-icon">📎</div>
				<div class="upload-drop-title">
					Drop files here or click to browse
				</div>
				<div class="upload-drop-sub">
					Photos, LOIs, brochures, floor plans, leases — any format
				</div>
				<label class="upload-drop-btn">
					Choose files
					<input
						type="file"
						multiple
						accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
						style="display:none"
						onchange={(e) => {
							const files = (e.target as HTMLInputElement).files;
							if (files)
								alert(
									"Upload backend coming soon. Selected: " +
										Array.from(files)
											.map((f) => f.name)
											.join(", "),
								);
						}}
					/>
				</label>
			</div>
			<div class="upload-empty-state">
				<div class="upload-empty-icon">🗂️</div>
				<div class="upload-empty-text">
					No documents yet for this property.
				</div>
				<div class="upload-empty-sub">
					Upload a photo, LOI, or brochure to attach it to this
					location.
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ===== RESCORE COMPARISON BANNER (Addendum §2.4) ===== */
	.rescore-comparison {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		margin: 8px 0 4px;
		border-radius: 8px;
		font-size: 12px;
		line-height: 1.4;
		animation: rescore-fade-in 0.3s ease-out;
	}
	.rescore-comparison--up {
		background: rgba(5, 150, 105, 0.08);
		border: 1px solid rgba(5, 150, 105, 0.2);
		color: #065f46;
	}
	.rescore-comparison--down {
		background: rgba(220, 38, 38, 0.06);
		border: 1px solid rgba(220, 38, 38, 0.18);
		color: #991b1b;
	}
	.rescore-comparison--unchanged {
		background: rgba(107, 114, 128, 0.06);
		border: 1px solid rgba(107, 114, 128, 0.15);
		color: #4b5563;
	}
	.rescore-comparison__icon {
		font-size: 14px;
		font-weight: 700;
	}
	.rescore-comparison__text {
		flex: 1;
	}
	.rescore-comparison__text strong {
		font-weight: 700;
	}
	.rescore-comparison__dismiss {
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px 4px;
		font-size: 12px;
		color: inherit;
		opacity: 0.5;
		line-height: 1;
	}
	.rescore-comparison__dismiss:hover {
		opacity: 1;
	}
	@keyframes rescore-fade-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* ===== ERROR BANNER ===== */
	.analysis-error-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		background: #fff3cd;
		border: 1px solid #ffe69c;
		border-radius: 8px;
		margin: 0 16px 16px 16px;
		font-size: 13px;
		color: #664d03;
	}
	.error-icon {
		font-size: 16px;
		flex-shrink: 0;
	}
	.error-text {
		flex: 1;
		line-height: 1.4;
	}
	.error-dismiss {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		color: #664d03;
		padding: 2px 6px;
		border-radius: 4px;
	}
	.error-dismiss:hover {
		background: rgba(0, 0, 0, 0.1);
	}

	/* ===== CSS VARIABLES — canonical 12-token set ===== */
	:root {
		--sage: #4a7c5c;
		--hot-pink: #e8345a;
		--deep-green: #1a3a2a;
		--marigold: #e8a838;
		--accent: var(--sage);
		--bg: #faf7f2;
		--surface: #ffffff;
		--border: #e8e2d8;
		--text-primary: #1a3a2a;
		--text-secondary: #666;
		--text-muted: #999;
		--radius: 10px;
		--shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	}

	/* ===== PAGE CONTAINER ===== */
	.location-page {
		background: var(--bg);
		min-height: 100vh;
		font-family:
			"DM Sans",
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
		color: var(--text-primary);
		line-height: 1.5;
	}

	/* GAP-3 FIX (2026-04-18): Back to Dashboard navigation link */
	.loc-back-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary);
		text-decoration: none;
		transition: color 0.15s;
	}
	.loc-back-link:hover {
		color: var(--text-primary);
	}

	/* ===== PRE-SEARCH STATES ===== */
	.bot-handoff {
		padding: 80px 32px;
		text-align: center;
		max-width: 480px;
		margin: 0 auto;
	}
	.bot-handoff-timeout {
		animation: fadeIn 0.3s ease-out;
	}
	.handoff-icon {
		font-size: 48px;
		margin-bottom: 16px;
	}
	.handoff-title {
		font-family: "DM Serif Display", serif;
		font-size: 24px;
		color: var(--deep-green);
		margin-bottom: 8px;
	}
	.handoff-msg {
		font-size: 14px;
		color: var(--text-secondary);
		margin-bottom: 24px;
	}
	.handoff-progress {
		width: 200px;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		margin: 0 auto 20px;
		overflow: hidden;
	}
	.handoff-progress-fill {
		height: 100%;
		background: var(--sage);
		border-radius: 2px;
		animation: progress-fill 12s ease-out forwards;
	}
	.handoff-btn {
		background: var(--sage);
		color: white;
		border: none;
		padding: 10px 24px;
		border-radius: 20px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.handoff-btn:hover {
		background: #3d6b4e;
	}
	@keyframes progress-fill {
		from {
			width: 0;
		}
		to {
			width: 90%;
		}
	}

	.pre-search {
		padding: 80px 32px;
		text-align: center;
		max-width: 520px;
		margin: 0 auto;
	}
	.pre-search-icon {
		font-size: 56px;
		margin-bottom: 20px;
		opacity: 0.9;
	}
	.pre-search-title {
		font-family: "DM Serif Display", serif;
		font-size: 28px;
		color: var(--deep-green);
		margin-bottom: 8px;
	}
	.pre-search-sub {
		font-size: 14px;
		color: var(--text-secondary);
		margin-bottom: 32px;
		line-height: 1.5;
	}
	.pre-search-btn {
		background: var(--sage);
		color: white;
		border: none;
		padding: 12px 28px;
		border-radius: 24px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}
	.pre-search-btn:hover {
		background: #3d6b4e;
	}
	.pre-search-features {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		margin-top: 40px;
	}
	.pre-search-feature {
		background: white;
		border-radius: 10px;
		padding: 20px 16px;
		border: 1px solid var(--border);
	}
	.pre-search-feature-icon {
		font-size: 24px;
		margin-bottom: 8px;
	}
	.pre-search-feature-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--deep-green);
		margin-bottom: 4px;
	}
	.pre-search-feature-desc {
		font-size: 12px;
		color: var(--text-secondary);
	}
	/* NAV-04: State 0 CTA button */
	.map-overlay-cta {
		display: inline-block;
		margin-top: 16px;
		padding: 10px 24px;
		background: var(--sage, #4a7c5c);
		color: #fff;
		border-radius: 20px;
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		transition: background 0.2s;
	}
	.map-overlay-cta:hover {
		background: #3d6b4e;
	}

	.analyzing-state {
		padding: 60px 32px;
		text-align: center;
	}
	.analyzing-icon {
		font-size: 48px;
		margin-bottom: 16px;
		animation: pulse 2s ease-in-out infinite;
	}
	.analyzing-title {
		font-family: "DM Serif Display", serif;
		font-size: 22px;
		color: var(--deep-green);
		margin-bottom: 8px;
	}
	.analyzing-sub {
		font-size: 13px;
		color: var(--text-secondary);
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	/* ===== NAVIGATION DRAWER (inherits from component) ===== */

	/* ===== MAPPER BANNER ===== */
	.mapper-banner {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
		margin: 0 16px 12px;
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 8px;
		font-size: 13px;
		color: #166534;
	}
	.mapper-banner-text {
		flex: 1;
	}
	.mapper-banner-dismiss {
		background: none;
		border: none;
		cursor: pointer;
		color: #166534;
		font-size: 14px;
		padding: 2px 6px;
	}

	.save-toast {
		position: fixed;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--deep-green);
		color: white;
		padding: 10px 24px;
		border-radius: 24px;
		font-size: 13px;
		font-weight: 500;
		z-index: 100;
		animation: toast-in 0.3s ease-out;
	}
	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	/* ═══════════════════════════════════════════════════════ */
	/* ═══ UX-J: RULE 17 HARD-BLOCK BANNER               ═══ */
	/* ═══════════════════════════════════════════════════════ */
	.rule17-banner {
		background: #7f1d1d;
		color: #fff;
		border-bottom: 2px solid #450a0a;
		box-shadow: 0 2px 12px rgba(127, 29, 29, 0.35);
	}
	.rule17-banner-inner {
		max-width: 1200px;
		margin: 0 auto;
		padding: 18px 32px 16px;
		display: flex;
		align-items: center;
		gap: 18px;
	}
	.rule17-banner-icon {
		font-size: 28px;
		line-height: 1;
		flex-shrink: 0;
	}
	.rule17-banner-body {
		flex: 1;
		min-width: 0;
	}
	.rule17-banner-title {
		font-family: "Playfair Display", Georgia, serif;
		font-size: 18px;
		font-weight: 700;
		margin-bottom: 3px;
		letter-spacing: -0.1px;
	}
	.rule17-banner-copy {
		font-family: "DM Sans", sans-serif;
		font-size: 13px;
		opacity: 0.92;
		line-height: 1.4;
	}
	.rule17-banner-actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}
	.rule17-btn {
		font-family: "DM Sans", sans-serif;
		font-size: 12px;
		font-weight: 600;
		padding: 8px 14px;
		border-radius: 6px;
		border: 1px solid transparent;
		cursor: pointer;
		transition:
			background 0.15s ease,
			border-color 0.15s ease;
	}
	.rule17-btn-primary {
		background: #fff;
		color: #7f1d1d;
	}
	.rule17-btn-primary:hover {
		background: #fef2f2;
	}
	.rule17-btn-ghost {
		background: transparent;
		color: #fff;
		border-color: rgba(255, 255, 255, 0.4);
	}
	.rule17-btn-ghost:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.6);
	}
	@media (max-width: 720px) {
		.rule17-banner-inner {
			flex-direction: column;
			align-items: flex-start;
			padding: 14px 16px;
			gap: 12px;
		}
		.rule17-banner-actions {
			width: 100%;
		}
		.rule17-btn {
			flex: 1;
		}
	}

	/* ═══ UX-3.1: KILL FACTOR BANNER ═══════════════════════ */
	.kill-factor-banner {
		background: #450a0a;
		color: #fff;
		border-bottom: 2px solid #7f1d1d;
		box-shadow: 0 2px 12px rgba(127, 29, 29, 0.3);
	}
	.kill-factor-banner-inner {
		max-width: 1200px;
		margin: 0 auto;
		padding: 14px 32px;
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.kill-factor-banner-icon {
		font-size: 22px;
		flex-shrink: 0;
	}
	.kill-factor-banner-body {
		flex: 1;
	}
	.kill-factor-banner-title {
		font-weight: 700;
		font-size: 14px;
		margin-bottom: 2px;
	}
	.kill-factor-banner-copy {
		font-size: 13px;
		opacity: 0.88;
	}
	.kill-factor-more {
		font-size: 11px;
		opacity: 0.7;
	}

	/* ═══ UX-3.2: GRADE CAP NOTE ════════════════════════════ */
	.v3-hero-grade-cap-note {
		margin-top: 4px;
		font-size: 10px;
		font-weight: 600;
		color: #fde68a;
		background: rgba(0, 0, 0, 0.25);
		border-radius: 4px;
		padding: 2px 6px;
		cursor: help;
		white-space: nowrap;
	}

	/* ═══════════════════════════════════════════════════════ */
	/* ═══ V3 HERO                                       ═══ */
	/* ═══════════════════════════════════════════════════════ */
	.v3-hero {
		background: linear-gradient(
			135deg,
			#1a3a2a 0%,
			#2d5a3e 50%,
			#4a7c5c 100%
		);
		padding: 28px 32px 20px;
		position: relative;
	}
	.v3-hero-inner {
		display: flex;
		align-items: center;
		gap: 32px;
		max-width: 1200px;
		margin: 0 auto;
	}

	/* Ring */
	.v3-hero-ring-wrap {
		flex-shrink: 0;
		position: relative;
		width: 120px;
		height: 120px;
		text-align: center;
	}
	.v3-hero-ring-wrap svg {
		filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2));
	}
	.v3-hero-ring-num {
		position: absolute;
		top: 42%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-family: "DM Serif Display", serif;
		font-size: 38px;
		font-weight: 700;
		color: white;
		/* UX-20: Soft tick when the live preview swaps the fitIQ value */
		transition:
			transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1),
			opacity 0.25s ease;
	}
	.v3-hero-ring-num.is-live-preview {
		animation: v3-hero-tick 0.45s cubic-bezier(0.2, 0.9, 0.3, 1);
	}
	@keyframes v3-hero-tick {
		0% {
			transform: translate(-50%, -50%) scale(1);
		}
		40% {
			transform: translate(-50%, -50%) scale(1.08);
		}
		100% {
			transform: translate(-50%, -50%) scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.v3-hero-ring-num,
		.v3-hero-ring-num.is-live-preview {
			animation: none;
			transition: none;
		}
	}
	.v3-hero-live-badge {
		position: absolute;
		top: 8px;
		right: 8px;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.6px;
		text-transform: uppercase;
		padding: 2px 6px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.22);
		color: #fff;
		backdrop-filter: blur(3px);
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.v3-hero-live-badge::before {
		content: "";
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #34d399;
		animation: v3-live-pulse 1s ease-in-out infinite;
	}
	@keyframes v3-live-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}
	.v3-hero-ring-label {
		position: absolute;
		top: 62%;
		left: 50%;
		transform: translateX(-50%);
		font-size: 10px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.65);
		text-transform: uppercase;
		letter-spacing: 0.8px;
	}

	/* Text block */
	.v3-hero-text {
		flex: 1;
		min-width: 0;
	}
	/* UX-FIX-1 (Emergency Fix April 11): .v3-hero-verdict-pill, .v3-hero-grade-pill,
	   .v3-hero-verdict-row, .v3-hero-prelim-stamp*, @keyframes prelim-stamp-in
	   — all moved into ScoreHeader.svelte and deleted from this file. */
	.v3-hero-addr {
		font-family: "DM Serif Display", serif;
		font-size: 22px;
		color: white;
		line-height: 1.3;
		margin-bottom: 6px;
	}
	.v3-hero-addr-sub {
		font-style: normal;
		opacity: 0.7;
		font-size: 16px;
	}
	.v3-hero-context {
		font-size: 13px;
		color: rgba(255, 255, 255, 0.8);
		line-height: 1.5;
		max-width: 460px;
	}
	.v3-hero-context strong {
		color: white;
	}
	.v3-hero-percentile {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.6);
		margin-top: 4px;
		letter-spacing: 0.02em;
	}
	/* §1b (April 11): Shared confidence-aware metric states. Used by the hero
	   percentile, the Neighborhood Snapshot row, and the 6-lens score. The
	   `partial` state gets a cursor:help + dotted underline to invite the
	   tooltip; `skeleton` gets a subtle pulse animation to signal "refreshing". */
	.v3-metric-partial {
		display: inline-block;
		text-decoration: underline dotted rgba(146, 64, 14, 0.55);
		text-underline-offset: 3px;
		cursor: help;
		color: inherit;
	}
	.v3-metric-skeleton {
		display: inline-block;
		padding: 2px 10px;
		border-radius: 10px;
		background: linear-gradient(
			90deg,
			#f3f4f6 0%,
			#e5e7eb 50%,
			#f3f4f6 100%
		);
		background-size: 200% 100%;
		animation: v3-metric-shimmer 1.4s linear infinite;
		color: #6b7280;
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.02em;
	}
	@keyframes v3-metric-shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.v3-metric-skeleton {
			animation: none;
			background: #f3f4f6;
		}
	}
	/* Hero percentile needs a different skeleton color because the background is dark */
	.v3-hero-percentile.v3-metric-skeleton {
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.08) 0%,
			rgba(255, 255, 255, 0.18) 50%,
			rgba(255, 255, 255, 0.08) 100%
		);
		color: rgba(255, 255, 255, 0.7);
	}
	.v3-hero-percentile.v3-metric-partial {
		text-decoration-color: rgba(255, 255, 255, 0.4);
	}
	/* Lens card confidence states — subtle top border accent so the card reads
	   differently at a glance without rewriting the whole visual hierarchy. */
	.v3-lens-card.v3-lens-partial {
		border-top: 2px dashed rgba(146, 64, 14, 0.35);
	}
	.v3-lens-card.v3-lens-skeleton {
		opacity: 0.85;
	}
	.v3-hero-actions {
		display: flex;
		gap: 10px;
		margin-top: 14px;
		flex-wrap: wrap;
	}
	.v3-hero-btn {
		font-size: 12px;
		font-weight: 600;
		padding: 8px 18px;
		border-radius: 20px;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}
	.v3-hero-btn-primary {
		background: white;
		color: #1a3a2a;
	}
	.v3-hero-btn-primary:hover {
		background: #f0ede8;
	}
	.v3-hero-btn-ghost {
		background: rgba(255, 255, 255, 0.12);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.25);
	}
	.v3-hero-btn-ghost:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	/* Stats strip (legacy — kept for fallback) */
	.v3-hero-stats {
		display: flex;
		gap: 24px;
		flex-shrink: 0;
	}
	.v3-hero-stat {
		text-align: center;
	}
	.v3-hero-stat-val {
		font-family: "DM Serif Display", serif;
		font-size: 20px;
		color: white;
		font-weight: 700;
	}
	.v3-hero-stat-lbl {
		font-size: 10px;
		color: rgba(255, 255, 255, 0.65);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-top: 2px;
	}

	/* Letter grade badge (ring overlay) */
	.v3-hero-ring-grade {
		position: absolute;
		top: -6px;
		right: -8px;
		min-width: 32px;
		height: 32px;
		padding: 0 6px;
		border-radius: 50%;
		background: white;
		color: #1a3a2a;
		font-family: "DM Serif Display", serif;
		font-size: 18px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
		border: 2px solid #1a3a2a;
	}
	.v3-hero-ring-grade.grade-a {
		color: #065f46;
	}
	.v3-hero-ring-grade.grade-b {
		color: #15803d;
	}
	.v3-hero-ring-grade.grade-c {
		color: #a16207;
	}
	.v3-hero-ring-grade.grade-d {
		color: #c2410c;
	}
	.v3-hero-ring-grade.grade-f {
		color: #991b1b;
	}

	/* UX-FIX-1 (Emergency Fix April 11): legacy PRELIM stamp + grade/verdict
	   pill CSS deleted — the composite lives in ScoreHeader.svelte. */

	/* Plain-language meaning line */
	.v3-hero-meaning {
		font-family:
			"Inter",
			-apple-system,
			sans-serif;
		font-size: 15px;
		color: rgba(255, 255, 255, 0.95);
		line-height: 1.55;
		max-width: 520px;
		margin-top: 4px;
	}
	.v3-hero-meaning strong {
		color: white;
		font-weight: 700;
	}

	/* Next tier + How link */
	.v3-hero-next-tier {
		margin-top: 8px;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.82);
		line-height: 1.5;
		max-width: 520px;
	}
	.v3-hero-next-tier strong {
		color: white;
	}
	.v3-hero-howlink {
		background: none;
		border: none;
		color: #a7f3d0;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		padding: 0 0 0 4px;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.v3-hero-howlink:hover {
		color: white;
	}

	/* CoPilot promo card (replaces stats strip) */
	.v3-hero-cp-card {
		flex-shrink: 0;
		width: 240px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 14px;
		padding: 16px;
		backdrop-filter: blur(10px);
	}
	.v3-hero-cp-head {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.v3-hero-cp-sparkle {
		font-size: 14px;
	}
	.v3-hero-cp-title {
		font-family: "DM Serif Display", serif;
		font-size: 16px;
		color: white;
		font-weight: 700;
	}
	.v3-hero-cp-sub {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.65);
		margin-bottom: 12px;
	}
	.v3-hero-cp-chips {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.v3-hero-cp-chip {
		background: rgba(255, 255, 255, 0.12);
		border: 1px solid rgba(255, 255, 255, 0.22);
		color: white;
		font-size: 12px;
		font-weight: 500;
		padding: 8px 12px;
		border-radius: 10px;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s;
		line-height: 1.3;
	}
	.v3-hero-cp-chip:hover {
		background: rgba(255, 255, 255, 0.22);
		border-color: rgba(255, 255, 255, 0.4);
		transform: translateX(2px);
	}
	.v3-hero-cp-chip:disabled {
		opacity: 0.55;
		cursor: wait;
		transform: none;
	}

	/* UX-FIX-2 (Emergency Fix April 11): AskAnything answer surface — sits between
	   the hero and the v3-split, renders the shared inlineCpMessages list. */
	.v3-ask-answer {
		max-width: 1200px;
		margin: 0 auto;
		padding: 14px 20px 16px;
		background: #ffffff;
		border-left: 4px solid var(--sage, #4a7c5c);
		border-radius: 0 0 8px 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}
	.v3-ask-answer-head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
	}
	.v3-ask-answer-sparkle {
		font-size: 14px;
	}
	.v3-ask-answer-title {
		font-size: 13px;
		font-weight: 600;
		color: #1f2937;
		flex: 1;
	}
	.v3-ask-answer-clear {
		background: transparent;
		border: 1px solid #e5e7eb;
		color: #6b7280;
		font-size: 11px;
		padding: 3px 10px;
		border-radius: 10px;
		cursor: pointer;
	}
	.v3-ask-answer-clear:hover:not(:disabled) {
		background: #f3f4f6;
		color: #374151;
	}
	.v3-ask-answer-clear:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.v3-ask-answer-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-height: 360px;
		overflow-y: auto;
	}
	.v3-ask-msg {
		display: flex;
		gap: 8px;
		align-items: flex-start;
	}
	.v3-ask-msg--user {
		justify-content: flex-end;
	}
	.v3-ask-msg-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--sage, #4a7c5c);
		color: white;
		font-size: 9px;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.v3-ask-msg-bubble {
		max-width: 78%;
		padding: 10px 12px;
		border-radius: 10px;
		font-size: 13px;
		line-height: 1.45;
		color: #1f2937;
		white-space: pre-wrap;
		word-wrap: break-word;
	}
	.v3-ask-msg--bot .v3-ask-msg-bubble {
		background: #f5f5f7;
	}
	.v3-ask-msg--user .v3-ask-msg-bubble {
		background: var(--sage, #4a7c5c);
		color: white;
	}
	.v3-ask-msg-bubble--thinking {
		display: inline-flex;
		gap: 4px;
		padding: 12px 14px;
	}
	.v3-ask-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #a1a1a6;
		animation: v3-ask-bounce 1.4s infinite ease-in-out;
	}
	.v3-ask-dot:nth-child(2) {
		animation-delay: 0.2s;
	}
	.v3-ask-dot:nth-child(3) {
		animation-delay: 0.4s;
	}
	@keyframes v3-ask-bounce {
		0%,
		80%,
		100% {
			transform: translateY(0);
			opacity: 0.4;
		}
		40% {
			transform: translateY(-4px);
			opacity: 1;
		}
	}

	/* Meta line */
	.v3-hero-meta {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 14px;
		padding-top: 12px;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		max-width: 1200px;
		margin-left: auto;
		margin-right: auto;
	}
	.v3-data-pill {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.6);
		background: rgba(255, 255, 255, 0.08);
		padding: 3px 10px;
		border-radius: 10px;
	}
	/* UX-FIX-3: non-interactive trust pill variant — replaces the "View data sources" button */
	.v3-data-pill--static {
		display: inline-flex;
		align-items: center;
		cursor: help;
		user-select: none;
	}

	/* ═══════════════════════════════════════════════════════ */
	/* ═══ V3 SPLIT LAYOUT                               ═══ */
	/* ═══════════════════════════════════════════════════════ */
	.v3-split {
		display: flex;
		/* D2: removed min-height: 580px — it created enormous whitespace when right-panel
		   content was shorter than 580px (e.g., when R1 hides empty Neighborhood Snapshot rows).
		   The map (260px) + hood section content set the natural height. */
		background: white;
		border-radius: 0 0 12px 12px;
		overflow: hidden;
		max-width: 1200px;
		margin: 0 auto;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
	}

	/* Left panel */
	.v3-left {
		flex: 1;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		min-width: 0;
	}

	/* Right panel */
	.v3-right {
		width: 380px;
		flex-shrink: 0;
		background: var(--bg);
		display: flex;
		flex-direction: column;
	}

	/* ===== TABS ===== */
	.v3-tabs {
		display: flex;
		border-bottom: 1px solid var(--border);
		padding: 0 28px;
		background: var(--bg);
	}
	.v3-tab {
		padding: 14px 0;
		margin-right: 28px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-muted);
		cursor: pointer;
		border: none;
		background: none;
		border-bottom: 2px solid transparent;
		transition: all 0.2s;
	}
	.v3-tab:hover {
		color: var(--text-primary);
	}
	.v3-tab.active {
		color: var(--text-primary);
		border-bottom-color: var(--sage);
	}

	/* Tab body */
	.v3-tab-body {
		flex: 1;
		overflow-y: auto;
		padding: 24px 28px 80px;
	}

	/* ═══ SUMMARY TAB ═══ */

	/* Meaning card */
	.v3-meaning-card {
		background: #f0faf4;
		border: 1px solid #bbf7d0;
		border-radius: var(--radius);
		padding: 18px 20px;
		margin-bottom: 20px;
	}
	.v3-meaning-eyebrow {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--sage);
		margin-bottom: 6px;
	}
	.v3-meaning-text {
		font-size: 14px;
		color: var(--text-primary);
		line-height: 1.6;
	}
	.v3-meaning-text strong {
		font-weight: 700;
	}

	/* Working / Watch */
	.v3-ww-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
		margin-bottom: 20px;
	}
	.v3-ww-card {
		background: white;
		border-radius: var(--radius);
		padding: 16px;
		border: 1px solid var(--border);
	}
	.v3-ww-title {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		margin-bottom: 10px;
	}
	.v3-ww-green {
		color: var(--sage);
	}
	.v3-ww-amber {
		color: #b45309;
	}
	.v3-ww-item {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 13px;
		color: #444;
		margin-bottom: 8px;
		line-height: 1.4;
	}
	.v3-ww-item:last-child {
		margin-bottom: 0;
	}
	.v3-ww-empty {
		font-style: italic;
		color: var(--text-muted);
		font-size: 12px;
	}
	/* UX-2.2: Progressive disclosure "Show all N" button */
	.v3-ww-more {
		margin-top: 6px;
		background: none;
		border: none;
		padding: 4px 0;
		font-size: 12px;
		font-weight: 600;
		color: #4a7c5c;
		cursor: pointer;
		font-family: inherit;
	}
	.v3-ww-more:hover {
		color: #1a3a2a;
		text-decoration: underline;
	}
	.v3-ww-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		margin-top: 6px;
	}
	.v3-dot-g {
		background: var(--sage);
	}
	.v3-dot-a {
		background: #d97706;
	}

	/* UX-E: Evidence level badges */
	.v3-ev-badge {
		display: inline-block;
		font-size: 10px;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 6px;
		margin-left: 4px;
		vertical-align: middle;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}
	.v3-ev-high {
		color: #065f46;
		background: rgba(16, 185, 129, 0.15);
	}
	.v3-ev-med {
		color: #92400e;
		background: rgba(245, 158, 11, 0.15);
	}
	.v3-ev-low {
		color: #6b7280;
		background: rgba(107, 114, 128, 0.12);
	}

	/* How to Gain Points */
	.v3-improve-card {
		background: white;
		border: 1px solid #e0e7ff;
		border-radius: var(--radius);
		padding: 16px 18px;
		margin-bottom: 20px;
	}
	.v3-improve-title {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		color: #4338ca;
		letter-spacing: 0.3px;
		margin-bottom: 10px;
	}
	.v3-improve-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 13px;
		color: #444;
		padding: 6px 0;
		border-bottom: 1px solid #f3f0ec;
	}
	.v3-improve-item:last-child {
		border-bottom: none;
	}
	.v3-improve-pts {
		font-weight: 700;
		color: #4338ca;
		font-size: 12px;
		flex-shrink: 0;
		margin-left: 12px;
	}
	/* §1c (April 11): category grouping for "How to gain points". Each group
	   gets a small uppercase subheader so the founder can tell at a glance
	   which levers are block-side vs concept-side vs money-side. The group
	   itself is a tiny bordered band, not a heavy section — we don't want
	   the headers to dominate the card. */
	.v3-improve-group {
		margin-bottom: 8px;
	}
	.v3-improve-group:last-of-type {
		margin-bottom: 0;
	}
	.v3-improve-group-head {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.4px;
		color: #6b7280;
		margin: 6px 0 4px;
		padding-bottom: 3px;
		border-bottom: 1px solid #f3f0ec;
	}
	/* UX-FIX-7 (Emergency Fix April 11): expander control under the "How to
	   gain points" list — reveals the rest of the levers when the top-3 isn't
	   enough. Styled as a subtle dashed text button, not another list row. */
	.v3-improve-expander {
		display: inline-flex;
		align-items: center;
		margin-top: 10px;
		padding: 6px 10px;
		background: transparent;
		border: 1px dashed #c7d2fe;
		border-radius: 8px;
		color: #4338ca;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 0.15s ease,
			border-color 0.15s ease;
	}
	.v3-improve-expander:hover {
		background: #eef2ff;
		border-color: #a5b4fc;
	}

	/* Why bullets */
	.v3-why-bullets {
		margin-bottom: 20px;
	}
	.v3-why-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: #555;
		padding: 5px 0;
	}
	.v3-why-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.v3-why-dot--green {
		background: #059669;
	}
	.v3-why-dot--amber {
		background: #d97706;
	}
	.v3-why-dot--red {
		background: #dc2626;
	}
	.v3-why-dot--gray {
		background: #9ca3af;
	}

	/* Terminal CTA */
	.v3-terminal-cta {
		border-radius: var(--radius);
		padding: 20px;
		margin-top: 8px;
	}
	.v3-terminal--strong {
		background: linear-gradient(135deg, #f0fdf4, #dcfce7);
		border: 1px solid #bbf7d0;
	}
	.v3-terminal--viable {
		background: linear-gradient(135deg, #f0fdf4, #dcfce7);
		border: 1px solid #bbf7d0;
	}
	.v3-terminal--tight {
		background: linear-gradient(135deg, #fffbeb, #fef3c7);
		border: 1px solid #fde68a;
	}
	.v3-terminal--stretch {
		background: linear-gradient(135deg, #fff7ed, #ffedd5);
		border: 1px solid #fed7aa;
	}
	.v3-terminal--rethink {
		background: linear-gradient(135deg, #fef2f2, #fee2e2);
		border: 1px solid #fecaca;
	}
	.v3-terminal-title {
		font-family: "DM Serif Display", serif;
		font-size: 17px;
		color: var(--deep-green);
		margin-bottom: 6px;
	}
	.v3-terminal-sub {
		font-size: 13px;
		color: var(--text-secondary);
		margin-bottom: 16px;
		line-height: 1.5;
	}
	.v3-terminal-btns {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.v3-terminal-btn-primary {
		background: var(--sage);
		color: white;
		padding: 10px 22px;
		border-radius: 22px;
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
		transition: background 0.2s;
		display: inline-block;
	}
	.v3-terminal-btn-primary:hover {
		background: #3d6b4e;
	}
	.v3-terminal-btn-ghost {
		background: white;
		color: var(--text-primary);
		padding: 10px 22px;
		border-radius: 22px;
		font-size: 13px;
		font-weight: 600;
		border: 1px solid var(--border);
		text-decoration: none;
		transition: all 0.2s;
		display: inline-block;
	}
	.v3-terminal-btn-ghost:hover {
		border-color: var(--sage);
		color: var(--sage);
	}

	/* ═══ DEEP DIVE TAB ═══ */
	.v3-dd-row {
		background: white;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		padding: 16px 18px;
		margin-bottom: 12px;
		transition: box-shadow 0.2s;
	}
	.v3-dd-row:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
	}
	.v3-dd-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.v3-dd-left {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.v3-dd-icon {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
	}
	.v3-dd-label {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
	}
	.v3-dd-sublabel {
		font-size: 12px;
		color: #888;
		margin-top: 1px;
	}
	.v3-dd-signal {
		font-size: 12.5px;
		color: #555;
		padding: 4px 0 2px 36px;
		line-height: 1.4;
		font-style: italic;
	}

	/* Kill Factor Callouts */
	.v3-kill-factors {
		margin: 0 0 16px 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.v3-kill-item {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 10px 14px;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		border-left: 3px solid #dc2626;
	}
	/* UX-D: Rule 3 caution variant — orange, not red. Not a hard kill; pivot-able. */
	.v3-kill-item--caution {
		background: #fff7ed;
		border-color: #fed7aa;
		border-left-color: #ea580c;
	}
	.v3-kill-item--caution .v3-kill-text {
		color: #9a3412;
	}
	.v3-kill-icon {
		font-size: 16px;
		flex-shrink: 0;
		line-height: 1.4;
	}
	.v3-kill-text {
		font-size: 13px;
		color: #991b1b;
		line-height: 1.4;
	}
	.v3-dd-right {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.v3-dd-score {
		font-family: "DM Serif Display", serif;
		font-size: 22px;
		font-weight: 700;
	}
	.v3-dd-bar {
		width: 80px;
		height: 5px;
		background: var(--border);
		border-radius: 3px;
		overflow: hidden;
	}
	.v3-dd-bar-fill {
		height: 100%;
		border-radius: 3px;
	}

	/* Composites */
	.v3-composites {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		margin-top: 20px;
		padding-top: 20px;
		border-top: 1px solid var(--border);
	}
	.v3-comp-cell {
		background: var(--bg);
		border-radius: var(--radius);
		padding: 14px;
		border: 1px solid var(--border);
	}
	.v3-comp-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}
	.v3-comp-name {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}
	.v3-comp-badge {
		font-size: 10px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 10px;
	}
	.v3-badge-g {
		background: #dcfce7;
		color: #166534;
	}
	.v3-badge-a {
		background: #fef3c7;
		color: #92400e;
	}
	.v3-badge-r {
		background: #fee2e2;
		color: #991b1b;
	}
	.v3-comp-score {
		font-family: "DM Serif Display", serif;
		font-size: 24px;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 6px;
	}
	.v3-comp-bar {
		width: 100%;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		overflow: hidden;
		margin-bottom: 8px;
	}
	.v3-comp-bar-fill {
		height: 100%;
		border-radius: 2px;
	}
	.v3-comp-meaning {
		font-size: 11px;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	/* ═══ VISION TAB ═══ */
	.v3-vision-header {
		font-family: "DM Serif Display", serif;
		font-size: 18px;
		color: var(--deep-green);
		margin-bottom: 4px;
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.v3-vision-fill-count {
		font-family: inherit;
		font-size: 11px;
		font-weight: 500;
		color: var(--text-secondary);
		opacity: 0.75;
	}
	.v3-vision-sub {
		font-size: 13px;
		color: var(--text-secondary);
		margin-bottom: 20px;
	}
	.v3-vision-progress {
		margin-bottom: 20px;
	}
	.v3-vision-progress-bar {
		width: 100%;
		height: 6px;
		background: var(--border);
		border-radius: 3px;
		overflow: hidden;
		margin-bottom: 6px;
	}
	.v3-vision-progress-fill {
		height: 100%;
		background: var(--sage);
		border-radius: 3px;
		transition: width 0.4s ease;
	}
	.v3-vision-progress-text {
		font-size: 12px;
		color: var(--text-muted);
	}
	.v3-vision-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 20px;
	}
	.v3-vision-field {
		background: white;
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px 14px;
	}
	.v3-vision-field-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		color: var(--text-muted);
		margin-bottom: 4px;
	}
	.v3-vision-field-val {
		font-size: 14px;
		color: var(--text-primary);
		font-weight: 500;
	}
	.v3-vision-field-active {
		color: var(--sage);
	}
	.v3-vision-field-cta {
		color: var(--sage);
		cursor: pointer;
		font-style: italic;
	}
	/* Addendum Item 4: full-width field + concept detail link */
	.v3-vision-field--full {
		grid-column: 1 / -1;
		text-align: center;
		padding: 10px 14px;
	}
	.v3-concept-detail-link {
		font-size: 12px;
		font-weight: 600;
		color: var(--sage);
		text-decoration: none;
		cursor: pointer;
	}
	.v3-concept-detail-link:hover {
		text-decoration: underline;
	}
	.v3-vision-edit-cta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 8px;
		padding: 14px 18px;
		margin-top: 8px;
		font-size: 13px;
		color: #1e40af;
	}
	.v3-vision-edit-btn {
		font-weight: 600;
		color: #1e40af;
		text-decoration: none;
	}
	.v3-vision-edit-btn:hover {
		text-decoration: underline;
	}

	/* ═══ COPILOT BOTTOM BAR ═══ */
	.v3-copilot-bar {
		border-top: 1px solid var(--border);
		padding: 12px 28px;
		display: flex;
		gap: 8px;
		align-items: center;
		background: white;
	}
	.v3-copilot-sparkle {
		font-size: 16px;
		flex-shrink: 0;
	}
	.v3-copilot-input {
		flex: 1;
		border: 1px solid #d4c8bc;
		border-radius: 8px;
		padding: 9px 14px;
		font-size: 13px;
		font-family: "DM Sans", sans-serif;
		color: #555;
		outline: none;
		transition: border-color 0.2s;
	}
	.v3-copilot-input:focus {
		border-color: var(--sage);
	}
	.v3-copilot-input::placeholder {
		color: #bbb;
	}
	.v3-copilot-send {
		background: var(--sage);
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.2s;
	}
	.v3-copilot-send:hover:not(:disabled) {
		background: #3d6b4e;
	}
	.v3-copilot-send:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* ═══ RIGHT PANEL ═══ */
	.v3-map-area {
		height: 260px;
		position: relative;
		overflow: hidden;
	}
	.v3-map-toggles {
		display: flex;
		gap: 6px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
	}
	.v3-map-toggle {
		font-size: 11px;
		font-weight: 500;
		padding: 5px 12px;
		border-radius: 16px;
		border: 1px solid #d4c8bc;
		background: white;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s;
	}
	.v3-map-toggle.active {
		background: var(--deep-green);
		color: white;
		border-color: var(--deep-green);
	}
	.v3-map-toggle:hover:not(.active) {
		border-color: var(--sage);
	}

	/* ═══ UX-19 LENS-01 ═══════════════════════════════════════════════════ */
	.v3-lenses {
		padding: 12px 14px 16px;
		border-bottom: 1px solid var(--border);
	}
	/* R3-1: Horizontal pill strip — single row, scrollable on mobile */
	.v3-lens-pills {
		display: flex;
		gap: 6px;
		margin-bottom: 14px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		padding: 2px 0;
	}
	.v3-lens-pills::-webkit-scrollbar {
		display: none;
	}
	.v3-lens-pill {
		flex-shrink: 0;
		padding: 7px 14px;
		border-radius: 20px;
		border: 1px solid #d4c8bc;
		background: white;
		color: #0f2e1f;
		font-size: 12px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
		line-height: 1.15;
	}
	.v3-lens-pill:hover:not(.active) {
		border-color: #94a3b8;
		background: #fafaf9;
	}
	.v3-lens-pill.active {
		background: #1b3a2d;
		border-color: #1b3a2d;
		color: #fff;
		box-shadow: 0 1px 4px rgba(15, 46, 31, 0.15);
	}
	.v3-lens-card {
		background: #fafaf9;
		border: 1px solid #eef2f0;
		border-left-width: 3px;
		border-radius: 8px;
		padding: 12px 14px;
		animation: v3-lens-fade 0.25s ease-out;
	}
	@keyframes v3-lens-fade {
		from {
			opacity: 0;
			transform: translateY(-3px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.v3-lens-tier-strong {
		border-left-color: #059669;
		background: rgba(5, 150, 105, 0.06);
	}
	.v3-lens-tier-solid {
		border-left-color: #34d399;
		background: rgba(52, 211, 153, 0.06);
	}
	.v3-lens-tier-average {
		border-left-color: #94a3b8;
	}
	.v3-lens-tier-weak {
		border-left-color: #d97706;
		background: rgba(217, 119, 6, 0.06);
	}
	.v3-lens-tier-concerning {
		border-left-color: #b91c1c;
		background: rgba(185, 28, 28, 0.06);
	}
	.v3-lens-hdr {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 6px;
	}
	.v3-lens-score {
		font-family: "DM Serif Display", serif;
		font-size: 24px;
		font-weight: 700;
		color: #0f2e1f;
		line-height: 1;
	}
	.v3-lens-tier {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #667;
	}
	.v3-lens-verdict {
		font-size: 13px;
		line-height: 1.5;
		color: #334155;
		margin-bottom: 10px;
	}
	.v3-lens-signals {
		list-style: none;
		padding: 0;
		margin: 0 0 12px;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.v3-lens-sig {
		display: flex;
		align-items: flex-start;
		gap: 7px;
		font-size: 11px;
		line-height: 1.45;
		color: #475569;
	}
	.v3-lens-sig-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		font-size: 9px;
		font-weight: 700;
		flex-shrink: 0;
		margin-top: 1px;
	}
	.v3-lens-sig-positive .v3-lens-sig-icon {
		background: rgba(5, 150, 105, 0.15);
		color: #059669;
	}
	.v3-lens-sig-negative .v3-lens-sig-icon {
		background: rgba(185, 28, 28, 0.15);
		color: #b91c1c;
	}
	.v3-lens-sig-neutral .v3-lens-sig-icon {
		background: #f1f5f3;
		color: #94a3b8;
	}
	.v3-lens-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding-top: 9px;
		border-top: 1px dashed #e2e8f0;
	}
	.v3-lens-sources {
		font-size: 10px;
		color: #94a3b8;
		font-weight: 500;
	}
	.v3-lens-cp {
		font-size: 11px;
		font-weight: 600;
		color: #059669;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.v3-lens-cp:hover {
		text-decoration: underline;
	}

	.v3-lens-loading,
	.v3-lens-empty {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px;
		background: #fafaf9;
		border: 1px dashed #d4c8bc;
		border-radius: 8px;
		font-size: 12px;
		color: #667;
	}
	.v3-lens-spinner {
		width: 14px;
		height: 14px;
		border: 2px solid #d4c8bc;
		border-top-color: #059669;
		border-radius: 50%;
		animation: ds-spin 0.7s linear infinite;
	}
	.v3-lens-retry {
		margin-left: auto;
		font-size: 11px;
		color: #059669;
		background: none;
		border: none;
		cursor: pointer;
		font-weight: 600;
	}

	.v3-hood-section {
		padding: 16px;
		/* D2: removed flex:1 + overflow-y:auto — they made the right panel try to
		   fill all available height and triggered the whitespace cascade. Section
		   now sizes to its content. */
	}
	.v3-hood-title {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #888;
		margin-bottom: 12px;
	}
	.v3-hood-stat {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: #555;
		padding: 8px 0;
		border-bottom: 1px solid #f0ede8;
	}
	.v3-hood-stat:last-child {
		border-bottom: none;
	}
	.v3-hood-val {
		font-weight: 600;
		color: var(--text-primary);
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		justify-content: flex-end;
		text-align: right;
	}
	/* UX-07: tier pills on sidebar snapshot stats */
	.v3-hood-pill {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.4px;
		background: #e5e7eb;
		color: #4b5563;
		border: 1px solid transparent;
	}
	.v3-hood-pill-a {
		background: #d1fae5;
		color: #065f46;
		border-color: #a7f3d0;
	}
	.v3-hood-pill-b {
		background: #dbeafe;
		color: #1e40af;
		border-color: #bfdbfe;
	}
	.v3-hood-pill-c {
		background: #fef3c7;
		color: #92400e;
		border-color: #fde68a;
	}
	.v3-hood-pill-d {
		background: #ffedd5;
		color: #9a3412;
		border-color: #fed7aa;
	}
	.v3-hood-pill-f {
		background: #fee2e2;
		color: #991b1b;
		border-color: #fecaca;
	}
	/* UX-08: Year-1 survival comparator pill */
	.v3-hood-pill-cmp {
		background: #f3f4f6;
		color: #4b5563;
	}
	/* UX-07: Vision IQ tier pill colors */
	.v3-hood-pill-vis-green {
		background: #dcfce7;
		color: #166534;
		border-color: #bbf7d0;
	}
	.v3-hood-pill-vis-amber {
		background: #fef3c7;
		color: #92400e;
		border-color: #fde68a;
	}
	.v3-hood-pill-vis-red {
		background: #fee2e2;
		color: #991b1b;
		border-color: #fecaca;
	}
	.v3-hood-pill-vis-neutral {
		background: #e0f2fe;
		color: #0c4a6e;
		border-color: #bae6fd;
	}
	.v3-hood-pill-cmp-pos {
		background: #d1fae5;
		color: #065f46;
		border-color: #a7f3d0;
	}
	/* UX-04 / BR-09: Concept Pulse tier pills — own vocabulary (Buzzing/Busy/Steady/Quiet/Sleepy).
	   Warm palette so they don't get confused with A–F Fit IQ grade pills. */
	.v3-hood-pill-pulse {
		text-transform: none;
		letter-spacing: 0;
	}
	.v3-hood-pill-pulse-buzzing {
		background: #fef3c7;
		color: #92400e;
		border-color: #fcd34d;
	}
	.v3-hood-pill-pulse-busy {
		background: #fef9c3;
		color: #854d0e;
		border-color: #fde68a;
	}
	.v3-hood-pill-pulse-steady {
		background: #e0f2fe;
		color: #075985;
		border-color: #bae6fd;
	}
	.v3-hood-pill-pulse-quiet {
		background: #f1f5f9;
		color: #475569;
		border-color: #cbd5e1;
	}
	.v3-hood-pill-pulse-sleepy {
		background: #f3f4f6;
		color: #6b7280;
		border-color: #e5e7eb;
	}
	.v3-hood-sub {
		font-size: 10px;
		font-weight: 500;
		color: #9ca3af;
		text-transform: none;
	}

	/* UX-05: Vision tab badge */
	.v3-tab-badge {
		display: inline-block;
		margin-left: 6px;
		padding: 2px 7px;
		border-radius: 9px;
		background: #fef3c7;
		color: #92400e;
		border: 1px solid #fde68a;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.2px;
		line-height: 1.4;
		vertical-align: middle;
	}
	.v3-tab.active .v3-tab-badge {
		background: #fcd34d;
		color: #7c2d12;
		border-color: #f59e0b;
	}
	/* UX-10: hero continuation link ("fill Vision to sharpen this") */
	.v3-hero-sharpen-link {
		background: none;
		border: none;
		padding: 0;
		color: #fcd34d;
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
		font: inherit;
	}
	.v3-hero-sharpen-link:hover {
		color: #fde68a;
	}
	/* UX-FIX-4 (Emergency Fix April 11): .v3-hero-bc-hint rule removed along with the
	   "Tip: Business Case is more accurate" copy it styled. Nudge relocated to BC tab. */
	/* UX-12: +X pts pills on empty Vision cards */
	.v3-vision-field {
		position: relative;
	}
	.v3-vision-pts {
		position: absolute;
		top: 6px;
		right: 6px;
		padding: 2px 6px;
		border-radius: 8px;
		background: #fef3c7;
		color: #92400e;
		border: 1px solid #fde68a;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.3px;
		text-transform: uppercase;
	}
	.v3-vision-pts-big {
		background: #fcd34d;
		color: #78350f;
		border-color: #f59e0b;
	}

	/* UX-12: Score Simulator panel */
	.v3-sim-panel {
		margin-top: 16px;
		padding: 14px 16px;
		background: #fefce8;
		border: 1px solid #fde68a;
		border-radius: 10px;
	}
	.v3-sim-title {
		font-size: 13px;
		font-weight: 700;
		color: #92400e;
		margin-bottom: 10px;
	}
	.v3-sim-rec {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 0;
		font-size: 12.5px;
		color: #374151;
		border-bottom: 1px solid rgba(253, 230, 138, 0.5);
	}
	.v3-sim-rec:last-of-type {
		border-bottom: none;
	}
	.v3-sim-rec-label {
		font-weight: 600;
		min-width: 80px;
	}
	.v3-sim-rec-change {
		flex: 1;
	}
	.v3-sim-rec-delta {
		font-weight: 700;
		color: #059669;
		font-size: 12px;
		white-space: nowrap;
	}
	.v3-sim-combo {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid #fde68a;
		font-size: 12.5px;
		color: #92400e;
	}
	.v3-sim-actions {
		margin-top: 12px;
		display: flex;
		gap: 8px;
	}
	.v3-sim-btn {
		padding: 6px 16px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		border: 1px solid;
		transition: all 0.15s;
	}
	.v3-sim-apply {
		background: #065f46;
		color: #fff;
		border-color: #047857;
	}
	.v3-sim-apply:hover {
		background: #047857;
	}
	.v3-sim-undo {
		background: #fff;
		color: #92400e;
		border-color: #fde68a;
	}
	.v3-sim-undo:hover {
		background: #fef3c7;
	}

	/* UX-18: Shortlist toast with destination link */
	.shortlist-toast {
		position: fixed;
		bottom: 90px;
		left: 50%;
		transform: translateX(-50%);
		display: inline-flex;
		align-items: center;
		gap: 12px;
		padding: 12px 18px;
		background: #1a3a2a;
		color: #fff;
		border-radius: 999px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.18);
		font-size: 14px;
		font-weight: 600;
		z-index: 90;
		animation: shortlist-toast-in 200ms ease-out;
	}
	.shortlist-toast-link {
		color: #fcd34d;
		font-weight: 700;
		text-decoration: none;
	}
	.shortlist-toast-link:hover {
		text-decoration: underline;
	}
	@keyframes shortlist-toast-in {
		from {
			opacity: 0;
			transform: translate(-50%, 10px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}

	.v3-hood-buzz {
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}
	.v3-hood-buzz-text {
		font-size: 13px;
		color: #555;
		line-height: 1.5;
	}
	.v3-hood-buzz-text strong {
		color: var(--text-primary);
	}

	/* ═══ STICKY BAR ═══ */
	.z1-sticky-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 24px;
		padding: 10px 24px;
		background: var(--deep-green);
		color: white;
		z-index: 50;
		box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.15);
	}
	.z1-sticky-addr {
		font-size: 13px;
		font-weight: 500;
	}
	.z1-sticky-scores {
		display: flex;
		gap: 16px;
	}
	.z1-sticky-score {
		font-size: 12px;
		opacity: 0.8;
	}
	.z1-sticky-score strong {
		opacity: 1;
		font-size: 14px;
	}
	.z1-sticky-cta {
		background: white;
		color: var(--deep-green);
		padding: 6px 18px;
		border-radius: 18px;
		font-size: 12px;
		font-weight: 600;
		text-decoration: none;
	}

	/* ═══ MODALS ═══ */
	.duplicate-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 200;
	}
	.duplicate-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: white;
		border-radius: 16px;
		padding: 32px;
		z-index: 201;
		max-width: 420px;
		width: 90%;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
	}
	.duplicate-modal-content {
		text-align: center;
	}
	.duplicate-modal-icon {
		font-size: 40px;
		margin-bottom: 12px;
	}
	.duplicate-modal-title {
		font-family: "DM Serif Display", serif;
		font-size: 20px;
		margin-bottom: 8px;
	}
	.duplicate-modal-msg {
		font-size: 14px;
		color: var(--text-secondary);
		margin-bottom: 20px;
	}
	.duplicate-modal-actions {
		display: flex;
		gap: 10px;
		justify-content: center;
	}
	.duplicate-btn {
		padding: 10px 22px;
		border-radius: 22px;
		font-size: 13px;
		font-weight: 600;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}
	.duplicate-btn-primary {
		background: var(--sage);
		color: white;
	}
	.duplicate-btn-primary:hover {
		background: #3d6b4e;
	}
	.duplicate-btn-secondary {
		background: var(--bg);
		color: var(--text-primary);
		border: 1px solid var(--border);
	}

	/* Upload drawer */
	.upload-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 200;
	}
	.upload-drawer {
		position: fixed;
		right: 0;
		top: 0;
		bottom: 0;
		width: 400px;
		background: white;
		z-index: 201;
		box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
		display: flex;
		flex-direction: column;
	}
	.upload-drawer-hdr {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 24px;
		border-bottom: 1px solid var(--border);
	}
	.upload-drawer-title {
		font-family: "DM Serif Display", serif;
		font-size: 18px;
	}
	.upload-drawer-addr {
		font-size: 12px;
		color: var(--text-muted);
		margin-top: 2px;
	}
	.upload-drawer-close {
		background: none;
		border: none;
		font-size: 20px;
		cursor: pointer;
		color: var(--text-muted);
		padding: 4px 8px;
	}
	.upload-drawer-body {
		flex: 1;
		padding: 24px;
		overflow-y: auto;
	}
	.upload-drop-zone {
		border: 2px dashed var(--border);
		border-radius: 12px;
		padding: 32px;
		text-align: center;
		margin-bottom: 24px;
	}
	.upload-drop-icon {
		font-size: 32px;
		margin-bottom: 8px;
	}
	.upload-drop-title {
		font-size: 14px;
		font-weight: 600;
		margin-bottom: 4px;
	}
	.upload-drop-sub {
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 12px;
	}
	.upload-drop-btn {
		display: inline-block;
		background: var(--sage);
		color: white;
		padding: 8px 20px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.upload-empty-state {
		text-align: center;
		padding: 32px 0;
	}
	.upload-empty-icon {
		font-size: 32px;
		margin-bottom: 8px;
		opacity: 0.5;
	}
	.upload-empty-text {
		font-size: 14px;
		color: var(--text-secondary);
		margin-bottom: 4px;
	}
	.upload-empty-sub {
		font-size: 12px;
		color: var(--text-muted);
	}

	/* ═══ RESPONSIVE ═══ */
	@media (max-width: 900px) {
		.v3-hero-inner {
			flex-direction: column;
			text-align: center;
			gap: 20px;
		}
		.v3-hero-text {
			text-align: center;
		}
		.v3-hero-context {
			max-width: 100%;
		}
		.v3-hero-meaning {
			max-width: 100%;
			text-align: center;
		}
		.v3-hero-next-tier {
			max-width: 100%;
			text-align: center;
		}
		.v3-hero-actions {
			justify-content: center;
		}
		.v3-hero-stats {
			justify-content: center;
		}
		/* UX-FIX-1: legacy .v3-hero-verdict-row mobile override removed — header now owned by ScoreHeader.svelte */
		.v3-hero-cp-card {
			width: 100%;
			max-width: 360px;
			margin: 4px auto 0;
		}
		.v3-split {
			flex-direction: column;
		}
		.v3-right {
			width: 100%;
		}
		.v3-ww-row {
			grid-template-columns: 1fr;
		}
		.v3-composites {
			grid-template-columns: 1fr;
		}
		.v3-vision-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 600px) {
		.v3-hero {
			padding: 20px 16px 16px;
		}
		.v3-hero-ring-wrap {
			width: 90px;
			height: 90px;
		}
		.v3-hero-ring-wrap svg {
			width: 90px;
			height: 90px;
		}
		.v3-hero-ring-num {
			font-size: 28px;
		}
		.v3-hero-ring-grade {
			min-width: 26px;
			height: 26px;
			font-size: 14px;
			top: -4px;
			right: -6px;
		}
		.v3-hero-meaning {
			font-size: 14px;
		}
		.v3-hero-addr {
			font-size: 18px;
		}
		.v3-hero-actions {
			flex-direction: column;
			align-items: stretch;
		}
		.v3-hero-btn {
			justify-content: center;
		}
		.v3-tabs {
			padding: 0 16px;
		}
		.v3-tab {
			margin-right: 18px;
		}
		.v3-tab-body {
			padding: 16px 16px 60px;
		}
		.v3-copilot-bar {
			padding: 10px 16px;
		}
		.v3-terminal-btns {
			flex-direction: column;
		}
	}

	/* ═══ UX-23: Data Sources Modal ═══════════════════════════════════════ */
	.v3-data-pill-btn {
		background: none;
		border: 1px solid rgba(255, 255, 255, 0.25);
		cursor: pointer;
		font: inherit;
		color: inherit;
		transition:
			background 0.15s ease,
			border-color 0.15s ease;
	}
	.v3-data-pill-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.5);
	}
	.v3-data-pill-arrow {
		margin-left: 4px;
		opacity: 0.7;
		font-weight: 700;
	}

	.ds-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(10, 20, 15, 0.55);
		z-index: 1000;
		backdrop-filter: blur(2px);
	}
	.ds-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(780px, 92vw);
		max-height: 85vh;
		background: #fff;
		border-radius: 14px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		z-index: 1001;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.ds-modal-hdr {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 20px 24px 16px;
		border-bottom: 1px solid #eef2f0;
		gap: 16px;
	}
	.ds-modal-title {
		font-family: "DM Serif Display", serif;
		font-size: 22px;
		color: #0f2e1f;
		margin-bottom: 4px;
	}
	.ds-modal-sub {
		font-size: 12px;
		color: #667;
		line-height: 1.5;
	}
	.ds-warn {
		color: #b91c1c;
		font-weight: 600;
	}
	.ds-mute {
		color: #94a3b8;
	}
	.ds-modal-close {
		background: none;
		border: none;
		font-size: 20px;
		color: #667;
		cursor: pointer;
		padding: 4px 10px;
		line-height: 1;
		border-radius: 6px;
	}
	.ds-modal-close:hover {
		background: #f1f5f3;
		color: #0f2e1f;
	}

	.ds-modal-body {
		flex: 1;
		overflow-y: auto;
		padding: 18px 24px;
	}
	.ds-intro {
		font-size: 13px;
		line-height: 1.6;
		color: #475569;
		margin: 0 0 18px;
		padding: 12px 14px;
		background: #f0f9f4;
		border-left: 3px solid #059669;
		border-radius: 6px;
	}
	.ds-group {
		margin-bottom: 22px;
	}
	.ds-group:last-child {
		margin-bottom: 0;
	}
	.ds-group-title {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		color: #0f2e1f;
		margin: 0 0 10px;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.ds-group-count {
		font-size: 10px;
		font-weight: 600;
		color: #667;
		background: #f1f5f3;
		padding: 2px 7px;
		border-radius: 10px;
		letter-spacing: 0;
	}
	.ds-list {
		list-style: none;
		padding: 0;
		margin: 0;
		border: 1px solid #eef2f0;
		border-radius: 8px;
		overflow: hidden;
	}
	.ds-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 11px 14px;
		border-bottom: 1px solid #f1f5f3;
		gap: 12px;
	}
	.ds-item:last-child {
		border-bottom: none;
	}
	.ds-item-error {
		background: #fef2f2;
	}
	.ds-item-missing {
		background: #fafaf9;
	}
	.ds-item-main {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}
	.ds-item-label {
		font-size: 13px;
		font-weight: 600;
		color: #0f2e1f;
	}
	.ds-item-cadence {
		font-size: 11px;
		color: #94a3b8;
		margin-top: 1px;
	}
	.ds-item-status {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}
	.ds-item-age {
		font-size: 10px;
		color: #94a3b8;
	}
	.ds-chip {
		font-size: 10px;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 10px;
		letter-spacing: 0.3px;
		white-space: nowrap;
	}
	.ds-chip-ok {
		background: rgba(5, 150, 105, 0.12);
		color: #047857;
	}
	.ds-chip-err {
		background: rgba(185, 28, 28, 0.12);
		color: #b91c1c;
	}
	.ds-chip-miss {
		background: #f1f5f3;
		color: #64748b;
	}

	.ds-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		padding: 50px 20px;
		text-align: center;
		color: #667;
		font-size: 13px;
	}
	.ds-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid #eef2f0;
		border-top-color: #059669;
		border-radius: 50%;
		animation: ds-spin 0.8s linear infinite;
	}
	@keyframes ds-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.ds-empty {
		padding: 40px 20px;
		text-align: center;
	}
	.ds-empty-icon {
		font-size: 32px;
		margin-bottom: 10px;
	}
	.ds-empty-title {
		font-weight: 700;
		color: #0f2e1f;
		font-size: 15px;
		margin-bottom: 4px;
	}
	.ds-empty-sub {
		font-size: 12px;
		color: #667;
		margin-bottom: 14px;
	}
	.ds-retry {
		background: #059669;
		color: #fff;
		border: none;
		padding: 8px 18px;
		border-radius: 6px;
		font-weight: 600;
		font-size: 13px;
		cursor: pointer;
	}
	.ds-retry:hover {
		background: #047857;
	}

	.ds-modal-ftr {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 24px;
		border-top: 1px solid #eef2f0;
		background: #fafaf9;
		gap: 12px;
	}
	.ds-ftr-note {
		font-size: 11px;
		color: #667;
	}
	.ds-ftr-close {
		background: #0f2e1f;
		color: #fff;
		border: none;
		padding: 8px 18px;
		border-radius: 6px;
		font-weight: 600;
		font-size: 12px;
		cursor: pointer;
	}
	.ds-ftr-close:hover {
		background: #1a4a30;
	}

	@media (max-width: 600px) {
		.ds-modal {
			width: 96vw;
			max-height: 92vh;
		}
		.ds-modal-hdr {
			padding: 16px 18px 12px;
		}
		.ds-modal-body {
			padding: 14px 18px;
		}
		.ds-modal-title {
			font-size: 18px;
		}
	}

	/* D16: Export-brief toast */
	.export-toast {
		position: fixed;
		bottom: 80px;
		right: 24px;
		z-index: 250;
		padding: 12px 20px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
		animation: exportToastIn 0.2s ease;
		max-width: 320px;
	}
	.export-toast--ok {
		background: #ecfdf5;
		color: #065f46;
		border: 1px solid #6ee7b7;
	}
	.export-toast--warn {
		background: #fffbeb;
		color: #92400e;
		border: 1px solid #fde68a;
	}
	.export-toast--err {
		background: #fef2f2;
		color: #991b1b;
		border: 1px solid #fecaca;
	}
	@keyframes exportToastIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
