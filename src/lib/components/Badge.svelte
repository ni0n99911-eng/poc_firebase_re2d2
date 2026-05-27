<script>
	/**
	 * RE² Unified Badge Component
	 * Consistent status badges across the platform.
	 * Props:
	 *   variant - 'success' | 'warning' | 'error' | 'info' (default: 'info')
	 *   text - Badge text content
	 *   small - Use compact sizing (default: false)
	 */
	let {
		variant = 'info',
		text = '',
		small = false
	} = $props();
</script>

<span class="badge {variant}" class:small>{text}</span>

<style>
	.badge {
		display: inline-block;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		padding: 3px 10px;
		border-radius: 4px;
		line-height: 1.4;
		white-space: nowrap;
	}

	.badge.small {
		font-size: 9px;
		padding: 2px 8px;
		letter-spacing: 0.5px;
	}

	/* Green = complete / positive */
	.badge.success {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	/* Yellow = incomplete / warning */
	.badge.warning {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	/* Red = required / blocking */
	.badge.error {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	/* Grey/Blue = informational */
	.badge.info {
		background: rgba(59, 130, 246, 0.15);
		color: #3b82f6;
	}
</style>
