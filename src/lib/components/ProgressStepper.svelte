<script>
	import { page } from '$app/stores';

	let {
		lpData = null,
		hasLocationIQ = false,
		hasVisitedFinancials = false,
		hasVisitedChecklist = false
	} = $props();

	const steps = $derived.by(() => {
		const fp = lpData?.founderProfile || {};
		const fg = lpData?.financialGoals || {};
		const hasProfile = !!(fp.fullName || fp.ownerType || fp.experience);
		const hasConcept = !!(fp.businessType || lpData?.businessType);
		const hasFinancial = !!(fg.liquidCapital > 0 || fg.startupCapital > 0);
		const hasCalibration = !!(lpData?.weights && Object.keys(lpData.weights).length > 0);

		return [
			{
				label: 'Your Concept',
				icon: '🧠',
				href: '/app/vision/review',
				done: hasProfile && hasConcept && hasFinancial && hasCalibration,
				locked: false,
				matchPaths: ['/app/vision', '/app/overview']
			},
			{
				label: 'Reality Check',
				icon: '📍',
				href: '/app/location',
				done: hasLocationIQ,
				locked: false,
				matchPaths: ['/app/location', '/app/recommendations']
			},
			{
				label: 'Your Path',
				icon: '📊',
				href: hasLocationIQ ? '/app/business-plan' : '',
				done: hasVisitedFinancials,
				locked: !hasLocationIQ,
				matchPaths: ['/app/business-plan', '/app/financials', '/app/loans']
			},
			{
				label: 'Launch Kit',
				icon: '🚀',
				href: hasVisitedFinancials ? '/app/checklist' : '',
				done: hasVisitedChecklist,
				locked: !hasVisitedFinancials,
				matchPaths: ['/app/checklist', '/app/kanban', '/app/website']
			}
		];
	});

	const currentPath = $derived($page?.url?.pathname || '');

	const activeSteps = $derived(steps.map(s => ({
		...s,
		active: (s.matchPaths || []).some(p => currentPath.startsWith(p))
	})));

	const activeIndex = $derived(activeSteps.findIndex(s => s.active));
</script>

<nav class="stepper">
	{#each activeSteps as step, i}
		{#if step.locked}
			<span class="step locked" title="Complete previous steps to unlock">
				<div class="step-icon locked">
					<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
				</div>
				<span class="step-label">{step.label}</span>
			</span>
		{:else}
			<a href={step.href} class="step" class:done={step.done} class:active={step.active} class:future={i > activeIndex && activeIndex >= 0 && !step.done}>
				<div class="step-icon" class:done={step.done} class:active={step.active}>
					{#if step.done}
						<span class="check">✓</span>
					{:else}
						<span class="emoji">{step.icon}</span>
					{/if}
				</div>
				<span class="step-label">{step.label}</span>
			</a>
		{/if}
		{#if i < activeSteps.length - 1}
			<div class="connector" class:done={step.done}></div>
		{/if}
	{/each}
</nav>

<style>
	.stepper {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 12px 16px;
		margin-bottom: 1.5rem;
		background: #ffffff;
		border-radius: 12px;
		border: 1px solid #d2d2d7;
		gap: 0;
		overflow-x: auto;
	}
	.step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		text-decoration: none;
		min-width: 60px;
		transition: opacity 0.2s;
	}
	.step:hover:not(.locked) {
		opacity: 0.8;
	}
	.step.future {
		opacity: 0.4;
	}
	.step.locked {
		opacity: 0.35;
		cursor: default;
	}
	.step-icon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f5f5f7;
		border: 2px solid #d2d2d7;
		font-size: 16px;
		transition: all 0.3s;
	}
	.step-icon.done {
		background: rgba(52, 199, 89, 0.12);
		border-color: #34C759;
	}
	.step-icon.active {
		background: rgba(0, 113, 227, 0.12);
		border-color: #0071E3;
		box-shadow: 0 0 10px rgba(0, 113, 227, 0.2);
	}
	.step-icon.locked {
		background: #f3f4f6;
		border-color: #d1d5db;
		color: #d1d5db;
	}
	.check {
		color: #34C759;
		font-weight: 700;
		font-size: 14px;
	}
	.step-label {
		font-size: 10px;
		color: var(--text-secondary, #5A6578);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-weight: 600;
	}
	.step.done .step-label {
		color: #34C759;
	}
	.step.active .step-label {
		color: #0071E3;
	}
	.step.locked .step-label {
		color: #d1d5db;
	}
	.connector {
		flex: 1;
		height: 2px;
		min-width: 24px;
		max-width: 60px;
		background: var(--border, #E0E5ED);
		margin: 0 4px;
		margin-bottom: 18px;
		border-radius: 1px;
	}
	.connector.done {
		background: #34C759;
	}
</style>
