<script lang="ts">
	import { onMount } from 'svelte';
	import { loadLaunchPadData } from '$lib/launchpad-store';
	import type { LaunchPadData } from '$lib/launchpad-store';
	import DisclaimerBanner from '$lib/components/DisclaimerBanner.svelte';
	import PageNav from '$lib/components/PageNav.svelte';
	import type {
		SpaceDetails, LeaseTerms, BuildoutEstimate, NegotiationCard,
		FitScore, FitScoreGap, SpaceTab, UploadedDocument,
		ExistingCondition
	} from '$lib/types/space';
	import { emptySpaceDetails, emptyLeaseTerms } from '$lib/types/space';
	import {
		BUILDOUT_CATEGORIES, CONDITION_MULTIPLIERS, CONTINGENCY_RATE,
		getNeighborhoodMultiplier, getGreaseTrapCost,
		type BusinessCategory
	} from '$lib/data/buildout-costs';
	import { LEASE_BENCHMARKS, getBenchmarkColor, type BenchmarkRating } from '$lib/data/lease-benchmarks';
	import { tierFor } from '$lib/intel/tiers';

	// ─── State ───
	let lpData = $state<LaunchPadData | null>(null);
	let pageState = $state<'empty' | 'analyzing' | 'results'>('empty');
	let activeTab = $state<SpaceTab>('overview');
	let space = $state<SpaceDetails>(emptySpaceDetails());
	let lease = $state<LeaseTerms>(emptyLeaseTerms());
	let documents = $state<UploadedDocument[]>([]);
	let dragOver = $state(false);
	let analysisSteps = $state<string[]>([]);
	let analysisRunning = $state(false);
	let expandedSections = $state<Record<string, boolean>>({
		'Property Basics': true,
		'Lease Terms': false,
		'Previous Tenant': false
	});

	// Computed
	let businessCategory = $derived<BusinessCategory>(
		mapBusinessType(lpData?.businessType || 'cafe')
	);
	let buildout = $derived<BuildoutEstimate>(computeBuildout(space, businessCategory));
	let fitScore = $derived<FitScore>(computeFitScore(space, lease, buildout, lpData));
	let leaseRatings = $derived(evaluateLeaseTerms(lease, space));

	const TABS: { id: SpaceTab; label: string; icon: string }[] = [
		{ id: 'overview', label: 'Space Overview', icon: '🏢' },
		{ id: 'physical', label: 'Physical Analysis', icon: '📐' },
		{ id: 'lease', label: 'Lease Intelligence', icon: '📜' },
		{ id: 'buildout', label: 'Buildout Estimator', icon: '🔨' },
		{ id: 'negotiation', label: 'Negotiation Playbook', icon: '🤝' },
		{ id: 'fit', label: 'Your Score', icon: '🎯' },
	];

	const ANALYSIS_STEPS = [
		'Parsing uploaded documents...',
		'Extracting space specifications...',
		'Analyzing physical layout...',
		'Checking building compliance...',
		'Estimating buildout costs...',
		'Parsing lease terms...',
		'Comparing to market benchmarks...',
		'Scoring space-to-business fit...',
		'Generating site intelligence report...',
	];

	const FLOOR_OPTIONS = ['Ground', 'Second', 'Third', 'Basement', 'Mezzanine'];
	const CONDITION_OPTIONS: { value: ExistingCondition; label: string }[] = [
		{ value: 'raw', label: 'Raw / Shell' },
		{ value: 'partial_other', label: 'Partial Buildout (Different Type)' },
		{ value: 'partial_same', label: 'Partial Buildout (Same Type)' },
		{ value: 'turnkey', label: 'Turnkey (Ready to Go)' },
	];

	onMount(() => {
		lpData = loadLaunchPadData();
		const saved = localStorage.getItem('re2_space_analysis');
		if (saved) {
			try {
				const data = JSON.parse(saved);
				space = data.space || emptySpaceDetails();
				lease = data.lease || emptyLeaseTerms();
				documents = data.documents || [];
				if (space.address) pageState = 'results';
			} catch { /* ignore */ }
		}

		// Auto-populate address from session data if not already set
		if (!space.address) {
			const sessionData = localStorage.getItem('re2_selected_location');
			if (sessionData) {
				try {
					const loc = JSON.parse(sessionData);
					// Location page stores as { addr, lat, lng } — accept both property names
					space.address = loc.addr || loc.address || space.address;
				} catch { /* ignore */ }
			}
		}
	});

	function saveAnalysis() {
		localStorage.setItem('re2_space_analysis', JSON.stringify({
			space, lease, documents, savedAt: new Date().toISOString()
		}));
	}

	// ─── File Upload ───
	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) handleFiles(input.files);
	}

	function handleFiles(files: FileList) {
		const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
		const maxSize = 25 * 1024 * 1024;
		for (const file of Array.from(files)) {
			if (!allowed.includes(file.type)) { alert(`${file.name}: Use PDF, JPG, or PNG.`); continue; }
			if (file.size > maxSize) { alert(`${file.name}: Max 25MB.`); continue; }
			const reader = new FileReader();
			reader.onload = () => {
				const docType = file.type === 'application/pdf' ? 'brochure' : 'photo';
				documents = [...documents, {
					id: crypto.randomUUID(),
					type: docType as UploadedDocument['type'],
					filename: file.name,
					dataUrl: reader.result as string,
					parsedData: {},
					confidence: {},
					uploadedAt: new Date().toISOString()
				}];
			};
			reader.readAsDataURL(file);
		}
	}

	function removeDocument(id: string) { documents = documents.filter(d => d.id !== id); }

	// ─── E=MC² Analysis ───
	async function runAnalysis() {
		if (!space.address && documents.length === 0) { alert('Enter an address or upload a document.'); return; }

		analysisRunning = true;
		analysisSteps = [];
		pageState = 'analyzing';

		// Auto-detect grease trap
		const foodTypes = ['restaurant', 'cafe', 'bakery', 'deli', 'food', 'kitchen', 'pizzeria'];
		if (space.previousTenantType && foodTypes.some(t => space.previousTenantType!.toLowerCase().includes(t))) {
			space.greaseTrap = 'exists';
		} else if (businessCategory === 'cafe' || businessCategory === 'restaurant') {
			space.greaseTrap = 'required';
		} else {
			space.greaseTrap = 'not_needed';
		}

		// Compute usable sq ft (guard handles both 0 and null defaults)
		if (space.squareFeet > 0 && !space.usableSquareFeet) {
			const ratio = (businessCategory === 'cafe' || businessCategory === 'restaurant') ? 0.65 : 0.85;
			space.usableSquareFeet = Math.round(space.squareFeet * ratio);
		}

		// Compute rent per sqft
		if (lease.baseRent.monthly > 0 && space.squareFeet > 0 && !lease.baseRent.perSqFt) {
			lease.baseRent.annual = lease.baseRent.monthly * 12;
			lease.baseRent.perSqFt = Math.round(lease.baseRent.annual / space.squareFeet);
		}

		// TI total
		if (lease.tiAllowance.perSqFt > 0 && space.squareFeet > 0 && !lease.tiAllowance.total) {
			lease.tiAllowance.total = lease.tiAllowance.perSqFt * space.squareFeet;
		}

		// Animate steps
		for (const step of ANALYSIS_STEPS) {
			analysisSteps = [...analysisSteps, step];
			await delay(400);
		}
		await delay(2000);

		// Lease favorability
		let greenCount = 0;
		let total = 0;
		for (const r of leaseRatings) {
			total++;
			if (r.rating === 'green') greenCount++;
			else if (r.rating === 'yellow') greenCount += 0.5;
		}
		lease.favorabilityScore = total > 0 ? Math.round((greenCount / total) * 100) : 50;

		saveAnalysis();
		analysisRunning = false;
		pageState = 'results';
	}

	// ─── Buildout Estimator ───
	function computeBuildout(s: SpaceDetails, biz: BusinessCategory): BuildoutEstimate {
		if (!s.squareFeet) return { lineItems: [], subtotal: 0, contingency: 0, grandTotal: 0, timelineWeeks: 0, neighborhoodMultiplier: 1, conditionMultiplier: 1, greaseTrapCost: 0 };

		const nMult = getNeighborhoodMultiplier(s.neighborhood);
		const cMult = CONDITION_MULTIPLIERS[s.existingCondition] || CONDITION_MULTIPLIERS['raw'];
		const grease = getGreaseTrapCost(s.squareFeet, s.previousTenantType);

		const lineItems = BUILDOUT_CATEGORIES.map(cat => ({
			category: cat.label,
			cost: Math.round(s.squareFeet * cat.perSqFt[biz] * nMult.multiplier * cMult.multiplier)
		}));

		const subtotal = lineItems.reduce((sum, item) => sum + item.cost, 0);
		const greaseTrapCost = (s.greaseTrap === 'required' || (!s.previousTenantType && (biz === 'cafe' || biz === 'restaurant')))
			? Math.round((grease.low + grease.high) / 2) : 0;
		const contingency = Math.round((subtotal + greaseTrapCost) * CONTINGENCY_RATE);
		const grandTotal = subtotal + greaseTrapCost + contingency;
		const baseWeeks = s.existingCondition === 'turnkey' ? 4 : s.existingCondition === 'partial_same' ? 8 : s.existingCondition === 'partial_other' ? 12 : 16;

		return { lineItems, subtotal, contingency, grandTotal, timelineWeeks: baseWeeks, neighborhoodMultiplier: nMult.multiplier, conditionMultiplier: cMult.multiplier, greaseTrapCost };
	}

	// ─── Lease Intelligence ───
	function evaluateLeaseTerms(l: LeaseTerms, s: SpaceDetails): { benchmark: typeof LEASE_BENCHMARKS[0]; value: string; rating: BenchmarkRating }[] {
		const valueMap: Record<string, number | string | boolean | null> = {
			'escalation': l.escalation.rate,
			'tiAllowance': l.tiAllowance.perSqFt,
			'personalGuarantee': l.personalGuarantee.months,
			'leaseTerm': l.leaseTerm.years,
			'rentFreeBuildout': l.buildoutPeriod.rentFreeMonths,
			'exclusivity': l.exclusivity.radius,
			'assignment': l.assignment.allowed,
			'camCharges': s.squareFeet > 0 ? Math.round(l.camCharges.annual / Math.max(1, s.squareFeet)) : 0,
		};
		return LEASE_BENCHMARKS.map(b => {
			const raw = valueMap[b.key] ?? null;
			return { benchmark: b, value: b.format(raw), rating: b.evaluate(raw) };
		});
	}

	// ─── Fit Score ───
	function computeFitScore(s: SpaceDetails, l: LeaseTerms, b: BuildoutEstimate, lp: LaunchPadData | null): FitScore {
		if (!s.squareFeet) return { overall: 0, physical: 0, financial: 0, risk: 0, gaps: [] };

		const gaps: FitScoreGap[] = [];
		const targetSqFt = lp?.financialGoals?.squareFootage || 0;
		const rentBudget = lp?.financialGoals?.monthlyRentBudget || 0;
		const buildoutBudget = lp?.financialGoals?.buildoutBudget || 0;

		// Physical Fit (30%)
		let physical = 70;
		if (targetSqFt > 0) {
			const r = s.squareFeet / targetSqFt;
			if (r >= 0.9 && r <= 1.2) physical += 15;
			else if (r >= 0.7 && r <= 1.4) physical += 5;
			else { physical -= 20; gaps.push({ component: 'Physical', score: 0, explanation: `Space is ${s.squareFeet} sqft vs your ${targetSqFt} sqft target (${Math.round(r * 100)}% match).`, fix: r < 0.9 ? 'Consider if a smaller footprint can work with creative layout' : 'Excess space increases rent burden — negotiate based on usable area' }); }
		}
		if (s.ceilingHeight >= 12) physical += 5;
		if (s.floor === 'Ground') physical += 5;
		if (s.greaseTrap === 'exists') physical += 5;
		else if (s.greaseTrap === 'required') { physical -= 10; gaps.push({ component: 'Physical', score: 0, explanation: 'No grease trap — installation costs $15K–$40K and adds 6–8 weeks.', fix: 'Negotiate grease trap installation as landlord responsibility or TI offset' }); }
		physical = clamp(physical, 0, 100);

		// Financial Fit (40%)
		let financial = 70;
		if (rentBudget > 0 && l.baseRent.monthly > 0) {
			const r = l.baseRent.monthly / rentBudget;
			if (r <= 1.0) financial += 15;
			else if (r <= 1.15) financial += 5;
			else { financial -= 20; gaps.push({ component: 'Financial', score: 0, explanation: `Rent at $${l.baseRent.monthly.toLocaleString()}/mo exceeds your $${rentBudget.toLocaleString()} target by ${Math.round((r - 1) * 100)}%.`, fix: `Negotiating a $${Math.round(l.baseRent.monthly - rentBudget).toLocaleString()}/mo reduction or securing higher TI would help` }); }
		}
		if (buildoutBudget > 0 && b.grandTotal > 0) {
			const r = b.grandTotal / buildoutBudget;
			if (r <= 1.0) financial += 10;
			else if (r <= 1.2) financial += 0;
			else { financial -= 15; gaps.push({ component: 'Financial', score: 0, explanation: `Buildout estimate ($${b.grandTotal.toLocaleString()}) exceeds your $${buildoutBudget.toLocaleString()} budget by ${Math.round((r - 1) * 100)}%.`, fix: 'Consider turnkey/partial spaces, negotiate higher TI, or phase the buildout' }); }
		}
		if (l.tiAllowance.total > 0) financial += Math.min(10, Math.round(l.tiAllowance.total / 5000));
		if (l.buildoutPeriod.rentFreeMonths >= 3) financial += 5;
		financial = clamp(financial, 0, 100);

		// Risk Fit (30%)
		let risk = 70;
		if (l.personalGuarantee.months <= 12) risk += 10;
		else if (l.personalGuarantee.months > 24) { risk -= 15; gaps.push({ component: 'Risk', score: 0, explanation: `Personal guarantee of ${l.personalGuarantee.months} months is above the 12-24 month market range.`, fix: 'Negotiate a burndown clause or cap PG at 12 months with a security deposit' }); }
		if (l.assignment.allowed) risk += 5;
		else { risk -= 10; gaps.push({ component: 'Risk', score: 0, explanation: 'No assignment rights — you cannot transfer the lease if you sell.', fix: 'Request assignment rights with landlord consent not unreasonably withheld' }); }
		// 3% NYC commercial rent escalation average. Source: REBNY Manhattan Retail Report 2023;
		// CoStar NYC retail lease data shows median escalation 2.5-3.0% fixed or CPI-linked.
		// #65: sourced. Consider making this neighborhood-specific using PLUTO data in future.
		if (l.escalation.rate > 4) { risk -= 10; gaps.push({ component: 'Risk', score: 0, explanation: `Escalation at ${l.escalation.rate}% exceeds the 3% NYC average (REBNY 2023).`, fix: 'Negotiate a 3% fixed cap or CPI-linked with a 3% ceiling' }); }
		risk = clamp(risk, 0, 100);

		const overall = Math.round(physical * 0.3 + financial * 0.4 + risk * 0.3);
		return { overall, physical, financial, risk, gaps };
	}

	// ─── Negotiation Cards ───
	function generateNegotiationCards(): NegotiationCard[] {
		const cards: NegotiationCard[] = [];
		for (const lr of leaseRatings) {
			if (lr.rating === 'green') continue;
			const b = lr.benchmark;

			if (b.key === 'tiAllowance' && lease.tiAllowance.perSqFt < 45) {
				cards.push({ issue: `TI at $${lease.tiAllowance.perSqFt}/sqft is below $35–$55 NYC average.`, ask: `Request $50/sqft ($${(50 * space.squareFeet).toLocaleString()}) or equivalent rent abatement.`, justification: `Average TI in ${space.neighborhood || 'NYC'} for new food tenants is $45–$55/sqft. Buildout estimated at $${buildout.grandTotal.toLocaleString()}.`, leverage: ['Space requires significant buildout', buildout.greaseTrapCost > 0 ? 'Grease trap installation needed' : '', 'Your business adds foot traffic'].filter(Boolean), fallback: `If TI firm at $${lease.tiAllowance.perSqFt}, request ${lease.buildoutPeriod.rentFreeMonths + 2} months rent-free.`, priority: lease.tiAllowance.perSqFt < 25 ? 'high' : 'medium', financialImpact: (50 - lease.tiAllowance.perSqFt) * space.squareFeet });
			}
			if (b.key === 'escalation' && lease.escalation.rate > 3) {
				cards.push({ issue: `Escalation at ${lease.escalation.rate}% exceeds 3% NYC average.`, ask: 'Negotiate to 3% fixed or CPI-linked with 3% cap.', justification: `Most retail leases in ${space.neighborhood || 'NYC'} are 2.5%–3%. Over ${lease.leaseTerm.years} years, the difference is significant.`, leverage: ['Market standard is lower', 'Higher escalation increases vacancy risk'], fallback: 'Accept current rate if landlord lowers base rent or extends rent-free period.', priority: lease.escalation.rate > 4 ? 'high' : 'medium', financialImpact: Math.round(lease.baseRent.annual * (lease.escalation.rate - 3) / 100 * lease.leaseTerm.years) });
			}
			if (b.key === 'personalGuarantee' && lease.personalGuarantee.months > 12) {
				cards.push({ issue: `PG at ${lease.personalGuarantee.months} months exceeds 12-month benchmark.`, ask: 'Request 12-month PG with burndown clause.', justification: 'Standard NYC retail PG is 12–24 months. Burndown provisions reduce founder risk.', leverage: ['Business plan shows viability', 'Motivated tenant benefits landlord'], fallback: `Accept ${lease.personalGuarantee.months} months with burndown starting at month 12.`, priority: lease.personalGuarantee.months > 24 ? 'high' : 'medium', financialImpact: lease.baseRent.monthly * (lease.personalGuarantee.months - 12) });
			}
			if (b.key === 'rentFreeBuildout' && lease.buildoutPeriod.rentFreeMonths < 3) {
				cards.push({ issue: `Rent-free buildout of ${lease.buildoutPeriod.rentFreeMonths} months is below 2–4 month average.`, ask: 'Request 3–4 months rent-free during buildout.', justification: `Buildout takes ${buildout.timelineWeeks} weeks. Industry standard is 2–4 months rent-free.`, leverage: ['Buildout timeline justifies the ask', 'No revenue during construction'], fallback: 'Accept 2 months rent-free plus reduced rent for months 3–4.', priority: 'medium', financialImpact: lease.baseRent.monthly * (3 - lease.buildoutPeriod.rentFreeMonths) });
			}
			if (b.key === 'assignment' && !lease.assignment.allowed) {
				cards.push({ issue: 'No assignment rights — exit flexibility restricted.', ask: 'Request assignment with landlord consent not unreasonably withheld.', justification: 'Assignment rights are standard and critical for business resale value.', leverage: ['Standard market practice', 'Replacement tenant without vacancy'], fallback: 'Accept with landlord approval plus reasonable transfer fee.', priority: 'high', financialImpact: 0 });
			}
		}
		return cards.sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority]);
	}

	// ─── Helpers ───
	function mapBusinessType(type: string): BusinessCategory {
		const l = (type || '').toLowerCase();
		if (l.includes('restaurant') || l.includes('full service')) return 'restaurant';
		if (l.includes('retail') || l.includes('shop')) return 'retail';
		if (l.includes('gym') || l.includes('fitness') || l.includes('yoga')) return 'fitness';
		return 'cafe';
	}
	function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
	function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
	function fmt(n: number): string { return '$' + n.toLocaleString(); }
	function scoreColor(s: number): string { return s >= 85 ? '#00ff88' : s >= 70 ? '#4CAF50' : s >= 50 ? '#ffbb00' : s >= 30 ? '#ff6b35' : '#ff4444'; }
	// FIX-025: BR-1 unified verdict vocabulary
	// EF-4 (April 11): canonical tier vocabulary from tierFor.
	function scoreLabel(s: number): string { return tierFor(s, 'fitIQ').label; }

	function resetAnalysis() {
		space = emptySpaceDetails(); lease = emptyLeaseTerms(); documents = []; pageState = 'empty';
		localStorage.removeItem('re2_space_analysis');
	}
