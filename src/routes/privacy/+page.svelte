<script>
	import SiteNav from '$lib/components/SiteNav.svelte';
	import { SITE_CONFIG } from '$lib/modules';
</script>

<svelte:head>
	<title>RE² — Privacy Policy</title>
</svelte:head>

<SiteNav />

<main>
	<div class="container">
		<h1>Privacy Policy</h1>
		<p class="effective-date">Effective Date: March 23, 2026 · Last Updated: March 23, 2026</p>

		<p class="intro">
			{SITE_CONFIG.company} ("we," "us," or "our") operates RE² at {SITE_CONFIG.domain}.
			This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data.
		</p>

		<section>
			<h2>1. Information We Collect</h2>

			<h3>Information You Provide</h3>
			<ul>
				<li><strong>Account information:</strong> name, email address (collected via Clerk authentication)</li>
				<li><strong>Business information:</strong> business concept, target market, financial details, location preferences</li>
				<li><strong>Uploaded documents:</strong> brochures, lease agreements, or other files you choose to upload</li>
				<li><strong>Communications:</strong> emails, feedback, or support requests you send us</li>
			</ul>

			<h3>Information Collected Automatically</h3>
			<ul>
				<li><strong>Usage data:</strong> pages visited, features used, time spent, button clicks</li>
				<li><strong>Device information:</strong> browser type, operating system, screen resolution</li>
				<li><strong>Log data:</strong> IP address, access times, referring URLs</li>
			</ul>
		</section>

		<section>
			<h2>2. How We Use Your Information</h2>
			<p>
				We use your information to: (a) provide and improve the Service; (b) generate personalized
				analyses, scores, and recommendations; (c) process your data through AI models to create
				business plans, financial projections, and loan documents; (d) communicate with you about
				your account and updates; (e) analyze usage patterns to improve the platform; (f) comply
				with legal obligations.
			</p>
		</section>

		<section>
			<h2>3. AI Processing</h2>
			<p>
				Your business data is processed by AI models (including third-party AI services such as
				Anthropic's Claude API) to generate analyses and recommendations. Data sent to AI services
				is used solely for processing your request and is subject to those services' data handling
				policies. We do not use your business data to train AI models.
			</p>
		</section>

		<section>
			<h2>4. Data Sharing</h2>
			<p class="highlight">
				<strong>We do NOT sell your personal data.</strong>
			</p>
			<p>
				We may share data with: (a) service providers who help us operate the platform (Clerk for
				authentication, Vercel for hosting, Anthropic for AI processing); (b) as required by law,
				regulation, or legal process; (c) to protect the rights, property, or safety of {SITE_CONFIG.company},
				our users, or the public.
			</p>
		</section>

		<section>
			<h2>5. Data Retention</h2>
			<p>
				We retain your account data and generated analyses for as long as your account is active.
				You may request deletion of your data at any time by contacting
				<a href="mailto:{SITE_CONFIG.emails.support}">{SITE_CONFIG.emails.support}</a>.
				We will delete your data within 30 days of a verified request, except where retention is required by law.
			</p>
		</section>

		<section>
			<h2>6. Data Security</h2>
			<p>
				We implement industry-standard security measures including encryption in transit (TLS),
				secure authentication (Clerk), and access controls. However, no system is 100% secure,
				and we cannot guarantee absolute security of your data.
			</p>
		</section>

		<section>
			<h2>7. Cookies and Tracking</h2>
			<p>
				We use essential cookies for authentication and session management. We may use analytics tools
				to understand how the Service is used. You can control cookie settings through your browser.
			</p>
		</section>

		<section>
			<h2>8. Your Rights</h2>
			<p>
				Depending on your location, you may have the right to: (a) access your personal data;
				(b) correct inaccurate data; (c) delete your data; (d) export your data in a portable format;
				(e) opt out of certain data processing. To exercise these rights, contact
				<a href="mailto:{SITE_CONFIG.emails.support}">{SITE_CONFIG.emails.support}</a>.
			</p>
		</section>

		<section>
			<h2>9. California Residents (CCPA)</h2>
			<p>
				If you are a California resident, you have the right to: know what personal information we collect;
				request deletion of your data; opt out of the sale of personal information (we do not sell your data);
				and not be discriminated against for exercising these rights.
			</p>
		</section>

		<section>
			<h2>10. Children's Privacy</h2>
			<p>
				The Service is not intended for users under 18 years of age. We do not knowingly collect
				data from children. If you believe we have collected data from a minor, contact us immediately.
			</p>
		</section>

		<section>
			<h2>11. Changes to This Policy</h2>
			<p>
				We may update this Privacy Policy from time to time. We will notify you of material changes
				via email or in-app notification. Your continued use of the Service after changes constitutes acceptance.
			</p>
		</section>

		<section>
			<h2>12. Contact Us</h2>
			<p>
				For privacy-related questions or requests:
				<a href="mailto:{SITE_CONFIG.emails.support}">{SITE_CONFIG.emails.support}</a>
			</p>
		</section>
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
		max-width: 800px;
	}

	h1 {
		font-size: 2.5rem;
		font-weight: 700;
		margin-bottom: 12px;
		color: var(--teal);
	}

	.effective-date {
		color: var(--text-secondary);
		margin-bottom: 20px;
		font-size: 0.95rem;
	}

	.intro {
		font-size: 1.05rem;
		line-height: 1.7;
		margin-bottom: 40px;
		color: var(--text);
	}

	section {
		margin-bottom: 40px;
	}

	h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--teal);
		margin-bottom: 16px;
		margin-top: 32px;
	}

	h3 {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 12px;
		margin-top: 20px;
	}

	p {
		line-height: 1.7;
		margin-bottom: 16px;
		font-size: 1rem;
	}

	ul {
		margin-left: 20px;
		margin-bottom: 16px;
	}

	li {
		margin-bottom: 10px;
		line-height: 1.6;
	}

	a {
		color: var(--teal);
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition: border-bottom-color 0.2s;
	}

	a:hover {
		border-bottom-color: var(--teal);
	}

	.highlight {
		background-color: var(--teal-bg);
		border-left: 4px solid var(--teal);
		padding: 16px;
		margin: 24px 0;
		border-radius: 4px;
	}
</style>
