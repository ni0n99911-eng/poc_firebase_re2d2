<script lang="ts">
	import { onMount } from 'svelte';
	import { loadLaunchPadData } from '$lib/launchpad-store';

	interface KanbanTask {
		id: string;
		title: string;
		priority: 'high' | 'medium' | 'low';
		labels: string[];
		notes: string;
	}

	type ColumnKey = 'backlog' | 'inProgress' | 'review' | 'done';

	let selectedCard: { task: KanbanTask; columnKey: ColumnKey } | null = $state(null);
	let editingNote: string | null = $state(null);
	let draggedTask: string | null = $state(null);
	let dragSource: ColumnKey | null = $state(null);
	let fileInput: HTMLInputElement | null = $state(null);
	let businessName: string = $state('Project');

	onMount(() => {
		const lpData = loadLaunchPadData();
		businessName = lpData.businessName || 'Project';
	});

	let columns: Record<ColumnKey, KanbanTask[]> = $state({
		backlog: [
			{ id: 'b1', title: 'Finalize lease agreement at 600 6th Ave', priority: 'high', labels: ['Legal'], notes: '' },
			{ id: 'b2', title: 'Order espresso machine & equipment', priority: 'medium', labels: ['Operations'], notes: '' },
			{ id: 'b3', title: 'Design interior layout with architect', priority: 'high', labels: ['Operations'], notes: '' },
			{ id: 'b4', title: 'Set up POS system (Square/Toast)', priority: 'medium', labels: ['Tech'], notes: '' },
			{ id: 'b5', title: 'Create employee handbook', priority: 'low', labels: ['Operations'], notes: '' },
			{ id: 'b6', title: 'File for food service permit', priority: 'high', labels: ['Legal'], notes: '' },
			{ id: 'b7', title: 'Set up business insurance', priority: 'medium', labels: ['Finance'], notes: '' }
		],
		inProgress: [
			{ id: 'ip1', title: 'Complete SBA 7(a) loan application', priority: 'high', labels: ['Finance'], notes: '' },
			{ id: 'ip2', title: 'Finalize menu pricing strategy', priority: 'high', labels: ['Finance'], notes: '' },
			{ id: 'ip3', title: 'Build business website', priority: 'medium', labels: ['Tech'], notes: '' },
			{ id: 'ip4', title: 'Develop mobile app prototype', priority: 'medium', labels: ['Tech'], notes: '' }
		],
		review: [
			{ id: 'r1', title: 'Menu deck v0.1 (complete)', priority: 'high', labels: ['Marketing'], notes: '' },
			{ id: 'r2', title: 'Location analysis for Chelsea', priority: 'high', labels: ['Operations'], notes: '' },
			{ id: 'r3', title: 'Brand identity & logo design', priority: 'medium', labels: ['Marketing'], notes: '' }
		],
		done: [
			{ id: 'd1', title: 'Business entity formation (LLC)', priority: 'high', labels: ['Legal'], notes: '' },
			{ id: 'd2', title: 'Secure Clerk & Supabase accounts', priority: 'high', labels: ['Tech'], notes: '' },
			{ id: 'd3', title: 'Build JAREDCLAW command center', priority: 'medium', labels: ['Tech'], notes: '' },
			{ id: 'd4', title: 'Complete 3-year financial projections', priority: 'high', labels: ['Finance'], notes: '' }
		]
	});

	const columnConfig: Record<ColumnKey, { label: string; color: string }> = {
		backlog: { label: 'Backlog', color: 'var(--border)' },
		inProgress: { label: 'In Progress', color: '#ff6b35' },
		review: { label: 'Review', color: '#ffa500' },
		done: { label: 'Done', color: '#00d9a3' }
	};

	const priorityColors: Record<string, string> = {
		high: '#ff4d4d',
		medium: '#ffa500',
		low: '#4d9fff'
	};

	const labelColors: Record<string, string> = {
		Finance: '#e74c3c',
		Legal: '#9b59b6',
		Operations: '#3498db',
		Marketing: '#e91e63',
		Tech: '#00bcd4'
	};

	function getPriorityColor(priority: string): string {
		return priorityColors[priority] || '#999';
	}

	function getLabelColor(label: string): string {
		return labelColors[label] || '#666';
	}

	function handleDragStart(e: DragEvent, columnKey: ColumnKey, taskId: string) {
		draggedTask = taskId;
		dragSource = columnKey;
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function handleDrop(e: DragEvent, targetColumn: ColumnKey) {
		e.preventDefault();
		if (draggedTask && dragSource && dragSource !== targetColumn) {
			const sourceTask = columns[dragSource].find(t => t.id === draggedTask);
			if (sourceTask) {
				columns[targetColumn] = [...columns[targetColumn], sourceTask];
				columns[dragSource] = columns[dragSource].filter(t => t.id !== draggedTask);
			}
		}
		draggedTask = null;
		dragSource = null;
	}

	function openCard(task: KanbanTask, columnKey: ColumnKey) {
		selectedCard = { task, columnKey };
		editingNote = null;
	}

	function closeCard() {
		selectedCard = null;
		editingNote = null;
	}

	function updateTaskNote(newNote: string) {
		if (selectedCard) {
			const taskIndex = columns[selectedCard.columnKey].findIndex(t => t.id === selectedCard.task.id);
			if (taskIndex !== -1) {
				const task = columns[selectedCard.columnKey][taskIndex];
				task.notes = newNote;
				selectedCard.task.notes = newNote;
			}
		}
	}

	function deleteTask(columnKey: ColumnKey, taskId: string) {
		if (confirm('Are you sure you want to delete this task?')) {
			columns[columnKey] = columns[columnKey].filter(t => t.id !== taskId);
			closeCard();
		}
	}

	function addTask(columnKey: ColumnKey) {
		const newId = `task-${Date.now()}`;
		const newTask: KanbanTask = {
			id: newId,
			title: 'New Task',
			priority: 'medium',
			labels: [],
			notes: ''
		};
		columns[columnKey] = [...columns[columnKey], newTask];
	}

	function updateTaskTitle(columnKey: ColumnKey, taskId: string, newTitle: string) {
		const task = columns[columnKey].find(t => t.id === taskId);
		if (task) {
			task.title = newTitle;
			if (selectedCard && selectedCard.task.id === taskId) {
				selectedCard.task.title = newTitle;
			}
		}
	}

	function updateTaskPriority(columnKey: ColumnKey, taskId: string, newPriority: 'high' | 'medium' | 'low') {
		const task = columns[columnKey].find(t => t.id === taskId);
		if (task) {
			task.priority = newPriority;
			if (selectedCard && selectedCard.task.id === taskId) {
				selectedCard.task.priority = newPriority;
			}
		}
	}

	function moveTask(columnKey: ColumnKey, taskId: string, direction: 'left' | 'right') {
		const currentIndex = columns[columnKey].findIndex(t => t.id === taskId);
		if (direction === 'left') {
			const keys = Object.keys(columns);
			const currentIdx = keys.indexOf(columnKey);
			if (currentIdx > 0) {
				const targetColumn = keys[currentIdx - 1];
				const task = columns[columnKey][currentIndex];
				columns[targetColumn] = [...columns[targetColumn], task];
				columns[columnKey] = columns[columnKey].filter(t => t.id !== taskId);
				closeCard();
			}
		} else if (direction === 'right') {
			const keys = Object.keys(columns);
			const currentIdx = keys.indexOf(columnKey);
			if (currentIdx < keys.length - 1) {
				const targetColumn = keys[currentIdx + 1];
				const task = columns[columnKey][currentIndex];
				columns[targetColumn] = [...columns[targetColumn], task];
				columns[columnKey] = columns[columnKey].filter(t => t.id !== taskId);
				closeCard();
			}
		}
	}

	function downloadCSVTemplate() {
		const csvContent = `Title,Description,Status,Priority,Labels
Finalize lease,Negotiate terms at 600 6th Ave,Backlog,High,Legal
Order equipment,Espresso machine and grinder,Backlog,Medium,Operations
Design layout,Interior layout with architect,Backlog,High,Operations`;
		const blob = new Blob([csvContent], { type: 'text/csv' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'kanban-template.csv';
		a.click();
		window.URL.revokeObjectURL(url);
	}

	function parseCSV(content: string): KanbanTask[] {
		const lines = content.trim().split('\n');
		const headers = lines[0].split(',').map(h => h.trim());
		const tasks: KanbanTask[] = [];

		for (let i = 1; i < lines.length; i++) {
			const values = lines[i].split(',').map(v => v.trim());
			const task: KanbanTask = {
				id: `task-${Date.now()}-${i}`,
				title: values[0] || 'Untitled',
				notes: values[1] || '',
				priority: (values[3]?.toLowerCase() as 'high' | 'medium' | 'low') || 'medium',
				labels: values[4] ? values[4].split(';').map(l => l.trim()) : []
			};
			tasks.push(task);
		}
		return tasks;
	}

	function parseJSON(content: string): boolean {
		try {
			const data = JSON.parse(content);
			if (data.columns && Array.isArray(data.columns)) {
				const newColumns: Record<ColumnKey, KanbanTask[]> = { ...columns };
				data.columns.forEach((col: { cards: Array<{ title?: string; description?: string; priority?: string; labels?: string[] }> }, idx: number) => {
					const key = (Object.keys(columns) as ColumnKey[])[idx];
					if (key) {
						newColumns[key] = col.cards.map((card) => ({
							id: `task-${Date.now()}-${Math.random()}`,
							title: card.title || 'Untitled',
							notes: card.description || '',
							priority: (card.priority?.toLowerCase() as 'high' | 'medium' | 'low') || 'medium',
							labels: card.labels || []
						}));
					}
				});
				columns = newColumns;
				return true;
			}
		} catch (e) {
			return false;
		}
	}

	function handleFileUpload(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result;
			if (typeof content !== 'string') return;

			if (file.name.endsWith('.json')) {
				parseJSON(content);
			} else if (file.name.endsWith('.csv')) {
				const tasks = parseCSV(content);
				if (tasks.length > 0) {
					columns.backlog = [...columns.backlog, ...tasks];
				}
			}
		};
		reader.readAsText(file);
		(event.target as HTMLInputElement).value = '';
	}

	function clearBoard() {
		if (confirm('Clear all tasks from the board? This cannot be undone.')) {
			columns = {
				backlog: [],
				inProgress: [],
				review: [],
				done: []
			};
		}
	}
</script>

<svelte:head>
	<title>RE² — Project Board</title>
</svelte:head>

<div class="kanban-container">
	<header class="page-header">
		<h1>📋 {businessName} Project Board</h1>
		<p class="subtitle">Track all launch tasks and milestones</p>
	</header>

	<!-- Template Upload Bar -->
	<div class="template-bar">
		<div class="template-left">
			<input
				bind:this={fileInput}
				type="file"
				accept=".json,.csv"
				style="display: none;"
				onchange={handleFileUpload}
			/>
			<button class="template-btn upload-btn" onclick={() => fileInput?.click()}>
				↑ Upload Template
			</button>
			<button class="template-btn download-btn" onclick={downloadCSVTemplate}>
				↓ Download Template
			</button>
		</div>
		<button class="template-btn clear-btn" onclick={clearBoard}>
			✕ Clear Board
		</button>
	</div>

	<div class="kanban-board">
		{#each Object.entries(columns) as [columnKey, tasks]}
			<div class="column" ondragover={handleDragOver} ondrop={(e) => handleDrop(e, columnKey)}>
				<div class="column-header" style="--column-color: {columnConfig[columnKey].color}">
					<h2>{columnConfig[columnKey].label}</h2>
					<span class="card-count">{tasks.length}</span>
				</div>

				<div class="tasks-list">
					{#each tasks as task (task.id)}
						<div
							class="card"
							draggable="true"
							ondragstart={(e) => handleDragStart(e, columnKey, task.id)}
							onclick={() => openCard(task, columnKey)}
							role="button"
							tabindex="0"
						>
							<div class="card-header">
								<div
									class="priority-indicator"
									style="background-color: {getPriorityColor(task.priority)}"
									title="{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority"
								></div>
								<h3>{task.title}</h3>
							</div>

							<div class="card-labels">
								{#each task.labels as label}
									<span
										class="label"
										style="background-color: {getLabelColor(label)}; background-color: {getLabelColor(label)}20"
									>
										{label}
									</span>
								{/each}
							</div>

							{#if task.notes}
								<div class="card-notes">
									<p>{task.notes.substring(0, 50)}{task.notes.length > 50 ? '...' : ''}</p>
								</div>
							{/if}
						</div>
					{/each}
				</div>

				<button class="add-task-btn" onclick={() => addTask(columnKey)}>+ Add Task</button>
			</div>
		{/each}
	</div>

	<!-- Expanded Card Modal -->
	{#if selectedCard}
		<div class="modal-overlay" onclick={closeCard}>
			<div class="modal" onclick={(e) => e.stopPropagation()}>
				<div class="modal-header">
					<input
						type="text"
						class="modal-title-input"
						value={selectedCard.task.title}
						onchange={(e) => updateTaskTitle(selectedCard.columnKey, selectedCard.task.id, e.target.value)}
					/>
					<button class="close-btn" onclick={closeCard}>✕</button>
				</div>

				<div class="modal-body">
					<div class="modal-section">
						<label>Priority</label>
						<div class="priority-selector">
							{#each ['high', 'medium', 'low'] as priority}
								<button
									class="priority-btn"
									class:active={selectedCard.task.priority === priority}
									style="border-color: {getPriorityColor(priority)}"
									onclick={() => updateTaskPriority(selectedCard.columnKey, selectedCard.task.id, priority)}
								>
									{priority.charAt(0).toUpperCase() + priority.slice(1)}
								</button>
							{/each}
						</div>
					</div>

					<div class="modal-section">
						<label>Labels</label>
						<div class="label-selector">
							{#each Object.keys(labelColors) as label}
								<button
									class="label-btn"
									class:active={selectedCard.task.labels.includes(label)}
									style="color: {getLabelColor(label)}"
									onclick={() => {
										if (selectedCard.task.labels.includes(label)) {
											selectedCard.task.labels = selectedCard.task.labels.filter(l => l !== label);
										} else {
											selectedCard.task.labels = [...selectedCard.task.labels, label];
										}
									}}
								>
									{label}
								</button>
							{/each}
						</div>
					</div>

					<div class="modal-section">
						<label>Notes ({selectedCard.task.notes.length} characters)</label>
						<textarea
							class="notes-textarea"
							placeholder="Add task notes..."
							value={selectedCard.task.notes}
							onchange={(e) => updateTaskNote(e.target.value)}
						></textarea>
					</div>

					<div class="modal-section">
						<label>Actions</label>
						<div class="action-buttons">
							{#if selectedCard.columnKey !== 'backlog'}
								<button class="action-btn" onclick={() => moveTask(selectedCard.columnKey, selectedCard.task.id, 'left')}>
									← Move Left
								</button>
							{/if}
							{#if selectedCard.columnKey !== 'done'}
								<button class="action-btn" onclick={() => moveTask(selectedCard.columnKey, selectedCard.task.id, 'right')}>
									Move Right →
								</button>
							{/if}
							<button
								class="action-btn delete-btn"
								onclick={() => deleteTask(selectedCard.columnKey, selectedCard.task.id)}
							>
								Delete Task
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.kanban-container {
		max-width: 1600px;
		margin: 0 auto;
		padding: 40px 20px;
		background-color: var(--bg);
		color: var(--text);
		min-height: 100vh;
	}

	.page-header {
		text-align: center;
		margin-bottom: 30px;
	}

	.page-header h1 {
		font-size: 2.8rem;
		font-weight: 700;
		margin: 0 0 10px 0;
		color: var(--text);
	}

	.subtitle {
		font-size: 1.1rem;
		color: var(--text-secondary);
		margin: 0;
	}

	/* Template Bar */
	.template-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px 16px;
		margin-bottom: 20px;
		gap: 12px;
	}

	.template-left {
		display: flex;
		gap: 8px;
	}

	.template-btn {
		padding: 8px 14px;
		background: var(--surface-alt);
		border: 1px solid var(--border);
		color: var(--text);
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 600;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.template-btn:hover {
		border-color: var(--accent);
		background: var(--accent-light);
		color: var(--accent);
	}

	.upload-btn {
		border-color: var(--success);
		color: var(--success);
	}

	.upload-btn:hover {
		background: var(--green-soft);
	}

	.download-btn {
		border-color: var(--teal);
		color: var(--teal);
	}

	.download-btn:hover {
		background: var(--teal-bg);
	}

	.clear-btn {
		border-color: var(--danger);
		color: var(--danger);
	}

	.clear-btn:hover {
		background: var(--red-soft);
	}

	.kanban-board {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 24px;
	}

	.column {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		max-height: 85vh;
	}

	.column-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
		border-bottom: 3px solid var(--column-color);
		background: linear-gradient(135deg, rgba(224, 229, 237, 0.3), var(--surface));
	}

	.column-header h2 {
		font-size: 1.3rem;
		font-weight: 600;
		margin: 0;
		color: var(--text);
	}

	.card-count {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: rgba(0, 0, 0, 0.05);
		border-radius: 50%;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.tasks-list {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.tasks-list::-webkit-scrollbar {
		width: 6px;
	}

	.tasks-list::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}

	.card {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px;
		cursor: grab;
		transition: all 0.3s ease;
		user-select: none;
	}

	.card:hover {
		border-color: var(--accent);
		background: var(--surface-alt);
		transform: translateY(-2px);
		box-shadow: 0 8px 16px rgba(180, 83, 9, 0.1);
	}

	.card:active {
		cursor: grabbing;
	}

	.card-header {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		margin-bottom: 10px;
	}

	.priority-indicator {
		width: 4px;
		height: 100%;
		min-height: 24px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.card-header h3 {
		font-size: 0.95rem;
		font-weight: 600;
		margin: 0;
		color: var(--text);
		line-height: 1.6;
		word-break: break-word;
		flex: 1;
	}

	.card-labels {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 8px;
	}

	.label {
		display: inline-block;
		font-size: 0.75rem;
		padding: 4px 8px;
		border-radius: 4px;
		font-weight: 600;
		color: white;
	}

	.card-notes {
		font-size: 0.85rem;
		color: var(--text-secondary);
		padding: 8px;
		background: var(--surface-alt);
		border-radius: 4px;
		border-left: 2px solid var(--accent);
	}

	.card-notes p {
		margin: 0;
		line-height: 1.6;
	}

	.add-task-btn {
		padding: 12px;
		margin: 12px;
		background: transparent;
		border: 2px dashed var(--border);
		color: var(--text-secondary);
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.95rem;
		font-weight: 600;
		transition: all 0.3s ease;
	}

	.add-task-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-light);
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		padding: 20px;
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.modal {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		max-width: 500px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
		animation: slideUp 0.3s ease;
	}

	@keyframes slideUp {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 20px;
		border-bottom: 1px solid var(--border);
		gap: 12px;
	}

	.modal-title-input {
		flex: 1;
		background: var(--surface-alt);
		border: 1px solid var(--border);
		color: var(--text);
		padding: 12px;
		border-radius: 6px;
		font-size: 1.1rem;
		font-weight: 600;
		transition: all 0.2s ease;
	}

	.modal-title-input:hover {
		border-color: var(--accent);
	}

	.modal-title-input:focus {
		outline: none;
		border-color: var(--accent);
		background: var(--bg);
	}

	.close-btn {
		background: transparent;
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
		border-radius: 6px;
		transition: all 0.2s ease;
	}

	.close-btn:hover {
		background: rgba(0, 0, 0, 0.05);
		color: var(--text);
	}

	.modal-body {
		padding: 20px;
	}

	.modal-section {
		margin-bottom: 24px;
	}

	.modal-section:last-child {
		margin-bottom: 0;
	}

	.modal-section label {
		display: block;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 10px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.priority-selector {
		display: flex;
		gap: 8px;
	}

	.priority-btn {
		flex: 1;
		padding: 8px 12px;
		background: var(--surface-alt);
		border: 2px solid var(--border);
		color: var(--text);
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 600;
		transition: all 0.2s ease;
	}

	.priority-btn:hover {
		background: var(--bg);
	}

	.priority-btn.active {
		background: var(--accent-light);
		border-width: 2px;
	}

	.label-selector {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.label-btn {
		padding: 8px 12px;
		background: var(--surface-alt);
		border: 1px solid var(--border);
		color: var(--text);
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 600;
		transition: all 0.2s ease;
	}

	.label-btn:hover {
		background: var(--bg);
	}

	.label-btn.active {
		border: 2px solid currentColor;
		background: var(--accent-light);
	}

	.notes-textarea {
		width: 100%;
		min-height: 120px;
		padding: 12px;
		background: var(--surface-alt);
		border: 1px solid var(--border);
		color: var(--text);
		border-radius: 6px;
		font-family: inherit;
		font-size: 0.9rem;
		resize: vertical;
		transition: all 0.2s ease;
	}

	.notes-textarea:hover {
		border-color: var(--accent);
	}

	.notes-textarea:focus {
		outline: none;
		border-color: var(--accent);
		background: var(--bg);
	}

	.action-buttons {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.action-btn {
		padding: 10px 12px;
		background: var(--surface-alt);
		border: 1px solid var(--border);
		color: var(--accent);
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 600;
		transition: all 0.2s ease;
	}

	.action-btn:hover {
		background: var(--accent-light);
		border-color: var(--accent);
	}

	.action-btn.delete-btn {
		color: var(--danger);
	}

	.action-btn.delete-btn:hover {
		background: var(--red-soft);
		border-color: var(--danger);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.kanban-board {
			grid-template-columns: 1fr;
		}

		.page-header h1 {
			font-size: 2rem;
		}

		.modal {
			max-width: 90vw;
		}
	}
</style>
