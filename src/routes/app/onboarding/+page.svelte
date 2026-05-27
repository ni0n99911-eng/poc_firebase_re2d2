<script lang="ts">
	/**
	 * RE2D2 — Onboarding Chatbot
	 *
	 * 5-question conversational flow. Smart, warm, encouraging.
	 * Collects: business type, differentiator, budget, rent, address.
	 * Stores to launchpad-store, navigates to /app/location.
	 * Right panel shows live recap of captured data.
	 */
	import { goto } from '$app/navigation';
	import { onMount, tick, flushSync } from 'svelte';
	import { page } from '$app/state';
	import { saveLaunchPadData, loadLaunchPadData } from '$lib/launchpad-store';
	import { scoreDifferentiator, buildVagueProbe, buildGoodAffirmation } from '$lib/utils/differentiator';
	import { writeCanonicalConcept } from '$lib/constants/businessTypeNormalizer';
	import { ONBOARDING_CONCEPT_LIST } from '$lib/constants/concepts';
	import { syncProfile } from '$lib/profile-sync';
	import { PRICE_LEVEL_TO_COFFEE } from '$lib/constants/scoring-thresholds';
	// ISS-06: unified nav — same NavigationDrawer on all /app/* pages
	import NavigationDrawer from '$lib/components/NavigationDrawer.svelte';
	import { sanitizeCopilotText } from '$lib/utils/copilot-sanitize';

	// Derive user data from server-loaded page data
	let userName = $derived((page.data as any)?.userName || '');
	let userInitials = $derived((page.data as any)?.userInitials || '');

	// ── Concept-Specific Opener Hooks ──
	// Each hook cites a real NYC data point + creates urgency. Keyed by concept slug.
	const CONCEPT_HOOKS: Record<string, { opener: string; followUp: string }> = {
		coffee: {
			opener: "70% of NYC cafe leases are signed at the wrong location. Most founders never find out why — until it's too late. I'm going to make sure that doesn't happen to you.",
			followUp: "Five quick questions, then I'll score any address in seconds. What kind of coffee concept are you building?"
		},
		bakery: {
			opener: "The average NYC bakery needs 200+ walk-ins a day just to break even — and most blocks can't deliver that. I'm going to find one that can.",
			followUp: "Five quick questions, then I'll score any address. What's your bakery's main draw — bread, pastries, or custom cakes?"
		},
		fast_casual: {
			opener: "Fast casual in NYC lives or dies by lunch traffic. 80% of your revenue comes in a 3-hour window — and not every block has the density to fill it. I'll find the blocks that do.",
			followUp: "Five quick questions. What's your cuisine — bowls, sandwiches, tacos, or something else?"
		},
		restaurant: {
			opener: "60% of NYC restaurants close within 3 years. The #1 predictor isn't food quality — it's location. The right block can double your survival odds.",
			followUp: "Five quick questions, then I'll score any address. What's your cuisine and price point?"
		},
		qsr: {
			opener: "Quick service needs foot traffic, period. On the wrong block, no amount of marketing will save you. On the right block, the customers are already walking past.",
			followUp: "Five quick questions. What are you serving?"
		},
		bar: {
			opener: "Bar survival in NYC is all about the 200-foot rule — every foot of distance from a transit hub or anchor drops your late-night traffic by 1.5%. I'll find the sweet spots.",
			followUp: "Five quick questions. What kind of bar — cocktail lounge, dive, sports bar, or wine bar?"
		},
		juice_bar: {
			opener: "Juice bars are impulse purchases — 90% of your customers decide to stop in within 30 seconds of seeing you. Visibility and foot traffic aren't nice-to-haves, they're everything.",
			followUp: "Five quick questions. Are you focused on cold-pressed, smoothies, or functional beverages?"
		},
		retail: {
			opener: "In NYC retail, rent eats first. The average specialty store spends 18% of revenue on rent — but the survivors keep it under 10%. Location determines which side you're on.",
			followUp: "Five quick questions. What are you selling?"
		},
		fitness: {
			opener: "Fitness studios live within a 10-minute walk radius. If your target demographic isn't within 6 blocks, no Instagram campaign will save you. I'll map your catchment.",
			followUp: "Five quick questions. What kind of fitness — yoga, HIIT, Pilates, or strength?"
		},
		salon: {
			opener: "Personal service businesses depend on repeat visits — and repeat customers won't travel more than 8 blocks. I'll find where your people already live and work.",
			followUp: "Five quick questions. What's your specialty — hair, nails, skincare, or barbering?"
		},
		medical: {
			opener: "Medical and wellness tenants get the best lease terms in NYC — landlords love the stability. But the wrong block means no walk-in discovery. I'll balance both.",
			followUp: "Five quick questions. What kind of practice — medical, dental, wellness, or spa?"
		},
		coworking: {
			opener: "Coworking in NYC is a density game. You need 500+ daily commuters within 5 minutes of your door, and you're competing against WeWork for every one of them. I know which blocks they miss.",
			followUp: "Five quick questions. What size are you targeting — boutique or full-floor?"
		},
	};

	const DEFAULT_HOOK = {
		opener: "In NYC, the gap between the best and worst block for any business is 3x the foot traffic and 2x the survival rate. I'll make sure you land on the right side of that gap.",
		followUp: "Five quick questions, then I'll score any address in seconds using 20 live data sources. What kind of business are you opening?"
	};

	// Map returning-user concept keys to hook keys
	function getHookKey(conceptKey: string): string {
		const lower = conceptKey.toLowerCase().replace(/[_\s-]/g, '');
		if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('café')) return 'coffee';
		if (lower.includes('bakery') || lower.includes('bake')) return 'bakery';
		if (lower.includes('fastcasual')) return 'fast_casual';
		if (lower.includes('restaurant') || lower.includes('fullservice') || lower.includes('dine')) return 'restaurant';
		if (lower.includes('qsr') || lower.includes('quickservice')) return 'qsr';
		if (lower.includes('bar') || lower.includes('nightlife') || lower.includes('lounge')) return 'bar';
		if (lower.includes('juice') || lower.includes('smoothie') || lower.includes('wellness')) return 'juice_bar';
		if (lower.includes('retail') || lower.includes('store') || lower.includes('specialty')) return 'retail';
		if (lower.includes('fitness') || lower.includes('gym') || lower.includes('yoga') || lower.includes('pilates')) return 'fitness';
		if (lower.includes('salon') || lower.includes('barber') || lower.includes('nail') || lower.includes('hair')) return 'salon';
		if (lower.includes('medical') || lower.includes('dental') || lower.includes('spa') || lower.includes('clinic')) return 'medical';
		if (lower.includes('cowork') || lower.includes('shared')) return 'coworking';
		return '';
	}

	// ── State Machine ──
	// welcome → q1_business → q2_differentiator → [q2b_vision_tier → q2c_street_level → q2d_avg_ticket (coffee only)] → q3_budget → q4_rent → q5_address → handoff
	let phase = $state('welcome');
	let messages = $state([]);
	let scrollContainer = $state(null);
	let inputValue = $state('');
	let chatInputEl = $state<HTMLInputElement | null>(null);
	let addressResolved = $state(false);
	let addressError = $state<string | null>(null);
	let addressCandidates = $state<string[]>([]);  // borough disambiguation
	let addressConfirmResolved = $state('');        // resolved address for user confirmation
	let isReturning = $state(false);
	let existingConcept = $state('');

	// Mission briefing: track prior score count for super-user detection
	let priorScoreCount = $state(0);
	let priorScoreAddress = $state('');

	// Typing indicator — shown while bot "thinks" between turns
	let isTyping = $state(false);

	// Collected data
	let businessType = $state('');
	let businessTypeLabel = $state('');
	let businessSubType = $state('');
	let priceLevel = $state('');
	let differentiator = $state('');
	let differentiatorAttempts = $state(0);    // guardrail: tracks q2 attempts
	let differentiatorQuality = $state<'garbage' | 'vague' | 'good' | ''>(''); // saved tier
	// C12: Vision tier — "How unique is your offering?" (coffee concepts)
	let visionTier = $state<'commodity' | 'standard' | 'differentiated' | 'highly_differentiated' | ''>('');
	// D4: Street-level question — "Is this space at street level?"
	let streetLevel = $state<'yes' | 'no' | 'unsure' | ''>('');
	// Addendum Item 1: Average ticket price (coffee concepts — drives price sensitivity in scoring)
	let avgTicket = $state<number>(0);
	let budget = $state('');
	let rentBudget = $state('');

	// Restaurant subtype options (Gap 2 — scoring profiles differ dramatically)
	const RESTAURANT_SUBTYPES = [
		{ key: 'full_service', label: 'Full-Service / Sit-Down' },
		{ key: 'fast_casual', label: 'Fast Casual' },
		{ key: 'quick_service', label: 'Quick Service / Counter' },
		{ key: 'cafe_bakery', label: 'Café / Bakery' },
	];

	const FITNESS_SUBTYPES = [
		{ key: 'boutique_studio', label: 'Boutique Studio (yoga, cycling, barre, pilates)' },
		{ key: 'crossfit',        label: 'CrossFit / HIIT / Boxing' },
		{ key: 'big_box_gym',     label: 'Traditional Gym / Health Club' },
		{ key: 'personal_training', label: 'Personal Training Studio' },
	];

	const RETAIL_SUBTYPES = [
		{ key: 'clothing_boutique', label: 'Clothing / Apparel / Accessories' },
		{ key: 'home_goods',        label: 'Home Goods / Gifts / Stationery' },
		{ key: 'bookstore',         label: 'Books / Media / Specialty' },
		{ key: 'specialty_food',    label: 'Specialty Food / Grocery' },
		{ key: 'beauty_retail',     label: 'Beauty / Skincare / Wellness' },
	];

	// C12: Vision tier options — maps to scoring multiplier (Section 4.1 of Coffee Rewire spec)
	const VISION_TIER_OPTIONS = [
		{ value: 'commodity',              label: 'Standard coffee menu',           mult: 0.90 },
		{ value: 'standard',               label: 'Good quality, nice space',       mult: 1.00 },
		{ value: 'differentiated',         label: 'Specialty / unique concept',     mult: 1.05 },
		{ value: 'highly_differentiated',  label: 'Highly differentiated / viral',  mult: 1.10 },
	];

	// D4: Street-level options (addresses known data gap — coffee must be ground floor)
	const STREET_LEVEL_OPTIONS = [
		{ value: 'yes',    label: 'Yes — street level / ground floor' },
		{ value: 'no',     label: 'No — upper floor or basement' },
		{ value: 'unsure', label: 'Not sure yet' },
	];

	// Addendum Item 1: Average ticket price options (coffee concepts — maps to avgTicket in scoring payload)
	const AVG_TICKET_OPTIONS = [
		{ value: 4.00,  label: '$3–5 · Budget',        tag: 'budget' },
		{ value: 6.00,  label: '$5–7 · Standard',      tag: 'standard' },
		{ value: 8.50,  label: '$7–10 · Premium',       tag: 'premium' },
		{ value: 12.00, label: '$10+ · Ultra-Premium',  tag: 'ultra' },
	];

	// Price level options (Gap 4 — affects price_income_fit scoring)
	const PRICE_LEVEL_OPTIONS = [
		{ value: '1', label: '$ — Budget / Value' },
		{ value: '2', label: '$$ — Moderate' },
		{ value: '3', label: '$$$ — Upscale' },
		{ value: '4', label: '$$$$ — Premium / Luxury' },
	];

	// ── Config ──
	// #30: BUSINESS_TYPES replaced by ONBOARDING_CONCEPT_LIST (src/lib/constants/concepts.ts)
	const BUSINESS_TYPES = ONBOARDING_CONCEPT_LIST;

	const BUDGET_OPTIONS = [
		{ value: 'under_50k', label: 'Under $50K' },
		{ value: '50_150k', label: '$50–150K' },
		{ value: '150_500k', label: '$150–500K' },
		{ value: '500k_plus', label: '$500K+' },
	];

	// ISS-04: expanded to cover Manhattan prime commercial rents ($15-30K/mo)
	const RENT_OPTIONS = [
		{ value: 'under_3k', label: 'Under $3K/mo' },
		{ value: '3_6k', label: '$3–6K/mo' },
		{ value: '6_10k', label: '$6–10K/mo' },
		{ value: '10_15k', label: '$10–15K/mo' },
		{ value: '15_25k', label: '$15–25K/mo' },
		{ value: '25k_plus', label: '$25K+/mo' },
	];

	// Phase 2 Fit Question Options
	const OWNER_TYPE_OPTIONS = [
		{ value: 'full_time', label: 'Full-Time' },
		{ value: 'part_time', label: 'Part-Time' },
		{ value: 'absentee', label: 'Absentee' },
		{ value: 'partnership', label: 'Partnership' },
	];

	const RISK_TOLERANCE_OPTIONS = [
		{ value: 'conservative', label: 'Conservative' },
		{ value: 'moderate', label: 'Moderate' },
		{ value: 'aggressive', label: 'Aggressive' },
	];

	const EXPERIENCE_OPTIONS = [
		{ value: 'first_time', label: 'First-Time' },
		{ value: 'other_industry', label: 'Other Industry' },
		{ value: 'experienced', label: 'Experienced' },
		{ value: 'serial', label: 'Serial' },
	];

	const TARGET_CUSTOMER_OPTIONS = {
		'coffee_shop': [
			{ value: 'commuters', label: 'Commuters' },
			{ value: 'remote_workers', label: 'Remote Workers' },
			{ value: 'students', label: 'Students' },
			{ value: 'families', label: 'Families' },
			{ value: 'mixed', label: 'Mixed' },
		],
		'restaurant': [
			{ value: 'fine_dining', label: 'Fine Dining' },
			{ value: 'casual', label: 'Casual Dining' },
			{ value: 'quick_service', label: 'Quick Service' },
			{ value: 'date_night', label: 'Date Night' },
			{ value: 'families', label: 'Families' },
		],
		'fitness': [
			{ value: 'premium', label: 'Premium' },
			{ value: 'budget', label: 'Budget' },
			{ value: 'boutique', label: 'Boutique' },
			{ value: 'families', label: 'Families' },
			{ value: 'mixed', label: 'Mixed' },
		],
		'default': [
			{ value: 'premium', label: 'Premium' },
			{ value: 'budget', label: 'Budget' },
			{ value: 'mainstream', label: 'Mainstream' },
			{ value: 'niche', label: 'Niche' },
			{ value: 'mixed', label: 'Mixed' },
		],
	};

	const OPERATING_HOURS_OPTIONS = [
		{ value: 'early_morning',   label: 'Early Morning (5am-9am)' },
		{ value: 'morning_heavy',   label: 'Morning-Heavy (6am-2pm)' },
		{ value: 'standard',        label: 'Standard Business (9am-5pm)' },
		{ value: 'standard_retail', label: 'Standard Retail (10am-8pm)' },
		{ value: 'dinner',          label: 'Dinner Service (5pm-10pm)' },
		{ value: 'evening',         label: 'Evening (5pm-11pm)' },
		{ value: 'split_am_pm',     label: 'Split AM + PM (6-10am, 5-9pm)' },
		{ value: 'all_day',         label: 'All Day (10am-10pm)' },
		{ value: 'late_night',      label: 'Late Night (8pm-2am)' },
		{ value: '24_7',            label: '24/7' },
	];

	// Map rent option values to numeric estimates for launchpad (ISS-04: expanded)
	const RENT_TO_NUMBER: Record<string, number> = {
		'under_3k': 2500,
		'3_6k': 4500,
		'6_10k': 8000,
		'10_15k': 12500,
		'15_25k': 20000,
		'25k_plus': 30000,
	};

	// ── Stats — NO fake numbers. Use only defensible, real claims. (#29: removed 12,847/400+ placeholders)
	// Update these when real Supabase count is wired in from /api/stats or server load.
	// const STAT_LOCATIONS_SCORED = '12,847'; // ← REMOVED: fabricated. Do not restore.
	// const STAT_FOUNDERS = '400+';           // ← REMOVED: fabricated. Do not restore.

	// ── Guidemap ──
	const steps = [
		// UX-24: stepper label rename — more direct
		{ id: 1, title: 'Concept', subtitle: "What you're building · your edge" },
		{ id: 2, title: 'Plan', subtitle: 'Startup capital · rent ceiling' },
		{ id: 3, title: 'Location', subtitle: "The block you're considering" },
		{ id: 4, title: 'Profile', subtitle: 'Your operator background' },
		{ id: 5, title: 'Verdict', subtitle: 'Your scored result' },
	];

	// Concept-specific briefing chips for mission card state 2
	const CONCEPT_SIGNALS: Record<string, string[]> = {
		coffee_shop:    ['Foot traffic density', 'Office proximity', 'Morning commute index'],
		restaurant:     ['Lunch / dinner traffic', 'Competitor density', 'Delivery corridor index'],
		fitness:        ['Residential density', 'Daytime population', 'Gym-to-resident ratio'],
		retail:         ['Pedestrian count', 'Retail cluster score', 'Weekend foot traffic'],
		bar:            ['Late-night activity', 'Transit access', 'Nightlife density'],
		spa_wellness:   ['Affluence index', 'Walk score', 'Female 25–44 density'],
		barbershop:     ['Walk-in foot traffic', 'Residential density', 'Male demographic weight'],
		florist:        ['Bridal district index', 'Office delivery corridors', 'Foot traffic variance'],
		medical_dental: ['Transit accessibility', 'Insurance density', 'Competitor gap'],
	};

	let conceptBriefingChips = $derived(
		businessType && CONCEPT_SIGNALS[businessType]
			? CONCEPT_SIGNALS[businessType]
			: ['Foot traffic · density', 'Neighborhood health', 'Competitor landscape']
	);

	let conceptDisplayName = $derived(
		businessTypeLabel || businessType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || ''
	);

	// Phase 2 Fit state
	let fitAnswers = $state({
		ownerType: '',
		riskTolerance: '',
		experience: '',
		targetCustomer: '',
		operatingHours: '',
	});
	let fitQuestionsAnswered = $derived(Object.values(fitAnswers).filter(v => v).length);
	let skippedSteps = $state(new Set());

	let activeStep = $derived.by(() => {
		// Phase 1: Questions 1-2 (business + differentiator) → Step 1
		// Phase 1: Questions 3-4 (budget + rent) → Step 2
		// Phase 1: Question 5 (address) → Step 3
		// Phase 2: Fit questions → Step 4
		// Scoring/handoff → Step 5
		switch (phase) {
			case 'welcome': case 'q1_business': case 'q1b_restaurant_subtype': case 'q1b_fitness_subtype': case 'q1b_retail_subtype': case 'q1c_price_level': return 1;
			case 'q2_differentiator': case 'q2b_vision_tier': case 'q2c_street_level': case 'q2d_avg_ticket': return 1;
			case 'q3_budget': return 2;
			case 'q4_rent': return 2;
			case 'q5_address': case 'address_decision': case 'address_disambiguate': case 'address_confirm': return 3;
			case 'fit_q1': case 'fit_q2': case 'fit_q3': case 'fit_q4': case 'fit_q5': return 4;
			case 'handoff': case 'fit_complete': return 5;
			default: return 1;
		}
	});

	let progressPercent = $derived((activeStep - 1) / (steps.length - 1) * 100);

	// P2-2: Recap panel uses a finer-grained step counter so it advances as soon
	// as price level is selected — not frozen at 1 until Skip-to-Address fires.
	// The left stepper panel still uses activeStep (unchanged).
	let recapStep = $derived.by(() => {
		if (phase === 'handoff' || phase === 'fit_complete') return 6;
		if (phase === 'fit_q1' || phase === 'fit_q2' || phase === 'fit_q3' || phase === 'fit_q4' || phase === 'fit_q5') return 5;
		if (phase === 'q5_address' || phase === 'address_decision' || phase === 'address_disambiguate' || phase === 'address_confirm') return 4;
		if (phase === 'q4_rent') return 3;
		if (phase === 'q3_budget') return 2;
		// Still answering concept questions — but advance to 2 once price is locked in
		if (phase === 'q2_differentiator' && priceLevel) return 2;
		return 1;
	});

	// Reactive target-customer options for fit_q4 (depends on businessType)
	let fitTargetOptions = $derived(TARGET_CUSTOMER_OPTIONS[businessType] || TARGET_CUSTOMER_OPTIONS['default']);

	// ── Address detection ──
	function extractAddress(text) {
		// Match street addresses like "215 W 90th St", "600 6th Avenue", "200 Bedford Ave Brooklyn", "200 Broadway"
		// MEDIUM-1: \d+(?:-\d+)? handles Queens hyphenated house numbers like "30-02 Steinway St"
		const match = text.match(/(\d+(?:-\d+)?\s+(?:[\w.]+\s+)*(?:st|street|ave|avenue|blvd|boulevard|rd|road|way|place|dr|drive|ln|lane|ct|court|broadway|madison|park|lex|lexington|west|east|north|south)\b[\w\s,]*)/i);
		return match ? match[1].replace(/,\s*$/, '').trim() : null;
	}

	// ── Get display label for fit answer ──
	function getFitLabel(fieldName, value) {
		if (!value) return '';
		switch (fieldName) {
			case 'ownerType':
				return OWNER_TYPE_OPTIONS.find(o => o.value === value)?.label || value;
			case 'riskTolerance':
				return RISK_TOLERANCE_OPTIONS.find(o => o.value === value)?.label || value;
			case 'experience':
				return EXPERIENCE_OPTIONS.find(o => o.value === value)?.label || value;
			case 'targetCustomer':
				const targetOptions = TARGET_CUSTOMER_OPTIONS[businessType] || TARGET_CUSTOMER_OPTIONS['default'];
				return targetOptions.find(o => o.value === value)?.label || value;
			case 'operatingHours':
				return OPERATING_HOURS_OPTIONS.find(o => o.value === value)?.label || value;
			default:
				return value;
		}
	}

	// ── Save fit answers to launchpad ──
	function saveFitAnswers() {
		const update = {
			founderProfile: {
				...(loadLaunchPadData().founderProfile || {}),
				ownerType: fitAnswers.ownerType,
				riskTolerance: fitAnswers.riskTolerance,
				experience: fitAnswers.experience,
				targetCustomer: fitAnswers.targetCustomer,
				operatingHours: fitAnswers.operatingHours,
			},
		};
		saveLaunchPadData(update);
	}

	// ── Message helpers ──
	let msgCounter = 0;
	function addBot(text) {
		messages = [...messages, { id: `bot-${++msgCounter}-${Date.now()}`, role: 'bot', text }];
		tick().then(scrollToBottom);
	}

	function addUser(text) {
		messages = [...messages, { id: `user-${++msgCounter}-${Date.now()}`, role: 'user', text }];
		tick().then(scrollToBottom);
	}

	async function scrollToBottom() {
		await tick();
		if (scrollContainer) {
			scrollContainer.scrollTop = scrollContainer.scrollHeight;
		}
		setTimeout(() => {
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			}
		}, 80);
		setTimeout(() => {
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			}
		}, 200);
	}

	// ── Save to launchpad immediately on each answer ──
	function saveToLaunchpad() {
		const update: Record<string, any> = {};
		if (businessType) update.businessType = businessType;
		if (businessTypeLabel) update.businessName = businessTypeLabel;
		if (businessSubType) update.businessSubType = businessSubType;
		if (priceLevel) update.priceLevel = priceLevel;
		if (differentiator) {
			update.visionStatement = differentiator;
			update.differentiator = differentiator;
			if (differentiatorQuality) update.differentiatorQuality = differentiatorQuality;
		}
		// C12: Vision tier (coffee concepts — maps to scoring multiplier)
		if (visionTier) update.visionTier = visionTier;
		// D4: Street-level (coffee concepts — addresses data gap)
		if (streetLevel) update.streetLevel = streetLevel;
		// Addendum Item 1: Average ticket price (coffee — drives price sensitivity)
		if (avgTicket > 0) update.avgTicket = avgTicket;

		// Fallback: if user set priceLevel but didn't go through coffee-specific steps,
		// derive avgTicket + visionTier from the PRICE_LEVEL_TO_COFFEE mapping.
		const isCoffeeForSave = businessType === 'specialty_coffee' || businessType === 'coffee_shop' || businessType === 'coffee' || businessType === 'cafe';
		if (isCoffeeForSave && priceLevel && PRICE_LEVEL_TO_COFFEE[priceLevel]) {
			const mapped = PRICE_LEVEL_TO_COFFEE[priceLevel];
			if (!avgTicket || avgTicket === 0) update.avgTicket = mapped.avgTicket;
			if (!visionTier) update.visionTier = mapped.visionTier;
		}

		if (budget) update.startupBudget = budget;
		// FIX-C: Always write financialGoals so model page never gets an absent key.
		// null = "user didn't specify" → model falls to concept RENT_DEFAULTS. That's correct.
		// Never write 0 — 0 looks like "user said $0" which > 0 guard will ignore anyway.
		update.financialGoals = {
			...(loadLaunchPadData().financialGoals || {}),
			monthlyRentBudget: rentBudget ? (RENT_TO_NUMBER[rentBudget] ?? null) : null,
		};
		saveLaunchPadData(update);

		// Also save to re2_persona for legacy compat
		try {
			const existing = JSON.parse(localStorage.getItem('re2_persona') || '{}');
			existing.persona_type = businessType;
			localStorage.setItem('re2_persona', JSON.stringify(existing));
		} catch {}

		// And re2_session
		try {
			const existing = JSON.parse(localStorage.getItem('re2_session') || '{}');
			existing.personaType = businessType;
			existing.personaKey = businessType;
			existing.bizType = businessType;
			existing.concept = businessType; // CRITICAL-3: keep concept in sync with personaKey
			if (businessSubType) existing.businessSubType = businessSubType;
			if (priceLevel) existing.priceLevel = priceLevel;
			if (differentiator) existing.conceptDescription = differentiator;
			localStorage.setItem('re2_session', JSON.stringify(existing));
		} catch {}
	}

	// ── Navigate to Location page ──
	function handoff(address, fitComplete = false) {
		saveToLaunchpad();
		if (fitComplete) {
			saveFitAnswers();
		}
		// BUG-1 FIX: write canonical concept to session BEFORE navigating so the
		// location page reads the correct visionBizType/bizType on init, not stale
		// specialty_coffee from a prior session. Also fixes BUG-11 (concept-specific
		// controls showing for all non-matching concepts).
		if (businessType) writeCanonicalConcept(businessType);
		// Fire-and-forget: sync completed onboarding data to client_profiles
		syncProfile().catch(() => {});
		handoffAddress = address;
		phase = 'handoff';
		// Bridge: coach user about the two scores before they land on results
		addBot(`Pulling data for ${address}…`);
		setTimeout(() => {
			addBot("Foot traffic. Competitor density. Survival rates. Neighborhood health. 20 sources, running in parallel.");
		}, 1100);
		setTimeout(() => {
			addBot("We'll crunch the data on this location and give you one score — your number out of 100, plus what it means.");
		}, 2400);
		setTimeout(() => {
			const params = new URLSearchParams();
			params.set('addr', address);
			if (fitComplete) params.set('fitComplete', 'true');
			goto(`/app/location?${params.toString()}`);
		}, 3800);
	}

	// ── Phase 2: Decision point after address ──
	let selectedAddress = $state('');
	let handoffAddress = $state('');
	let duplicateExistingUrl = $state('');

	// UX-FIX-07: Check if address+concept already scored in launchpad
	function checkDuplicate(address: string): string | null {
		try {
			const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
			const locations: Array<{ address?: string; addr?: string; conceptType?: string }> = lp.locations || [];
			const concept = businessType || '';
			const normAddr = address.toLowerCase().trim();
			for (const loc of locations) {
				const locAddr = (loc.address || loc.addr || '').toLowerCase().trim();
				if (locAddr && normAddr && locAddr.includes(normAddr.split(',')[0]?.toLowerCase() || '')) {
					return `/app/location?addr=${encodeURIComponent(loc.address || loc.addr || address)}`;
				}
			}
		} catch {}
		return null;
	}

	function showFitDecision(address: string) {
		selectedAddress = address;
		// UX-FIX-07: duplicate detection
		const dupUrl = checkDuplicate(address);
		if (dupUrl) {
			duplicateExistingUrl = dupUrl;
			phase = 'duplicate_check';
			addBot(`You've already analyzed **${address.split(',')[0]}** for this concept. Want to view your existing results, or rescore with fresh data?`);
			return;
		}
		duplicateExistingUrl = '';
		phase = 'address_decision';
		addBot("Got the address. I can score this block now. Want to add your concept details first? Takes 90 seconds and makes the score specific to YOUR business, not just the neighborhood.");
		setTimeout(() => {
			// Options will render below based on phase
		}, 300);
	}

	// ── Start Phase 2 fit questions ──
	function startFitQuestions() {
		addUser("Let's do the full analysis");
		phase = 'fit_q1';
		setTimeout(() => {
			addBot("Great! Let's dig deeper. First question: What kind of owner will you be?");
		}, 300);
	}

	// ── Handle fit question answers ──
	function answerFitQuestion(fieldName, value, label) {
		fitAnswers[fieldName] = value;
		addUser(label);
		saveFitAnswers();

		const fitPhaseMap = {
			'ownerType': 'fit_q2',
			'riskTolerance': 'fit_q3',
			'experience': 'fit_q4',
			'targetCustomer': 'fit_q5',
			'operatingHours': 'fit_complete',
		};

		phase = fitPhaseMap[fieldName];

		if (phase === 'fit_q2') {
			setTimeout(() => addBot("What's your risk tolerance?"), 300);
		} else if (phase === 'fit_q3') {
			setTimeout(() => addBot("Have you operated a business before?"), 300);
		} else if (phase === 'fit_q4') {
			const targetOptions = TARGET_CUSTOMER_OPTIONS[businessType] || TARGET_CUSTOMER_OPTIONS['default'];
			const optionsList = targetOptions.map(o => o.label).join(', ');
			setTimeout(() => addBot("Who are you building this for?"), 300);
		} else if (phase === 'fit_q5') {
			setTimeout(() => addBot("What hours are you thinking?"), 300);
		} else if (phase === 'fit_complete') {
			// All fit questions answered — auto-navigate to location
			setTimeout(() => {
				handoff(selectedAddress || 'Unknown Location', true);
			}, 400);
		}
	}

	// ── Check for address in any user input ──
	function checkForAddress(text) {
		const addr = extractAddress(text);
		if (addr) {
			handoff(addr);
			return true;
		}
		return false;
	}

	// ── Haiku semantic harm check — fail-open on any error ──
	async function checkHarm(text: string): Promise<boolean> {
		try {
			const res = await fetch('/api/re2d2/check-harm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text }),
			});
			if (!res.ok) return true; // fail open
			const { safe } = await res.json();
			return safe as boolean;
		} catch {
			return true; // fail open — don't block user if API is down
		}
	}

	// ── Phase handlers ──
	// Natural acknowledgements per business type
	const ACK_MESSAGES = {
		'coffee_shop': "Great choice — coffee shops are one of the most rewarding businesses to build.",
		'restaurant': "Love it — restaurants are hard but nothing beats the energy of a packed dining room.",
		'fitness': "Nice — fitness is booming and the recurring revenue model is powerful.",
		'retail': "Retail done right is magnetic. Let's find you the perfect spot.",
		'bar': "Bars have incredible margins when the location is right. Heads up: NYC liquor licensing has a 200-ft school/church rule that can kill a location — we'll check that for you.",
		'spa_wellness': "Wellness is one of the fastest-growing categories in brick & mortar.",
		'barbershop': "Classic business, loyal customers. Let's find your corner.",
		'florist': "Beautiful business — foot traffic and visibility are everything for florists.",
		'medical_dental': "Healthcare is recession-proof. Important: NY requires a licensed MD/DO as Medical Director for med spas — we'll factor that into your costs.",
		'something_else': "Interesting — I love the unconventional concepts.",
	};

	function selectBusinessType(key, label) {
		businessType = key;
		businessTypeLabel = label;
		addUser(label);
		saveToLaunchpad();
		const ack = ACK_MESSAGES[key] || "Great — let's build something amazing.";

		// FIX-ACK-03: Use FLAT setTimeouts — all scheduled from the same synchronous
		// call stack so they're all "depth-1" from Svelte's reactive boundary.
		// Nested setTimeouts (depth 2+) fail to flush even with flushSync().
		// Timing: t=500 → ack; t=600 → typing on; t=1200 → follow-up question.

		// Restaurant → ask subtype first (different scoring profiles)
		if (key === 'restaurant') {
			phase = 'q1b_restaurant_subtype';
			isTyping = true;
			setTimeout(() => { flushSync(() => { isTyping = false; addBot(ack); }); }, 500);
			setTimeout(() => { flushSync(() => { isTyping = true; }); }, 600);
			setTimeout(() => { flushSync(() => { isTyping = false; addBot("What kind of restaurant are you thinking?"); }); }, 1200);
			return;
		}

		// Fitness → ask subtype (boutique vs gym vs PT)
		if (key === 'fitness') {
			phase = 'q1b_fitness_subtype';
			isTyping = true;
			setTimeout(() => { flushSync(() => { isTyping = false; addBot(ack); }); }, 500);
			setTimeout(() => { flushSync(() => { isTyping = true; }); }, 600);
			setTimeout(() => { flushSync(() => { isTyping = false; addBot("What kind of fitness concept?"); }); }, 1200);
			return;
		}

		// Retail → ask subtype (clothing vs home goods vs specialty)
		if (key === 'retail') {
			phase = 'q1b_retail_subtype';
			isTyping = true;
			setTimeout(() => { flushSync(() => { isTyping = false; addBot(ack); }); }, 500);
			setTimeout(() => { flushSync(() => { isTyping = true; }); }, 600);
			setTimeout(() => { flushSync(() => { isTyping = false; addBot("What kind of retail store?"); }); }, 1200);
			return;
		}

		// All types → ask price level
		phase = 'q1c_price_level';
		isTyping = true;
		setTimeout(() => { flushSync(() => { isTyping = false; addBot(ack); }); }, 500);
		setTimeout(() => { flushSync(() => { isTyping = true; }); }, 600);
		setTimeout(() => { flushSync(() => { isTyping = false; addBot("What's your price positioning?"); }); }, 1200);
	}

	function selectRestaurantSubtype(key, label) {
		// Store subtype key as businessType so concept defaults resolve correctly
		businessType = key;
		businessTypeLabel = label;
		businessSubType = key;
		addUser(label);
		// Save subtype to launchpad and re2_session
		try {
			const session = JSON.parse(localStorage.getItem('re2_session') || '{}');
			session.businessType = key;
			session.businessSubType = key;
			localStorage.setItem('re2_session', JSON.stringify(session));
		} catch {}
		saveLaunchPadData({ businessType: key, businessSubType: key });
		// Next: ask price level
		phase = 'q1c_price_level';
		isTyping = true;
		setTimeout(() => {
			flushSync(() => { isTyping = false; addBot("What's your price positioning?"); });
		}, 500);
	}

	function selectFitnessSubtype(key, label) {
		// Store subtype key as businessType so concept defaults resolve correctly
		businessType = key;
		businessTypeLabel = label;
		businessSubType = key;
		addUser(label);
		try {
			const session = JSON.parse(localStorage.getItem('re2_session') || '{}');
			session.businessType = key;
			session.businessSubType = key;
			localStorage.setItem('re2_session', JSON.stringify(session));
		} catch {}
		saveLaunchPadData({ businessType: key, businessSubType: key });
		phase = 'q1c_price_level';
		isTyping = true;
		setTimeout(() => {
			flushSync(() => { isTyping = false; addBot("What's your price positioning?"); });
		}, 500);
	}

	function selectRetailSubtype(key, label) {
		businessType = key;
		businessTypeLabel = label;
		businessSubType = key;
		addUser(label);
		try {
			const session = JSON.parse(localStorage.getItem('re2_session') || '{}');
			session.businessType = key;
			session.businessSubType = key;
			localStorage.setItem('re2_session', JSON.stringify(session));
		} catch {}
		saveLaunchPadData({ businessType: key, businessSubType: key });
		phase = 'q1c_price_level';
		isTyping = true;
		setTimeout(() => {
			flushSync(() => { isTyping = false; addBot("What's your price positioning?"); });
		}, 500);
	}

	function selectPriceLevel(value, label) {
		priceLevel = value;
		addUser(label);
		// Save to session and launchpad
		try {
			const session = JSON.parse(localStorage.getItem('re2_session') || '{}');
			session.priceLevel = value;
			localStorage.setItem('re2_session', JSON.stringify(session));
		} catch {}
		saveLaunchPadData({ priceLevel: value });
		// Continue to differentiator
		phase = 'q2_differentiator';
		isTyping = true;
		setTimeout(() => {
			// Dynamically select differentiator example based on businessType
			const exampleKey = businessType || 'specialty_coffee';
			const example = DIFFERENTIATOR_EXAMPLES[exampleKey] || DIFFERENTIATOR_EXAMPLES['specialty_coffee'];
			const exampleMsg = `"${example.bad}" scores near zero. "${example.good}" scores high.`;
			flushSync(() => { isTyping = false; addBot(`Your differentiator is what makes your score go up or down — it's the one signal I can't pull from public data. What's the reason someone walks past three competitors to get to you? Be specific. ${exampleMsg}`); });
		}, 500);
	}

	// ── Google Places autocomplete (FIX-004) ──
	function loadGooglePlaces(): Promise<void> {
		if ((window as any).google?.maps?.places) return Promise.resolve();
		return new Promise<void>((resolve, reject) => {
			const key = import.meta.env.PUBLIC_GOOGLE_PLACES_KEY;
			if (!key || key === 'placeholder') { resolve(); return; }
			const script = document.createElement('script');
			script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__re2GoogleReady`;
			(window as any).__re2GoogleReady = () => resolve();
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}

	async function initAddressAutocomplete(inputEl: HTMLInputElement) {
		try {
			await loadGooglePlaces();
			const google = (window as any).google;
			if (!google?.maps?.places) return;
			const autocomplete = new google.maps.places.Autocomplete(inputEl, {
				componentRestrictions: { country: 'us' },
				fields: ['formatted_address', 'geometry', 'address_components'],
				types: ['geocode', 'establishment'],
			});
			autocomplete.addListener('place_changed', () => {
				const place = autocomplete.getPlace();
				if (place.formatted_address) {
					inputValue = place.formatted_address;
					addressResolved = true;
					addressError = null;
				}
			});
		} catch {}
	}

	async function geocodeFreeText(query: string) {
		try {
			await loadGooglePlaces();
			const google = (window as any).google;
			if (!google?.maps?.Geocoder) return null;
			const geocoder = new google.maps.Geocoder();
			const result = await geocoder.geocode({
				address: query + ', New York, NY',
				componentRestrictions: { country: 'us' },
			});
			if (result.results?.length > 0) return result.results[0].formatted_address as string;
			return null;
		} catch { return null; }
	}

	// Returns up to 5 geocoded candidates — used for borough disambiguation
	async function geocodeAllCandidates(query: string): Promise<string[]> {
		try {
			await loadGooglePlaces();
			const google = (window as any).google;
			if (!google?.maps?.Geocoder) return [];
			const geocoder = new google.maps.Geocoder();
			const result = await geocoder.geocode({
				address: query + ', New York, NY',
				componentRestrictions: { country: 'us' },
			});
			if (!result.results?.length) return [];
			return (result.results as any[]).slice(0, 5).map((r: any) => r.formatted_address as string);
		} catch { return []; }
	}

	const NYC_BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Bronx', 'Staten Island'];

	// Init autocomplete whenever phase transitions to address step
	$effect(() => {
		if (phase === 'q5_address' && chatInputEl) {
			addressResolved = false;
			addressError = null;
			initAddressAutocomplete(chatInputEl);
		}
	});

	async function handleTextInput() {
		const text = inputValue.trim();
		if (!text) return;
		inputValue = '';
		addUser(text);

		// Check for address and navigate directly to Location IQ
		if (phase === 'q5_address') {
			// ── Intersection/neighborhood input: assume and proceed — server geocoder handles it ──
			// L3-fix: Don't block on intersections or partial addresses. Hand off as-is;
			// the Census → Google pipeline on the location page resolves them.
			const intersectionPattern = /\b(\d+(?:st|nd|rd|th)?)\s+(?:and|&)\s+([a-zA-Z\d]+(?:\s+[a-zA-Z]+)*)\b/i;
			if (intersectionPattern.test(text) && !extractAddress(text)) {
				handoff(text);
				return;
			}

			// Autocomplete already resolved full address — go straight to handoff
			if (addressResolved) {
				handoff(text);
				return;
			}

			// Always geocode — to get full address AND catch multi-borough ambiguity
			const queryToGeocode = extractAddress(text) || text;
			const candidates = await geocodeAllCandidates(queryToGeocode);

			if (!candidates.length) {
				// Google Maps client-side unavailable — fall back to raw address.
				// Server-side geocode (Census → Google) will resolve it on the location page.
				handoff(queryToGeocode);
				return;
			}

			// Filter to NYC boroughs
			const nycCandidates = candidates.filter(addr =>
				NYC_BOROUGHS.some(b => addr.includes(b))
			);
			const finalCandidates = nycCandidates.length > 0 ? nycCandidates : candidates;

			// Check if multiple boroughs match — ask user to confirm
			const distinctBoroughs = [...new Set(
				finalCandidates.map(addr => NYC_BOROUGHS.find(b => addr.includes(b))).filter(Boolean)
			)];

			if (distinctBoroughs.length > 1) {
				addressCandidates = finalCandidates.slice(0, 4);
				phase = 'address_disambiguate';
				const streetPart = queryToGeocode.split(',')[0].trim();
				addBot(`I found "${streetPart}" in multiple boroughs. Which one are you looking at?`);
			} else {
				const resolved = finalCandidates[0];
				// Address confirmation: compare what Google resolved vs what the user typed.
				// If the street portion differs (typo, partial, wrong address), confirm with user.
				const userStreet = text.split(',')[0].trim().toLowerCase().replace(/\s+/g, ' ');
				const resolvedStreet = resolved.split(',')[0].trim().toLowerCase().replace(/\s+/g, ' ');
				if (resolvedStreet.startsWith(userStreet) || userStreet.startsWith(resolvedStreet) || userStreet === resolvedStreet) {
					// Close enough match — proceed without confirmation
					handoff(resolved);
				} else {
					// Mismatch — ask user to confirm the resolved address
					addressConfirmResolved = resolved;
					phase = 'address_confirm';
					addBot(`Did you mean **${resolved}**?`);
				}
			}
			return;
		}

		// For other phases, use normal flow
		if (checkForAddress(text)) return;

		switch (phase) {
			case 'welcome':
			case 'q1_business':
				// User typed instead of clicking — try to match
				const lower = text.toLowerCase();
				const match = BUSINESS_TYPES.find(bt => lower.includes(bt.label.toLowerCase().split('/')[0].trim()));
				if (match) {
					businessType = match.key;
					businessTypeLabel = match.label;
					saveToLaunchpad();
					phase = 'q2_differentiator';
					setTimeout(() => addBot("What makes yours different? One sentence."), 300);
				} else {
					businessType = 'something_else';
					businessTypeLabel = text;
					saveToLaunchpad();
					phase = 'q2_differentiator';
					setTimeout(() => addBot("What makes yours different? One sentence."), 300);
				}
				break;

			case 'q2_differentiator': {
				differentiatorAttempts++;
				const result = scoreDifferentiator(text, businessType);

				// ── Harm check (Haiku) — only on first attempt, only if not obvious filler ──
				if (differentiatorAttempts === 1 && result.tier !== 'garbage') {
					const safe = await checkHarm(text);
					if (!safe) {
						// Don't count this against attempts — harm check doesn't consume a retry
						differentiatorAttempts--;
						setTimeout(() => addBot(
							"I can't help plan that type of business. What's the concept you're actually opening?"
						), 300);
						break;
					}
				}

				// ── First attempt: filler/garbage ──
				if (result.tier === 'garbage' && differentiatorAttempts === 1) {
					setTimeout(() => addBot(
						"Give me something real — what makes customers come to *your* store instead of the one next door?"
					), 300);
					break;
				}

				// ── Accept anything that passed garbage + harm check ──
				// Vague answers are accepted — user can refine in Vision IQ panel
				differentiator = text;
				differentiatorQuality = result.tier;
				saveToLaunchpad();

				const affirmation = result.tier === 'good'
					? buildGoodAffirmation(text, businessType)
					: "You can refine your concept details later to sharpen your score. A strong angle adds 6-10 pts.";

				// C12: Coffee concepts get vision tier + street-level questions
				const isCoffeeConcept = businessType === 'specialty_coffee' || businessType === 'coffee_shop';
				if (isCoffeeConcept) {
					phase = 'q2b_vision_tier';
					setTimeout(() => {
						addBot(affirmation);
						setTimeout(() => addBot("Quick one — how would you describe your concept's uniqueness? This affects how we score your location."), 400);
					}, 300);
				} else {
					const params = new URLSearchParams(window.location.search);
					if (params.get('returnTo') === 'location') {
						const lp = loadLaunchPadData();
						const addr = lp.lastAddress || 'Unknown';
						handoff(addr);
					} else {
						phase = 'q3_budget';
						setTimeout(() => {
							addBot(affirmation);
							setTimeout(() => addBot("What's your rough budget to get started?"), 400);
						}, 300);
					}
				}
				break;
			}

			// C12: Vision tier selection (coffee only)
			case 'q2b_vision_tier': {
				const tierMatch = VISION_TIER_OPTIONS.find(o =>
					text.toLowerCase().includes(o.label.toLowerCase().split(' ')[0]) ||
					text.toLowerCase().includes(o.value.replace(/_/g, ' '))
				);
				if (tierMatch) {
					visionTier = tierMatch.value as typeof visionTier;
				} else {
					// Default to 'standard' if unrecognized
					visionTier = 'standard';
				}
				saveToLaunchpad();
				phase = 'q2c_street_level';
				setTimeout(() => {
					addBot("Is the space you're looking at on street level? Coffee shops need ground-floor foot traffic.");
				}, 300);
				break;
			}

			// D4: Street-level question (coffee only)
			case 'q2c_street_level': {
				const lower = text.toLowerCase();
				if (lower.includes('yes') || lower.includes('ground') || lower.includes('street')) {
					streetLevel = 'yes';
				} else if (lower.includes('no') || lower.includes('upper') || lower.includes('basement') || lower.includes('second')) {
					streetLevel = 'no';
				} else {
					streetLevel = 'unsure';
				}
				saveToLaunchpad();
				phase = 'q2d_avg_ticket';
				const streetNote = streetLevel === 'no'
					? "Good to know — that'll factor into your score. Upper-floor coffee is tough."
					: "Got it.";
				isTyping = true;
				setTimeout(() => {
					flushSync(() => { isTyping = false; addBot(`${streetNote} What's your average ticket price?`); });
				}, 500);
				break;
			}

			case 'q2d_avg_ticket': {
				// Parse ticket price from text input or chip selection
				const numMatch = text.match(/\$?(\d+(?:\.\d+)?)/);
				if (numMatch) {
					avgTicket = parseFloat(numMatch[1]);
				} else {
					// Try matching label keywords
					const lower = text.toLowerCase();
					if (lower.includes('budget')) avgTicket = 4.00;
					else if (lower.includes('ultra')) avgTicket = 12.00;
					else if (lower.includes('premium')) avgTicket = 8.50;
					else if (lower.includes('standard')) avgTicket = 6.00;
					else avgTicket = 5.00; // default
				}
				saveToLaunchpad();

				const params = new URLSearchParams(window.location.search);
				if (params.get('returnTo') === 'location') {
					const lp = loadLaunchPadData();
					const addr = lp.lastAddress || 'Unknown';
					handoff(addr);
					return;
				}

				phase = 'q3_budget';
				isTyping = true;
				setTimeout(() => {
					flushSync(() => { isTyping = false; addBot("What's your rough budget to get started?"); });
				}, 500);
				break;
			}

			case 'q3_budget':
				budget = text;
				saveToLaunchpad();
				phase = 'q4_rent';
				setTimeout(() => {
					addBot("Rent ceiling — what's the max monthly you can carry?");
				}, 300);
				break;

			case 'q4_rent':
				rentBudget = text;
				saveToLaunchpad();
				phase = 'q5_address';
				setTimeout(() => {
					addBot("Last one. Drop a street address — I'll score it.");
				}, 300);
				break;

			case 'q5_address':
				// Check if user wants to change concept
				if (/\b(switch|change|different|new|start over|start fresh|ice cream|bakery|restaurant|gym|fitness|bar|retail|florist|dentist|spa|bodega|boutique)\b/i.test(text)) {
					startOver();
				} else {
					// L3-fix: Assume the address is valid and proceed — never block here.
					// This path is a safety net for when the async geocoding path above
					// exits early. Either extractAddress finds a clean match, or we pass
					// the raw text; the server-side geocoder handles resolution.
					handoff(extractAddress(text) || text);
				}
				break;

		case 'q1b_restaurant_subtype':
			const subMatch = RESTAURANT_SUBTYPES.find(st => text.toLowerCase().includes(st.label.toLowerCase().split('/')[0].trim()));
			if (subMatch) {
				selectRestaurantSubtype(subMatch.key, subMatch.label);
			} else {
				setTimeout(() => addBot("Please choose: Full-Service, Fast Casual, Quick Service, or Café/Bakery."), 300);
			}
			break;

		case 'q1b_fitness_subtype':
			const fitSubMatch = FITNESS_SUBTYPES.find(st => text.toLowerCase().includes(st.label.toLowerCase().split('(')[0].trim().toLowerCase()));
			if (fitSubMatch) {
				selectFitnessSubtype(fitSubMatch.key, fitSubMatch.label);
			} else {
				setTimeout(() => addBot("Please choose from the options shown — boutique studio, CrossFit, gym, or personal training."), 300);
			}
			break;

		case 'q1b_retail_subtype':
			const retSubMatch = RETAIL_SUBTYPES.find(st => text.toLowerCase().includes(st.label.toLowerCase().split('/')[0].trim().toLowerCase()));
			if (retSubMatch) {
				selectRetailSubtype(retSubMatch.key, retSubMatch.label);
			} else {
				setTimeout(() => addBot("Please choose from the options shown — clothing, home goods, books, specialty food, or beauty."), 300);
			}
			break;

		case 'q1c_price_level':
			const plMatch = PRICE_LEVEL_OPTIONS.find(o => text.includes(o.value) || text.toLowerCase().includes(o.label.toLowerCase().split('—')[0].trim()));
			if (plMatch) {
				selectPriceLevel(plMatch.value, plMatch.label);
			} else {
				setTimeout(() => addBot("Please choose: $, $$, $$$, or $$$$."), 300);
			}
			break;

		case 'fit_q1':
			const ownerMatch = OWNER_TYPE_OPTIONS.find(o => text.toLowerCase().includes(o.label.toLowerCase()));
			if (ownerMatch) {
				answerFitQuestion('ownerType', ownerMatch.value, ownerMatch.label);
			} else {
				setTimeout(() => addBot("Please choose: Full-Time, Part-Time, Absentee, or Partnership."), 300);
			}
			break;

		case 'fit_q2':
			const riskMatch = RISK_TOLERANCE_OPTIONS.find(o => text.toLowerCase().includes(o.label.toLowerCase()));
			if (riskMatch) {
				answerFitQuestion('riskTolerance', riskMatch.value, riskMatch.label);
			} else {
				setTimeout(() => addBot("Please choose: Conservative, Moderate, or Aggressive."), 300);
			}
			break;

		case 'fit_q3':
			const expMatch = EXPERIENCE_OPTIONS.find(o => text.toLowerCase().includes(o.label.toLowerCase()));
			if (expMatch) {
				answerFitQuestion('experience', expMatch.value, expMatch.label);
			} else {
				setTimeout(() => addBot("Please choose: First-Time, Other Industry, Experienced, or Serial."), 300);
			}
			break;

		case 'fit_q4':
			const targetOptions = TARGET_CUSTOMER_OPTIONS[businessType] || TARGET_CUSTOMER_OPTIONS['default'];
			const customerMatch = targetOptions.find(o => text.toLowerCase().includes(o.label.toLowerCase()));
			if (customerMatch) {
				answerFitQuestion('targetCustomer', customerMatch.value, customerMatch.label);
			} else {
				const optionsList = targetOptions.map(o => o.label).join(', ');
				setTimeout(() => addBot(`Please choose from: ${optionsList}`), 300);
			}
			break;

		case 'fit_q5':
			const hoursMatch = OPERATING_HOURS_OPTIONS.find(o => text.toLowerCase().includes(o.label.toLowerCase().split('(')[0].trim()));
			if (hoursMatch) {
				answerFitQuestion('operatingHours', hoursMatch.value, hoursMatch.label);
			} else {
				setTimeout(() => addBot("Please choose from the options shown — or pick the one that best fits your planned opening hours."), 300);
			}
			break;

		case 'address_confirm':
			// User typed instead of clicking Yes/No
			if (/^(yes|yeah|yep|correct|that'?s? ?it|right)/i.test(text)) {
				const addr = addressConfirmResolved;
				addressConfirmResolved = '';
				handoff(addr);
			} else if (/^(no|nope|wrong|not|retype|different)/i.test(text)) {
				addressConfirmResolved = '';
				phase = 'q5_address';
				addBot("No problem — type the full address including the borough (e.g., 1 Manhattan West, Manhattan, NY).");
			} else {
				// They might be retyping the address directly — try geocoding it
				addressConfirmResolved = '';
				phase = 'q5_address';
				handleTextInput();
			}
			break;

		case 'address_disambiguate':
			// User typed instead of tapping a chip — try to match a candidate
			{
				const match = addressCandidates.find(c => text && c.toLowerCase().includes(text.toLowerCase().split(',')[0]));
				if (match) {
					addressCandidates = [];
					handoff(match);
				} else {
					addBot("Please tap one of the borough options above, or retype the full address including the borough (e.g., 101 Broadway, Manhattan).");
				}
			}
			break;

		case 'address_decision':
			// User types instead of clicking — check what they want
			if (/show.*score|score|location|skip|fast|quick/i.test(text)) {
				// They want to skip fit and go straight to scoring
				addUser("Show me the score!");
				const currentAddress = messages.find(m => m.role === 'user' && extractAddress(m.text))?.text || 'Unknown';
				const addr = extractAddress(currentAddress);
				setTimeout(() => {
					handoff(addr || 'Unknown Location', false);
				}, 300);
			} else if (/fit|full|analysis|deeper|questions/i.test(text)) {
				startFitQuestions();
			} else {
				setTimeout(() => addBot("Please choose: 'Show me the score!' to skip, or 'Let's do the full analysis' to answer fit questions."), 300);
			}
			break;
		}
	}

	// C12: Vision tier chip handler (coffee only)
	function selectVisionTier(value: string, label: string) {
		visionTier = value as typeof visionTier;
		addUser(label);
		saveToLaunchpad();
		phase = 'q2c_street_level';
		isTyping = true;
		setTimeout(() => {
			flushSync(() => { isTyping = false; addBot("Is the space you're looking at on street level? Coffee needs ground-floor foot traffic."); });
		}, 500);
	}

	// D4: Street-level chip handler (coffee only)
	function selectStreetLevel(value: string, label: string) {
		streetLevel = value as typeof streetLevel;
		addUser(label);
		saveToLaunchpad();
		phase = 'q2d_avg_ticket';
		isTyping = true;
		const note = value === 'no'
			? "Noted — upper-floor coffee is a tough model. That'll factor in."
			: "Got it.";
		setTimeout(() => {
			flushSync(() => { isTyping = false; addBot(`${note} What's your average ticket price?`); });
		}, 500);
	}

	// Addendum Item 1: Average ticket chip handler (coffee only)
	function selectAvgTicket(value: number, label: string) {
		avgTicket = value;
		addUser(label);
		saveToLaunchpad();
		const params = new URLSearchParams(window.location.search);
		if (params.get('returnTo') === 'location') {
			const lp = loadLaunchPadData();
			const addr = lp.lastAddress || 'Unknown';
			handoff(addr);
			return;
		}
		phase = 'q3_budget';
		isTyping = true;
		setTimeout(() => {
			flushSync(() => { isTyping = false; addBot("What's your rough budget to get started?"); });
		}, 500);
	}

	function selectBudget(value, label) {
		budget = value;
		addUser(label);
		saveToLaunchpad();
		phase = 'q4_rent';
		isTyping = true;
		setTimeout(() => {
			flushSync(() => { isTyping = false; addBot("Max monthly rent you'd pay?"); });
		}, 500);
	}

	function selectRent(value, label) {
		rentBudget = value;
		addUser(label);
		saveToLaunchpad();
		phase = 'q5_address';
		isTyping = true;
		setTimeout(() => {
			flushSync(() => { isTyping = false; addBot("Last one — drop a street address to score. (e.g., 384 Bedford Ave, Brooklyn)"); });
		}, 500);
	}

	function handleSkip() {
		addUser("Skip to scoring");
		// Mark step 2 (Your Plan) as skipped — it was bypassed, not completed
		skippedSteps = new Set([...skippedSteps, 2]);
		// CRITICAL: persist concept before navigating — skip bypasses normal saveToLaunchpad()
		// Without this, all non-coffee concepts default to coffee in the scoring pipeline
		if (businessType) {
			saveLaunchPadData({ businessType, businessName: businessTypeLabel });
			try {
				const session = JSON.parse(localStorage.getItem('re2_session') || '{}');
				session.bizType = businessType;
				session.concept = businessType;
				localStorage.setItem('re2_session', JSON.stringify(session));
			} catch {}
		}
		phase = 'q5_address';
		isTyping = true;
		setTimeout(() => {
			flushSync(() => { isTyping = false; addBot("Drop a street address to score. (e.g., 384 Bedford Ave, Brooklyn)"); });
		}, 500);
	}

	function startOver() {
		messages = [];
		phase = 'welcome';
		businessType = '';
		businessTypeLabel = '';
		differentiator = '';
		differentiatorAttempts = 0;
		differentiatorQuality = '';
		budget = '';
		rentBudget = '';
		inputValue = '';
		isReturning = false;
		existingConcept = '';
		// FIX: removeItem clears all launchpad fields — saveLaunchPadData only merges
		try { localStorage.removeItem('re2_launchpad'); } catch {}
		try { localStorage.removeItem('re2_persona'); } catch {}
		// FIX: Clear bizType fields from re2_session so initBot() doesn't see a returning user
		// Preserve location scores (locationIQ, sixScores) — only strip concept identity
		try {
			const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
			delete sess.bizType;
			delete sess.visionBizType;
			delete sess.personaType;
			delete sess.personaKey;
			delete sess.fitComplete;
			localStorage.setItem('re2_session', JSON.stringify(sess));
			window.dispatchEvent(new CustomEvent('re2:session-updated'));
		} catch {}
		setTimeout(initBot, 100);
	}

	// ── Init ──
	function initBot() {
		const lp = loadLaunchPadData();
		// MEDIUM-5: prefer session.bizType (most recently written) over launchpad which may be stale
		let sessionBizType = '';
		try {
			const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
			sessionBizType = sess.bizType || '';
		} catch {}
		const resolvedType = sessionBizType || lp.businessType;
		
		const params = new URLSearchParams(window.location.search);
		const step = params.get('step');
		const returnTo = params.get('returnTo');

		if (step === 'concept' && resolvedType && resolvedType !== 'Other') {
			// UX: User clicked "Edit Concept Details" from the location page
			isReturning = false; 
			businessType = resolvedType;
			businessTypeLabel = lp.businessName || resolvedType;
			existingConcept = businessTypeLabel;

			// Skip to price level question (start of vision questionnaire)
			phase = 'q1c_price_level';
			addBot("Let's refine your concept details to make the score more accurate.");
			isTyping = true;
			setTimeout(() => {
				flushSync(() => { isTyping = false; addBot("What's your price positioning?"); });
			}, 800);
			return;
		}

		if (resolvedType && resolvedType !== 'Other') {
			isReturning = true;
			existingConcept = lp.businessName || resolvedType;
			businessType = resolvedType;
			businessTypeLabel = lp.businessName || resolvedType;
			if (lp.differentiator) differentiator = lp.differentiator;

			// Load prior score data for briefing card and super-user message
			const scoredLocations = lp.scoredLocations || [];
			priorScoreCount = Array.isArray(scoredLocations) ? scoredLocations.length : (lp.lastScore ? 1 : 0);
			priorScoreAddress = lp.lastAddress || '';

			// Concept-aware returning hooks
			const hookKey = getHookKey(resolvedType);
			if (priorScoreCount > 1) {
				// Super-user: multiple analyses
				addBot(`Back again — I like the dedication. You've got ${priorScoreCount} locations in the system. Drop another address to expand your comparison.`);
			} else {
				// Standard returning with concept-aware hook
				const firstName = userName ? ` ${userName.split(' ')[0]}` : '';
				if (hookKey) {
					addBot(`Welcome back${firstName}. Last time you were building ${existingConcept || 'your concept'} — foot traffic data just updated. Drop an address and I'll score it.`);
				} else {
					addBot(`Welcome back${firstName}. Still building ${existingConcept || 'your concept'}? Drop an address and I'll score it.`);
				}
			}
			phase = 'q5_address';
		} else {
			// First-time user — concept-specific opener hook
			const hook = DEFAULT_HOOK;
			addBot(hook.opener);
			isTyping = true;
			setTimeout(() => {
				isTyping = false;
				addBot("What kind of business are you opening?");
				phase = 'q1_business';
			}, 800);
		}
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const isNewConcept = params.get('newConcept') === 'true' || params.get('fresh') === 'true';
		if (isNewConcept) {
			const url = new URL(window.location.href);
			url.searchParams.delete('newConcept');
			url.searchParams.delete('fresh');
			window.history.replaceState({}, '', url.toString());
			// MCONCEPT-01-A: Preserve scored locations before clearing concept data
			let preservedLocations: any[] = [];
			let preservedProfiles: any[] = [];
			try {
				const existing = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
				preservedLocations = existing.scoredLocations || [];
				preservedProfiles = existing.conceptProfiles || [];
			} catch {}
			// Clear concept-specific data
			try { localStorage.removeItem('re2_launchpad'); } catch {}
			try { localStorage.removeItem('re2_persona'); } catch {}
			try { localStorage.removeItem('re2_session'); } catch {}
			// Restore scored locations + concept profiles so previous concepts survive
			if (preservedLocations.length > 0 || preservedProfiles.length > 0) {
				try {
					localStorage.setItem('re2_launchpad', JSON.stringify({
						scoredLocations: preservedLocations,
						conceptProfiles: preservedProfiles,
					}));
				} catch {}
			}
		}
		initBot();

		// MutationObserver: scroll to bottom whenever chat content changes.
		// This catches chips/options that render after the message bubble
		// in a second reactive pass — timing-independent fix for iOS Safari.
		let scrollObserver: MutationObserver | null = null;
		const attachObserver = () => {
			if (scrollContainer && !scrollObserver) {
				scrollObserver = new MutationObserver(() => {
					scrollContainer.scrollTop = scrollContainer.scrollHeight;
				});
				scrollObserver.observe(scrollContainer, { childList: true, subtree: true });
			}
		};
		// scrollContainer may not be bound yet on first tick
		tick().then(attachObserver);

		return () => {
			if (scrollObserver) scrollObserver.disconnect();
		};
	});

	// Concept-aware differentiator bot messages (UX-DELTA-01: was hardcoded coffee example for all concepts)
	// Differentiator examples: bad/vague vs. good/specific
	// Used to coach users on what scores near-zero vs. high in Fit IQ
	const DIFFERENTIATOR_EXAMPLES: Record<string, { bad: string; good: string }> = {
		'specialty_coffee': {
			bad: 'Great coffee',
			good: 'Single-origin roastery, $6 cap, no-laptop policy'
		},
		'wellness_spa': {
			bad: 'Relaxation',
			good: 'Medical-grade facials, 30-min express treatments, membership model'
		},
		'fitness_studio': {
			bad: 'Good workouts',
			good: 'HIIT + recovery combo, 5am classes for finance workers, heart-rate tracking'
		},
		'bar_nightlife': {
			bad: 'Good drinks',
			good: 'Speakeasy craft cocktails, live jazz Thursdays, industry night pricing'
		},
		'full_service_restaurant': {
			bad: 'Good food',
			good: 'Farm-to-table prix fixe, open kitchen, natural wine only'
		},
		'fast_casual': {
			bad: 'Fresh ingredients',
			good: 'Build-your-own grain bowls, 90-second service, loyalty app with 20% repeat rate'
		},
		'qsr': {
			bad: 'Fast food',
			good: 'Halal-certified menu, drive-through + app ordering, $5 combo with real ingredients'
		},
		'bakery': {
			bad: 'Good bread',
			good: 'Sourdough-only menu, gluten-free line, 5am daily fresh, subscription model'
		},
		'retail': {
			bad: 'Nice products',
			good: 'Curated local designers only, personal styling appointments, pop-up rotation'
		},
		'coworking': {
			bad: 'Nice workspace',
			good: 'Soundproof podcast booths, member-only events, 24/7 access with bike storage'
		},
		'medical_office': {
			bad: 'Good care',
			good: 'Same-day appointments, bilingual staff, transparent pricing, no insurance needed'
		},
		'personal_services': {
			bad: 'Good service',
			good: 'Curly-hair specialist, organic products only, online booking with style gallery'
		},
		'juice_bar': {
			bad: 'Fresh juice',
			good: 'Cold-pressed daily, functional wellness shots, gym partnership discounts'
		},
		'wellness_beverage': {
			bad: 'Good tea',
			good: 'Ceremonial matcha bar, adaptogen menu, mindfulness space with hourly tastings'
		},
	};

	// Legacy bot message function for backward compatibility
	const DIFFERENTIATOR_BOT_MSG: Record<string, string> = {
		'specialty_coffee':   `"${DIFFERENTIATOR_EXAMPLES['specialty_coffee'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['specialty_coffee'].good}" scores high.`,
		'coffee_shop':        `"${DIFFERENTIATOR_EXAMPLES['specialty_coffee'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['specialty_coffee'].good}" scores high.`,
		'restaurant':         `"${DIFFERENTIATOR_EXAMPLES['full_service_restaurant'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['full_service_restaurant'].good}" scores high.`,
		'fast_casual':        `"${DIFFERENTIATOR_EXAMPLES['fast_casual'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['fast_casual'].good}" scores high.`,
		'bar_nightlife':      `"${DIFFERENTIATOR_EXAMPLES['bar_nightlife'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['bar_nightlife'].good}" scores high.`,
		'fitness_studio':     `"${DIFFERENTIATOR_EXAMPLES['fitness_studio'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['fitness_studio'].good}" scores high.`,
		'wellness_spa':       `"${DIFFERENTIATOR_EXAMPLES['wellness_spa'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['wellness_spa'].good}" scores high.`,
		'spa_wellness':       `"${DIFFERENTIATOR_EXAMPLES['wellness_spa'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['wellness_spa'].good}" scores high.`,
		'retail':             `"${DIFFERENTIATOR_EXAMPLES['retail'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['retail'].good}" scores high.`,
		'coworking':          `"${DIFFERENTIATOR_EXAMPLES['coworking'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['coworking'].good}" scores high.`,
		'medical_dental':     `"${DIFFERENTIATOR_EXAMPLES['medical_office'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['medical_office'].good}" scores high.`,
		'medical_office':     `"${DIFFERENTIATOR_EXAMPLES['medical_office'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['medical_office'].good}" scores high.`,
		'personal_services':  `"${DIFFERENTIATOR_EXAMPLES['personal_services'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['personal_services'].good}" scores high.`,
		'bakery':             `"${DIFFERENTIATOR_EXAMPLES['bakery'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['bakery'].good}" scores high.`,
		'barbershop':         `"${DIFFERENTIATOR_EXAMPLES['personal_services'].bad}" scores near zero. "${DIFFERENTIATOR_EXAMPLES['personal_services'].good}" scores high.`,
		'florist':            `"Nice flowers" scores near zero. "Subscription bouquets, same-day delivery, foraged seasonal-only arrangements" scores high.`,
	};

	// Concept-aware differentiator placeholders (P1-3: was coffee-specific for all concepts)
	const DIFFERENTIATOR_PLACEHOLDER = /** @type {Record<string, string>} */ ({
		'coffee_shop':    'e.g., Protein-infused coffee for the post-gym crowd',
		'restaurant':     'e.g., Farm-to-table tasting menu, BYOB-friendly',
		'fitness':        'e.g., 24/7 access, no-contract memberships',
		'retail':         'e.g., Curated vintage streetwear, Brooklyn-only brands',
		'bar':            'e.g., Craft cocktails with a vinyl listening room',
		'spa_wellness':   'e.g., Membership model, express 30-min treatments',
		'barbershop':     'e.g., No-appointment walk-ins, classic cuts $25',
		'florist':        'e.g., Subscription bouquets, same-day delivery',
		'medical_dental': 'e.g., Evening appointments, no insurance markup',
	});

	// Placeholder for input
	let inputPlaceholder = $derived(
		phase === 'q5_address' ? 'Start with a street number — e.g., 200 Bedford Ave, Brooklyn'
		: phase === 'q2_differentiator' ? (DIFFERENTIATOR_PLACEHOLDER[businessType] ?? 'e.g., What makes your concept unique?')
		: 'Type your answer...'
	);
