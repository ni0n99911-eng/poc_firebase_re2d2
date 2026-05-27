<script lang="ts">
	import { onMount } from 'svelte';
	import PageNav from '$lib/components/PageNav.svelte';
	import DisclaimerBanner from '$lib/components/DisclaimerBanner.svelte';
	import { authedFetch } from '$lib/authed-fetch';

	interface VaultItem {
		id: string;
		property_addr: string;
		item_type: 'note' | 'file' | 'contact' | 'milestone' | 'link';
		title: string;
		body: string;
		file_path: string;
		file_type: string;
		file_size: number;
		tags: string[];
		metadata: Record<string, unknown>;
		pinned: boolean;
		created_at: string;
		updated_at: string;
	}

	// State
	let items: VaultItem[] = $state([]);
	let loading = $state(true);
	let error = $state('');
	let activeProperty = $state('all');
	let activeType = $state('all');
	let properties: string[] = $state([]);

	// New item form
	let showNewForm = $state(false);
	let newType: VaultItem['item_type'] = $state('note');
	let newTitle = $state('');
	let newBody = $state('');
	let newProperty = $state('');
	let newTags = $state('');
	let newContactPhone = $state('');
	let newContactEmail = $state('');
	let newContactRole = $state('');
	let saving = $state(false);

	// File upload
	let fileInput: HTMLInputElement | null = $state(null);
	let uploading = $state(false);

	let filteredItems = $derived.by(() => {
		let filtered = items;
		if (activeProperty !== 'all') {
			filtered = filtered.filter(i => i.property_addr === activeProperty);
		}
		if (activeType !== 'all') {
			filtered = filtered.filter(i => i.item_type === activeType);
		}
		return filtered;
	});

	// Group items by property
	let groupedItems = $derived.by(() => {
		const groups: Record<string, VaultItem[]> = {};
		for (const item of filteredItems) {
			const key = item.property_addr || 'General';
			if (!groups[key]) groups[key] = [];
			groups[key].push(item);
		}
		return groups;
	});

	onMount(async () => {
		await loadItems();

		// Load properties from shortlisted locations
		try {
			const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
			const pinned = lp.shortlistedLocations || [];
			const addrs = pinned.map((p: { addr?: string; address?: string }) => p.addr || p.address || '').filter(Boolean);
			// Also get unique properties from vault items
			const vaultProps = [...new Set(items.map(i => i.property_addr).filter(Boolean))];
			properties = [...new Set([...addrs, ...vaultProps])];
		} catch {}
	});

	async function loadItems() {
		loading = true;
		error = '';
		try {
			const params = new URLSearchParams();
			if (activeProperty !== 'all') params.set('property', activeProperty);
			if (activeType !== 'all') params.set('type', activeType);
			const res = await authedFetch(`/api/vault?${params.toString()}`);
			if (res.ok) {
				const data = await res.json();
				items = data.items || [];
			} else {
				const err = await res.json();
				error = err.error || 'Failed to load vault';
			}
		} catch {
			error = 'Failed to load vault';
		} finally {
			loading = false;
		}
	}

	async function saveItem() {
		if (!newTitle.trim()) { error = 'Title is required'; return; }
		saving = true;
		error = '';
		try {
			const payload: Record<string, unknown> = {
				item_type: newType,
				title: newTitle.trim(),
				body: newBody.trim(),
				property_addr: newProperty,
				tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
			};
			if (newType === 'contact') {
				payload.metadata = {
					phone: newContactPhone,
					email: newContactEmail,
					role: newContactRole,
				};
			}
			const res = await authedFetch('/api/vault', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			if (res.ok) {
				const data = await res.json();
				items = [data.item, ...items];
				resetForm();
			} else {
				const err = await res.json();
				error = err.error || 'Failed to save';
			}
		} catch {
			error = 'Failed to save';
		} finally {
			saving = false;
		}
	}

	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		uploading = true;
		error = '';
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('property_addr', newProperty || activeProperty === 'all' ? '' : activeProperty);
			formData.append('title', file.name);
			formData.append('tags', newTags || '');

			const res = await authedFetch('/api/vault/upload', {
				method: 'POST',
				body: formData,
			});
			if (res.ok) {
				const data = await res.json();
				items = [data.item, ...items];
			} else {
				const err = await res.json();
				error = err.error || 'Upload failed';
			}
		} catch {
			error = 'Upload failed';
		} finally {
			uploading = false;
			if (fileInput) fileInput.value = '';
		}
	}

	async function deleteItem(id: string) {
		try {
			const res = await authedFetch(`/api/vault?id=${id}`, { method: 'DELETE' });
			if (res.ok) {
				items = items.filter(i => i.id !== id);
			}
		} catch {}
	}

	async function togglePin(item: VaultItem) {
		try {
			const res = await authedFetch('/api/vault', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: item.id, pinned: !item.pinned }),
			});
			if (res.ok) {
				const data = await res.json();
				items = items.map(i => i.id === item.id ? data.item : i);
			}
		} catch {}
	}

	function resetForm() {
		showNewForm = false;
		newType = 'note';
		newTitle = '';
		newBody = '';
		newTags = '';
		newContactPhone = '';
		newContactEmail = '';
		newContactRole = '';
	}

	function formatDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function typeIcon(type: string): string {
		switch (type) {
			case 'note': return '📝';
			case 'file': return '📎';
			case 'contact': return '👤';
			case 'milestone': return '🏁';
			case 'link': return '🔗';
			default: return '📄';
		}
	}

	function fileIcon(mimeType: string): string {
		if (mimeType.startsWith('image/')) return '🖼';
		if (mimeType === 'application/pdf') return '📑';
		if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) return '📊';
		if (mimeType.includes('document') || mimeType.includes('word')) return '📄';
		return '📎';
	}
