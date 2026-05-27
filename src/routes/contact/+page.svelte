<script lang="ts">
	import SiteNav from '$lib/components/SiteNav.svelte';
	import { page } from '$app/stores';
	import { SITE_CONFIG } from '$lib/modules';

	let form = $state({
		name: '',
		email: '',
		businessType: '',
		neighborhood: '',
		project: ''
	});

	let submitted = $state(false);

	function handleSubmit(e: Event) {
		e.preventDefault();
		submitted = true;
	}
</script>

<svelte:head>
	<title>RE² — Contact</title>
</svelte:head>

<SiteNav />

<div class="container">
	<section class="hero">
		<h1 class="headline">Get in touch</h1>
		<p class="subtext">Whether you're a founder, broker, or lender — we'd love to hear from you.</p>
	</section>

	<div class="content-grid">
		<div class="form-column">
			<form onsubmit={handleSubmit}>
				<div class="form-group">
					<label for="name">Name</label>
					<input
						id="name"
						type="text"
						placeholder="Your name"
						bind:value={form.name}
						disabled={submitted}
						required
					/>
				</div>

				<div class="form-group">
					<label for="email">Email</label>
					<input
						id="email"
						type="email"
						placeholder="your@email.com"
						bind:value={form.email}
						disabled={submitted}
						required
					/>
				</div>

				<div class="form-group">
					<label for="businessType">Business type</label>
					<select
						id="businessType"
						bind:value={form.businessType}
						disabled={submitted}
						required
					>
						<option value="">Select a type</option>
						<option value="Coffee/Café">Coffee/Café</option>
						<option value="Restaurant">Restaurant</option>
						<option value="Retail">Retail</option>
						<option value="Fitness">Fitness</option>
						<option value="Professional Services">Professional Services</option>
						<option value="Other">Other</option>
					</select>
				</div>

				<div class="form-group">
					<label for="neighborhood">Target neighborhood</label>
					<input
						id="neighborhood"
						type="text"
						placeholder="e.g., Marina District, Downtown"
						bind:value={form.neighborhood}
						disabled={submitted}
						required
					/>
				</div>

				<div class="form-group">
					<label for="project">Tell us about your project</label>
					<textarea
						id="project"
						placeholder="Share details about your vision and goals..."
						bind:value={form.project}
						disabled={submitted}
						required
					></textarea>
				</div>

				<button type="submit" class="submit-btn" disabled={submitted}>
					{submitted ? 'Thank you' : 'Send Message'}
				</button>

				{#if submitted}
					<div class="success-message">
						Thanks! We'll be in touch within 24 hours.
					</div>
				{/if}
			</form>
		</div>

		<div class="info-column">
			<div class="contact-info">
				<div class="info-block">
					<h3>General inquiries</h3>
					<a
						href="mailto:{SITE_CONFIG.emails.hello}"
						class="email-link"
						data-sveltekit-reload
					>
						{SITE_CONFIG.emails.hello}
					</a>
				</div>

				<div class="info-block">
					<h3>Enterprise & teams</h3>
					<a
						href="mailto:{SITE_CONFIG.emails.enterprise}"
						class="email-link"
						data-sveltekit-reload
					>
						{SITE_CONFIG.emails.enterprise}
					</a>
				</div>

				<div class="info-block response-time">
					<p>We respond within 24 hours</p>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	:global(body) {
		background-color: var(--white);
		color: var(--text);
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 80px 24px 60px 24px;
	}

	.hero {
		text-align: center;
		margin-bottom: 80px;
	}

	.headline {
		font-size: 48px;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 16px 0;
		line-height: 1.2;
	}

	.subtext {
		font-size: 18px;
		color: var(--text-secondary);
		margin: 0;
		max-width: 600px;
		margin: 0 auto;
	}

	.content-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 60px;
		align-items: start;
	}

	.form-column {
		background-color: var(--surface-alt);
		padding: 40px;
		border-radius: 12px;
		border: 1px solid var(--border);
	}

	.form-group {
		margin-bottom: 24px;
		display: flex;
		flex-direction: column;
	}

	label {
		font-size: 14px;
		font-weight: 500;
		color: var(--text);
		margin-bottom: 8px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	input,
	select,
	textarea {
		background-color: var(--white);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 12px 16px;
		font-size: 16px;
		color: var(--text);
		font-family: inherit;
		transition: all 200ms ease;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: var(--teal);
		box-shadow: 0 0 0 3px var(--teal-ring);
	}

	input:disabled,
	select:disabled,
	textarea:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	textarea {
		resize: vertical;
		min-height: 120px;
		font-family: inherit;
	}

	.submit-btn {
		width: 100%;
		padding: 14px 24px;
		font-size: 16px;
		font-weight: 600;
		color: white;
		background: var(--teal);
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: all 200ms ease;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.submit-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		background: #0B6B5F;
		box-shadow: 0 8px 24px rgba(13, 124, 110, 0.3);
	}

	.submit-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.submit-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.success-message {
		margin-top: 16px;
		padding: 16px;
		background-color: var(--teal-bg);
		border: 1px solid var(--teal-ring);
		border-radius: 6px;
		color: var(--teal);
		font-size: 14px;
		text-align: center;
		animation: slideIn 300ms ease;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.info-column {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
	}

	.contact-info {
		display: flex;
		flex-direction: column;
		gap: 40px;
	}

	.info-block {
		padding: 24px;
		background-color: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.info-block h3 {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 12px 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.email-link {
		font-size: 18px;
		color: var(--teal);
		text-decoration: none;
		transition: all 200ms ease;
		display: inline-block;
	}

	.email-link:hover {
		color: var(--text);
		transform: translateX(4px);
	}

	.response-time {
		background-color: var(--teal-bg);
		border-color: var(--teal-ring);
	}

	.response-time p {
		font-size: 16px;
		color: var(--teal);
		margin: 0;
	}

	@media (max-width: 768px) {
		.container {
			padding: 40px 16px;
		}

		.headline {
			font-size: 36px;
			margin-bottom: 12px;
		}

		.subtext {
			font-size: 16px;
		}

		.content-grid {
			grid-template-columns: 1fr;
			gap: 40px;
		}

		.form-column {
			padding: 24px;
		}

		.form-group {
			margin-bottom: 20px;
		}

		input,
		select,
		textarea {
			padding: 10px 12px;
			font-size: 16px;
		}

		.hero {
			margin-bottom: 60px;
		}
	}
</style>
