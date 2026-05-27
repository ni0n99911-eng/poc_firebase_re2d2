<script lang="ts">
	import SiteNav from '$lib/components/SiteNav.svelte';
	import { page } from '$app/stores';
	import { SITE_CONFIG } from '$lib/modules';

	let billingPeriod = $state<'monthly' | 'annual'>('monthly');

	interface PricingTier {
		name: string;
		price: number | string;
		period: string;
		description: string;
		features: string[];
		cta: string;
		highlighted: boolean;
		badge?: string;
	}

	const tiers = $derived([
		{
			name: 'Scout',
			price: 'Free',
			period: 'during beta',
			description: 'Get your Score. Know before you sign.',
			modules: [
				{ icon: '📍', label: 'Location', included: true },
				{ icon: '🏢', label: 'Space', included: false },
				{ icon: '📊', label: 'Business', included: false },
				{ icon: '🏦', label: 'Loan', included: false },
				{ icon: '🚀', label: 'Launch', included: false },
				{ icon: '📋', label: 'Operations', included: false }
			],
			features: [
				'Block-level Score across 17 live data layers',
				'Neighborhood competitive analysis with chain vs indie breakdown',
				'AI-powered location recommendations tuned to your concept',
				'Foot traffic, transit ridership & pedestrian count insights',
				'Safety and quality-of-life scoring for your block',
				'Compare up to 3 addresses side-by-side'
			],
			cta: 'Get started — free',
			highlighted: false,
			badge: 'Free during beta'
		},
		{
			name: 'Builder',
			price: billingPeriod === 'monthly' ? 79 : 66,
			period: billingPeriod === 'monthly' ? '/month' : '/month billed yearly',
			description: 'Find and evaluate your ideal space.',
			modules: [
				{ icon: '📍', label: 'Location', included: true },
				{ icon: '🏢', label: 'Space', included: true },
				{ icon: '📊', label: 'Business', included: true },
				{ icon: '🏦', label: 'Loan', included: false },
				{ icon: '🚀', label: 'Launch', included: false },
				{ icon: '📋', label: 'Operations', included: false }
			],
			features: [
				'Everything in Scout, plus:',
				'Space IQ scoring for commercial listings (layout, condition, buildout cost)',
				'Lease vs. buy scenario modeling with break-even timelines',
				'Revenue projections calibrated to your concept and location data',
				'Business structure optimization (LLC, S-Corp, sole prop)',
				'Financial sensitivity analysis across best, expected, and conservative cases',
				'Exportable reports (PDF) ready for advisors and partners'
			],
			cta: 'Start free trial',
			highlighted: false
		},
		{
			name: 'Pro',
			price: billingPeriod === 'monthly' ? 149 : 124,
			period: billingPeriod === 'monthly' ? '/month' : '/month billed yearly',
			description: 'Full financial intelligence stack.',
			modules: [
				{ icon: '📍', label: 'Location', included: true },
				{ icon: '🏢', label: 'Space', included: true },
				{ icon: '📊', label: 'Business', included: true },
				{ icon: '🏦', label: 'Loan', included: true },
				{ icon: '🚀', label: 'Launch', included: false },
				{ icon: '📋', label: 'Operations', included: false }
			],
			features: [
				'Everything in Builder, plus:',
				'Loan readiness scoring with SBA 7(a) and 504 routing',
				'Matched lenders, grants & capital sources based on your profile',
				'Capital structure recommendations (debt/equity mix, personal guarantee)',
				'Investor-ready pitch materials with location data baked in',
				'Lender comparison with terms, rates, and approval likelihood',
				'Lender-ready PDF package with all supporting data'
			],
			cta: 'Start Pro trial',
			highlighted: true,
			badge: 'MOST POPULAR'
		},
		{
			name: 'Enterprise',
			price: billingPeriod === 'monthly' ? 249 : 208,
			period: billingPeriod === 'monthly' ? '/month' : '/month billed yearly',
			description: 'Launch-ready. From idea to open doors.',
			modules: [
				{ icon: '📍', label: 'Location', included: true },
				{ icon: '🏢', label: 'Space', included: true },
				{ icon: '📊', label: 'Business', included: true },
				{ icon: '🏦', label: 'Loan', included: true },
				{ icon: '🚀', label: 'Launch', included: true },
				{ icon: '📋', label: 'Operations', included: true }
			],
			features: [
				'Everything in Pro, plus:',
				'Launch planning with go-to-market timeline and milestones',
				'Operations: auto-generated SOPs, employee handbooks & compliance checklists',
				'Project board (Kanban) with task management and deadline tracking',
				'Team seats + real-time collaboration on shared analyses',
				'API access & custom integrations for portfolio operators',
				'Dedicated account manager with priority support'
			],
			cta: 'Contact sales',
			highlighted: false
		}
	]);

	interface FAQItem {
		question: string;
		answer: string;
	}

	const faqItems: FAQItem[] = [
		{
			question: 'What are IQ modules?',
			answer: 'Each IQ module is a standalone intelligence engine. Location scores addresses, Space evaluates physical units, Business models your financials, Loan finds your funding, Launch manages your go-to-market, and Operations generates your SOPs and handbooks. Pick the tier that matches your stage.'
		},
		{
			question: 'What happens after beta?',
			answer: 'Scout tier users keep free access to Your Score. Higher modules and features will require a Builder, Pro, or Enterprise subscription.'
		},
		{
			question: 'Can I cancel anytime?',
			answer: 'Yes. No contracts, no cancellation fees. Cancel from your account settings at any time.'
		},
		{
			question: 'Do you offer refunds?',
			answer: 'Yes. If you are not satisfied within the first 30 days, we will issue a full refund — no questions asked.'
		},
		{
			question: 'What cities do you cover?',
			answer: 'We currently cover all five NYC boroughs, with the strongest data coverage in Manhattan. We are expanding to LA, Chicago, Miami, and Dallas in 2026.'
		}
	];

	let expandedFAQ = $state<number | null>(null);

	function toggleFAQ(index: number) {
		expandedFAQ = expandedFAQ === index ? null : index;
	}
