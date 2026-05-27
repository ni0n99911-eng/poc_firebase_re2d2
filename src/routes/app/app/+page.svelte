<script>
	import { onMount } from 'svelte';
	import { loadLaunchPadData } from '$lib/launchpad-store';

	let activeTab = $state('menu');
	let showLoyalty = $state(false);
	let brandName = $state('Your Brand');
	let tokenSymbol = $state('TOKEN');

	onMount(() => {
		const lpData = loadLaunchPadData();
		if (lpData.businessName) {
			brandName = lpData.businessName;
			tokenSymbol = lpData.businessName.split(' ')[0].toUpperCase();
		}
	});

	const features = [
		{ name: 'Browse Menu', icon: '☕', desc: 'Browse your full menu' },
		{ name: 'Quick Order', icon: '📦', desc: 'Bundles & combos' },
		{ name: 'Earn Rewards', icon: '⭐', desc: 'Loyalty points' },
		{ name: 'Tokens', icon: '🪙', desc: 'RWA governance' }
	];

	const menuItems = [
		{ name: 'Espresso', price: '$3.50', category: 'espresso' },
		{ name: 'Latte', price: '$5.50', category: 'espresso' },
		{ name: 'Cold Brew', price: '$4.50', category: 'drip' },
		{ name: 'Matcha Latte', price: '$6', category: 'tea' },
		{ name: 'Signature Item', price: '$9', category: 'functional', badge: 'POPULAR' },
		{ name: 'Overnight Oats', price: '$6.50', category: 'food' },
		{ name: 'Morning Bundle', price: '$10', category: 'bundle', highlight: true }
	];

	const bundles = [
		{ name: 'Morning Commuter', price: '$10', desc: 'coffee + breakfast' },
		{ name: 'Signature Starter', price: '$13', desc: 'signature + food' },
		{ name: 'Protein Power', price: '$13.50', desc: 'protein + bake' },
		{ name: 'Lunch Break', price: '$12', desc: 'panini + drink' }
	];

	let loyaltyTiers = $derived([
		{ tier: 'Bronze', color: '#a0746d', points: '0-500', benefit: `1% ${tokenSymbol} per $` },
		{ tier: 'Silver', color: '#c0c0c0', points: '500-1500', benefit: `2% ${tokenSymbol} per $` },
		{ tier: 'Gold', color: '#ffd60a', points: '1500+', benefit: `3% ${tokenSymbol} per $` }
	]);
</script>

<svelte:head>
	<title>RE² — App Preview</title>
</svelte:head>

