<script>
	import { SITE_CONFIG } from '$lib/modules';
</script>

<svelte:head><title>RE² — Pending Approval</title></svelte:head>

<div class="pending-container">
	<div class="pending-card">
		<div class="brand">RE²</div>
		<div class="pending-icon">
			<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
				<circle cx="32" cy="32" r="30" stroke="#0D7C6E" stroke-width="2" stroke-dasharray="6 4" opacity="0.3"/>
				<circle cx="32" cy="32" r="22" stroke="#0D7C6E" stroke-width="2" opacity="0.15"/>
				<text x="32" y="38" text-anchor="middle" font-size="28">⏳</text>
			</svg>
		</div>
		<h1>You're Almost In</h1>
		<p>Your account has been created and our team has been notified. We typically review new accounts within a few hours.</p>

		<div class="steps">
			<div class="step done">
				<span class="step-check">✓</span>
				<span>Account created</span>
			</div>
			<div class="step done">
				<span class="step-check">✓</span>
				<span>Admin team notified</span>
			</div>
			<div class="step active">
				<span class="step-dot"></span>
				<span>Approval in progress</span>
			</div>
			<div class="step future">
				<span class="step-circle"></span>
				<span>Access granted</span>
			</div>
		</div>

		<p class="hint">You'll receive an email at your registered address once your account is approved.</p>

		<div class="actions">
			<a href="/login" class="back-link">← Back to Login</a>
			<a href="mailto:{SITE_CONFIG.emails.hello}" class="contact-link">Questions? Contact Us</a>
		</div>
	</div>
</div>

<style>
	.pending-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: var(--bg);
		padding: 20px;
	}

	.pending-card {
		width: 100%;
		max-width: 480px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 48px 40px;
		text-align: center;
	}

	.brand {
		font-size: 14px;
		font-weight: 800;
		letter-spacing: 2px;
		color: var(--teal);
		margin-bottom: 24px;
		opacity: 0.6;
	}

	.pending-icon {
		margin-bottom: 20px;
	}

	h1 {
		font-size: 26px;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 12px 0;
	}

	p {
		color: var(--text-secondary);
		font-size: 14px;
		margin: 0 0 24px 0;
		line-height: 1.6;
	}

	.steps {
		display: flex;
		flex-direction: column;
		gap: 12px;
		text-align: left;
		margin: 24px 0;
		padding: 20px 24px;
		background: var(--surface-alt);
		border-radius: 10px;
		border: 1px solid var(--border);
	}

	.step {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 13px;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.step.done {
		color: var(--green);
	}

	.step.active {
		color: var(--teal);
	}

	.step-check {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--green-soft);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		flex-shrink: 0;
	}

	.step-dot {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--teal-bg);
		border: 2px solid var(--teal);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		animation: pulse 2s ease-in-out infinite;
	}

	.step-circle {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2px solid var(--border);
		flex-shrink: 0;
	}

	@keyframes pulse {
		0%, 100% { box-shadow: 0 0 0 0 var(--teal-ring); }
		50% { box-shadow: 0 0 0 6px transparent; }
	}

	.hint {
		font-size: 12px;
		color: var(--text-secondary);
		margin: 0;
	}

	.actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 28px;
		padding-top: 20px;
		border-top: 1px solid var(--border);
	}

	.back-link, .contact-link {
		font-size: 13px;
		text-decoration: none;
		font-weight: 500;
	}

	.back-link {
		color: var(--text-secondary);
	}

	.back-link:hover {
		color: var(--text);
	}

	.contact-link {
		color: var(--teal);
	}

	.contact-link:hover {
		text-decoration: underline;
	}
</style>
