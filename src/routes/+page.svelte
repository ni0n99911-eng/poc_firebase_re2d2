<script lang="ts">
	import { onMount } from 'svelte';
	import { track, trackPageView, EVENTS } from '$lib/analytics';
	let showMobileMenu = $state(false);
	let mounted = $state(false);
	let { data } = $props();

	onMount(() => {
		mounted = true;
		trackPageView('/');
		track(EVENTS.LANDING_VIEW);
	});

	function scrollToSection(e: Event, id: string) {
		e.preventDefault();
		const element = document.getElementById(id);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
		showMobileMenu = false;
	}

	function toggleFaq(index: number) {
		faqOpen = faqOpen === index ? -1 : index;
	}
	let faqOpen = $state(0);

	const faqs = [
		{ q: "I'm just starting to think about this - is RE2 too early for me?", a: "Not at all - in fact, the earlier the better. Most founders wait until they've found a space to start running numbers, and by then they're emotionally committed. RE2 lets you score hypothetical locations and stress-test your concept before you start signing things." },
		{ q: "I don't have a real estate background - will I understand the report?", a: "That's exactly who we built this for. The report uses plain language, clear comparisons, and visual breakdowns. The underlying data is rigorous enough that your accountant, lender, or advisor can dig into the methodology if they want." },
		{ q: "What exactly is the RE2 score?", a: "The RE2 score is a composite rating (0-100) that evaluates a commercial address across 19 data sources including foot traffic, demographic fit, lease risk, competitive density, and transit access. Think of it like a credit score, but for retail locations." },
		{ q: "Is this actually free?", a: "Yes. RE2 is free while in private beta. We're building the platform alongside real founders, and your feedback directly shapes the product. No credit card required, no hidden upgrade wall." },
		{ q: "Can I use the capital package with my lender?", a: "Absolutely. The capital package is designed to be lender-ready - it includes financial projections, location data, competitive analysis, and risk assessment in a professionally formatted PDF." },
		{ q: "Is this only for NYC right now?", a: "Yes. We're starting with New York City because the density of available public data lets us build the most reliable scores. We plan to expand to other major metro areas." }
	];
</script>

<svelte:head>
	<title>RE² — The FICO Score for Your Storefront</title>
	<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet">
</svelte:head>