<div class="container">
	<header class="page-header">
		<h1>📱 {brandName} Mobile App</h1>
		<p class="subtitle">Order, earn rewards, and govern with {tokenSymbol} tokens</p>
	</header>

	<section class="app-preview-section">
		<div class="content-grid">
			<!-- Features Column -->
			<div class="features-column">
				<h2>App Features</h2>
				<div class="features-list">
					{#each features as feature}
						<div class="feature-item">
							<div class="feature-icon">{feature.icon}</div>
							<div class="feature-text">
								<h4>{feature.name}</h4>
								<p>{feature.desc}</p>
							</div>
						</div>
					{/each}
				</div>

				<div class="app-store-buttons">
					<button class="store-btn app-store">
						<span class="store-icon">🍎</span>
						App Store
					</button>
					<button class="store-btn google-play">
						<span class="store-icon">🔵</span>
						Google Play
					</button>
				</div>
			</div>

			<!-- Phone Mockup -->
			<div class="phone-column">
				<div class="phone-frame">
					<div class="phone-notch"></div>
					<div class="phone-status-bar"></div>

					<div class="phone-content">
						<!-- Header -->
						<div class="phone-header">
							<div class="header-title">
								<span class="soma-text">{tokenSymbol}</span>
								<span class="loyalty-badge">✨ Gold</span>
							</div>
							<p class="user-greeting">Good morning!</p>
						</div>

						<!-- Tab Navigation -->
						<div class="tab-nav">
							<button
								class="tab-nav-btn"
								class:active={activeTab === 'menu'}
								onclick={() => (activeTab = 'menu')}
							>
								☕ Menu
							</button>
							<button
								class="tab-nav-btn"
								class:active={activeTab === 'bundles'}
								onclick={() => (activeTab = 'bundles')}
							>
								📦 Bundles
							</button>
							<button
								class="tab-nav-btn"
								class:active={activeTab === 'loyalty'}
								onclick={() => (activeTab = 'loyalty')}
							>
								⭐ Rewards
							</button>
						</div>

						<!-- Content Area -->
						<div class="phone-content-area">
							{#if activeTab === 'menu'}
								<div class="menu-content">
									{#each menuItems as item}
										{#if item.category !== 'bundle'}
											<div class="phone-menu-item" class:featured={item.highlight}>
												<div class="item-header">
													<span class="item-name">{item.name}</span>
													{#if item.badge}
														<span class="item-badge" style="--badge-color: #ff2d55">
															{item.badge}
														</span>
													{/if}
												</div>
												<span class="item-price">{item.price}</span>
											</div>
										{/if}
									{/each}
								</div>
							{:else if activeTab === 'bundles'}
								<div class="bundles-content">
									{#each bundles as bundle}
										<div class="phone-bundle-item">
											<div class="bundle-name">{bundle.name}</div>
											<div class="bundle-price">{bundle.price}</div>
											<div class="bundle-desc">{bundle.desc}</div>
											<button class="add-btn">+ Add</button>
										</div>
									{/each}
								</div>
							{:else if activeTab === 'loyalty'}
								<div class="loyalty-content">
									<div class="points-display">
										<div class="points-number">1,247</div>
										<div class="points-label">Current Points</div>
									</div>

									<div class="tier-display">
										<p class="tier-label">Your Tier</p>
										{#each loyaltyTiers as tier}
											<div class="tier-badge" style="--tier-color: {tier.color}">
												<span class="tier-name">{tier.tier}</span>
												<span class="tier-benefit">{tier.benefit}</span>
											</div>
										{/each}
									</div>

									<button class="claim-btn">Redeem Rewards</button>
								</div>
							{/if}
						</div>

						<!-- Bottom CTA -->
						<div class="phone-cta">
							<button class="cta-primary">Order Now</button>
						</div>
					</div>

					<!-- iPhone Bottom Home Bar -->
					<div class="phone-home-bar"></div>
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	.container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 40px 20px;
		background-color: var(--white);
		color: var(--text);
		min-height: 100vh;
	}

	.page-header {
		text-align: center;
		margin-bottom: 60px;
	}

	.page-header h1 {
		font-size: 2.8rem;
		font-weight: 700;
		margin: 0 0 10px 0;
		color: var(--text);
	}

	.subtitle {
		font-size: 1.2rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.app-preview-section {
		display: flex;
		justify-content: center;
	}

	.content-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 60px;
		align-items: start;
		width: 100%;
		max-width: 1200px;
	}

	/* Features Column */
	.features-column h2 {
		font-size: 1.8rem;
		font-weight: 700;
		margin: 0 0 30px 0;
		color: var(--text);
	}

	.features-list {
		display: flex;
		flex-direction: column;
		gap: 20px;
		margin-bottom: 40px;
	}

	.feature-item {
		display: flex;
		gap: 15px;
		align-items: flex-start;
		padding: 20px;
		background: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: 10px;
		transition: all 0.3s ease;
	}

	.feature-item:hover {
		border-color: var(--success);
		background: linear-gradient(135deg, var(--surface-alt) 0%, #f0f0f5 100%);
	}

	.feature-icon {
		font-size: 2.5rem;
		flex-shrink: 0;
		min-width: 50px;
	}

	.feature-text h4 {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0 0 5px 0;
		color: var(--text);
	}

	.feature-text p {
		font-size: 0.95rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.app-store-buttons {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.store-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 15px 20px;
		border: 2px solid var(--border);
		background: transparent;
		color: var(--text);
		border-radius: 10px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.store-btn:hover {
		border-color: var(--success);
		background: var(--green-soft);
	}

	.store-icon {
		font-size: 1.3rem;
	}

	/* Phone Column */
	.phone-column {
		display: flex;
		justify-content: center;
		align-items: flex-start;
	}

	.phone-frame {
		width: 320px;
		height: 640px;
		background: #000;
		border: 12px solid var(--border);
		border-radius: 50px;
		box-shadow: 0 30px 60px rgba(0, 0, 0, 0.15), inset 0 0 0 1px rgba(0,0,0,0.1);
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.phone-notch {
		width: 180px;
		height: 28px;
		background-color: #000;
		border-radius: 0 0 25px 25px;
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		z-index: 50;
	}

	.phone-status-bar {
		height: 8px;
		background: linear-gradient(90deg, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0));
		position: relative;
		z-index: 20;
	}

	.phone-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 35px 20px 20px 20px;
		background: linear-gradient(135deg, var(--white) 0%, var(--surface-alt) 100%);
		overflow: hidden;
	}

	.phone-header {
		margin-bottom: 20px;
	}

	.header-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 5px;
	}

	.soma-text {
		font-size: 1.8rem;
		font-weight: 800;
		color: var(--accent);
		letter-spacing: 2px;
	}

	.loyalty-badge {
		font-size: 0.8rem;
		color: var(--warning);
		font-weight: 700;
		padding: 4px 10px;
		background: var(--amber-soft);
		border-radius: 12px;
	}

	.user-greeting {
		font-size: 0.9rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.tab-nav {
		display: flex;
		gap: 8px;
		margin-bottom: 20px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		padding-bottom: 12px;
	}

	.tab-nav-btn {
		flex: 1;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-secondary);
		padding: 8px 0;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
		text-align: center;
	}

	.tab-nav-btn.active {
		color: var(--text);
		border-bottom-color: var(--accent);
	}

	.tab-nav-btn:hover:not(.active) {
		color: var(--text);
	}

	.phone-content-area {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		margin-bottom: 12px;
	}

	.phone-content-area::-webkit-scrollbar {
		width: 3px;
	}

	.phone-content-area::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.15);
		border-radius: 2px;
	}

	.menu-content {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.phone-menu-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 0;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}

	.phone-menu-item.featured {
		background: rgba(180, 83, 9, 0.08);
		padding: 12px 8px;
		border-radius: 6px;
		border-left: 3px solid var(--accent);
	}

	.item-header {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
	}

	.item-name {
		font-size: 0.9rem;
		color: var(--text);
		font-weight: 500;
	}

	.item-badge {
		font-size: 0.65rem;
		padding: 3px 8px;
		background: var(--badge-color);
		color: white;
		border-radius: 3px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.item-price {
		font-size: 0.95rem;
		color: var(--warning);
		font-weight: 700;
	}

	.bundles-content {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.phone-bundle-item {
		background: var(--red-soft);
		border: 1px solid var(--danger);
		border-radius: 8px;
		padding: 12px;
	}

	.bundle-name {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 4px;
	}

	.bundle-price {
		font-size: 1rem;
		color: var(--warning);
		font-weight: 800;
		margin-bottom: 4px;
	}

	.bundle-desc {
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin-bottom: 8px;
	}

	.add-btn {
		width: 100%;
		padding: 8px;
		background: var(--danger);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.add-btn:active {
		transform: scale(0.95);
	}

	.loyalty-content {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.points-display {
		background: linear-gradient(135deg, rgba(180, 83, 9, 0.08), var(--amber-soft));
		border: 1px solid var(--accent);
		border-radius: 12px;
		padding: 20px;
		text-align: center;
	}

	.points-number {
		font-size: 2.2rem;
		font-weight: 800;
		color: var(--accent);
	}

	.points-label {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin-top: 5px;
	}

	.tier-display {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.tier-label {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin: 0 0 8px 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.tier-badge {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px;
		background: rgba(0, 0, 0, 0.04);
		border-left: 3px solid var(--tier-color);
		border-radius: 6px;
	}

	.tier-name {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--text);
	}

	.tier-benefit {
		font-size: 0.8rem;
		color: var(--tier-color);
		font-weight: 600;
	}

	.claim-btn {
		width: 100%;
		padding: 12px;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.claim-btn:hover {
		background: #a64d00;
		transform: scale(1.02);
	}

	.phone-cta {
		padding-top: 12px;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
	}

	.cta-primary {
		width: 100%;
		padding: 14px;
		background: linear-gradient(90deg, var(--danger), #ff7f7f);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.cta-primary:hover {
		transform: scale(1.02);
		box-shadow: 0 5px 15px rgba(220, 38, 38, 0.25);
	}

	.phone-home-bar {
		height: 16px;
		background: linear-gradient(to top, rgba(245, 245, 247, 0.8), transparent);
	}

	@media (max-width: 1100px) {
		.content-grid {
			grid-template-columns: 1fr;
			gap: 40px;
		}

		.phone-frame {
			width: 280px;
			height: 560px;
		}
	}

	@media (max-width: 768px) {
		.page-header h1 {
			font-size: 2rem;
		}

		.features-column h2 {
			font-size: 1.5rem;
		}

		.phone-frame {
			width: 260px;
			height: 520px;
		}
	}
</style>