</script>

<svelte:head>
	<title>RE² — Get Started</title>
</svelte:head>

<div class="onboarding-shell">
	<!-- ISS-06: NavigationDrawer replaces custom onboarding-topbar for nav consistency -->
	<NavigationDrawer />

	<!-- Three-column panel layout -->
	<div class="onboarding-layout">
	<!-- Progress Stepper Panel (Left) -->
	<aside class="progress-panel">
		<div class="progress-panel-inner">
			<div class="stepper-vertical">
				{#each steps as step, idx}
					{@const isCompleted = activeStep > step.id}
					{@const isCurrent = activeStep === step.id}
					{@const isFuture = activeStep < step.id}
					{@const isSkipped = skippedSteps.has(step.id)}
					<div class="stepper-item" class:completed={isCompleted && !isSkipped} class:skipped={isSkipped} class:current={isCurrent} class:future={isFuture}>
						<div class="stepper-dot">
							{#if isSkipped}
								<span class="skip-mark">–</span>
							{:else if isCompleted}
								<span class="check-mark">✓</span>
							{:else if isCurrent}
								<span class="pulse-dot"></span>
							{:else}
								<span class="future-dot"></span>
							{/if}
						</div>
						<div class="stepper-label">
							<div class="stepper-title">{step.title}</div>
							{#if isSkipped}
								<div class="stepper-subtitle skipped-label">Skipped</div>
							{:else if step.id === 4 && activeStep >= 4}
								<div class="stepper-progress">{fitQuestionsAnswered} of 5 questions</div>
							{:else}
								<div class="stepper-subtitle">{step.subtitle}</div>
							{/if}
						</div>
					</div>
					{#if idx < steps.length - 1}
						<div class="stepper-connector" class:active={isCompleted}></div>
					{/if}
				{/each}
			</div>

			<!-- What you'll unlock -->
			<div class="journey-unlock">
				<div class="journey-divider">
					<span class="journey-divider-label">What you'll unlock</span>
				</div>
				<div class="journey-items">
					<div class="journey-item ready">
						<div class="journey-dot">
							<svg viewBox="0 0 16 16" width="10" height="10" fill="none">
								<path d="M3 8.5L6.5 12L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</div>
						<div class="journey-label">
							<span class="journey-title">Business Plan</span>
							<span class="journey-tag ready-tag">Ready</span>
						</div>
					</div>
					<div class="journey-connector-mini"></div>
					<div class="journey-item soon">
						<div class="journey-dot"></div>
						<div class="journey-label">
							<span class="journey-title">Site IQ</span>
							<span class="journey-tag soon-tag">Soon</span>
						</div>
					</div>
					<div class="journey-connector-mini"></div>
					<div class="journey-item soon">
						<div class="journey-dot"></div>
						<div class="journey-label">
							<span class="journey-title">Loan Package</span>
							<span class="journey-tag soon-tag">Soon</span>
						</div>
					</div>
				</div>
			</div>

		</div>
	</aside>

	<!-- Live Recap Panel — updates in real-time as RE2D2 captures info -->
	<aside class="recap-panel">
		<div class="recap-header">
			<span class="recap-logo">RE<sup class="recap-super">²</sup></span>
			<span class="recap-badge">Live Recap</span>
		</div>

		<!-- Progress indicator -->
		<div class="recap-progress">
			<div class="progress-bar">
				<div class="progress-fill" style="width: {progressPercent}%"></div>
			</div>
			<span class="progress-label">{recapStep} of 6</span>
		</div>

		<!-- Recap sections — appear as data is captured -->
		<div class="recap-sections">
			{#if businessTypeLabel}
				<div class="recap-section filled">
					<div class="recap-section-header">
						<span class="recap-section-icon">💡</span>
						<span class="recap-section-title">Your Concept</span>
					</div>
					<div class="recap-value">{businessTypeLabel}</div>
					{#if priceLevel}
						<div class="recap-detail">{PRICE_LEVEL_OPTIONS.find(o => o.value === priceLevel)?.label || priceLevel}</div>
					{/if}
					{#if differentiator}
						<div class="recap-detail">"{differentiator}"</div>
					{/if}
				</div>
			{:else}
				<div class="recap-section empty">
					<div class="recap-section-header">
						<span class="recap-section-icon">💡</span>
						<span class="recap-section-title">Your Concept</span>
					</div>
					<div class="recap-placeholder">Waiting for your answer...</div>
				</div>
			{/if}

			{#if budget || rentBudget}
				<div class="recap-section filled">
					<div class="recap-section-header">
						<span class="recap-section-icon">💰</span>
						<span class="recap-section-title">Your Budget</span>
					</div>
					{#if budget}
						<div class="recap-value">Startup: {BUDGET_OPTIONS.find(o => o.value === budget)?.label || budget}</div>
					{/if}
					{#if rentBudget}
						<!-- LOW-2: label already contains /mo — do not append again -->
					<div class="recap-value">Rent: {RENT_OPTIONS.find(o => o.value === rentBudget)?.label || rentBudget}</div>
					{/if}
				</div>
			{:else if activeStep >= 3}
				<div class="recap-section empty">
					<div class="recap-section-header">
						<span class="recap-section-icon">💰</span>
						<span class="recap-section-title">Your Budget</span>
					</div>
					<!-- LOW-4: show Skipped if step 2 was skipped -->
					<div class="recap-placeholder">{skippedSteps.has(2) ? '— Skipped —' : 'Coming up next...'}</div>
				</div>
			{/if}

			{#if phase === 'q5_address' || phase === 'handoff'}
				<div class="recap-section {phase === 'handoff' ? 'filled' : 'empty'}">
					<div class="recap-section-header">
						<span class="recap-section-icon">📍</span>
						<span class="recap-section-title">Your Location</span>
					</div>
					{#if phase === 'handoff' && handoffAddress}
						<div class="recap-value">{handoffAddress}</div>
					{:else if phase === 'handoff'}
						<div class="recap-value">Scoring your location…</div>
					{:else}
						<div class="recap-placeholder">Drop an address to score</div>
					{/if}
				</div>
			{/if}

		{#if fitQuestionsAnswered > 0}
			<div class="recap-section filled">
				<div class="recap-section-header">
					<span class="recap-section-icon">⚡</span>
					<span class="recap-section-title">Your Fit Profile</span>
				</div>
				{#if fitAnswers.ownerType}
					<div class="fit-tag">{getFitLabel('ownerType', fitAnswers.ownerType)}</div>
				{/if}
				{#if fitAnswers.riskTolerance}
					<div class="fit-tag">{getFitLabel('riskTolerance', fitAnswers.riskTolerance)}</div>
				{/if}
				{#if fitAnswers.experience}
					<div class="fit-tag">{getFitLabel('experience', fitAnswers.experience)}</div>
				{/if}
				{#if fitAnswers.targetCustomer}
					<div class="fit-tag">{getFitLabel('targetCustomer', fitAnswers.targetCustomer)}</div>
				{/if}
				{#if fitAnswers.operatingHours}
					<div class="fit-tag">{getFitLabel('operatingHours', fitAnswers.operatingHours)}</div>
				{/if}
			</div>
		{/if}
		</div>

		<!-- UX-21: Trust signals during phases 1-4 -->
		{#if phase === 'welcome' || phase === 'q1_business' || phase === 'q1b_restaurant_subtype' || phase === 'q1b_fitness_subtype' || phase === 'q1b_retail_subtype' || phase === 'q1c_price_level' || phase === 'q2_differentiator' || phase === 'q3_budget' || phase === 'q4_rent'}
		<div class="recap-trust">
			<div class="trust-item">✓ No payment required</div>
			<div class="trust-item">✓ 20 live NYC data sources</div>
			<div class="trust-item">✓ Your data stays private</div>
			<div class="trust-item">✓ Results in under 2 min</div>
		</div>
		{/if}

		<div class="recap-footer">
			<p>Under 2 minutes. Your data is saved automatically.</p>
		</div>
	</aside>

	<!-- Chat Panel -->
	<div class="chat-panel">
		<!-- Header -->
		<div class="chat-header">
			<div class="header-left">
				<a href="/app/welcome-back" class="back-link" aria-label="Back to dashboard">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
				</a>
				<span class="online-dot"></span>
				<div class="header-info">
					<span class="header-name">RE2D2</span>
					<span class="header-role">Ask me anything about this address.</span>
				</div>
			</div>
			<div class="header-actions">
				{#if phase !== 'welcome' && phase !== 'q1_business' && phase !== 'handoff'}
					<!-- UX-25: skip button consistency -->
					<button class="skip-btn" onclick={handleSkip}>Skip to score →</button>
					<button class="change-concept-link" onclick={startOver}>Change concept</button>
				{/if}
			</div>
		</div>

		<!-- Messages -->
		<div class="chat-messages" bind:this={scrollContainer}>
			<div class="messages-inner">

				<!-- ── Mission Canvas: visible during early / address phases only ── -->
				{#if phase === 'welcome' || phase === 'q1_business' || (phase === 'q5_address' && isReturning)}
					<div class="mission-canvas">
						{#if isReturning}
							<!-- STATE 3: Returning user (standard or super-user) -->
							<div class="briefing-card briefing-state-3">
								<div class="briefing-badge briefing-badge-returning">WELCOME BACK</div>
								<p class="briefing-headline">{conceptDisplayName}</p>
								{#if priorScoreCount > 1}
									<!-- Super-user: multiple analyses -->
									<p class="briefing-subhead">{priorScoreCount} locations scored. Drop another to compare.</p>
									{#if priorScoreAddress}
										<div class="briefing-prior-list">
											<div class="briefing-prior-label">Your analyses</div>
											<div class="briefing-prior-item">
												<span class="briefing-prior-dot"></span>
												<span class="briefing-prior-addr">{priorScoreAddress}</span>
												<span class="briefing-prior-tag">Scored</span>
											</div>
											{#if priorScoreCount > 2}
												<div class="briefing-prior-item muted">
													<span class="briefing-prior-dot"></span>
													<span class="briefing-prior-addr">+{priorScoreCount - 1} more</span>
												</div>
											{/if}
										</div>
									{/if}
								{:else}
									<!-- Standard returning -->
									<p class="briefing-subhead">Ready to score a new location for this concept.</p>
									{#if priorScoreAddress}
										<div class="briefing-prior-list">
											<div class="briefing-prior-label">Last scored</div>
											<div class="briefing-prior-item">
												<span class="briefing-prior-dot"></span>
												<span class="briefing-prior-addr">{priorScoreAddress}</span>
											</div>
										</div>
									{/if}
								{/if}
							</div>
						{:else if businessType}
							<!-- STATE 2: Concept known, not yet returned -->
							<div class="briefing-card briefing-state-2">
								<div class="briefing-badge">LOCKED IN</div>
								<p class="briefing-headline">You're building <strong>{conceptDisplayName}</strong>.</p>
								<p class="briefing-subhead">RE²D2 will weight these signals for your concept:</p>
								<div class="briefing-chips">
									{#each conceptBriefingChips as chip}
										<span class="briefing-chip">
											<span class="briefing-chip-dot"></span>
											{chip}
										</span>
									{/each}
								</div>
							</div>
						{:else}
							<!-- STATE 1: First-time, no concept yet -->
							<div class="briefing-card briefing-state-1">
								<p class="briefing-headline">Your lease is your biggest bet.</p>

								<!-- Score hero text -->
								<div class="mb-equation">
									<div class="mb-eq-label">One score. 19 data sources. Your answer.</div>
									<div class="mb-eq-cta">We analyze foot traffic, competition, rent, demographics, safety, transit, and more — then calibrate everything to your specific concept. You get one number out of 100, a plain-English verdict, and the top 3 things you can do to improve your chances.</div>
								</div>

								<!-- UX-17: Example result card -->
								<div class="mb-example-card">
									<div class="mb-ex-label">What you'll get</div>
									<div class="mb-ex-scores">
										<div class="mb-ex-score">
											<div class="mb-ex-num" style="color:#1a3a2a">72</div>
											<div class="mb-ex-name">Score (B)</div>
										</div>
									</div>
									<div class="mb-ex-verdict">Viable. Plus the 3 things to fix.</div>
								</div>

								<!-- UX-17: Honest framing strip -->
								<div class="mb-honest-strip">We don't predict success. We give you a data-backed view of the risk — before you sign anything.</div>

								<!-- Social proof -->
								<div class="briefing-proof">
									<span>20 live data sources</span>
									<span class="bp-dot">·</span>
									<span>NYC-specific scoring</span>
									<span class="bp-dot">·</span>
									<span>~2 min</span>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				{#each messages as msg (msg.id)}
					<div class="bubble-row {msg.role}">
						{#if msg.role === 'bot'}
							<div class="avatar"><span class="avatar-text">D2</span></div>
						{/if}
						<div class="bubble {msg.role}">
							{sanitizeCopilotText(msg.text)}
						</div>
					</div>
				{/each}

				<!-- Typing indicator -->
				{#if isTyping}
					<div class="bubble-row bot" style="animation: fadeIn 0.2s ease-out">
						<div class="avatar"><span class="avatar-text">D2</span></div>
						<div class="typing-bubble">
							<span class="typing-dot"></span>
							<span class="typing-dot"></span>
							<span class="typing-dot"></span>
						</div>
					</div>
				{/if}

				<!-- Inline option cards based on phase -->
				{#if phase === 'q1_business' && messages.length >= 2}
					<div class="options-grid" style="animation: fadeIn 0.3s ease-out">
						{#each BUSINESS_TYPES as bt}
							<button class="option-chip" onclick={() => selectBusinessType(bt.key, bt.label)}>
								{bt.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if phase === 'q1b_restaurant_subtype'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						{#each RESTAURANT_SUBTYPES as st}
							<button class="option-chip" onclick={() => selectRestaurantSubtype(st.key, st.label)}>
								{st.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if phase === 'q1b_fitness_subtype'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						{#each FITNESS_SUBTYPES as st}
							<button class="option-chip" onclick={() => selectFitnessSubtype(st.key, st.label)}>
								{st.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if phase === 'q1b_retail_subtype'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						{#each RETAIL_SUBTYPES as st}
							<button class="option-chip" onclick={() => selectRetailSubtype(st.key, st.label)}>
								{st.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if phase === 'q1c_price_level'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						{#each PRICE_LEVEL_OPTIONS as pl}
							<button class="option-chip" onclick={() => selectPriceLevel(pl.value, pl.label)}>
								{pl.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if phase === 'q2b_vision_tier'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						{#each VISION_TIER_OPTIONS as opt}
							<button class="option-chip" onclick={() => selectVisionTier(opt.value, opt.label)}>
								{opt.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if phase === 'q2c_street_level'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						{#each STREET_LEVEL_OPTIONS as opt}
							<button class="option-chip" onclick={() => selectStreetLevel(opt.value, opt.label)}>
								{opt.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if phase === 'q2d_avg_ticket'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						{#each AVG_TICKET_OPTIONS as opt}
							<button class="option-chip" onclick={() => selectAvgTicket(opt.value, opt.label)}>
								{opt.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if phase === 'q3_budget'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						{#each BUDGET_OPTIONS as opt}
							<button class="option-chip" onclick={() => selectBudget(opt.value, opt.label)}>
								{opt.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if phase === 'q4_rent'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						{#each RENT_OPTIONS as opt}
							<button class="option-chip" onclick={() => selectRent(opt.value, opt.label)}>
								{opt.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if isReturning && phase === 'q5_address'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						<button class="option-chip outline" onclick={startOver}>Start fresh instead</button>
					</div>
				{/if}

				{#if phase === 'address_disambiguate' && addressCandidates.length > 0}
					<div class="options-row addr-disambig-row" style="animation: fadeIn 0.3s ease-out">
						{#each addressCandidates as candidate}
							<button class="option-chip addr-disambig-chip" onclick={() => {
								addUser(candidate);
								addressCandidates = [];
								handoff(candidate);
							}}>
								{candidate}
							</button>
						{/each}
						<button class="option-chip outline addr-retype-chip" onclick={() => {
							addressCandidates = [];
							phase = 'q5_address';
							addBot("No problem — type the full address including the borough (e.g., 101 Broadway, Manhattan, NY).");
						}}>
							None of these — let me retype
						</button>
					</div>
				{/if}

				{#if phase === 'address_confirm' && addressConfirmResolved}
					<div class="options-row addr-disambig-row" style="animation: fadeIn 0.3s ease-out">
						<button class="option-chip primary addr-disambig-chip" onclick={() => {
							addUser("Yes, that's it");
							const addr = addressConfirmResolved;
							addressConfirmResolved = '';
							handoff(addr);
						}}>
							Yes — {addressConfirmResolved.split(',')[0]}
						</button>
						<button class="option-chip outline addr-retype-chip" onclick={() => {
							addressConfirmResolved = '';
							phase = 'q5_address';
							addBot("No problem — type the full address including the borough (e.g., 1 Manhattan West, Manhattan, NY).");
						}}>
							No — let me retype
						</button>
					</div>
				{/if}

				{#if phase === 'duplicate_check'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						<button class="option-chip primary" onclick={() => {
							addUser("View my existing results");
							goto(duplicateExistingUrl);
						}}>
							View existing results →
						</button>
						<button class="option-chip outline" onclick={() => {
							addUser("Rescore with fresh data");
							duplicateExistingUrl = '';
							phase = 'address_decision';
							addBot("Got it — I'll run a fresh score. Want a quick result or the full analysis?");
						}}>
							Rescore with fresh data
						</button>
					</div>
				{/if}

				{#if phase === 'address_decision'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						<button class="option-chip primary" onclick={() => {
							addUser("Show me the score!");
							setTimeout(() => {
								handoff(selectedAddress || 'Unknown Location', false);
							}, 300);
						}}>
							Show me the score!
						</button>
						<button class="option-chip primary" onclick={startFitQuestions}>
							Let's do the full analysis
						</button>
					</div>
				{/if}

				{#if phase === 'fit_q1'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						{#each OWNER_TYPE_OPTIONS as opt}
							<button class="option-chip" onclick={() => answerFitQuestion('ownerType', opt.value, opt.label)}>
								{opt.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if phase === 'fit_q2'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						{#each RISK_TOLERANCE_OPTIONS as opt}
							<button class="option-chip" onclick={() => answerFitQuestion('riskTolerance', opt.value, opt.label)}>
								{opt.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if phase === 'fit_q3'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						{#each EXPERIENCE_OPTIONS as opt}
							<button class="option-chip" onclick={() => answerFitQuestion('experience', opt.value, opt.label)}>
								{opt.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if phase === 'fit_q4'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						{#each fitTargetOptions as opt}
							<button class="option-chip" onclick={() => answerFitQuestion('targetCustomer', opt.value, opt.label)}>
								{opt.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if phase === 'fit_q5'}
					<div class="options-row" style="animation: fadeIn 0.3s ease-out">
						{#each OPERATING_HOURS_OPTIONS as opt}
							<button class="option-chip" onclick={() => answerFitQuestion('operatingHours', opt.value, opt.label)}>
								{opt.label}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Input -->
		{#if phase !== 'handoff'}
			<div class="chat-input-container">
				<div class="input-wrapper">
					<form class="input-form" onsubmit={(e) => { e.preventDefault(); handleTextInput(); }}>
						<input
							type="text"
							class="chat-input"
							class:address-phase={phase === 'q5_address'}
							bind:value={inputValue}
							placeholder={inputPlaceholder}
							autocomplete="off"
							bind:this={chatInputEl}
						/>
						<button type="submit" class="send-btn" disabled={!inputValue.trim()}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
						</button>
					</form>
					{#if phase === 'q5_address'}
						<p class="address-coach-line">I'll check 20 live data sources — results in under 30 seconds.</p>
						<p class="social-proof-line">Built for NYC founders · 20 live data sources · results in 2 min</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>
	</div>
</div>

<style>
	/* ═══════════ SHELL (topbar + panels) ═══════════ */
	.onboarding-shell {
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
		background: var(--bg);
	}

	/* ═══════════ TOPBAR ═══════════ */
	.onboarding-topbar {
		height: 54px;
		min-height: 54px;
		background: #1e3a2a;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 28px;
		flex-shrink: 0;
		border-bottom: 1px solid rgba(255,255,255,0.08);
	}

	.topbar-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.topbar-logo {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 700;
		color: rgba(255,255,255,0.95);
		letter-spacing: -0.3px;
	}

	.topbar-sup {
		font-size: 11px;
		color: #a8d4b6;
		vertical-align: super;
	}

	.topbar-divider {
		color: rgba(255,255,255,0.3);
		font-size: 16px;
		font-weight: 300;
	}

	.topbar-subtitle {
		font-size: 11px;
		font-weight: 600;
		color: rgba(255,255,255,0.70);
		letter-spacing: 0.5px;
		text-transform: none;
		font-style: italic;
	}

	.topbar-right {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.topbar-firstname {
		font-size: 13px;
		font-weight: 500;
		color: rgba(255,255,255,0.75);
	}

	.topbar-avatar {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: rgba(255,255,255,0.12);
		border: 1.5px solid rgba(255,255,255,0.2);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.topbar-initials {
		font-size: 11px;
		font-weight: 700;
		color: rgba(255,255,255,0.85);
		letter-spacing: 0.5px;
	}

	/* ═══════════ LAYOUT ═══════════ */
	.onboarding-layout {
		display: flex;
		flex: 1;
		overflow: hidden;
		background: var(--bg);
		color: var(--text);
		font-family: var(--font-body);
		flex-direction: row;
		--bg-bot-bubble: #f0ece4;
	}

	/* ═══════════ PROGRESS PANEL (left) ═══════════ */
	.progress-panel {
		width: 200px;
		min-width: 150px;
		background: var(--bg-surface);
		border-right: 1px solid var(--border-warm);
		display: flex;
		flex-direction: column;
		padding: 28px 20px;
		flex-shrink: 0;
		order: 1;
		overflow-y: auto;
	}

	.progress-panel-inner {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.stepper-vertical {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.stepper-item {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		cursor: pointer;
		transition: opacity 0.2s;
	}

	.stepper-item:hover {
		opacity: 0.8;
	}

	.stepper-dot {
		flex-shrink: 0;
		min-width: 26px;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 12px;
		background: #ede8e0;
		color: var(--text-muted);
		transition: all 0.3s;
	}

	/* Completed dot: sage with white checkmark */
	.stepper-item.completed .stepper-dot {
		background: var(--accent);
		color: white;
	}

	.check-mark {
		font-size: 16px;
		color: white;
		line-height: 1;
	}

	/* Skipped step: grey dashed dot with dash icon */
	.stepper-item.skipped .stepper-dot {
		background: #f0f0ee;
		border: 1.5px dashed #aaa;
		color: #888;
	}
	.skip-mark {
		font-size: 18px;
		color: #aaa;
		line-height: 1;
		font-weight: 700;
	}
	.skipped-label {
		color: #aaa;
		font-style: italic;
	}
	.stepper-item.skipped .stepper-title {
		color: #999;
	}

	/* Active/current dot: sage ring with white fill */
	.stepper-item.current .stepper-dot {
		background: var(--bg-surface);
		border: 2px solid var(--accent);
		box-shadow: 0 0 0 4px rgba(74,124,92,0.12);
	}

	.pulse-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--accent);
		animation: pulse 2s ease-in-out infinite;
	}

	/* Future dot: gray with number */
	.future-dot {
		color: var(--text-muted);
		font-size: 12px;
		font-weight: 600;
	}

	.stepper-label {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.stepper-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
		line-height: 1.3;
	}

	.stepper-item.future .stepper-title {
		color: var(--text-muted);
		font-weight: 400;
	}

	.stepper-item.current .stepper-title {
		color: var(--accent);
		font-weight: 700;
	}

	.stepper-item.completed .stepper-title {
		color: var(--accent);
	}

	.stepper-subtitle {
		font-size: 11px;
		color: var(--text-muted);
		margin-top: 2px;
		line-height: 1.3;
	}

	.stepper-progress {
		font-size: 11px;
		color: var(--text-muted);
		margin-top: 4px;
	}

	.stepper-connector {
		width: 2px;
		height: 20px;
		background: var(--border-warm);
		margin-left: 11px;
	}

	.stepper-connector.active,
	.stepper-connector.done {
		background: var(--accent);
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	/* ═══════════ JOURNEY UNLOCK (below stepper) ═══════════ */
	.journey-unlock {
		margin-top: 28px;
		padding-top: 0;
	}

	.journey-divider {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
	}

	.journey-divider::before {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border-warm);
	}

	.journey-divider-label {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.journey-items {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.journey-item {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.journey-dot {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.journey-item.ready .journey-dot {
		background: #dcfce7;
		color: #16a34a;
	}

	.journey-item.soon .journey-dot {
		background: transparent;
		border: 1.5px dashed #d1d5db;
	}

	.journey-connector-mini {
		width: 1.5px;
		height: 12px;
		background: var(--border-warm);
		margin-left: 9px;
	}

	.journey-label {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
	}

	.journey-title {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.journey-item.soon .journey-title {
		color: var(--text-muted);
	}

	.journey-tag {
		font-size: 8px;
		font-weight: 800;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		padding: 1px 5px;
		border-radius: 3px;
	}

	.ready-tag {
		background: #dcfce7;
		color: #16a34a;
	}

	.soon-tag {
		background: #f3f4f6;
		color: #9ca3af;
	}

	/* ═══════════ CHAT PANEL (center) ═══════════ */
	.chat-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--bg-surface);
		border-right: 1px solid var(--border-warm);
		order: 2;
	}

	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px;
		height: 56px;
		background: var(--bg-surface);
		border-bottom: 1px solid var(--border-warm);
		flex-shrink: 0;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.back-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		color: var(--text-secondary);
		text-decoration: none;
		transition: background 0.2s;
	}

	.back-link:hover {
		background: var(--bg);
	}

	.online-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #5eb87a;
		border: 2px solid var(--bg-surface);
		flex-shrink: 0;
	}

	.header-info {
		display: flex;
		flex-direction: column;
	}

	.header-name {
		font-size: 15px;
		font-weight: 700;
		color: var(--text);
	}

	.header-role {
		font-size: 11px;
		color: var(--text-muted);
		margin-top: -1px;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.skip-btn {
		background: none;
		border: none;
		color: var(--accent);
		cursor: pointer;
		font-size: 13px;
		font-weight: 600;
		font-family: var(--font-body);
		transition: color 0.15s;
		text-decoration: underline;
		text-decoration-color: transparent;
	}

	.skip-btn:hover {
		color: var(--accent-deep-green);
		text-decoration-color: currentColor;
	}

	.header-action {
		background: none;
		border: none;
		color: var(--accent);
		cursor: pointer;
		font-size: 13px;
		font-weight: 600;
		font-family: var(--font-body);
		transition: color 0.15s;
		text-decoration: underline;
		text-decoration-color: transparent;
	}

	.header-action:hover {
		color: var(--accent-deep-green);
		text-decoration-color: currentColor;
	}

	.change-concept-link {
		background: none;
		border: none;
		color: #9ca3af;
		cursor: pointer;
		font-size: 11px;
		font-weight: 400;
		font-family: var(--font-body);
		text-decoration: underline;
		text-decoration-color: rgba(156,163,175,0.4);
		transition: color 0.15s;
		padding: 0;
	}

	.change-concept-link:hover {
		color: #6b7280;
		text-decoration-color: currentColor;
	}

	/* ═══════════ MESSAGES ═══════════ */
	.chat-messages {
		flex: 1;
		overflow-y: auto;
		scroll-behavior: smooth;
	}

	.messages-inner {
		padding: 32px 28px;
		min-height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 20px;
		max-width: 680px;
		margin: 0 auto;
		width: 100%;
	}

	.bubble-row {
		display: flex;
		gap: 12px;
		animation: slideIn 0.3s ease-out;
	}

	.bubble-row.bot {
		justify-content: flex-start;
	}

	.bubble-row.user {
		justify-content: flex-end;
	}

	@keyframes slideIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.avatar {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: var(--accent);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-top: 2px;
		box-shadow: 0 0 0 2px rgba(74,124,92,0.15);
	}

	.avatar-text {
		font-size: 10px;
		font-weight: 700;
		color: white;
		letter-spacing: -0.3px;
	}

	.bubble {
		max-width: 72%;
		padding: 12px 16px;
		border-radius: 14px;
		font-size: 15px;
		line-height: 1.6;
	}

	/* Bot bubble: warm off-white with sage left border */
	.bubble.bot {
		background: var(--bg-bot-bubble);
		color: var(--text);
		border-radius: 4px 14px 14px 14px;
		border-left: 2px solid var(--accent);
	}

	/* User bubble: deep green */
	.bubble.user {
		background: var(--accent-deep-green);
		color: rgba(255,255,255,0.92);
		border-radius: 14px 4px 14px 14px;
		font-weight: 500;
	}

	/* Typing indicator */
	.typing-bubble {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 12px 16px;
		background: var(--bg-bot-bubble);
		border-radius: 4px 14px 14px 14px;
		border-left: 2px solid var(--accent);
		min-width: 52px;
	}

	.typing-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent);
		opacity: 0.4;
		animation: typingPulse 1.2s ease-in-out infinite;
	}

	.typing-dot:nth-child(2) { animation-delay: 0.2s; }
	.typing-dot:nth-child(3) { animation-delay: 0.4s; }

	@keyframes typingPulse {
		0%, 60%, 100% { opacity: 0.4; transform: scale(1); }
		30% { opacity: 1; transform: scale(1.2); }
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ═══════════ OPTIONS / CHIPS ═══════════ */
	.options-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
		padding-left: 44px;
	}

	.options-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
		padding-left: 44px;
	}

	.option-chip {
		padding: 10px 20px;
		border: 1.5px solid var(--border-warm);
		border-radius: 8px;
		background: var(--bg-surface);
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		color: var(--text);
		font-family: var(--font-body);
		transition: all 0.15s;
		white-space: nowrap;
		/* P3-06 FIX: remove 300ms tap delay on iOS and ensure :active fires on touch */
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	.option-chip:hover {
		border-color: var(--accent);
		background: rgba(74,124,92,0.06);
		color: var(--accent);
	}
	/* P3-06 FIX: :active fires on iOS tap — gives immediate visual feedback */
	.option-chip:active {
		border-color: var(--accent);
		background: rgba(74,124,92,0.12);
		color: var(--accent);
		transform: scale(0.97);
	}

	.option-chip.primary {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
		font-weight: 600;
	}

	.option-chip.primary:hover {
		background: var(--accent-deep-green);
		border-color: var(--accent-deep-green);
	}

	.option-chip.selected {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
		font-weight: 600;
	}

	.option-chip.outline {
		background: transparent;
		border-style: dashed;
		color: var(--text-muted);
	}

	.option-chip.outline:hover {
		border-color: var(--text-secondary);
		color: var(--text);
	}

	/* ═══════════ INPUT AREA ═══════════ */
	.chat-input-container {
		padding: 16px 28px 20px;
		border-top: 1px solid var(--border-warm);
		background: var(--bg-surface);
		flex-shrink: 0;
		display: flex;
		justify-content: center;
	}

	.input-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		max-width: 640px;
		gap: 6px;
	}

	.address-coach-line {
		font-size: 11px;
		color: #4a7c5c;
		margin: 6px 0 2px;
		text-align: center;
		letter-spacing: 0.1px;
		animation: fadeIn 0.4s ease-out;
	}

	.social-proof-line {
		font-size: 10px;
		color: #b0a89f;
		margin: 0;
		text-align: center;
		letter-spacing: 0.2px;
		animation: fadeIn 0.4s ease-out;
	}

	/* Remove max-width from input-form since input-wrapper now controls it */
	.input-form {
		display: flex;
		gap: 8px;
		align-items: center;
		width: 100%;
		max-width: unset;
	}

	.chat-input {
		flex: 1;
		padding: 10px 14px;
		border: 1.5px solid var(--border-warm);
		border-radius: 8px;
		font-size: 16px; /* 16px prevents iOS zoom */
		font-family: var(--font-body);
		color: var(--text);
		background: var(--bg);
		outline: none;
		transition: border-color 0.2s;
	}

	.chat-input:focus {
		border-color: var(--accent);
		background: var(--bg-surface);
	}

	.chat-input::placeholder {
		color: var(--text-muted);
	}

	/* Elevated address input when scoring phase is active */
	.chat-input.address-phase {
		padding: 12px 16px;
		border-left: 3px solid var(--accent);
		border-color: rgba(74,124,92,0.35);
		border-left-color: var(--accent);
		background: var(--bg-surface);
		font-size: 15px;
		font-weight: 500;
	}

	.chat-input.address-phase:focus {
		border-color: rgba(74,124,92,0.5);
		border-left-color: var(--accent);
		border-left-width: 3px;
		box-shadow: 0 2px 12px rgba(74,124,92,0.1);
	}

	.send-btn {
		width: 40px;
		height: 40px;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
		flex-shrink: 0;
	}

	.send-btn:hover:not(:disabled) {
		background: var(--accent-deep-green);
	}

	.send-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* ═══════════ MISSION BRIEFING CARD ═══════════ */
	.mission-canvas {
		margin-bottom: 16px;
		flex-shrink: 0;
	}

	.briefing-card {
		border-radius: 10px;
		padding: 16px;
		margin-bottom: 20px;
	}

	.briefing-state-1 {
		background: #f0f7f3;
		border: 1.5px solid #1e3a2a;
		color: #1e3a2a;
		box-shadow: 0 2px 8px rgba(30,58,42,0.10);
		padding: 12px;
	}

	.briefing-state-2 {
		background: #e8f0ea;
		border: 1px solid #c4d8c9;
		color: #1e3a2a;
	}

	.briefing-state-3 {
		background: #1e3a2a;
		color: rgba(255,255,255,0.9);
	}

	.briefing-badge {
		display: inline-block;
		padding: 3px 8px;
		border-radius: 4px;
		background: #1e3a2a;
		color: #a8d4b6;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		margin-bottom: 10px;
	}

	.briefing-state-3 .briefing-badge {
		color: #a8d4b6;
	}

	.briefing-badge-returning {
		color: #fbbf24;
	}

	.briefing-headline {
		font-size: 15px;
		font-weight: 800;
		line-height: 1.3;
		margin: 0 0 10px;
		color: inherit;
		letter-spacing: -0.2px;
	}

	.briefing-state-2 .briefing-headline {
		color: #1e3a2a;
	}

	.briefing-state-2 .briefing-headline strong {
		color: #2d5a3d;
	}

	.briefing-subhead {
		font-size: 11px;
		color: #4a7c5c;
		margin: 0 0 10px;
		line-height: 1.4;
	}

	/* State 3 (dark card): override subhead back to white */
	.briefing-state-3 .briefing-subhead {
		color: rgba(255,255,255,0.6);
	}

	.briefing-state-2 .briefing-subhead {
		color: #4a7c5c;
	}

	/* Stats row (state 1) */
	.briefing-stats {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 10px 0 12px;
	}

	.briefing-stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.briefing-stat-num {
		font-size: 18px;
		font-weight: 800;
		color: #1e3a2a;
		line-height: 1;
	}

	.briefing-stat-label {
		font-size: 9px;
		color: #4a7c5c;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.briefing-stat-divider {
		width: 1px;
		height: 28px;
		background: #c4d8c9;
	}

	/* Score preview wheels (state 1) */
	.score-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		padding: 4px 0 8px;
	}
	.score-preview-hero { display: flex; justify-content: center; }
	.score-preview-pair { display: flex; gap: 20px; justify-content: center; }

	.score-wheel-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
	}
	.score-wheel {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 2px dashed #a8c4a8;
		background: rgba(255,255,255,0.04);
	}
	.wheel-large  { width: 84px; height: 84px; gap: 2px; }
	.wheel-small  { width: 58px; height: 58px; gap: 1px; }

	.wheel-label {
		font-size: 6.5px;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: #7aa87a;
	}
	.wheel-value {
		font-size: 24px;
		font-weight: 700;
		color: #9aba9a;
		line-height: 1;
	}
	.wheel-small .wheel-value { font-size: 17px; }

	.wheel-caption {
		font-size: 10px;
		color: #7a9a7a;
		text-align: center;
		max-width: 72px;
		line-height: 1.3;
		margin: 0;
	}
	.wheel-small + .wheel-caption { max-width: 54px; }

	.briefing-foot {
		font-size: 10px;
		color: #4a7c5c;
		margin: 6px 0 0;
	}

	/* ── Score Triptych: horizontal 3-up locked preview (replaces triangle layout) ── */
	.score-triptych {
		display: flex;
		align-items: flex-start;
		justify-content: space-around;
		margin: 14px 0 6px;
	}
	.triptych-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		flex: 1;
	}
	.triptych-ring-wrap {
		position: relative;
		width: 64px;
		height: 64px;
	}
	.triptych-ring-wrap svg {
		display: block;
	}
	.triptych-val {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-size: 20px;
		font-weight: 700;
		color: #9aba9a;
		line-height: 1;
		pointer-events: none;
	}
	.triptych-name {
		font-size: 8.5px;
		font-weight: 800;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: #1e3a2a;
		line-height: 1;
	}
	.triptych-desc {
		font-size: 10px;
		color: #3d6b52;
		text-align: center;
		line-height: 1.3;
		margin: 0;
	}

	/* State 1: mission brief intro line (loss aversion copy) */
	.briefing-intro {
		font-size: 12px;
		color: #1e3a2a;
		margin: 0 0 12px;
		line-height: 1.4;
		font-weight: 600;
		font-style: normal;
	}

	/* Pulsing ring animation — triggers orienting response (movement = live signal) */
	@keyframes ring-breathe {
		0%, 100% { opacity: 0.65; }
		50% { opacity: 1; }
	}
	.ring-fill {
		animation: ring-breathe 2.4s ease-in-out infinite;
	}
	.ring-fill-2 {
		animation: ring-breathe 2.4s ease-in-out infinite;
		animation-delay: 0.6s;
	}
	.ring-fill-3 {
		animation: ring-breathe 2.4s ease-in-out infinite;
		animation-delay: 1.2s;
	}

	/* Social proof bar below triptych */
	.briefing-proof {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: 9.5px;
		color: #4a7c5c;
		font-weight: 600;
		flex-wrap: wrap;
		justify-content: center;
		padding: 5px 8px;
		background: rgba(30,58,42,0.06);
		border-radius: 6px;
	}
	.bp-dot {
		color: #9aba9a;
	}

	/* UX-17: Example result card */
	.mb-example-card {
		background: #f9f7f4;
		border: 1px solid #e8e2d8;
		border-radius: 8px;
		padding: 10px 12px;
		margin: 8px 0 6px;
	}
	.mb-ex-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 8px; }
	.mb-ex-scores { display: flex; gap: 12px; justify-content: center; margin-bottom: 6px; }
	.mb-ex-score { text-align: center; }
	.mb-ex-num { font-size: 22px; font-weight: 800; line-height: 1; }
	.mb-ex-name { font-size: 9px; font-weight: 600; color: #6b7280; margin-top: 2px; }
	.mb-ex-verdict { font-size: 10px; color: #4b5563; text-align: center; font-style: italic; }

	/* UX-17: Honest framing strip */
	.mb-honest-strip {
		font-size: 10px; color: #78716c; text-align: center;
		padding: 6px 8px; margin: 4px 0 6px;
		border-top: 1px dashed #e8e2d8;
		line-height: 1.4;
	}

	.briefing-start-cue {
		font-size: 10px;
		font-weight: 600;
		color: #1e3a2a;
		text-align: center;
		margin-top: 12px;
		letter-spacing: 0.2px;
		opacity: 0.8;
	}

	/* ── STATE 1: Score cards ── */
	.mb-score-cards {
		display: flex;
		flex-direction: column;
		gap: 7px;
		margin: 12px 0 14px;
	}
	.mb-score-card {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		background: rgba(255,255,255,0.6);
		border: 1px solid rgba(30,58,42,0.15);
		border-left: 3px solid #1e3a2a;
		border-radius: 6px;
		padding: 9px 10px;
	}
	.mb-score-icon {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		background: rgba(30,58,42,0.08);
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 1px;
	}
	.mb-score-body {
		flex: 1;
		min-width: 0;
	}
	.mb-score-name {
		font-size: 11px;
		font-weight: 800;
		color: #1e3a2a;
		letter-spacing: 0.02em;
		margin-bottom: 2px;
	}
	.mb-score-desc {
		font-size: 10px;
		color: #3d6b52;
		line-height: 1.4;
	}
	.mb-score-badge {
		flex-shrink: 0;
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.6px;
		text-transform: uppercase;
		color: #4a7c5c;
		background: rgba(30,58,42,0.08);
		border-radius: 3px;
		padding: 2px 5px;
		margin-top: 2px;
		white-space: nowrap;
	}
	.mb-score-card-fitiq {
		border-left-color: #1e3a2a;
		border-left-width: 3px;
		background: rgba(255,255,255,0.85);
	}

	/* ── Equation callout ── */
	.mb-equation {
		background: #1e3a2a;
		border-radius: 10px;
		padding: 13px 12px 11px;
		margin-bottom: 10px;
	}
	.mb-eq-label {
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 2px;
		text-transform: uppercase;
		color: #7ecba0;
		margin-bottom: 11px;
		text-align: center;
	}
	.mb-eq-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		margin-bottom: 11px;
	}
	.mb-eq-block {
		text-align: center;
		flex: 1;
		background: rgba(255,255,255,0.10);
		border-radius: 7px;
		padding: 9px 6px;
	}
	.mb-eq-name {
		font-size: 15px;
		font-weight: 900;
		color: #fff;
		letter-spacing: -0.3px;
		line-height: 1.15;
	}
	.mb-eq-sub {
		font-size: 9px;
		color: #a8d4b6;
		margin-top: 4px;
		font-weight: 500;
		line-height: 1.3;
	}
	.mb-eq-result {
		background: #fff;
		border-radius: 7px;
		padding: 9px 6px;
		flex: 1;
	}
	.mb-eq-result .mb-eq-name {
		color: #1e3a2a;
		font-size: 17px;
	}
	.mb-eq-result .mb-eq-sub {
		color: #4a7c5c;
	}
	.mb-eq-op {
		font-size: 24px;
		font-weight: 900;
		color: #7ecba0;
		flex-shrink: 0;
		line-height: 1;
	}
	.mb-eq-copy {
		font-size: 10.5px;
		color: #a8d4b6;
		line-height: 1.5;
		text-align: center;
		border-top: 1px solid rgba(255,255,255,0.15);
		padding-top: 10px;
		font-weight: 500;
		margin-bottom: 6px;
	}
	.mb-eq-cta {
		font-size: 13px;
		font-weight: 800;
		color: #fff;
		text-align: center;
		line-height: 1.3;
	}

	/* ── Borough disambiguation chips ── */
	.addr-disambig-row {
		flex-direction: column;
		align-items: stretch;
	}
	.addr-disambig-chip {
		text-align: left;
		font-size: 11px;
		white-space: normal;
		word-break: break-word;
	}
	.addr-retype-chip {
		font-size: 10px;
		color: #4a7c5c;
	}

	/* Concept chips (state 2) */
	.briefing-chips {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.briefing-chip {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 11px;
		font-weight: 500;
		color: #2d5a3d;
	}

	.briefing-chip-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #4a7c5c;
		flex-shrink: 0;
	}

	/* Prior analyses list (state 3) */
	.briefing-prior-list {
		margin-top: 10px;
		padding: 10px;
		background: rgba(255,255,255,0.07);
		border-radius: 6px;
	}

	.briefing-prior-label {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: rgba(255,255,255,0.4);
		margin-bottom: 7px;
	}

	.briefing-prior-item {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 11px;
		color: rgba(255,255,255,0.8);
		margin-bottom: 4px;
	}

	.briefing-prior-item.muted {
		color: rgba(255,255,255,0.4);
		font-style: italic;
	}

	.briefing-prior-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #a8d4b6;
		flex-shrink: 0;
	}

	.briefing-prior-addr {
		flex: 1;
		font-size: 11px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.briefing-prior-tag {
		font-size: 8px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #a8d4b6;
		padding: 1px 5px;
		border-radius: 3px;
		border: 1px solid rgba(168,212,182,0.3);
		white-space: nowrap;
	}

	/* ═══════════ RECAP PANEL (right) ═══════════ */
	.recap-panel {
		width: 280px;
		min-width: 220px;
		background: var(--bg);
		padding: 28px 20px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		order: 3;
		border-left: 1px solid var(--border-warm);
	}

	.recap-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
	}

	.recap-logo {
		font-family: var(--font-display);
		font-size: 17px;
		color: var(--text);
	}

	.recap-super {
		color: var(--accent-pink);
		font-size: 10px;
		vertical-align: super;
	}

	.recap-badge {
		background: var(--accent);
		color: white;
		padding: 3px 9px;
		border-radius: 6px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.5px;
	}

	.recap-progress {
		margin-bottom: 20px;
	}

	.progress-track,
	.progress-bar {
		height: 4px;
		background: var(--border-warm);
		border-radius: 2px;
		overflow: hidden;
		margin-bottom: 6px;
	}

	.progress-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 2px;
		transition: width 0.4s ease;
	}

	.progress-label {
		font-size: 11px;
		color: var(--text-muted);
		font-weight: 500;
	}

	.recap-sections {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.recap-section {
		background: var(--bg-surface);
		border-radius: 10px;
		padding: 14px 16px;
		border: 1px solid var(--border-warm);
		box-shadow: var(--shadow-resting);
		transition: all 0.3s ease;
	}

	.recap-section.filled {
		border-left: 3px solid var(--accent);
	}

	.recap-section.empty {
		border: 1px dashed var(--border-warm);
		opacity: 0.7;
	}

	.recap-section-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 7px;
	}

	.recap-section-icon {
		font-size: 16px;
	}

	.recap-section-title {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.8px;
	}

	.recap-icon {
		width: 16px;
		height: 16px;
		color: var(--accent);
		flex-shrink: 0;
	}

	.recap-value {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 4px;
		line-height: 1.4;
	}

	.recap-detail {
		font-size: 12px;
		color: var(--text-secondary);
		font-style: italic;
		line-height: 1.4;
	}

	.recap-placeholder {
		font-size: 13px;
		color: var(--text-muted);
		font-style: italic;
	}

	.fit-tag {
		display: inline-block;
		padding: 4px 10px;
		background: rgba(74,124,92,0.08);
		border: 1px solid rgba(74,124,92,0.2);
		border-radius: 12px;
		font-size: 11px;
		font-weight: 600;
		color: var(--accent);
		margin: 2px 4px 2px 0;
		text-transform: capitalize;
	}

	/* UX-21: Trust signals panel */
	.recap-trust {
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 10px 14px;
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 8px;
		margin-bottom: 10px;
	}
	.trust-item { font-size: 11px; color: #15803d; font-weight: 600; }

	.recap-footer {
		background: var(--bg-surface);
		border-radius: 10px;
		padding: 12px 16px;
		border: 1px solid var(--border-warm);
		text-align: center;
		margin-top: auto;
	}

	.recap-footer p {
		font-size: 11px;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.5;
	}

	/* ═══════════ SCROLLBAR STYLING ═══════════ */
	.chat-messages::-webkit-scrollbar,
	.progress-panel::-webkit-scrollbar,
	.recap-panel::-webkit-scrollbar {
		width: 6px;
	}

	.chat-messages::-webkit-scrollbar-track,
	.progress-panel::-webkit-scrollbar-track,
	.recap-panel::-webkit-scrollbar-track {
		background: transparent;
	}

	.chat-messages::-webkit-scrollbar-thumb,
	.progress-panel::-webkit-scrollbar-thumb,
	.recap-panel::-webkit-scrollbar-thumb {
		background: var(--border-warm);
		border-radius: 3px;
	}

	.chat-messages::-webkit-scrollbar-thumb:hover,
	.progress-panel::-webkit-scrollbar-thumb:hover,
	.recap-panel::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted);
	}

	/* ═══════════ ANIMATIONS ═══════════ */
	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ═══════════ RESPONSIVE ═══════════ */
	@media (max-width: 1024px) {
		.progress-panel {
			width: 160px;
			min-width: 120px;
			padding: 24px 12px;
		}
		.recap-panel {
			width: 240px;
			min-width: 200px;
			padding: 24px 16px;
		}
	}

	@media (max-width: 768px) {
		.onboarding-layout {
			flex-direction: column;
		}
		.progress-panel {
			/* Replace vertical stepper with horizontal dot row */
			display: flex;
			width: 100%;
			min-width: unset;
			padding: 10px 16px;
			border-right: none;
			border-left: none;
			border-bottom: 1px solid var(--border-warm);
			order: -1;
		}
		.progress-panel-inner {
			width: 100%;
		}
		.stepper-vertical {
			flex-direction: row;
			gap: 6px;
			justify-content: center;
			align-items: center;
		}
		.stepper-item {
			gap: 0;
			flex-direction: column;
			align-items: center;
		}
		.stepper-label {
			display: none;
		}
		.stepper-connector {
			height: 0;
			width: 16px;
			background: none;
			border-top: 2px dashed var(--border-warm);
			margin-left: 0;
			border-top: 2px dashed var(--border-warm);
			margin-left: 0;
		}
		.stepper-connector.active,
		.stepper-connector.done {
			border-top-color: var(--accent);
			border-top-style: solid;
			background: none;
		}
		.stepper-dot {
			min-width: 8px;
			width: 8px;
			height: 8px;
			font-size: 0;
		}
		.stepper-item.current .stepper-dot {
			width: 24px;
			border-radius: 4px;
			box-shadow: none;
		}
		.check-mark, .pulse-dot, .future-dot {
			display: none;
		}
		.recap-panel {
			display: none;
		}
		.chat-panel {
			width: 100%;
			order: 1;
			border-right: none;
		}
		.chat-header {
			padding: 10px 16px;
		}
		.messages-inner {
			padding: 16px 12px 100px;
		}
		.options-grid, .options-row {
			padding-left: 0;
		}
		.option-chip {
			padding: 10px 12px;
			font-size: 13px;
		}
		.chat-input-container {
			padding: 12px 12px max(env(safe-area-inset-bottom, 0px), 12px);
		}
		.message-text {
			max-width: 85%;
		}
	}

	/* PWA standalone: push topbar below the iOS status bar so the layout
	   fits correctly within 100dvh and the bottom isn't clipped            */
	@media (display-mode: standalone) {
		.onboarding-topbar {
			padding-top: env(safe-area-inset-top, 0px);
			height: calc(54px + env(safe-area-inset-top, 0px));
		}
	}
</style>
