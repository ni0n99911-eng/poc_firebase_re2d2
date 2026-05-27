<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import NavigationDrawer from '$lib/components/NavigationDrawer.svelte';
	import { authedFetch } from '$lib/authed-fetch';
	import { tierFor } from '$lib/intel/tiers';

	// Pipeline data
	let pipeline: any[] = $state([]);
	let counts: Record<string, number> = $state({});
	let brokers: any[] = $state([]);
	let loading = $state(true);
	let error = $state('');

	// UI state
	let activeStatus = $state('all');
	let showAddBroker = $state(false);
	let expandedDeal = $state<string | null>(null);
	let savingDeal = $state<string | null>(null);
	let toast = $state('');

	// Add broker form
	let brokerName = $state('');
	let brokerFirm = $state('');
	let brokerEmail = $state('');
	let brokerPhone = $state('');
	let savingBroker = $state(false);

	const STATUS_LABELS: Record<string, string> = {
		watching: 'Watching',
		touring: 'Touring',
		negotiating: 'Negotiating',
		signed: 'Signed',
		passed: 'Passed',
		lost: 'Lost',
	};

	const STATUS_NEXT: Record<string, string | null> = {
		watching: 'touring',
		touring: 'negotiating',
		negotiating: 'signed',
		signed: null,
		passed: null,
		lost: null,
	};

	const STATUS_COLOR: Record<string, string> = {
		watching:     '#6B7280',
		touring:      '#0071E3',
		negotiating:  '#F59E0B',
		signed:       '#15803d',
		passed:       '#9CA3AF',
		lost:         '#EF4444',
	};

	const ACTIVE_STATUSES = ['watching', 'touring', 'negotiating'];

	let filtered = $derived.by(() => {
		if (activeStatus === 'all') return pipeline;
		if (activeStatus === 'active') return pipeline.filter(d => ACTIVE_STATUSES.includes(d.status));
		if (activeStatus === 'closed') return pipeline.filter(d => ['signed','passed','lost'].includes(d.status));
		return pipeline.filter(d => d.status === activeStatus);
	});

	function scoreColor(val: number): string {
		const c = tierFor(val, 'fitIQ').color;
		return c === 'green' ? '#15803d' : c === 'amber' ? '#D97706' : c === 'red' ? '#DC2626' : '#0071E3';
	}

	function daysInStage(deal: any): string {
		const ref = deal.updated_at || deal.created_at;
		if (!ref) return '—';
		const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
		if (days === 0) return 'Today';
		if (days === 1) return '1 day';
		return `${days} days`;
	}

	function formatRent(rent: number | null): string {
		if (!rent) return '—';
		return '$' + rent.toLocaleString() + '/mo';
	}

	function showToast(msg: string) {
		toast = msg;
		setTimeout(() => { toast = ''; }, 2500);
	}

	async function changeStatus(deal: any, newStatus: string) {
		if (savingDeal === deal.id) return;
		savingDeal = deal.id;
		try {
			const res = await fetch(`/api/deals/${deal.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: newStatus }),
			});
			if (res.ok) {
				deal.status = newStatus;
				pipeline = [...pipeline];
				showToast(`Moved to ${STATUS_LABELS[newStatus]}`);
			}
		} finally {
			savingDeal = null;
		}
	}

	async function saveNote(deal: any, note: string) {
		if (!note.trim()) return;
		await fetch(`/api/deals/${deal.id}/events`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ event_type: 'note', notes: note }),
		});
		await fetch(`/api/deals/${deal.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ notes: note }),
		});
		deal.notes = note;
		pipeline = [...pipeline];
		showToast('Note saved');
	}

	async function addBroker() {
		if (!brokerName.trim() || savingBroker) return;
		savingBroker = true;
		try {
			const res = await authedFetch('/api/brokers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: brokerName, brokerage: brokerFirm,
					email: brokerEmail, phone: brokerPhone,
				}),
			});
			if (res.ok) {
				const data = await res.json();
				brokers = [{ id: data.broker_id, name: brokerName, brokerage: brokerFirm, email: brokerEmail, phone: brokerPhone }, ...brokers];
				brokerName = brokerFirm = brokerEmail = brokerPhone = '';
				showAddBroker = false;
				showToast('Broker added');
			}
		} finally {
			savingBroker = false;
		}
	}

	async function assignBroker(deal: any, brokerId: string) {
		await authedFetch(`/api/deals/${deal.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ broker_id: brokerId || null }),
		});
		const broker = brokers.find(b => b.id === brokerId) || null;
		deal.broker = broker;
		pipeline = [...pipeline];
		showToast(broker ? `Assigned to ${broker.name}` : 'Broker removed');
	}

	onMount(async () => {
		try {
			const [dealsRes, brokersRes] = await Promise.all([
				authedFetch('/api/deals'),
				authedFetch('/api/brokers'),
			]);
			if (dealsRes.ok) {
				const d = await dealsRes.json();
				pipeline = d.pipeline || [];
				counts = d.counts || {};
			}
			if (brokersRes.ok) {
				const b = await brokersRes.json();
				brokers = b.brokers || [];
			}
		} catch (e) {
			error = 'Failed to load pipeline';
		} finally {
			loading = false;
		}
	});
</script>

<NavigationDrawer />

<div class="pipe-page">

	<!-- Header -->
	<div class="pipe-header">
		<div class="pipe-header-left">
			<h1 class="pipe-title">Deal Pipeline</h1>
			<div class="pipe-subtitle">Track your locations from score → signed lease</div>
		</div>
		<div class="pipe-header-right">
			<button class="pipe-broker-btn" onclick={() => { showAddBroker = !showAddBroker; }} type="button">
				+ Add Broker
			</button>
		</div>
	</div>

	<!-- ROI Bar -->
	{#if pipeline.length > 0}
	<div class="pipe-roi-bar">
		<div class="pipe-roi-step">
			<span class="roi-num">{pipeline.length}</span>
			<span class="roi-label">Scored</span>
		</div>
		<div class="roi-arrow">→</div>
		<div class="pipe-roi-step">
			<span class="roi-num">{(counts.touring || 0) + (counts.negotiating || 0)}</span>
			<span class="roi-label">In Progress</span>
		</div>
		<div class="roi-arrow">→</div>
		<div class="pipe-roi-step {counts.signed > 0 ? 'roi-signed' : ''}">
			<span class="roi-num">{counts.signed || 0}</span>
			<span class="roi-label">Signed</span>
		</div>
	</div>
	{/if}

	<!-- Add Broker Panel -->
	{#if showAddBroker}
	<div class="pipe-broker-form">
		<div class="pbf-title">Add Broker Contact</div>
		<div class="pbf-row">
			<input class="pbf-input" bind:value={brokerName} placeholder="Name *" type="text" />
			<input class="pbf-input" bind:value={brokerFirm} placeholder="Firm / Brokerage" type="text" />
		</div>
		<div class="pbf-row">
			<input class="pbf-input" bind:value={brokerEmail} placeholder="Email" type="email" />
			<input class="pbf-input" bind:value={brokerPhone} placeholder="Phone" type="tel" />
		</div>
		<div class="pbf-actions">
			<button class="pbf-save" onclick={addBroker} disabled={savingBroker || !brokerName.trim()} type="button">
				{savingBroker ? 'Saving...' : 'Save Broker'}
			</button>
			<button class="pbf-cancel" onclick={() => { showAddBroker = false; }} type="button">Cancel</button>
		</div>
	</div>
	{/if}

	<!-- Status filter tabs -->
	<div class="pipe-tabs">
		{#each [
			{ key: 'all', label: 'All' },
			{ key: 'active', label: 'Active' },
			{ key: 'watching', label: `Watching ${counts.watching > 0 ? '(' + counts.watching + ')' : ''}` },
			{ key: 'touring', label: `Touring ${counts.touring > 0 ? '(' + counts.touring + ')' : ''}` },
			{ key: 'negotiating', label: `Negotiating ${counts.negotiating > 0 ? '(' + counts.negotiating + ')' : ''}` },
			{ key: 'signed', label: `Signed ${counts.signed > 0 ? '(' + counts.signed + ')' : ''}` },
		] as tab}
			<button
				class="pipe-tab {activeStatus === tab.key ? 'active' : ''}"
				onclick={() => { activeStatus = tab.key; }}
				type="button"
			>{tab.label}</button>
		{/each}
	</div>

	<!-- Loading / empty states -->
	{#if loading}
		<div class="pipe-empty">Loading your pipeline...</div>
	{:else if error}
		<div class="pipe-empty pipe-error">{error}</div>
	{:else if filtered.length === 0}
		<div class="pipe-empty">
			{#if pipeline.length === 0}
				<div class="pipe-empty-icon">📍</div>
				<div class="pipe-empty-title">No locations tracked yet</div>
				<div class="pipe-empty-sub">When you save a location, it appears here so you can track it through to lease signing.</div>
				<a href="/app/location" class="pipe-empty-cta">Analyze a Location →</a>
			{:else}
				No deals in this stage.
			{/if}
		</div>
	{:else}
		<!-- Deal cards grouped by status -->
		{#each ACTIVE_STATUSES.concat(['signed','passed','lost']) as status}
			{@const group = filtered.filter(d => d.status === status)}
			{#if group.length > 0}
			<div class="pipe-group">
				<div class="pipe-group-hdr">
					<span class="pipe-group-dot" style="background:{STATUS_COLOR[status]}"></span>
					<span class="pipe-group-label">{STATUS_LABELS[status]}</span>
					<span class="pipe-group-count">{group.length}</span>
				</div>

				{#each group as deal (deal.id)}
				<div class="pipe-card {expandedDeal === deal.id ? 'expanded' : ''}">
					<div class="pipe-card-main" onclick={() => { expandedDeal = expandedDeal === deal.id ? null : deal.id; }} role="button" tabindex="0">
						<div class="pipe-card-left">
							<div class="pipe-card-addr">{deal.address.split(',')[0]}</div>
							{#if deal.neighborhood}
								<div class="pipe-card-nbhd">{deal.neighborhood}{deal.borough ? ' · ' + deal.borough : ''}</div>
							{/if}
							<div class="pipe-card-meta">
								{#if deal.asking_rent_monthly}
									<span class="pipe-meta-chip">{formatRent(deal.asking_rent_monthly)}</span>
								{/if}
								{#if deal.square_footage}
									<span class="pipe-meta-chip">{deal.square_footage.toLocaleString()} sqft</span>
								{/if}
								{#if deal.broker}
									<span class="pipe-meta-chip broker-chip">🤝 {deal.broker.name}</span>
								{/if}
								<span class="pipe-meta-chip time-chip">{daysInStage(deal)}</span>
							</div>
						</div>
						<div class="pipe-card-right">
							{#if deal.fit_iq_score}
								<div class="pipe-score-badge" style="color:{scoreColor(deal.fit_iq_score)};border-color:{scoreColor(deal.fit_iq_score)}20;background:{scoreColor(deal.fit_iq_score)}10">
									<span class="psb-val">{deal.fit_iq_score}<span class="psb-denom">/100</span></span>
									<span class="psb-label">Score</span>
								</div>
							{/if}
							<div class="pipe-status-dot" style="background:{STATUS_COLOR[deal.status]}"></div>
						</div>
					</div>

					<!-- Expanded detail panel -->
					{#if expandedDeal === deal.id}
					<div class="pipe-card-detail">
						<!-- Score row -->
						{#if deal.location_iq_score || deal.vision_iq_score}
						<div class="pcd-scores">
							{#if deal.location_iq_score}
							<div class="pcd-score">
								<span class="pcd-sv" style="color:{scoreColor(deal.location_iq_score)}">{deal.location_iq_score}<span class="pcd-denom">/100</span></span>
								<span class="pcd-sl">Location</span>
							</div>
							{/if}
							{#if deal.fit_iq_score}
							<div class="pcd-score">
								<span class="pcd-sv" style="color:{scoreColor(deal.fit_iq_score)}">{deal.fit_iq_score}<span class="pcd-denom">/100</span></span>
								<span class="pcd-sl">Score</span>
							</div>
							{/if}
							{#if deal.vision_iq_score}
							<div class="pcd-score">
								<span class="pcd-sv" style="color:{scoreColor(deal.vision_iq_score)}">{deal.vision_iq_score}<span class="pcd-denom">/100</span></span>
								<span class="pcd-sl">Concept</span>
							</div>
							{/if}
						</div>
						{/if}

						<!-- Status dropdown -->
						{#if !['signed','passed','lost'].includes(deal.status)}
						<div class="pcd-row">
							<label class="pcd-lbl">Stage</label>
							<select class="pcd-select" onchange={(e) => changeStatus(deal, (e.target as HTMLSelectElement).value)} value={deal.status} disabled={savingDeal === deal.id}>
								<option value="watching">Watching</option>
								<option value="touring">Touring</option>
								<option value="negotiating">Negotiating</option>
								<option value="signed">✅ Signed</option>
								<option value="passed">Passed</option>
								<option value="lost">Lost</option>
							</select>
						</div>
						{/if}

						<!-- Broker assignment -->
						{#if brokers.length > 0}
						<div class="pcd-row">
							<label class="pcd-lbl">Broker</label>
							<select class="pcd-select" onchange={(e) => assignBroker(deal, (e.target as HTMLSelectElement).value)} value={deal.broker?.id || ''}>
								<option value="">No broker assigned</option>
								{#each brokers as b}
									<option value={b.id}>{b.name}{b.brokerage ? ' — ' + b.brokerage : ''}</option>
								{/each}
							</select>
						</div>
						{/if}

						<!-- Notes -->
						<div class="pcd-row pcd-notes-row">
							<label class="pcd-lbl">Notes</label>
							<textarea
								class="pcd-textarea"
								placeholder="Add a note..."
								value={deal.notes || ''}
								onblur={(e) => saveNote(deal, (e.target as HTMLTextAreaElement).value)}
								rows="2"
							></textarea>
						</div>

						<!-- View analysis link -->
						<div class="pcd-actions">
							<a href="/app/location?addr={encodeURIComponent(deal.address)}" class="pcd-link">
								Re-analyze →
							</a>
							{#if STATUS_NEXT[deal.status]}
								<button class="pcd-advance" onclick={() => changeStatus(deal, STATUS_NEXT[deal.status]!)} disabled={savingDeal === deal.id} type="button">
									Move to {STATUS_LABELS[STATUS_NEXT[deal.status]!]} →
								</button>
							{/if}
						</div>
					</div>
					{/if}
				</div>
				{/each}
			</div>
			{/if}
		{/each}
	{/if}

	<!-- Brokers section (collapsed list) -->
	{#if brokers.length > 0}
	<div class="pipe-brokers-section">
		<div class="pbs-title">Your Brokers ({brokers.length})</div>
		<div class="pbs-list">
			{#each brokers as b}
			<div class="pbs-card">
				<div class="pbs-name">{b.name}</div>
				{#if b.brokerage}<div class="pbs-firm">{b.brokerage}</div>{/if}
				<div class="pbs-contacts">
					{#if b.email}<a href="mailto:{b.email}" class="pbs-contact">{b.email}</a>{/if}
					{#if b.phone}<span class="pbs-contact">{b.phone}</span>{/if}
				</div>
			</div>
			{/each}
		</div>
	</div>
	{/if}

</div>

<!-- Toast -->
{#if toast}
<div class="pipe-toast">{toast}</div>
{/if}

<style>
/* ===== PAGE ===== */
.pipe-page {
	max-width: 700px;
	margin: 0 auto;
	padding: 24px 16px 80px;
	font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
}

/* ===== HEADER ===== */
.pipe-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	margin-bottom: 20px;
}
.pipe-title {
	font-size: 22px;
	font-weight: 700;
	color: #111827;
	margin: 0 0 4px 0;
}
.pipe-subtitle {
	font-size: 13px;
	color: #6B7280;
}
.pipe-broker-btn {
	font-size: 13px;
	font-weight: 600;
	color: #0071E3;
	background: none;
	border: 1px solid #0071E3;
	border-radius: 8px;
	padding: 6px 12px;
	cursor: pointer;
}
.pipe-broker-btn:hover { background: #EFF6FF; }

/* ===== ROI BAR ===== */
.pipe-roi-bar {
	display: flex;
	align-items: center;
	gap: 12px;
	background: #F9FAFB;
	border: 1px solid #E5E7EB;
	border-radius: 10px;
	padding: 12px 20px;
	margin-bottom: 20px;
}
.pipe-roi-step {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
}
.roi-num {
	font-size: 22px;
	font-weight: 700;
	color: #111827;
	line-height: 1;
}
.roi-label {
	font-size: 13px;
	color: #6B7280;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}
.roi-arrow {
	font-size: 16px;
	color: #D1D5DB;
	flex-shrink: 0;
}
.roi-signed .roi-num { color: #15803d; }

/* ===== ADD BROKER FORM ===== */
.pipe-broker-form {
	background: #F9FAFB;
	border: 1px solid #E5E7EB;
	border-radius: 10px;
	padding: 16px;
	margin-bottom: 20px;
}
.pbf-title {
	font-size: 13px;
	font-weight: 600;
	color: #374151;
	margin-bottom: 12px;
}
.pbf-row {
	display: flex;
	gap: 8px;
	margin-bottom: 8px;
}
.pbf-input {
	flex: 1;
	font-size: 13px;
	padding: 8px 10px;
	border: 1px solid #D1D5DB;
	border-radius: 6px;
	background: white;
	color: #111827;
}
.pbf-input:focus { outline: none; border-color: #0071E3; }
.pbf-actions {
	display: flex;
	gap: 8px;
	margin-top: 4px;
}
.pbf-save {
	font-size: 13px;
	font-weight: 600;
	padding: 8px 16px;
	background: #111827;
	color: white;
	border: none;
	border-radius: 7px;
	cursor: pointer;
}
.pbf-save:disabled { opacity: 0.5; cursor: default; }
.pbf-cancel {
	font-size: 13px;
	color: #6B7280;
	background: none;
	border: none;
	cursor: pointer;
	padding: 8px;
}

/* ===== TABS ===== */
.pipe-tabs {
	display: flex;
	gap: 4px;
	margin-bottom: 16px;
	overflow-x: auto;
	padding-bottom: 2px;
}
.pipe-tab {
	font-size: 14px;
	font-weight: 500;
	padding: 6px 12px;
	border-radius: 20px;
	background: none;
	border: 1px solid #E5E7EB;
	color: #6B7280;
	cursor: pointer;
	white-space: nowrap;
	flex-shrink: 0;
}
.pipe-tab:hover { background: #F9FAFB; }
.pipe-tab.active {
	background: #111827;
	color: white;
	border-color: #111827;
}

/* ===== EMPTY STATE ===== */
.pipe-empty {
	text-align: center;
	padding: 48px 24px;
	color: #9CA3AF;
	font-size: 14px;
}
.pipe-error { color: #EF4444; }
.pipe-empty-icon { font-size: 36px; margin-bottom: 12px; }
.pipe-empty-title { font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 8px; }
.pipe-empty-sub { font-size: 13px; color: #9CA3AF; margin-bottom: 20px; max-width: 300px; margin-left: auto; margin-right: auto; }
.pipe-empty-cta {
	display: inline-block;
	padding: 10px 20px;
	background: #111827;
	color: white;
	border-radius: 8px;
	text-decoration: none;
	font-size: 13px;
	font-weight: 600;
}

/* ===== DEAL GROUPS ===== */
.pipe-group { margin-bottom: 24px; }
.pipe-group-hdr {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 8px;
}
.pipe-group-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	flex-shrink: 0;
}
.pipe-group-label {
	font-size: 14px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: #6B7280;
}
.pipe-group-count {
	font-size: 13px;
	background: #F3F4F6;
	color: #6B7280;
	padding: 1px 7px;
	border-radius: 10px;
}

/* ===== DEAL CARDS ===== */
.pipe-card {
	background: white;
	border: 1px solid #E5E7EB;
	border-radius: 10px;
	margin-bottom: 8px;
	overflow: hidden;
	transition: box-shadow 0.15s;
}
.pipe-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
.pipe-card.expanded { border-color: #D1D5DB; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }

.pipe-card-main {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 14px 16px;
	cursor: pointer;
	gap: 12px;
}

.pipe-card-left { flex: 1; min-width: 0; }
.pipe-card-addr {
	font-size: 14px;
	font-weight: 600;
	color: #111827;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.pipe-card-nbhd {
	font-size: 14px;
	color: #6B7280;
	margin-top: 2px;
}
.pipe-card-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
	margin-top: 7px;
}
.pipe-meta-chip {
	font-size: 13px;
	padding: 2px 8px;
	background: #F3F4F6;
	color: #374151;
	border-radius: 10px;
}
.broker-chip { background: #EFF6FF; color: #1D4ED8; }
.time-chip { color: #9CA3AF; background: transparent; padding: 2px 0; }

.pipe-card-right {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 6px;
	flex-shrink: 0;
}
.pipe-score-badge {
	display: flex;
	flex-direction: column;
	align-items: center;
	border: 1px solid;
	border-radius: 8px;
	padding: 4px 10px;
	min-width: 48px;
}
.psb-val { font-size: 16px; font-weight: 700; line-height: 1; }
.psb-denom { font-size: 10px; font-weight: 500; opacity: 0.5; }
.psb-label { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1px; }
.pipe-status-dot {
	width: 7px;
	height: 7px;
	border-radius: 50%;
}

/* ===== DEAL DETAIL ===== */
.pipe-card-detail {
	border-top: 1px solid #F3F4F6;
	padding: 14px 16px;
	background: #FAFAFA;
}

.pcd-scores {
	display: flex;
	gap: 16px;
	margin-bottom: 14px;
}
.pcd-score {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
}
.pcd-sv { font-size: 18px; font-weight: 700; line-height: 1; }
.pcd-denom { font-size: 11px; font-weight: 500; opacity: 0.5; }
.pcd-sl { font-size: 14px; color: #6B7280; font-weight: 500; }

.pcd-row {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-bottom: 10px;
}
.pcd-notes-row { align-items: flex-start; }
.pcd-lbl {
	font-size: 14px;
	font-weight: 600;
	color: #6B7280;
	width: 56px;
	flex-shrink: 0;
}
.pcd-select {
	flex: 1;
	font-size: 13px;
	padding: 6px 8px;
	border: 1px solid #E5E7EB;
	border-radius: 6px;
	background: white;
	color: #111827;
}
.pcd-textarea {
	flex: 1;
	font-size: 13px;
	padding: 8px 10px;
	border: 1px solid #E5E7EB;
	border-radius: 6px;
	background: white;
	color: #111827;
	resize: vertical;
	font-family: inherit;
}
.pcd-textarea:focus { outline: none; border-color: #0071E3; }

.pcd-actions {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 6px;
}
.pcd-link {
	font-size: 14px;
	color: #0071E3;
	text-decoration: none;
}
.pcd-advance {
	font-size: 14px;
	font-weight: 600;
	padding: 6px 12px;
	background: #111827;
	color: white;
	border: none;
	border-radius: 6px;
	cursor: pointer;
}
.pcd-advance:disabled { opacity: 0.5; cursor: default; }

/* ===== BROKERS SECTION ===== */
.pipe-brokers-section {
	margin-top: 32px;
	border-top: 1px solid #F3F4F6;
	padding-top: 20px;
}
.pbs-title {
	font-size: 14px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: #9CA3AF;
	margin-bottom: 12px;
}
.pbs-list { display: flex; flex-direction: column; gap: 8px; }
.pbs-card {
	background: #F9FAFB;
	border: 1px solid #E5E7EB;
	border-radius: 8px;
	padding: 12px;
}
.pbs-name { font-size: 13px; font-weight: 600; color: #111827; }
.pbs-firm { font-size: 14px; color: #6B7280; margin-top: 2px; }
.pbs-contacts { display: flex; gap: 12px; margin-top: 6px; }
.pbs-contact { font-size: 14px; color: #0071E3; text-decoration: none; }

/* ===== TOAST ===== */
.pipe-toast {
	position: fixed;
	bottom: 24px;
	left: 50%;
	transform: translateX(-50%);
	background: #111827;
	color: white;
	font-size: 13px;
	font-weight: 500;
	padding: 10px 20px;
	border-radius: 20px;
	z-index: 999;
	pointer-events: none;
	animation: fadeIn 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

@media (max-width: 640px) {
	.pbf-row { flex-direction: column; }
	.pipe-tabs { gap: 3px; }
	.pipe-tab { font-size: 13px; padding: 5px 10px; }
}
</style>
