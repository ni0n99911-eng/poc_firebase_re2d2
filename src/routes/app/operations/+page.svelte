<script lang="ts">
	import { onMount } from 'svelte';
	import { loadLaunchPadData } from '$lib/launchpad-store';
	import { getOperationsConfig } from '$lib/operations-data';
	import type { OperationsConfig, HandbookSection } from '$lib/operations-data';
	import { authedFetch } from '$lib/authed-fetch';
	import PageNav from '$lib/components/PageNav.svelte';
	import { getConceptLabel } from '$lib/constants/concepts';

	let lpData = $state(loadLaunchPadData());
	let mounted = $state(false);
	let operationsConfig = $state<OperationsConfig | null>(null);
	let generatingHandbook = $state(false);
	let generatingSOP = $state(false);
	interface GeneratedHandbook {
		success: boolean;
		data: {
			businessName: string;
			businessType: string;
			city: string;
			state: string;
			sections: Record<string, string>;
			generatedAt: string;
		};
	}
	interface GeneratedSOPs {
		success: boolean;
		data: {
			businessName: string;
			businessType: string;
			city: string;
			state: string;
			totalSOPs: number;
			sops: Array<{ id: string; title: string; category: string; frequency: string; responsibleRole: string; detailedSteps: string }>;
			generatedAt: string;
		};
	}
	let handbook = $state<GeneratedHandbook | null>(null);
	let sops = $state<GeneratedSOPs | null>(null);
	let handbookPreview = $state<HandbookSection[]>([]);
	let sopStats = $state({ universal: 0, vertical: 0, categories: new Map<string, number>() });

	// #33: friendlyBizType replaced by getConceptLabel from src/lib/constants/concepts.ts
	function friendlyBizType(raw: string): string {
		return getConceptLabel(raw);
	}

	// Deal context from upstream modules
	let dealContext = $state({
		businessName: '',
		businessType: '',
		city: '',
		state: '',
		visionStatement: '',
		operatingHours: '',
		staffingModel: '',
		laborBudget: 0,
		sqft: 0,
		seatingCapacity: 0
	});

	onMount(() => {
		mounted = true;

		// Load operations config
		operationsConfig = getOperationsConfig(
			lpData?.businessType || 'retail',
			lpData?.city || 'New York',
			lpData?.state || 'NY',
			lpData?.businessName || 'Your Business',
			lpData?.visionStatement || '',
			lpData?.operatingHours || '',
			lpData?.staffingModel || '',
			lpData?.laborBudget || 0,
			lpData?.sqft || 0,
			lpData?.seatingCapacity || 0
		);

		// Update deal context
		if (operationsConfig) {
			dealContext = {
				businessName: operationsConfig.businessName,
				businessType: operationsConfig.businessType,
				city: operationsConfig.city,
				state: operationsConfig.state,
				visionStatement: operationsConfig.visionStatement || '',
				operatingHours: operationsConfig.operatingHours || '',
				staffingModel: operationsConfig.staffingModel || '',
				laborBudget: operationsConfig.laborBudget || 0,
				sqft: operationsConfig.sqft || 0,
				seatingCapacity: operationsConfig.seatingCapacity || 0
			};

			// Calculate SOP stats
			sopStats = {
				universal: operationsConfig.universalSOPs.length,
				vertical: operationsConfig.verticalSOPs.length,
				categories: new Map(
					Array.from(
						new Set([
							...operationsConfig.universalSOPs.map(s => s.category),
							...operationsConfig.verticalSOPs.map(s => s.category)
						])
					).map(cat => [cat, 0])
				)
			};

			// Count by category
			operationsConfig.universalSOPs.forEach(s => {
				const count = sopStats.categories.get(s.category) || 0;
				sopStats.categories.set(s.category, count + 1);
			});
			operationsConfig.verticalSOPs.forEach(s => {
				const count = sopStats.categories.get(s.category) || 0;
				sopStats.categories.set(s.category, count + 1);
			});

			// Set handbook preview
			handbookPreview = operationsConfig.handbookSections.slice(0, 5);
		}
	});

	async function generateHandbook() {
		if (!operationsConfig) return;
		generatingHandbook = true;
		try {
			const response = await authedFetch('/api/generate-operations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'handbook',
					businessType: operationsConfig.businessType,
					city: operationsConfig.city,
					state: operationsConfig.state,
					businessName: operationsConfig.businessName,
					visionStatement: operationsConfig.visionStatement,
					operatingHours: operationsConfig.operatingHours,
					staffingModel: operationsConfig.staffingModel,
					laborBudget: operationsConfig.laborBudget,
					sqft: operationsConfig.sqft,
					seatingCapacity: operationsConfig.seatingCapacity
				})
			});

			if (response.ok) {
				handbook = await response.json();
				localStorage.setItem('re2_handbook', JSON.stringify(handbook));
			}
		} catch (e) {
			console.error('Handbook generation error:', e);
		} finally {
			generatingHandbook = false;
		}
	}

	async function generateSOP() {
		if (!operationsConfig) return;
		generatingSOP = true;
		try {
			const response = await authedFetch('/api/generate-operations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'sop',
					businessType: operationsConfig.businessType,
					city: operationsConfig.city,
					state: operationsConfig.state,
					businessName: operationsConfig.businessName,
					visionStatement: operationsConfig.visionStatement,
					operatingHours: operationsConfig.operatingHours,
					staffingModel: operationsConfig.staffingModel,
					laborBudget: operationsConfig.laborBudget,
					sqft: operationsConfig.sqft,
					seatingCapacity: operationsConfig.seatingCapacity
				})
			});

			if (response.ok) {
				sops = await response.json();
				localStorage.setItem('re2_sop_manual', JSON.stringify(sops));
			}
		} catch (e) {
			console.error('SOP generation error:', e);
		} finally {
			generatingSOP = false;
		}
	}

	async function exportDocument(type: 'handbook' | 'sop') {
		const content = type === 'handbook' ? handbook : sops;
		if (!content) return;

		try {
			const response = await authedFetch('/api/export-operations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type,
					content,
					businessName: dealContext.businessName
				})
			});

			if (response.ok) {
				const blob = await response.blob();
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${dealContext.businessName.replace(/\s+/g, '_')}_${type === 'handbook' ? 'handbook' : 'sop_manual'}.docx`;
				document.body.appendChild(a);
				a.click();
				window.URL.revokeObjectURL(url);
				document.body.removeChild(a);
			}
		} catch (e) {
			console.error('Export error:', e);
		}
	}
</script>

<svelte:head><title>RE² — Operations</title></svelte:head>


{#if mounted && operationsConfig}
	<div class="operations-page">
		<!-- Header Section -->
		<div class="header-section">
			<div class="header-content">
				<h1>Operations</h1>
				<p class="tagline">E = MC² | Establish My Compliance & Culture</p>
				<p class="description">
					Generate your employee handbook and operations SOP manual in minutes.
				</p>
			</div>
		</div>

		<!-- Deal Context Card -->
		<div class="context-card">
			<h3>Deal Context</h3>
			<div class="context-grid">
				<div class="context-item">
					<label>Business</label>
					<p>{dealContext.businessName}</p>
				</div>
				<div class="context-item">
					<label>Type</label>
					<p>{friendlyBizType(dealContext.businessType)}</p>
				</div>
				<div class="context-item">
					<label>Location</label>
					<p>{dealContext.city}, {dealContext.state}</p>
				</div>
				{#if dealContext.staffingModel}
					<div class="context-item">
						<label>Staffing</label>
						<p>{dealContext.staffingModel}</p>
					</div>
				{/if}
				{#if dealContext.laborBudget}
					<div class="context-item">
						<label>Labor Budget</label>
						<p>${(dealContext.laborBudget / 1000).toFixed(0)}k/year</p>
					</div>
				{/if}
				{#if dealContext.sqft}
					<div class="context-item">
						<label>Square Footage</label>
						<p>{dealContext.sqft.toLocaleString()} sqft</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Generation Cards -->
		<div class="generation-grid">
			<!-- Handbook Card -->
			<div class="generation-card">
				<div class="card-header">
					<h2>📖 Employee Handbook</h2>
					<div class="status-badge" class:generated={handbook}>
						{handbook ? '✓ Generated' : 'Ready'}
					</div>
				</div>

				<div class="card-content">
					<p class="card-description">
						9 comprehensive sections covering employment, compensation, benefits, and compliance.
					</p>

					<div class="sections-list">
						<p class="sections-label">Sections included:</p>
						<ul>
							{#each handbookPreview as section}
								<li>
									<span class="checkmark">✓</span>
									{section.title}
								</li>
							{/each}
							{#if operationsConfig.handbookSections.length > 5}
								<li class="more-item">
									<span class="checkmark">+</span>
									{operationsConfig.handbookSections.length - 5} more sections
								</li>
							{/if}
						</ul>
					</div>

					<div class="progress-indicator">
						<div class="progress-bar">
							<div
								class="progress-fill"
								style={`width: ${handbook ? '100' : '0'}%`}
							></div>
						</div>
						<span class="progress-text">{handbook ? '100% Complete' : 'Not started'}</span>
					</div>
				</div>

				<div class="card-actions">
					{#if handbook}
						<button
							class="btn btn-secondary"
							onclick={() => exportDocument('handbook')}
						>
							Download DOCX
						</button>
					{:else}
						<button
							class="btn btn-primary"
							onclick={generateHandbook}
							disabled={generatingHandbook}
						>
							{generatingHandbook ? 'Generating...' : 'Generate Handbook'}
						</button>
					{/if}
				</div>
			</div>

			<!-- SOP Card -->
			<div class="generation-card">
				<div class="card-header">
					<h2>📋 Operations Manual</h2>
					<div class="status-badge" class:generated={sops}>
						{sops ? '✓ Generated' : 'Ready'}
					</div>
				</div>

				<div class="card-content">
					<p class="card-description">
						{sopStats.universal + sopStats.vertical} SOPs across {sopStats.categories.size} operational categories.
					</p>

					<div class="stats-grid">
						<div class="stat">
							<div class="stat-number">{sopStats.universal}</div>
							<div class="stat-label">Universal SOPs</div>
						</div>
						<div class="stat">
							<div class="stat-number">{sopStats.vertical}</div>
							<div class="stat-label">Vertical-Specific</div>
						</div>
						<div class="stat">
							<div class="stat-number">{sopStats.categories.size}</div>
							<div class="stat-label">Categories</div>
						</div>
					</div>

					<div class="categories-list">
						<p class="categories-label">Categories:</p>
						<div class="category-tags">
							{#each Array.from(sopStats.categories.keys()).slice(0, 5) as category}
								<span class="tag">{category}</span>
							{/each}
							{#if sopStats.categories.size > 5}
								<span class="tag more">+{sopStats.categories.size - 5}</span>
							{/if}
						</div>
					</div>

					<div class="progress-indicator">
						<div class="progress-bar">
							<div
								class="progress-fill"
								style={`width: ${sops ? '100' : '0'}%`}
							></div>
						</div>
						<span class="progress-text">{sops ? '100% Complete' : 'Not started'}</span>
					</div>
				</div>

				<div class="card-actions">
					{#if sops}
						<button
							class="btn btn-secondary"
							onclick={() => exportDocument('sop')}
						>
							Download DOCX
						</button>
					{:else}
						<button
							class="btn btn-primary"
							onclick={generateSOP}
							disabled={generatingSOP}
						>
							{generatingSOP ? 'Generating...' : 'Generate SOPs'}
						</button>
					{/if}
				</div>
			</div>
		</div>

		<!-- Loading Animation -->
		{#if generatingHandbook || generatingSOP}
			<div class="loading-overlay">
				<div class="loading-content">
					<div class="einstein-animation">
						E = MC²
					</div>
					<p>Generating your operations documents...</p>
					<p class="loading-subtext">
						{generatingHandbook && 'Analyzing compliance requirements and handbook content...'}
						{generatingSOP && 'Building SOP procedures for your operations...'}
					</p>
				</div>
			</div>
		{/if}
	</div>

	<PageNav
		backHref="/app/loans"
		backLabel="Loan Package"
	/>
{/if}

<style>
	.operations-page {
		display: flex;
		flex-direction: column;
		gap: 32px;
		position: relative;
	}

	/* Header Section */
	.header-section {
		background: linear-gradient(135deg, var(--teal-bg), var(--green-soft));
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 40px;
		text-align: center;
	}

	.header-content h1 {
		font-size: 36px;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 8px 0;
		background: linear-gradient(135deg, var(--accent), var(--success));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.tagline {
		font-size: 18px;
		color: var(--accent);
		font-weight: 600;
		margin: 0 0 16px 0;
		letter-spacing: 1px;
	}

	.description {
		font-size: 14px;
		color: var(--text-dim);
		margin: 0;
	}

	/* Context Card */
	.context-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 24px;
	}

	.context-card h3 {
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-tertiary);
		letter-spacing: 1px;
		margin: 0 0 16px 0;
	}

	.context-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
	}

	.context-item {
		background: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px;
	}

	.context-item label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-tertiary);
		letter-spacing: 1px;
		display: block;
		margin-bottom: 6px;
	}

	.context-item p {
		font-size: 14px;
		color: var(--text);
		margin: 0;
		font-weight: 500;
	}

	.context-item p.capitalize {
		text-transform: capitalize;
	}

	/* Generation Grid */
	.generation-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
		gap: 24px;
	}

	.generation-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		transition: all 0.2s ease;
	}

	.generation-card:hover {
		border-color: var(--border-hover);
		box-shadow: var(--shadow-lg);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.card-header h2 {
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
		margin: 0;
	}

	.status-badge {
		font-size: 12px;
		font-weight: 600;
		padding: 6px 12px;
		border-radius: 6px;
		background: var(--teal-bg);
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.status-badge.generated {
		background: var(--green-soft);
		color: var(--success);
	}

	.card-content {
		display: flex;
		flex-direction: column;
		gap: 16px;
		flex: 1;
	}

	.card-description {
		font-size: 13px;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.5;
	}

	/* Sections List */
	.sections-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.sections-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-tertiary);
		letter-spacing: 1px;
		margin: 0 0 8px 0;
	}

	.sections-list ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.sections-list li {
		font-size: 13px;
		color: var(--text-secondary);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.sections-list li.more-item {
		color: var(--accent);
		font-weight: 500;
	}

	.checkmark {
		color: var(--success);
		font-weight: 600;
		width: 16px;
		text-align: center;
	}

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}

	.stat {
		background: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px;
		text-align: center;
	}

	.stat-number {
		font-size: 20px;
		font-weight: 700;
		color: var(--accent);
		margin-bottom: 4px;
	}

	.stat-label {
		font-size: 11px;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	/* Categories List */
	.categories-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.categories-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-tertiary);
		letter-spacing: 1px;
		margin: 0 0 8px 0;
	}

	.category-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.tag {
		font-size: 12px;
		padding: 4px 10px;
		border-radius: 4px;
		background: var(--teal-bg);
		color: var(--accent);
		font-weight: 500;
		white-space: nowrap;
	}

	.tag.more {
		background: var(--green-soft);
		color: var(--success);
	}

	/* Progress Indicator */
	.progress-indicator {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.progress-bar {
		height: 6px;
		background: var(--surface-alt);
		border-radius: 3px;
		overflow: hidden;
		border: 1px solid var(--border);
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--accent), var(--success));
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.progress-text {
		font-size: 11px;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-weight: 600;
	}

	/* Buttons */
	.card-actions {
		display: flex;
		gap: 12px;
		padding-top: 12px;
	}

	.btn {
		flex: 1;
		padding: 10px 16px;
		border-radius: 8px;
		border: none;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: center;
		text-decoration: none;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: inherit;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		background: linear-gradient(135deg, var(--accent), #cc7d1a);
		color: white;
		font-weight: 700;
		box-shadow: 0 4px 16px rgba(180, 83, 9, 0.2);
	}

	.btn-primary:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 6px 24px rgba(180, 83, 9, 0.3);
	}

	.btn-primary:active:not(:disabled) {
		transform: translateY(0);
	}

	.btn-secondary {
		background: var(--surface-alt);
		color: var(--accent);
		border: 1px solid var(--border);
	}

	.btn-secondary:hover {
		background: var(--bg);
		border-color: var(--accent);
	}

	/* Loading Overlay */
	.loading-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.3s ease;
	}

	.loading-content {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
	}

	.einstein-animation {
		font-size: 48px;
		font-weight: 700;
		letter-spacing: 3px;
		background: linear-gradient(135deg, var(--accent), var(--success));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		animation: pulse-text 2s infinite;
	}

	.loading-content p {
		font-size: 16px;
		color: var(--text);
		margin: 0;
		font-weight: 600;
	}

	.loading-subtext {
		font-size: 13px;
		color: var(--text-secondary);
		margin: 0;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes pulse-text {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.header-section {
			padding: 24px;
		}

		.header-content h1 {
			font-size: 24px;
		}

		.tagline {
			font-size: 14px;
		}

		.generation-grid {
			grid-template-columns: 1fr;
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}

		.context-grid {
			grid-template-columns: 1fr;
		}

		.einstein-animation {
			font-size: 36px;
		}
	}
</style>
