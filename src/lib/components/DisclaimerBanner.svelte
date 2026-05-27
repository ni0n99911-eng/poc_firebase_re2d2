<script lang="ts">
	let dismissed = $state(false);
	let expanded = $state(false);
</script>

{#if !dismissed}
<div class="disclaimer-banner">
	<span class="disclaimer-icon">&#9888;&#65039;</span>
	<span class="disclaimer-text-container">
		{#if expanded}
			<span class="disclaimer-text expanded">
				<strong>For informational purposes only.</strong>
				RE² does not provide financial, legal, or real estate advice. AI-generated analyses may contain errors.
				Consult qualified professionals before making business decisions.
				<a href="/terms">See full Terms</a>.
			</span>
		{:else}
			<button class="disclaimer-toggle" onclick={() => expanded = !expanded}>
				AI-generated analysis. Not financial advice. <span class="see-more">See full terms</span>
			</button>
		{/if}
	</span>
	<button onclick={() => dismissed = true} class="dismiss-btn">&#10005;</button>
</div>
{/if}

<style>
	.disclaimer-banner {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		background: rgba(255, 149, 0, 0.08);
		border: 1px solid rgba(255, 149, 0, 0.12);
		border-radius: 8px;
		margin-bottom: 16px;
		font-size: 13px;
		color: var(--warning);
	}

	.disclaimer-icon {
		font-size: 16px;
		flex-shrink: 0;
	}

	.disclaimer-text-container {
		flex: 1;
	}

	.disclaimer-toggle {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--warning);
		font-size: 13px;
		padding: 0;
		text-align: left;
		line-height: 1.5;
		font-family: inherit;
	}

	.disclaimer-toggle:hover {
		opacity: 0.8;
	}

	.see-more {
		text-decoration: underline;
		color: var(--accent);
		margin-left: 4px;
	}

	.disclaimer-text {
		flex: 1;
		line-height: 1.5;
		display: block;
	}

	.disclaimer-text.expanded {
		display: block;
	}

	.disclaimer-text strong {
		color: var(--warning);
	}

	.disclaimer-text a {
		color: var(--accent);
		text-decoration: none;
	}

	.disclaimer-text a:hover {
		text-decoration: underline;
	}

	.dismiss-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		color: var(--warning);
		margin-left: auto;
		padding: 4px;
		line-height: 1;
		opacity: 0.7;
		transition: opacity 0.2s;
		flex-shrink: 0;
	}

	.dismiss-btn:hover {
		opacity: 1;
	}
</style>
