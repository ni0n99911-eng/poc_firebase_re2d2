<script lang="ts">
	import { onMount } from 'svelte';
	import { loadLaunchPadData, saveLaunchPadData } from '$lib/launchpad-store';

	interface LaunchTask {
		id: string;
		name: string;
		details: string;
		cost: string;
		time: string;
		link: string | null;
	}

	interface LaunchPhase {
		id: string;
		name: string;
		subtitle: string | null;
		tasks: LaunchTask[];
	}

	type TaskState = 'not_started' | 'in_progress' | 'complete';

	let launchData: Record<string, any> | null = $state(null);
	let expandedPhases: Record<string, boolean> = $state({
		phase1: true,
		phase2: false,
		phase3: false,
		phase4: false,
		phase5: false
	});

	const phases: LaunchPhase[] = [
		{
			id: 'phase1',
			name: 'Foundation',
			subtitle: 'Before You Sign Anything',
			tasks: [
				{
					id: 'p1_entity',
					name: 'Business entity formation',
					details: 'LLC/Corp formation, filing & registered agent setup',
					cost: '$200-800',
					time: '1-2 weeks',
					link: null
				},
				{
					id: 'p1_ein',
					name: 'EIN',
					details: 'Employer Identification Number from IRS',
					cost: 'Free',
					time: 'Instant',
					link: 'https://www.irs.gov/ein'
				},
				{
					id: 'p1_checking',
					name: 'Business checking account',
					details: 'Chase, Mercury, Relay, or similar options',
					cost: '$0-20/mo',
					time: '1-2 days',
					link: null
				},
				{
					id: 'p1_credit',
					name: 'Business credit card',
					details: 'Chase Ink, Capital One Spark, Brex options',
					cost: 'Varies',
					time: '1 week',
					link: null
				},
				{
					id: 'p1_insurance',
					name: 'Business insurance quote',
					details: 'General liability, property, workers comp. NEXT, Thimble, Hiscox',
					cost: '$300-800/yr',
					time: '2-3 days',
					link: null
				},
				{
					id: 'p1_agent',
					name: 'Registered agent',
					details: 'Yourself (free), Northwest ($39/yr), or LegalZoom ($299/yr)',
					cost: '$0-299/yr',
					time: 'Instant',
					link: null
				}
			]
		},
		{
			id: 'phase2',
			name: 'Location & Lease',
			subtitle: 'RE² Core',
			tasks: [
				{
					id: 'p2_location',
					name: 'Run RE² location score',
					details: 'Analyze location metrics and profitability potential',
					cost: 'Included',
					time: '30 min',
					link: '/app/location'
				},
				{
					id: 'p2_financials',
					name: 'Review financial projections',
					details: 'Cash flow, P&L, and break-even analysis',
					cost: 'Included',
					time: '1 hour',
					link: '/app/financials'
				},
				{
					id: 'p2_loans',
					name: 'Generate loan readiness package',
					details: 'Prepare documents for lender submission',
					cost: 'Included',
					time: '1-2 hours',
					link: '/app/loans'
				},
				{
					id: 'p2_lease',
					name: 'Lease review checklist',
					details: 'Base rent, CAM charges, PG scope, exclusivity, kick-out, renewal, TI allowance',
					cost: 'Attorney: $500-2000',
					time: '1 week',
					link: null
				}
			]
		},
		{
			id: 'phase3',
			name: 'Funding',
			subtitle: null,
			tasks: [
				{
					id: 'p3_credit',
					name: 'Complete credit profile',
					details: 'Link to Module 2: Business overview & credit assessment',
					cost: 'Included',
					time: '30 min',
					link: '/app/vision/founder'
				},
				{
					id: 'p3_capital',
					name: 'Capital structure plan',
					details: 'Debt vs. equity, loan terms, investment strategy',
					cost: 'Included',
					time: '1-2 hours',
					link: '/app/loans'
				},
				{
					id: 'p3_apply',
					name: 'Apply to matched lenders',
					details: 'Submit applications to pre-qualified lending partners',
					cost: 'No fees',
					time: '2-4 weeks',
					link: null
				},
				{
					id: 'p3_grants',
					name: 'Apply to grants',
					details: 'MWBE certification, SBS grants, CDFI programs',
					cost: 'Free (grants)',
					time: '2-6 weeks',
					link: null
				}
			]
		},
		{
			id: 'phase4',
			name: 'Build-Out & Pre-Launch',
			subtitle: null,
			tasks: [
				{
					id: 'p4_permits',
					name: 'Permits & licenses (NYC)',
					details: 'DOB, DOH, SLA, DCA, COO permits and licenses',
					cost: '$2000-5000',
					time: '4-8 weeks',
					link: null
				},
				{
					id: 'p4_pos',
					name: 'POS system',
					details: 'Square, Toast, Clover, or similar comparison & setup',
					cost: '$500-2000',
					time: '1-2 weeks',
					link: null
				},
				{
					id: 'p4_payroll',
					name: 'Payroll system',
					details: 'Gusto, ADP Run, Homebase setup & testing',
					cost: '$100-300/mo',
					time: '1 week',
					link: null
				},
				{
					id: 'p4_accounting',
					name: 'Accounting software',
					details: 'QuickBooks, Wave, or Xero integration',
					cost: '$0-300/mo',
					time: '1-2 weeks',
					link: null
				}
			]
		},
		{
			id: 'phase5',
			name: 'Launch & First 90 Days',
			subtitle: null,
			tasks: [
				{
					id: 'p5_soft',
					name: 'Soft opening checklist',
					details: 'Staff training, systems testing, supply chains live',
					cost: 'Labor',
					time: '1-2 weeks',
					link: null
				},
				{
					id: 'p5_marketing',
					name: 'Grand opening marketing plan',
					details: 'Social media, local PR, in-store promotions',
					cost: '$2000-5000',
					time: '2-4 weeks',
					link: null
				},
				{
					id: 'p5_tracking',
					name: 'First 90-day financial tracking',
					details: 'Weekly P&L, cash flow, labor %, daily sales review',
					cost: 'Included',
					time: 'Ongoing',
					link: null
				},
				{
					id: 'p5_health',
					name: 'Monthly RE² health check',
					details: 'Re-score metrics at 30/60/90 days & monthly',
					cost: 'Included',
					time: '30 min/month',
					link: null
				}
			]
		}
	];

	onMount(async () => {
		const data = await loadLaunchPadData();
		launchData = data || {
			launchPackProgress: {}
		};
	});

	function getTaskState(taskId: string): TaskState {
		if (!launchData) return 'not_started';
		return launchData.launchPackProgress?.[taskId] || 'not_started';
	}

	function setTaskState(taskId: string) {
		if (!launchData) return;

		const currentState = getTaskState(taskId);
		let nextState: TaskState;

		if (currentState === 'not_started') {
			nextState = 'in_progress';
		} else if (currentState === 'in_progress') {
			nextState = 'complete';
		} else {
			nextState = 'not_started';
		}

		launchData.launchPackProgress[taskId] = nextState;
		saveLaunchPadData(launchData);
	}

	function togglePhase(phaseId: string) {
		expandedPhases[phaseId] = !expandedPhases[phaseId];
	}

	function isPhase1Complete(): boolean {
		if (!launchData) return false;
		const p1Tasks = phases[0].tasks;
		return p1Tasks.every(task => getTaskState(task.id) === 'complete');
	}

	function canAccessPhase(phaseIndex: number): boolean {
		if (phaseIndex === 0) return true;
		return isPhase1Complete();
	}

	function getNextIncompleteTask(): { phase: LaunchPhase; task: LaunchTask } | null {
		for (const phase of phases) {
			for (const task of phase.tasks) {
				if (getTaskState(task.id) !== 'complete') {
					return { phase, task };
				}
			}
		}
		return null;
	}

	function countCompleteTasks(): number {
		if (!launchData) return 0;
		let count = 0;
		for (const phase of phases) {
			for (const task of phase.tasks) {
				if (getTaskState(task.id) === 'complete') count++;
			}
		}
		return count;
	}

	function getTotalTasks(): number {
		let total = 0;
		for (const phase of phases) {
			total += phase.tasks.length;
		}
		return total;
	}

	function getPhaseCompletionCount(phase: LaunchPhase): number {
		let count = 0;
		for (const task of phase.tasks) {
			if (getTaskState(task.id) === 'complete') count++;
		}
		return count;
	}

	function getStateIcon(state: TaskState): string {
		if (state === 'complete') return '✓';
		if (state === 'in_progress') return '◐';
		return '○';
	}

	function getStateColor(state: TaskState): string {
		if (state === 'complete') return '#00ff88';
		if (state === 'in_progress') return '#ffaa00';
		return '#666';
	}
