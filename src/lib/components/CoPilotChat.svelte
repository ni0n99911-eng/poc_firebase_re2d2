<script lang="ts">
	import { onMount } from 'svelte';
	// 04.25.2026 16:36 CoPilot Sanitization — sanitizeHtml wraps renderMarkdown
	// to close the XSS surface on {@html} rendering of LLM responses
	import { sanitizeHtml } from '$lib/utils/copilot-sanitize';

	type Message = {
		role: 'bot' | 'user';
		text: string;
	};

	let {
		title = 'Location Co-Pilot',
		subtitle = 'Ask anything about this location',
		initialMessages = [] as Message[],
		suggestedPrompts = [] as string[],
		onSendMessage = async (_text: string): Promise<string | void> => {},
		accentColor = '#4a7c5c'
	} = $props<{
		title?: string;
		subtitle?: string;
		initialMessages?: Message[];
		suggestedPrompts?: string[];
		onSendMessage?: (text: string) => Promise<string | void>;
		accentColor?: string;
	}>();

	let messages = $state<Message[]>(initialMessages);
	let userInput = $state('');
	let messagesContainer: HTMLDivElement | undefined;
	let usedPrompts = $state<Set<number>>(new Set());
	let userHasInteracted = $state(false);
	let isThinking = $state(false);

	onMount(() => {
		scrollToBottom();
	});

	// Update bot messages when initialMessages changes (e.g. after analysis completes)
	// but only if the user hasn't started chatting yet
	$effect(() => {
		const newMessages = initialMessages;
		if (!userHasInteracted && newMessages.length > 0) {
			messages = [...newMessages];
		}
	});

	$effect(() => {
		scrollToBottom();
	});

	function scrollToBottom() {
		if (messagesContainer) {
			setTimeout(() => {
				messagesContainer?.scrollTo(0, messagesContainer.scrollHeight);
			}, 0);
		}
	}

	async function handleSendMessage() {
		if (userInput.trim() && !isThinking) {
			userHasInteracted = true;
			const question = userInput;
			messages = [...messages, { role: 'user', text: question }];
			userInput = '';
			isThinking = true;
			scrollToBottom();

			try {
				const reply = await onSendMessage(question);
				if (reply) {
					messages = [...messages, { role: 'bot', text: reply }];
				}
			} catch {
				messages = [...messages, { role: 'bot', text: 'Sorry, I had trouble processing that. Please try again.' }];
			} finally {
				isThinking = false;
				scrollToBottom();
			}
		}
	}

	function handleChipClick(prompt: string, index: number) {
		userInput = prompt;
		usedPrompts.add(index);
		handleSendMessage();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	}

	const isChipDisabled = (index: number) => usedPrompts.has(index);

	function renderMarkdown(text: string): string {
		// HIGH-2: robust markdown — guard null/undefined, works on cached pages
		if (!text) return '';
		// Bold: **text** → <strong>text</strong> (non-greedy, handles already-converted HTML)
		text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
		// Italic: *text* (only when not adjacent to existing HTML tags)
		text = text.replace(/(?<!<)\*([^*<>]+)\*(?!>)/g, '<em>$1</em>');
		// Newlines → <br>
		text = text.replace(/\n/g, '<br>');
		// 04.25.2026 16:36 CoPilot Sanitization — strip unsafe tags after markdown conversion
		return sanitizeHtml(text);
	}
</script>

<div
	class="copilot-chat"
	style="--copilot-accent: {accentColor}; --copilot-bg: #F5F5F7"
