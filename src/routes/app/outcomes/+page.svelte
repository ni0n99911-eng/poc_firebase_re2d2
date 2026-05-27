<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { authedFetch } from '$lib/authed-fetch';

	// ── State ──
	let locations = $state<ScoredLocation[]>([]);
	let loading = $state(true);
	let error = $state('');
	let submitting = $state(false);
	let showForm = $state(false);
	let formSuccess = $state('');

	// ── Form state (pre-filled from URL params for email click-throughs) ──
	let formLocationId = $state('');
	let formCheckIn = $state(1);
	let formVerdict = $state<string>('');
	let formMonthsOpen = $state<number | null>(null);
	let formRevenue = $state('');
	let formSatisfaction = $state<number | null>(null);
	let formNotes = $state('');
	let formSurprise = $state('');

	interface ScoredLocation {
		id: string;
		address: string;
		lat: number;
		lng: number;
		business_type: string;
		concept_type: string | null;
		location_iq: number;
		grade: string;
		confidence: number;
		transit_score: number | null;
		demographics_score: number | null;
		competition_score: number | null;
		vibrancy_score: number | null;
		safety_score: number | null;
		momentum_score: number | null;
		scored_at: string;
		latestOutcome: Outcome | null;
	}

	interface Outcome {
		id: string;
		verdict: string;
		months_open: number | null;
		revenue_range: string | null;
		satisfaction: number | null;
		notes: string | null;
		biggest_surprise: string | null;
		check_in_number: number;
		created_at: string;
	}

	const VERDICT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
		opened:        { label: 'Opened Here',   icon: '✅', color: 'var(--green, #34d399)' },
		passed:        { label: 'Passed',         icon: '❌', color: 'var(--redtag, #ef4444)' },
		still_looking: { label: 'Still Looking',  icon: '🔍', color: 'var(--yellow, #fbbf24)' },
		closed:        { label: 'Closed',         icon: '🚪', color: 'var(--muted, #555)' }
	};

	// ── Load data + check URL params ──
	onMount(async () => {
		// Check for email click-through params
		const params = new URL(window.location.href).searchParams;
		const respondId = params.get('respond');
		const checkin = params.get('checkin');
		const verdict = params.get('verdict');

		if (respondId) {
			formLocationId = respondId;
			if (checkin) formCheckIn = parseInt(checkin);
			if (verdict) formVerdict = verdict;
			showForm = true;
		}

		await fetchLocations();
	});

	async function fetchLocations() {
		loading = true;
		try {
			const res = await authedFetch('/api/outcomes');
			if (!res.ok) throw new Error('Failed to load');
			const data = await res.json();
			locations = data.locations || [];
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		}
		loading = false;
	}

	function openForm(locationId: string) {
		formLocationId = locationId;
		formVerdict = '';
		formMonthsOpen = null;
		formRevenue = '';
		formSatisfaction = null;
		formNotes = '';
		formSurprise = '';
		formSuccess = '';
		showForm = true;
	}

	async function submitOutcome() {
		if (!formVerdict) return;
		submitting = true;
		formSuccess = '';

		try {
			const res = await authedFetch('/api/outcomes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'submit_outcome',
					scoredLocationId: formLocationId,
					verdict: formVerdict,
					monthsOpen: formMonthsOpen,
					revenueRange: formRevenue || null,
					satisfaction: formSatisfaction,
					notes: formNotes || null,
					biggestSurprise: formSurprise || null,
					checkInNumber: formCheckIn
				})
			});

			if (!res.ok) throw new Error('Failed to submit');

			formSuccess = 'Thanks! Your feedback helps RE² learn.';
			showForm = false;
			await fetchLocations(); // refresh
		} catch (e) {
			error = e instanceof Error ? e.message : 'Submission failed';
		}
		submitting = false;
	}

	function gradeColor(grade: string): string {
		if (grade?.startsWith('A')) return 'var(--green, #34d399)';
		if (grade?.startsWith('B')) return 'var(--yellow, #fbbf24)';
		if (grade?.startsWith('C')) return 'var(--gold, #ffd60a)';
		return 'var(--redtag, #ef4444)';
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function getActiveLocation(): ScoredLocation | undefined {
		return locations.find(l => l.id === formLocationId);
	}
</script>

<svelte:head><title>RE² — Outcome Tracking</title></svelte:head>

<div class="outcomes-page">
	<header class="page-header">
		<div>
			<h1>Outcome Tracking</h1>
			<p class="subtitle">How did your scored locations perform in the real world?</p>
		</div>
	</header>

	{#if formSuccess}
		<div class="success-banner">{formSuccess}</div>
	{/if}

	<!-- Outcome submission form (modal-style) -->
	{#if showForm}
		{@const loc = getActiveLocation()}
		<div class="form-overlay" role="dialog">
			<div class="form-card">
				<button class="form-close" onclick={() => showForm = false}>✕</button>

				{#if loc}
					<div class="form-location-context">
						<span class="form-grade" style="color: {gradeColor(loc.grade)}">{loc.grade}</span>
						<span class="form-addr">{loc.address}</span>
						<span class="form-iq">IQ {loc.location_iq}</span>
					</div>
				{/if}

				<h2>What happened with this location?</h2>

				<!-- Step 1: Verdict (4th-grader simple) -->
				<div class="verdict-row">
					{#each Object.entries(VERDICT_LABELS) as [key, meta]}
						<button
							class="verdict-btn"
							class:selected={formVerdict === key}
							style="--vc: {meta.color}"
							onclick={() => formVerdict = key}
						>
							<span class="verdict-icon">{meta.icon}</span>
							<span class="verdict-label">{meta.label}</span>
						</button>
					{/each}
				</div>

				<!-- Step 2: Details (progressive disclosure) -->
				{#if formVerdict}
					<div class="form-details">
						{#if formVerdict === 'opened' || formVerdict === 'closed'}
							<div class="form-row">
								<label>How many months since opening?</label>
								<input type="number" min="0" max="120" bind:value={formMonthsOpen} placeholder="e.g., 6" />
							</div>
							<div class="form-row">
								<label>How's revenue vs. your plan?</label>
								<div class="radio-row">
									{#each [['below_plan', '📉 Below'], ['on_plan', '📊 On Track'], ['above_plan', '📈 Above']] as [val, lbl]}
										<button
											class="radio-btn"
											class:selected={formRevenue === val}
											onclick={() => formRevenue = val}
										>{lbl}</button>
									{/each}
								</div>
							</div>
							<div class="form-row">
								<label>How do you feel about this location? (1 = regret, 5 = love it)</label>
								<div class="radio-row">
									{#each [1, 2, 3, 4, 5] as n}
										<button
											class="radio-btn sat-btn"
											class:selected={formSatisfaction === n}
											onclick={() => formSatisfaction = n}
										>{n}</button>
									{/each}
								</div>
							</div>
						{/if}

						<div class="form-row">
							<label>What surprised you most about this location?</label>
							<input type="text" bind:value={formSurprise} placeholder="One thing you didn't expect..." />
						</div>

						<div class="form-row">
							<label>Anything else? (optional)</label>
							<textarea bind:value={formNotes} rows="2" placeholder="Notes, tips, observations..."></textarea>
						</div>

						<button
							class="submit-btn"
							onclick={submitOutcome}
							disabled={submitting || !formVerdict}
						>
							{submitting ? 'Submitting...' : 'Submit Feedback'}
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Scored locations list -->
	{#if loading}
		<div class="loading">Loading your scored locations...</div>
	{:else if error}
		<div class="empty-state">
			<p>Something went wrong loading your data.</p>
			<p class="hint">{error}</p>
		</div>
	{:else if !locations.length}
		<div class="empty-state">
			<p>No scored locations yet.</p>
			<p class="hint">Run your analysis and save it to start tracking outcomes.</p>
			<a href="/app/location" class="empty-cta">See your score →</a>
		</div>
	{:else}
		<div class="locations-grid">
			{#each locations as loc}
				<div class="location-card">
					<div class="card-top">
						<div class="card-grade" style="color: {gradeColor(loc.grade)}">{loc.grade}</div>
						<div class="card-info">
							<div class="card-addr">{loc.address}</div>
							<div class="card-meta">
								{loc.business_type} · IQ {loc.location_iq} · {formatDate(loc.scored_at)}
							</div>
						</div>
					</div>

					<!-- Mini scores -->
					<div class="mini-scores">
						{#each [
							{ label: 'TR', val: loc.transit_score, color: '#3b82f6' },
							{ label: 'DM', val: loc.demographics_score, color: '#8b5cf6' },
							{ label: 'CP', val: loc.competition_score, color: '#ef4444' },
							{ label: 'VB', val: loc.vibrancy_score, color: '#f59e0b' },
							{ label: 'SF', val: loc.safety_score, color: '#10b981' },
							{ label: 'MM', val: loc.momentum_score, color: '#ec4899' }
						] as idx}
							{#if idx.val != null}
								<div class="mini-score" style="--sc: {idx.color}">
									<span class="ms-label">{idx.label}</span>
									<span class="ms-val">{idx.val}</span>
								</div>
							{/if}
						{/each}
					</div>

					<!-- Outcome status -->
					<div class="card-bottom">
						{#if loc.latestOutcome}
							{@const v = VERDICT_LABELS[loc.latestOutcome.verdict]}
							<div class="outcome-badge" style="color: {v?.color || '#999'}">
								{v?.icon} {v?.label} · {formatDate(loc.latestOutcome.created_at)}
							</div>
						{:else}
							<button class="feedback-btn" onclick={() => openForm(loc.id)}>
								Share what happened →
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.outcomes-page {
		min-height: calc(100vh - 60px);
		padding: 32px 24px;
		max-width: 1000px;
		margin: 0 auto;
		color: var(--text);
		font-family: 'Syne', sans-serif;
	}

	.page-header { margin-bottom: 28px; }
	.page-header h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px 0; }
	.subtitle { font-size: 13px; color: var(--text-secondary); margin: 0; font-family: 'DM Mono', monospace; }

	.success-banner {
		padding: 12px 16px;
		background: var(--green-soft);
		border: 1px solid rgba(5, 150, 105, 0.2);
		border-radius: 8px;
		color: var(--success);
		font-size: 13px;
		font-weight: 600;
		margin-bottom: 20px;
	}

	.loading, .empty-state { text-align: center; padding: 60px 20px; color: var(--text-secondary); }
	.hint { font-size: 13px; color: var(--text-tertiary); margin-top: 8px; }
	.empty-cta {
		display: inline-block; margin-top: 16px; padding: 10px 20px;
		background: var(--teal-bg); border: 1px solid var(--teal);
		border-radius: 8px; color: var(--teal); font-size: 13px; font-weight: 700;
		text-decoration: none; transition: all 0.15s;
	}
	.empty-cta:hover { background: var(--teal-bg); opacity: 0.8; }

	/* ── Location cards ── */
	.locations-grid { display: flex; flex-direction: column; gap: 12px; }

	.location-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 18px 20px;
	}

	.card-top { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 12px; }
	.card-grade { font-size: 28px; font-weight: 800; font-family: 'DM Mono', monospace; min-width: 42px; }
	.card-addr { font-size: 15px; font-weight: 700; }
	.card-meta { font-size: 12px; color: var(--text-secondary); font-family: 'DM Mono', monospace; margin-top: 2px; }

	.mini-scores { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
	.mini-score {
		display: flex; flex-direction: column; align-items: center; gap: 1px;
		padding: 4px 8px;
		background: var(--surface-alt);
		border-radius: 6px;
		min-width: 36px;
	}
	.ms-label { font-size: 9px; color: var(--text-tertiary); font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
	.ms-val { font-size: 14px; font-weight: 700; font-family: 'DM Mono', monospace; color: var(--text); }

	.card-bottom { border-top: 1px solid var(--border); padding-top: 10px; }

	.outcome-badge { font-size: 13px; font-weight: 600; }

	.feedback-btn {
		background: none; border: 1px solid var(--teal); color: var(--teal);
		padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 700;
		cursor: pointer; transition: all 0.15s; font-family: inherit;
	}
	.feedback-btn:hover { background: var(--teal-bg); }

	/* ── Form overlay ── */
	.form-overlay {
		position: fixed; inset: 0; z-index: 100;
		background: rgba(0, 0, 0, 0.5);
		display: flex; align-items: center; justify-content: center;
		padding: 20px;
	}

	.form-card {
		background: var(--surface); border: 1px solid var(--border);
		border-radius: 14px; padding: 28px; max-width: 520px; width: 100%;
		position: relative; max-height: 90vh; overflow-y: auto;
	}

	.form-close {
		position: absolute; top: 12px; right: 16px;
		background: none; border: none; color: var(--text-tertiary);
		font-size: 18px; cursor: pointer;
	}

	.form-location-context {
		display: flex; align-items: center; gap: 10px;
		margin-bottom: 16px; padding-bottom: 12px;
		border-bottom: 1px solid var(--border);
	}
	.form-grade { font-size: 22px; font-weight: 800; font-family: 'DM Mono', monospace; }
	.form-addr { font-size: 14px; font-weight: 600; flex: 1; }
	.form-iq { font-size: 13px; color: var(--teal); font-family: 'DM Mono', monospace; font-weight: 700; }

	.form-card h2 { font-size: 17px; font-weight: 800; margin: 0 0 16px 0; }

	/* ── Verdict buttons ── */
	.verdict-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 20px; }

	.verdict-btn {
		display: flex; align-items: center; gap: 8px;
		padding: 14px 16px; background: var(--surface-alt);
		border: 1px solid var(--border); border-radius: 10px;
		color: var(--text-secondary); font-size: 14px; font-weight: 600;
		cursor: pointer; transition: all 0.15s; font-family: inherit;
	}
	.verdict-btn:hover { border-color: var(--teal); color: var(--teal); }
	.verdict-btn.selected { border-color: var(--teal); color: var(--teal); background: var(--teal-bg); }
	.verdict-icon { font-size: 18px; }

	/* ── Form details ── */
	.form-details { display: flex; flex-direction: column; gap: 14px; }

	.form-row label {
		display: block; font-size: 13px; font-weight: 600;
		color: var(--text-secondary); margin-bottom: 6px;
	}

	.form-row input, .form-row textarea {
		width: 100%; padding: 10px 12px;
		background: var(--surface-alt); border: 1px solid var(--border);
		border-radius: 6px; color: var(--text); font-size: 14px;
		font-family: inherit; outline: none; box-sizing: border-box;
	}
	.form-row input:focus, .form-row textarea:focus { border-color: var(--teal); }

	.radio-row { display: flex; gap: 6px; flex-wrap: wrap; }

	.radio-btn {
		padding: 8px 14px; background: var(--surface-alt);
		border: 1px solid var(--border); border-radius: 6px;
		color: var(--text-secondary); font-size: 13px; font-weight: 600;
		cursor: pointer; transition: all 0.15s; font-family: inherit;
	}
	.radio-btn:hover { border-color: var(--teal); color: var(--text); }
	.radio-btn.selected { border-color: var(--teal); color: var(--teal); background: var(--teal-bg); }

	.sat-btn { min-width: 40px; text-align: center; }

	.submit-btn {
		padding: 14px 24px; background: linear-gradient(135deg, var(--teal), var(--teal-bright));
		border: none; border-radius: 10px; color: white;
		font-size: 14px; font-weight: 700; cursor: pointer;
		font-family: inherit; transition: all 0.2s; margin-top: 8px;
	}
	.submit-btn:hover { opacity: 0.9; }
	.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	@media (max-width: 600px) {
		.verdict-row { grid-template-columns: 1fr; }
		.mini-scores { gap: 4px; }
	}
</style>