</script>

<svelte:head>
	<title>RE² — Launch</title>
</svelte:head>

<div class="container">
	<!-- Progress Bar -->
	{#if launchData}
		<div class="progress-section">
			<div class="progress-text">
				<span class="progress-label">Overall Progress</span>
				<span class="progress-count">{countCompleteTasks()} of {getTotalTasks()} tasks complete</span>
			</div>
			<div class="progress-bar">
				<div
					class="progress-fill"
					style="width: {(countCompleteTasks() / getTotalTasks()) * 100}%"
				></div>
			</div>
		</div>

		<!-- Next Step Callout -->
		{#if getNextIncompleteTask()}
			{@const nextItem = getNextIncompleteTask()}
			<div class="next-step">
				<div class="next-step-icon">→</div>
				<div class="next-step-content">
					<div class="next-step-label">Your Next Step</div>
					<div class="next-step-task">
						{nextItem.phase.name}: <strong>{nextItem.task.name}</strong>
					</div>
				</div>
			</div>
		{:else}
			<div class="next-step complete">
				<div class="next-step-icon">✓</div>
				<div class="next-step-content">
					<div class="next-step-label">Launch Complete</div>
					<div class="next-step-task">All tasks completed! Time to launch.</div>
				</div>
			</div>
		{/if}

		<!-- Phases -->
		<div class="phases">
			{#each phases as phase, phaseIndex}
				<div class="phase">
					<button
						class="phase-header"
						onclick={() => togglePhase(phase.id)}
						style="opacity: {canAccessPhase(phaseIndex) ? 1 : 0.5}"
						disabled={!canAccessPhase(phaseIndex)}
					>
						<div class="phase-header-left">
							<span class="phase-toggle">{expandedPhases[phase.id] ? '▼' : '▶'}</span>
							<div class="phase-title">
								<div class="phase-name">
									Phase {phaseIndex + 1}: {phase.name}
									{#if phase.subtitle}
										<span class="phase-subtitle">{phase.subtitle}</span>
									{/if}
								</div>
							</div>
						</div>
						<div class="phase-progress">
							{getPhaseCompletionCount(phase)} / {phase.tasks.length}
						</div>
					</button>

					{#if expandedPhases[phase.id]}
						<div class="phase-content">
							{#if !canAccessPhase(phaseIndex)}
								<div class="phase-locked">
									<div class="locked-icon">🔒</div>
									<div class="locked-text">
										Complete Phase 1 (Business Entity Formation) to unlock this phase
									</div>
								</div>
							{:else}
								<div class="tasks">
									{#each phase.tasks as task}
										{@const state = getTaskState(task.id)}
										<div class="task" data-state={state}>
											<button
												class="task-checkbox"
												onclick={() => setTaskState(task.id)}
												style="color: {getStateColor(state)}"
												aria-label="Toggle task state"
											>
												{getStateIcon(state)}
											</button>
											<div class="task-content">
												<div class="task-name">{task.name}</div>
												<div class="task-details">{task.details}</div>
											</div>
											<div class="task-meta">
												<div class="task-cost">{task.cost}</div>
												<div class="task-time">{task.time}</div>
												{#if task.link}
													<a href={task.link} class="task-link" target="_self">
														→
													</a>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div class="loading">Loading launch pack...</div>
	{/if}
</div>

<style>
	.container {
		max-width: 1000px;
		margin: 0 auto;
		padding: 2rem;
		background: var(--surface);
		color: var(--text);
		font-family: system-ui, -apple-system, sans-serif;
		min-height: 100vh;
	}

	/* Progress Bar */
	.progress-section {
		margin-bottom: 2rem;
	}

	.progress-text {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		font-size: 0.9rem;
	}

	.progress-label {
		font-weight: 600;
		color: var(--text-secondary);
	}

	.progress-count {
		color: var(--success);
		font-weight: 600;
	}

	.progress-bar {
		height: 8px;
		background: var(--surface-alt);
		border-radius: 4px;
		overflow: hidden;
		border: 1px solid var(--border);
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--success) 0%, #30B050 100%);
		transition: width 0.3s ease;
	}

	/* Next Step Callout */
	.next-step {
		display: flex;
		gap: 1rem;
		padding: 1.25rem;
		background: var(--surface-alt);
		border-left: 4px solid var(--success);
		border-radius: 4px;
		margin-bottom: 2rem;
		border: 1px solid var(--border);
		border-left: 4px solid var(--success);
	}

	.next-step.complete {
		border-left-color: var(--success);
	}

	.next-step-icon {
		font-size: 1.5rem;
		font-weight: bold;
		color: var(--success);
		min-width: 2rem;
		text-align: center;
	}

	.next-step-content {
		flex: 1;
	}

	.next-step-label {
		font-size: 0.8rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.25rem;
	}

	.next-step-task {
		font-size: 1rem;
		color: var(--text);
		line-height: 1.4;
	}

	/* Phases */
	.phases {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.phase {
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
		background: var(--surface);
	}

	.phase-header {
		width: 100%;
		padding: 1.25rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--surface-alt);
		border: none;
		color: var(--text);
		cursor: pointer;
		transition: background 0.2s ease;
		font-family: inherit;
		font-size: 1rem;
		text-align: left;
		border-bottom: 1px solid var(--border);
	}

	.phase-header:hover:not(:disabled) {
		background: var(--bg);
	}

	.phase-header:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.phase-header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex: 1;
	}

	.phase-toggle {
		color: var(--text-tertiary);
		font-size: 0.8rem;
		min-width: 1rem;
	}

	.phase-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.phase-name {
		font-weight: 600;
		font-size: 1rem;
	}

	.phase-subtitle {
		color: var(--text-secondary);
		font-weight: 400;
		font-size: 0.9rem;
		margin-left: 0.5rem;
	}

	.phase-progress {
		color: var(--success);
		font-weight: 600;
		font-size: 0.9rem;
		white-space: nowrap;
	}

	.phase-content {
		padding: 0;
		animation: slideDown 0.2s ease;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			max-height: 0;
		}
		to {
			opacity: 1;
			max-height: 2000px;
		}
	}

	/* Phase Locked */
	.phase-locked {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		color: var(--text-secondary);
		gap: 0.5rem;
	}

	.locked-icon {
		font-size: 2rem;
	}

	.locked-text {
		font-size: 0.9rem;
		text-align: center;
	}

	/* Tasks */
	.tasks {
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--border);
	}

	.task {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1.25rem;
		border-bottom: 1px solid var(--border);
		transition: background 0.2s ease;
	}

	.task:last-child {
		border-bottom: none;
	}

	.task[data-state='complete'] {
		background: var(--green-soft);
	}

	.task[data-state='in_progress'] {
		background: var(--amber-soft);
	}

	.task-checkbox {
		background: none;
		border: none;
		color: var(--text-tertiary);
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		min-width: 2rem;
		text-align: center;
		transition: color 0.2s ease;
		margin-top: 0.1rem;
	}

	.task-checkbox:hover {
		opacity: 0.8;
	}

	.task-content {
		flex: 1;
	}

	.task-name {
		font-weight: 600;
		font-size: 1rem;
		margin-bottom: 0.25rem;
		color: var(--text);
	}

	.task-details {
		font-size: 0.875rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.task-meta {
		display: flex;
		align-items: center;
		gap: 1rem;
		white-space: nowrap;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.task-cost,
	.task-time {
		font-size: 0.8rem;
		color: var(--text-secondary);
		min-width: fit-content;
	}

	.task-cost {
		color: var(--danger);
	}

	.task-time {
		color: var(--accent);
	}

	.task-link {
		color: var(--success);
		text-decoration: none;
		font-weight: 600;
		font-size: 1.2rem;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		transition: opacity 0.2s ease;
	}

	.task-link:hover {
		opacity: 0.7;
	}

	/* Loading */
	.loading {
		text-align: center;
		padding: 4rem 2rem;
		color: var(--text-secondary);
		font-size: 1.1rem;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		.phase-header {
			padding: 1rem;
		}

		.task {
			flex-direction: column;
			gap: 0.75rem;
		}

		.task-meta {
			width: 100%;
			justify-content: flex-start;
		}

		.next-step {
			flex-direction: column;
		}
	}
</style>