</script>

<svelte:head>
	<title>RE² — Pricing</title>
</svelte:head>

<SiteNav />

<div class="pricing-page">
	<!-- Hero Section -->
	<section class="hero">
		<div class="hero-content">
			<h1 class="hero-title">Simple, transparent pricing</h1>
			<p class="hero-subtitle">Start free. Upgrade when you are ready to sign your lease.</p>

			<!-- Billing Toggle -->
			<div class="billing-toggle">
				<button
					class="toggle-button"
					class:active={billingPeriod === 'monthly'}
					onclick={() => (billingPeriod = 'monthly')}
				>
					Monthly
				</button>
				<button
					class="toggle-button"
					class:active={billingPeriod === 'annual'}
					onclick={() => (billingPeriod = 'annual')}
				>
					Annual
					<span class="savings-badge">Save 2 months</span>
				</button>
			</div>
		</div>
	</section>

	<!-- Pricing Tiers -->
	<section class="tiers-section">
		<div class="tiers-grid">
			{#each tiers as tier, index (tier.name)}
				<div class="tier-card" class:highlighted={tier.highlighted}>
					{#if tier.badge}
						<div class="tier-badge">{tier.badge}</div>
					{/if}

					<div class="tier-header">
						<h2 class="tier-name">{tier.name}</h2>
						<p class="tier-description">{tier.description}</p>
					</div>

					<div class="tier-price">
						{#if typeof tier.price === 'number'}
							<span class="price-amount">${tier.price.toLocaleString()}</span>
						{:else}
							<span class="price-amount">{tier.price}</span>
						{/if}
						<span class="price-period">{tier.period}</span>
					</div>

					<!-- Einstein Module Grid -->
					<div class="module-grid">
						{#each tier.modules as mod (mod.label)}
							<div class="module-chip" class:included={mod.included} class:excluded={!mod.included}>
								<span class="module-chip-icon">{mod.icon}</span>
								<span class="module-chip-label">{mod.label}</span>
								{#if mod.included}
									<svg class="module-check" viewBox="0 0 24 24" fill="none">
										<path d="M9 16.17L4.83 12M9 16.17L19.29 5.88" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								{:else}
									<svg class="module-lock" viewBox="0 0 24 24" fill="none">
										<rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
										<path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
									</svg>
								{/if}
							</div>
						{/each}
					</div>

					{#if tier.cta === 'Contact sales'}
						<a href="mailto:{SITE_CONFIG.emails.hello}" class="cta-button" class:cta-primary={tier.highlighted}>
							{tier.cta}
						</a>
					{:else}
						<a href="/login" class="cta-button" class:cta-primary={tier.highlighted} data-sveltekit-reload>
							{tier.cta}
						</a>
					{/if}

					<div class="features-list">
						{#each tier.features as feature, featureIndex (feature)}
							<div class="feature-item" style="animation-delay: {featureIndex * 30}ms">
								<svg class="feature-icon" viewBox="0 0 24 24" fill="none">
									<path
										d="M9 16.17L4.83 12M9 16.17L19.29 5.88"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
								<span>{feature}</span>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- FAQ Section -->
	<section class="faq-section">
		<div class="faq-container">
			<h2 class="faq-title">Frequently Asked Questions</h2>

			<div class="faq-list">
				{#each faqItems as item, index (index)}
					<div class="faq-item" class:expanded={expandedFAQ === index}>
						<button
							class="faq-question"
							onclick={() => toggleFAQ(index)}
							aria-expanded={expandedFAQ === index}
						>
							<span>{item.question}</span>
							<svg class="faq-toggle-icon" viewBox="0 0 24 24" fill="none">
								<path
									d="M6 9L12 15L18 9"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</button>
						{#if expandedFAQ === index}
							<div class="faq-answer">
								<p>{item.answer}</p>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Bottom CTA -->
	<section class="bottom-cta">
		<div class="cta-content">
			<p class="cta-text">Questions about pricing?</p>
			<a href="mailto:{SITE_CONFIG.emails.hello}" class="cta-link">{SITE_CONFIG.emails.hello}</a>
		</div>
	</section>
</div>

<style>
	.pricing-page {
		width: 100%;
		background: var(--bg);
		color: var(--text);
		padding-top: 80px;
		margin: 0;
	}

	/* ===== HERO SECTION ===== */
	.hero {
		padding: 80px 24px;
		text-align: center;
		background: linear-gradient(
			135deg,
			rgba(0, 217, 255, 0.03) 0%,
			rgba(0, 217, 255, 0.01) 100%
		);
		border-bottom: 1px solid var(--border);
	}

	.hero-content {
		max-width: 800px;
		margin: 0 auto;
	}

	.hero-title {
		font-size: 48px;
		font-weight: 700;
		letter-spacing: -0.5px;
		margin-bottom: 16px;
		color: var(--text-bright);
		line-height: 1.2;
	}

	.hero-subtitle {
		font-size: 18px;
		color: var(--text-dim);
		margin-bottom: 48px;
		line-height: 1.5;
	}

	.billing-toggle {
		display: flex;
		gap: 12px;
		justify-content: center;
		align-items: center;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 6px;
		width: fit-content;
		margin: 0 auto;
	}

	.toggle-button {
		padding: 10px 24px;
		border: none;
		background: transparent;
		color: var(--text-dim);
		font-size: 14px;
		font-weight: 500;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.25s ease;
		display: flex;
		align-items: center;
		gap: 8px;
		white-space: nowrap;
		position: relative;
	}

	.toggle-button.active {
		background: var(--surface3);
		color: var(--text-bright);
		border: 1px solid var(--border-hover);
	}

	.toggle-button:hover:not(.active) {
		color: var(--text);
	}

	.savings-badge {
		font-size: 11px;
		background: rgba(0, 217, 255, 0.1);
		color: var(--accent);
		padding: 3px 8px;
		border-radius: 4px;
		font-weight: 600;
		letter-spacing: 0.3px;
	}

	/* ===== PRICING TIERS ===== */
	.tiers-section {
		padding: 80px 24px;
		max-width: 1400px;
		margin: 0 auto;
	}

	.tiers-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 24px;
		margin: 0 auto;
	}

	.tier-card {
		display: flex;
		flex-direction: column;
		padding: 40px 32px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		transition: all 0.25s ease;
		position: relative;
		overflow: hidden;
	}

	.tier-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--accent), transparent);
		opacity: 0;
		transition: opacity 0.25s ease;
	}

	.tier-card:hover {
		border-color: var(--border-hover);
		transform: translateY(-4px);
		box-shadow: 0 12px 48px rgba(0, 217, 255, 0.08);
	}

	.tier-card:hover::before {
		opacity: 1;
	}

	.tier-card.highlighted {
		border: 2px solid rgba(0, 217, 255, 0.4);
		background: linear-gradient(135deg, rgba(0, 217, 255, 0.03) 0%, transparent 100%);
		transform: scale(1.02);
		box-shadow: 0 20px 64px rgba(0, 217, 255, 0.12);
	}

	.tier-card.highlighted:hover {
		box-shadow: 0 24px 72px rgba(0, 217, 255, 0.16);
		transform: scale(1.02) translateY(-4px);
	}

	.tier-badge {
		position: absolute;
		top: 20px;
		right: 20px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 1px;
		padding: 6px 12px;
		border-radius: 4px;
		text-transform: uppercase;
	}

	.tier-card:not(.highlighted) .tier-badge {
		background: rgba(0, 217, 255, 0.1);
		color: var(--accent);
	}

	.tier-card.highlighted .tier-badge {
		background: rgba(0, 217, 255, 0.2);
		color: var(--accent);
		box-shadow: 0 0 20px rgba(0, 217, 255, 0.2);
	}

	.tier-header {
		margin-bottom: 32px;
	}

	.tier-name {
		font-size: 24px;
		font-weight: 700;
		color: var(--text-bright);
		margin-bottom: 8px;
	}

	.tier-description {
		font-size: 14px;
		color: var(--text-dim);
		line-height: 1.4;
	}

	.tier-price {
		margin-bottom: 32px;
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.price-amount {
		font-size: 44px;
		font-weight: 700;
		color: var(--text-bright);
		letter-spacing: -0.5px;
	}

	.price-period {
		font-size: 14px;
		color: var(--text-dim);
		font-weight: 500;
	}

	.cta-button {
		display: inline-block;
		padding: 12px 24px;
		border: 1px solid var(--border-hover);
		background: transparent;
		color: var(--text);
		border-radius: 8px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		margin-bottom: 32px;
		transition: all 0.25s ease;
		text-decoration: none;
	}

	.cta-button:hover {
		border-color: var(--accent);
		color: var(--accent);
		box-shadow: 0 0 20px rgba(0, 217, 255, 0.15);
	}

	.cta-button.cta-primary {
		background: var(--accent);
		color: var(--bg);
		border-color: var(--accent);
		font-weight: 700;
	}

	.cta-button.cta-primary:hover {
		background: rgba(0, 217, 255, 0.9);
		border-color: rgba(0, 217, 255, 0.9);
		box-shadow: 0 8px 24px rgba(0, 217, 255, 0.3);
		color: var(--bg);
	}

	.features-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.feature-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		font-size: 14px;
		color: var(--text);
		line-height: 1.5;
		animation: slideIn 0.4s ease-out forwards;
		opacity: 0;
	}

	.feature-icon {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: var(--accent);
		margin-top: 2px;
	}

	/* ===== MODULE GRID ===== */
	.module-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 6px;
		margin-bottom: 28px;
		padding-bottom: 28px;
		border-bottom: 1px solid var(--border);
	}

	.module-chip {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 8px;
		border-radius: 6px;
		font-size: 11px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.module-chip.included {
		background: rgba(0, 217, 255, 0.06);
		border: 1px solid rgba(0, 217, 255, 0.15);
		color: var(--text-bright);
	}

	.module-chip.excluded {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--text-dim);
		opacity: 0.5;
	}

	.module-chip-icon {
		font-size: 14px;
		flex-shrink: 0;
	}

	.module-chip-label {
		flex: 1;
		white-space: normal;
		word-break: break-word;
	}

	.module-check {
		width: 14px;
		height: 14px;
		color: var(--accent);
		flex-shrink: 0;
	}

	.module-lock {
		width: 14px;
		height: 14px;
		color: var(--text-dim);
		flex-shrink: 0;
		opacity: 0.5;
	}

	/* ===== FAQ SECTION ===== */
	.faq-section {
		padding: 80px 24px;
		background: var(--surface);
		border-top: 1px solid var(--border);
	}

	.faq-container {
		max-width: 800px;
		margin: 0 auto;
	}

	.faq-title {
		font-size: 32px;
		font-weight: 700;
		color: var(--text-bright);
		margin-bottom: 48px;
		text-align: center;
	}

	.faq-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.faq-item {
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		transition: all 0.25s ease;
	}

	.faq-item:hover {
		border-color: var(--border-hover);
		background: var(--surface2);
	}

	.faq-item.expanded {
		border-color: var(--accent-mid);
		background: linear-gradient(135deg, rgba(0, 217, 255, 0.02) 0%, transparent 100%);
	}

	.faq-question {
		width: 100%;
		padding: 20px 24px;
		background: transparent;
		border: none;
		color: var(--text);
		font-size: 15px;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		transition: all 0.25s ease;
	}

	.faq-question:hover {
		color: var(--accent);
	}

	.faq-item.expanded .faq-question {
		color: var(--accent);
	}

	.faq-toggle-icon {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		transition: transform 0.25s ease;
		transform-origin: center;
	}

	.faq-item.expanded .faq-toggle-icon {
		transform: rotate(180deg);
	}

	.faq-answer {
		padding: 0 24px 20px 24px;
		color: var(--text-dim);
		font-size: 14px;
		line-height: 1.6;
		animation: slideDown 0.25s ease-out;
	}

	/* ===== BOTTOM CTA ===== */
	.bottom-cta {
		padding: 60px 24px;
		text-align: center;
		background: linear-gradient(
			135deg,
			rgba(0, 217, 255, 0.03) 0%,
			rgba(0, 217, 255, 0.01) 100%
		);
		border-top: 1px solid var(--border);
	}

	.cta-content {
		max-width: 600px;
		margin: 0 auto;
	}

	.cta-text {
		font-size: 18px;
		color: var(--text);
		margin-bottom: 16px;
	}

	.cta-link {
		display: inline-block;
		font-size: 18px;
		font-weight: 600;
		color: var(--accent);
		text-decoration: none;
		transition: all 0.25s ease;
		padding: 4px 8px;
		border-radius: 4px;
	}

	.cta-link:hover {
		color: var(--text-bright);
		text-decoration: underline;
		box-shadow: 0 0 20px rgba(0, 217, 255, 0.2);
	}

	/* ===== ANIMATIONS ===== */
	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateX(-8px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-8px);
			max-height: 0;
		}
		to {
			opacity: 1;
			transform: translateY(0);
			max-height: 500px;
		}
	}

	/* ===== RESPONSIVE DESIGN ===== */
	@media (max-width: 1200px) {
		.tiers-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 24px;
		}
	}

	@media (max-width: 768px) {
		.hero {
			padding: 60px 20px;
		}

		.hero-title {
			font-size: 36px;
		}

		.hero-subtitle {
			font-size: 16px;
			margin-bottom: 32px;
		}

		.billing-toggle {
			flex-direction: column;
			width: 100%;
		}

		.toggle-button {
			padding: 10px 16px;
			font-size: 13px;
			width: 100%;
			justify-content: center;
		}

		.savings-badge {
			font-size: 10px;
			padding: 2px 6px;
		}

		.tiers-section {
			padding: 60px 20px;
		}

		.tiers-grid {
			grid-template-columns: 1fr;
			gap: 24px;
		}

		.module-grid {
			grid-template-columns: 1fr 1fr;
		}

		.tier-card {
			padding: 32px 24px;
		}

		.tier-card.highlighted {
			transform: none;
		}

		.tier-card.highlighted:hover {
			transform: translateY(-4px);
		}

		.tier-name {
			font-size: 20px;
		}

		.price-amount {
			font-size: 36px;
		}

		.faq-section {
			padding: 60px 20px;
		}

		.faq-title {
			font-size: 28px;
		}

		.faq-question {
			padding: 16px 20px;
			font-size: 14px;
		}

		.faq-answer {
			padding: 0 20px 16px 20px;
		}

		.bottom-cta {
			padding: 48px 20px;
		}

		.cta-text {
			font-size: 16px;
		}

		.cta-link {
			font-size: 16px;
		}
	}

	@media (max-width: 480px) {
		.hero {
			padding: 48px 16px;
		}

		.hero-title {
			font-size: 28px;
			margin-bottom: 12px;
		}

		.hero-subtitle {
			font-size: 14px;
			margin-bottom: 24px;
		}

		.toggle-button {
			padding: 8px 12px;
			font-size: 12px;
		}

		.tier-card {
			padding: 24px 20px;
		}

		.tier-header {
			margin-bottom: 24px;
		}

		.tier-name {
			font-size: 18px;
		}

		.tier-description {
			font-size: 13px;
		}

		.price-amount {
			font-size: 32px;
		}

		.price-period {
			font-size: 12px;
		}

		.cta-button {
			font-size: 13px;
			padding: 10px 20px;
			margin-bottom: 24px;
		}

		.feature-item {
			font-size: 13px;
			gap: 10px;
		}

		.feature-icon {
			width: 18px;
			height: 18px;
		}

		.faq-title {
			font-size: 24px;
			margin-bottom: 32px;
		}

		.faq-question {
			padding: 14px 16px;
			font-size: 13px;
		}

		.faq-answer {
			padding: 0 16px 12px 16px;
			font-size: 13px;
		}

		.bottom-cta {
			padding: 40px 16px;
		}

		.cta-text {
			font-size: 14px;
		}

		.cta-link {
			font-size: 14px;
		}
	}
</style>