<div class="landing-page">
	<!-- NAV -->
	<nav class="navbar">
		<div class="nav-logo-wrap">
			<a href="/" class="nav-logo" onclick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); showMobileMenu = false; }}>
				RE<sup>2</sup>
			</a>
		</div>
		<div class="nav-links" class:mobile-open={showMobileMenu}>
			<button class="nav-link" onclick={(e) => scrollToSection(e, 'scores')}>The Score</button>
			<button class="nav-link" onclick={(e) => scrollToSection(e, 'journey')}>Your Stage</button>
			<button class="nav-link" onclick={(e) => scrollToSection(e, 'how')}>How it works</button>
			{#if data.user}
				<a href="/app/route" class="nav-cta" data-sveltekit-reload>Get Started</a>
			{:else}
				<a href="/login" class="nav-cta" data-sveltekit-reload onclick={() => track(EVENTS.LANDING_CTA_CLICK, { cta: 'nav' })}>Start Free</a>
			{/if}
		</div>
		<button
			class="mobile-menu-btn"
			onclick={() => (showMobileMenu = !showMobileMenu)}
			aria-label="Toggle menu"
		>
			<span></span><span></span><span></span>
		</button>
	</nav>

	<!-- 1. HERO -->
	<section class="hero">
		<div class="hero-content" class:visible={mounted}>
			<div class="hero-kicker">For the ones building something of their own</div>
			<h1>The FICO Score for<br>Your <em>Storefront.</em></h1>
			<p class="hero-sub">
				You already know how to run a business. You've been running someone else's for years.
				RE² tells you if the location makes sense - in five minutes, not five broker meetings.
			</p>
			<div class="hero-cta-row">
				<a href="/login" class="btn-primary" data-sveltekit-reload onclick={() => track(EVENTS.LANDING_CTA_CLICK, { cta: 'hero' })}>
					Start free
				</a>
				<button class="btn-ghost" onclick={(e) => scrollToSection(e, 'how')}>
					See how it works →
				</button>
			</div>
			<div class="hero-meta">
				<span>No credit card</span>
				<span class="meta-dot">·</span>
				<span>5 minutes</span>
				<span class="meta-dot">·</span>
				<span>Free — Manhattan live</span>
			</div>
		</div>
	</section>

	<!-- ASYMMETRY STRIP -->
	<div class="asymmetry-strip">
		Your landlord runs comps before every lease negotiation. Your broker has this data before they pick up the phone. <em>Now you do too.</em>
	</div>

	<!-- SOCIAL PROOF BAR -->
	<section class="proof-bar">
		<div class="proof-stats">
			<div class="proof-stat">
				<div class="proof-num">82%</div>
				<div class="proof-label">of scored blocks beat NYC's average survival rate</div>
			</div>
			<div class="proof-stat">
				<div class="proof-num">5 min</div>
				<div class="proof-label">vs. $5,000 + 3 weeks for a broker study</div>
			</div>
			<div class="proof-stat">
				<div class="proof-num">89K+</div>
				<div class="proof-label">NYC locations in our database</div>
			</div>
			<div class="proof-stat">
				<div class="proof-num">Manhattan</div>
				<div class="proof-label">live now. Brooklyn next.</div>
			</div>
		</div>
	</section>

	<!-- 2. PERSONA LANES (moved up - self-selection before product demo) -->
	<section class="persona-section" id="journey">
		<div class="s-kicker">Your Stage</div>
		<h2 class="s-heading">Where are you <em>right now?</em></h2>
		<p class="s-sub">You don't need to be ready. You just need to know which step you're on.</p>
		<div class="persona-cards">
			<a href="/login" class="persona-card" data-sveltekit-reload onclick={() => track(EVENTS.LANDING_CTA_CLICK, { cta: 'persona-dreaming' })}>
				<div class="persona-pill dreaming">Still Working For Someone Else</div>
				<div class="persona-quote">"What if I stopped building their dream and started building mine?"</div>
				<p class="persona-body">You're good at your job. Maybe too good - and you know it. The idea keeps coming back. A café, a studio, a shop. You want to know if it's actually possible before you tell anyone.</p>
				<span class="persona-cta">See if the numbers work →</span>
			</a>
			<a href="/login" class="persona-card" data-sveltekit-reload onclick={() => track(EVENTS.LANDING_CTA_CLICK, { cta: 'persona-searching' })}>
				<div class="persona-pill searching">Searching</div>
				<div class="persona-quote">"I'm ready. I need the right spot."</div>
				<p class="persona-body">You've committed. You're walking neighborhoods, pulling listings. Every location feels like a gamble. You need an objective score, not another opinion.</p>
				<span class="persona-cta">Score and compare locations →</span>
			</a>
			<a href="/login" class="persona-card" data-sveltekit-reload onclick={() => track(EVENTS.LANDING_CTA_CLICK, { cta: 'persona-evaluating' })}>
				<div class="persona-pill evaluating">Evaluating</div>
				<div class="persona-quote">"I found a spot - is it the one?"</div>
				<p class="persona-body">There's a lease on the table. You need numbers that hold up in front of a lender. Foot traffic, competition, break-even - verified, exportable, defensible.</p>
				<span class="persona-cta">Get your location report →</span>
			</a>
		</div>
	</section>

	<!-- 3. ONE SCORE — OSR-01 (Sprint 1 April 12): killed 3-dial display -->
	<section class="scores-section" id="scores">
		<div class="scores-inner">
			<div class="s-live-badge">Live Example</div>
			<div class="s-kicker">One score. One answer.</div>
			<h2 class="s-heading">Your location, <em>scored.</em></h2>
			<p class="s-sub">Real report — 273 5th Avenue, Manhattan, Full-Service Restaurant. This is what you get.</p>

			<!-- Single score card -->
			<div class="single-score-row">
				<div class="dial-card dial-center-card">
					<div class="dial-badge badge-fit-center">Your RE² Score</div>
					<div class="dial-question" style="color:var(--lp-text);font-size:15px;">Your concept × this block. One number. One answer.</div>
					<div class="dial-ring-wrap">
						<!-- r=72, C=452.4, arc=72%=326 -->
						<svg width="180" height="180" viewBox="0 0 180 180">
							<circle cx="90" cy="90" r="72" fill="none" stroke="#f5edd8" stroke-width="10"/>
							<circle cx="90" cy="90" r="72" fill="none" stroke="#e8a838" stroke-width="10"
								stroke-dasharray="326 452" stroke-linecap="round" transform="rotate(-90 90 90)"/>
						</svg>
						<div class="dial-number">
							<span class="dn-score" style="color:#e8a838;font-size:56px;">72</span>
							<span class="dn-out" style="font-size:15px;">/100</span>
						</div>
					</div>
					<div class="verdict-pill">Viable — Go with refinements</div>
					<div class="dial-dims">
						<div class="dim-bar"><span class="dim-label">Transit</span><div class="dim-track"><div class="dim-fill" style="width:96%;background:#1a3a2a"></div></div><span class="dim-val">96</span></div>
						<div class="dim-bar"><span class="dim-label">Safety</span><div class="dim-track"><div class="dim-fill" style="width:92%;background:#1a3a2a"></div></div><span class="dim-val">92</span></div>
						<div class="dim-bar"><span class="dim-label">Neighborhood</span><div class="dim-track"><div class="dim-fill" style="width:88%;background:#1a3a2a"></div></div><span class="dim-val">88</span></div>
						<div class="dim-bar"><span class="dim-label">Competition</span><div class="dim-track"><div class="dim-fill" style="width:85%;background:#4a7c5c"></div></div><span class="dim-val">85</span></div>
						<div class="dim-bar"><span class="dim-label">Concept Pulse</span><div class="dim-track"><div class="dim-fill" style="width:32%;background:#e8a838"></div></div><span class="dim-val warn">32</span></div>
						<div class="dim-bar"><span class="dim-label">Survival Rate</span><div class="dim-track"><div class="dim-fill" style="width:82%;background:#1a3a2a"></div></div><span class="dim-val good">82%</span></div>
					</div>
				</div>
			</div>
			<p class="sample-note">Real report — <strong>273 5th Avenue, Manhattan</strong> — Full-Service Restaurant — scored April 2026</p>
			<div class="s-cta-row">
				<a href="/app/onboarding" class="s-cta-btn">Get your own score →</a>
			</div>
		</div>
	</section>

	<!-- 4. AI SECTION -->
	<section class="ai-section">
		<div class="ai-kicker">Why we built this</div>
		<h2 class="ai-headline">Don't work for AI.<br>Make AI <em>work for you.</em></h2>
		<p class="ai-sub">Everyone's talking about AI replacing jobs. We built one that helps you create yours. RE² is artificial intelligence that works for the founder - not the landlord, not the broker, not the bank.</p>
		<div class="ai-pillars">
			<div class="ai-pillar">
				<div class="ai-pillar-icon">
					<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(232,168,56,0.8)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
				</div>
				<div class="ai-pillar-title">Thinks like a 20-year advisor</div>
				<p class="ai-pillar-desc">Trained on two decades of NYC retail data. It knows which blocks thrive, which rents are traps, and which demographics match your concept.</p>
			</div>
			<div class="ai-pillar">
				<div class="ai-pillar-icon">
					<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(232,168,56,0.8)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
				</div>
				<div class="ai-pillar-title">Works on your time</div>
				<p class="ai-pillar-desc">No appointments. No gatekeepers. Score an address at 2AM. The AI doesn't care when you show up - it just works.</p>
			</div>
			<div class="ai-pillar">
				<div class="ai-pillar-icon">
					<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(232,168,56,0.8)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
				</div>
				<div class="ai-pillar-title">Keeps your dream private</div>
				<p class="ai-pillar-desc">Not ready to tell anyone? No broker calls. No spam. Just you and the data, until you decide to make the leap.</p>
			</div>
		</div>
	</section>

	<!-- 5. BY THE NUMBERS -->
	<section class="beta-section">
		<div class="scores-inner">
			<div class="s-kicker">Beta - Manhattan & Brooklyn</div>
			<h2 class="s-heading">Built with <em>real data.</em></h2>
			<p class="s-sub">RE² is in private beta with real founders, real locations, and real decisions.</p>
			<div class="beta-cards">
				<div class="beta-card">
					<div class="beta-stat">89,000+</div>
					<div class="beta-theme">NYC businesses scored</div>
					<div class="beta-who">Across all 5 boroughs, 13 business concepts</div>
				</div>
				<div class="beta-card">
					<div class="beta-stat">20</div>
					<div class="beta-theme">Data sources per location</div>
					<div class="beta-who">Transit, census, DOH, DOB, Yelp, Google, 311, and more</div>
				</div>
				<div class="beta-card">
					<div class="beta-stat">6,500+</div>
					<div class="beta-theme">NYC blocks analyzed</div>
					<div class="beta-who">Block-level scoring with survival rates and competitor density</div>
				</div>
				<div class="beta-card">
					<div class="beta-stat">Lender-Ready</div>
					<div class="beta-theme">Capital package included</div>
					<div class="beta-who">Founders have used RE² reports in SBA and investor conversations</div>
				</div>
			</div>
		</div>
	</section>

	<!-- 6. HOW IT WORKS -->
	<section class="steps-section" id="how">
		<div class="steps-inner">
			<div class="s-kicker">How it works</div>
			<h2 class="s-heading">Your AI advisor in <em>four steps.</em></h2>
			<p class="s-sub">No spreadsheets. No brokers. No background in real estate required.</p>
			<div class="steps">
				<div class="step-item">
					<div class="step-num">1</div>
					<div>
						<div class="step-title">Tell the AI your concept</div>
						<p class="step-desc">A café, a gym, a barbershop - your concept calibrates the demographics, financials, and competition the AI evaluates.</p>
					</div>
				</div>
				<div class="step-item">
					<div class="step-num">2</div>
					<div>
						<div class="step-title">Enter an address</div>
						<p class="step-desc">Any NYC commercial address. The AI cross-references transit, safety, neighborhood health, and competitive density in real time.</p>
					</div>
				</div>
				<div class="step-item">
					<div class="step-num">3</div>
					<div>
						<div class="step-title">Get your score</div>
						<p class="step-desc">One number out of 100 that evaluates the block and your concept together. A clear verdict — go, refine, or walk — plus the top things you can do to improve.</p>
					</div>
				</div>
				<div class="step-item">
					<div class="step-num">4</div>
					<div>
						<div class="step-title">Walk into the bank ready</div>
						<p class="step-desc">Export a loan-ready report - projections, location intelligence, risk analysis. Formatted for SBA lenders and investors.</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- FINAL CTA -->
	<section class="final-cta">
		<h2 class="final-h2">The idea is real.<br>Now let the AI <em>prove the location.</em></h2>
		<p class="final-sub">Five minutes. One address. One AI score and a financial model — the FICO score for your storefront.</p>
		<a href="/login" class="btn-primary" data-sveltekit-reload onclick={() => track(EVENTS.LANDING_CTA_CLICK, { cta: 'bottom' })}>
			Start free
		</a>
		<p class="risk-reversal">Your address is never shared. No broker calls. No spam.</p>
		<p class="final-whisper">The founders who do their homework are the ones who survive year one.</p>
	</section>

	<footer>
		<div class="footer-links">
			<a href="/privacy">Privacy</a>
			<span class="footer-dot">·</span>
			<a href="/terms">Terms</a>
			<span class="footer-dot">·</span>
			<a href="mailto:hello@resquared.io">Contact</a>
		</div>
		<p>RE² - AI-powered location intelligence for first-time founders - NYC Beta - © 2026</p>
	</footer>
</div>

<style>
	:global(body) { background: var(--cream, #faf7f2); }

	.landing-page {
		--cream: #faf7f2;
		--warm: var(--bg);
		--blush: #ffe8e0;
		--hot-pink: #e8345a;
		--hot-pink-dark: #c42d4e;
		--deep-green: #1a3a2a;
		--sage: #4a7c5c;
		--sage-light: #e8f2ec;
		--marigold: #e8a838;
		--marigold-light: #fdf4e0;
		--ink: var(--text);
		--lp-text: #2c2c2c;
		--text2: #555555;
		--text3: #666666;
		--lp-border: var(--border);

		width: 100%;
		background: var(--cream);
		font-family: 'DM Sans', -apple-system, sans-serif;
		color: var(--lp-text);
		line-height: 1.65;
		-webkit-font-smoothing: antialiased;
	}

	/* NAV */
	.navbar {
		position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
		padding: 16px 48px; display: flex; align-items: center; justify-content: space-between;
		background: rgba(250,247,242,0.92); backdrop-filter: blur(20px);
		border-bottom: 1px solid var(--lp-border);
	}
	.nav-logo {
		font-family: 'Playfair Display', serif;
		font-size: 24px; color: var(--deep-green); letter-spacing: -0.5px;
		text-decoration: none; cursor: pointer;
	}
	.nav-logo sup { color: var(--hot-pink); font-size: 14px; }
	.nav-links { display: flex; align-items: center; gap: 28px; }
	.nav-link {
		color: var(--text2); text-decoration: none; font-size: 14px;
		font-weight: 500; background: none; border: none; cursor: pointer;
		font-family: inherit; transition: color 0.2s;
	}
	.nav-link:hover { color: var(--lp-text); }
	.nav-cta {
		background: var(--deep-green); color: #fff; padding: 10px 24px;
		border-radius: 8px; font-weight: 600; font-size: 13px;
		text-decoration: none; transition: background 0.2s; cursor: pointer;
	}
	.nav-cta:hover { background: #0f2218; }
	.mobile-menu-btn {
		display: none; flex-direction: column; gap: 6px;
		background: none; border: none; cursor: pointer;
	}
	.mobile-menu-btn span { width: 24px; height: 2px; background: var(--ink); }

	@media (max-width: 768px) {
		.navbar { padding: 14px 20px; }
		.mobile-menu-btn { display: flex; }
		.nav-links {
			position: absolute; top: 56px; left: 0; right: 0;
			flex-direction: column; gap: 16px; padding: 16px 24px;
			background: var(--cream); border-bottom: 1px solid var(--lp-border);
			display: none;
		}
		.nav-links.mobile-open { display: flex; }
	}

	/* HERO */
	.hero {
		min-height: 100vh; display: flex; flex-direction: column;
		align-items: center; justify-content: center; text-align: center;
		padding: 100px 24px 80px; max-width: 820px; margin: 0 auto;
	}
	.hero-content {
		opacity: 0; transition: opacity 0.6s ease, transform 0.6s ease;
		transform: translateY(16px);
	}
	.hero-content.visible { opacity: 1; transform: translateY(0); }
	.hero-kicker {
		font-size: 13px; text-transform: uppercase; letter-spacing: 2.5px;
		font-weight: 600; color: var(--sage); margin-bottom: 16px;
	}
	.hero h1 {
		font-family: 'Playfair Display', serif;
		font-size: 64px; font-weight: 400; line-height: 1.06;
		letter-spacing: -2px; margin-bottom: 24px; color: var(--deep-green);
	}
	.hero h1 em { font-style: italic; color: var(--hot-pink); }
	.hero-sub {
		font-size: 20px; color: var(--text2); max-width: 540px;
		margin: 0 auto 40px; line-height: 1.75;
	}
	.hero-cta-row {
		display: flex; gap: 14px; align-items: center;
		flex-wrap: wrap; justify-content: center;
	}
	.btn-primary {
		background: var(--deep-green); color: #fff; padding: 16px 36px;
		border-radius: 8px; font-weight: 600; font-size: 20px;
		text-decoration: none; transition: all 0.2s; border: none;
		cursor: pointer; font-family: inherit;
	}
	.btn-primary:hover { background: #0f2218; box-shadow: 0 6px 20px rgba(30,58,42,0.28); }
	.btn-ghost {
		color: var(--text2); padding: 16px 20px; font-size: 20px;
		text-decoration: none; border: none;
		background: none; cursor: pointer;
		font-family: inherit; font-weight: 500; transition: color 0.2s;
	}
	.btn-ghost:hover { color: var(--deep-green); }
	.hero-meta {
		margin-top: 24px; font-size: 13px; color: var(--text3);
		display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
	}
	.meta-dot { opacity: 0.5; }

	/* ASYMMETRY STRIP */
	.asymmetry-strip {
		background: var(--deep-green); color: rgba(255,255,255,0.8);
		padding: 18px 48px; text-align: center;
		font-size: 15px; line-height: 1.6;
	}
	.asymmetry-strip em {
		font-style: italic; color: var(--marigold);
		font-family: 'Playfair Display', serif; font-size: 17px;
	}

	/* SOCIAL PROOF BAR */
	.proof-bar {
		padding: 36px 48px;
		border-bottom: 1px solid var(--lp-border);
	}
	.proof-stats {
		display: flex; justify-content: center; gap: 56px;
		max-width: 1100px; margin: 0 auto; flex-wrap: wrap;
	}
	.proof-stat { text-align: center; }
	.proof-num {
		font-family: 'Playfair Display', serif;
		font-size: 30px; font-weight: 400; color: var(--deep-green);
	}
	.proof-label { font-size: 13px; color: var(--text2); margin-top: 4px; max-width: 160px; }

	/* PERSONA SECTION */
	.persona-section { padding: 100px 24px; max-width: 1060px; margin: 0 auto; }
	.persona-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 48px; }
	.persona-card {
		background: #fff; border: 1px solid var(--lp-border); border-radius: 16px;
		padding: 32px 26px; transition: box-shadow 0.3s, transform 0.2s;
		text-decoration: none; color: inherit; display: block;
	}
	.persona-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.08); transform: translateY(-3px); }
	.persona-pill {
		display: inline-block; padding: 4px 12px; border-radius: 4px;
		font-size: 11px; font-weight: 700; text-transform: uppercase;
		letter-spacing: 1px; margin-bottom: 16px;
	}
	.persona-pill.dreaming { background: var(--blush); color: var(--hot-pink); }
	.persona-pill.searching { background: var(--sage-light); color: var(--sage); }
	.persona-pill.evaluating { background: var(--marigold-light); color: #b07c1a; }
	.persona-quote {
		font-family: 'Playfair Display', serif;
		font-size: 22px; font-style: italic; margin-bottom: 12px;
		color: var(--ink); line-height: 1.3;
	}
	.persona-body { font-size: 14px; color: var(--text2); line-height: 1.7; margin-bottom: 20px; }
	.persona-cta { font-size: 14px; font-weight: 600; color: var(--deep-green); }

	/* SCORES / DIAL SECTION */
	.scores-section {
		padding: 100px 24px; background: var(--warm);
		border-top: 1px solid var(--lp-border); border-bottom: 1px solid var(--lp-border);
	}
	.scores-inner {
		max-width: 1100px; margin: 0 auto;
		background: #fff;
		border-radius: 16px;
		padding: 56px 40px;
		box-shadow: 0 4px 24px rgba(0,0,0,0.06);
	}
	.s-live-badge {
		display: inline-block;
		font-family: 'DM Sans', sans-serif;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		color: #fff;
		background: var(--hot-pink);
		padding: 4px 14px;
		border-radius: 20px;
		margin-bottom: 16px;
		text-align: center;
		/* center in the scores-inner which is now text-align center via s-kicker */
	}
	.scores-inner { text-align: center; }
	.s-cta-row { text-align: center; margin-top: 32px; }
	.s-cta-btn {
		display: inline-block;
		font-family: 'DM Sans', sans-serif;
		font-size: 15px;
		font-weight: 700;
		color: #fff;
		background: var(--hot-pink);
		padding: 12px 28px;
		border-radius: 8px;
		text-decoration: none;
		transition: background 0.2s;
	}
	.s-cta-btn:hover { background: var(--hot-pink-dark); }
	.s-kicker {
		font-size: 13px; text-transform: uppercase; letter-spacing: 2px;
		color: var(--sage); font-weight: 600; text-align: center; margin-bottom: 10px;
	}
	.s-heading {
		font-family: 'Playfair Display', serif; font-size: 40px; font-weight: 400;
		text-align: center; margin-bottom: 14px; color: var(--ink); letter-spacing: -0.5px;
	}
	.s-heading em { font-style: italic; color: var(--hot-pink); }
	.s-sub {
		font-size: 17px; color: var(--text2); text-align: center;
		max-width: 500px; margin: 0 auto 56px; line-height: 1.7;
	}

	/* Dial styles — OSR-01: kept only selectors still used by single-score card */
	.dial-card {
		background: #fff; border: 1px solid var(--lp-border); border-radius: 16px;
		padding: 28px 24px; text-align: center;
	}
	.dial-center-card {
		flex: 0 0 320px;
		border: 2px solid var(--marigold);
		background: #fffdf7;
		box-shadow: 0 4px 24px rgba(232,168,56,0.12);
	}
	.dial-badge {
		display: inline-block; font-size: 10px; font-weight: 700;
		text-transform: uppercase; letter-spacing: 0.08em;
		padding: 3px 10px; border-radius: 20px; margin-bottom: 8px;
	}
	.badge-fit-center { background: var(--deep-green); color: white; }
	.dial-question { font-size: 13px; color: var(--text2); margin-bottom: 16px; line-height: 1.4; }
	.dial-ring-wrap {
		position: relative; display: inline-flex;
		align-items: center; justify-content: center; margin-bottom: 16px;
	}
	.dial-ring-wrap svg { display: block; }
	.dial-number {
		position: absolute; top: 50%; left: 50%;
		transform: translate(-50%, -50%);
		text-align: center; line-height: 1;
	}
	.dn-score {
		display: block; font-family: 'Playfair Display', serif;
		font-weight: 700;
	}
	.dn-out { display: block; font-size: 13px; color: var(--text3); margin-top: 2px; }
	.verdict-pill {
		display: inline-block; background: var(--deep-green); color: white;
		font-size: 13px; font-weight: 700; padding: 7px 20px;
		border-radius: 20px; margin: 8px 0 16px; letter-spacing: 0.02em;
	}
	.sample-note {
		text-align: center; font-size: 12px; color: var(--text3);
		font-style: italic;
	}
	.sample-note strong { color: var(--deep-green); font-style: normal; }

	/* OSR-01: Single score layout */
	.single-score-row {
		display: flex; justify-content: center; margin-bottom: 40px;
	}
	.single-score-row .dial-center-card {
		flex: 0 0 380px; max-width: 420px; width: 100%;
	}
	.dial-dims {
		display: flex; flex-direction: column; gap: 10px;
		text-align: left; margin-top: 8px;
	}
	.dim-bar {
		display: grid; grid-template-columns: 110px 1fr 36px;
		align-items: center; gap: 10px;
	}
	.dim-label { font-size: 12px; color: var(--text2); font-weight: 500; }
	.dim-track {
		height: 6px; background: rgba(0,0,0,0.06); border-radius: 3px;
		overflow: hidden;
	}
	.dim-fill { height: 100%; border-radius: 3px; }
	.dim-val {
		font-size: 12px; font-weight: 700; color: var(--lp-text);
		text-align: right;
	}
	.dim-val.warn { color: var(--marigold); }
	.dim-val.good { color: var(--sage); }

	@media (max-width: 640px) {
		.single-score-row .dial-center-card { flex: 1; max-width: 100%; }
	}

	/* AI SECTION */
	.ai-section {
		padding: 120px 24px; text-align: center;
		background: var(--deep-green); color: #fff;
	}
	.ai-kicker {
		font-size: 13px; text-transform: uppercase; letter-spacing: 3px;
		color: rgba(255,255,255,0.35); margin-bottom: 24px;
	}
	.ai-headline {
		font-family: 'Playfair Display', serif;
		font-size: 52px; font-weight: 400; letter-spacing: -1.5px;
		line-height: 1.12; max-width: 600px; margin: 0 auto 24px;
	}
	.ai-headline em { font-style: italic; color: var(--marigold); }
	.ai-sub {
		font-size: 18px; color: rgba(255,255,255,0.5); max-width: 500px;
		margin: 0 auto 56px; line-height: 1.7;
	}
	.ai-pillars {
		display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
		max-width: 860px; margin: 0 auto;
	}
	.ai-pillar {
		background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
		border-radius: 12px; padding: 28px 22px; text-align: left;
	}
	.ai-pillar-icon { margin-bottom: 16px; opacity: 0.9; }
	.ai-pillar-title { font-size: 15px; font-weight: 700; margin-bottom: 8px; color: #fff; }
	.ai-pillar-desc { font-size: 14px; color: rgba(255,255,255,0.45); line-height: 1.65; }

	/* IN BETA SECTION */
	.beta-section {
		padding: 100px 24px;
		border-bottom: 1px solid var(--lp-border);
	}
	.beta-cards {
		display: grid; grid-template-columns: repeat(2, 1fr);
		gap: 20px; margin-top: 48px;
	}
	.beta-card {
		background: #fff; border: 1px solid var(--lp-border);
		border-radius: 14px; padding: 28px;
	}
	.beta-quote {
		font-family: 'Playfair Display', serif;
		font-size: 17px; font-style: italic; color: var(--deep-green);
		line-height: 1.5; margin-bottom: 16px;
	}
	.beta-stat {
		font-family: 'DM Sans', sans-serif;
		font-size: 36px; font-weight: 700; color: var(--hot-pink);
		line-height: 1.1; margin-bottom: 12px;
	}
	.beta-theme { font-size: 13px; font-weight: 700; color: var(--lp-text); margin-bottom: 4px; }
	.beta-who { font-size: 12px; color: var(--text3); }

	/* STEPS SECTION */
	.steps-section {
		padding: 100px 24px; background: var(--warm);
		border-top: 1px solid var(--lp-border); border-bottom: 1px solid var(--lp-border);
	}
	.steps-inner { max-width: 720px; margin: 0 auto; }
	.steps { display: flex; flex-direction: column; gap: 0; }
	.step-item {
		display: grid; grid-template-columns: 48px 1fr; gap: 20px;
		padding: 28px 0; border-bottom: 1px solid var(--lp-border);
	}
	.step-item:last-child { border-bottom: none; }
	.step-num {
		width: 40px; height: 40px; border-radius: 8px;
		background: var(--ink); color: #fff;
		display: flex; align-items: center; justify-content: center;
		font-weight: 700; font-size: 15px;
	}
	.step-title { font-size: 17px; font-weight: 700; margin-bottom: 4px; color: var(--ink); }
	.step-desc { font-size: 15px; color: var(--text2); line-height: 1.7; margin: 0; }

	/* FINAL CTA */
	.final-cta { padding: 80px 24px; text-align: center; }
	.final-h2 {
		font-family: 'Playfair Display', serif;
		font-size: 46px; font-weight: 400; letter-spacing: -1px;
		margin-bottom: 16px; color: var(--ink); line-height: 1.12;
	}
	.final-h2 em { font-style: italic; color: var(--hot-pink); }
	.final-sub {
		font-size: 18px; color: var(--text2); max-width: 480px;
		margin: 0 auto 32px; line-height: 1.7;
	}
	.risk-reversal {
		font-size: 13px; color: var(--text3); margin-top: 14px; margin-bottom: 0;
	}
	.final-whisper { font-size: 14px; color: var(--text3); margin-top: 20px; font-style: italic; }

	footer {
		padding: 36px 48px; border-top: 1px solid var(--lp-border);
		text-align: center; font-size: 13px; color: var(--text3);
	}
	.footer-links { display: flex; justify-content: center; gap: 8px; margin-bottom: 12px; }
	.footer-links a { color: var(--sage); text-decoration: none; font-weight: 500; font-size: 13px; }
	.footer-links a:hover { text-decoration: underline; }
	.footer-dot { color: var(--text3); }

	/* RESPONSIVE */
	@media (max-width: 1024px) {
		.dial-center-card { width: 100%; flex: none; }
	}
	@media (max-width: 768px) {
		.hero { padding: 120px 20px 60px; }
		.hero h1 { font-size: 40px; }
		.hero-sub { font-size: 17px; }
		.asymmetry-strip { padding: 16px 24px; font-size: 14px; }
		.proof-stats { gap: 28px; }
		.ai-headline { font-size: 36px; }
		.ai-pillars { grid-template-columns: 1fr; }
		.persona-cards { grid-template-columns: 1fr; }
		.beta-cards { grid-template-columns: 1fr; }
		.s-heading { font-size: 30px; }
		.final-h2 { font-size: 34px; }
	}
</style>
