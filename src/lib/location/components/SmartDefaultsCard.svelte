<script>
	/**
	 * SmartDefaultsCard — Financial estimates card rendered inside a chat bubble
	 *
	 * Shows the AI-extracted financial defaults in a compact card format
	 * that lives within the chat thread. Includes confirm/adjust buttons.
	 */

	let { estimates, personaLabel = '', onConfirm = null } = $props();
</script>

{#if estimates}
	<div class="defaults-bubble">
		<div class="defaults-header">
			<span class="defaults-title">Your Business Estimates</span>
			{#if personaLabel}
				<span class="defaults-persona">{personaLabel}</span>
			{/if}
		</div>

		<div class="defaults-metrics">
			<div class="metric-row">
				<span class="metric-label">Avg. ticket</span>
				<span class="metric-value">${estimates.avgTicket}</span>
			</div>
			<div class="metric-row">
				<span class="metric-label">Daily customers</span>
				<span class="metric-value">~{estimates.dailyCustomers}</span>
			</div>
			{#if estimates.monthlyRevenue}
				<div class="metric-row">
					<span class="metric-label">Monthly revenue</span>
					<span class="metric-value">
						${estimates.monthlyRevenue[0]?.toLocaleString()}–${estimates.monthlyRevenue[1]?.toLocaleString()}
					</span>
				</div>
			{/if}
			{#if estimates.maxRent}
				<div class="metric-row">
					<span class="metric-label">Max healthy rent</span>
					<span class="metric-value">~${estimates.maxRent?.toLocaleString()}/mo</span>
				</div>
			{/if}
			{#if estimates.idealSqft}
				<div class="metric-row">
					<span class="metric-label">Ideal space</span>
					<span class="metric-value">{estimates.idealSqft[0]?.toLocaleString()}–{estimates.idealSqft[1]?.toLocaleString()} sqft</span>
				</div>
			{/if}
		</div>

		{#if onConfirm}
			<div class="defaults-actions">
				<button class="confirm-btn" onclick={() => onConfirm('confirmed')}>
					Looks right
				</button>
				<button class="adjust-btn" onclick={() => onConfirm('unsure')}>
					Use as starting point
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.defaults-bubble {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-top: 8px;
	}

	.defaults-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.defaults-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--text);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.defaults-persona {
		font-size: 11px;
		padding: 3px 10px;
		background: var(--teal-bg);
		color: var(--teal);
		border-radius: 12px;
		font-weight: 600;
	}

	.defaults-metrics {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.metric-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 0;
		border-bottom: 1px solid var(--border-subtle);
	}

	.metric-row:last-child {
		border-bottom: none;
	}

	.metric-label {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.metric-value {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
	}

	.defaults-actions {
		display: flex;
		gap: 8px;
		margin-top: 14px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	.confirm-btn {
		flex: 1;
		padding: 8px 12px;
		background: var(--teal);
		border: none;
		border-radius: 8px;
		color: white;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
	}

	.confirm-btn:hover {
		background: var(--teal-bright);
	}

	.adjust-btn {
		flex: 1;
		padding: 8px 12px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--text-secondary);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
	}

	.adjust-btn:hover {
		border-color: var(--border-hover);
		color: var(--text);
	}
</style>