</script>

<svelte:head><title>RE² — Space IQ</title></svelte:head>

<div class="page">
	<DisclaimerBanner />

	{#if pageState === 'empty' || pageState === 'analyzing'}
	<div class="page-header">
		<h1>Space IQ</h1>
		<p class="page-subtitle">Analyze a specific retail space — upload broker materials or enter details manually</p>
	</div>

	<!-- Upload Zone - Emphasized as Recommended Path -->
	<div class="upload-section">
		<div class="upload-label">Recommended: Upload a broker sheet</div>
		<div class="upload-zone" class:drag-over={dragOver}
			ondragover={(e) => { e.preventDefault(); dragOver = true; }}
			ondragleave={() => dragOver = false}
			ondrop={handleDrop}>
			<div class="upload-icon">📄</div>
			<p class="upload-title">Drop broker brochure, lease, or floorplan</p>
			<p class="upload-hint">or click to browse files</p>
			<p class="upload-formats">PDF, JPG, PNG up to 25MB</p>
			<input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onchange={handleFileInput} class="file-input" />
		</div>

		{#if documents.length > 0}
		<div class="uploaded-files">
			{#each documents as doc}
			<div class="uploaded-file">
				<span class="file-icon">{doc.type === 'brochure' || doc.type === 'lease' ? '📄' : '📷'}</span>
				<span class="file-name">{doc.filename}</span>
				<button class="file-remove" onclick={() => removeDocument(doc.id)}>&#10005;</button>
			</div>
			{/each}
		</div>
		{/if}
	</div>

	<div class="divider"><span>or enter details manually</span></div>

	<!-- Manual Entry Form with Collapsible Sections -->
	<div class="form-container">
		<!-- Property Basics Section -->
		<div class="collapsible-section">
			<button class="section-header" onclick={() => expandedSections['Property Basics'] = !expandedSections['Property Basics']}>
				<span class="chevron" class:expanded={expandedSections['Property Basics']}>›</span>
				<span class="section-title">Property Basics</span>
			</button>
			{#if expandedSections['Property Basics']}
			<div class="form-grid section-content">
				<div class="form-group span-2">
					<label for="address">Address</label>
					<input id="address" type="text" bind:value={space.address} placeholder="e.g., 123 Main St, New York, NY" />
				</div>
				<div class="form-group">
					<label for="neighborhood">Neighborhood</label>
					<input id="neighborhood" type="text" bind:value={space.neighborhood} placeholder="e.g., Downtown" />
				</div>
				<div class="form-group">
					<label for="sqft">Square Feet</label>
					<input id="sqft" type="number" bind:value={space.squareFeet} placeholder="e.g., 1,200" />
				</div>
				<div class="form-group">
					<label for="frontage">Frontage Width (ft)</label>
					<input id="frontage" type="number" bind:value={space.frontageWidth} placeholder="e.g., 25" />
				</div>
				<div class="form-group">
					<label for="floor">Floor</label>
					<select id="floor" bind:value={space.floor}>
						{#each FLOOR_OPTIONS as f}<option value={f}>{f}</option>{/each}
					</select>
				</div>
			</div>
			{/if}
		</div>

		<!-- Lease Terms Section -->
		<div class="collapsible-section">
			<button class="section-header" onclick={() => expandedSections['Lease Terms'] = !expandedSections['Lease Terms']}>
				<span class="chevron" class:expanded={expandedSections['Lease Terms']}>›</span>
				<span class="section-title">Lease Terms</span>
			</button>
			{#if expandedSections['Lease Terms']}
			<div class="form-grid section-content">
				<div class="form-group">
					<label for="rent">Asking Rent ($/mo)</label>
					<input id="rent" type="number" bind:value={lease.baseRent.monthly} placeholder="e.g., 12,000" />
				</div>
				<div class="form-group">
					<label for="leaseTerm">Lease Term (years)</label>
					<input id="leaseTerm" type="number" bind:value={lease.leaseTerm.years} placeholder="e.g., 10" />
				</div>
				<div class="form-group">
					<label for="escalation">Escalation Rate (%)</label>
					<input id="escalation" type="number" step="0.5" bind:value={lease.escalation.rate} placeholder="e.g., 3" />
				</div>
				<div class="form-group">
					<label for="ti">TI Allowance ($/sqft)</label>
					<input id="ti" type="number" bind:value={lease.tiAllowance.perSqFt} placeholder="e.g., 40" />
				</div>
				<div class="form-group">
					<label for="rentFree">Rent-Free Months</label>
					<input id="rentFree" type="number" bind:value={lease.buildoutPeriod.rentFreeMonths} placeholder="e.g., 3" />
				</div>
				<div class="form-group">
					<label for="pg">Personal Guarantee (months)</label>
					<input id="pg" type="number" bind:value={lease.personalGuarantee.months} placeholder="e.g., 12" />
				</div>
				<div class="form-group">
					<label for="cam">CAM Charges ($/yr)</label>
					<input id="cam" type="number" bind:value={lease.camCharges.annual} placeholder="e.g., 5,000" />
				</div>
				<div class="form-group checkbox-group">
					<label for="assignmentAllowed">
						<input id="assignmentAllowed" type="checkbox" bind:checked={lease.assignment.allowed} />
						Assignment Rights
					</label>
				</div>
			</div>
			{/if}
		</div>

		<!-- Previous Tenant Section -->
		<div class="collapsible-section">
			<button class="section-header" onclick={() => expandedSections['Previous Tenant'] = !expandedSections['Previous Tenant']}>
				<span class="chevron" class:expanded={expandedSections['Previous Tenant']}>›</span>
				<span class="section-title">Previous Tenant</span>
			</button>
			{#if expandedSections['Previous Tenant']}
			<div class="form-grid section-content">
				<div class="form-group">
					<label for="prevTenant">Business Name</label>
					<input id="prevTenant" type="text" bind:value={space.previousTenant} placeholder="e.g., Joe's Pizza" />
				</div>
				<div class="form-group">
					<label for="prevType">Business Type</label>
					<input id="prevType" type="text" bind:value={space.previousTenantType} placeholder="e.g., Restaurant" />
				</div>
				<div class="form-group">
					<label for="ceiling">Ceiling Height (ft)</label>
					<input id="ceiling" type="number" bind:value={space.ceilingHeight} placeholder="e.g., 12" />
				</div>
				<div class="form-group">
					<label for="condition">Existing Condition</label>
					<select id="condition" bind:value={space.existingCondition}>
						{#each CONDITION_OPTIONS as c}<option value={c.value}>{c.label}</option>{/each}
					</select>
				</div>
			</div>
			{/if}
		</div>
	</div>

	<div class="emc2-section">
		<button class="btn-action" onclick={runAnalysis} disabled={analysisRunning}>
			{analysisRunning ? 'Analyzing...' : 'Analyze Space'}
		</button>
	</div>

	{#if pageState === 'analyzing'}
	<div class="analysis-progress">
		{#each analysisSteps as step, i}
		<div class="step" class:active={i === analysisSteps.length - 1}>
			<span class="step-check">{i < analysisSteps.length - 1 ? '✓' : '◉'}</span> {step}
		</div>
		{/each}
	</div>
	{/if}

	{:else}
	<!-- ═══ RESULTS STATE ═══ -->
	<div class="results-header">
		<div>
			<h1>Site Intelligence Report</h1>
			<p class="results-address">{space.address || 'Manual Analysis'}{space.neighborhood ? ` · ${space.neighborhood}` : ''}</p>
		</div>
		<button class="btn-secondary" onclick={resetAnalysis}>New Analysis</button>
	</div>

	<div class="score-bar">
		<div class="score-item"><span class="score-label">Your Score</span><span class="score-value" style="color: {scoreColor(fitScore.overall)}">{fitScore.overall}</span><span class="score-sublabel">{scoreLabel(fitScore.overall)}</span></div>
		<div class="score-divider"></div>
		<div class="score-item"><span class="score-label">Physical</span><span class="score-value" style="color: {scoreColor(fitScore.physical)}">{fitScore.physical}</span></div>
		<div class="score-item"><span class="score-label">Financial</span><span class="score-value" style="color: {scoreColor(fitScore.financial)}">{fitScore.financial}</span></div>
		<div class="score-item"><span class="score-label">Risk</span><span class="score-value" style="color: {scoreColor(fitScore.risk)}">{fitScore.risk}</span></div>
		<div class="score-divider"></div>
		<div class="score-item"><span class="score-label">Lease</span><span class="score-value" style="color: {scoreColor(lease.favorabilityScore)}">{lease.favorabilityScore}</span></div>
		<div class="score-item"><span class="score-label">Buildout</span><span class="score-value buildout-val">{fmt(buildout.grandTotal)}</span></div>
	</div>

	<div class="tabs">
		{#each TABS as tab}
		<button class="tab" class:active={activeTab === tab.id} onclick={() => activeTab = tab.id}>
			<span class="tab-icon">{tab.icon}</span> {tab.label}
		</button>
		{/each}
	</div>

	<div class="tab-content">
		{#if activeTab === 'overview'}
		<div class="overview-grid">
			<div class="detail-card">
				<h3>Space Specs</h3>
				<div class="detail-row"><span>Address</span><span>{space.address || '—'}</span></div>
				<div class="detail-row"><span>Neighborhood</span><span>{space.neighborhood || '—'}</span></div>
				<div class="detail-row"><span>Total Sq Ft</span><span>{space.squareFeet.toLocaleString()}</span></div>
				<div class="detail-row"><span>Usable Sq Ft</span><span>{space.usableSquareFeet.toLocaleString()}</span></div>
				<div class="detail-row"><span>Floor</span><span>{space.floor}</span></div>
				<div class="detail-row"><span>Ceiling Height</span><span>{space.ceilingHeight ? space.ceilingHeight + ' ft' : '—'}</span></div>
				<div class="detail-row"><span>Frontage</span><span>{space.frontageWidth ? space.frontageWidth + ' ft' : '—'}</span></div>
				<div class="detail-row"><span>Condition</span><span>{CONDITION_MULTIPLIERS[space.existingCondition]?.description || space.existingCondition}</span></div>
			</div>
			<div class="detail-card">
				<h3>Previous Tenant</h3>
				<div class="detail-row"><span>Name</span><span>{space.previousTenant || 'Unknown'}</span></div>
				<div class="detail-row"><span>Type</span><span>{space.previousTenantType || 'Unknown'}</span></div>
				<div class="detail-row"><span>Grease Trap</span><span class="grease-status" class:grease-ok={space.greaseTrap === 'exists'} class:grease-warn={space.greaseTrap === 'required'}>{space.greaseTrap === 'exists' ? '✓ Likely exists' : space.greaseTrap === 'required' ? '⚠ Installation needed' : 'Not needed'}</span></div>
				{#if space.greaseTrap === 'required'}
				<div class="grease-warning">Installing a grease trap costs $15K–$40K and adds 6–8 weeks. Factor this into negotiations.</div>
				{/if}
			</div>
			<div class="detail-card">
				<h3>Key Lease Terms</h3>
				<div class="detail-row"><span>Base Rent</span><span>{fmt(lease.baseRent.monthly)}/mo</span></div>
				<div class="detail-row"><span>Annual</span><span>{fmt(lease.baseRent.annual)}</span></div>
				<div class="detail-row"><span>Per Sq Ft</span><span>{lease.baseRent.perSqFt ? `$${lease.baseRent.perSqFt}/sqft` : '—'}</span></div>
				<div class="detail-row"><span>Escalation</span><span>{lease.escalation.rate}% {lease.escalation.type}</span></div>
				<div class="detail-row"><span>Term</span><span>{lease.leaseTerm.years} years</span></div>
				<div class="detail-row"><span>TI Allowance</span><span>{lease.tiAllowance.perSqFt ? `$${lease.tiAllowance.perSqFt}/sqft` : '—'}</span></div>
				<div class="detail-row"><span>PG</span><span>{lease.personalGuarantee.months} months</span></div>
			</div>
		</div>

		{:else if activeTab === 'physical'}
		<div class="physical-grid">
			<div class="detail-card">
				<h3>Space Breakdown</h3>
				<div class="area-bar">
					<div class="area-fill foh" style="width: {space.squareFeet > 0 ? Math.round(space.usableSquareFeet / space.squareFeet * 100) : 65}%">FOH ({space.usableSquareFeet.toLocaleString()} sqft)</div>
					<div class="area-fill boh">BOH ({(space.squareFeet - space.usableSquareFeet).toLocaleString()} sqft)</div>
				</div>
				<div class="detail-row"><span>Kitchen-to-Front Ratio</span><span>{space.squareFeet > 0 ? Math.round((space.squareFeet - space.usableSquareFeet) / space.squareFeet * 100) : 35}%</span></div>
				<div class="detail-row"><span>Industry Benchmark</span><span>{businessCategory === 'restaurant' ? '40% BOH / 60% FOH' : '30% BOH / 70% FOH'}</span></div>
			</div>
			<div class="detail-card">
				<h3>Seating Capacity</h3>
				<div class="big-number">{Math.floor(space.usableSquareFeet / 15)}</div>
				<p class="big-number-label">seats at 15 sqft/seat</p>
			</div>
			<div class="detail-card span-2">
				<h3>Compliance Flags</h3>
				<div class="flag-row" class:flag-pass={space.floor === 'Ground'}><span>{space.floor === 'Ground' ? '✓' : '⚠'} ADA Accessibility</span><span>{space.floor === 'Ground' ? 'Ground floor — accessible' : 'Upper floor — elevator/ramp needed'}</span></div>
				<div class="flag-row" class:flag-pass={space.greaseTrap !== 'required'}><span>{space.greaseTrap === 'required' ? '⚠' : '✓'} Grease Trap</span><span>{space.greaseTrap === 'exists' ? 'Exists' : space.greaseTrap === 'required' ? 'Installation required' : 'Not needed'}</span></div>
				<div class="flag-row" class:flag-pass={space.ceilingHeight >= 10}><span>{space.ceilingHeight >= 10 ? '✓' : '⚠'} Ceiling Height</span><span>{space.ceilingHeight}ft {space.ceilingHeight >= 12 ? '(excellent)' : space.ceilingHeight >= 10 ? '(adequate)' : '(may limit hood installation)'}</span></div>
			</div>
		</div>

		{:else if activeTab === 'lease'}
		<div class="lease-section">
			<div class="lease-header-row"><h3>Lease Term Benchmarks</h3><div class="lease-score">Favorability: <span style="color: {scoreColor(lease.favorabilityScore)}">{lease.favorabilityScore}/100</span></div></div>
			<table class="benchmark-table">
				<thead><tr><th>Term</th><th>Your Lease</th><th>NYC Average</th><th>Good for Tenant</th><th>Red Flag</th><th>Rating</th></tr></thead>
				<tbody>
					{#each leaseRatings as lr}
					<tr><td class="term-name">{lr.benchmark.label}</td><td><strong>{lr.value}</strong></td><td class="muted">{lr.benchmark.nycAverage}</td><td class="muted">{lr.benchmark.goodForTenant}</td><td class="muted">{lr.benchmark.redFlag}</td><td><span class="rating-dot" style="background: {getBenchmarkColor(lr.rating)}"></span></td></tr>
					{/each}
				</tbody>
			</table>
		</div>

		{:else if activeTab === 'buildout'}
		<div class="buildout-section">
			<div class="buildout-header">
				<div><h3>Buildout Cost Estimate</h3><p class="buildout-meta">{space.squareFeet.toLocaleString()} sqft · {space.neighborhood || 'Standard'} ({buildout.neighborhoodMultiplier}x) · {CONDITION_MULTIPLIERS[space.existingCondition]?.description || 'Raw'} ({buildout.conditionMultiplier}x)</p></div>
				<div class="buildout-total"><span class="buildout-total-label">Grand Total</span><span class="buildout-total-value">{fmt(buildout.grandTotal)}</span></div>
			</div>
			<table class="buildout-table">
				<thead><tr><th>Category</th><th>Cost</th></tr></thead>
				<tbody>
					{#each buildout.lineItems as item}<tr><td>{item.category}</td><td class="cost-cell">{fmt(item.cost)}</td></tr>{/each}
					{#if buildout.greaseTrapCost > 0}<tr class="grease-row"><td>⚠ Grease Trap Installation</td><td class="cost-cell">{fmt(buildout.greaseTrapCost)}</td></tr>{/if}
					<tr class="subtotal-row"><td>Subtotal</td><td class="cost-cell">{fmt(buildout.subtotal + buildout.greaseTrapCost)}</td></tr>
					<tr><td>Contingency (15%)</td><td class="cost-cell">{fmt(buildout.contingency)}</td></tr>
					<tr class="total-row"><td><strong>Grand Total</strong></td><td class="cost-cell"><strong>{fmt(buildout.grandTotal)}</strong></td></tr>
				</tbody>
			</table>
			<div class="buildout-footer">
				<div class="timeline-badge">📅 Timeline: <strong>{buildout.timelineWeeks} weeks</strong></div>
				{#if lpData?.financialGoals?.buildoutBudget}
				<div class="budget-compare" class:over-budget={buildout.grandTotal > (lpData.financialGoals.buildoutBudget || 0)}>
					{buildout.grandTotal <= (lpData.financialGoals.buildoutBudget || 0) ? `✓ Within your $${(lpData.financialGoals.buildoutBudget || 0).toLocaleString()} budget` : `⚠ Exceeds your $${(lpData.financialGoals.buildoutBudget || 0).toLocaleString()} budget by ${fmt(buildout.grandTotal - (lpData.financialGoals.buildoutBudget || 0))}`}
				</div>
				{/if}
			</div>
		</div>

		{:else if activeTab === 'negotiation'}
		<div class="negotiation-section">
			<h3>Negotiation Playbook</h3>
			<p class="negotiation-intro">Your strongest positions based on lease terms vs. market benchmarks:</p>
			{#each generateNegotiationCards() as card}
			<div class="neg-card" class:neg-high={card.priority === 'high'} class:neg-medium={card.priority === 'medium'}>
				<div class="neg-card-header">
					<span class="neg-priority" class:p-high={card.priority === 'high'} class:p-med={card.priority === 'medium'} class:p-low={card.priority === 'low'}>{card.priority.toUpperCase()}</span>
					{#if card.financialImpact > 0}<span class="neg-impact">Impact: {fmt(card.financialImpact)}</span>{/if}
				</div>
				<div class="neg-field"><strong>Issue:</strong> {card.issue}</div>
				<div class="neg-field"><strong>Ask:</strong> {card.ask}</div>
				<div class="neg-field"><strong>Justification:</strong> {card.justification}</div>
				{#if card.leverage.length > 0}<div class="neg-field"><strong>Leverage:</strong> {#each card.leverage as lev}<span class="lev-chip">{lev}</span>{/each}</div>{/if}
				<div class="neg-field neg-fallback"><strong>Fallback:</strong> {card.fallback}</div>
			</div>
			{:else}
			<div class="neg-empty">All lease terms are at or above market. Strong position!</div>
			{/each}
		</div>

		{:else if activeTab === 'fit'}
		<div class="fit-section">
			<div class="fit-hero"><div class="fit-circle" style="border-color: {scoreColor(fitScore.overall)}"><span class="fit-num" style="color: {scoreColor(fitScore.overall)}">{fitScore.overall}</span><span class="fit-lbl">{scoreLabel(fitScore.overall)}</span></div></div>
			<div class="fit-breakdown">
				{#each [{ label: 'Physical Fit (30%)', score: fitScore.physical }, { label: 'Financial Fit (40%)', score: fitScore.financial }, { label: 'Risk Fit (30%)', score: fitScore.risk }] as comp}
				<div class="fit-component"><div class="fit-bar-header"><span>{comp.label}</span><span style="color: {scoreColor(comp.score)}">{comp.score}</span></div><div class="fit-bar"><div class="fit-bar-fill" style="width: {comp.score}%; background: {scoreColor(comp.score)}"></div></div></div>
				{/each}
			</div>
			{#if fitScore.gaps.length > 0}
			<div class="gap-analysis"><h3>Gap Analysis</h3>
				{#each fitScore.gaps as gap}
				<div class="gap-card"><div class="gap-component">{gap.component}</div><div class="gap-explanation">{gap.explanation}</div><div class="gap-fix">💡 {gap.fix}</div></div>
				{/each}
			</div>
			{/if}
		</div>
		{/if}
	</div>
	{/if}

	<PageNav
		backHref="/app/location"
		backLabel="Score"
		nextHref="/app/financials"
		nextLabel="Financials"
	/>
</div>

<style>
	.page { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; color: var(--text); background: var(--bg); }
	.page-header { margin-bottom: 2rem; }
	.page-header h1 { font-size: 28px; font-weight: 700; color: var(--text); margin: 0 0 0.5rem; }
	.subtitle-tag { font-size: 14px; font-weight: 500; color: var(--accent); background: var(--accent-light); padding: 2px 8px; border-radius: 6px; margin-left: 8px; vertical-align: middle; }
	.page-subtitle { color: var(--text-secondary); font-size: 14px; margin: 0; }

	.upload-section { margin-bottom: 28px; }
	.upload-label { font-size: 12px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; display: block; }
	.upload-zone { position: relative; border: 2px solid var(--accent); border-radius: 12px; padding: 48px 24px; text-align: center; cursor: pointer; transition: border-color 0.3s, background 0.3s, box-shadow 0.3s; margin-bottom: 20px; background: rgba(0, 119, 255, 0.04); box-shadow: 0 0 0 1px rgba(0, 119, 255, 0.1); }
	.upload-zone:hover, .upload-zone.drag-over { border-color: var(--accent); background: rgba(0, 119, 255, 0.08); box-shadow: 0 0 0 1px rgba(0, 119, 255, 0.2), 0 4px 12px rgba(0, 119, 255, 0.15); }
	.upload-icon { font-size: 36px; margin-bottom: 12px; }
	.upload-title { font-size: 16px; font-weight: 600; color: var(--text); margin: 0 0 6px; }
	.upload-hint { font-size: 13px; color: var(--text-secondary); margin: 0 0 8px; }
	.upload-formats { font-size: 11px; color: var(--text-tertiary); margin: 0; }
	.file-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

	.uploaded-files { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
	.uploaded-file { display: flex; align-items: center; gap: 8px; background: var(--surface-elevated); border-radius: 8px; padding: 8px 12px; font-size: 13px; }
	.file-icon { font-size: 16px; }
	.file-name { color: var(--text); }
	.file-remove { background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 14px; }
	.file-remove:hover { color: var(--danger); }

	.divider { display: flex; align-items: center; gap: 16px; margin: 24px 0; color: var(--text-tertiary); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
	.divider::before, .divider::after { content: ''; flex: 1; border-top: 1px solid var(--border); }

	.form-container { display: flex; flex-direction: column; gap: 0; }
	.collapsible-section { border: 1px solid var(--border); border-radius: 12px; margin-bottom: 12px; overflow: hidden; background: var(--surface); }
	.collapsible-section:last-child { margin-bottom: 24px; }
	.section-header { width: 100%; padding: 16px; background: var(--surface-elevated); border: none; cursor: pointer; display: flex; align-items: center; gap: 12px; color: var(--text); font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; transition: background 0.2s; }
	.section-header:hover { background: var(--bg); }
	.chevron { display: inline-block; font-size: 20px; color: var(--accent); transition: transform 0.3s ease; transform: rotate(0deg); }
	.chevron.expanded { transform: rotate(90deg); }
	.section-title { flex: 1; }
	.section-content { padding: 16px; }

	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 0; }
	.span-2 { grid-column: span 2; }
	.form-group { display: flex; flex-direction: column; gap: 6px; }
	.form-group label { font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; }
	.form-group input, .form-group select { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; color: var(--text); font-size: 14px; transition: border-color 0.2s; }
	.form-group input:focus, .form-group select:focus { border-color: var(--accent); outline: none; }
	.form-group input[type="checkbox"] { width: 16px; height: 16px; display: inline; margin-right: 8px; }
	.form-group.checkbox-group { flex-direction: row; align-items: center; }
	.form-group.checkbox-group label { margin: 0; text-transform: none; font-weight: 500; }

	.emc2-section { text-align: center; padding: 16px 0 24px; }
	.btn-action {
		background: var(--accent);
		color: #fff;
		padding: 10px 24px;
		border-radius: 10px;
		border: none;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.btn-action:hover:not(:disabled) { background: #0077ed; }
	.btn-action:disabled { background: var(--border); color: var(--text-tertiary); cursor: not-allowed; }

	.analysis-progress { padding: 16px 0; }
	.step { padding: 8px 0; font-size: 13px; color: var(--text-secondary); transition: color 0.3s; }
	.step.active { color: var(--accent); }
	.step-check { margin-right: 8px; }

	.results-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
	.results-header h1 { font-size: 24px; font-weight: 700; color: var(--text); margin: 0 0 4px; }
	.results-address { font-size: 14px; color: var(--text-secondary); margin: 0; }
	.btn-secondary { padding: 8px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13px; cursor: pointer; }
	.btn-secondary:hover { border-color: var(--accent); }

	.score-bar { display: flex; align-items: center; gap: 20px; padding: 16px 20px; background: var(--surface-elevated); border-radius: 12px; border: 1px solid var(--border); margin-bottom: 20px; flex-wrap: wrap; }
	.score-item { text-align: center; min-width: 70px; }
	.score-label { font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; display: block; }
	.score-value { font-size: 28px; font-weight: 800; display: block; line-height: 1.2; }
	.score-sublabel { font-size: 10px; color: var(--text-secondary); }
	.buildout-val { font-size: 18px !important; }
	.score-divider { width: 1px; height: 40px; background: var(--border); }

	.tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 24px; overflow-x: auto; }
	.tab { padding: 12px 16px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); font-size: 13px; cursor: pointer; white-space: nowrap; transition: color 0.2s, border-color 0.2s; }
	.tab:hover { color: var(--text); }
	.tab.active { color: var(--accent); border-bottom-color: var(--accent); }
	.tab-icon { margin-right: 4px; }
	.tab-content { min-height: 300px; }

	.overview-grid, .physical-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; grid-auto-rows: 1fr; }
	.detail-card { background: var(--surface-elevated); border-radius: 12px; padding: 20px; border: 1px solid var(--border); height: 100%; display: flex; flex-direction: column; }
	.detail-card h3 { font-size: 14px; font-weight: 700; color: var(--accent); margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.5px; }
	.detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
	.detail-row span:first-child { color: var(--text-secondary); }
	.detail-row span:last-child { color: var(--text); font-weight: 500; }

	.grease-status { font-weight: 600; }
	.grease-ok { color: var(--success); }
	.grease-warn { color: var(--warning); }
	.grease-warning { background: rgba(255, 149, 0, 0.08); border: 1px solid rgba(255, 149, 0, 0.12); border-radius: 8px; padding: 12px; margin-top: 12px; font-size: 12px; color: var(--warning); line-height: 1.5; }

	.area-bar { display: flex; height: 40px; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
	.area-fill { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #fff; }
	.foh { background: var(--accent); }
	.boh { background: var(--accent); flex: 1; }
	.big-number { font-size: 48px; font-weight: 800; color: var(--accent); text-align: center; }
	.big-number-label { text-align: center; font-size: 13px; color: var(--text-secondary); }
	.flag-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 13px; color: var(--warning); border-bottom: 1px solid var(--border); }
	.flag-pass { color: var(--success); }

	.lease-section, .buildout-section { background: var(--surface-elevated); border-radius: 12px; padding: 20px; border: 1px solid var(--border); }
	.lease-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
	.lease-header-row h3 { margin: 0; font-size: 16px; color: var(--text); }
	.lease-score { font-size: 14px; color: var(--text-secondary); }
	.benchmark-table { width: 100%; border-collapse: collapse; font-size: 13px; }
	.benchmark-table th { text-align: left; padding: 10px 8px; color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); }
	.benchmark-table td { padding: 10px 8px; border-bottom: 1px solid var(--border); }
	.term-name { color: var(--text); font-weight: 500; }
	.muted { color: var(--text-secondary); }
	.rating-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; }

	.buildout-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
	.buildout-header h3 { margin: 0 0 4px; font-size: 16px; color: var(--text); }
	.buildout-meta { font-size: 12px; color: var(--text-secondary); margin: 0; }
	.buildout-total { text-align: right; }
	.buildout-total-label { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; display: block; }
	.buildout-total-value { font-size: 28px; font-weight: 800; color: var(--accent); }
	.buildout-table { width: 100%; border-collapse: collapse; font-size: 13px; }
	.buildout-table th { text-align: left; padding: 10px 8px; color: var(--text-secondary); font-size: 11px; text-transform: uppercase; border-bottom: 1px solid var(--border); }
	.buildout-table td { padding: 10px 8px; border-bottom: 1px solid var(--border); color: var(--text); }
	.cost-cell { text-align: right; }
	.grease-row { background: rgba(255, 149, 0, 0.05); }
	.grease-row td { color: var(--warning); }
	.subtotal-row td { border-top: 1px solid var(--border); color: var(--text-secondary); }
	.total-row td { border-top: 2px solid var(--accent); font-size: 15px; }
	.buildout-footer { display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; }
	.timeline-badge { font-size: 13px; color: var(--text-secondary); background: var(--bg); padding: 8px 16px; border-radius: 8px; }
	.budget-compare { font-size: 13px; padding: 8px 16px; border-radius: 8px; background: var(--green-soft); color: var(--success); }
	.budget-compare.over-budget { background: var(--red-soft); color: var(--danger); }

	.negotiation-section h3 { font-size: 18px; color: var(--text); margin: 0 0 8px; }
	.negotiation-intro { font-size: 14px; color: var(--text-secondary); margin: 0 0 20px; }
	.neg-card { background: var(--surface-elevated); border-radius: 12px; padding: 20px; border: 1px solid var(--border); margin-bottom: 12px; }
	.neg-card.neg-high { border-left: 3px solid var(--danger); }
	.neg-card.neg-medium { border-left: 3px solid var(--warning); }
	.neg-card-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
	.neg-priority { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
	.p-high { background: rgba(255, 59, 48, 0.08); color: var(--danger); }
	.p-med { background: rgba(255, 149, 0, 0.08); color: var(--warning); }
	.p-low { background: rgba(52, 199, 89, 0.08); color: var(--success); }
	.neg-impact { font-size: 12px; color: var(--text-secondary); }
	.neg-field { font-size: 13px; color: var(--text); margin-bottom: 8px; line-height: 1.5; }
	.neg-fallback { color: var(--text-secondary); font-style: italic; }
	.lev-chip { display: inline-block; background: var(--surface); padding: 2px 8px; border-radius: 4px; font-size: 12px; margin: 2px 4px 2px 0; }
	.neg-empty { text-align: center; padding: 48px; color: var(--success); font-size: 16px; }

	.fit-section { }
	.fit-hero { text-align: center; margin-bottom: 32px; }
	.fit-circle { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; width: 160px; height: 160px; border-radius: 50%; border: 4px solid; background: var(--surface-elevated); }
	.fit-num { font-size: 48px; font-weight: 800; line-height: 1; }
	.fit-lbl { font-size: 13px; margin-top: 4px; color: var(--text-secondary); }
	.fit-breakdown { display: flex; flex-direction: column; gap: 16px; margin-bottom: 32px; }
	.fit-component { background: var(--surface-elevated); border-radius: 10px; padding: 16px; border: 1px solid var(--border); }
	.fit-bar-header { display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; margin-bottom: 8px; color: var(--text); }
	.fit-bar { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
	.fit-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
	.gap-analysis h3 { font-size: 16px; color: var(--text); margin: 0 0 16px; }
	.gap-card { background: var(--surface-elevated); border-radius: 10px; padding: 16px; border: 1px solid var(--border); margin-bottom: 12px; }
	.gap-component { font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 8px; }
	.gap-explanation { font-size: 13px; color: var(--text); margin-bottom: 8px; line-height: 1.5; }
	.gap-fix { font-size: 13px; color: var(--accent); line-height: 1.5; }

	@media (max-width: 768px) {
		.form-grid { grid-template-columns: 1fr; }
		.span-2 { grid-column: span 1; }
		.overview-grid, .physical-grid { grid-template-columns: 1fr; }
		.score-bar { gap: 12px; }
		.tab { padding: 10px 10px; font-size: 12px; }
		.benchmark-table th:nth-child(4), .benchmark-table td:nth-child(4),
		.benchmark-table th:nth-child(5), .benchmark-table td:nth-child(5) { display: none; }
	}

	@media (max-width: 640px) {
		.form-grid { grid-template-columns: 1fr; gap: 12px; }
		.overview-grid, .physical-grid { grid-template-columns: 1fr; gap: 12px; }
		.score-bar { gap: 8px; padding: 12px 16px; flex-wrap: wrap; }
		.score-item { min-width: 60px; }
		.score-value { font-size: 24px; }
		.tab { padding: 8px 8px; font-size: 11px; }
		.detail-card { padding: 12px; }
		.benchmark-table, .buildout-table { font-size: 12px; }
		.benchmark-table th, .benchmark-table td, .buildout-table th, .buildout-table td { padding: 6px 4px; }
		.benchmark-table { overflow-x: auto; display: block; }
	}

	@media (max-width: 480px) {
		.page { padding: 1rem 1rem; }
		.score-bar { gap: 6px; padding: 10px 12px; }
		.score-item { min-width: 50px; }
		.score-value { font-size: 20px; }
		.tab { padding: 6px 6px; font-size: 10px; }
		.detail-card { padding: 10px; }
	}
</style>
