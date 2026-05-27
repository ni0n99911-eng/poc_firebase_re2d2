<script lang="ts">
	import { onMount } from 'svelte';
	import { loadLaunchPadData } from '$lib/launchpad-store';
	import EMC2Button from '$lib/components/EMC2Button.svelte';
	import PageNav from '$lib/components/PageNav.svelte';
	import { getDefaultCogsPercent, getDefaultLaborPercent, CONCEPT_KPIS, computeSteadyStateRevenue, getRevenueModel } from '$lib/constants/conceptKPIs';
import { readCanonicalConcept } from '$lib/constants/businessTypeNormalizer';
	import { backgroundSync } from '$lib/session-autosave';
	import { sanitizeCopilotText } from '$lib/utils/copilot-sanitize';

	// FIND-C-01: Concept-aware unit labels for scenario cards (volume label, ticket label, break-even unit)
	const CONCEPT_UNIT_LABELS: Record<string, { volumeLabel: string; ticketLabel: string; breakevenUnit: string }> = {
		fitness_studio:          { volumeLabel: 'Active Members',     ticketLabel: 'Monthly Fee',   breakevenUnit: 'members' },
		personal_services:       { volumeLabel: 'Weekly Slots',       ticketLabel: 'Avg Fee',       breakevenUnit: 'slots'   },
		medical_office:          { volumeLabel: 'Weekly Appts',       ticketLabel: 'Avg Fee',       breakevenUnit: 'appts'   },
		bar_nightlife:           { volumeLabel: 'Nightly Covers',     ticketLabel: 'Avg Check',     breakevenUnit: 'covers'  },
		full_service_restaurant: { volumeLabel: 'Daily Covers',       ticketLabel: 'Avg Check',     breakevenUnit: 'covers'  },
		fast_casual:             { volumeLabel: 'Daily Orders',       ticketLabel: 'Avg Check',     breakevenUnit: 'orders'  },
		qsr:                     { volumeLabel: 'Daily Orders',       ticketLabel: 'Avg Check',     breakevenUnit: 'orders'  },
		specialty_coffee:        { volumeLabel: 'Daily Transactions', ticketLabel: 'Avg Ticket',    breakevenUnit: 'orders'  },
		bakery:                  { volumeLabel: 'Daily Transactions', ticketLabel: 'Avg Ticket',    breakevenUnit: 'orders'  },
		retail:                  { volumeLabel: 'Daily Transactions', ticketLabel: 'Avg Ticket',    breakevenUnit: 'transactions' },
		juice_bar:               { volumeLabel: 'Daily Orders',       ticketLabel: 'Avg Ticket',    breakevenUnit: 'orders'  },
		wellness_beverage:       { volumeLabel: 'Daily Orders',       ticketLabel: 'Avg Ticket',    breakevenUnit: 'orders'  },
		wellness_spa:            { volumeLabel: 'Weekly Appts',       ticketLabel: 'Avg Fee',       breakevenUnit: 'appts'   },
		coworking:               { volumeLabel: 'Active Members',     ticketLabel: 'Monthly Fee',   breakevenUnit: 'members' },
	};
	const _DEFAULT_UNIT_LABELS = { volumeLabel: 'Daily Volume', ticketLabel: 'Avg Ticket', breakevenUnit: 'units' };

	// FIND-C-03: Concept-specific rent kill factor thresholds (replaces hardcoded 15% generic check)
	const RENT_KILL_THRESHOLDS: Record<string, number> = {
		full_service_restaurant: 0.08,
		bar_nightlife:           0.08,
		specialty_coffee:        0.10,
		bakery:                  0.10,
		fast_casual:             0.12,
		qsr:                     0.12,
		juice_bar:               0.12,
		wellness_beverage:       0.12,
		fitness_studio:          0.25,
		personal_services:       0.20,
		medical_office:          0.18,
		retail:                  0.12,
		wellness_spa:            0.18,
		coworking:               0.20,
	};

	/**
	 * MODEL_COST_ASSUMPTIONS — per-concept monthly operating expenses + one-time startup costs.
	 *
	 * Fields (all USD):
	 *   insurance     — monthly general liability premium (NYC small biz averages, 2024 Insureon data)
	 *   pos           — monthly POS software/hardware lease (Square, Toast, Lightspeed quotes 2024)
	 *   utilities     — monthly electricity + gas estimate (ConEdison/NatGrid avg by sq-ft class)
	 *   equipment     — one-time equipment purchase (industry build-out guides: CFRA, RestaurantOwner.com)
	 *   licensing     — one-time permits + licenses (NYC DOH + SLA schedule of fees 2024)
	 *   managementSalary — absentee-owner manager salary range (USD/year); null for owner-operator concepts
	 *
	 * Calibration: NYC-specific (higher insurance, utilities vs national avg).
	 * Source review: March 2026. Update annually or when adding a new concept.
	 */
	const MODEL_COST_ASSUMPTIONS: Record<string, {
		insurance: number; pos: number; utilities: number;
		equipment: number; licensing: number;
		managementSalary: { min: number; max: number } | null;
	}> = {
		specialty_coffee:        { insurance: 250,  pos: 150, utilities: 600,  equipment: 45000,  licensing: 2500,  managementSalary: { min: 55_000, max: 70_000 } },
		bakery:                  { insurance: 300,  pos: 100, utilities: 1200, equipment: 80000,  licensing: 2500,  managementSalary: { min: 55_000, max: 70_000 } },
		fast_casual:             { insurance: 350,  pos: 200, utilities: 900,  equipment: 60000,  licensing: 3500,  managementSalary: { min: 58_000, max: 72_000 } },
		full_service_restaurant: { insurance: 600,  pos: 300, utilities: 1500, equipment: 120000, licensing: 8000,  managementSalary: { min: 65_000, max: 85_000 } },
		qsr:                     { insurance: 350,  pos: 250, utilities: 1000, equipment: 55000,  licensing: 3500,  managementSalary: { min: 55_000, max: 68_000 } },
		bar_nightlife:           { insurance: 800,  pos: 200, utilities: 1200, equipment: 50000,  licensing: 15000, managementSalary: { min: 62_000, max: 80_000 } },
		juice_bar:               { insurance: 250,  pos: 100, utilities: 700,  equipment: 35000,  licensing: 2000,  managementSalary: { min: 50_000, max: 65_000 } },
		wellness_beverage:       { insurance: 250,  pos: 100, utilities: 600,  equipment: 30000,  licensing: 2000,  managementSalary: { min: 50_000, max: 65_000 } },
		retail:                  { insurance: 400,  pos: 200, utilities: 600,  equipment: 25000,  licensing: 1500,  managementSalary: { min: 52_000, max: 68_000 } },
		fitness_studio:          { insurance: 400,  pos: 150, utilities: 1500, equipment: 80000,  licensing: 3000,  managementSalary: { min: 58_000, max: 75_000 } },
		personal_services:       { insurance: 300,  pos: 100, utilities: 400,  equipment: 20000,  licensing: 2000,  managementSalary: null },
		medical_office:          { insurance: 1200, pos: 300, utilities: 800,  equipment: 40000,  licensing: 5000,  managementSalary: { min: 65_000, max: 85_000 } },
		florist:                 { insurance: 250,  pos: 100, utilities: 500,  equipment: 20000,  licensing: 1500,  managementSalary: null },
	};
	/** Fallback alias for backward-compat references (deprecated — use MODEL_COST_ASSUMPTIONS directly). */
	const CONCEPT_OPEX = MODEL_COST_ASSUMPTIONS;

	let mounted = $state(false);
	// resolvedBizType: read normalized concept from session (location page writes visionBizType there)
	let resolvedBizType = $state('specialty_coffee');
	// FIND-C-01: concept-aware unit labels (reactive to resolvedBizType)
	const conceptUnitLabels = $derived(CONCEPT_UNIT_LABELS[resolvedBizType] ?? _DEFAULT_UNIT_LABELS);
	// CRITICAL-7: Premium gate
	let isPremium = $state(false);
	let showEarlyAccessPrompt = $state(false);
	let lpData = $state(null);
	let sessionLocationIQ = $state(0);
	let sessionAddress = $state('');

	// FIX-C: Concept-aware rent resolver — > 0 rejects null, undefined, AND explicit zero
	const RENT_DEFAULTS: Record<string, number> = {
		specialty_coffee: 5000, bakery: 5000, fast_casual: 10000, qsr: 8000,
		full_service_restaurant: 14000, fine_dining: 18000, bar_nightlife: 10000,
		fitness_studio: 7000, retail: 8000, coworking: 9000, medical_office: 8000,
		personal_services: 4000, wellness_spa: 6000, juice_bar: 5000, florist: 4000,
	};
	function resolveMonthlyRent(lp: typeof lpData, conceptKey: string): number {
		const userBudget = lp?.financialGoals?.monthlyRentBudget;
		if (typeof userBudget === 'number' && userBudget > 0) return userBudget;
		return RENT_DEFAULTS[conceptKey] ?? 8000;
	}

	// EDITABLE VALUES
	let avgOrderValue = $state(8.75);
	let dailyCustomersTarget = $state(500);
	let operatingDaysPerWeek = $state(6);
	let cogsPercentage = $state(0.30);
	let laborPercentage = $state(0.30);
	let monthlyRent = $state(8000); // overwritten in onMount by resolveMonthlyRent()
	let initialBuildoutCost = $state(50000);
	let numberOfEmployees = $state(5);

	onMount(() => {
		mounted = true;
		try { localStorage.setItem('re2_model_visited', 'true'); } catch {}
		// AUTO-SAVE: background sync to Supabase L2 — fire-and-forget
		backgroundSync({ trigger: 'model_visited' });
		// CRITICAL-7: Premium gate
		try {
			const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
			// BETA: all features unlocked for testing
			isPremium = true;
			showEarlyAccessPrompt = false;
			// FIX-B: read canonical concept from session (written by location page via writeCanonicalConcept)
			resolvedBizType = readCanonicalConcept();
			// Wire concept-calibrated COGS + labor defaults from KPI framework
			cogsPercentage = getDefaultCogsPercent(resolvedBizType);
			laborPercentage = getDefaultLaborPercent(resolvedBizType);
			// FIN-002: concept-aware initial slider values
			const kpiParams = CONCEPT_KPIS[resolvedBizType]?.revenueParams;
			if (kpiParams) {
				avgOrderValue = kpiParams.defaultAvgTicket ?? kpiParams.defaultMonthlyFee ?? kpiParams.defaultAvgFee ?? 8.75;
				dailyCustomersTarget = kpiParams.defaultDailyTransactions ?? kpiParams.defaultMembers ?? kpiParams.defaultWeeklySlots ?? 150;
			}
		} catch { isPremium = true; }
		lpData = loadLaunchPadData();
		// FIX: always apply concept-aware rent default regardless of whether financialGoals is set.
		// Previously this was inside the financialGoals guard — users with no budget saved saw $15k.
		monthlyRent = resolveMonthlyRent(lpData, resolvedBizType);
		// Initialize other editable values from lpData if available
		if (lpData?.financialGoals) {
			const conceptDefault = CONCEPT_KPIS[resolvedBizType]?.revenueParams.defaultAvgTicket ?? avgOrderValue;
			avgOrderValue = lpData.financialGoals.avgTicket || conceptDefault;
			dailyCustomersTarget = lpData.financialGoals.dailyTransactions || 500;
			initialBuildoutCost = lpData.financialGoals.buildoutBudget || 50000;
		}
		if (lpData?.founderProfile?.yearOneGoals?.employeeCount) {
			numberOfEmployees = lpData.founderProfile.yearOneGoals.employeeCount;
		}

		// Load Location IQ data from re2_session to inform model
		try {
			const sessionStr = localStorage.getItem('re2_session');
			if (sessionStr) {
				const session = JSON.parse(sessionStr);
				// locationIQ is a number (composite score), not an object
				const liq = typeof session.locationIQ === 'number' ? session.locationIQ : 0;
				const scores = session.sixScores || {};

				// Adjust daily customer target based on transit + vibrancy scores (% bump, not absolute)
				if (scores.transit >= 80 && scores.vibrancy >= 70) {
					dailyCustomersTarget = Math.round(dailyCustomersTarget * 1.10);
				} else if (scores.transit >= 60) {
					dailyCustomersTarget = Math.round(dailyCustomersTarget * 1.05);
				}

				// Store for display
				sessionLocationIQ = liq;
				sessionAddress = session.analyzedAddress || '';
			}
		} catch (e) {
			console.error('Failed to load re2_session for model:', e);
		}
	});

	// DERIVED CALCULATIONS using $derived

	const annualOperatingDays = $derived(operatingDaysPerWeek * 52);

	const monthlyOperatingDays = $derived(operatingDaysPerWeek * 4.33);

	// FIN-001: Route to correct formula per revenue model type.
	// FIND-C-02 FIX: pass full input set so MRR and utilization models use launchpad values instead of defaults.
	// - MRR (fitness_studio, wellness_beverage): avgOrderValue = monthlyFee, dailyCustomersTarget = members
	// - Utilization (personal_services, medical_office): avgOrderValue = avgFee, dailyCustomersTarget × operatingDaysPerWeek = weeklySlots
	// - Volume/peak_weighted: avgOrderValue + dailyCustomersTarget used directly (unchanged)
	const annualRevenue = $derived(
		computeSteadyStateRevenue(resolvedBizType, {
			avgTicket:            avgOrderValue,
			dailyTransactions:    dailyCustomersTarget,
			operatingDaysPerWeek: operatingDaysPerWeek,
			members:              dailyCustomersTarget,
			monthlyFee:           avgOrderValue,
			weeklySlots:          dailyCustomersTarget * operatingDaysPerWeek,
			avgFee:               avgOrderValue,
		})
	);
	const monthlyRevenue = $derived(annualRevenue / 12);
	// dailyRevenue: display convenience — keep for existing template references
	const dailyRevenue = $derived(monthlyRevenue / (operatingDaysPerWeek * 4.33));

	const cogsAnnual = $derived(annualRevenue * cogsPercentage);

	const laborAnnual = $derived(annualRevenue * laborPercentage);

	const annualRent = $derived(monthlyRent * 12);

	// CHANGE 1: concept-aware opex (replaces hardcoded $300+$100+$800)
	const conceptOpex = $derived(CONCEPT_OPEX[resolvedBizType] ?? CONCEPT_OPEX['fast_casual']);
	const otherOpexMonthly = $derived(conceptOpex.insurance + conceptOpex.pos + conceptOpex.utilities);

	const otherOpexAnnual = $derived(otherOpexMonthly * 12);

	const monthlyBurn = $derived((cogsAnnual + laborAnnual + annualRent + otherOpexAnnual) / 12);

	const annualProfit = $derived(annualRevenue - cogsAnnual - laborAnnual - annualRent - otherOpexAnnual);

	const cashRunway = $derived.by(() => {
		if (monthlyBurn <= 0) return 'N/A (profitable)';
		const runway = initialBuildoutCost / monthlyBurn;
		return runway.toFixed(1);
	});

	const breakEvenCustomersPerDay = $derived.by(() => {
		const monthlyFixedCosts = (monthlyRent + otherOpexMonthly);
		const contributionPerTicket = avgOrderValue * (1 - cogsPercentage) - (avgOrderValue * 0.04); // accounting for supplies
		if (contributionPerTicket <= 0) return 'N/A';
		const beDaily = Math.ceil(monthlyFixedCosts / (contributionPerTicket * monthlyOperatingDays));
		return beDaily;
	});

	const businessStructureRecommendation = $derived.by(() => {
		if (!lpData) return null;
		const isFirstTime = lpData.founderProfile.experience === 'firsttime';
		const isFullTime = lpData.founderProfile.ownerType === 'fulltime';
		const isProfitable = annualProfit > 40000;

		if (isFirstTime && isFullTime) {
			return {
				structure: 'LLC with S-Corp Election',
				explanation: `As a first-time operator planning full-time, we recommend an LLC for liability protection. Once you exceed $40K annual profit (which your projections show), elect S-Corp taxation to save ~15% on self-employment taxes. This two-step approach lets you start simple and optimize taxes as you scale.`
			};
		} else if (!isFirstTime && isProfitable) {
			return {
				structure: 'S-Corporation',
				explanation: `Your experience and profitability projections support direct S-Corp election. This structure provides liability protection and optimizes tax efficiency from day one, splitting income between W-2 wages and distributions.`
			};
		} else {
			return {
				structure: 'LLC',
				explanation: `An LLC provides liability protection and pass-through taxation with minimal compliance overhead. Perfect for lean startups. You can always elect S-Corp treatment later when profitability warrants the additional paperwork.`
			};
		}
	});

	const operatingModel = $derived.by(() => {
		if (!lpData) return null;
		const ownerType = lpData.founderProfile.ownerType;
		const isAbsentee = ownerType === 'absentee';
		const teamSize = numberOfEmployees || 5;

		if (isAbsentee) {
			// Use concept-aware salary range from MODEL_COST_ASSUMPTIONS; fall back to generic NYC range
			const salaryRange = MODEL_COST_ASSUMPTIONS[resolvedBizType]?.managementSalary ?? { min: 55_000, max: 75_000 };
			return {
				staffingPlan: `1 full-time manager + ${Math.max(1, teamSize - 1)} staff`,
				staffingNote: 'Absentee owners need a trusted manager running day-to-day operations.',
				managementSalary: salaryRange,
				hoursOfOperation: `6am–10pm (${operatingDaysPerWeek} days)`,
				hoursNote: 'Extended hours require strong management to execute consistently.',
				teamSize
			};
		} else {
			const supportStaff = Math.max(1, teamSize - 1); // Owner + support staff
			return {
				staffingPlan: `Owner-operator + ${supportStaff} staff`,
				staffingNote: `You handle the day-to-day with ${supportStaff} support staff during peak hours.`,
				managementSalary: null,
				hoursOfOperation: `6am–8pm (${operatingDaysPerWeek} days)`,
				hoursNote: 'Manageable hours for owner-operator model.',
				teamSize
			};
		}
	});

	const revenueModel = $derived.by(() => {
		if (!lpData) return null;

		// Daypart breakdown based on daily revenue
		const morningRevenue = dailyRevenue * 0.4;
		const lunchRevenue = dailyRevenue * 0.25;
		const afternoonRevenue = dailyRevenue * 0.2;
		const eveningRevenue = dailyRevenue * 0.15;

		return {
			dailyCustomers: dailyCustomersTarget,
			avgTicket: avgOrderValue,
			dailyRevenue,
			annualRevenue,
			monthlyRevenue,
			dayparts: [
				{ name: 'Morning (6–11am)', percent: 40, revenue: morningRevenue },
				{ name: 'Lunch (11am–2pm)', percent: 25, revenue: lunchRevenue },
				{ name: 'Afternoon (2–5pm)', percent: 20, revenue: afternoonRevenue },
				{ name: 'Evening (5–8pm)', percent: 15, revenue: eveningRevenue }
			]
		};
	});

	const costStructure = $derived.by(() => {
		if (!lpData) return null;

		// CHANGE 1: use concept-aware values (not hardcoded)
		const insuranceMonthly = conceptOpex.insurance;
		const posMonthly = conceptOpex.pos;
		const utilitiesMonthly = conceptOpex.utilities;
		const totalFixedMonthly = monthlyRent + insuranceMonthly + posMonthly + utilitiesMonthly;

		const suppliesPercent = 0.04;
		const suppliesAnnual = annualRevenue * suppliesPercent;

		const equipment = conceptOpex.equipment;
		const licensing = conceptOpex.licensing;
		const totalOneTime = initialBuildoutCost + equipment + licensing;

		return {
			fixedMonthly: {
				rent: monthlyRent,
				insurance: insuranceMonthly,
				pos: posMonthly,
				utilities: utilitiesMonthly,
				total: totalFixedMonthly
			},
			variableAnnual: {
				cogs: { amount: cogsAnnual, percent: cogsPercentage },
				labor: { amount: laborAnnual, percent: laborPercentage },
				supplies: { amount: suppliesAnnual, percent: suppliesPercent }
			},
			oneTime: {
				buildout: initialBuildoutCost,
				equipment,
				licensing,
				total: totalOneTime
			}
		};
	});

	const breakEvenAnalysis = $derived.by(() => {
		if (!lpData || !revenueModel || !costStructure) return null;

		const fixedMonthly = costStructure.fixedMonthly.total;
		const beDaily = breakEvenCustomersPerDay;
		const steadyStateDaily = dailyCustomersTarget;

		const bePercent = typeof beDaily === 'number'
			? Math.min(100, Math.round((beDaily / steadyStateDaily) * 100))
			: 0;

		// Ramp-up model
		const rampCurve = [0.30, 0.35, 0.50, 0.55, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90, 0.93, 0.95];
		let cumulativeProfit = -(costStructure.oneTime.total);
		let monthsToBreakEven = 0;

		for (let m = 0; m < 36; m++) {
			const rampFactor = m < rampCurve.length ? rampCurve[m] : 1.0;
			const monthlyCustomers = steadyStateDaily * rampFactor * monthlyOperatingDays;
			const monthlyRev = monthlyCustomers * avgOrderValue;
			const monthlyVariableCosts = monthlyRev * (cogsPercentage + 0.04);
			const monthlyProfit = monthlyRev - monthlyVariableCosts - fixedMonthly;
			cumulativeProfit += monthlyProfit;

			if (cumulativeProfit >= 0 && monthsToBreakEven === 0) {
				monthsToBreakEven = m + 1;
			}
		}

		if (monthsToBreakEven === 0) monthsToBreakEven = 36;

		return {
			fixedMonthly,
			breakEvenDaily: beDaily,
			breakEvenPercent: bePercent,
			monthsToBreakEven,
			rampNote: 'Includes 12-month customer ramp-up (30% → 95% of steady-state capacity)'
		};
	});

	// 5-YEAR CHART CONSTANTS
	const chartH = 240;
	const barW = 60;
	const chartGap = 40;

	// 5-YEAR FINANCIAL PROJECTION
	const fiveYearProjection = $derived.by(() => {
		if (!lpData) return null;
		const rampCurve = [0.30, 0.35, 0.50, 0.55, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90, 0.93, 0.95];
		const annualGrowthRate = 0.05;
		const years = [];
		let cumulativeCash = -(costStructure?.oneTime?.total || 103500);

		for (let y = 0; y < 5; y++) {
			let yearRevenue = 0;
			let yearCosts = 0;
			for (let m = 0; m < 12; m++) {
				const globalMonth = y * 12 + m;
				const rampFactor = globalMonth < rampCurve.length ? rampCurve[globalMonth] : 1.0;
				const growthFactor = y > 0 ? Math.pow(1 + annualGrowthRate, y) : 1;
				const monthCustomers = dailyCustomersTarget * rampFactor * growthFactor * monthlyOperatingDays;
				const monthRev = monthCustomers * avgOrderValue;
				const monthVariable = monthRev * (cogsPercentage + laborPercentage + 0.04);
				const monthFixed = monthlyRent + otherOpexMonthly; // CHANGE 1: dynamic per concept
				yearRevenue += monthRev;
				yearCosts += monthVariable + monthFixed;
			}
			const yearProfit = yearRevenue - yearCosts;
			cumulativeCash += yearProfit;
			years.push({
				year: y + 1,
				revenue: Math.round(yearRevenue),
				costs: Math.round(yearCosts),
				profit: Math.round(yearProfit),
				cumulative: Math.round(cumulativeCash)
			});
		}
		return years;
	});

	const chartMaxVal = $derived(fiveYearProjection ? Math.max(...fiveYearProjection.map(y => Math.max(y.revenue, Math.abs(y.cumulative)))) : 1);
	const chartW = $derived(fiveYearProjection ? fiveYearProjection.length * (barW * 2 + chartGap) + chartGap : 400);

	const riskFlags = $derived.by(() => {
		if (!lpData || !revenueModel || !costStructure) return [];
		const flags = [];

		const revenue = revenueModel.annualRevenue;
		const rentToRevenue = (costStructure.fixedMonthly.rent * 12) / revenue;
		// FIND-C-03+04 FIX: use concept-specific kill factor threshold instead of generic 15%
		const conceptRentThreshold = RENT_KILL_THRESHOLDS[resolvedBizType] ?? 0.15;
		const conceptRentPct = Math.round(conceptRentThreshold * 100);
		if (rentToRevenue > conceptRentThreshold) {
			// FIND-C-04: concept-aware warning copy with actionable guidance
			const rentRatioStr = (rentToRevenue * 100).toFixed(1);
			let rentWarningMsg = '';
			const kpi = CONCEPT_KPIS[resolvedBizType];
			if (kpi?.revenueModel === 'mrr') {
				const monthlyRevenue = revenue / 12;
				const rentPctOfMrr = ((costStructure.fixedMonthly.rent / monthlyRevenue) * 100).toFixed(1);
				const membersNeeded = Math.ceil(costStructure.fixedMonthly.rent / (kpi.revenueParams.defaultMonthlyFee ?? 120) * (1 / conceptRentThreshold));
				rentWarningMsg = `Your rent is ${rentPctOfMrr}% of monthly recurring revenue. For a ${kpi.displayName || 'membership'} business, rent should stay below ${conceptRentPct}% of MRR. At your current fee, you need ~${membersNeeded} members to sustain this rent. Consider increasing membership pricing or negotiating lower rent.`;
			} else if (kpi?.revenueModel === 'utilization') {
				rentWarningMsg = `Your rent is ${rentRatioStr}% of projected revenue. For your concept type, the kill threshold is ${conceptRentPct}% — above this, profitability becomes structurally difficult. Focus on maximizing slot fill rate or renegotiate the lease.`;
			} else {
				rentWarningMsg = `Your rent is ${rentRatioStr}% of projected revenue. For ${kpi?.displayName || 'this concept type'}, rent should stay below ${conceptRentPct}% — above this, most operators cannot reach profitability. Consider a smaller space or negotiate terms.`;
			}
			flags.push({
				type: 'warning',
				icon: '⚠️',
				title: 'High Rent Burden',
				message: rentWarningMsg
			});
		}

		if (lpData.founderProfile.ownerType === 'absentee') {
			if (!lpData.financialGoals.targetSDE || lpData.financialGoals.targetSDE < 70000) {
				flags.push({
					type: 'caution',
					icon: '💡',
					title: 'Management Salary Note',
					message: `Absentee model requires paying a manager $${(MODEL_COST_ASSUMPTIONS[resolvedBizType]?.managementSalary?.min ?? 55_000).toLocaleString()}–$${(MODEL_COST_ASSUMPTIONS[resolvedBizType]?.managementSalary?.max ?? 75_000).toLocaleString()}/year. Ensure your profit projections account for this significant cost.`
				});
			}
		}

		if (lpData.founderProfile.experience === 'firsttime') {
			flags.push({
				type: 'coaching',
				icon: '📚',
				title: 'First-Time Founder Coaching',
				message: `You're starting fresh. Focus on nailing unit economics before scaling. Conservative capture rates are applied to your projections.`
			});
		}

		return flags;
	});

	/**
	 * CAPITAL_TIER_THRESHOLDS — right-size tier boundaries (USD).
	 * Based on NYC small-biz build-out cost survey (RE² internal, 2024) and
	 * SBA NYC district average startup costs by format.
	 */
	const CAPITAL_TIER_THRESHOLDS = {
		KIOSK_MAX:          60_000,   // < this = kiosk/cart is a fit
		MOBILE_MIN:         50_000,   // food truck lower bound
		MOBILE_MAX:        150_000,   // food truck upper bound
		LEAN_MIN:          100_000,   // lean brick-and-mortar lower bound
		LEAN_MAX:          200_000,   // lean brick-and-mortar upper bound
		FULL_MIN:          150_000,   // full-size lower bound
		FULL_MAX:          300_000,   // full-size upper bound
		PREMIUM_MIN:       250_000,   // premium / flagship threshold
	} as const;

	const rightSizeAnalysis = $derived.by(() => {
		if (!lpData) return null;
		const fg = lpData.financialGoals;
		const businessType = lpData.founderProfile?.businessType || 'Café';

		const totalCapital = (fg.liquidCapital || 0) + (fg.startupCapital || 0) + (fg.personalInvestment || 0);
		const oneTimeNeeds = (costStructure?.oneTime.total || 100000) + ((fg.monthlyPersonalExpenses || 0) * 3);
		const workingCapital = totalCapital - oneTimeNeeds;
		const burnRate = monthlyBurn > 0 ? monthlyBurn : 1;
		const calcCashRunway = workingCapital > 0 ? workingCapital / burnRate : 0;

		const tiers = [
			{
				name: 'Kiosk/Cart',
				capital: '30K–50K',
				description: `Pop-up, mall kiosk, or food truck. Low rent, fast to launch for your ${businessType}.`,
				fit: totalCapital < CAPITAL_TIER_THRESHOLDS.KIOSK_MAX ? 'Perfect fit' : null
			},
			{
				name: 'Food Truck / Mobile',
				capital: '50K–90K',
				description: `Mobile ${businessType} format. Flexible location, lower rent than brick-and-mortar.`,
				fit: totalCapital >= CAPITAL_TIER_THRESHOLDS.MOBILE_MIN && totalCapital < CAPITAL_TIER_THRESHOLDS.MOBILE_MAX ? 'Good fit' : null
			},
			{
				name: `${businessType} (500–1000 sq ft)`,
				capital: '80K–150K',
				description: `Lean ${businessType} with modest buildout. Works with right location and focused operations.`,
				fit: totalCapital >= CAPITAL_TIER_THRESHOLDS.LEAN_MIN && totalCapital < CAPITAL_TIER_THRESHOLDS.LEAN_MAX ? 'Good fit' : null
			},
			{
				name: `Full ${businessType} (1000–1500 sq ft)`,
				capital: '150K–250K',
				description: `Comfortable space with seating, full menu, and customer experience. Room for growth.`,
				fit: totalCapital >= CAPITAL_TIER_THRESHOLDS.FULL_MIN && totalCapital < CAPITAL_TIER_THRESHOLDS.FULL_MAX ? 'Strong fit' : null
			},
			{
				name: `Premium ${businessType}`,
				capital: '250K+',
				description: `Full-service ${businessType} with events space, retail, or additional revenue streams.`,
				fit: totalCapital >= CAPITAL_TIER_THRESHOLDS.PREMIUM_MIN ? 'Ideal fit' : null
			}
		];

		return {
			totalCapital,
			oneTimeNeeds,
			workingCapital,
			cashRunway: Math.max(0, calcCashRunway),
			tiers,
			businessType
		};
	});


	// Order 14: 3-scenario comparison derived vars
	// Conservative: -20% covers, -7% ticket, +$1K rent
	const conservCovers = $derived(Math.round(dailyCustomersTarget * 0.80));
	const conservTicket = $derived(parseFloat((avgOrderValue * 0.93).toFixed(2)));
	const conservRent = $derived(monthlyRent + 1000);
	const conservRevenue = $derived(conservTicket * conservCovers * annualOperatingDays);
	const conservCogsLabor = $derived(conservRevenue * (cogsPercentage + laborPercentage));
	const conservRentOpex = $derived(conservRent * 12 + otherOpexAnnual);
	const conservProfit = $derived(conservRevenue - conservCogsLabor - conservRentOpex);
	const conservMargin = $derived(conservRevenue > 0 ? (conservProfit / conservRevenue * 100) : 0);
	const conservBreakeven = $derived.by(() => {
		const contrib = conservTicket * (1 - cogsPercentage - laborPercentage);
		if (contrib <= 0) return 999;
		return Math.ceil((conservRent + otherOpexMonthly) / (contrib * (operatingDaysPerWeek * 4.33)));
	});
	const conservMonthsProfit = $derived.by(() => {
		if (conservProfit <= 0) return 36;
		return Math.round(initialBuildoutCost / (conservProfit / 12));
	});

	// Optimistic: +30% covers, +14% ticket, -$1.5K rent
	const optimCovers = $derived(Math.round(dailyCustomersTarget * 1.30));
	const optimTicket = $derived(parseFloat((avgOrderValue * 1.14).toFixed(2)));
	const optimRent = $derived(Math.max(0, monthlyRent - 1500));
	const optimRevenue = $derived(optimTicket * optimCovers * annualOperatingDays);
	const optimCogsLabor = $derived(optimRevenue * (cogsPercentage + laborPercentage));
	const optimRentOpex = $derived(optimRent * 12 + otherOpexAnnual);
	const optimProfit = $derived(optimRevenue - optimCogsLabor - optimRentOpex);
	const optimMargin = $derived(optimRevenue > 0 ? (optimProfit / optimRevenue * 100) : 0);
	const optimBreakeven = $derived.by(() => {
		const contrib = optimTicket * (1 - cogsPercentage - laborPercentage);
		if (contrib <= 0) return 999;
		return Math.ceil((optimRent + otherOpexMonthly) / (contrib * (operatingDaysPerWeek * 4.33)));
	});
	const optimMonthsProfit = $derived.by(() => {
		if (optimProfit <= 0) return 36;
		return Math.round(initialBuildoutCost / (optimProfit / 12));
	});

	// Base breakeven (clean)
	const baseBreakeven = $derived.by(() => {
		const contrib = avgOrderValue * (1 - cogsPercentage - laborPercentage);
		if (contrib <= 0) return 999;
		return Math.ceil((monthlyRent + otherOpexMonthly) / (contrib * (operatingDaysPerWeek * 4.33)));
	});
	const baseMonthsProfit = $derived.by(() => {
		if (annualProfit <= 0) return 36;
		return Math.round(initialBuildoutCost / (annualProfit / 12));
	});

	// Co-Pilot messages
	const modelCopilotMsgs = $derived.by(() => {
		const base = Math.round(annualRevenue / 1000);
		const profit = Math.round(annualProfit / 1000);
		const cProfit = Math.round(conservProfit / 1000);
		return [
			{ icon: '📊', text: `Your Business Case baseline is locked in — $${base}K revenue, $${profit}K profit, ${baseBreakeven} cover break-even. Now let's stress-test it.` },
			{ icon: '⚠️', text: `The Conservative scenario models 20% lower covers and $1K higher rent — still ${cProfit > 0 ? `profitable at $${cProfit}K/year. Key risk: covers are your most sensitive variable.` : 'a loss scenario — protect your cover targets.'}` },
			{ icon: '🏦', text: `For bank presentations: lead with Conservative scenario — lenders want to see you survive the downside. Show Base Case in the executive summary.` },
		];
	});

	function formatK(n: number): string {
		const abs = Math.abs(n);
		const sign = n < 0 ? '-' : '';
		if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
		if (abs >= 1_000) return sign + '$' + Math.round(abs / 1000) + 'K';
		return sign + '$' + Math.round(abs);
	}
	function grantEarlyAccess() {
		try {
			const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
			sess.earlyAccess = true;
			localStorage.setItem('re2_session', JSON.stringify(sess));
		} catch {}
		isPremium = true;
		showEarlyAccessPrompt = false;
	}
