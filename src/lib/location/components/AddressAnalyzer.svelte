<script lang="ts">
	import { onMount } from "svelte";
	import type { LocationStore } from "../store.svelte";
	import {
		geocode,
		scanArea,
		getConceptScanRadius,
		fetchLiveIntel,
		enrichStationsFromMTA,
		type GeoCandidate,
	} from "../api/geo";
	// 04.19.2026 13:00 Changed from normalizeConceptKey to normalizeBusinessType (canonical registry)
	import { normalizeBusinessType } from "$lib/intel/registry/business-type-registry";
	import {
		blockScore,
		calculateVLF,
		calculateGLF,
		calculateRR,
		calculatePoS,
		buildL2FromScan,
		buildL3FromGoals,
		computeComposite,
		generateCommentary,
		calculateLCS,
	} from "../scoring/engines";
	import SearchSteps from "./SearchSteps.svelte";
	import VerdictCard from "./VerdictCard.svelte";
	import KeySignals from "./KeySignals.svelte";
	import RecommendationCards from "./RecommendationCards.svelte";
	import DeepDive from "./DeepDive.svelte";
	import VacancyListings from "./VacancyListings.svelte";
	import ScoreHybrid from "$lib/components/ScoreHybrid.svelte";
	import RadialCompass from "./RadialCompass.svelte";
	import ScoreRings from "./ScoreRings.svelte";
	import FitDimensionRings from "./FitDimensionRings.svelte";
	import TheBrief from "./TheBrief.svelte";
	import TheReceipts from "./TheReceipts.svelte";
	import WeightSliders from "./WeightSliders.svelte";
	import DataCoverage from "./DataCoverage.svelte";
	import {
		computeLocationScore,
		computeAlignmentScore,
		computeLocationIQRings,
		classifyThoroughfare,
	} from "$lib/re2-scores";
	import type { LocationIQRing } from "$lib/re2-scores";
	import {
		computeSegmentInsight,
		computeFitIQRings,
	} from "$lib/intel/segment-intel";
	import type { SegmentInsight, FitIQRing } from "$lib/intel/segment-intel";
	import {
		loadLaunchPadData,
		hasFounderProfile,
		hasBusinessConcept,
	} from "$lib/launchpad-store";
	import {
		fetchBlockGroupIntel,
		type BlockGroupClientResult,
	} from "../api/block-group-client";
	import VisionNarrative from "./VisionNarrative.svelte";
	import {
		getPersonaConfig,
		computePersonaScore,
		getPersonaSpokeLabels,
	} from "$lib/intel/persona-config";
	import ScoreRingHero from "./ScoreRingHero.svelte";
	import HeadsUpCards from "./HeadsUpCards.svelte";
	import CoffeeWatchOuts from "./CoffeeWatchOuts.svelte";
	import {
		generateCoffeeWatchOuts,
		type CoffeeWatchOut,
	} from "$lib/intel/coffee-watch-outs";
	import {
		getCachedCoffeeScore,
		cacheCoffeeScore,
		clearCachedCoffeeScore,
		buildCacheFromApiResponse,
	} from "$lib/stores/coffee-score-cache";
	import PersonaBars from "./PersonaBars.svelte";
	import BottomLine from "./BottomLine.svelte";
	import ResultsCoach from "./ResultsCoach.svelte";
	import BusinessModel from "./BusinessModel.svelte";
	import {
		generateHeadsUpWarnings,
		warningsFromLenses,
		type LensForWatchOut,
	} from "$lib/intel/heads-up-engine";
	import { tierFor } from "$lib/intel/tiers";

	let {
		store,
		onScoresReady,
		onBeforeSearch,
		searchOnly = false,
	}: {
		store: LocationStore;
		onScoresReady?: (scores: {
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
			fitRingsData?:
				| import("$lib/intel/segment-intel").FitIQRing[]
				| null;
			fitVerdict?: string | null;
			fitInsight?: string | null;
			dataCompleteness?: {
				available: number;
				total: number;
				pct: number;
			};
			dataVintage?: string;
			scoringTimedOut?: boolean;
		}) => void;
		onBeforeSearch?: (address: string) => Promise<boolean>;
		searchOnly?: boolean;
	} = $props();

	let searchStepTimer: ReturnType<typeof setInterval> | null = null;

	// Dual Score Rings (Layout A)
	let locationScore = $state(null);
	let alignmentScore = $state(null);
	let scoresLoading = $state(false);
	let scoreTimedOut = $state(false);

	// Segment Intelligence
	let segmentInsight = $state<SegmentInsight | null>(null);

	// B6: Address disambiguation state
	let disambigCandidates = $state<GeoCandidate[]>([]);
	let disambigResolve = $state<((candidate: GeoCandidate) => void) | null>(
		null,
	);

	// Block Group pre-computed data (instant path)
	let blockGroupData = $state<BlockGroupClientResult | null>(null);
	let blockGroupLoading = $state(false);

	// Hybrid Score Visualization & Brain 3 Multi-Engine
	let locationRings = $state<LocationIQRing[] | null>(null);
	let fitRingsData = $state<FitIQRing[] | null>(null);
	let brain3DimensionRings = $state<any[]>([]); // Brain 3 specific customized dimensions
	let fitVerdict = $state<string | null>(null);
	let fitInsight = $state<{ title: string; text: string } | null>(null);

	// Persona & Compass state  -  read from localStorage (set by onboarding flow)
	let personaType = $state("coffee");
	let personaConfig = $derived(getPersonaConfig(personaType));
	let compassScores = $state<Record<string, number>>({
		transit: 0,
		competition: 0,
		demographics: 0,
		vibrancy: 0,
		safety: 0,
		momentum: 0,
	});
	let compassBenchmarks = $state<Record<string, number>>({
		transit: 65,
		competition: 60,
		demographics: 65,
		vibrancy: 60,
		safety: 70,
		momentum: 55,
	});
	let compassCityAvg = $state<Record<string, number>>({
		transit: 60,
		competition: 55,
		demographics: 60,
		vibrancy: 55,
		safety: 55,
		momentum: 50,
	});
	let compassConfidence = $state<Record<string, number>>({
		transit: 90,
		competition: 80,
		demographics: 95,
		vibrancy: 70,
		safety: 85,
		momentum: 60,
	});
	let compassComposite = $state(0);
	let receiptsExpanded = $state(false);

	// Weight slider state  -  when user adjusts, recompute compass
	let customWeights = $state<Record<string, number> | null>(null);
	let displayComposite = $derived(
		customWeights
			? Math.round(
					Object.entries(compassScores).reduce(
						(sum, [k, v]) =>
							sum +
							v *
								((customWeights as Record<string, number>)[k] ||
									0),
						0,
					),
				)
			: compassComposite,
	);

	// Onboarding session data  -  for heads-up warnings + persona bars
	let questionAnswers = $state<Record<string, string>>({});
	let scoringHints = $state<Record<string, number>>({});
	let conceptDescription = $state("");
	let personaKey = $state("coffee");

	// B1: Map priceLevel → avgTicket + visionTier from launchpad
	const _PRICE_MAP: Record<
		string,
		{
			avgTicket: number;
			visionTier:
				| "commodity"
				| "standard"
				| "differentiated"
				| "highly_differentiated";
		}
	> = {
		"1": { avgTicket: 4.5, visionTier: "commodity" },
		"2": { avgTicket: 5.5, visionTier: "standard" },
		"3": { avgTicket: 7.5, visionTier: "differentiated" },
		"4": { avgTicket: 9.0, visionTier: "highly_differentiated" },
	};
	const _lpData = (() => {
		try {
			return JSON.parse(localStorage.getItem("re2_launchpad") || "{}");
		} catch {
			return {};
		}
	})();
	const _lpPriceLevel = _lpData.priceLevel || "";
	const _lpPriceMapped = _PRICE_MAP[_lpPriceLevel];
	const _lpAvgTicket: number =
		_lpData.avgTicket || _lpPriceMapped?.avgTicket || 5.0;
	const _lpVisionTier:
		| "commodity"
		| "standard"
		| "differentiated"
		| "highly_differentiated" =
		_lpData.visionTier || _lpPriceMapped?.visionTier || "standard";

	// Normalize display-name persona types to valid config keys
	function normalizePersonaType(pt: string): string {
		if (!pt) return "coffee";
		// Already a valid persona config key
		const validKeys = [
			"coffee",
			"restaurant",
			"gym",
			"dentist",
			"spa",
			"bodega",
			"bakery",
			"barber",
			"boutique",
			"florist",
		];
		if (validKeys.includes(pt)) return pt;
		// Map bot businessType keys, subtype keys, canonical keys AND display names to persona config keys
		const keyMap: Record<string, string> = {
			// Bot businessType keys (from onboarding BUSINESS_TYPES)
			coffee_shop: "coffee",
			fitness: "gym",
			retail: "boutique",
			bar: "restaurant", // closest persona profile
			spa_wellness: "spa",
			barbershop: "barber",
			medical_dental: "dentist",
			something_else: "coffee", // fallback for custom concepts
			// BUG-2 FIX: onboarding RESTAURANT_SUBTYPES keys
			full_service: "restaurant",
			fast_casual: "restaurant",
			quick_service: "restaurant",
			cafe_bakery: "bakery",
			// BUG-2 FIX: onboarding FITNESS_SUBTYPES keys
			boutique_studio: "gym",
			crossfit: "gym",
			big_box_gym: "gym",
			personal_training: "gym",
			// BUG-2 FIX: onboarding RETAIL_SUBTYPES keys
			clothing_boutique: "boutique",
			home_goods: "boutique",
			bookstore: "boutique",
			specialty_food: "bodega",
			beauty_retail: "barber",
			// BUG-2 FIX: canonical concept keys (written by businessTypeNormalizer / writeCanonicalConcept)
			specialty_coffee: "coffee",
			full_service_restaurant: "restaurant",
			fast_casual_restaurant: "restaurant",
			qsr: "restaurant",
			fine_dining: "restaurant",
			bar_nightlife: "restaurant", // closest persona profile
			fitness_studio: "gym",
			wellness_spa: "spa",
			juice_bar: "spa",
			wellness_beverage: "coffee",
			medical_office: "dentist",
			personal_services: "dentist",
			coworking: "boutique",
			// Display name mappings
			"Specialty Coffee/Café": "coffee",
			"Specialty Coffee / Café": "coffee",
			"Restaurant (Fast Casual)": "restaurant",
			"Restaurant (Full Service)": "restaurant",
			"Fitness / Wellness": "gym",
			"Fitness / Wellness Studio": "gym",
			"Fitness / Gym": "gym",
			"Salon / Barbershop": "spa",
			"Barbershop / Salon": "barber",
			"Professional Services": "dentist",
			"Dental / Medical": "dentist",
			"Grocery / Market": "bodega",
			"Grocery / Specialty Food": "bodega",
			Retail: "boutique",
			"Retail Store": "boutique",
			"Bar / Lounge": "restaurant",
			"Spa / Wellness": "spa",
			Other: "coffee",
		};
		return keyMap[pt] || "coffee";
	}

	// Load persona from onboarding localStorage, with fallback to launchpad bizCategory
	if (typeof window !== "undefined") {
		try {
			const stored = localStorage.getItem("re2_persona");
			if (stored) {
				const parsed = JSON.parse(stored);
				if (parsed.persona_type)
					personaType = normalizePersonaType(parsed.persona_type);
				if (parsed.question_answers)
					questionAnswers = parsed.question_answers;
				if (parsed.scoring_hints) scoringHints = parsed.scoring_hints;
				if (parsed.concept_description)
					conceptDescription = parsed.concept_description;
				// Resolve to a simple key for heads-up engine
				personaKey = resolveToKey(parsed.persona_type);
			} else {
				// Fallback: derive persona from store's bizCategory when re2_persona is missing
				const categoryToPersona: Record<string, string> = {
					coffee: "coffee",
					restaurant: "restaurant",
					fitness: "gym",
					salon: "spa",
					services: "dentist",
					grocery: "bodega",
					retail: "boutique",
					other: "coffee",
				};
				const derivedPersona =
					categoryToPersona[store.bizCategory] || "coffee";
				personaType = derivedPersona;
				personaKey = resolveToKey(derivedPersona);
			}
		} catch {
			/* use default */
		}
	}

	// Auto-fill address from URL param — check session cache before running full engine
	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const addrParam = params.get("addr");
		if (addrParam && addrParam !== "New York, NY" && addrParam.length > 3) {
			store.searchAddr = addrParam;
			// CRITICAL-2 + NET-NEW Fix B: 24h session cache — skip full re-score if address matches
			// Fix B: also match against originalAddrParam (the raw URL param) to survive geocoder address normalization
			try {
				const sess = JSON.parse(
					localStorage.getItem("re2_session") || "{}",
				);
				const CACHE_TTL = 24 * 60 * 60 * 1000;
				// FIX: guard against false cache hits via originalAddrParam when analyzedAddress is
				// a different location (different house number = definitely different address)
				const _houseNum = (s: string) => (s.match(/^\d+/) || [""])[0];
				const _exactMatch = sess.analyzedAddress === addrParam;
				const _paramMatch =
					sess.originalAddrParam === addrParam &&
					_houseNum(sess.analyzedAddress || "") ===
						_houseNum(addrParam);
				const addressMatch = _exactMatch || _paramMatch;
				const cacheHit =
					addressMatch &&
					sess.locationIQ != null &&
					sess.locationIQ > 0 &&
					sess.sixScores &&
					Date.now() - (sess.scoredAt || 0) < CACHE_TTL;
				if (cacheHit) {
					// Restore from cache — do NOT re-run the scoring engine
					setTimeout(() => {
						onScoresReady?.({
							compassScores: sess.sixScores,
							compassComposite: sess.locationIQ,
							// Use addrParam (URL form) as canonical address, not geocoded form
							address: addrParam,
							geoid: sess.geoid,
							liveIntel: undefined,
							fitSubScores: sess.fitSubScores,
							fitScore: sess.fitScore,
							serverVisionIQ: sess.serverVisionIQ,
							scoringTimedOut: false, // Cache restores don't timeout
						});
					}, 100);
					return; // skip doSearch
				}
				// Cache miss — store original URL param so next load can match it
				try {
					const s2 = JSON.parse(
						localStorage.getItem("re2_session") || "{}",
					);
					s2.originalAddrParam = addrParam;
					localStorage.setItem("re2_session", JSON.stringify(s2));
				} catch {}
			} catch {
				/* cache miss — fall through to doSearch */
			}
			// Small delay to let the store + UI settle, then auto-search
			setTimeout(() => doSearch(), 300);
		}
	});

	// Map personaKey → WeightSliders ConceptType
	function toWeightSliderConcept(pk: string): string {
		const map: Record<string, string> = {
			// Persona config keys
			coffee_shop: "specialty_coffee",
			coffee: "specialty_coffee",
			restaurant: "full_service_restaurant",
			fitness: "fitness_studio",
			gym: "fitness_studio",
			retail: "retail",
			boutique: "retail",
			florist: "retail",
			bar: "bar_nightlife",
			barbershop: "barbershop",
			barber: "barbershop",
			spa_wellness: "wellness_spa",
			spa: "wellness_spa",
			medical_dental: "medical_office",
			dentist: "medical_office",
			bodega: "specialty_food",
			bakery: "bakery",
			something_else: "full_service_restaurant",
			// BUG-2 FIX: subtype keys
			full_service: "full_service_restaurant",
			fast_casual: "fast_casual",
			quick_service: "fast_casual",
			cafe_bakery: "bakery",
			boutique_studio: "fitness_studio",
			crossfit: "fitness_studio",
			big_box_gym: "fitness_studio",
			personal_training: "fitness_studio",
			clothing_boutique: "retail",
			home_goods: "retail",
			bookstore: "retail",
			specialty_food: "specialty_food",
			beauty_retail: "barbershop",
		};
		return map[pk] || "specialty_coffee";
	}

	let weightSliderConcept = $derived(toWeightSliderConcept(personaKey));

	function resolveToKey(pt: string): string {
		if (!pt) return "coffee_shop";
		// Direct match: bot businessType keys, subtype keys, AND canonical concept keys
		const directMap: Record<string, string> = {
			// Bot BUSINESS_TYPES keys
			coffee_shop: "coffee_shop",
			restaurant: "restaurant",
			fitness: "fitness",
			bar: "bar",
			spa_wellness: "spa_wellness",
			barbershop: "barbershop",
			florist: "florist",
			medical_dental: "medical_dental",
			retail: "retail",
			something_else: "something_else",
			// BUG-2 FIX: RESTAURANT_SUBTYPES keys
			full_service: "restaurant",
			fast_casual: "restaurant",
			quick_service: "restaurant",
			cafe_bakery: "restaurant",
			// BUG-2 FIX: FITNESS_SUBTYPES keys
			boutique_studio: "fitness",
			crossfit: "fitness",
			big_box_gym: "fitness",
			personal_training: "fitness",
			// BUG-2 FIX: RETAIL_SUBTYPES keys
			clothing_boutique: "retail",
			home_goods: "retail",
			bookstore: "retail",
			specialty_food: "retail",
			beauty_retail: "barbershop",
			// BUG-2 FIX: canonical concept keys (from businessTypeNormalizer)
			specialty_coffee: "coffee_shop",
			full_service_restaurant: "restaurant",
			fast_casual_restaurant: "restaurant",
			qsr: "restaurant",
			fine_dining: "restaurant",
			bakery: "restaurant",
			bar_nightlife: "bar",
			fitness_studio: "fitness",
			wellness_spa: "spa_wellness",
			juice_bar: "spa_wellness",
			wellness_beverage: "coffee_shop",
			medical_office: "medical_dental",
			personal_services: "medical_dental",
			coworking: "something_else",
		};
		if (directMap[pt]) return directMap[pt];
		// Fuzzy match for display names and free-text
		const l = pt.toLowerCase();
		if (
			l.includes("coffee") ||
			l.includes("café") ||
			l.includes("cafe") ||
			l.includes("espresso")
		)
			return "coffee_shop";
		if (
			l.includes("bar") ||
			l.includes("lounge") ||
			l.includes("cocktail") ||
			l.includes("pub") ||
			l.includes("nightclub") ||
			l.includes("nightlife")
		)
			return "bar";
		if (
			l.includes("full service") ||
			l.includes("full_service") ||
			l.includes("fast casual") ||
			l.includes("quick service") ||
			l.includes("restaurant") ||
			l.includes("dining") ||
			l.includes("bakery") ||
			l.includes("pastry")
		)
			return "restaurant";
		if (
			l.includes("gym") ||
			l.includes("studio") ||
			l.includes("fitness") ||
			l.includes("yoga") ||
			l.includes("crossfit") ||
			l.includes("pilates") ||
			l.includes("barre") ||
			l.includes("cycling")
		)
			return "fitness";
		if (
			l.includes("dentist") ||
			l.includes("dental") ||
			l.includes("medical") ||
			l.includes("doctor")
		)
			return "medical_dental";
		if (l.includes("florist") || l.includes("flower")) return "florist";
		if (
			l.includes("spa") ||
			(l.includes("salon") && !l.includes("barber")) ||
			l.includes("wellness") ||
			l.includes("nail")
		)
			return "spa_wellness";
		if (l.includes("barber") || l.includes("grooming")) return "barbershop";
		if (
			l.includes("boutique") ||
			l.includes("retail") ||
			l.includes("fashion") ||
			l.includes("shop")
		)
			return "retail";
		return "something_else";
	}

	// Derived: Heads-up warnings
	// EF-3 (April 11): Lens → Watch Out contract.
	// Watch Out was showing "No major flags detected" while individual lenses
	// were surfacing "Concerning" / "Weak" verdicts. Founders had to click
	// into each lens to find real problems. Fix: synthesize lens slices from
	// the six-index compassScores (same values the server uses in buildLenses)
	// and auto-propagate any Weak/Concerning lens as a HeadsUpWarning.
	// Persona/universal rules win if they already covered the dimension.
	const _LENS_LABELS: Record<string, string> = {
		transit: "Transit",
		safety: "Safety",
		demographics: "Your Customers",
		competition: "Competitors",
		vibrancy: "Concept Pulse",
		momentum: "Momentum",
	};
	// EF-4: delegate to canonical tierFor — no local ternary.
	function _lensTier(score: number): LensForWatchOut["tier"] {
		return tierFor(score, "lens").label as LensForWatchOut["tier"];
	}
	let synthesizedLenses = $derived.by((): LensForWatchOut[] => {
		const out: LensForWatchOut[] = [];
		for (const dim of Object.keys(_LENS_LABELS)) {
			const score = Math.round(compassScores[dim] ?? 0);
			if (score <= 0) continue; // no data — don't fabricate a warning
			const tier = _lensTier(score);
			if (tier !== "Weak" && tier !== "Concerning") continue;
			out.push({
				dimension: dim,
				label: _LENS_LABELS[dim],
				score,
				tier,
				verdictLine: `${_LENS_LABELS[dim]} is ${score}/100 — ${
					tier === "Concerning"
						? "this is a material risk for your concept on this block."
						: "weak for your concept. You'll need to work around it."
				}`,
			});
		}
		return out;
	});
	let personaHeadsUp = $derived(
		generateHeadsUpWarnings(personaKey, questionAnswers, compassScores),
	);
	let lensPropagation = $derived(
		warningsFromLenses(synthesizedLenses, personaHeadsUp),
	);
	let headsUpWarnings = $derived([...personaHeadsUp, ...lensPropagation]);

	// C11: Coffee-specific watch-outs (W1–W10). Generator in coffee-watch-outs.ts
	// returns [] until Brain ships actual logic. When Brain wires it, the component
	// auto-populates without UX changes.
	let _watchOutsFromApi = $state<CoffeeWatchOut[]>([]);
	let coffeeWatchOuts = $derived<CoffeeWatchOut[]>(
		_watchOutsFromApi.length > 0
			? _watchOutsFromApi
			: generateCoffeeWatchOuts(
					compassScores,
					store.bizType || "",
					_lpAvgTicket,
				),
	);

	// Derived: Score verdict sentence
	// FIX-025: BR-1 unified verdict vocabulary
	// EF-4: sourced from tierFor — no local ternary.
	let verdictText = $derived(tierFor(compassComposite, "fitIQ").label);

	// Derived: Persona bars from compass scores + spoke labels
	let personaBars = $derived(
		buildPersonaBars(
			compassScores,
			getPersonaSpokeLabels(personaType),
			store.liveIntel,
		),
	);

	function buildPersonaBars(
		scores: Record<string, number>,
		labels: Record<string, string> | null,
		intel: any,
	): Array<{
		label: string;
		score: number;
		explanation: string;
		icon: string;
	}> {
		const l = labels || {
			transit: "Transit",
			competition: "Competition",
			demographics: "Demographics",
			vibrancy: "Concept Pulse",
			safety: "Safety",
			momentum: "Momentum",
		};
		const bars = [];

		// Transit
		const transitExpl = intel?.mtaRidership?.totalDailyRidership
			? `${Math.round(intel.mtaRidership.totalDailyRidership / 1000)}K daily MTA riders nearby  -  ${intel.mtaRidership.stationCount} station${intel.mtaRidership.stationCount !== 1 ? "s" : ""} within walking distance`
			: scores.transit >= 70
				? "Strong transit access for your customer base"
				: "Limited transit  -  customers will need to walk or drive";
		bars.push({
			label: l.transit,
			score: scores.transit,
			explanation: transitExpl,
			icon: "🚇",
		});

		// Competition
		const compCount =
			intel?.foursquare?.directCompetitorCount ||
			intel?.places?.totalResults ||
			0;
		const compExpl =
			compCount > 0
				? `${compCount} similar businesses within 0.3mi  -  ${scores.competition >= 70 ? "low density, room for you" : scores.competition >= 50 ? "moderate competition" : "crowded market, need a strong differentiator"}`
				: scores.competition >= 70
					? "Low competition density  -  good opportunity"
					: "Check the area for direct competitors";
		bars.push({
			label: l.competition,
			score: scores.competition,
			explanation: compExpl,
			icon: "🏪",
		});

		// Demographics — #66: thresholds extracted to named constants (TODO: make concept-specific via conceptKPIs.incomeMin)
		const INCOME_HIGH = 80000; // ≥ → 'strong spending power'
		const INCOME_MOD = 50000; // ≥ → 'moderate spending power' (below = 'budget-conscious')
		const income = intel?.census?.medianHouseholdIncome;
		const demoExpl = income
			? `Median household income $${Math.round(income / 1000)}K  -  ${income >= INCOME_HIGH ? "strong spending power" : income >= INCOME_MOD ? "moderate spending power" : "budget-conscious area"}`
			: scores.demographics >= 70
				? "Demographics align well with your concept"
				: "Demographics may be a challenge  -  verify the customer fit";
		bars.push({
			label: l.demographics,
			score: scores.demographics,
			explanation: demoExpl,
			icon: "👥",
		});

		// Vibrancy
		const vibrancyExpl =
			scores.vibrancy >= 70
				? "Active neighborhood with complementary businesses that drive foot traffic your way"
				: scores.vibrancy >= 50
					? "Some neighborhood activity  -  you may need to be a destination"
					: "Quiet area  -  you'll need strong marketing to draw people in";
		bars.push({
			label: l.vibrancy,
			score: scores.vibrancy,
			explanation: vibrancyExpl,
			icon: "â¨",
		});

		// Safety
		const crimeScore = intel?.crime?.crimeScore;
		const safetyExpl =
			crimeScore != null
				? `Safety score ${crimeScore}/100 based on NYPD data  -  ${crimeScore >= 70 ? "safe neighborhood" : crimeScore >= 50 ? "some incidents, check evening safety" : "higher incident area, visit at night before committing"}`
				: scores.safety >= 70
					? "Safe area for your business and customers"
					: "Check safety conditions, especially during your operating hours";
		bars.push({
			label: l.safety,
			score: scores.safety,
			explanation: safetyExpl,
			icon: "🛡️",
		});

		// Momentum
		const momentumExpl =
			scores.momentum >= 70
				? "Growing area  -  new permits, rising rents, and investment signals point up"
				: scores.momentum >= 50
					? "Stable area  -  not declining, not booming"
					: "Declining signals  -  verify this area is trending the right direction";
		bars.push({
			label: l.momentum,
			score: scores.momentum,
			explanation: momentumExpl,
			icon: "📈",
		});

		return bars;
	}

	function getSearchLoadingMessage(): string {
		const msgs = [
			"Finding this address...",
			"Scanning the neighborhood...",
			"Checking foot traffic & safety...",
			"Crunching the numbers...",
			"Building your report...",
		];
		return msgs[store.searchStep] || msgs[msgs.length - 1];
	}

	function clearSearch() {
		store.searching = false;
		store.searchSteps = [];
		store.searchResult = null;
		store.posData = null;
		store.searchStep = 0;
		scoreTimedOut = false;
	}

	async function doSearch() {
		if (store.searching) return;
		// Profile guard — must fire before touching any store state so input/map are preserved
		// Skip in searchOnly mode: user came via URL ?addr= param (bot-handoff), already onboarded
		if (!canAnalyze && !searchOnly) return;
		const addr = store.searchAddr.trim();
		if (!addr) {
			alert("Enter a NYC address");
			return;
		}

		// Call onBeforeSearch callback (e.g., to check for duplicates)
		// If it returns false, abort the search
		if (onBeforeSearch) {
			const shouldProceed = await onBeforeSearch(addr);
			if (!shouldProceed) return;
		}

		store.searching = true;
		store.searchSteps = [];
		store.searchResult = null;
		store.posData = null;
		store.searchStep = 0;
		scoreTimedOut = false;

		// 60s score timeout — if scoring hasn't resolved by then, show "Data unavailable"
		// Setup a 60s timeout for the entire scan
		const scoreTimeout = setTimeout(() => {
			if (!store.searchResult) {
				scoreTimedOut = true;
				console.warn(
					"[Scoring] 60s timeout  -  marking score as unavailable",
				);
			}
		}, 60000);

		if (searchStepTimer) clearInterval(searchStepTimer);
		searchStepTimer = setInterval(() => {
			if (store.searchStep < 4) store.searchStep++;
		}, 2000);

		let searchAborted = false;
		const masterTimeout = setTimeout(() => {
			searchAborted = true;
			store.stepBad(
				"Search timed out after 90 seconds. The data APIs may be slow  -  please try again.",
			);
			store.searching = false;
			if (searchStepTimer) {
				clearInterval(searchStepTimer);
				searchStepTimer = null;
			}
		}, 90000);

		try {
			store.step("Geocoding...");
			let geo = await geocode(addr);
			if (searchAborted) return;

			// B6 FIX: If address is ambiguous across boroughs, pause for user disambiguation
			if (geo.ambiguous && geo.candidates && geo.candidates.length >= 2) {
				store.stepDone("Multiple locations found — please confirm");
				disambigCandidates = geo.candidates;
				const selected = await new Promise<GeoCandidate>((resolve) => {
					disambigResolve = resolve;
				});
				disambigCandidates = [];
				disambigResolve = null;
				geo = {
					lat: selected.lat,
					lon: selected.lon,
					display: selected.display,
				};
				store.searchAddr =
					selected.display.split(",")[0] + ", " + selected.borough;
			}

			store.stepDone(`Address confirmed — ${store.searchAddr || addr}`);

			// Fire block group lookup immediately (instant path — < 2s)
			blockGroupLoading = true;
			blockGroupData = null;
			// FIX-B: Resolve concept type using the canonical normalizer (single source of truth)
			// Old local normalizeConceptType() mapped florist→retail, missed coworking, etc.
			const resolvedConcept =
				normalizeBusinessType(
					store.bizType || store.bizCategory || "specialty_coffee",
				) || "specialty_coffee";

			// Addendum §2.3: Check coffee score cache BEFORE any API calls
			if (
				resolvedConcept === "specialty_coffee" ||
				resolvedConcept === "coffee"
			) {
				const _lpCache = (() => {
					try {
						return JSON.parse(
							localStorage.getItem("re2_launchpad") || "{}",
						);
					} catch {
						return {};
					}
				})();
				const cachedCoffee = getCachedCoffeeScore(
					geo.lat,
					geo.lon,
					resolvedConcept,
					{
						avgTicket: _lpCache.avgTicket || 5.0,
						visionTier: _lpCache.visionTier || "standard",
						concept: resolvedConcept,
					},
				);
				if (cachedCoffee) {
					// Hydrate from cache — skip all API calls
					compassScores =
						cachedCoffee.dimensionScores as unknown as Record<
							string,
							number
						>;
					compassComposite = cachedCoffee.compositeScore;
					_watchOutsFromApi =
						cachedCoffee.watchOuts as CoffeeWatchOut[];
					scoresLoading = false;
					store.searching = false;
					store.searchResult = { addr } as any;
					onScoresReady?.({
						compassScores,
						compassComposite,
						address: addr,
						scoringTimedOut: false,
					});
					return; // ← fast path, no API calls
				}
			}

			const bgPromise = fetchBlockGroupIntel(
				geo.lat,
				geo.lon,
				resolvedConcept,
				addr,
			)
				.then((bg) => {
					blockGroupData = bg;
					blockGroupLoading = false;
					if (bg?.scores && bg.scores.location_iq > 0) {
						// Immediately populate compass scores from stored data
						compassScores = {
							transit: bg.scores.six_index.transit,
							competition: bg.scores.six_index.competition,
							demographics: bg.scores.six_index.demographics,
							vibrancy: bg.scores.six_index.vibrancy,
							safety: bg.scores.six_index.safety,
							momentum: bg.scores.six_index.momentum,
							// FIX-A: Include high-impact Location IQ signals so hero bars show real data
							...(bg.scores.survival_rate != null &&
							bg.scores.survival_rate > 0
								? { survivalRate: bg.scores.survival_rate }
								: {}),
							...(bg.scores.neighborhood_health != null &&
							bg.scores.neighborhood_health > 0
								? {
										neighborhoodHealth:
											bg.scores.neighborhood_health,
									}
								: {}),
						};
						compassComposite = bg.scores.location_iq;
						console.log(
							`[BlockGroup] Instant scores served: IQ=${bg.scores.location_iq}, fit=${bg.scores.fit_score || "n/a"}, survival=${bg.scores.survival_rate ?? "n/a"}, nbhd=${bg.scores.neighborhood_health ?? "n/a"}, geoid=${bg.geoid}`,
						);
						onScoresReady?.({
							compassScores,
							compassComposite,
							address: addr,
							geoid: bg.geoid,
							liveIntel: store.liveIntel as
								| Record<string, unknown>
								| undefined,
							fitSubScores: bg.scores.fit_sub_scores as
								| Record<string, number>
								| undefined,
							fitScore: bg.scores.fit_score,
							// FIX-A: Pass server Vision IQ from DB so page can prefer it over client-computed
							serverVisionIQ: bg.scores.vision_iq,
							scoringTimedOut: false, // Block group cache hits don't timeout
						});
					}
					return bg;
				})
				.catch(() => {
					blockGroupLoading = false;
					return null;
				});

			store.step("Scanning competitors, wellness & transit (live)...");
			const conceptRadius = getConceptScanRadius(store.bizCategory);
			const dataPromise = scanArea(
				geo.lat,
				geo.lon,
				conceptRadius,
				store.bizCategory,
			);
			// Race fetchLiveIntel against 20s timeout so it always settles before the 28s master abort
			// Race fetchLiveIntel against 90s timeout so it always settles before the 90s master abort
			let fallbackTimeoutId: ReturnType<typeof setTimeout>;
			const intelPromise = Promise.race([
				fetchLiveIntel(geo.lat, geo.lon, store.bizType, addr).finally(() => clearTimeout(fallbackTimeoutId)),
				new Promise<null>((resolve) =>
					fallbackTimeoutId = setTimeout(() => {
						console.warn(
							"[Scan] liveIntel 90s timeout - falling back to block group data",
						);
						resolve(null);
					}, 90000),
				),
			]);

			// Wait for both in parallel  -  competitors from Overpass, everything else from intel pipeline
			// Use allSettled so one failure (e.g. Overpass 504) does not kill the whole pipeline
			const [dataResult, intelResult] = await Promise.allSettled([
				dataPromise,
				intelPromise,
			]);
			const rawData =
				dataResult.status === "fulfilled"
					? dataResult.value
					: {
							cafes: [],
							gyms: [],
							yoga: [],
							health: [],
							stations: [],
						};
			const liveIntel =
				intelResult.status === "fulfilled" ? intelResult.value : null;
			if (dataResult.status === "rejected")
				console.warn(
					"[Scan] Overpass failed — scoring with empty competitor data",
				);
			if (intelResult.status === "rejected")
				console.warn(
					"[Scan] liveIntel failed — scoring without live data",
				);

			// Enrich scan data with MTA stations (single source of truth for transit)
			const data = enrichStationsFromMTA(rawData, liveIntel);

			store.stepDone(
				`Found ${data.cafes.length} cafes, ${data.gyms.length} gyms, ${data.yoga.length} yoga, ${data.stations.length} stations`,
			);

			if (liveIntel) {
				store.liveIntel = liveIntel;
				const liveMsg: string[] = [];
				if (liveIntel.census)
					liveMsg.push(
						`Census: $${Math.round(liveIntel.census.medianHouseholdIncome / 1000)}k income`,
					);
				if (liveIntel.crime)
					liveMsg.push(`Safety: ${liveIntel.crime.crimeScore}/100`);
				if (liveIntel.walkScore)
					liveMsg.push(`Walk: ${liveIntel.walkScore.walkScore}/100`);
				if (liveIntel.inspections)
					liveMsg.push(
						`${liveIntel.inspections.totalNearby} restaurants inspected`,
					);
				store.stepDone(liveMsg.join(" · ") || "Live data enriched");
			} else {
				store.stepDone(
					"Using neighborhood estimates (live APIs unavailable)",
				);
			}

			const sc = blockScore(data, liveIntel);
			// §FIX-BLANK: Don't set store.searchResult here — doing so makes hasResult=true
			// which destroys this component before onScoresReady fires at line ~1416.
			// Instead, save the full result and assign it AFTER the callback fires.
			const _fullResult: typeof store.searchResult = { addr, geo, data, score: sc, liveIntel } as any;
			if (searchAborted) return;
			store.layerScores = {
				...store.layerScores,
				L2: buildL2FromScan(data, sc, liveIntel),
				L3: buildL3FromGoals(
					store.targetTicket,
					store.targetTxns,
					store.targetRevY1,
					store.targetSDE,
				),
			};

			// Use MTA ridership for commute score when available
			let commScore: number;
			let commValue: string;
			let commDetail: string;
			if (
				liveIntel?.mtaRidership &&
				liveIntel.mtaRidership.totalDailyRidership > 0
			) {
				const daily = liveIntel.mtaRidership.totalDailyRidership;
				commScore = liveIntel.mtaRidership.transitScore;
				commValue = Math.round(daily / 1000) + "K daily riders";
				commDetail =
					daily.toLocaleString() +
					" daily MTA riders (" +
					liveIntel.mtaRidership.stationCount +
					" stations)";
			} else {
				commScore = Math.min(95, 50 + data.stations.length * 12);
				commValue = data.stations.length + " stations";
				commDetail =
					data.stations.length + " stations makes commuting easy";
			}
			const updatedL4 = { ...store.layerScores.L4 };
			updatedL4.factors = [...updatedL4.factors];
			updatedL4.factors[1] = {
				name: "Commute Feasibility",
				value: commValue,
				score: commScore,
				detail: commDetail,
				override: null,
			};
			// Employee Safety from crime data
			if (liveIntel?.crime) {
				const crimeScore = liveIntel.crime.crimeScore;
				updatedL4.factors[2] = {
					name: "Employee Safety",
					value: crimeScore + "/100",
					score: crimeScore,
					detail: `Safety score based on NYPD crime data (${liveIntel.crime.totalIncidents} incidents in area)`,
					override: null,
				};
			}
			store.layerScores = { ...store.layerScores, L4: updatedL4 };

			// Update L6 (Building & Site Risk) from DOB, 311, scaffolding data
			if (liveIntel) {
				const updatedL6 = { ...store.layerScores.L6 };
				updatedL6.factors = [...updatedL6.factors];
				if (liveIntel.dob) {
					const violations = liveIntel.dob.totalViolations || 0;
					const dobScore =
						violations === 0
							? 90
							: violations <= 3
								? 70
								: violations <= 10
									? 50
									: 30;
					updatedL6.factors[1] = {
						name: "DOB Violations",
						value: violations + " violations",
						score: dobScore,
						detail: `${violations} DOB violations within 200m; ${liveIntel.dob.activePermits || 0} active permits`,
						override: null,
					};
				}
				if (liveIntel.complaints311) {
					const complaints =
						liveIntel.complaints311.totalComplaints || 0;
					const noiseScore =
						complaints <= 5
							? 85
							: complaints <= 15
								? 65
								: complaints <= 30
									? 45
									: 30;
					updatedL6.factors[2] = {
						name: "Area Complaints",
						value: complaints + " recent",
						score: noiseScore,
						detail: `${complaints} 311 complaints nearby (noise, sidewalk, construction)`,
						override: null,
					};
				}
				store.layerScores = { ...store.layerScores, L6: updatedL6 };
			}

			store.step("Checking how well this matches your concept...");
			// Use Nominatim display name for better neighborhood matching (includes actual neighborhood)
			const fullAddr = geo.display || addr;
			store.vlfData = calculateVLF(
				data,
				store.vision,
				{
					bizType: store.bizType,
					targetRevY1: store.targetRevY1,
					location: fullAddr,
				},
				liveIntel,
			);
			store.stepDone("Vision fit: " + store.vlfData.vlf + "/100");

			store.step("Analyzing financial feasibility...");
			store.glfData = calculateGLF(
				data,
				{
					bizType: store.bizType,
					targetTicket: store.targetTicket,
					targetTxns: store.targetTxns,
					targetRevY1: store.targetRevY1,
					numLocations: store.numLocations,
					estimatedRent: store.estimatedRent || undefined,
					searchAddr: fullAddr,
				},
				{ lcs: store.lcs },
				liveIntel
					? {
							mtaDailyRidership:
								liveIntel.mtaRidership?.totalDailyRidership,
							pedestrianCount:
								liveIntel.pedestrian?.totalPedestrians,
							pedestrianScore:
								liveIntel.pedestrian?.footTrafficScore,
						}
					: null,
			);
			store.stepDone(
				"Financial feasibility: " + store.glfData.glf + "/100",
			);

			store.step("Assessing risks...");
			store.rrData = calculateRR(data, {
				differentiator: store.differentiator,
				liveIntel,
				searchAddr: fullAddr,
				lcs: store.lcs,
				vision: store.vision,
				estimatedRent: store.estimatedRent || undefined,
				targetRevY1: store.targetRevY1,
			});
			store.stepDone("Risk assessment: " + store.rrData.rr + "/100");

			store.step("Scoring your location...");
			const completeness =
				data.cafes.length > 0 && data.stations.length > 0
					? "Full"
					: "Moderate";
			store.posData = calculatePoS(
				store.vlfData.vlf,
				store.glfData.glf,
				store.rrData.rr,
				completeness,
			);
			store.stepDone(
				`Score: ${store.posData.base}/100  -  ${store.posData.verdict}`,
			);

			// Compute dual rings (Location IQ + Fit IQ)
			scoresLoading = true;
			try {
				if (liveIntel) {
					// Cache intel for Recommendations page
					localStorage.setItem(
						"re2_location_intel",
						JSON.stringify(liveIntel),
					);
					localStorage.setItem(
						"re2_selected_location",
						JSON.stringify({ lat: geo.lat, lng: geo.lon, addr }),
					);

					const categoryId = store.bizType || "coffee";
					locationScore = computeLocationScore(liveIntel, categoryId);

					// Only compute Fit IQ if the user has filled in their profile
					if (hasFounderProfile()) {
						const lpData = loadLaunchPadData();
						const founderProfile = {
							monthlyRent:
								lpData?.financialGoals?.monthlyRentBudget ||
								undefined,
							riskTolerance:
								lpData?.founderProfile?.riskTolerance ||
								undefined,
							businessType: lpData?.businessType || undefined,
							format: lpData?.businessFormat || undefined,
						};
						alignmentScore = computeAlignmentScore(
							locationScore,
							founderProfile,
							liveIntel,
						);
					} else {
						// No profile â show null Fit IQ (UI will show "Complete your profile")
						alignmentScore = null;
					}

					// Compute Location IQ Rings (4-ring model)
					try {
						locationRings = computeLocationIQRings(
							locationScore,
							liveIntel,
						);
					} catch (e) {
						console.warn("Location IQ rings error:", e);
						locationRings = null;
					}

					// Compute Fit IQ Rings (business-specific 4-ring model)
					try {
						const fitResult = computeFitIQRings(
							liveIntel,
							store.bizType,
						);
						fitRingsData = fitResult.rings;
						fitVerdict = fitResult.verdict;
						fitInsight = fitResult.insight;
					} catch (e) {
						console.warn("Fit IQ rings error:", e);
						fitRingsData = null;
						fitVerdict = null;
						fitInsight = null;
					}

					// Compute Segment Intelligence (business-specific hero metrics)
					try {
						segmentInsight = computeSegmentInsight(
							liveIntel,
							store.bizType,
						);
					} catch (e) {
						console.warn("Segment insight error:", e);
						segmentInsight = null;
					}
				} else {
					// No live data  -  locationScore stays null, VerdictCard shows loading state
					console.warn(
						"[Scoring] No liveIntel available  -  skipping Location IQ computation",
					);
					locationScore = null;
					alignmentScore = null;
				}
			} catch (e) {
				console.warn("Could not compute RE² scores:", e);
			}
			scoresLoading = false;
			clearTimeout(scoreTimeout);

			// Populate Compass data from six-index scores
			try {
				if (liveIntel) {
					// 04.22.2026 PREVIEW-ONLY: This client-side runIQScore call produces
					// PREVIEW compass scores for instant UI feedback. These scores are
					// missing precomputed block_group_scores (neighborhoodHealth, survivalRate)
					// and the live survival rate overlay, so they will differ from the
					// canonical server scores computed by buildLocationScoreBundle().
					//
					// The parent page MUST overwrite these preview scores when the full
					// GET /api/location-iq response arrives (via loadLocationIqEnvelope).
					// Do NOT persist these preview scores to localStorage or Cloud SQL
					// as the user's canonical score.
					//
					// TODO: When loadLocationIqEnvelope response arrives, overwrite
					// compassScores and compassComposite with server sixIndex values
					// so persistence always uses the server's canonical computation.
					const { runIQScore } = await import(
						"$lib/intel/scoring/iq-score"
					);
					const sixReport = runIQScore({
						report: liveIntel,
						businessType: store.bizCategory || "coffee",
						precomputed: undefined,
						visionTier: _lpVisionTier,
						avgTicket: _lpAvgTicket,
					});
					if (sixReport?.indices) {
						const idx = sixReport.indices;
						compassScores = {
							transit: idx.transit?.score ?? 0,
							competition: idx.competition?.score ?? 0,
							demographics: idx.demographics?.score ?? 0,
							vibrancy: idx.vibrancy?.score ?? 0,
							safety: idx.safety?.score ?? 0,
							momentum: idx.momentum?.score ?? 0,
						};
						// Compute persona-weighted composite
						compassComposite = computePersonaScore(
							personaType,
							compassScores,
						);
						// FIX-A (live path): Include high-impact signals + serverVisionIQ from block group cache
						const bgScores = blockGroupData?.scores;
						const livePathCompassScores = {
							...compassScores,
							...(bgScores?.survival_rate != null &&
							bgScores.survival_rate > 0
								? { survivalRate: bgScores.survival_rate }
								: {}),
							...(bgScores?.neighborhood_health != null &&
							bgScores.neighborhood_health > 0
								? {
										neighborhoodHealth:
											bgScores.neighborhood_health,
									}
								: {}),
						};
						// BR-13: compute overall dataCompleteness from per-index source coverage
						const _allIndices = Object.values(sixReport.indices);
						const _totalAvail = _allIndices.reduce(
							(s, i) => s + i.dataSources,
							0,
						);
						const _totalSrcs = _allIndices.reduce(
							(s, i) => s + i.totalSources,
							0,
						);
						const _dataCompleteness = {
							available: _totalAvail,
							total: _totalSrcs,
							pct:
								_totalSrcs > 0
									? Math.round(
											(_totalAvail / _totalSrcs) * 100,
										)
									: 0,
						};
						// BR-14: dataVintage = source data vintage (Census ACS + Google Places last bulk refresh).
						// This is the period the underlying datasets represent, NOT the run date.
						// Update this string when data sources are refreshed to a newer vintage.
						const _dataVintage = "2024-Q4";
						onScoresReady?.({
							compassScores: livePathCompassScores,
							compassComposite,
							address: addr,
							geoid: blockGroupData?.geoid,
							liveIntel: store.liveIntel as
								| Record<string, unknown>
								| undefined,
							segmentInsight,
							fitRingsData,
							fitVerdict,
							fitInsight,
							fitSubScores: bgScores?.fit_sub_scores as
								| Record<string, number>
								| undefined,
							fitScore: bgScores?.fit_score,
							serverVisionIQ: bgScores?.vision_iq,
							dataCompleteness: _dataCompleteness, // BR-13
							dataVintage: _dataVintage, // BR-14
							scoringTimedOut: scoreTimedOut, // Pass timeout flag so parent can show error state
						});

						// §FIX-BLANK: Now that onScoresReady has fired with real scores,
						// set the full result so hasResult flips to true with locationIQ already > 0.
						if (!store.searchResult) store.searchResult = _fullResult;

						// Addendum §2.3 Step 3: Cache coffee score after fresh computation
						if (
							resolvedConcept === "specialty_coffee" ||
							resolvedConcept === "coffee"
						) {
							try {
								const _lpCacheWrite = (() => {
									try {
										return JSON.parse(
											localStorage.getItem(
												"re2_launchpad",
											) || "{}",
										);
									} catch {
										return {};
									}
								})();
								const apiLikeResponse = {
									locationIQ: compassComposite,
									grade: "",
									verdict: "",
									coffeeDimensions: {
										morningFootTraffic:
											compassScores.transit ?? 0,
										dailyRitualDensity:
											compassScores.vibrancy ?? 0,
										competitionContext:
											compassScores.competition ?? 0,
										streetSide: compassScores.safety ?? 0,
										demographicsFit:
											compassScores.demographics ?? 0,
										baseViability:
											compassScores.momentum ?? 0,
										visionMultiplier:
											(
												{
													commodity: 0.9,
													standard: 1.0,
													differentiated: 1.05,
													highly_differentiated: 1.1,
												} as Record<string, number>
											)[_lpCacheWrite.visionTier] ?? 1.0,
									},
									coffeeWatchOuts: coffeeWatchOuts,
								};
								const cacheEntry = buildCacheFromApiResponse(
									apiLikeResponse,
									_lpCacheWrite.avgTicket || 5.0,
									_lpCacheWrite.visionTier || "standard",
									resolvedConcept,
								);
								if (cacheEntry)
									cacheCoffeeScore(
										geo.lat,
										geo.lon,
										resolvedConcept,
										cacheEntry,
									);
							} catch (e) {
								console.warn("[Coffee Cache] write failed:", e);
							}
						}

						// Compute confidence from source coverage per index
						const confFromSources = (idx_entry: {
							dataSources: number;
							totalSources: number;
						} | undefined) =>
							idx_entry && idx_entry.totalSources > 0
								? Math.round(
										(idx_entry.dataSources /
											idx_entry.totalSources) *
											100,
									)
								: 50;
						compassConfidence = {
							transit: confFromSources(idx.transit),
							competition: confFromSources(idx.competition),
							demographics: confFromSources(idx.demographics),
							vibrancy: confFromSources(idx.vibrancy),
							safety: confFromSources(idx.safety),
							momentum: confFromSources(idx.momentum),
						};
					}
				}
			} catch (e) {
				console.warn("Compass data error:", e);
			}

			// PostMessage for map integration  -  send ALL competitor types so map shows gyms, yoga, etc.
			// Also include liveIntel competitor sources so the page can extract from all 4 sources
			try {
				const allCompetitors = [
					...data.cafes.map((c) => ({ ...c, type: "Cafe" })),
					...data.gyms.map((c) => ({ ...c, type: "Gym" })),
					...data.yoga.map((c) => ({ ...c, type: "Yoga" })),
					...data.health.map((c) => ({ ...c, type: "Health" })),
				];
				// Merge in liveIntel competitors (Google Places, Yelp, Foursquare/Overpass amenities)
				if (liveIntel) {
					const liAm = (liveIntel as any)?.competitors?.amenities;
					if (liAm) {
						for (const c of liAm.cafes || []) {
							if (c.lat && c.lng)
								allCompetitors.push({ ...c, type: "Cafe" });
						}
						for (const c of liAm.restaurants || []) {
							if (c.lat && c.lng)
								allCompetitors.push({
									...c,
									type: "Restaurant",
								});
						}
						for (const c of liAm.gyms || []) {
							if (c.lat && c.lng)
								allCompetitors.push({ ...c, type: "Gym" });
						}
					}
					const liPlaces = (liveIntel as any)?.places;
					const pArr = Array.isArray(liPlaces)
						? liPlaces
						: liPlaces?.places || [];
					for (const p of pArr) {
						if (p.lat && p.lng)
							allCompetitors.push({ ...p, type: "Competitor" });
					}
					const liYelp = (liveIntel as any)?.yelp?.directCompetitors;
					if (liYelp) {
						for (const c of liYelp) {
							if (c.lat && c.lng)
								allCompetitors.push({
									...c,
									type: "Competitor",
								});
						}
					}
				}
				window.parent.postMessage(
					{
						type: "re2-search-result",
						lat: geo.lat,
						lon: geo.lon,
						cafes: allCompetitors,
						stations: data.stations,
						address: addr,
					},
					"*",
				);
			} catch (e) {
				/* ignore */
			}
			// §FIX-BLANK: Fallback — if scoring path never set store.searchResult
			// (e.g. liveIntel=null, sixReport.indices falsy, or compass try-catch swallowed error),
			// set it now so the user at least sees the scored state (even with blank scores).
			if (!store.searchResult) {
				store.searchResult = _fullResult;
				onScoresReady?.({
					compassScores: compassScores || {},
					compassComposite: compassComposite || 0,
					address: addr,
					scoringTimedOut: true,
				});
			}
		} catch (e: unknown) {
			if (!searchAborted)
				store.stepBad(
					"Error: " + (e instanceof Error ? e.message : String(e)),
				);
		}

		clearTimeout(masterTimeout);
		clearTimeout(scoreTimeout);
		if (searchStepTimer) {
			clearInterval(searchStepTimer);
			searchStepTimer = null;
		}
		store.searching = false;
		store.searchStep = 0;
	}

	// Check if user has completed prerequisites
	let profileComplete = $state(false);
	let conceptComplete = $state(false);

	$effect(() => {
		if (typeof window !== "undefined") {
			profileComplete = hasFounderProfile();
			conceptComplete = hasBusinessConcept();
		}
	});

	// In searchOnly mode (bot-handoff via ?addr= URL), bypass the profile/concept guard.
	// The user already completed onboarding to land here — blocking on localStorage state
	// causes a blank page when session data hasn't hydrated yet on a fresh prod load.
	let canAnalyze = $derived(searchOnly || (profileComplete && conceptComplete));

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") doSearch();
	}

	function updateLCS() {
		store.lcs = calculateLCS({
			tiCredit: store.tiCredit,
			trackRecord: store.trackRecord,
			rentAbatement: store.rentAbatement,
			percentRent: store.percentRent,
			pgWaiver: store.pgWaiver,
			sublease: store.sublease,
			activeInvestment: store.activeInvestment,
			bidMember: store.bidMember,
			coInvestment: store.coInvestment,
		});
	}

	// Derived values
	let r = $derived(store.searchResult);
	let sc = $derived(r?.score);
	let commentary = $derived(
		r && store.posData
			? generateCommentary(
					r,
					store.vision,
					{
						targetSDE: store.targetSDE,
						targetTxns: store.targetTxns,
					},
					computeComposite(
						store.layerScores as Record<
							string,
							{
								score: number;
								factors: Array<{
									score: number;
									override: number | null;
								}>;
							}
						>,
						store.weights,
					),
				)
			: "",
	);
