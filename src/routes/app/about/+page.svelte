<script lang="ts">
	import { onMount } from 'svelte';
	import { loadLaunchPadData } from '$lib/launchpad-store';

	let showTeamForm = false;
	let teamMemberName = '';
	let teamMemberRole = '';
	let lpData = $state(loadLaunchPadData());

	onMount(() => {
		lpData = loadLaunchPadData();
	});
</script>

<svelte:head>
	<title>RE² — About {lpData.businessName || 'Your Business'}</title>
</svelte:head>

<div class="about-page">
	<!-- Hero Section -->
	<section class="hero">
		<div class="hero-content">
			<h1>About {lpData.businessName || 'Your Business'}</h1>
			<p class="tagline">Fuel your purpose</p>
		</div>
	</section>

	<!-- The Concept -->
	<section class="section concept">
		<div class="section-content">
			<h2>The Concept</h2>
			<p>
				{lpData.visionStatement || 'A wellness-first business offering differentiated products and services.'}
			</p>
		</div>
	</section>

	<!-- The Three Pillars -->
	<section class="section pillars">
		<div class="section-header">
			<h2>The Three Pillars</h2>
		</div>
		<div class="pillars-grid">
			<!-- ENERGIZE -->
			<div class="pillar" style="--pillar-color: #FF2D55">
				<div class="pillar-icon">⚡</div>
				<h3>ENERGIZE</h3>
				<p>Energy and focus for your day. Our energizing blends combine premium coffee with adaptogens designed to provide sustained mental clarity without the crash.</p>
			</div>

			<!-- GLOW -->
			<div class="pillar" style="--pillar-color: #9D4EDD">
				<div class="pillar-icon">✨</div>
				<h3>GLOW</h3>
				<p>Self-care and vitality in every sip. Our glow collection features collagen-infused drinks and antioxidant-rich blends for radiant wellness from within.</p>
			</div>

			<!-- RESET -->
			<div class="pillar" style="--pillar-color: #00E8CC">
				<div class="pillar-icon">🧘</div>
				<h3>RESET</h3>
				<p>Calm and relaxation when you need it. Our reset line includes adaptogens and botanical blends designed to soothe the nervous system and restore balance.</p>
			</div>
		</div>
	</section>

	<!-- Location -->
	<section class="section location">
		<div class="section-content">
			<h2>Our Location</h2>
			<p class="location-text">
				<strong>Your Primary Location</strong>
			</p>
			<p class="location-desc">
				Located in {lpData?.idealArea || 'a prime neighborhood'}. A carefully curated space designed for
				wellness and community.
			</p>
		</div>
	</section>

	<!-- The Menu -->
	<section class="section menu">
		<div class="section-content">
			<h2>The Menu</h2>
			<div class="menu-overview">
				<p>
					<strong>74 SKUs</strong> spanning:
				</p>
				<ul class="menu-list">
					<li>Protein lattes</li>
					<li>Collagen drinks</li>
					<li>Kids menu</li>
					<li>Grab-and-go food</li>
					<li>5 daily bundles</li>
				</ul>
			</div>
		</div>
	</section>

	<!-- The Team -->
	<section class="section team">
		<div class="section-content">
			<h2>The Team</h2>
			<p class="team-intro">
				Our founders and team members bring years of expertise in wellness, business, and community building.
			</p>

			<div class="team-members">
				<!-- Placeholder team members -->
				<div class="team-placeholder">
					<div class="placeholder-icon">👥</div>
					<p>Add your team members here</p>
					<button class="btn-secondary" onclick={() => (showTeamForm = !showTeamForm)}>
						{showTeamForm ? 'Cancel' : 'Add Team Member'}
					</button>
				</div>
			</div>

			{#if showTeamForm}
				<div class="team-form">
					<h3>Add Team Member</h3>
					<div class="form-group">
						<label for="name">Name</label>
						<input
							id="name"
							type="text"
							bind:value={teamMemberName}
							placeholder="Full name"
							class="form-input"
						/>
					</div>
					<div class="form-group">
						<label for="role">Role</label>
						<input
							id="role"
							type="text"
							bind:value={teamMemberRole}
							placeholder="e.g. Co-Founder, Head of Operations"
							class="form-input"
						/>
					</div>
					<div class="form-actions">
						<button class="btn-accent">Save Member</button>
						<button class="btn-secondary" onclick={() => (showTeamForm = false)}>Cancel</button>
					</div>
				</div>
			{/if}
		</div>
	</section>

	<!-- Contact -->
	<section class="section contact">
		<div class="section-content">
			<h2>Get in Touch</h2>
			<div class="contact-grid">
				<div class="contact-item">
					<div class="contact-label">Website</div>
					<a href="https://resquared.io" target="_blank" class="contact-value">resquared.io</a>
				</div>
				<div class="contact-item">
					<div class="contact-label">Email</div>
					<a href="mailto:hello@resquared.io" class="contact-value">hello@resquared.io</a>
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	.about-page {
		background: linear-gradient(135deg, var(--bg) 0%, var(--surface-alt) 100%);
		color: var(--text);
	}

	/* Hero Section */
	.hero {
		padding: 80px 32px;
		text-align: center;
		background: linear-gradient(135deg, var(--surface-alt) 0%, var(--surface) 100%);
		border-bottom: 1px solid var(--border);
	}

	.hero-content {
		max-width: 900px;
		margin: 0 auto;
	}

	.hero h1 {
		font-size: 3.5rem;
		font-weight: 700;
		margin-bottom: 12px;
		background: linear-gradient(135deg, var(--warning) 0%, var(--danger) 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.tagline {
		font-size: 1.3rem;
		color: var(--teal);
		font-weight: 300;
		letter-spacing: 1px;
	}

	/* Sections */
	.section {
		padding: 60px 32px;
		border-bottom: 1px solid var(--border);
		text-align: left;
	}

	.section:nth-child(odd) {
		background: rgba(0, 0, 0, 0.01);
	}

	.section-content {
		max-width: 900px;
		margin: 0 auto;
	}

	.section-header {
		max-width: 900px;
		margin: 0 auto;
		margin-bottom: 32px;
		text-align: left;
	}

	.section h2 {
		font-size: 2rem;
		font-weight: 700;
		margin-bottom: 24px;
		color: var(--text);
		text-align: left;
	}

	.section p {
		font-size: 1rem;
		line-height: 1.6;
		color: var(--text-secondary);
		margin-bottom: 12px;
		text-align: left;
	}

	/* Concept Section */
	.concept {
		background: var(--teal-bg);
	}

	.concept p {
		font-size: 1.1rem;
		line-height: 1.7;
		color: var(--text);
		max-width: 700px;
		text-align: left;
	}

	/* Three Pillars */
	.pillars-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 24px;
		max-width: 1200px;
		margin: 0 auto;
	}

	.pillar {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 32px 24px;
		text-align: center;
		transition: all 0.3s ease;
		border-left: 4px solid var(--pillar-color);
	}

	.pillar:hover {
		background: var(--surface-alt);
		border-color: var(--border-hover);
		transform: translateY(-4px);
	}

	.pillar-icon {
		font-size: 2.5rem;
		margin-bottom: 12px;
	}

	.pillar h3 {
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 12px;
		letter-spacing: 1px;
	}

	.pillar p {
		font-size: 0.95rem;
		line-height: 1.65;
		color: var(--text-secondary);
	}

	/* Location */
	.location {
		background: var(--red-soft);
	}

	.location-text {
		font-size: 1.2rem;
		color: var(--text);
		margin-bottom: 12px;
		text-align: left;
	}

	.location-desc {
		font-size: 1rem;
		color: var(--text-secondary);
		line-height: 1.6;
		text-align: left;
	}

	/* Menu */
	.menu {
		background: rgba(124, 58, 237, 0.02);
	}

	.menu-overview {
		background: var(--teal-bg);
		border: 1px solid var(--teal-ring);
		border-radius: 8px;
		padding: 24px;
		margin-top: 20px;
	}

	.menu-overview p {
		font-size: 1.05rem;
		color: var(--text);
		margin-bottom: 16px;
		text-align: left;
	}

	.menu-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 8px;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.menu-list li {
		color: var(--text-secondary);
		padding: 8px 12px;
		background: var(--surface-alt);
		border-radius: 6px;
		border-left: 3px solid var(--teal);
	}

	/* Team Section */
	.team {
		background: var(--amber-soft);
	}

	.team-intro {
		margin-bottom: 28px;
		font-size: 1.05rem;
		line-height: 1.6;
		text-align: left;
		color: var(--text-secondary);
	}

	.team-members {
		margin-top: 24px;
	}

	.team-placeholder {
		background: var(--surface);
		border: 1px dashed var(--border);
		border-radius: 8px;
		padding: 40px;
		text-align: center;
	}

	.placeholder-icon {
		font-size: 2.5rem;
		margin-bottom: 12px;
	}

	.team-placeholder p {
		margin-bottom: 16px;
		color: var(--text-secondary);
	}

	/* Team Form */
	.team-form {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 24px;
		margin-top: 16px;
	}

	.team-form h3 {
		font-size: 1.1rem;
		font-weight: 600;
		margin-bottom: 16px;
		color: var(--text);
	}

	.form-group {
		margin-bottom: 16px;
		display: flex;
		flex-direction: column;
	}

	.form-group label {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 6px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.form-input {
		padding: 10px 12px;
		background: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text);
		font-family: inherit;
		font-size: 0.95rem;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--teal);
		background: var(--bg);
	}

	.form-actions {
		display: flex;
		gap: 8px;
		margin-top: 16px;
	}

	/* Contact */
	.contact {
		background: var(--teal-bg);
	}

	.contact-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 20px;
		margin-top: 28px;
	}

	.contact-item {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 24px;
		text-align: left;
	}

	.contact-label {
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--text-tertiary);
		margin-bottom: 8px;
	}

	.contact-value {
		font-size: 1.05rem;
		font-weight: 500;
		color: var(--teal);
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.contact-value:hover {
		color: var(--warning);
	}

	/* Buttons */
	.btn-accent,
	.btn-secondary {
		padding: 10px 20px;
		border: none;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-family: inherit;
	}

	.btn-accent {
		background: linear-gradient(135deg, var(--teal) 0%, var(--warning) 100%);
		color: white;
	}

	.btn-accent:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 20px rgba(13, 124, 110, 0.3);
	}

	.btn-secondary {
		background: var(--surface-alt);
		color: var(--text);
		border: 1px solid var(--border);
	}

	.btn-secondary:hover {
		background: var(--bg);
		border-color: var(--border-hover);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.hero {
			padding: 60px 20px;
		}

		.hero h1 {
			font-size: 2.5rem;
		}

		.tagline {
			font-size: 1.1rem;
		}

		.section {
			padding: 40px 20px;
		}

		.section h2 {
			font-size: 1.5rem;
		}

		.pillars-grid {
			grid-template-columns: 1fr;
		}

		.contact-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
