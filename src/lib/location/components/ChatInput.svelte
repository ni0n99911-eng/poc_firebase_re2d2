<script>
	/**
	 * ChatInput — Bottom input bar for the onboarding chat
	 *
	 * Features:
	 * - Text input with send button
	 * - Quick-reply chips (context-sensitive)
	 * - Address autocomplete mode when ready
	 * - Disabled state while AI is responding
	 */

	let { onSend, isLoading = false, quickReplies = [], placeholder = 'Type your answer...' } = $props();

	let inputText = $state('');
	let inputEl = $state(null);

	function handleSend() {
		const text = inputText.trim();
		if (!text || isLoading) return;
		onSend(text);
		inputText = '';
		// Refocus after send
		setTimeout(() => inputEl?.focus(), 50);
	}

	function handleKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function handleQuickReply(text) {
		if (isLoading) return;
		onSend(text);
	}
</script>

<div class="chat-input-area">
	{#if quickReplies.length > 0}
		<div class="quick-replies">
			{#each quickReplies as chip}
				<button
					class="quick-chip"
					disabled={isLoading}
					onclick={() => handleQuickReply(chip)}
				>
					{chip}
				</button>
			{/each}
		</div>
	{/if}

	<div class="input-row" class:is-disabled={isLoading}>
		<input
			bind:this={inputEl}
			bind:value={inputText}
			type="text"
			placeholder={isLoading ? 'Waiting for coach...' : placeholder}
			disabled={isLoading}
			onkeydown={handleKeydown}
			class="chat-text-input"
		/>
		<button
			class="send-btn"
			disabled={!inputText.trim() || isLoading}
			onclick={handleSend}
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="22" y1="2" x2="11" y2="13"></line>
				<polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
			</svg>
		</button>
	</div>
</div>

<style>
	.chat-input-area {
		position: sticky;
		bottom: 0;
		left: 0;
		right: 0;
		background: linear-gradient(transparent, rgba(255, 255, 255, 0.8) 20%);
		backdrop-filter: blur(10px);
		padding: 12px 0 max(env(safe-area-inset-bottom, 0px), 16px);
	}

	.quick-replies {
		display: flex;
		gap: 8px;
		padding: 0 0 10px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}

	.quick-replies::-webkit-scrollbar {
		display: none;
	}

	.quick-chip {
		flex-shrink: 0;
		padding: 8px 16px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 20px;
		color: var(--text-secondary);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
		white-space: nowrap;
	}

	.quick-chip:hover:not(:disabled) {
		border-color: var(--teal);
		color: var(--teal);
		background: var(--teal-bg);
	}

	.quick-chip:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.input-row {
		display: flex;
		gap: 8px;
		align-items: center;
		transition: opacity 0.4s ease, transform 0.4s ease;
	}

	.input-row.is-disabled {
		opacity: 0.4;
		pointer-events: none;
	}

	.chat-text-input {
		flex: 1;
		padding: 12px 16px;
		background: var(--white, #fff);
		border: 1.5px solid var(--border);
		border-radius: 20px;
		color: var(--text);
		font-size: 15px;
		font-family: inherit;
		transition: all 0.4s ease;
	}

	.chat-text-input:focus {
		outline: none;
		border-color: var(--teal);
		box-shadow: 0 0 0 3px var(--teal-ring);
	}

	.chat-text-input::placeholder {
		color: var(--text-dim);
		transition: color 0.3s ease;
	}

	.chat-text-input:disabled {
		background: var(--surface, #f5f5f5);
		border-color: var(--border, #e0e0e0);
	}

	/* Active state — input becomes visually "alive" when bot has responded */
	.input-row:not(.is-disabled) .chat-text-input {
		border-color: var(--teal, #2a9d8f);
		box-shadow: 0 0 0 1px var(--teal-ring, rgba(42, 157, 143, 0.15));
		animation: input-ready 0.5s ease;
	}

	@keyframes input-ready {
		0% { transform: scale(0.98); opacity: 0.6; }
		50% { transform: scale(1.01); }
		100% { transform: scale(1); opacity: 1; }
	}

	.send-btn {
		flex-shrink: 0;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: var(--teal);
		border: none;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.send-btn:hover:not(:disabled) {
		background: var(--teal-bright);
		transform: scale(1.05);
	}

	.send-btn:disabled {
		opacity: 0.25;
		cursor: not-allowed;
		background: var(--border, #ccc);
	}

	@media (max-width: 480px) {
		.chat-text-input {
			font-size: 16px; /* prevent iOS zoom */
			padding: 10px 14px;
		}

		.send-btn {
			width: 40px;
			height: 40px;
		}
	}
</style>