</script>

<svelte:head>
	<title>RE² — Business</title>
</svelte:head>

<div class="page">
	<!-- BETA: paywall removed -->
	<div class="page-header">
		<h1>Scenarios</h1>
		<p class="page-subtitle">Stress-test your Business Case across conservative, base, and optimistic outcomes</p>
	</div>

	<!-- E=MC² button removed — recalculation is automatic on mount -->

	{#if !mounted || !lpData}
		<div class="loading">
			<p>Loading your business model...</p>
		</div>
	{:else}
		<!-- Location IQ Context Card -->
		{#if mounted}
			{#if sessionAddress || sessionLocationIQ > 0}
				<section class="section location-context">
					<div class="location-context-card">
						<div class="location-context-header">
							<h3>📍 Location Context</h3>
						</div>
						<div class="location-context-body">
							{#if sessionAddress}
								<div class="context-item">
									<span class="context-label">Address:</span>
									<span class="context-value">{sessionAddress}</span>
								</div>
							{/if}
							{#if sessionLocationIQ > 0}
								<div class="context-item">
									<span class="context-label">Your Score:</span>
									<span class="context-value score-badge">{sessionLocationIQ}/100</span>
								</div>
							{/if}
						</div>
					</div>
				</section>
			{/if}
		{/if}
		<!-- FIND-B-10: soft banner when user navigates directly without having come through Financials -->
		{#if !lpData?.financialGoals?.monthlyRentBudget && sessionLocationIQ === 0}
			<div class="stale-data-banner">
				<span class="stale-icon">💡</span>
				<span class="stale-text">These projections are based on concept defaults — <a href="/app/business-plan">customize your inputs →</a> for a personalized model.</span>
			</div>
		{/if}

		<!-- ORDER 14: 3-Column Scenario Comparison -->
		<div class="scenario-layout">
		<div class="scenario-main">

		<!-- Business Case Baseline Banner -->
		<div class="bc-baseline-banner">
			<div class="bb-left">
				<span class="bb-label">Business Case Baseline</span>
				<span class="bb-sep">·</span>
				<span class="bb-meta">${avgOrderValue} avg ticket · {dailyCustomersTarget} covers/day · ${monthlyRent.toLocaleString()}/mo rent · {Math.round(cogsPercentage*100)}% COGS · {Math.round(laborPercentage*100)}% labor</span>
			</div>
			<div class="bb-right">
				<span class="bb-rev">{formatK(annualRevenue)} revenue · {formatK(annualProfit)} profit</span>
				<a href="/app/business-plan" class="bb-edit">← Edit Business Case</a>
			</div>
		</div>

		<!-- 3-Column Scenario Cards -->
		<div class="three-col">

			<!-- Conservative -->
			<div class="scenario-card conservative">
				<div class="sc-header conservative-hdr">
					<div class="sc-name">Conservative</div>
					<div class="sc-tag">Slow ramp, tough rent, cautious covers</div>
				</div>
				<div class="sc-body">
					<div class="sc-input-row">
						<span class="sc-input-label">{conceptUnitLabels.volumeLabel}</span>
						<span class="sc-input-val">{conservCovers}</span>
						<span class="sc-delta sc-delta-neg">−20%</span>
					</div>
					<div class="sc-input-row">
						<span class="sc-input-label">{conceptUnitLabels.ticketLabel}</span>
						<span class="sc-input-val">${conservTicket.toFixed(2)}</span>
						<span class="sc-delta sc-delta-neg">−7%</span>
					</div>
					<div class="sc-input-row">
						<span class="sc-input-label">Monthly Rent</span>
						<span class="sc-input-val">${conservRent.toLocaleString()}</span>
						<span class="sc-delta sc-delta-neg">+$1K</span>
					</div>
					<div class="sc-pl">
						<div class="sc-pl-row"><span>Annual Revenue</span><span class="sc-pl-val">{formatK(conservRevenue)}</span></div>
						<div class="sc-pl-row"><span>COGS + Labor</span><span class="sc-pl-val sc-neg">−{formatK(conservCogsLabor)}</span></div>
						<div class="sc-pl-row"><span>Rent + OpEx</span><span class="sc-pl-val sc-neg">−{formatK(conservRentOpex)}</span></div>
						<div class="sc-pl-row sc-pl-be"><span>Break-even / Day</span><span class="sc-pl-val">{conservBreakeven} {conceptUnitLabels.breakevenUnit}</span></div>
						<div class="sc-pl-row sc-pl-be"><span>Months to Profit</span><span class="sc-pl-val">{conservMonthsProfit > 0 ? conservMonthsProfit + ' mo' : '< 1 mo'}</span></div>
					</div>
					<div class="sc-profit" class:sc-profit-pos={conservProfit >= 0} class:sc-profit-neg={conservProfit < 0}>
						<div class="sc-profit-val">{formatK(conservProfit)}</div>
						<div class="sc-profit-label">Net Profit · {conservMargin.toFixed(1)}% margin</div>
					</div>
				</div>
			</div>

			<!-- Base Case -->
			<div class="scenario-card base">
				<div class="sc-header base-hdr">
					<div class="sc-name">Base Case</div>
					<div class="sc-tag">Your Baseline — straight from Business Case</div>
				</div>
				<div class="sc-body">
					<div class="sc-input-row">
						<span class="sc-input-label">{conceptUnitLabels.volumeLabel}</span>
						<span class="sc-input-val">{dailyCustomersTarget}</span>
						<span class="sc-delta sc-delta-base">baseline</span>
					</div>
					<div class="sc-input-row">
						<span class="sc-input-label">{conceptUnitLabels.ticketLabel}</span>
						<span class="sc-input-val">${avgOrderValue.toFixed(2)}</span>
						<span class="sc-delta sc-delta-base">baseline</span>
					</div>
					<div class="sc-input-row">
						<span class="sc-input-label">Monthly Rent</span>
						<span class="sc-input-val">${monthlyRent.toLocaleString()}</span>
						<span class="sc-delta sc-delta-base">baseline</span>
					</div>
					<div class="sc-pl">
						<div class="sc-pl-row"><span>Annual Revenue</span><span class="sc-pl-val">{formatK(annualRevenue)}</span></div>
						<div class="sc-pl-row"><span>COGS + Labor</span><span class="sc-pl-val sc-neg">−{formatK(cogsAnnual + laborAnnual)}</span></div>
						<div class="sc-pl-row"><span>Rent + OpEx</span><span class="sc-pl-val sc-neg">−{formatK(annualRent + otherOpexAnnual)}</span></div>
						<div class="sc-pl-row sc-pl-be"><span>Break-even / Day</span><span class="sc-pl-val">{baseBreakeven} {conceptUnitLabels.breakevenUnit}</span></div>
						<div class="sc-pl-row sc-pl-be"><span>Months to Profit</span><span class="sc-pl-val">{baseMonthsProfit > 0 ? baseMonthsProfit + ' mo' : '< 1 mo'}</span></div>
					</div>
					<div class="sc-profit sc-profit-pos">
						<div class="sc-profit-val">{formatK(annualProfit)}</div>
						<div class="sc-profit-label">Net Profit · {annualRevenue > 0 ? (annualProfit / annualRevenue * 100).toFixed(1) : 0}% margin</div>
					</div>
				</div>
			</div>

			<!-- Optimistic -->
			<div class="scenario-card optimistic">
				<div class="sc-header optimistic-hdr">
					<div class="sc-name">Optimistic</div>
					<div class="sc-tag">Strong ramp, negotiated rent, higher ticket</div>
				</div>
				<div class="sc-body">
					<div class="sc-input-row">
						<span class="sc-input-label">{conceptUnitLabels.volumeLabel}</span>
						<span class="sc-input-val">{optimCovers}</span>
						<span class="sc-delta sc-delta-pos">+30%</span>
					</div>
					<div class="sc-input-row">
						<span class="sc-input-label">{conceptUnitLabels.ticketLabel}</span>
						<span class="sc-input-val">${optimTicket.toFixed(2)}</span>
						<span class="sc-delta sc-delta-pos">+14%</span>
					</div>
					<div class="sc-input-row">
						<span class="sc-input-label">Monthly Rent</span>
						<span class="sc-input-val">${optimRent.toLocaleString()}</span>
						<span class="sc-delta sc-delta-pos">−$1.5K</span>
					</div>
					<div class="sc-pl">
						<div class="sc-pl-row"><span>Annual Revenue</span><span class="sc-pl-val">{formatK(optimRevenue)}</span></div>
						<div class="sc-pl-row"><span>COGS + Labor</span><span class="sc-pl-val sc-neg">−{formatK(optimCogsLabor)}</span></div>
						<div class="sc-pl-row"><span>Rent + OpEx</span><span class="sc-pl-val sc-neg">−{formatK(optimRentOpex)}</span></div>
						<div class="sc-pl-row sc-pl-be"><span>Break-even / Day</span><span class="sc-pl-val">{optimBreakeven} {conceptUnitLabels.breakevenUnit}</span></div>
						<div class="sc-pl-row sc-pl-be"><span>Months to Profit</span><span class="sc-pl-val">{optimMonthsProfit > 0 ? optimMonthsProfit + ' mo' : '< 1 mo'}</span></div>
					</div>
					<div class="sc-profit sc-profit-pos">
						<div class="sc-profit-val">{formatK(optimProfit)}</div>
						<div class="sc-profit-label">Net Profit · {optimRevenue > 0 ? (optimProfit / optimRevenue * 100).toFixed(1) : 0}% margin</div>
					</div>
				</div>
			</div>

		</div><!-- /three-col -->

		<!-- Comparison Table -->
		<div class="comp-table-wrap">
			<div class="comp-table-title">Scenario Comparison</div>
			<table class="comp-table">
				<thead>
					<tr>
						<th>Metric</th>
						<th class="col-conservative">Conservative</th>
						<th class="col-base">Base Case</th>
						<th class="col-optimistic">Optimistic</th>
					</tr>
				</thead>
				<tbody>
					<tr><td>{conceptUnitLabels.volumeLabel}</td><td>{conservCovers}</td><td><strong>{dailyCustomersTarget}</strong></td><td>{optimCovers}</td></tr>
					<tr><td>{conceptUnitLabels.ticketLabel}</td><td>${conservTicket.toFixed(2)}</td><td><strong>${avgOrderValue.toFixed(2)}</strong></td><td>${optimTicket.toFixed(2)}</td></tr>
					<tr><td>Monthly Rent</td><td>${conservRent.toLocaleString()}</td><td><strong>${monthlyRent.toLocaleString()}</strong></td><td>${optimRent.toLocaleString()}</td></tr>
					<tr><td>Annual Revenue</td><td>{formatK(conservRevenue)}</td><td><strong>{formatK(annualRevenue)}</strong></td><td>{formatK(optimRevenue)}</td></tr>
					<tr><td>Break-even / Day</td><td>{conservBreakeven} {conceptUnitLabels.breakevenUnit}</td><td><strong>{baseBreakeven} {conceptUnitLabels.breakevenUnit}</strong></td><td>{optimBreakeven} {conceptUnitLabels.breakevenUnit}</td></tr>
					<tr><td>Months to Profit</td><td>{conservMonthsProfit > 0 ? conservMonthsProfit + ' mo' : '< 1 mo'}</td><td><strong>{baseMonthsProfit > 0 ? baseMonthsProfit + ' mo' : '< 1 mo'}</strong></td><td>{optimMonthsProfit > 0 ? optimMonthsProfit + ' mo' : '< 1 mo'}</td></tr>
					<tr class="profit-row"><td>Net Annual Profit</td><td class="{conservProfit >= 0 ? 'profit-pos' : 'profit-neg'}">{formatK(conservProfit)}</td><td><strong class="profit-pos">{formatK(annualProfit)}</strong></td><td class="profit-pos">{formatK(optimProfit)}</td></tr>
					<tr><td>Profit Margin</td><td>{conservMargin.toFixed(1)}%</td><td><strong>{annualRevenue > 0 ? (annualProfit / annualRevenue * 100).toFixed(1) : 0}%</strong></td><td>{optimMargin.toFixed(1)}%</td></tr>
				</tbody>
			</table>
		</div>

		<!-- Key Insight -->
		<div class="key-insight">
			<div class="ki-title">{conceptUnitLabels.volumeLabel} is your key variable — rent is your negotiating lever</div>
			<p class="ki-body">A 30% drop in {conceptUnitLabels.breakevenUnit} from baseline flips you negative — that's the number to protect. Negotiating $1,500/mo off rent drops your break-even by ~{baseBreakeven - optimBreakeven} {conceptUnitLabels.breakevenUnit} and adds {formatK(optimProfit - annualProfit)} to annual profit. Your Competition score gives you negotiating leverage — high space supply means motivated landlords.</p>
		</div>

		</div><!-- /scenario-main -->

		<!-- Co-Pilot Sidebar -->
		<aside class="scenario-copilot">
			<div class="copilot-card">
				<div class="copilot-card-hdr">
					<span class="copilot-icon">🤖</span>
					<span class="copilot-title">RE² Co-Pilot</span>
				</div>
				{#each modelCopilotMsgs as msg}
				<div class="copilot-msg">
					<span class="copilot-msg-icon">{msg.icon}</span>
					<p class="copilot-msg-text">{sanitizeCopilotText(msg.text)}</p>
				</div>
				{/each}
			</div>
		</aside>

		</div><!-- /scenario-layout -->

		<div class="more-analysis-toggle">
			<details>
				<summary>See Full Financial Analysis ↓</summary>

		<!-- 1. OPERATING MODEL -->
		<section class="section">
			<div class="section-header">
				<h2>Operating Model</h2>
			</div>
			<div class="section-content">
				{#if operatingModel}
					<div class="grid grid-2col">
						<div class="model-card">
							<h3 class="card-title">Staffing Plan</h3>
							<p class="card-value">{operatingModel.staffingPlan}</p>
							<p class="card-note">{operatingModel.staffingNote}</p>
							{#if operatingModel.managementSalary}
								<p class="card-highlight">
									Manager Salary: ${operatingModel.managementSalary.min.toLocaleString()}–${operatingModel.managementSalary.max.toLocaleString()}/year
								</p>
							{/if}
						</div>

						<div class="model-card">
							<h3 class="card-title">Hours of Operation</h3>
							<p class="card-value">{operatingModel.hoursOfOperation}</p>
							<p class="card-note">{operatingModel.hoursNote}</p>
						</div>
					</div>
				{/if}
			</div>
		</section>

		<!-- 2. REVENUE MODEL -->
		<section class="section">
			<div class="section-header">
				<h2>Revenue Model</h2>
			</div>
			<div class="section-content">
				{#if revenueModel}
					<p class="sim-guidance">Adjust the inputs below — your break-even timeline and projections update automatically.</p>
					<div class="editable-inputs-row">
						<div class="input-group">
							<label for="aov">Average Order Value (AOV)</label>
							<input type="number" id="aov" bind:value={avgOrderValue} step="0.01" min="0" />
						</div>
						<div class="input-group">
							<label for="daily-customers">Daily Customers Target</label>
							<input type="number" id="daily-customers" bind:value={dailyCustomersTarget} step="1" min="0" />
						</div>
						<div class="input-group">
							<label for="operating-days">Operating Days/Week</label>
							<input type="number" id="operating-days" bind:value={operatingDaysPerWeek} step="1" min="1" max="7" />
						</div>
					</div>

					<div class="revenue-summary">
						<div class="summary-stat">
							<div class="stat-label">Daily Customers</div>
							<div class="stat-value">{revenueModel.dailyCustomers.toLocaleString()}</div>
						</div>
						<div class="summary-stat">
							<div class="stat-label">Average Ticket</div>
							<div class="stat-value">${revenueModel.avgTicket.toFixed(2)}</div>
						</div>
						<div class="summary-stat">
							<div class="stat-label">Daily Revenue</div>
							<div class="stat-value">${revenueModel.dailyRevenue.toFixed(0)}</div>
						</div>
						<div class="summary-stat highlighted">
							<div class="stat-label">Annual Revenue ({operatingDaysPerWeek}d/wk = {annualOperatingDays} days)</div>
							<div class="stat-value">${(revenueModel.annualRevenue / 1000).toFixed(0)}K</div>
						</div>
					</div>

					<h3 class="subsection-title">Revenue by Daypart</h3>
					<div class="daypart-grid">
						{#each revenueModel.dayparts as daypart}
							<div class="daypart-card">
								<div class="daypart-name">{daypart.name}</div>
								<div class="daypart-percent">{daypart.percent}%</div>
								<div class="daypart-revenue">${daypart.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</section>

		<!-- 3. COST STRUCTURE -->
		<section class="section">
			<div class="section-header">
				<h2>Cost Structure</h2>
			</div>
			<div class="section-content">
				{#if costStructure}
					<div class="editable-inputs-row">
						<div class="input-group">
							<label for="monthly-rent">Monthly Rent</label>
							<input type="number" id="monthly-rent" bind:value={monthlyRent} step="100" min="0" />
						</div>
						<div class="input-group">
							<label for="cogs-pct">COGS %</label>
							<input type="number" id="cogs-pct" bind:value={cogsPercentage} step="0.01" min="0" max="1" />
						</div>
						<div class="input-group">
							<label for="labor-pct">Labor %</label>
							<input type="number" id="labor-pct" bind:value={laborPercentage} step="0.01" min="0" max="1" />
						</div>
						<div class="input-group">
							<label for="buildout-cost">Initial Buildout Cost</label>
							<input type="number" id="buildout-cost" bind:value={initialBuildoutCost} step="1000" min="0" />
						</div>
						<div class="input-group">
							<label for="num-employees">Number of Employees</label>
							<input type="number" id="num-employees" bind:value={numberOfEmployees} step="1" min="1" />
						</div>
					</div>

					<!-- Fixed Costs -->
					<div class="subsection">
						<h3 class="subsection-title">Fixed Monthly Costs</h3>
						<div class="cost-table">
							<div class="cost-row">
								<span class="cost-label">Rent</span>
								<span class="cost-value">${costStructure.fixedMonthly.rent.toLocaleString()}</span>
							</div>
							<div class="cost-row">
								<span class="cost-label">Insurance</span>
								<span class="cost-value">${costStructure.fixedMonthly.insurance}/mo</span>
							</div>
							<div class="cost-row">
								<span class="cost-label">POS System</span>
								<span class="cost-value">${costStructure.fixedMonthly.pos}/mo</span>
							</div>
							<div class="cost-row">
								<span class="cost-label">Utilities</span>
								<span class="cost-value">${costStructure.fixedMonthly.utilities}/mo</span>
							</div>
							<div class="cost-row total">
								<span class="cost-label">Total Fixed</span>
								<span class="cost-value">${costStructure.fixedMonthly.total.toLocaleString()}/mo</span>
							</div>
						</div>
					</div>

					<!-- Variable Costs -->
					<div class="subsection">
						<h3 class="subsection-title">Variable Annual Costs (% of Revenue)</h3>
						<div class="cost-table">
							<div class="cost-row">
								<span class="cost-label">COGS ({(costStructure.variableAnnual.cogs.percent * 100).toFixed(0)}%)</span>
								<span class="cost-value">${costStructure.variableAnnual.cogs.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
							</div>
							<div class="cost-row">
								<span class="cost-label">Labor ({(costStructure.variableAnnual.labor.percent * 100).toFixed(0)}%)</span>
								<span class="cost-value">${costStructure.variableAnnual.labor.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
							</div>
							<div class="cost-row">
								<span class="cost-label">Supplies ({(costStructure.variableAnnual.supplies.percent * 100).toFixed(0)}%)</span>
								<span class="cost-value">${costStructure.variableAnnual.supplies.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
							</div>
						</div>
					</div>

					<!-- One-Time Costs -->
					<div class="subsection">
						<h3 class="subsection-title">One-Time Startup Costs</h3>
						<div class="cost-table">
							<div class="cost-row">
								<span class="cost-label">Buildout</span>
								<span class="cost-value">${costStructure.oneTime.buildout.toLocaleString()}</span>
							</div>
							<div class="cost-row">
								<span class="cost-label">Equipment</span>
								<span class="cost-value">${costStructure.oneTime.equipment.toLocaleString()}</span>
							</div>
							<div class="cost-row">
								<span class="cost-label">Licensing & Permits</span>
								<span class="cost-value">${costStructure.oneTime.licensing.toLocaleString()}</span>
							</div>
							<div class="cost-row total">
								<span class="cost-label">Total One-Time</span>
								<span class="cost-value">${costStructure.oneTime.total.toLocaleString()}</span>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</section>

		<!-- 4. BREAK-EVEN ANALYSIS -->
		<section class="section">
			<div class="section-header">
				<h2>Break-Even Analysis</h2>
			</div>
			<div class="section-content">
				{#if breakEvenAnalysis}
					<div class="breakeven-grid">
						<div class="breakeven-card">
							<div class="breakeven-label">Monthly Fixed Costs</div>
							<div class="breakeven-value">${breakEvenAnalysis.fixedMonthly.toLocaleString()}</div>
						</div>
						<div class="breakeven-card">
							<div class="breakeven-label">Break-Even Customers/Day</div>
							<div class="breakeven-value">{breakEvenAnalysis.breakEvenDaily}</div>
							<div class="breakeven-percent">{breakEvenAnalysis.breakEvenPercent}% of projected</div>
						</div>
						<div class="breakeven-card highlighted">
							<div class="breakeven-label">Estimated Months to Break-Even</div>
							<div class="breakeven-value">{breakEvenAnalysis.monthsToBreakEven}</div>
							{#if breakEvenAnalysis.rampNote}
								<div class="breakeven-note">{breakEvenAnalysis.rampNote}</div>
							{/if}
						</div>
					</div>

					<div class="progress-bar-container">
						<div class="progress-label">Path to Break-Even</div>
						<div class="progress-bar">
							<div class="progress-fill" style="width: {Math.min(100, breakEvenAnalysis.breakEvenPercent)}%"></div>
						</div>
						<div class="progress-text">
							{breakEvenAnalysis.breakEvenDaily} customers needed / {revenueModel.dailyCustomers} projected ({breakEvenAnalysis.breakEvenPercent}%)
						</div>
					</div>
				{/if}
			</div>
		</section>

		<!-- 5. FIVE-YEAR FINANCIAL PROJECTION -->
		{#if fiveYearProjection}
			<section class="section">
				<div class="section-header">
					<h2>5-Year Financial Projection</h2>
					<p class="section-subtitle">Revenue, Costs & Cumulative Cash Position</p>
				</div>
				<div class="section-content">
					<div class="chart-container">
						<svg viewBox="0 0 {chartW + 80} {chartH + 60}" class="projection-chart">
							<!-- Y axis labels -->
							{#each [0, 0.25, 0.5, 0.75, 1] as tick}
								<text x="70" y={chartH - tick * chartH + 10} fill="#999999" font-size="11" text-anchor="end">
									${(chartMaxVal * tick / 1000).toFixed(0)}K
								</text>
								<line x1="80" y1={chartH - tick * chartH + 6} x2={chartW + 80} y2={chartH - tick * chartH + 6} stroke="#d2d2d7" stroke-width="1" />
							{/each}

							{#each fiveYearProjection as yr, i}
								{@const x = 80 + chartGap + i * (barW * 2 + chartGap)}
								{@const revH = (yr.revenue / chartMaxVal) * chartH}
								{@const costH = (yr.costs / chartMaxVal) * chartH}
								{@const profitY = chartH - (Math.max(0, yr.cumulative) / chartMaxVal) * chartH + 6}
								<!-- Revenue bar -->
								<rect x={x} y={chartH - revH + 6} width={barW - 4} height={revH} fill="#34C759" rx="3" opacity="0.85" />
								<!-- Cost bar -->
								<rect x={x + barW} y={chartH - costH + 6} width={barW - 4} height={costH} fill="#ff6b6b" rx="3" opacity="0.7" />
								<!-- Profit indicator dot -->
								<circle cx={x + barW} cy={profitY} r="5" fill={yr.cumulative >= 0 ? '#0071E3' : '#ff6b6b'} stroke="#f5f5f7" stroke-width="2" />
								{#if i > 0}
									<line x1={80 + chartGap + (i - 1) * (barW * 2 + chartGap) + barW} y1={chartH - (Math.max(0, fiveYearProjection[i-1].cumulative) / chartMaxVal) * chartH + 6} x2={x + barW} y2={profitY} stroke="#0071E3" stroke-width="2" stroke-dasharray="4,3" />
								{/if}
								<!-- Year label -->
								<text x={x + barW - 2} y={chartH + 24} fill="#999999" font-size="12" text-anchor="middle">Yr {yr.year}</text>
							{/each}
						</svg>
						<div class="chart-legend">
							<span class="legend-item"><span class="legend-dot" style="background: #34C759"></span> Revenue</span>
							<span class="legend-item"><span class="legend-dot" style="background: #ff6b6b"></span> Costs</span>
							<span class="legend-item"><span class="legend-dot" style="background: #0071E3; border-radius: 50%"></span> Cumulative Cash</span>
						</div>
					</div>

					<!-- Numbers table -->
					<div class="projection-table">
						{#each fiveYearProjection as yr}
							<div class="proj-row">
								<span class="proj-year">Year {yr.year}</span>
								<span class="proj-metric"><span class="proj-label">Revenue</span> ${(yr.revenue / 1000).toFixed(0)}K</span>
								<span class="proj-metric"><span class="proj-label">Costs</span> ${(yr.costs / 1000).toFixed(0)}K</span>
								<span class="proj-metric" style="color: {yr.profit >= 0 ? '#34C759' : '#ff6b6b'}"><span class="proj-label">Profit</span> {yr.profit >= 0 ? '+' : ''}${(yr.profit / 1000).toFixed(0)}K</span>
								<span class="proj-metric" style="color: {yr.cumulative >= 0 ? '#0071E3' : '#ff6b6b'}"><span class="proj-label">Cumulative</span> {yr.cumulative >= 0 ? '+' : ''}${(yr.cumulative / 1000).toFixed(0)}K</span>
							</div>
						{/each}
					</div>
				</div>
			</section>
		{/if}

		<!-- 6. BUSINESS STRUCTURE RECOMMENDATION -->
		<section class="section">
			<div class="section-header">
				<h2>Business Structure Recommendation</h2>
			</div>
			<div class="section-content">
				{#if businessStructureRecommendation}
					<div class="card-structure">
						<div class="structure-name">{businessStructureRecommendation.structure}</div>
						<p class="structure-explanation">{businessStructureRecommendation.explanation}</p>
					</div>
				{/if}
			</div>
		</section>

		<!-- 6. RISK FLAGS & COACHING -->
		{#if riskFlags.length > 0}
			<section class="section">
				<div class="section-header">
					<h2>Coaching Callouts</h2>
				</div>
				<div class="section-content">
					<div class="flags-container">
						{#each riskFlags as flag}
							<div class="flag-card flag-{flag.type}">
								<div class="flag-icon">{flag.icon}</div>
								<div class="flag-content">
									<div class="flag-title">{flag.title}</div>
									<div class="flag-message">{flag.message}</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</section>
		{/if}

		<!-- 7. RIGHT-SIZE YOUR BUSINESS (Module 4 Preview) -->
		<section class="section reality-check">
			<div class="section-header">
				<h2>Right-Size Your Business</h2>
				<p class="section-subtitle">What This Budget Can Support</p>
			</div>
			<div class="section-content">
				{#if rightSizeAnalysis}
					{#if rightSizeAnalysis.totalCapital === 0}
						<div class="capital-notice">
							<p style="font-size: 13px; color: #666; text-align: center; padding: 16px; background: #F5F5F7; border-radius: 8px; margin-bottom: 16px;">
								Complete your financial profile during onboarding to see personalized capital analysis and business tier recommendations.
							</p>
						</div>
					{/if}
					<div class="capital-summary">
						<div class="capital-stat">
							<div class="stat-label">Total Capital Available</div>
							<div class="stat-value">${rightSizeAnalysis.totalCapital.toLocaleString()}</div>
							<div class="stat-breakdown">Startup: ${(lpData.financialGoals.startupCapital || 0).toLocaleString()} + Personal: ${(lpData.financialGoals.personalInvestment || 0).toLocaleString()} + Liquid: ${(lpData.financialGoals.liquidCapital || 0).toLocaleString()}</div>
						</div>
						<div class="capital-stat">
							<div class="stat-label">One-Time Needs</div>
							<div class="stat-value">${rightSizeAnalysis.oneTimeNeeds.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
						</div>
						<div class="capital-stat">
							<div class="stat-label">Working Capital Available</div>
							<div class="stat-value">${rightSizeAnalysis.workingCapital.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
						</div>
						<div class="capital-stat highlighted" style="border-color: {rightSizeAnalysis.cashRunway < 3 ? '#ef4444' : rightSizeAnalysis.cashRunway < 6 ? '#f59e0b' : '#10b981'}">
							<div class="stat-label">Cash Runway</div>
							<div class="stat-value" style="color: {rightSizeAnalysis.cashRunway < 3 ? '#ef4444' : rightSizeAnalysis.cashRunway < 6 ? '#f59e0b' : '#10b981'}">
								{rightSizeAnalysis.cashRunway.toFixed(1)} months
							</div>
							{#if rightSizeAnalysis.cashRunway < 3}
								<div class="runway-warning" style="color: #ef4444; font-size: 11px; margin-top: 4px;">Most SBA lenders require 6+ months of reserves</div>
							{:else if rightSizeAnalysis.cashRunway < 6}
								<div class="runway-warning" style="color: #f59e0b; font-size: 11px; margin-top: 4px;">Consider building to 6+ months for loan readiness</div>
							{/if}
						</div>
					</div>

					<h3 class="subsection-title">Business Size Tiers</h3>
					<div class="tiers-container">
						{#each rightSizeAnalysis.tiers as tier}
							<div class="tier-card" class:tier-match={tier.fit}>
								<div class="tier-header">
									<div class="tier-name">{tier.name}</div>
									{#if tier.fit}
										<div class="tier-match-badge">{tier.fit}</div>
									{/if}
								</div>
								<div class="tier-capital">{tier.capital}</div>
								<p class="tier-description">{tier.description}</p>
							</div>
						{/each}
					</div>

					<div class="reality-callout">
						<div class="reality-icon">💡</div>
						<div class="reality-text">
							<strong>The Path Forward:</strong>
							Your ${rightSizeAnalysis.totalCapital.toLocaleString()} can support
							{#if rightSizeAnalysis.totalCapital < 60000}
								a kiosk or pop-up to launch quickly and test the market. After 12 months of revenue, you can scale to a full location.
							{:else if rightSizeAnalysis.totalCapital < 100000}
								a food truck or lean {rightSizeAnalysis.businessType} format. Focus on location and unit economics — these drive success more than size.
							{:else if rightSizeAnalysis.totalCapital < 200000}
								a comfortable {rightSizeAnalysis.businessType} space. Build to your strengths: seating capacity, product depth, and staffing model.
							{:else}
								a premium {rightSizeAnalysis.businessType} with room for growth. Consider your location carefully — location fit matters more than square footage.
							{/if}
							A strong business model works at any size. Right-size for your cash runway and founder capacity.
						</div>
					</div>
				{/if}
			</div>
		</section>

			</details>
		</div><!-- /more-analysis-toggle -->
	{/if}

	<!-- Bottom Navigation -->
	<PageNav
		backHref="/app/financials"
		backLabel="Financials"
		nextHref="/app/dashboard"
		nextLabel="Dashboard"
		nextIsGreen={true}
	/>
</div>
<style>
	.page {
		max-width: 1000px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		background-color: var(--bg);
		color: var(--text);
		font-family: system-ui, -apple-system, sans-serif;
	}

	.page-header {
		margin-bottom: 3rem;
	}

	.page-header h1 {
		font-size: 28px;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 0.5rem 0;
	}

	.page-subtitle {
		font-size: 15px;
		color: var(--text-secondary);
		margin: 0;
		font-weight: 500;
	}

	.section {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		margin-bottom: 2rem;
		overflow: hidden;
	}

	.section-header {
		padding: 1.5rem;
		border-bottom: 1px solid var(--border);
		background-color: var(--surface);
	}

	.section-header h2 {
		font-size: 18px;
		font-weight: 700;
		color: var(--accent);
		margin: 0;
	}

	.section-subtitle {
		font-size: 13px;
		color: var(--text-secondary);
		margin: 0.5rem 0 0 0;
	}

	.sim-guidance {
		font-size: 12px;
		color: #6B7280;
		background: #F0FDF4;
		border: 1px solid #BBF7D0;
		border-radius: 6px;
		padding: 7px 12px;
		margin: 0 0 16px 0;
	}

	.section-content {
		padding: 1.5rem;
	}

	.loading {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--text-secondary);
	}

	/* Location Context */
	.location-context {
		background: linear-gradient(135deg, rgba(13, 124, 110, 0.06) 0%, rgba(124, 58, 237, 0.06) 100%);
		border: 1px solid rgba(13, 124, 110, 0.15);
	}

	.location-context-card {
		background-color: var(--surface);
		border-radius: 8px;
		overflow: hidden;
	}

	.location-context-header {
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--border);
		background: linear-gradient(135deg, rgba(13, 124, 110, 0.08) 0%, rgba(124, 58, 237, 0.08) 100%);
	}

	.location-context-header h3 {
		font-size: 15px;
		font-weight: 600;
		color: var(--text);
		margin: 0;
		letter-spacing: 0.3px;
	}

	.location-context-body {
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.context-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 14px;
	}

	.context-label {
		font-weight: 600;
		color: var(--text-secondary);
		min-width: 120px;
	}

	.context-value {
		color: var(--text);
	}

	.score-badge {
		display: inline-block;
		background: rgba(180, 83, 9, 0.1);
		color: var(--accent);
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		font-weight: 600;
	}

	/* Card Structure */
	.card-structure {
		background-color: var(--surface);
		border: 1px solid var(--success);
		border-radius: 6px;
		padding: 1.5rem;
	}

	.structure-name {
		font-size: 20px;
		font-weight: 700;
		color: var(--success);
		margin-bottom: 1rem;
	}

	.structure-explanation {
		font-size: 15px;
		line-height: 1.6;
		color: var(--text);
		margin: 0;
	}

	/* Model Cards (2-column grid) */
	.grid {
		display: grid;
		gap: 1.5rem;
	}

	.grid-2col {
		grid-template-columns: repeat(2, 1fr);
	}

	.model-card {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 1.5rem;
		transition: all 0.2s;
	}

	.model-card:hover {
		border-color: var(--border);
		background-color: var(--surface);
	}

	.card-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--success);
		margin: 0 0 1rem 0;
	}

	.card-value {
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 0.8rem 0;
	}

	.card-note {
		font-size: 14px;
		color: var(--text-secondary);
		margin: 0.5rem 0 0 0;
		line-height: 1.5;
	}

	.card-highlight {
		font-size: 14px;
		color: var(--success);
		font-weight: 600;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}

	/* Revenue Summary */
	.revenue-summary {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.summary-stat {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 1rem;
		text-align: center;
	}

	.summary-stat.highlighted {
		border-color: var(--success);
		background-color: var(--green-soft);
	}

	.stat-label {
		font-size: 13px;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stat-value {
		font-size: 20px;
		font-weight: 700;
		color: var(--success);
	}

	.stat-percent {
		font-size: 12px;
		color: var(--text-secondary);
		margin-top: 0.5rem;
	}

	/* Subsection */
	.subsection-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--accent);
		margin: 2rem 0 1rem 0;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}

	/* Daypart Grid */
	.daypart-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
	}

	.daypart-card {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 1.2rem;
		text-align: center;
	}

	.daypart-name {
		font-size: 13px;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.daypart-percent {
		font-size: 18px;
		font-weight: 700;
		color: var(--success);
		margin-bottom: 0.5rem;
	}

	.daypart-revenue {
		font-size: 14px;
		color: var(--text);
	}

	/* Cost Table */
	.cost-table {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}

	.cost-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.2rem;
		border-bottom: 1px solid var(--border-subtle);
		font-size: 14px;
	}

	.cost-row:last-child {
		border-bottom: none;
	}

	.cost-row.total {
		background-color: var(--surface-alt);
		font-weight: 700;
		color: var(--success);
		border-top: 2px solid var(--border);
	}

	.cost-label {
		color: var(--text-secondary);
	}

	.cost-value {
		color: var(--text);
		font-weight: 600;
	}

	/* Break-Even Grid */
	.breakeven-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.breakeven-card {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 1.5rem;
		text-align: center;
	}

	.breakeven-card.highlighted {
		border-color: var(--success);
		background-color: var(--green-soft);
	}

	.breakeven-label {
		font-size: 13px;
		color: var(--text-secondary);
		margin-bottom: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.breakeven-value {
		font-size: 24px;
		font-weight: 700;
		color: var(--success);
	}

	.breakeven-percent {
		font-size: 13px;
		color: var(--text-secondary);
		margin-top: 0.5rem;
	}

	.breakeven-note, .stat-note, .stat-breakdown {
		font-size: 11px;
		color: var(--text-secondary);
		margin-top: 0.5rem;
		font-weight: 400;
		line-height: 1.4;
	}

	/* Progress Bar */
	.progress-bar-container {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid var(--border);
	}

	.progress-label {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 0.8rem;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background-color: var(--surface);
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 0.8rem;
		border: 1px solid var(--border);
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--success) 0%, var(--accent) 100%);
		border-radius: 4px;
	}

	.progress-text {
		font-size: 13px;
		color: var(--text-secondary);
		text-align: center;
	}

	/* Risk Flags */
	.flags-container {
		display: grid;
		gap: 1rem;
	}

	.flag-card {
		display: flex;
		gap: 1rem;
		padding: 1.2rem;
		border-radius: 6px;
		border: 1px solid var(--border);
		background-color: var(--surface);
	}

	.flag-card.flag-warning {
		border-color: #ff6b35;
		background-color: rgba(255, 107, 53, 0.08);
	}

	.flag-card.flag-caution {
		border-color: var(--warning);
		background-color: var(--amber-soft);
	}

	.flag-card.flag-coaching {
		border-color: var(--accent);
		background-color: var(--accent-light);
	}

	.flag-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.flag-content {
		flex: 1;
	}

	.flag-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 0.3rem;
	}

	.flag-message {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	/* Capital Summary */
	.capital-summary {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.capital-stat {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 1.2rem;
		text-align: center;
	}

	.capital-stat.highlighted {
		border-color: var(--success);
		background-color: var(--green-soft);
	}

	/* Tier Cards */
	.tiers-container {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.tier-card {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 1.2rem;
		transition: all 0.2s;
	}

	.tier-card:hover {
		border-color: var(--border);
		background-color: var(--surface);
	}

	.tier-card.tier-match {
		border-color: var(--success);
		background-color: var(--green-soft);
	}

	.tier-header {
		display: flex;
		justify-content: space-between;
		align-items: start;
		margin-bottom: 0.8rem;
	}

	.tier-name {
		font-size: 15px;
		font-weight: 700;
		color: var(--success);
	}

	.tier-match-badge {
		font-size: 11px;
		background-color: var(--success);
		color: var(--bg);
		padding: 0.25rem 0.6rem;
		border-radius: 3px;
		font-weight: 700;
	}

	.tier-capital {
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 0.8rem;
	}

	.tier-description {
		font-size: 13px;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.4;
	}

	/* Reality Check Callout */
	.reality-check .section-header {
		border-bottom: none;
	}

	.reality-callout {
		display: flex;
		gap: 1.2rem;
		background-color: var(--surface);
		border: 1px solid var(--success);
		border-radius: 6px;
		padding: 1.5rem;
		margin-top: 1.5rem;
	}

	.reality-icon {
		font-size: 1.8rem;
		flex-shrink: 0;
	}

	.reality-text {
		font-size: 14px;
		line-height: 1.6;
		color: var(--text);
	}

	.reality-text strong {
		color: var(--success);
	}

	/* Editable Inputs */
	.editable-inputs-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid var(--border);
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.input-group label {
		font-size: 13px;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-weight: 600;
	}

	.input-group input {
		background-color: transparent;
		border: none;
		border-bottom: 2px solid var(--border);
		color: var(--text);
		font-size: 16px;
		font-weight: 600;
		padding: 0.5rem 0;
		font-family: inherit;
		transition: border-color 0.2s;
	}

	.input-group input:focus {
		outline: none;
		border-bottom-color: var(--success);
		box-shadow: 0 2px 0 var(--success);
	}

	.input-group input::placeholder {
		color: var(--text-tertiary);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.page {
			padding: 1.5rem 1rem;
		}

		.page-header h1 {
			font-size: 22px;
		}

		.section-header h2 {
			font-size: 16px;
		}

		.grid-2col {
			grid-template-columns: 1fr;
		}

		.revenue-summary {
			grid-template-columns: repeat(2, 1fr);
		}

		.daypart-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.breakeven-grid {
			grid-template-columns: 1fr;
		}

		.capital-summary {
			grid-template-columns: repeat(2, 1fr);
		}

		.tiers-container {
			grid-template-columns: 1fr;
		}

		.reality-callout {
			flex-direction: column;
		}
	}
	/* 5-Year Chart */
	.chart-container {
		background: #f0f0f5;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 1rem;
		overflow-x: auto;
	}
	.projection-chart {
		width: 100%;
		max-width: 700px;
		margin: 0 auto;
		display: block;
	}
	.chart-legend {
		display: flex;
		gap: 1.5rem;
		justify-content: center;
		margin-top: 1rem;
		font-size: 12px;
		color: var(--text-tertiary);
	}
	.legend-item {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.legend-dot {
		width: 12px;
		height: 12px;
		border-radius: 3px;
		display: inline-block;
	}
	.projection-table {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.proj-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 8px 12px;
		background: var(--surface-alt);
		border-radius: 8px;
		font-size: 13px;
	}
	.proj-row:nth-child(odd) {
		background: var(--surface-alt);
	}
	.proj-year {
		font-weight: 600;
		color: var(--text);
		min-width: 60px;
	}
	.proj-metric {
		flex: 1;
		text-align: right;
		color: #666666;
	}
	.proj-label {
		font-size: 10px;
		color: #999999;
		display: block;
		text-transform: uppercase;
	}

	.premium-gate {
		min-height: 60vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
	}
	.premium-card {
		max-width: 480px;
		text-align: center;
		background: white;
		border: 1px solid #e8e2d8;
		border-radius: 16px;
		padding: 48px 40px;
		box-shadow: 0 4px 24px rgba(0,0,0,0.06);
	}
	.premium-icon { font-size: 48px; margin-bottom: 16px; }
	.premium-card h2 { font-size: 22px; font-weight: 700; color: #1a3a2a; margin: 0 0 12px; }
	.premium-card p { color: #6b7280; line-height: 1.6; margin: 0 0 24px; }
	.premium-btn-pri {
		display: inline-block;
		background: #1a3a2a;
		color: white;
		border: none;
		border-radius: 8px;
		padding: 12px 28px;
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		margin-bottom: 12px;
		display: block;
	}
	.premium-btn-sec {
		background: none;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		padding: 10px 24px;
		font-size: 14px;
		color: #6b7280;
		cursor: pointer;
		width: 100%;
	}
	.premium-btn-sec:hover { border-color: #4a7c5c; color: #4a7c5c; }
	.upgrade-wall { text-align: center; padding: 80px 24px; max-width: 480px; margin: 60px auto; }
	.upgrade-icon { font-size: 48px; margin-bottom: 16px; }
	.upgrade-wall h2 { font-size: 24px; font-weight: 700; color: #1a3a2a; margin: 0 0 12px; }
	.upgrade-wall p { color: #6b7280; margin: 0 0 24px; }
	.early-access-btn { background: #1a3a2a; color: #fff; border: none; border-radius: 8px; padding: 12px 28px; font-size: 15px; font-weight: 600; cursor: pointer; margin-bottom: 12px; display: block; width: 100%; }
	.early-access-btn:hover { background: #2d5a3d; }
	.upgrade-cta { display: block; background: #00e8cc; color: #1a3a2a; border-radius: 8px; padding: 12px 28px; font-size: 15px; font-weight: 700; text-decoration: none; text-align: center; }
	.upgrade-cta:hover { background: #00c9b0; }

	/* Order 14: 3-column scenario layout */
	.stale-data-banner {
		display: flex; align-items: center; gap: 10px;
		padding: 12px 18px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px;
		margin: 0 0 20px; font-size: 13px; color: #78350f;
	}
	.stale-icon { font-size: 16px; flex-shrink: 0; }
	.stale-text { line-height: 1.5; }
	.stale-text a { color: #0D7C6E; font-weight: 600; text-decoration: none; }
	.stale-text a:hover { text-decoration: underline; }

	.bc-baseline-banner {
		display: flex; align-items: center; justify-content: space-between;
		padding: 12px 20px; background: #f0f4f0; color: #1a3a2a; border: 1px solid #c8dcc8; border-radius: 12px;
		margin-bottom: 20px; flex-wrap: wrap; gap: 10px;
	}
	.bb-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; }
	.bb-label { font-weight: 700; }
	.bb-sep { opacity: 0.4; }
	.bb-meta { font-size: 11px; opacity: 0.85; }
	.bb-right { display: flex; align-items: center; gap: 12px; }
	.bb-rev { font-size: 12px; font-weight: 600; opacity: 0.9; }
	.bb-edit { font-size: 11px; padding: 4px 10px; background: rgba(26,58,42,0.08); border-radius: 6px; color: #1a3a2a; text-decoration: none; font-weight: 600; }
	.bb-edit:hover { background: rgba(26,58,42,0.14); }

	.scenario-layout { display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: flex-start; margin-bottom: 0; }
	.scenario-main { min-width: 0; }
	.scenario-copilot { position: sticky; top: 16px; }
	.copilot-card { background: #faf7f2; border: 1px solid #e8e2d8; border-radius: 14px; padding: 18px; }
	.copilot-card-hdr { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #e8e2d8; }
	.copilot-icon { font-size: 16px; }
	.copilot-title { font-size: 12px; font-weight: 700; color: #1a3a2a; }
	.copilot-msg { display: flex; gap: 8px; margin-bottom: 10px; }
	.copilot-msg-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
	.copilot-msg-text { font-size: 11px; color: #444; line-height: 1.55; margin: 0; }

	.three-col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
	.scenario-card { border-radius: 14px; overflow: hidden; border: 1px solid #e8e2d8; background: white; }
	.sc-header { padding: 14px 16px; }
	.conservative-hdr { background: rgba(232,52,90,0.06); border-bottom: 2px solid #e8345a; }
	.base-hdr { background: rgba(26,58,42,0.06); border-bottom: 2px solid #1a3a2a; }
	.optimistic-hdr { background: rgba(74,124,92,0.08); border-bottom: 2px solid #4a7c5c; }
	.sc-name { font-size: 14px; font-weight: 800; color: #1a3a2a; }
	.sc-tag { font-size: 11px; color: #666; margin-top: 2px; }
	.sc-body { padding: 14px 16px; }
	.sc-input-row { display: flex; align-items: center; gap: 6px; padding: 6px 0; border-bottom: 1px solid #f0ece4; font-size: 11px; }
	.sc-input-label { color: #666; flex: 1; }
	.sc-input-val { font-weight: 700; color: #1a3a2a; }
	.sc-delta { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px; }
	.sc-delta-neg { background: rgba(232,52,90,0.1); color: #e8345a; }
	.sc-delta-pos { background: rgba(74,124,92,0.1); color: #4a7c5c; }
	.sc-delta-base { background: rgba(26,58,42,0.08); color: #666; }
	.sc-pl { margin: 10px 0; }
	.sc-pl-row { display: flex; justify-content: space-between; font-size: 11px; padding: 4px 0; border-bottom: 1px solid #f8f4f0; color: #555; }
	.sc-pl-val { font-weight: 600; }
	.sc-pl-be { font-weight: 600; color: #1a3a2a; }
	.sc-neg { color: #e8345a; }
	.sc-profit { padding: 10px 14px; border-radius: 8px; text-align: center; margin-top: 10px; }
	.sc-profit-pos { background: rgba(74,124,92,0.08); }
	.sc-profit-neg { background: rgba(232,52,90,0.08); }
	.sc-profit-val { font-size: 20px; font-weight: 800; color: #1a3a2a; }
	.sc-profit-neg .sc-profit-val { color: #e8345a; }
	.sc-profit-label { font-size: 10px; color: #666; margin-top: 2px; }

	.comp-table-wrap { background: white; border: 1px solid #e8e2d8; border-radius: 14px; overflow: hidden; margin-bottom: 16px; }
	.comp-table-title { font-size: 12px; font-weight: 700; color: #4a7c5c; text-transform: uppercase; letter-spacing: 0.8px; padding: 14px 20px; border-bottom: 1px solid #e8e2d8; background: #faf7f2; }
	.comp-table { width: 100%; border-collapse: collapse; font-size: 12px; }
	.comp-table th, .comp-table td { padding: 10px 16px; border-bottom: 1px solid #f0ece4; text-align: left; }
	.comp-table th { font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; background: #faf7f2; }
	.col-conservative { color: #e8345a; }
	.col-base { color: #1a3a2a; }
	.col-optimistic { color: #4a7c5c; }
	.profit-row td { font-weight: 700; font-size: 13px; padding-top: 12px; }
	.profit-pos { color: #4a7c5c; }
	.profit-neg { color: #e8345a; }

	.key-insight { background: #f0f7f2; color: #1a3a2a; border: 1px solid #c8dcc8; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; }
	.ki-title { font-size: 14px; font-weight: 800; margin-bottom: 8px; }
	.ki-body { font-size: 12px; line-height: 1.6; color: #374151; margin: 0; }

	.more-analysis-toggle { margin-top: 24px; }
	.more-analysis-toggle summary { font-size: 13px; font-weight: 600; color: #4a7c5c; cursor: pointer; padding: 12px 0; border-top: 1px solid #e8e2d8; }

	@media (max-width: 900px) {
		.scenario-layout { grid-template-columns: 1fr; }
		.scenario-copilot { position: static; }
		.three-col { grid-template-columns: 1fr; }
	}

</style>
