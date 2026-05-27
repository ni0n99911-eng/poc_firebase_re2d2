<script>
	import SiteNav from '$lib/components/SiteNav.svelte';
	import { page } from '$app/stores';
	import { SITE_CONFIG } from '$lib/modules';
</script>

<svelte:head>
	<title>RE² — About</title>
</svelte:head>

<SiteNav />

<main>
	<!-- Section 1: Mission -->
	<section class="mission">
		<div class="container">
			<h1>We bridge the data gap in real estate.</h1>
			<p>
				We built RE² because we kept watching the same story play out. A founder with a great idea walks into a lease negotiation with a dream and a spreadsheet they built at 2am. The landlord has a broker, a lawyer, and ten years of market data. The founder signs. Twelve months later, the space is empty again. Our team has closed over $25 billion in real estate and financial services transactions. We've been on both sides of that table — structuring deals, underwriting loans, advising landlords, and coaching founders. RE² is the tool we wished existed for every founder who walked into our offices unprepared.
			</p>
		</div>
	</section>

	<!-- Section 2: Team -->
	<section class="team">
		<div class="container">
			<h2>Our Team</h2>
			<p class="team-intro">Our founding team includes former commercial real estate underwriters, financial services executives, and data engineers who've spent decades in the markets RE² serves.</p>

			<div class="team-grid">
				<div class="team-card">
					<div class="placeholder">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
					</div>
					<h3>Commercial Real Estate</h3>
					<p>Underwriting, deal structuring, and market analysis across 15+ years of institutional experience.</p>
				</div>
				<div class="team-card">
					<div class="placeholder">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
					</div>
					<h3>Financial Services</h3>
					<p>Loan origination, risk assessment, and portfolio management at Fortune 500 financial institutions.</p>
				</div>
				<div class="team-card">
					<div class="placeholder">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
					</div>
					<h3>Data Engineering</h3>
					<p>Large-scale data pipeline architecture, machine learning infrastructure, and analytics platforms.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Section 3: The Intelligence Engine -->
	<section class="thesis">
		<div class="container">
			<h2>The Intelligence Engine</h2>
			<p>
				At the core of RE² is a proprietary scoring engine that cross-references 19 live data sources — spanning demographics, transit, safety, competition, and commercial activity — producing your RE² Score tailored to your specific business type. The same caliber of authoritative public data that city planners and institutional investors rely on, now synthesized into actionable intelligence for every founder in seconds.
			</p>
		</div>
	</section>

	<!-- Section 4: The Thesis -->
	<section class="thesis">
		<div class="container">
			<h2>The Thesis</h2>
			<p>
				The retail real estate market has a data asymmetry problem. Landlords and brokers have access to tools like CoStar, REIS, and proprietary deal databases. First-time founders have Google Maps and gut instinct. RE² levels the playing field by giving every founder access to the same caliber of location intelligence that institutional investors use — at a fraction of the cost, in a fraction of the time.
			</p>
		</div>
	</section>

	<!-- Section 4: Contact -->
	<section class="contact">
		<div class="container">
			<h2>Let's Talk</h2>
			<p>Have questions? Reach us at <a href="mailto:{SITE_CONFIG.emails.hello}" data-sveltekit-reload>{SITE_CONFIG.emails.hello}</a></p>
		</div>
	</section>
</main>

