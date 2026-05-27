<script lang="ts">
	import { onMount } from 'svelte';
	import { loadLaunchPadData, hasFounderProfile } from '$lib/launchpad-store';

	interface Props {
		fitScore?: number | null;
		fitComplete?: boolean;
	}

	let { fitScore = null, fitComplete = false }: Props = $props();

	let lpData = $state<any>(null);
	let profileComplete = $state(false);

	onMount(() => {
		lpData = loadLaunchPadData();
		profileComplete = hasFounderProfile();

		// Fix 9: Also check re2_session for fit-related data from onboarding
		if (!profileComplete && !fitComplete) {
			try {
				const sessionRaw = localStorage.getItem('re2_session');
				if (sessionRaw) {
					const session = JSON.parse(sessionRaw);
					// If session has answers or smartDefaults, onboarding was completed
					if (session.personaType || session.answers && Object.keys(session.answers).length > 0 || session.smartDefaults?.confirmed) {
						profileComplete = true;
					}
				}
			} catch { /* ignore */ }
		}
	});

	// Truncate text to 2 lines (approximately 80 chars per line)
	function truncateToLines(text: string | null | undefined, lines: number = 2): string {
		if (!text) return '';
		const maxChars = lines * 80;
		return text.length > maxChars ? text.substring(0, maxChars) + '...' : text;
	}

	// Format currency values
	function formatCurrency(value: number | null | undefined): string {
		if (!value) return '—';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(value);
	}
</script>

<div class="user-profile-recap">
	<!-- Business Identity Card -->
	{#if lpData}
		<div class="card">
			<div class="card-header">Business Identity</div>
			<div class="card-content">
				{#if lpData.businessType}
					<div class="field">
						<div class="label">Business Type</div>
						<div class="value">{lpData.businessType}</div>
					</div>
				{/if}

				{#if lpData.businessName}
					<div class="field">
						<div class="label">Business Name</div>
						<div class="value">{lpData.businessName}</div>
					</div>
				{/if}

				{#if lpData.visionStatement}
					<div class="field">
						<div class="label">Concept Vision</div>
						<div class="value vision-text">{truncateToLines(lpData.visionStatement)}</div>
					</div>
				{/if}

				{#if lpData.differentiator}
					<div class="field">
						<div class="label">Differentiator</div>
						<div class="value diff-text">{truncateToLines(lpData.differentiator)}</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Financial Snapshot Card -->
	{#if lpData?.financialGoals}
		{@const fg = lpData.financialGoals}
		<div class="card">
			<div class="card-header">Financial Snapshot</div>
			<div class="card-content">
				{#if fg.monthlyRentBudget}
					<div class="field">
						<div class="label">Monthly Rent Budget</div>
						<div class="value">{formatCurrency(fg.monthlyRentBudget)}</div>
					</div>
				{/if}

				{#if fg.startupCapital}
					<div class="field">
						<div class="label">Startup Capital</div>
						<div class="value">{formatCurrency(fg.startupCapital)}</div>
					</div>
				{/if}

				{#if fg.revenueY1}
					<div class="field">
						<div class="label">Target Revenue Y1</div>
						<div class="value">{formatCurrency(fg.revenueY1)}</div>
					</div>
				{/if}

				{#if fg.avgTicket}
					<div class="field">
						<div class="label">Average Ticket Size</div>
						<div class="value">{formatCurrency(fg.avgTicket)}</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Fit IQ Status Card -->
	<div class="card fit-iq-card" class:incomplete={!profileComplete && !fitComplete}>
		<div class="card-header">Score Status</div>
		<div class="card-content fit-iq-content">
			{#if profileComplete || fitComplete}
				<div class="fit-complete">
					<div class="badge badge-complete">Complete</div>
					{#if fitScore !== null && fitScore !== undefined}
						<div class="fit-score">Score: {fitScore}</div>
					{/if}
				</div>
			{:else}
				<div class="fit-incomplete">
					<div class="badge badge-initial">Initial Score</div>
					<div class="fit-message">
						Answer 4 more questions to get your full score
					</div>
					<a href="/app/onboarding?phase=fit" class="fit-button">Complete Profile</a>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.user-profile-recap {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-height: 600px;
		overflow-y: auto;
		padding-right: 4px;
	}

	.user-profile-recap::-webkit-scrollbar {
		width: 6px;
	}

	.user-profile-recap::-webkit-scrollbar-track {
		background: transparent;
	}

	.user-profile-recap::-webkit-scrollbar-thumb {
		background: #e5e5ea;
		border-radius: 3px;
	}

	.user-profile-recap::-webkit-scrollbar-thumb:hover {
		background: #d1d1d6;
	}

	.card {
		background: white;
		border: 1px solid #e5e5ea;
		border-radius: 12px;
		padding: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.card-header {
		font-size: 12px;
		font-weight: 600;
		color: #6e6e73;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 12px;
	}

	.card-content {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.label {
		font-size: 12px;
		color: #8e8e93;
		font-weight: 500;
	}

	.value {
		font-size: 14px;
		font-weight: 600;
		color: #1d1d1f;
	}

	.vision-text,
	.diff-text {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.4;
	}

	/* Fit IQ Card Styles */
	.fit-iq-card {
		position: relative;
	}

	.fit-iq-card.incomplete {
		border-color: #0071e3;
		animation: pulsingBorder 2s ease-in-out infinite;
	}

	@keyframes pulsingBorder {
		0%,
		100% {
			border-color: #0071e3;
			box-shadow: 0 1px 3px rgba(0, 113, 227, 0.1);
		}
		50% {
			border-color: #0071e3;
			box-shadow: 0 1px 6px rgba(0, 113, 227, 0.2);
		}
	}

	.fit-iq-content {
		gap: 0;
	}

	.fit-complete {
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: flex-start;
	}

	.fit-incomplete {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: flex-start;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 4px 8px;
		border-radius: 4px;
	}

	.badge-complete {
		background: #d0f0d0;
		color: #0c6b20;
	}

	.badge-initial {
		background: #e0e9ff;
		color: #0071e3;
	}

	.fit-message {
		font-size: 13px;
		color: #6e6e73;
		line-height: 1.4;
	}

	.fit-score {
		font-size: 14px;
		font-weight: 600;
		color: #34c759;
	}

	.fit-button {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 8px 16px;
		background: #0071e3;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.fit-button:hover {
		background: #0056ba;
	}

	.fit-button:active {
		background: #0043a0;
	}
</style>