</script>

<svelte:head>
	<title>RE² — Data Vault</title>
</svelte:head>

<div class="page">
	<DisclaimerBanner />

	<div class="page-header">
		<div class="header-row">
			<div>
				<h1>Data Vault</h1>
				<p class="subtitle">Your property CRM — documents, notes, contacts, and milestones.</p>
			</div>
			<div class="header-actions">
				<button class="btn-upload" onclick={() => fileInput?.click()} disabled={uploading}>
					{uploading ? '...' : '📎 Upload File'}
				</button>
				<button class="btn-add" onclick={() => { showNewForm = !showNewForm; }}>
					{showNewForm ? '✕ Cancel' : '+ Add Item'}
				</button>
				<input type="file" bind:this={fileInput} onchange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.xlsx,.csv,.txt" style="display:none">
			</div>
		</div>

		<!-- Filter bar -->
		<div class="filter-bar">
			<div class="filter-group">
				<span class="filter-label">Property</span>
				<select bind:value={activeProperty} onchange={loadItems}>
					<option value="all">All properties</option>
					<option value="">General</option>
					{#each properties as prop}
						<option value={prop}>{prop.length > 40 ? prop.slice(0, 40) + '...' : prop}</option>
					{/each}
				</select>
			</div>
			<div class="filter-group">
				<span class="filter-label">Type</span>
				<select bind:value={activeType} onchange={loadItems}>
					<option value="all">All types</option>
					<option value="note">📝 Notes</option>
					<option value="file">📎 Files</option>
					<option value="contact">👤 Contacts</option>
					<option value="milestone">🏁 Milestones</option>
					<option value="link">🔗 Links</option>
				</select>
			</div>
			<div class="filter-count">{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}</div>
		</div>
	</div>

	{#if error}
		<div class="error-banner"><span>✕</span> {error}</div>
	{/if}

	<!-- New item form -->
	{#if showNewForm}
		<div class="new-form">
			<div class="form-row">
				<div class="form-field">
					<label for="vault-type">Type</label>
					<select id="vault-type" bind:value={newType}>
						<option value="note">📝 Note</option>
						<option value="contact">👤 Contact</option>
						<option value="milestone">🏁 Milestone</option>
						<option value="link">🔗 Link</option>
					</select>
				</div>
				<div class="form-field" style="flex:2">
					<label for="vault-title">Title</label>
					<input id="vault-title" type="text" bind:value={newTitle} placeholder={newType === 'contact' ? 'Contact name' : newType === 'milestone' ? 'Milestone name' : 'Title'}>
				</div>
			</div>
			<div class="form-row">
				<div class="form-field" style="flex:2">
					<label for="vault-body">{newType === 'link' ? 'URL' : newType === 'contact' ? 'Notes' : 'Details'}</label>
					<textarea id="vault-body" bind:value={newBody} rows="3" placeholder={newType === 'link' ? 'https://...' : 'Details...'}></textarea>
				</div>
			</div>
			{#if newType === 'contact'}
				<div class="form-row">
					<div class="form-field"><label for="vault-phone">Phone</label><input id="vault-phone" type="text" bind:value={newContactPhone} placeholder="(555) 123-4567"></div>
					<div class="form-field"><label for="vault-email">Email</label><input id="vault-email" type="email" bind:value={newContactEmail} placeholder="name@example.com"></div>
					<div class="form-field"><label for="vault-role">Role</label><input id="vault-role" type="text" bind:value={newContactRole} placeholder="Broker, Landlord, etc."></div>
				</div>
			{/if}
			<div class="form-row">
				<div class="form-field">
					<label for="vault-property">Property</label>
					<select id="vault-property" bind:value={newProperty}>
						<option value="">General</option>
						{#each properties as prop}
							<option value={prop}>{prop.length > 50 ? prop.slice(0, 50) + '...' : prop}</option>
						{/each}
					</select>
				</div>
				<div class="form-field">
					<label for="vault-tags">Tags (comma-separated)</label>
					<input id="vault-tags" type="text" bind:value={newTags} placeholder="LOI, lease, photos">
				</div>
			</div>
			<div class="form-actions">
				<button class="btn-save" onclick={saveItem} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
				<button class="btn-cancel" onclick={resetForm}>Cancel</button>
			</div>
		</div>
	{/if}

	<!-- Items list -->
	<div class="vault-content">
		{#if loading}
			<div class="empty-state"><div class="spinner"></div> Loading vault...</div>
		{:else if filteredItems.length === 0}
			<div class="empty-state">
				<div class="empty-icon">🗄</div>
				<div class="empty-title">Your vault is empty</div>
				<div class="empty-sub">Add notes, upload documents, save contacts and milestones for your properties.</div>
				<button class="btn-add" onclick={() => { showNewForm = true; }}>+ Add your first item</button>
			</div>
		{:else}
			{#each Object.entries(groupedItems) as [property, group]}
				<div class="property-group">
					{#if Object.keys(groupedItems).length > 1}
						<div class="property-label">{property === '' ? 'General' : property}</div>
					{/if}
					{#each group as item (item.id)}
						<div class="vault-item" class:pinned={item.pinned}>
							<div class="item-left">
								<span class="item-icon">{item.item_type === 'file' ? fileIcon(item.file_type) : typeIcon(item.item_type)}</span>
							</div>
							<div class="item-main">
								<div class="item-title-row">
									<span class="item-title">{item.title}</span>
									{#if item.pinned}<span class="pin-badge">📌</span>{/if}
									{#if item.item_type === 'file' && item.file_size > 0}
										<span class="item-size">{formatSize(item.file_size)}</span>
									{/if}
								</div>
								{#if item.body}
									<div class="item-body">{item.body.length > 150 ? item.body.slice(0, 150) + '...' : item.body}</div>
								{/if}
								{#if item.item_type === 'contact' && item.metadata}
									<div class="item-contact">
										{#if item.metadata.role}<span class="contact-role">{item.metadata.role}</span>{/if}
										{#if item.metadata.phone}<span class="contact-detail">📞 {item.metadata.phone}</span>{/if}
										{#if item.metadata.email}<span class="contact-detail">✉ {item.metadata.email}</span>{/if}
									</div>
								{/if}
								<div class="item-meta">
									<span class="item-date">{formatDate(item.created_at)}</span>
									{#if item.tags.length > 0}
										{#each item.tags as tag}
											<span class="item-tag">{tag}</span>
										{/each}
									{/if}
								</div>
							</div>
							<div class="item-actions">
								<button class="item-action" onclick={() => togglePin(item)} title={item.pinned ? 'Unpin' : 'Pin'}>📌</button>
								<button class="item-action danger" onclick={() => deleteItem(item.id)} title="Delete">✕</button>
							</div>
						</div>
					{/each}
				</div>
			{/each}
		{/if}
	</div>

	<PageNav
		backHref="/app/dashboard"
		backLabel="Dashboard"
	/>
</div>

<style>
	:global(body) { background-color: var(--white); color: var(--text); }

	.page { max-width: 900px; margin: 0 auto; padding: 1.5rem 1rem; }

	/* Header */
	.page-header { margin-bottom: 1.5rem; }
	.header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
	.page-header h1 { font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 700; margin: 0; color: var(--text); }
	.subtitle { font-family: 'Courier New', monospace; font-size: 13px; margin: 4px 0 0; color: var(--text-secondary); }
	.header-actions { display: flex; gap: 8px; }
	.btn-add, .btn-upload { padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: var(--surface-alt); color: var(--text-secondary); transition: all 0.2s; }
	.btn-add:hover, .btn-upload:hover { border-color: var(--accent); color: var(--text); }
	.btn-upload:disabled { opacity: 0.5; cursor: not-allowed; }

	/* Filter bar */
	.filter-bar { display: flex; align-items: center; gap: 16px; padding: 10px 14px; background: var(--surface-alt); border: 1px solid var(--border); border-radius: 8px; flex-wrap: wrap; }
	.filter-group { display: flex; align-items: center; gap: 6px; }
	.filter-label { font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }
	.filter-group select { font-size: 13px; border: none; background: transparent; color: var(--text); font-weight: 600; cursor: pointer; }
	.filter-count { margin-left: auto; font-size: 12px; color: var(--text-tertiary); font-family: 'Courier New', monospace; }

	/* Error */
	.error-banner { display: flex; gap: 8px; padding: 10px 14px; background: var(--red-soft); border: 1px solid rgba(220, 38, 38, 0.2); border-radius: 8px; margin-bottom: 12px; font-size: 13px; color: var(--danger); }

	/* New form */
	.new-form { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
	.form-row { display: flex; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
	.form-field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 140px; }
	.form-field label { font-size: 11px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.3px; }
	.form-field input, .form-field select, .form-field textarea { font-size: 13px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--white); color: var(--text); font-family: inherit; }
	.form-field textarea { resize: vertical; min-height: 60px; }
	.form-field input:focus, .form-field select:focus, .form-field textarea:focus { outline: none; border-color: var(--accent); }
	.form-actions { display: flex; gap: 8px; margin-top: 4px; }
	.btn-save { padding: 8px 20px; border-radius: 8px; border: none; background: #1e3a2a; color: white; font-size: 13px; font-weight: 600; cursor: pointer; }
	.btn-save:hover:not(:disabled) { background: #2d5a3d; }
	.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-cancel { padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border); background: none; color: var(--text-secondary); font-size: 13px; cursor: pointer; }

	/* Vault content */
	.vault-content { display: flex; flex-direction: column; gap: 8px; }

	/* Empty state */
	.empty-state { text-align: center; padding: 60px 24px; color: var(--text-secondary); }
	.empty-icon { font-size: 48px; margin-bottom: 12px; }
	.empty-title { font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
	.empty-sub { font-size: 13px; margin-bottom: 20px; max-width: 360px; margin-left: auto; margin-right: auto; line-height: 1.5; }
	.spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px; }
	@keyframes spin { to { transform: rotate(360deg); } }

	/* Property group */
	.property-group { margin-bottom: 8px; }
	.property-label { font-size: 12px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.4px; padding: 8px 0 4px; border-bottom: 1px solid var(--border); margin-bottom: 6px; }

	/* Vault item */
	.vault-item { display: flex; gap: 12px; padding: 12px 14px; background: var(--surface-alt); border: 1px solid var(--border); border-radius: 8px; transition: all 0.15s; }
	.vault-item:hover { border-color: rgba(180, 83, 9, 0.2); }
	.vault-item.pinned { border-color: rgba(180, 83, 9, 0.3); background: rgba(180, 83, 9, 0.03); }
	.item-left { flex-shrink: 0; font-size: 20px; padding-top: 2px; }
	.item-main { flex: 1; min-width: 0; }
	.item-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
	.item-title { font-size: 14px; font-weight: 700; color: var(--text); }
	.pin-badge { font-size: 11px; }
	.item-size { font-size: 11px; color: var(--text-tertiary); font-family: 'Courier New', monospace; }
	.item-body { font-size: 13px; color: var(--text-secondary); margin-top: 4px; line-height: 1.5; }
	.item-contact { display: flex; gap: 12px; margin-top: 6px; flex-wrap: wrap; }
	.contact-role { font-size: 12px; font-weight: 600; color: var(--accent); background: rgba(180, 83, 9, 0.08); padding: 2px 8px; border-radius: 6px; }
	.contact-detail { font-size: 12px; color: var(--text-secondary); }
	.item-meta { display: flex; gap: 6px; margin-top: 6px; align-items: center; flex-wrap: wrap; }
	.item-date { font-size: 11px; color: var(--text-tertiary); font-family: 'Courier New', monospace; }
	.item-tag { font-size: 10px; color: var(--accent); background: rgba(180, 83, 9, 0.08); padding: 2px 6px; border-radius: 6px; font-weight: 600; }
	.item-actions { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
	.item-action { background: none; border: none; cursor: pointer; font-size: 13px; padding: 4px; border-radius: 4px; opacity: 0.4; transition: opacity 0.15s; }
	.item-action:hover { opacity: 1; }
	.item-action.danger:hover { color: var(--danger); }

	/* Responsive */
	@media (max-width: 640px) {
		.header-row { flex-direction: column; }
		.page-header h1 { font-size: 20px; }
		.filter-bar { flex-direction: column; align-items: stretch; }
		.filter-count { margin-left: 0; }
		.form-row { flex-direction: column; }
	}
</style>
