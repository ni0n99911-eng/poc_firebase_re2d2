<script lang="ts">
	import SiteNav from '$lib/components/SiteNav.svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	function navigateToDemo(path: string) {
		goto(path, { replaceState: false });
	}

	function navigateToLogin() {
		goto('/login', { replaceState: false });
	}
</script>

<svelte:head>
	<title>RE² — Interactive Demo</title>
</svelte:head>

<SiteNav />

<main>
	<div class="container">
		<div class="hero">
			<h1>See RE² in action</h1>
			<p class="subtext">
				Explore a complete location analysis using sample data from a wellness café concept in
				Chelsea.
			</p>
		</div>

		<div class="cards-grid">
			<div class="card">
				<h2>Launch Pad</h2>
				<p>Define your business vision, budget, and priorities</p>
				<button
					class="cta-button"
					onclick={() => navigateToDemo('/app/vision/founder')}
					data-sveltekit-reload>
					Explore Launch Pad
				</button>
			</div>

			<div class="card">
				<h2>Location Intelligence</h2>
				<p>Get your score across 19 data sources</p>
				<button
					class="cta-button"
					onclick={() => navigateToDemo('/app/location')}
					data-sveltekit-reload>
					View your score
				</button>
			</div>

			<div class="card">
				<h2>Loan Readiness</h2>
				<p>Generate a lender-ready funding package</p>
				<button
					class="cta-button"
					onclick={() => navigateToDemo('/app/loans')}
					data-sveltekit-reload>
					See Loan Readiness
				</button>
			</div>
		</div>

		<div class="cta-section">
			<h2>Ready to get your own score?</h2>
			<button class="primary-button" onclick={navigateToLogin} data-sveltekit-reload>
				Sign Up or Log In
			</button>
		</div>

		<div class="note">
			<p>This demo uses sample business data. Sign up to analyze your own business with personalized results.</p>
		</div>
	</div>
</main>

<style scoped>
	:global(body) {
		background-color: var(--white);
		color: var(--text);
	}

	main {
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: 80px 20px 60px 20px;
		min-height: 100vh;
	}

	.container {
		width: 100%;
		max-width: 1000px;
	}

	.hero {
		text-align: center;
		margin-bottom: 60px;
	}

	h1 {
		font-size: 2.8rem;
		font-weight: 700;
		color: var(--teal);
		margin-bottom: 16px;
	}

	.subtext {
		font-size: 1.2rem;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 24px;
		margin-bottom: 60px;
	}

	.card {
		background-color: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 32px 24px;
		display: flex;
		flex-direction: column;
		transition: all 0.3s ease;
	}

	.card:hover {
		background-color: var(--surface);
		border-color: var(--teal);
		transform: translateY(-4px);
	}

	.card h2 {
		font-size: 1.4rem;
		font-weight: 600;
		color: var(--teal);
		margin-bottom: 12px;
	}

	.card p {
		flex: 1;
		color: var(--text-secondary);
		margin-bottom: 24px;
		line-height: 1.6;
		font-size: 0.95rem;
	}

	.cta-button {
		align-self: flex-start;
		background-color: transparent;
		color: var(--teal);
		border: 1px solid var(--teal);
		padding: 10px 20px;
		border-radius: 4px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.cta-button:hover {
		background-color: var(--teal-bg);
		border-color: var(--teal);
	}

	.cta-button:active {
		background-color: var(--teal-ring);
	}

	.cta-section {
		text-align: center;
		background-color: var(--teal-bg);
		border: 1px solid var(--teal-ring);
		border-radius: 8px;
		padding: 48px 32px;
		margin-bottom: 40px;
	}

	.cta-section h2 {
		font-size: 1.8rem;
		font-weight: 700;
		color: var(--teal);
		margin-bottom: 24px;
	}

	.primary-button {
		background-color: var(--teal);
		color: #ffffff;
		border: none;
		padding: 14px 32px;
		border-radius: 4px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.primary-button:hover {
		background-color: #0B6B5F;
		box-shadow: 0 8px 16px rgba(13, 124, 110, 0.2);
	}

	.primary-button:active {
		background-color: #065654;
	}

	.note {
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.9rem;
		line-height: 1.6;
	}

	@media (max-width: 768px) {
		.container {
			max-width: 100%;
		}

		h1 {
			font-size: 2rem;
		}

		.subtext {
			font-size: 1rem;
		}

		.cards-grid {
			grid-template-columns: 1fr;
			gap: 16px;
		}

		.cta-section {
			padding: 32px 24px;
		}

		.cta-section h2 {
			font-size: 1.4rem;
		}
	}
</style>
