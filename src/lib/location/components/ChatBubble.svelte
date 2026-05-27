<script>
	/**
	 * ChatBubble — Individual message in the iMessage-style onboarding
	 *
	 * AI messages: left-aligned, dark surface bg
	 * User messages: right-aligned, teal bg
	 * Streaming state shows typing indicator
	 */

	let { message } = $props();

	// Client-side safety net: strip any metadata blocks that leaked through
	// the server-side parser (e.g., cached old messages with raw metadata)
	function cleanContent(text) {
		if (!text) return '';
		return text
			.replace(/<metadata>[\s\S]*?<\/metadata>/gi, '')
			.replace(/<<<METADATA>>>[\s\S]*?<<<END>>>/g, '')
			.replace(/\n\s*\{[\s\S]*"extracted"[\s\S]*\}\s*$/, '')
			.trim();
	}

	let displayContent = $derived(cleanContent(message.content));
</script>

<div
	class="bubble-row"
	class:user={message.role === 'user'}
	class:assistant={message.role === 'assistant'}
>
	{#if message.role === 'assistant'}
		<div class="avatar">
			<span class="avatar-icon">RE²</span>
		</div>
	{/if}

	<div class="bubble" class:streaming={message.status === 'streaming'}>
		{#if message.status === 'streaming'}
			<div class="typing-dots">
				<span></span><span></span><span></span>
			</div>
		{:else}
			<p class="bubble-text">{displayContent}</p>
		{/if}
	</div>
</div>

<style>
	.bubble-row {
		display: flex;
		gap: 10px;
		margin-bottom: 16px;
		align-items: flex-end;
		animation: bubbleIn 0.3s ease-out;
	}

	.bubble-row.user {
		flex-direction: row-reverse;
	}

	.avatar {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--teal, #0D7C6E);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 2px;
	}

	.avatar-icon {
		font-size: 8px;
		font-weight: 700;
		color: white;
		letter-spacing: -0.3px;
	}

	.bubble {
		max-width: 78%;
		padding: 12px 16px;
		border-radius: 18px;
		line-height: 1.55;
		font-size: 15px;
	}

	.assistant .bubble {
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border);
		border-bottom-left-radius: 4px;
	}

	.user .bubble {
		background: var(--teal, #0D7C6E);
		color: white;
		border-bottom-right-radius: 4px;
	}

	.bubble-text {
		margin: 0;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	/* Typing indicator */
	.typing-dots {
		display: flex;
		gap: 5px;
		padding: 4px 8px;
	}

	.typing-dots span {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--text-secondary, #5A6578);
		animation: dotBounce 1.4s infinite ease-in-out;
	}

	.typing-dots span:nth-child(2) {
		animation-delay: 0.16s;
	}

	.typing-dots span:nth-child(3) {
		animation-delay: 0.32s;
	}

	@keyframes dotBounce {
		0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
		40% { opacity: 1; transform: scale(1); }
	}

	@keyframes bubbleIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* Streaming bubble shimmer */
	.bubble.streaming {
		min-width: 70px;
	}

	@media (max-width: 480px) {
		.bubble {
			max-width: 85%;
			font-size: 14px;
			padding: 10px 14px;
		}

		.avatar {
			width: 26px;
			height: 26px;
		}

		.avatar-icon {
			font-size: 7px;
		}
	}
</style>
