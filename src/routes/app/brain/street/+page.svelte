<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';

	const addr = $derived(page.url.searchParams.get('addr') ?? '');

	let address = $state('');
	let neighborhood = $state('');
	let hasSession = $state(false);

	onMount(() => {
		try {
			const loc = JSON.parse(localStorage.getItem('re2_selected_location') || '{}');
			address = loc.addr || '';
			neighborhood = loc.neighborhood || '';
		} catch {}
		try {
			const session = JSON.parse(localStorage.getItem('re2_session') || '{}');
			hasSession = !!(session.analyzedAddress || session.locationIQ);
		} catch {}
	});
</script>

<svelte:head>
	<title>RE² — Street-Side Intelligence</title>
</svelte:head>

<div class="brain-page">
	<!-- TOOL STRIP -->
	<div class="tools-strip">
		<a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Overview</a>
		<div class="tools-sep"></div>
		<a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab back-tab">← Score</a>
		<div class="tools-sep"></div>
		<a href="/app/brain/compare{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Compare</a>
		<a href="/app/brain/success-map{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Success Map</a>
		<a href="/app/brain/daypart{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Daypart Traffic</a>
		<a href="/app/brain/segments{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Segment Intel</a>
		<a href="/app/brain/street{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab active">Street View</a>
		<a href="/app/brain/transparency{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Score Breakdown</a>
	</div>
	<!-- PAGE BODY -->
	<div class="page-body">
		{#if !hasSession}
			<div class="empty-state">
				<div class="empty-state-icon">📍</div>
				<h2>No Location Scored Yet</h2>
				<p>Score a location first to see this intelligence.</p>
				<a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="empty-state-cta">Score a Location</a>
			</div>
		{:else}
			<div class="page-title-row">
				<span class="page-label">Street-Side Intelligence</span>
			</div>
			<div class="page-title">Street-Side Intelligence</div>
			<div class="page-desc">Which side of the street matters — census boundaries, block-group differences, and hyperlocal foot traffic modifiers.</div>

			<div class="coming-soon-frame">
			<div class="cs-icon">🛣️</div>
			<div class="cs-title">Coming Soon</div>
			<div class="cs-body">Street-Side Intelligence analyzes how census boundaries running down the street create different block groups on each side — different demographics, competition density, and foot traffic character. This tool is in development.</div>
			<a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="cs-btn">← Back to Score</a>
		</div>
		{/if}
	</div>
</div>

<style>
	:root {
		--sage: #4a7c5c;
		--hot-pink: #e8345a;
		--deep-green: #1a3a2a;
		--marigold: #e8a838;
		--accent: var(--sage);
		--bg: #faf7f2;
		--surface: #ffffff;
		--text: #2c2c2c;
		--text-light: #666666;
		--border: #e8e2d8;
		--sage-light: #e8f2ec;
		--sage-bg: rgba(74, 124, 92, 0.08);
	}
	.brain-page {
		min-height: 100vh;
		background: var(--bg);
		font-family: 'DM Sans', -apple-system, sans-serif;
		color: var(--text);
	}
	.topbar {
		display: flex; align-items: center; justify-content: space-between;
		padding: 0 20px; background: rgba(250,247,242,0.96);
		backdrop-filter: blur(16px); border-bottom: 1px solid var(--border);
		height: 56px; position: sticky; top: 0; z-index: 200;
	}
	.topbar-left { display: flex; align-items: center; gap: 16px; }
	.logo {
		font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 400;
		color: var(--text); text-decoration: none; letter-spacing: -0.3px;
	}
	.logo sup { color: var(--hot-pink); font-size: 11px; }
	.sep { width: 1px; height: 20px; background: var(--border); }
	.addr { font-size: 13px; color: var(--text-light); font-weight: 600; }
	.addr-sub { font-size: 11px; color: var(--text-light); margin-left: 6px; font-weight: 400; }
	.addr-empty { font-style: italic; opacity: 0.5; }
	.topbar-right { display: flex; gap: 8px; align-items: center; }
	.tb-btn {
		font-size: 12px; padding: 6px 14px; border-radius: 8px; text-decoration: none;
		border: 1px solid var(--border); color: var(--text-light); background: var(--surface);
		cursor: pointer; font-family: inherit; font-weight: 500; transition: all 0.2s;
	}
	.tb-btn.pri { background: var(--deep-green); color: white; border-color: var(--deep-green); font-weight: 600; }
	.tb-btn:hover { border-color: var(--sage); }
	.tb-btn.pri:hover { background: #0f2218; }

	.tools-strip {
		display: flex; align-items: center; gap: 2px; padding: 0 14px;
		background: var(--surface); border-bottom: 1px solid var(--border);
		height: 42px; overflow-x: auto; flex-shrink: 0;
		position: sticky; top: 56px; z-index: 190;
	}
	.tools-strip::-webkit-scrollbar { display: none; }
	.tool-tab {
		display: flex; align-items: center; gap: 5px; padding: 6px 12px;
		border-radius: 6px; font-size: 11px; font-weight: 600; color: var(--text-light);
		text-decoration: none; white-space: nowrap; transition: all 0.15s;
		border: 1px solid transparent; font-family: inherit;
	}
	.tool-tab:hover { background: #f5f0e8; color: var(--text); }
	.tool-tab.active { background: var(--deep-green); color: white; }
	.tools-sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; flex-shrink: 0; }

	.page-body { max-width: 1100px; margin: 0 auto; padding: 28px 24px 80px; }
	.page-title-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
	.page-label {
		font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
		color: var(--sage); background: var(--sage-bg); padding: 3px 10px; border-radius: 4px;
	}
	.page-title {
		font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 400;
		letter-spacing: -0.3px; color: var(--text); margin-bottom: 4px;
	}
	.page-desc { color: var(--text-light); font-size: 13px; margin-bottom: 24px; max-width: 700px; line-height: 1.5; }

	.coming-soon-frame {
		background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
		padding: 60px 40px; text-align: center;
		box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
	}
	.cs-icon { font-size: 48px; margin-bottom: 16px; }
	.cs-title {
		font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 400;
		color: var(--text); margin-bottom: 12px; letter-spacing: -0.3px;
	}
	.cs-body { font-size: 15px; color: var(--text-light); line-height: 1.65; max-width: 480px; margin: 0 auto 28px; }
	.cs-btn {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600;
		background: var(--deep-green); color: white; text-decoration: none;
		transition: background 0.2s;
	}
	.cs-btn:hover { background: #0f2218; }

	.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; padding: 48px 24px; }
	.empty-state-icon { font-size: 48px; margin-bottom: 16px; }
	.empty-state h2 { font-family: 'Playfair Display', serif; font-size: 28px; color: var(--deep-green); margin: 0 0 8px; }
	.empty-state p { color: var(--text-light); font-size: 16px; margin: 0 0 24px; }
	.empty-state-cta { background: var(--deep-green); color: var(--bg); padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; }
	.empty-state-cta:hover { background: var(--sage); }
</style>
