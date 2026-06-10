<script lang="ts">
	import { auth } from '$lib/firebase/client';
	import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
	import { SITE_CONFIG } from '$lib/modules';

	let email = $state('');
	let password = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');
	let isSignUp = $state(false);

	async function handleGoogleSignIn() {
		try {
			isLoading = true;
			errorMessage = '';
			const provider = new GoogleAuthProvider();
			const result = await signInWithPopup(auth, provider);
			const idToken = await result.user.getIdToken();
			await establishSession(idToken);
		} catch (error: any) {
			console.error('Google Sign In Error:', error);
			errorMessage = error.message || 'Failed to sign in with Google.';
			isLoading = false;
		}
	}

	async function handleEmailAuth(e: Event) {
		e.preventDefault();
		try {
			isLoading = true;
			errorMessage = '';
			let result;
			if (isSignUp) {
				result = await createUserWithEmailAndPassword(auth, email, password);
			} else {
				result = await signInWithEmailAndPassword(auth, email, password);
			}
			const idToken = await result.user.getIdToken();
			await establishSession(idToken);
		} catch (error: any) {
			console.error('Email Auth Error:', error);
			errorMessage = error.message || 'Authentication failed.';
			isLoading = false;
		}
	}

	async function establishSession(idToken: string) {
		const res = await fetch('/api/session', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idToken })
		});
		
		if (res.ok) {
			window.location.href = '/app/route';
		} else {
			const data = await res.json();
			errorMessage = data.error || 'Failed to establish session on server.';
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>RE² — Sign In</title>
</svelte:head>

<div class="login-page">
	<!-- Left panel — editorial, deep green -->
	<div class="left-panel">
		<a href="/" class="left-logo">RE<sup>2</sup></a>
		<div class="left-body">
			<p class="left-eyebrow">For founders who do the work</p>
			<h1 class="left-headline">The only number that matters before you <em>sign</em></h1>
			<div class="left-proof">
				<div class="proof-item">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
					<span>Score any NYC address in under 10 seconds</span>
				</div>
				<div class="proof-item">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
					<span>17 live data layers — foot traffic, competitors, survival rates</span>
				</div>
				<div class="proof-item">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
					<span>Model your financials before signing the lease</span>
				</div>
			</div>
		</div>
		<p class="left-footer">resquared.io — Location Intelligence for Founders</p>
	</div>

	<!-- Right panel — form -->
	<div class="right-panel">
		<a href="/" class="back-link">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
			Back
		</a>

		<div class="form-content">
			<div class="form-header">
				<h2>Welcome back</h2>
				<p class="form-sub">Sign in to your RE² account</p>
			</div>

			<div class="auth-container">
				<button 
					class="google-btn" 
					onclick={handleGoogleSignIn} 
					disabled={isLoading}
				>
					<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)"><path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/><path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/><path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/><path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/></g></svg>
					Continue with Google
				</button>
				
				<div class="divider">
					<span>OR</span>
				</div>

				<form onsubmit={handleEmailAuth} class="email-form">
					<div class="input-group">
						<label for="email">Email</label>
						<input type="email" id="email" bind:value={email} required disabled={isLoading} />
					</div>
					
					<div class="input-group">
						<label for="password">Password</label>
						<input type="password" id="password" bind:value={password} required disabled={isLoading} />
					</div>

					{#if errorMessage}
						<div class="error-msg">{errorMessage}</div>
					{/if}

					<button type="submit" class="submit-btn" disabled={isLoading}>
						{#if isLoading}
							<div class="spinner-small"></div>
						{:else}
							{isSignUp ? 'Sign Up' : 'Sign In'}
						{/if}
					</button>

					<button type="button" class="toggle-mode-btn" onclick={() => isSignUp = !isSignUp}>
						{isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
					</button>
				</form>
			</div>
		</div>

		<p class="right-footer">Secure authentication by Firebase</p>
	</div>
</div>

<style>
	/* ── Layout ─────────────────────────────────────────────── */
	.login-page {
		display: flex;
		min-height: 100vh;
		font-family: var(--font-body);
	}

	/* ── Left panel — editorial deep green ──────────────────── */
	.left-panel {
		flex: 0 0 45%;
		background: var(--accent-deep-green);
		display: flex;
		flex-direction: column;
		padding: 48px 56px;
		position: relative;
		overflow: hidden;
	}

	.left-panel::after {
		content: '';
		position: absolute;
		bottom: -120px;
		right: -80px;
		width: 400px;
		height: 400px;
		background: rgba(255,255,255,0.03);
		border-radius: 50%;
		pointer-events: none;
	}

	.left-logo {
		font-family: var(--font-display);
		font-size: 28px;
		font-weight: 400;
		color: #ffffff;
		text-decoration: none;
		letter-spacing: -0.5px;
		margin-bottom: auto;
	}

	.left-logo sup {
		font-size: 14px;
		vertical-align: super;
	}

	.left-body {
		margin: auto 0;
		padding: 48px 0;
	}

	.left-eyebrow {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--accent);
		margin: 0 0 20px 0;
	}

	.left-headline {
		font-family: var(--font-display);
		font-size: 38px;
		font-weight: 400;
		color: #ffffff;
		line-height: 1.25;
		margin: 0 0 36px 0;
		letter-spacing: -0.5px;
	}

	.left-headline em {
		font-style: italic;
		color: var(--accent-marigold);
	}

	.left-proof {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.proof-item {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		color: rgba(255,255,255,0.75);
		font-size: 14px;
		line-height: 1.5;
	}

	.proof-item svg {
		flex-shrink: 0;
		margin-top: 2px;
		color: var(--accent);
	}

	.left-footer {
		font-size: 12px;
		color: rgba(255,255,255,0.35);
		margin: 0;
		margin-top: auto;
	}

	/* ── Right panel — form ──────────────────────────────────── */
	.right-panel {
		flex: 1;
		background: var(--bg);
		display: flex;
		flex-direction: column;
		padding: 32px 48px 40px;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--text-secondary);
		text-decoration: none;
		transition: color 0.2s;
		align-self: flex-start;
		margin-bottom: auto;
	}

	.back-link:hover {
		color: var(--text);
	}

	.form-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		max-width: 400px;
		width: 100%;
		margin: 0 auto;
		padding: 48px 0;
	}

	.form-header {
		margin-bottom: 32px;
	}

	.form-header h2 {
		font-family: var(--font-display);
		font-size: 30px;
		font-weight: 400;
		color: var(--text);
		margin: 0 0 8px 0;
		letter-spacing: -0.3px;
	}

	.form-sub {
		font-size: 14px;
		color: var(--text-secondary);
		margin: 0;
	}

	.auth-container {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.google-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		background: #ffffff;
		border: 1px solid var(--border-warm);
		color: var(--text);
		border-radius: 8px;
		padding: 12px;
		font-weight: 600;
		font-size: 15px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.google-btn:hover:not(:disabled) {
		background: #f8f9fa;
		border-color: #dadce0;
	}

	.google-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.divider {
		display: flex;
		align-items: center;
		text-align: center;
		color: var(--text-muted);
		font-size: 12px;
	}

	.divider::before, .divider::after {
		content: '';
		flex: 1;
		border-bottom: 1px solid var(--border-warm);
	}

	.divider span {
		padding: 0 10px;
	}

	.email-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.input-group label {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.input-group input {
		background: #ffffff;
		border: 1px solid var(--border-warm);
		border-radius: 8px;
		padding: 12px 14px;
		font-size: 16px;
		color: var(--text);
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	.input-group input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--sage-bg);
	}

	.submit-btn {
		background: var(--accent-deep-green);
		color: #ffffff;
		border: none;
		border-radius: 8px;
		padding: 12px;
		font-weight: 600;
		font-size: 15px;
		cursor: pointer;
		transition: background 0.2s;
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 48px;
		margin-top: 8px;
	}

	.submit-btn:hover:not(:disabled) {
		background: var(--accent-deep-green-dark);
	}

	.submit-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.toggle-mode-btn {
		background: none;
		border: none;
		color: var(--accent);
		font-size: 13px;
		cursor: pointer;
		padding: 8px;
	}

	.toggle-mode-btn:hover {
		text-decoration: underline;
	}

	.error-msg {
		color: #c0392b;
		font-size: 13px;
		background: #fdf2f2;
		border: 1px solid #f5c2c7;
		padding: 10px 12px;
		border-radius: 6px;
	}

	.spinner-small {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(255,255,255,0.3);
		border-top-color: #ffffff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.right-footer {
		font-size: 12px;
		color: var(--text-muted);
		margin: 0;
		text-align: center;
	}

	/* ── Responsive ──────────────────────────────────────────── */
	@media (max-width: 900px) {
		.left-panel { flex: 0 0 40%; padding: 40px 40px; }
		.left-headline { font-size: 30px; }
		.right-panel { padding: 32px 32px 40px; }
	}

	@media (max-width: 680px) {
		.login-page { flex-direction: column; }
		.left-panel { flex: none; padding: 32px 24px; min-height: auto; }
		.left-body { padding: 24px 0; }
		.left-headline { font-size: 26px; }
		.left-footer { display: none; }
		.right-panel { flex: 1; padding: 24px 24px 32px; }
		.form-content { padding: 24px 0; }
	}
</style>
