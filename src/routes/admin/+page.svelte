<script lang="ts">
	import { page } from '$app/stores';
	import type { PageServerData } from './$types';
	import { authedFetch } from '$lib/authed-fetch';

	interface User {
		id: string;
		name: string;
		email: string;
		role: 'owner' | 'member' | 'pending' | 'viewer';
		created_at: string;
		modules: string[];
	}

	interface WhitelistEntry {
		id: string;
		email: string;
		modules: string[];
		added_by: string | null;
		created_at: string;
	}

	interface WaitlistEntry {
		id: string;
		email_address: string;
		status: 'pending' | 'accepted' | 'rejected';
		created_at: number;
		updated_at: number;
	}

	const AVAILABLE_MODULES = ['location-einstein', 'space-einstein', 'business-einstein', 'loan-einstein', 'launch-einstein', 'operations-einstein'];
	const MODULE_LABELS: Record<string, string> = {
		'location-einstein': '📍 Location IQ',
		'space-einstein': '🏢 Space IQ',
		'business-einstein': '📊 Business Case',
		'loan-einstein': '🏦 Loan IQ',
		'launch-einstein': '🚀 Launch Kit',
		'operations-einstein': '📋 Operations'
	};

	// Tier presets for quick provisioning
	const TIER_PRESETS: Record<string, { label: string; modules: string[] }> = {
		founder: {
			label: '🆓 Founder (Free)',
			modules: ['location-einstein']
		},
		pro: {
			label: '⭐ Pro ($99/mo)',
			modules: ['location-einstein', 'space-einstein', 'business-einstein', 'loan-einstein', 'operations-einstein']
		},
		enterprise: {
			label: '🏆 Enterprise ($199/mo)',
			modules: ['location-einstein', 'space-einstein', 'business-einstein', 'loan-einstein', 'launch-einstein', 'operations-einstein']
		}
	};

	let { data }: { data: PageServerData } = $props();

	let users: User[] = $state(data.users);
	let whitelist: WhitelistEntry[] = $state(data.whitelist);
	let waitlist: WaitlistEntry[] = $state([]);
	let waitlistLoading = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	// UI states
	let activeTab = $state<'users' | 'whitelist' | 'waitlist'>('users');
	let expandedUserId = $state<string | null>(null);
	let showApprovalModal = $state(false);
	let approvalUserId = $state<string | null>(null);
	let approvalModules = $state<string[]>([]);

	let whitelistEmail = $state('');
	let whitelistModules = $state<string[]>([]);
	let editingWhitelist = $state<string | null>(null);

	// Track pending module changes per user (before saving)
	let pendingModules = $state<Record<string, string[]>>({});
	let hasPendingChanges = $derived.by(() => {
		return Object.keys(pendingModules).length > 0;
	});

	async function callAdminAPI(action: string, payload: Record<string, unknown>, skipReload = false) {
		loading = true;
		error = null;
		success = null;

		try {
			const response = await authedFetch('/api/admin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, ...payload })
			});

			if (!response.ok) {
				let err: { message?: string } = { message: 'Unknown error' };
				try {
					err = await response.json();
				} catch (e) {
					err = { message: `HTTP ${response.status}: ${response.statusText}` };
				}
				throw new Error(err.message || 'API error');
			}

			const result = await response.json();
			success = result.message || 'Success';

			// Reload data (unless caller handles it)
			if (!skipReload) await reloadData();
			return result;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
			console.error('Admin API error:', err);
			throw err;
		} finally {
			loading = false;
		}
	}

	async function reloadData() {
		try {
			const res = await fetch(window.location.pathname, {
				headers: { 'Accept': 'application/json' }
			});
			if (res.ok) {
				// SvelteKit returns __data.json for data requests
				window.location.reload();
			} else {
				window.location.reload();
			}
		} catch (err) {
			console.error('Failed to reload data:', err);
			window.location.reload();
		}
	}

	async function loadWaitlist() {
		waitlistLoading = true;
		error = null;

		try {
			const response = await authedFetch('/api/admin/waitlist?status=pending', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			if (!response.ok) {
				let err: { message?: string } = { message: 'Unknown error' };
				try {
					err = await response.json();
				} catch (e) {
					err = { message: `HTTP ${response.status}: ${response.statusText}` };
				}
				throw new Error(err.message || 'API error');
			}

			const result = await response.json();
			waitlist = result.entries || [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load waitlist';
			console.error('Waitlist load error:', err);
		} finally {
			waitlistLoading = false;
		}
	}

	async function callWaitlistAPI(action: string, payload: Record<string, unknown>) {
		loading = true;
		error = null;
		success = null;

		try {
			const response = await authedFetch('/api/admin/waitlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, ...payload })
			});

			if (!response.ok) {
				let err: { message?: string } = { message: 'Unknown error' };
				try {
					err = await response.json();
				} catch (e) {
					err = { message: `HTTP ${response.status}: ${response.statusText}` };
				}
				throw new Error(err.message || 'API error');
			}

			const result = await response.json();
			success = result.message || 'Success';

			// Reload waitlist
			await loadWaitlist();
			return result;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
			console.error('Waitlist API error:', err);
			throw err;
		} finally {
			loading = false;
		}
	}

	async function approveUser() {
		if (!approvalUserId) return;

		try {
			await callAdminAPI('approveUser', {
				userId: approvalUserId,
				role: 'member',
				modules: approvalModules
			});

			showApprovalModal = false;
			approvalUserId = null;
			approvalModules = [];
		} catch (err) {
			console.error('Approval error:', err);
		}
	}

	async function denyUser(userId: string) {
		if (!confirm('Are you sure? This will remove the user permanently.')) return;

		try {
			await callAdminAPI('denyUser', { userId });
			expandedUserId = null;
		} catch (err) {
			console.error('Deny error:', err);
		}
	}

	function toggleModuleLocal(userId: string, module: string) {
		const user = users.find(u => u.id === userId);
		if (!user) return;

		// Initialize pending from current state if not already tracking
		if (!pendingModules[userId]) {
			pendingModules[userId] = [...user.modules];
		}

		const current = pendingModules[userId];
		if (current.includes(module)) {
			pendingModules[userId] = current.filter(m => m !== module);
		} else {
			pendingModules[userId] = [...current, module];
		}
		// Trigger reactivity
		pendingModules = { ...pendingModules };
	}

	function getUserModules(userId: string): string[] {
		const user = users.find(u => u.id === userId);
		return pendingModules[userId] || user?.modules || [];
	}

	function userHasChanges(userId: string): boolean {
		if (!pendingModules[userId]) return false;
		const user = users.find(u => u.id === userId);
		if (!user) return false;
		const orig = [...user.modules].sort();
		const curr = [...pendingModules[userId]].sort();
		return JSON.stringify(orig) !== JSON.stringify(curr);
	}

	async function saveModuleChanges(userId: string) {
		const user = users.find(u => u.id === userId);
		if (!user || !pendingModules[userId]) return;

		const newModules = pendingModules[userId];
		const oldModules = user.modules;

		try {
			// Grant new modules
			for (const mod of newModules) {
				if (!oldModules.includes(mod)) {
					await callAdminAPI('updateModules', { userId, module: mod, grant: true }, true);
				}
			}
			// Revoke removed modules
			for (const mod of oldModules) {
				if (!newModules.includes(mod)) {
					await callAdminAPI('updateModules', { userId, module: mod, grant: false }, true);
				}
			}

			// Clear pending state and reload once
			delete pendingModules[userId];
			pendingModules = { ...pendingModules };
			success = 'Module access updated successfully';
			await reloadData();
		} catch (err) {
			console.error('Save modules error:', err);
		}
	}

	function selectAllModules(userId: string) {
		pendingModules[userId] = [...AVAILABLE_MODULES];
		pendingModules = { ...pendingModules };
	}

	function selectTierModules(userId: string, tier: string) {
		const preset = TIER_PRESETS[tier];
		if (preset) {
			pendingModules[userId] = [...preset.modules];
			pendingModules = { ...pendingModules };
		}
	}

	function setApprovalTier(tier: string) {
		const preset = TIER_PRESETS[tier];
		if (preset) {
			approvalModules = [...preset.modules];
		}
	}

	async function deleteUser(userId: string) {
		if (!confirm('Are you sure? This will permanently remove the user.')) return;

		try {
			await callAdminAPI('deleteUser', { userId });
			expandedUserId = null;
		} catch (err) {
			console.error('Delete error:', err);
		}
	}

	async function addToWhitelist() {
		if (!whitelistEmail.trim()) {
			error = 'Please enter an email';
			return;
		}

		try {
			await callAdminAPI('addWhitelist', {
				email: whitelistEmail,
				modules: whitelistModules
			});

			whitelistEmail = '';
			whitelistModules = [];
		} catch (err) {
			console.error('Add whitelist error:', err);
		}
	}

	async function removeFromWhitelist(email: string) {
		if (!confirm(`Remove ${email} from whitelist?`)) return;

		try {
			await callAdminAPI('removeWhitelist', { email });
		} catch (err) {
			console.error('Remove whitelist error:', err);
		}
	}

	async function updateWhitelistModules(email: string, modules: string[]) {
		try {
			await callAdminAPI('updateWhitelistModules', { email, modules });
			editingWhitelist = null;
		} catch (err) {
			console.error('Update whitelist modules error:', err);
		}
	}

	function toggleWhitelistModule(modules: string[], module: string): string[] {
		if (modules.includes(module)) {
			return modules.filter(m => m !== module);
		} else {
			return [...modules, module];
		}
	}

	function toggleApprovalModule(module: string) {
		if (approvalModules.includes(module)) {
			approvalModules = approvalModules.filter(m => m !== module);
		} else {
			approvalModules = [...approvalModules, module];
		}
	}

	function toggleWhitelistFormModule(module: string) {
		if (whitelistModules.includes(module)) {
			whitelistModules = whitelistModules.filter(m => m !== module);
		} else {
			whitelistModules = [...whitelistModules, module];
		}
	}

	async function approveWaitlistEntry(waitlistId: string) {
		try {
			await callWaitlistAPI('approveWaitlist', { waitlistId });
		} catch (err) {
			console.error('Approve waitlist error:', err);
		}
	}

	async function denyWaitlistEntry(waitlistId: string) {
		if (!confirm('Are you sure? This will deny the waitlist entry permanently.')) return;

		try {
			await callWaitlistAPI('denyWaitlist', { waitlistId });
		} catch (err) {
			console.error('Deny waitlist error:', err);
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getRoleColor(role: string): string {
		switch (role) {
			case 'owner':
				return 'var(--accent)';
			case 'member':
				return 'var(--work)';
			case 'viewer':
				return 'var(--personal)';
			case 'pending':
				return 'var(--coffee)';
			default:
				return 'var(--text-dim)';
		}
	}

	function getPendingUsers(): User[] {
		return users.filter(u => u.role === 'pending');
	}

	function getApprovedUsers(): User[] {
		return users.filter(u => u.role !== 'pending');
	}

	function getPendingApprovalsCount(): number {
		return users.filter(u => u.role === 'pending').length;
	}

	function getWhitelistCount(): number {
		return whitelist.length;
	}

	function getWaitlistCount(): number {
		return waitlist.length;
	}
</script>

<svelte:head><title>RE² — Admin</title></svelte:head>

<div class="admin-page">
	<!-- Header -->
	<div class="page-header">
		<h1>⚙️ Admin Console</h1>
		<p class="page-sub">Manage user access and permissions</p>
	</div>

	<!-- Visitor Stats -->
	<div class="stats-section">
		<div class="stats-header">
			<h2>📊 Visitor Stats</h2>
			<p class="stats-note">Connect Google Analytics or Plausible for real visitor stats</p>
		</div>
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-label">Total Registered Users</div>
				<div class="stat-value">{users.length}</div>
				<div class="stat-detail">All time</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Active Users (7 days)</div>
				<div class="stat-value">3</div>
				<div class="stat-detail">Simulated</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Page Views Today</div>
				<div class="stat-value">47</div>
				<div class="stat-detail">Simulated</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Most Visited Page</div>
				<div class="stat-value-text">Location IQ</div>
				<div class="stat-detail">Simulated</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Pending Approvals</div>
				<div class="stat-value">{getPendingApprovalsCount()}</div>
				<div class="stat-detail">Awaiting review</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Whitelisted Emails</div>
				<div class="stat-value">{getWhitelistCount()}</div>
				<div class="stat-detail">Pre-approved</div>
			</div>
		</div>
	</div>

	<!-- Status Messages -->
	{#if error}
		<div class="alert alert-error">
			<span class="alert-icon">⚠️</span>
			<span>{error}</span>
			<button onclick={() => (error = null)} class="alert-close">×</button>
		</div>
	{/if}

	{#if success}
		<div class="alert alert-success">
			<span class="alert-icon">✓</span>
			<span>{success}</span>
			<button onclick={() => (success = null)} class="alert-close">×</button>
		</div>
	{/if}

	<!-- Tabs -->
	<div class="tabs">
		<button
			class="tab"
			class:active={activeTab === 'users'}
			onclick={() => (activeTab = 'users')}
			disabled={loading}
		>
			Users ({users.length})
		</button>
		<button
			class="tab"
			class:active={activeTab === 'whitelist'}
			onclick={() => (activeTab = 'whitelist')}
			disabled={loading}
		>
			Whitelist ({whitelist.length})
		</button>
		<button
			class="tab"
			class:active={activeTab === 'waitlist'}
			onclick={() => {
				activeTab = 'waitlist';
				if (waitlist.length === 0) {
					loadWaitlist();
				}
			}}
			disabled={loading}
		>
			Waitlist ({getWaitlistCount()})
		</button>
	</div>

	<!-- Users Tab -->
	{#if activeTab === 'users'}
		<div class="tab-content">
			<!-- Pending Users -->
			{#if getPendingUsers().length > 0}
				<div class="section">
					<div class="section-header">
						<h2>⏳ Pending Approval ({getPendingUsers().length})</h2>
					</div>

					<div class="users-list">
						{#each getPendingUsers() as user (user.id)}
							<div class="user-card pending">
								<div class="user-card-header">
									<div class="user-info">
										<div class="user-avatar" style="background: var(--coffee-dim); border-color: var(--coffee);">
											{user.name.charAt(0).toUpperCase()}
										</div>
										<div class="user-details">
											<div class="user-name">{user.name}</div>
											<div class="user-email">{user.email}</div>
											<div class="user-joined">Joined {formatDate(user.created_at)}</div>
										</div>
									</div>

									<div class="user-actions">
										<button
											class="btn btn-accent"
											onclick={() => {
												approvalUserId = user.id;
												approvalModules = [...TIER_PRESETS.founder.modules];
												showApprovalModal = true;
											}}
											disabled={loading}
										>
											Approve
										</button>
										<button
											class="btn btn-danger"
											onclick={() => denyUser(user.id)}
											disabled={loading}
										>
											Deny
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Approved Users -->
			{#if getApprovedUsers().length > 0}
				<div class="section" style={getPendingUsers().length > 0 ? 'margin-top: 32px' : ''}>
					<div class="section-header">
						<h2>✓ Approved Users ({getApprovedUsers().length})</h2>
					</div>

					<div class="users-list">
						{#each getApprovedUsers() as user (user.id)}
							<div class="user-card" class:expanded={expandedUserId === user.id}>
								<div class="user-card-header" onclick={() => (expandedUserId = expandedUserId === user.id ? null : user.id)}>
									<div class="user-info">
										<div class="user-avatar">
											{user.name.charAt(0).toUpperCase()}
										</div>
										<div class="user-details">
											<div class="user-name">{user.name}</div>
											<div class="user-email">{user.email}</div>
											<div class="user-meta">
												<span class="role-badge" style="color: {getRoleColor(user.role)}">
													{user.role.toUpperCase()}
												</span>
												<span class="joined-text">Joined {formatDate(user.created_at)}</span>
											</div>
										</div>
									</div>

									<div class="user-modules-compact">
										{#each user.modules as module}
											<span class="module-badge">{MODULE_LABELS[module] || module}</span>
										{/each}
										{#if user.modules.length === 0}
											<span class="module-badge empty">No access</span>
										{/if}
									</div>

									<div class="expand-icon" class:rotated={expandedUserId === user.id}>
										▶
									</div>
								</div>

								{#if expandedUserId === user.id}
									<div class="user-card-expanded">
										<!-- Modules Section -->
										<div class="expanded-section">
											<div class="module-header-row">
												<h4>Module Access</h4>
												<div class="tier-quick-btns">
													{#each Object.entries(TIER_PRESETS) as [tier, preset]}
														<button class="btn btn-small tier-quick" onclick={() => selectTierModules(user.id, tier)} disabled={loading}>
															{preset.label}
														</button>
													{/each}
												</div>
											</div>
											<div class="modules-grid">
												{#each AVAILABLE_MODULES as module}
													<label class="module-toggle">
														<input
															type="checkbox"
															checked={getUserModules(user.id).includes(module)}
															onchange={() => toggleModuleLocal(user.id, module)}
															disabled={loading}
														/>
														<span class="toggle-label">{MODULE_LABELS[module]}</span>
													</label>
												{/each}
											</div>
											{#if userHasChanges(user.id)}
												<button
													class="btn btn-accent save-modules-btn"
													onclick={() => saveModuleChanges(user.id)}
													disabled={loading}
												>
													{loading ? 'Saving...' : 'Save Changes'}
												</button>
											{/if}
										</div>

										<!-- Actions Section -->
										<div class="expanded-section">
											<h4>User Actions</h4>
											<div class="action-buttons">
												<button
													class="btn btn-danger"
													onclick={() => deleteUser(user.id)}
													disabled={loading}
												>
													Remove User
												</button>
											</div>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if users.length === 0}
				<div class="empty-state">
					<div class="empty-icon">👥</div>
					<div class="empty-text">No users yet</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Whitelist Tab -->
	{#if activeTab === 'whitelist'}
		<div class="tab-content">
			<!-- Add to Whitelist Form -->
			<div class="section">
				<div class="section-header">
					<h2>➕ Add Email to Whitelist</h2>
				</div>

				<div class="form-group">
					<label for="email-input">Email Address</label>
					<input
						id="email-input"
						type="email"
						placeholder="user@example.com"
						bind:value={whitelistEmail}
						disabled={loading}
						class="form-input"
					/>
				</div>

				<div class="form-group">
					<label>Select tier</label>
					<div class="tier-buttons">
						{#each Object.entries(TIER_PRESETS) as [tier, preset]}
							<button
								class="btn tier-btn"
								class:active={JSON.stringify([...whitelistModules].sort()) === JSON.stringify([...preset.modules].sort())}
								onclick={() => { whitelistModules = [...preset.modules]; }}
								disabled={loading}
							>
								{preset.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="form-group">
					<label>Or customize modules</label>
					<div class="modules-grid">
						{#each AVAILABLE_MODULES as module}
							<label class="module-toggle">
								<input
									type="checkbox"
									checked={whitelistModules.includes(module)}
									onchange={() => toggleWhitelistFormModule(module)}
									disabled={loading}
								/>
								<span class="toggle-label">{MODULE_LABELS[module]}</span>
							</label>
						{/each}
					</div>
				</div>

				<button
					class="btn btn-accent btn-lg"
					onclick={addToWhitelist}
					disabled={loading || !whitelistEmail.trim()}
				>
					{loading ? 'Adding...' : 'Add to Whitelist'}
				</button>
			</div>

			<!-- Current Whitelist -->
			{#if whitelist.length > 0}
				<div class="section" style="margin-top: 32px">
					<div class="section-header">
						<h2>Whitelisted Emails ({whitelist.length})</h2>
					</div>

					<div class="whitelist-list">
						{#each whitelist as entry (entry.id)}
							<div class="whitelist-row" class:editing={editingWhitelist === entry.id}>
								<div class="whitelist-email">
									<div class="email-text">{entry.email}</div>
									<div class="email-meta">
										Added {formatDate(entry.created_at)}
										{#if entry.added_by}
											by {entry.added_by}
										{/if}
									</div>
								</div>

								<div class="whitelist-modules">
									{#if editingWhitelist === entry.id}
										<div class="modules-edit">
											{#each AVAILABLE_MODULES as module}
												<label class="module-toggle-sm">
													<input
														type="checkbox"
														checked={entry.modules.includes(module)}
														onchange={() => {
															entry.modules = toggleWhitelistModule(entry.modules, module);
														}}
														disabled={loading}
													/>
													<span>{MODULE_LABELS[module]}</span>
												</label>
											{/each}
										</div>
									{:else}
										<div class="modules-display">
											{#each entry.modules as module}
												<span class="module-badge">{MODULE_LABELS[module]}</span>
											{/each}
											{#if entry.modules.length === 0}
												<span class="module-badge empty">No modules</span>
											{/if}
										</div>
									{/if}
								</div>

								<div class="whitelist-actions">
									{#if editingWhitelist === entry.id}
										<button
											class="btn btn-sm btn-accent"
											onclick={() => updateWhitelistModules(entry.email, entry.modules)}
											disabled={loading}
										>
											Save
										</button>
										<button
											class="btn btn-sm"
											onclick={() => (editingWhitelist = null)}
											disabled={loading}
										>
											Cancel
										</button>
									{:else}
										<button
											class="btn btn-sm"
											onclick={() => (editingWhitelist = entry.id)}
											disabled={loading}
										>
											Edit
										</button>
										<button
											class="btn btn-sm btn-danger"
											onclick={() => removeFromWhitelist(entry.email)}
											disabled={loading}
										>
											Remove
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="empty-state">
					<div class="empty-icon">✉️</div>
					<div class="empty-text">No whitelisted emails</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Waitlist Tab -->
	{#if activeTab === 'waitlist'}
		<div class="tab-content">
			{#if waitlistLoading}
				<div class="section">
					<div class="section-header">
						<h2>⏳ Waitlist Entries</h2>
					</div>
					<div class="empty-state">
						<div class="empty-text">Loading waitlist...</div>
					</div>
				</div>
			{:else if waitlist.length > 0}
				<div class="section">
					<div class="section-header">
						<h2>⏳ Pending Waitlist ({waitlist.length})</h2>
					</div>

					<div class="waitlist-list">
						{#each waitlist as entry (entry.id)}
							<div class="waitlist-row">
								<div class="waitlist-email">
									<div class="email-text">{entry.email_address}</div>
									<div class="email-meta">
										Joined {formatDate(new Date(entry.created_at * 1000).toISOString())}
									</div>
								</div>

								<div class="waitlist-actions">
									<button
										class="btn btn-accent"
										onclick={() => approveWaitlistEntry(entry.id)}
										disabled={loading}
									>
										{loading ? 'Approving...' : 'Approve'}
									</button>
									<button
										class="btn btn-danger"
										onclick={() => denyWaitlistEntry(entry.id)}
										disabled={loading}
									>
										Deny
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="empty-state">
					<div class="empty-icon">📋</div>
					<div class="empty-text">No pending waitlist entries</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Approval Modal -->
{#if showApprovalModal && approvalUserId}
	<div class="modal-overlay" onclick={() => (showApprovalModal = false)}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>Approve User</h3>
				<button class="modal-close" onclick={() => (showApprovalModal = false)}>×</button>
			</div>

			<div class="modal-body">
				{#each users.filter(u => u.id === approvalUserId) as user}
				{#if user}
					<div class="approval-user">
						<div class="user-avatar" style="width: 48px; height: 48px; font-size: 1.2rem">
							{user.name.charAt(0).toUpperCase()}
						</div>
						<div>
							<div class="approval-name">{user.name}</div>
							<div class="approval-email">{user.email}</div>
						</div>
					</div>

					<div class="approval-section">
						<h4>Quick Select Tier</h4>
						<div class="tier-buttons">
							{#each Object.entries(TIER_PRESETS) as [tier, preset]}
								<button
									class="btn tier-btn"
									class:active={JSON.stringify(approvalModules.sort()) === JSON.stringify([...preset.modules].sort())}
									onclick={() => setApprovalTier(tier)}
									disabled={loading}
								>
									{preset.label}
								</button>
							{/each}
						</div>
					</div>

					<div class="approval-section">
						<h4>Or Customize Modules</h4>
						<div class="modules-grid">
							{#each AVAILABLE_MODULES as module}
								<label class="module-toggle">
									<input
										type="checkbox"
										checked={approvalModules.includes(module)}
										onchange={() => toggleApprovalModule(module)}
										disabled={loading}
									/>
									<span class="toggle-label">{MODULE_LABELS[module]}</span>
								</label>
							{/each}
						</div>
					</div>
				{/if}
				{/each}
			</div>

			<div class="modal-footer">
				<button class="btn" onclick={() => (showApprovalModal = false)} disabled={loading}>
					Cancel
				</button>
				<button class="btn btn-accent" onclick={approveUser} disabled={loading}>
					{loading ? 'Approving...' : 'Approve User'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.admin-page {
		padding: 32px;
		max-width: 1400px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 32px;
	}

	/* Visitor Stats */
	.stats-section {
		margin-bottom: 40px;
	}

	.stats-header {
		margin-bottom: 20px;
	}

	.stats-header h2 {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 4px;
	}

	.stats-note {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
	}

	.stat-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 16px;
		transition: all 0.2s ease;
	}

	.stat-card:hover {
		border-color: var(--border-hover);
		background: var(--surface-alt);
	}

	.stat-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
		margin-bottom: 8px;
	}

	.stat-value {
		font-size: 1.8rem;
		font-weight: 700;
		color: var(--teal);
		margin-bottom: 6px;
	}

	.stat-value-text {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 6px;
	}

	.stat-detail {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.page-header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 4px;
	}

	.page-sub {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	/* Alerts */
	.alert {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-radius: 8px;
		margin-bottom: 20px;
		font-size: 0.85rem;
	}

	.alert-error {
		background: var(--red-soft);
		border: 1px solid rgba(220, 38, 38, 0.3);
		color: var(--red);
	}

	.alert-success {
		background: var(--green-soft);
		border: 1px solid rgba(5, 150, 105, 0.3);
		color: var(--green);
	}

	.alert-icon {
		font-size: 1rem;
		flex-shrink: 0;
	}

	.alert-close {
		margin-left: auto;
		background: none;
		border: none;
		color: inherit;
		font-size: 1.2rem;
		cursor: pointer;
		padding: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Tabs */
	.tabs {
		display: flex;
		gap: 0;
		margin-bottom: 32px;
		border-bottom: 1px solid var(--border);
	}

	.tab {
		padding: 12px 20px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.tab:hover {
		color: var(--text);
		background: var(--teal-bg);
	}

	.tab.active {
		color: var(--teal);
		border-bottom-color: var(--teal);
	}

	.tab:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tab-content {
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	/* Sections */
	.section {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.section-header h2 {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	/* Users List */
	.users-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.user-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		transition: all 0.2s ease;
	}

	.user-card:hover {
		border-color: var(--border-hover);
		background: var(--surface-alt);
	}

	.user-card.pending {
		border-left: 3px solid var(--amber);
	}

	.user-card-header {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px;
		cursor: pointer;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		min-width: 0;
	}

	.user-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--teal-bg);
		border: 1px solid var(--teal);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--teal);
		flex-shrink: 0;
	}

	.user-details {
		flex: 1;
		min-width: 0;
	}

	.user-name {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text);
		margin-bottom: 2px;
	}

	.user-email {
		font-size: 0.8rem;
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.user-joined {
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-top: 4px;
	}

	.user-meta {
		display: flex;
		gap: 12px;
		align-items: center;
		font-size: 0.75rem;
		margin-top: 4px;
	}

	.role-badge {
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.joined-text {
		color: var(--text-secondary);
	}

	.user-modules-compact {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		min-width: 200px;
	}

	.module-badge {
		font-size: 0.65rem;
		padding: 3px 8px;
		border-radius: 4px;
		background: var(--teal-bg);
		color: var(--teal);
		border: 1px solid var(--teal-ring);
		white-space: nowrap;
	}

	.module-badge.empty {
		background: var(--surface-alt);
		color: var(--text-secondary);
		border-color: var(--border);
	}

	.expand-icon {
		font-size: 0.8rem;
		color: var(--text-secondary);
		transition: transform 0.2s ease;
		flex-shrink: 0;
	}

	.expand-icon.rotated {
		transform: rotate(90deg);
	}

	.user-actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}

	.user-card-expanded {
		padding: 16px;
		border-top: 1px solid var(--border);
		background: var(--surface-alt);
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.expanded-section h4 {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text);
		margin-bottom: 12px;
	}

	/* Modules Grid */
	.modules-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 8px;
	}

	.module-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.8rem;
	}

	.module-toggle:hover {
		border-color: var(--border-hover);
		background: var(--surface-alt);
	}

	.module-toggle input {
		width: 16px;
		height: 16px;
		cursor: pointer;
		accent-color: var(--teal);
	}

	.toggle-label {
		flex: 1;
		color: var(--text);
	}

	.module-toggle-sm {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		font-size: 0.75rem;
	}

	.module-toggle-sm input {
		width: 14px;
		height: 14px;
		accent-color: var(--teal);
	}

	/* Action Buttons */
	.action-buttons {
		display: flex;
		gap: 8px;
	}

	/* Form */
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}

	.form-group label {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.form-input {
		padding: 10px 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text);
		font-size: 0.9rem;
		font-family: inherit;
		transition: all 0.2s ease;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--teal);
		background: var(--surface-alt);
	}

	.form-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Whitelist */
	.whitelist-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.whitelist-row {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.whitelist-row:hover {
		border-color: var(--border-hover);
		background: var(--surface-alt);
	}

	.whitelist-row.editing {
		background: var(--surface-alt);
		border-color: var(--teal);
	}

	.whitelist-email {
		flex: 1;
		min-width: 200px;
	}

	.email-text {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text);
		margin-bottom: 2px;
	}

	.email-meta {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.whitelist-modules {
		flex: 1.5;
	}

	.modules-display {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.modules-edit {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 8px;
	}

	.whitelist-actions {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	/* Waitlist */
	.waitlist-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.waitlist-row {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.waitlist-row:hover {
		border-color: var(--border-hover);
		background: var(--surface-alt);
	}

	.waitlist-email {
		flex: 1;
		min-width: 200px;
	}

	.waitlist-actions {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	/* Buttons */
	.btn {
		padding: 8px 14px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text);
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.btn:hover {
		border-color: var(--border-hover);
		background: var(--surface-alt);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-accent {
		color: var(--teal);
		border-color: var(--teal-ring);
		background: var(--teal-bg);
	}

	.btn-accent:hover:not(:disabled) {
		background: var(--teal-ring);
		border-color: var(--teal);
	}

	.btn-danger {
		color: var(--red);
		border-color: rgba(220, 38, 38, 0.3);
		background: var(--red-soft);
	}

	.btn-danger:hover:not(:disabled) {
		background: rgba(220, 38, 38, 0.15);
		border-color: var(--red);
	}

	.btn-lg {
		padding: 12px 20px;
		font-size: 0.85rem;
	}

	.btn-sm {
		padding: 6px 10px;
		font-size: 0.75rem;
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
		max-width: 500px;
		width: 90%;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px;
		border-bottom: 1px solid var(--border);
	}

	.modal-header h3 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
	}

	.modal-close {
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.2s ease;
	}

	.modal-close:hover {
		color: var(--text);
	}

	.modal-body {
		padding: 20px;
	}

	.approval-user {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: var(--surface-alt);
		border-radius: 6px;
		margin-bottom: 20px;
	}

	.approval-name {
		font-weight: 600;
		color: var(--text);
		margin-bottom: 2px;
	}

	.approval-email {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.approval-section h4 {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text);
		margin-bottom: 12px;
	}

	.approval-section {
		margin-bottom: 20px;
	}

	.modal-footer {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		padding: 20px;
		border-top: 1px solid var(--border);
		background: var(--surface-alt);
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 40px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		border-style: dashed;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-text {
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.admin-page {
			padding: 20px;
		}

		.modules-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.user-card-header {
			flex-wrap: wrap;
		}

		.user-modules-compact {
			order: 3;
			flex-basis: 100%;
			margin-top: 8px;
		}

		.whitelist-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 12px;
		}

		.whitelist-email,
		.whitelist-modules,
		.whitelist-actions {
			width: 100%;
		}

		.whitelist-modules {
			flex: none;
		}

		.whitelist-actions {
			display: flex;
			justify-content: flex-end;
		}

		.waitlist-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 12px;
		}

		.waitlist-email,
		.waitlist-actions {
			width: 100%;
		}

		.waitlist-actions {
			display: flex;
			justify-content: flex-end;
		}
	}

	.module-header-row h4 {
		margin: 0;
	}
	.btn-small {
		font-size: 11px;
		padding: 4px 10px;
		border-radius: 4px;
		background: var(--surface-alt);
		color: var(--text);
		border: 1px solid var(--border);
		cursor: pointer;
	}
	.btn-small:hover {
		background: var(--surface);
	}
	.save-modules-btn {
		margin-top: 12px;
		width: 100%;
	}

	/* Tier buttons */
	.tier-buttons {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 4px;
	}
	.tier-btn {
		font-size: 13px;
		padding: 8px 16px;
		border-radius: 8px;
		background: var(--surface-alt);
		color: var(--text);
		border: 1px solid var(--border);
		cursor: pointer;
		transition: all 0.2s;
	}
	.tier-btn:hover {
		background: var(--surface);
		border-color: var(--teal);
	}
	.tier-btn.active {
		background: var(--teal-bg);
		border-color: var(--teal);
		color: var(--teal);
		font-weight: 600;
	}

	.tier-quick-btns {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.tier-quick {
		font-size: 10px;
		padding: 3px 8px;
	}

	.module-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