>
	<!-- Header -->
	<div class="copilot-header">
		<div class="header-content">
			<div class="icon-badge" style="background-color: {accentColor}">
				<span class="icon">✨</span>
			</div>
			<div class="header-text">
				<h3 class="header-title">{title}</h3>
				<p class="header-subtitle">{subtitle}</p>
			</div>
		</div>
	</div>

	<!-- Messages Area -->
	<div class="messages-area" bind:this={messagesContainer}>
		{#each messages as message (message)}
			<div class="message-wrapper" class:user={message.role === 'user'}>
				{#if message.role === 'bot'}
					<div class="bot-avatar">RE²</div>
				{/if}
				<div class="message-bubble" class:bot={message.role === 'bot'} class:user={message.role === 'user'}>
					{@html renderMarkdown(message.text)}
				</div>
			</div>
		{/each}
		{#if isThinking}
			<div class="message-wrapper">
				<div class="bot-avatar">RE²</div>
				<div class="message-bubble bot typing-indicator">
					<span class="dot"></span><span class="dot"></span><span class="dot"></span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Suggested Prompts -->
	{#if suggestedPrompts.length > 0 && messages.length === 0}
		<div class="chips-container">
			{#each suggestedPrompts as prompt, index (index)}
				<button
					class="chip"
					class:disabled={isChipDisabled(index)}
					onclick={() => handleChipClick(prompt, index)}
					disabled={isChipDisabled(index)}
				>
					{prompt}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Input Area -->
	<div class="input-area">
		<input
			type="text"
			class="message-input"
			placeholder="Type your question..."
			bind:value={userInput}
			onkeydown={handleKeyDown}
		/>
		<button
			class="send-button"
			onclick={handleSendMessage}
			disabled={!userInput.trim() || isThinking}
		>
			→
		</button>
	</div>
</div>

<style>
	.copilot-chat { display: flex; flex-direction: column; min-height: 480px; max-height: 600px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); overflow: hidden; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
	.copilot-header { background: var(--copilot-accent); color: white; padding: 16px; flex-shrink: 0; }
	.header-content { display: flex; align-items: flex-start; gap: 12px; }
	.icon-badge { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; }
	.icon { font-size: 18px; }
	.header-text { display: flex; flex-direction: column; gap: 2px; }
	.header-title { margin: 0; font-size: 14px; font-weight: 600; letter-spacing: -0.3px; }
	.header-subtitle { margin: 0; font-size: 12px; opacity: 0.9; letter-spacing: -0.2px; }
	.messages-area { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
	.message-wrapper { display: flex; gap: 8px; animation: fadeIn 0.2s ease-out; }
	.message-wrapper.user { justify-content: flex-end; }
	.bot-avatar { width: 32px; height: 32px; border-radius: 50%; background: #34C759; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: white; flex-shrink: 0; letter-spacing: -0.3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
	.message-bubble { max-width: 70%; padding: 10px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4; letter-spacing: -0.2px; }
	.message-bubble.bot { background: var(--copilot-bg); color: #1D1D1F; }
	.message-bubble.user { background: var(--copilot-accent); color: white; }
	.chips-container { padding: 0 16px 12px; display: flex; flex-wrap: wrap; gap: 8px; border-top: 1px solid #E5E5EA; }
	.chip { background: white; border: 1px solid #D5D5D9; border-radius: 20px; padding: 6px 12px; font-size: 12px; cursor: pointer; transition: all 0.2s ease; font-family: inherit; color: #1D1D1F; white-space: nowrap; }
	.chip:hover:not(:disabled) { border-color: var(--copilot-accent); color: var(--copilot-accent); background: rgba(74, 124, 92, 0.05); }
	.chip:disabled { opacity: 0.4; cursor: not-allowed; border-color: #D5D5D9; color: #A1A1A6; }
	.input-area { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #E5E5EA; background: white; flex-shrink: 0; }
	.message-input { flex: 1; border: 1px solid #D5D5D9; border-radius: 8px; padding: 8px 12px; font-size: 13px; font-family: inherit; outline: none; transition: border-color 0.2s; color: #1D1D1F; }
	.message-input::placeholder { color: #A1A1A6; }
	.message-input:focus { border-color: var(--copilot-accent); }
	.send-button { background: var(--copilot-accent); color: white; border: none; border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; transition: all 0.2s; flex-shrink: 0; font-weight: 600; }
	.send-button:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 2px 8px rgba(74, 124, 92, 0.3); }
	.send-button:disabled { opacity: 0.5; cursor: not-allowed; }
	.typing-indicator { display: flex; gap: 4px; align-items: center; padding: 12px 16px !important; }
	.typing-indicator .dot { width: 6px; height: 6px; border-radius: 50%; background: #A1A1A6; animation: typingBounce 1.4s infinite ease-in-out; }
	.typing-indicator .dot:nth-child(2) { animation-delay: 0.2s; }
	.typing-indicator .dot:nth-child(3) { animation-delay: 0.4s; }
	@keyframes typingBounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.4; } 40% { transform: translateY(-4px); opacity: 1; } }
	@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
	.messages-area::-webkit-scrollbar { width: 6px; }
	.messages-area::-webkit-scrollbar-track { background: transparent; }
	.messages-area::-webkit-scrollbar-thumb { background: #D5D5D9; border-radius: 3px; }
	.messages-area::-webkit-scrollbar-thumb:hover { background: #A1A1A6; }
</style>