<style>
	:global(body) {
		background-color: var(--white);
		color: var(--text);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
		line-height: 1.6;
		margin: 0;
		padding: 0;
	}

	main {
		background-color: var(--white);
		color: var(--text);
		min-height: 100vh;
		padding-top: 80px;
	}

	.container {
		max-width: 900px;
		margin: 0 auto;
		padding: 0 24px;
	}

	/* Mission Section */
	.mission {
		padding: 120px 0;
		border-bottom: 1px solid var(--border);
	}

	.mission h1 {
		font-size: 56px;
		font-weight: 600;
		line-height: 1.2;
		margin: 0 0 32px 0;
		color: var(--text);
		letter-spacing: -0.5px;
	}

	.mission p {
		font-size: 18px;
		line-height: 1.8;
		color: var(--text);
		margin: 0;
		opacity: 0.95;
	}

	/* Team Section */
	.team {
		padding: 120px 0;
		border-bottom: 1px solid var(--border);
	}

	.team h2 {
		font-size: 42px;
		font-weight: 600;
		margin: 0 0 16px 0;
		color: var(--text);
		letter-spacing: -0.5px;
	}

	.team-intro {
		font-size: 18px;
		color: var(--text);
		margin: 0 0 64px 0;
		opacity: 0.9;
		max-width: 700px;
	}

	.team-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 32px;
		margin-top: 48px;
	}

	.team-card {
		background-color: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 32px;
		transition: all 0.3s ease;
	}

	.team-card:hover {
		background-color: var(--surface);
		border-color: var(--teal);
		transform: translateY(-2px);
	}

	.placeholder {
		width: 100%;
		height: 200px;
		background: linear-gradient(135deg, var(--surface-alt) 0%, var(--border) 100%);
		border-radius: 4px;
		margin-bottom: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--border);
	}

	.team-card h3 {
		font-size: 20px;
		font-weight: 600;
		margin: 0 0 12px 0;
		color: var(--teal);
	}

	.team-card p {
		font-size: 15px;
		color: var(--text);
		margin: 0;
		opacity: 0.85;
		line-height: 1.7;
	}

	/* Thesis Section */
	.thesis {
		padding: 120px 0;
		border-bottom: 1px solid var(--border);
	}

	.thesis h2 {
		font-size: 42px;
		font-weight: 600;
		margin: 0 0 32px 0;
		color: var(--text);
		letter-spacing: -0.5px;
	}

	.thesis p {
		font-size: 18px;
		line-height: 1.8;
		color: var(--text);
		margin: 0;
		opacity: 0.95;
		max-width: 800px;
	}

	/* Contact Section */
	.contact {
		padding: 120px 0;
	}

	.contact h2 {
		font-size: 42px;
		font-weight: 600;
		margin: 0 0 24px 0;
		color: var(--text);
		letter-spacing: -0.5px;
	}

	.contact p {
		font-size: 18px;
		color: var(--text);
		margin: 0;
		opacity: 0.95;
	}

	.contact a {
		color: var(--teal);
		text-decoration: none;
		font-weight: 500;
		transition: opacity 0.3s ease;
		border-bottom: 1px solid var(--teal-ring);
	}

	.contact a:hover {
		opacity: 0.8;
		border-bottom-color: var(--teal);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.mission {
			padding: 80px 0;
		}

		.mission h1 {
			font-size: 36px;
			margin-bottom: 24px;
		}

		.mission p {
			font-size: 16px;
		}

		.team {
			padding: 80px 0;
		}

		.team h2,
		.thesis h2,
		.contact h2 {
			font-size: 32px;
			margin-bottom: 20px;
		}

		.team-intro {
			font-size: 16px;
			margin-bottom: 40px;
		}

		.team-grid {
			grid-template-columns: 1fr;
			gap: 24px;
		}

		.thesis {
			padding: 80px 0;
		}

		.thesis p {
			font-size: 16px;
		}

		.contact {
			padding: 80px 0;
		}

		.contact p {
			font-size: 16px;
		}

		.container {
			padding: 0 16px;
		}
	}

	@media (max-width: 480px) {
		.mission h1 {
			font-size: 28px;
		}

		.mission p {
			font-size: 14px;
			line-height: 1.7;
		}

		.team h2,
		.thesis h2,
		.contact h2 {
			font-size: 24px;
		}

		.team-intro {
			font-size: 14px;
		}

		.team-card {
			padding: 20px;
		}

		.placeholder {
			height: 150px;
		}

		.team-card h3 {
			font-size: 18px;
		}

		.team-card p {
			font-size: 13px;
		}

		.thesis p,
		.contact p {
			font-size: 14px;
		}
	}
</style>