</script>

<div class="section">
	{#if searchOnly}
		<!-- Bot handoff: minimal analyzing spinner, no search bar or gate -->
		{#if store.searching}
			<div
				style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 20px;gap:16px"
			>
				<div
					style="width:40px;height:40px;border:3px solid #E5E7EB;border-top-color:#2d5a27;border-radius:50%;animation:spin 1s linear infinite"
				></div>
				<div style="font-size:15px;color:#6B7280;font-weight:500">
					Analyzing your location…
				</div>
				<div style="font-size:13px;color:#9CA3AF">
					{store.searchAddr || "Scanning 20 data sources"}
				</div>
			</div>
		{/if}
		{#if store.searchSteps?.length}
			<SearchSteps
				steps={store.searchSteps}
				searchStep={store.searchStep}
				searching={store.searching}
			/>
		{/if}
	{:else if !canAnalyze}
		<div class="gate-message">
			<div class="gate-icon">📋</div>
			<div class="gate-text">
				<h3>Complete your profile first</h3>
				<p>
					Before analyzing a location, we need to understand your
					business so we can give you personalized scores.
				</p>
				<div class="gate-steps">
					<a
						href="/app/vision/founder"
						class="gate-step"
						class:done={profileComplete}
					>
						<span class="gate-check"
							>{profileComplete ? "â" : "1"}</span
						>
						<span>Your Profile</span>
					</a>
					<a
						href="/app/vision/concept"
						class="gate-step"
						class:done={conceptComplete}
					>
						<span class="gate-check"
							>{conceptComplete ? "â" : "2"}</span
						>
						<span>Concept & Goals</span>
					</a>
				</div>
			</div>
		</div>
	{/if}

	<div
		class="search-area"
		class:hero-mode={!r && canAnalyze}
		style={searchOnly ? "display:none" : ""}
	>
		<div class="search-bar" class:searching={store.searching}>
			<span class="search-icon">
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					><circle cx="11" cy="11" r="8" /><line
						x1="21"
						y1="21"
						x2="16.65"
						y2="16.65"
					/></svg
				>
			</span>
			<input
				type="text"
				placeholder="e.g. 200 Broadway or 86-01 Roosevelt Ave, Queens, NY"
				bind:value={store.searchAddr}
				onkeydown={handleKeydown}
				class="search-input"
				disabled={!canAnalyze}
			/>
			<button
				class="btn-analyze"
				onclick={doSearch}
				disabled={store.searching || !canAnalyze}
			>
				{#if store.searching}
					<span class="analyze-spinner"></span>
					Analyzing...
				{:else}
					Analyze
				{/if}
			</button>
		</div>
		{#if disambigCandidates.length >= 2}
			<div class="disambig-panel">
				<div class="disambig-title">Which location did you mean?</div>
				<div class="disambig-subtitle">
					This address exists in multiple boroughs
				</div>
				<div class="disambig-options">
					{#each disambigCandidates as candidate}
						<button
							class="disambig-btn"
							onclick={() => disambigResolve?.(candidate)}
						>
							<span class="disambig-borough"
								>{candidate.borough}</span
							>
							<span class="disambig-addr"
								>{candidate.display
									.split(",")
									.slice(0, 2)
									.join(",")}</span
							>
						</button>
					{/each}
				</div>
			</div>
		{/if}
		{#if !r && canAnalyze && !store.searching}
			<div class="search-hints">
				<span class="hint-label">Try:</span>
				<button
					class="hint-chip"
					onclick={() => {
						store.searchAddr = "200 Broadway, New York, NY";
						doSearch();
					}}>200 Broadway</button
				>
				<button
					class="hint-chip"
					onclick={() => {
						store.searchAddr = "75 9th Ave, New York, NY";
						doSearch();
					}}>Chelsea Market</button
				>
				<button
					class="hint-chip"
					onclick={() => {
						store.searchAddr = "234 Smith St, Brooklyn, NY";
						doSearch();
					}}>Cobble Hill</button
				>
			</div>
		{/if}
		{#if !r && canAnalyze}
			<div class="category-tabs">
				<span class="cat-tab">🚶 Walk</span>
				<span class="cat-tab">🚇 Ride</span>
				<span class="cat-tab">🛡️ Crime</span>
				<span class="cat-tab">👥 Foot Traffic</span>
				<span class="cat-tab">🏪 Competition</span>
				<span class="cat-tab">📈 Growth</span>
			</div>
		{/if}
		{#if store.searching}
			<SearchSteps
				steps={store.searchSteps}
				searchStep={store.searchStep}
				searching={store.searching}
				onRetry={clearSearch}
			/>
		{/if}
	</div>

	{#if r && sc && !searchOnly}
		<!-- HERO: Score Ring  -  the big number, one-second verdict -->
		{#if compassComposite > 0}
			<ScoreRings
				locationScore={displayComposite}
				fitScore={computePersonaScore(personaType, compassScores) ??
					displayComposite}
				locationSubScores={compassScores}
				fitSubScores={compassScores}
				spokeLabels={getPersonaSpokeLabels(personaType)}
				{personaType}
				conceptShort={conceptDescription ||
					personaConfig?.label ||
					store.bizType ||
					"your concept"}
			/>
		{:else}
			<!-- Fallback: old hybrid score while compass loads -->
			<div class="score-rings-section">
				<ScoreHybrid
					{locationScore}
					{alignmentScore}
					loading={scoresLoading}
					bizType={store.bizType}
					{locationRings}
					fitRings={fitRingsData}
					verdict={fitVerdict}
					insight={fitInsight}
				/>
			</div>
		{/if}

		<!-- FIT DIMENSION RINGS -- concept-specific sub-scores below the main rings -->
		{#if brain3DimensionRings.length > 0}
			<FitDimensionRings rings={brain3DimensionRings} bizType={store.bizType} />
		{:else if fitRingsData && fitRingsData.length > 0}
			<FitDimensionRings rings={fitRingsData} bizType={store.bizType} />
		{/if}

		<!-- C11: Coffee watch-outs — business viability flags (distinct from build-out HeadsUp) -->
		<CoffeeWatchOuts watchOuts={coffeeWatchOuts} bizType={store.bizType} />

		<!-- HEADS UP  -  warning cards between score and bars -->
		{#if headsUpWarnings.length > 0}
			<HeadsUpCards
				{personaKey}
				{questionAnswers}
				scoringData={compassScores}
			/>
		{/if}

		<!-- RECOMMENDATION CARDS -- 6 Q&A cards explaining key data findings -->
		{#if store.vlfData || store.glfData || store.rrData || store.posData}
			<RecommendationCards
				vlfData={store.vlfData}
				glfData={store.glfData}
				rrData={store.rrData}
				posData={store.posData}
				liveIntel={store.liveIntel}
				data={r.data}
				score={sc}
			/>
		{/if}

		<!-- SMART COACH -- interactive Q&A bot guiding the user through scores -->
		{#if compassComposite > 0}
			<SmartCoach
				compositeScore={displayComposite}
				fitScore={computePersonaScore(personaType, compassScores) ??
					displayComposite}
				{compassScores}
				bizType={store.bizType}
				{conceptDescription}
				address={r.addr}
				liveIntel={store.liveIntel}
				{headsUpWarnings}
				vlfData={store.vlfData}
				glfData={store.glfData}
				rrData={store.rrData}
				posData={store.posData}
			/>
		{/if}

		<!-- RESULTS COACH  -  data-driven commentary explaining what the scores mean -->
		{#if store.liveIntel && locationScore}
			<ResultsCoach
				liveIntel={store.liveIntel}
				{locationScore}
				{alignmentScore}
				{compassScores}
				bizType={store.bizType}
				searchAddr={r.addr}
			/>
		{/if}

		<!-- PERSONA BARS  -  horizontal progress bars with plain-English explanations -->
		{#if compassComposite > 0 && personaBars.length > 0}
			<PersonaBars bars={personaBars} {personaKey} />
		{/if}

		<!-- BOTTOM LINE  -  AI-generated synthesis verdict -->
		{#if compassComposite > 0}
			<BottomLine
				{personaType}
				{conceptDescription}
				address={r.addr}
				compositeScore={displayComposite}
				scores={compassScores}
				spokeLabels={getPersonaSpokeLabels(personaType)}
				warnings={headsUpWarnings}
				liveIntel={store.liveIntel}
			/>
		{/if}

		<!-- BUSINESS MODEL  -  ESPN Next Gen Stats style probability + financials -->
		{#if compassComposite > 0}
			<BusinessModel
				{personaType}
				{conceptDescription}
				compositeScore={displayComposite}
				scores={compassScores}
				{headsUpWarnings}
				liveIntel={store.liveIntel}
			/>
		{/if}

		<!-- DATA COVERAGE  -  Shows which sources responded and which failed -->
		{#if store.liveIntel}
			<DataCoverage liveIntel={store.liveIntel} />
		{/if}

		<!-- VISION NARRATIVE — Pre-computed block group vision (Character, Gaps, Opportunities, Momentum) -->
		{#if blockGroupData?.vision}
			<VisionNarrative
				vision={blockGroupData.vision}
				borough={blockGroupData.borough}
				geoid={blockGroupData.geoid}
				locationIQ={blockGroupData.scores?.location_iq || 0}
			/>
		{/if}
		<!-- THE BRIEF  -  AI-generated coaching narrative -->
		{#if compassComposite > 0}
			<TheBrief
				{personaType}
				conceptDescription={store.vision || personaConfig.label}
				address={r.addr}
				compositeScore={displayComposite}
				scores={compassScores}
				spokeLabels={getPersonaSpokeLabels(personaType)}
				confidence={compassConfidence}
				liveIntel={store.liveIntel}
			/>
		{/if}

		<!-- WEIGHT CALIBRATION SLIDERS  -  adjust priorities, recompute Compass -->
		{#if compassComposite > 0}
			<div class="sliders-section">
				<WeightSliders
					conceptType={weightSliderConcept}
					onchange={() => {
						compassComposite = computePersonaScore(
							personaType,
							compassScores,
						);
					}}
				/>
			</div>
		{/if}

		<!-- THE RECEIPTS  -  transparency panel -->
		{#if compassComposite > 0}
			<TheReceipts
				scores={compassScores}
				spokeLabels={getPersonaSpokeLabels(personaType)}
				confidence={compassConfidence}
				liveIntel={store.liveIntel}
				{personaType}
				bind:expanded={receiptsExpanded}
				allSectionsLoaded={!scoresLoading}
			/>
		{/if}

		<!-- Old Layers 1-4 removed: duplicate VerdictCard, KeySignals, RecommendationCards, DeepDive, VacancyListings -->
	{/if}
</div>

<style>
	/* ââ SLIDERS SECTION ââ */
	.sliders-section {
		margin-bottom: 16px;
	}

	/* ââ THE COMPASS SECTION ââ */
	.compass-section {
		background: var(--bg, #f6f8fb);
		border-radius: 16px;
		padding: 32px 24px;
		margin-bottom: 16px;
		text-align: center;
	}
	.compass-persona-header {
		margin-bottom: 16px;
	}
	.persona-badge {
		display: inline-block;
		padding: 4px 14px;
		background: rgba(74, 124, 92, 0.12);
		color: #4a7c5c;
		font-size: 13px;
		font-weight: 600;
		border-radius: 20px;
		letter-spacing: 0.3px;
		margin-bottom: 8px;
	}
	.persona-tagline {
		color: var(--text, #1a202c);
		font-size: 18px;
		font-weight: 500;
		margin: 0;
		letter-spacing: -0.2px;
	}

	/* ââ APPLE-INSPIRED LIGHT DESIGN ââ */

	.section {
		background: var(--surface, #ffffff);
		border: 1px solid var(--border, #e0e5ed);
		border-radius: 12px;
		padding: 24px;
		margin-bottom: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	/* ââ HERO SECTION ââ */
	.hero {
		text-align: center;
		padding: 8px 0 4px;
	}

	.hero-badge {
		display: inline-block;
		padding: 4px 14px;
		background: rgba(74, 124, 92, 0.08);
		color: #4a7c5c;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.3px;
		margin-bottom: 12px;
	}

	.hero-title {
		font-size: 28px;
		font-weight: 700;
		color: var(--text, #1a202c);
		margin: 0 0 8px;
		letter-spacing: -0.5px;
		line-height: 1.2;
	}

	.hero-sub {
		font-size: 15px;
		color: var(--text-secondary, #5a6578);
		line-height: 1.5;
		max-width: 560px;
		margin: 0 auto;
	}

	/* ââ SEARCH BAR ââ */
	.search-area {
		padding: 0;
		margin-bottom: 16px;
	}

	.search-area.hero-mode {
		margin-top: 20px;
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: 0;
		background: var(--surface, #ffffff);
		border: 2px solid var(--border, #e0e5ed);
		border-radius: 14px;
		overflow: hidden;
		transition: all 0.2s ease;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
	}

	.search-bar:focus-within {
		border-color: #4a7c5c;
		box-shadow: 0 4px 16px rgba(74, 124, 92, 0.12);
	}

	.search-bar.searching {
		border-color: #f59e0b;
		box-shadow: 0 4px 16px rgba(245, 158, 11, 0.12);
	}

	.search-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 4px 0 16px;
		color: var(--text-dim, #8b92a6);
		flex-shrink: 0;
	}

	.search-bar:focus-within .search-icon {
		color: #4a7c5c;
	}

	.search-input {
		flex: 1;
		min-width: 0;
		font-size: 16px;
		padding: 14px 12px;
		background: transparent;
		font-family: inherit;
		outline: none;
		border: none;
		color: var(--text, #1a202c);
	}

	.search-input::placeholder {
		color: var(--text-dim, #8b92a6);
	}

	.btn-analyze {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 24px;
		margin: 4px;
		background: #1a3a2a;
		color: #ffffff;
		border: none;
		border-radius: 10px;
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		white-space: nowrap;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.btn-analyze:hover:not(:disabled) {
		background: #243f30;
	}

	.btn-analyze:active:not(:disabled) {
		background: #0f2218;
		transform: scale(0.98);
	}

	.btn-analyze:disabled {
		background: var(--border, #e0e5ed);
		color: var(--text-dim, #8b92a6);
		cursor: not-allowed;
	}

	.analyze-spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: #ffffff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ââ SEARCH HINTS ââ */
	.search-hints {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.hint-label {
		font-size: 12px;
		color: #a1a1a6;
		font-weight: 500;
	}

	.hint-chip {
		padding: 5px 14px;
		background: #f5f5f7;
		border: 1px solid #e5e5ea;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 500;
		color: #1d1d1f;
		cursor: pointer;
		transition: all 0.15s ease;
		font-family: inherit;
	}

	.hint-chip:hover {
		border-color: #4a7c5c;
		color: #4a7c5c;
		background: rgba(74, 124, 92, 0.06);
	}

	/* ââ CATEGORY TABS ââ */
	.category-tabs {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-top: 14px;
		flex-wrap: wrap;
	}

	.cat-tab {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 5px 12px;
		background: rgba(0, 0, 0, 0.03);
		border: 1px solid rgba(0, 0, 0, 0.06);
		border-radius: 20px;
		font-size: 12px;
		font-weight: 500;
		color: #6e6e73;
		white-space: nowrap;
	}

	/* Legacy btn class for other uses */
	.btn {
		padding: 10px 20px;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 500;
		color: var(--text);
		cursor: pointer;
		font-family: inherit;
		border: none;
		transition: background-color 0.15s ease;
	}

	/* Gate Message */
	.gate-message {
		display: flex;
		gap: 16px;
		padding: 20px;
		background: #fff8e1;
		border: 1px solid #ffe082;
		border-radius: 12px;
		margin-bottom: 16px;
		align-items: flex-start;
	}

	.gate-icon {
		font-size: 28px;
		flex-shrink: 0;
	}

	.gate-text h3 {
		margin: 0 0 6px 0;
		font-size: 16px;
		font-weight: 600;
		color: #1d1d1f;
	}

	.gate-text p {
		margin: 0 0 12px 0;
		font-size: 14px;
		color: #6e6e73;
		line-height: 1.5;
	}

	.gate-steps {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	.gate-step {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: #fff;
		border: 1px solid #d2d2d7;
		border-radius: 8px;
		text-decoration: none;
		color: #4a7c5c;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.15s ease;
	}

	.gate-step:hover {
		border-color: #4a7c5c;
		background: rgba(74, 124, 92, 0.06);
	}

	.gate-step.done {
		border-color: #4a7c5c;
		color: #4a7c5c;
	}

	.gate-check {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #1a3a2a;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 700;
	}

	.gate-step.done .gate-check {
		background: #4a7c5c;
	}

	/* ââ MOBILE ââ */
	@media (max-width: 640px) {
		.section {
			padding: 16px;
			border-radius: 10px;
		}

		.hero-title {
			font-size: 22px;
		}

		.hero-sub {
			font-size: 14px;
		}

		.search-bar {
			flex-wrap: wrap;
			border-radius: 12px;
		}

		.search-input {
			width: 100%;
			flex: 1 1 100%;
			padding: 12px 12px;
			font-size: 16px;
		}

		.btn-analyze {
			width: calc(100% - 8px);
			margin: 0 4px 4px;
			justify-content: center;
			padding: 12px 16px;
			font-size: 15px;
		}

		.search-icon {
			padding: 0 4px 0 12px;
		}

		.btn {
			width: 100%;
			padding: 12px 16px;
			font-size: 14px;
			text-align: center;
		}

		.gate-steps {
			flex-direction: column;
		}
	}

	/* Dual Score Rings */
	.score-rings-section {
		margin-bottom: 16px;
	}

	/* Action Bar  -  Next Steps */
	.action-bar {
		background: var(--surface);
		border: 1px solid #d2d2d7;
		border-radius: 12px;
		padding: 20px;
		margin-top: 24px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.action-bar-title {
		font-size: 14px;
		font-weight: 500;
		color: #1d1d1f;
		margin-bottom: 12px;
		letter-spacing: 0;
	}

	.action-bar-buttons {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
	}

	.action-link {
		color: #4a7c5c;
		text-decoration: none;
		font-size: 14px;
		font-weight: 500;
		transition: color 0.15s ease;
	}

	.action-link:hover {
		color: #1a3a2a;
	}

	.action-link:active {
		color: #0f2218;
	}

	.form-label {
		font-size: 12px;
		color: #6e6e73;
		letter-spacing: 0;
	}

	select {
		font-family: inherit;
		outline: none;
		font-size: 14px;
		background: var(--surface);
		border: 1px solid #d2d2d7;
		color: #1d1d1f;
		padding: 10px 12px;
		border-radius: 10px;
		transition: border-color 0.2s ease;
	}

	select:focus {
		border-color: #4a7c5c;
	}

	.checkbox-row {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		align-items: center;
		margin: 12px 0;
	}

	.checkbox-label {
		font-size: 12px;
		color: #6e6e73;
	}

	.checkbox-group {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		font-size: 12px;
	}

	.checkbox-group input[type="checkbox"] {
		width: 14px;
		height: 14px;
		cursor: pointer;
	}

	.lcs-result {
		background: #f5f5f7;
		border-radius: 10px;
		padding: 12px;
		margin: 12px 0;
		border-left: 3px solid #ffd60a;
		font-size: 12px;
		color: #1d1d1f;
	}

	.lcs-hint {
		color: #6e6e73;
		font-size: 11px;
		margin-left: 8px;
	}

	.commentary-box {
		background: #f5f5f7;
		border: 1px solid #d2d2d7;
		border-radius: 10px;
		padding: 16px;
		margin-top: 16px;
		border-left: 3px solid #4a7c5c;
	}

	.commentary-title {
		font-size: 12px;
		color: #4a7c5c;
		letter-spacing: 0;
		margin-bottom: 8px;
		font-weight: 600;
	}

	.commentary-text {
		font-size: 13px;
		color: #1d1d1f;
		line-height: 1.6;
	}

	.broker-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.broker-chip {
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-decoration: none;
		font-size: 11px;
		border-radius: 8px;
		background: #f5f5f7;
		border: 1px solid #d2d2d7;
		color: #1d1d1f;
		transition: all 0.15s ease;
	}

	.broker-chip:hover {
		border-color: #4a7c5c;
		color: #4a7c5c;
		text-decoration: none;
		background: rgba(74, 124, 92, 0.06);
	}

	@media (max-width: 640px) {
		.broker-grid {
			grid-template-columns: 1fr;
			gap: 6px;
		}

		.commentary-box {
			padding: 12px;
		}

		.action-bar-buttons {
			flex-direction: column;
			gap: 12px;
		}

		.action-bar {
			padding: 14px;
		}
	}

	/* B6: Address disambiguation panel */
	.disambig-panel {
		background: #fffbeb;
		border: 1px solid #fcd34d;
		border-radius: 12px;
		padding: 16px 20px;
		margin-top: 12px;
		animation: disambig-in 0.25s ease-out;
	}
	@keyframes disambig-in {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.disambig-title {
		font-size: 14px;
		font-weight: 700;
		color: #92400e;
		margin-bottom: 2px;
	}
	.disambig-subtitle {
		font-size: 11px;
		color: #b45309;
		margin-bottom: 12px;
	}
	.disambig-options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.disambig-btn {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 10px;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s;
		font-family: inherit;
	}
	.disambig-btn:hover {
		border-color: #4caf77;
		background: #f0fdf4;
		box-shadow: 0 2px 6px rgba(76, 175, 119, 0.15);
	}
	.disambig-borough {
		font-size: 12px;
		font-weight: 800;
		color: #1e3a2a;
		background: #dcfce7;
		padding: 3px 10px;
		border-radius: 6px;
		white-space: nowrap;
		min-width: 90px;
		text-align: center;
	}
	.disambig-addr {
		font-size: 12px;
		color: #374151;
		line-height: 1.3;
	}
</style>
