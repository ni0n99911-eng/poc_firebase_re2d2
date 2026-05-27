<script>
	// Redirect page - SBA Loan functionality moved to Location Intel
</script>

<svelte:head><title>RE² — SBA Loans</title></svelte:head>


<div class="container">
	<div class="redirect-notice">
		<div class="notice-icon">→</div>
		<h1>This page has moved!</h1>
		<p class="notice-description">The SBA 7(a) Application Wizard and Loan Engine tools have been consolidated into the Location Intel tool for better integration with your location analysis.</p>

		<div class="notice-details">
			<h2>What changed?</h2>
			<ul>
				<li><strong>SBA 7(a) Wizard</strong> → Location Intel, Loan Engine tab</li>
				<li><strong>Loan Readiness</strong> → Location Intel, Loan Engine tab</li>
				<li><strong>Financial Documentation</strong> → Still available in Business Docs Center</li>
			</ul>
		</div>

		<div class="notice-actions">
			<a href="/app/location" class="btn-primary">Go to Location Intel</a>
			<a href="/app/business-plan" class="btn-secondary">Back to Financials Dashboard</a>
		</div>
	</div>
</div>

<style>
	.container {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
		background-color: var(--bg);
		color: var(--text);
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.redirect-notice {
		background: var(--surface);
		border: 2px solid var(--border);
		border-radius: 12px;
		padding: 3rem;
		text-align: center;
	}

	.notice-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		display: block;
	}

	h1 {
		font-size: 2rem;
		font-weight: 700;
		margin: 0 0 1rem 0;
		color: var(--text-bright);
	}

	.notice-description {
		font-size: 1.1rem;
		color: var(--text-dim);
		margin-bottom: 2rem;
		line-height: 1.6;
	}

	.notice-details {
		background: var(--surface2);
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 2rem;
		text-align: left;
	}

	.notice-details h2 {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
		color: var(--text-bright);
	}

	.notice-details ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.notice-details li {
		padding: 0.5rem 0;
		color: var(--text);
		font-size: 0.95rem;
		border-bottom: 1px solid var(--border);
	}

	.notice-details li:last-child {
		border-bottom: none;
	}

	.notice-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.3s ease;
		display: inline-block;
		border: none;
		cursor: pointer;
		font-size: 0.95rem;
	}

	.btn-primary {
		background: linear-gradient(135deg, var(--coffee), #ff7b54);
		color: white;
	}

	.btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(255, 159, 67, 0.3);
	}

	.btn-secondary {
		background: var(--surface2);
		color: var(--text);
		border: 1px solid var(--border);
	}

	.btn-secondary:hover {
		border-color: var(--coffee);
		color: var(--coffee);
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		.redirect-notice {
			padding: 2rem;
		}

		h1 {
			font-size: 1.5rem;
		}

		.notice-actions {
			flex-direction: column;
		}

		.btn-primary,
		.btn-secondary {
			width: 100%;
		}
	}
</style>
