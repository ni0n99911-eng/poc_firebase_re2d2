<script lang="ts">
	import { onMount } from 'svelte';
	import { loadLaunchPadData } from '$lib/launchpad-store';

	let activeCategory = $state<string>('espresso');
	let lpData = $state(loadLaunchPadData());

	onMount(() => {
		lpData = loadLaunchPadData();
	});

	const categories: Record<string, { name: string; items: Array<{ name: string; price: string; pillar?: string; desc?: string }> }> = {
		espresso: {
			name: 'Espresso Drinks',
			items: [
				{ name: 'Espresso', price: '$3.50' },
				{ name: 'Americano', price: '$4/$5' },
				{ name: 'Cortado', price: '$4.50' },
				{ name: 'Flat White', price: '$5/$6' },
				{ name: 'Latte', price: '$5.50/$6.50' },
				{ name: 'Cappuccino', price: '$5/$6' },
				{ name: 'Mocha', price: '$6/$7' },
				{ name: 'Vanilla Latte', price: '$6/$7' }
			]
		},
		drip: {
			name: 'Drip & Cold Brew',
			items: [
				{ name: 'Drip Coffee', price: '$2.75/$3.25' },
				{ name: 'Cold Brew', price: '$4.50/$5.50' },
				{ name: 'Cold Brew + Oat', price: '$5.25/$6.25' }
			]
		},
		tea: {
			name: 'Tea Selection',
			items: [
				{ name: 'Green Tea', price: '$3.50/$4.50' },
				{ name: 'Earl Grey', price: '$3.50/$4.50' },
				{ name: 'Chamomile', price: '$3.50/$4.50' },
				{ name: 'Matcha Latte', price: '$6/$7' },
				{ name: 'Chai Latte', price: '$5.50/$6.50' },
				{ name: 'London Fog', price: '$5.50/$6.50' }
			]
		},
		functional: {
			name: 'Premium Signature Drinks',
			items: [
				{ name: 'Hot Protein Latte', price: '$9/$11', pillar: 'ENERGIZE', desc: '25g protein' },
				{ name: 'Iced Protein Latte', price: '$9/$11', pillar: 'ENERGIZE', desc: '25g protein' },
				{ name: 'Iced Protein Matcha', price: '$9/$11', pillar: 'ENERGIZE', desc: '25g protein' },
				{ name: 'Hot Chai Ginger Collagen', price: '$9/$11', pillar: 'GLOW', desc: '10g collagen' },
				{ name: 'Iced Cherry Lime Mag Spritz', price: '$9/$11', pillar: 'RESET', desc: '72 cal' }
			]
		},
		food: {
			name: 'Food & Grab-and-Go',
			items: [
				{ name: 'Overnight Oats', price: '$6.50' },
				{ name: 'Greek Yogurt Parfait', price: '$6.50' },
				{ name: 'Chia Pudding', price: '$6' },
				{ name: 'Hummus & Veggie Box', price: '$7.50' },
				{ name: 'Cheese & Fruit Box', price: '$7.50' },
				{ name: 'Turkey Wrap', price: '$8.50' },
				{ name: 'Avocado Bowl', price: '$9' },
				{ name: 'Fresh Fruit Cup', price: '$5' },
				{ name: 'Croissant', price: '$4/$4.50' },
				{ name: 'Bagel + Cream Cheese', price: '$4.50' },
				{ name: 'Egg Panini', price: '$7.50' },
				{ name: 'Turkey Panini', price: '$8.50' },
				{ name: 'Grilled Cheese', price: '$6.50' },
				{ name: 'Spinach Feta Wrap', price: '$7.50' },
				{ name: 'Cookie', price: '$4' },
				{ name: 'Muffin', price: '$4.50' },
				{ name: 'Brownie', price: '$4.50' },
				{ name: 'Energy Ball 3-pk', price: '$5' }
			]
		}
	};

	const bundles = [
		{ name: 'Morning Commuter', price: '$10', desc: 'coffee + breakfast', savings: 'Save $2' },
		{ name: 'Starter Bundle', price: '$13', desc: 'signature + grab&go', savings: 'Save $2-3' },
		{ name: 'Protein Power', price: '$13.50', desc: 'signature 12oz + protein bake', savings: 'Save $2' },
		{ name: 'Lunch Break', price: '$12', desc: 'panini/wrap + drink', savings: 'Save $2-2.50' },
		{ name: 'After-School Kids', price: '$7.50', desc: 'kids drink + food', savings: 'Save $1.50-2' }
	];

	const pillars = [
		{ name: 'ENERGIZE', emoji: '⚡', desc: 'Energy & Focus', color: '#ff2d55' },
		{ name: 'GLOW', emoji: '✨', desc: 'Self-Care & Vitality', color: '#ffd60a' },
		{ name: 'RESET', emoji: '🧘', desc: 'Calm & Relaxation', color: '#00e8cc' }
	];
</script>

<svelte:head>
	<title>RE² — Website Preview</title>
</svelte:head>

<div class="website-container">
	<!-- Hero Section -->
	<section class="hero-section">
		<div class="hero-content">
			<h1 class="soma-logo">{lpData.businessName?.split(' ')[0] || 'Your Brand'}</h1>
			<p class="hero-subtitle">{lpData.businessType || 'Your Business'}</p>
			<p class="hero-tagline">{lpData.visionStatement?.split('.')[0] || 'Your vision, your way'}</p>
			<p class="location">📍 {lpData.idealArea || 'New York, NY'}</p>
			<button class="cta-button">Order Now</button>
		</div>
	</section>

	<!-- Three Pillars -->
	<section class="pillars-section">
		<h2 class="section-title">Our Philosophy</h2>
		<div class="pillars-grid">
			{#each pillars as pillar}
				<div class="pillar-card" style="--pillar-color: {pillar.color}">
					<div class="pillar-emoji">{pillar.emoji}</div>
					<h3>{pillar.name}</h3>
					<p>{pillar.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Menu Section -->
	<section class="menu-section">
		<h2 class="section-title">Our Menu</h2>
		<div class="menu-tabs">
			{#each Object.entries(categories) as [key, cat]}
				<button
					class="tab-button"
					class:active={activeCategory === key}
					onclick={() => (activeCategory = key)}
				>
					{cat.name}
				</button>
			{/each}
		</div>

		<div class="menu-grid">
			{#each categories[activeCategory].items as item}
				<div class="menu-item" class:functional={item.pillar}>
					<div class="item-name">{item.name}</div>
					<div class="item-price">{item.price}</div>
					{#if item.pillar}
						<span class="pillar-badge" style="--badge-color: {pillars.find(p => p.name === item.pillar)?.color || '#999'}">
							{item.pillar}
						</span>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<!-- Bundles Section -->
	<section class="bundles-section">
		<h2 class="section-title">Bundles & Combos</h2>
		<div class="bundles-grid">
			{#each bundles as bundle}
				<div class="bundle-card">
					<h3>{bundle.name}</h3>
					<p class="bundle-price">{bundle.price}</p>
					<p class="bundle-desc">{bundle.desc}</p>
					<p class="bundle-savings">{bundle.savings}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- About Us Section -->
	<section class="about-section">
		<h2 class="section-title">Our Story</h2>
		<div class="about-grid">
			<div class="about-text">
				<p class="about-lead">{lpData?.businessName || 'Your Brand'} was born from a simple question: why can't your daily coffee actually make you healthier?</p>
				<p>We're a team of wellness enthusiasts, coffee obsessives, and community builders creating something new in your target market. Every drink at {lpData?.businessName?.split(' ')[0] || 'Your Brand'} is built with purpose — real adaptogens, transparent nutrition, zero fillers.</p>
				<p>Located in a prime neighborhood, we're designed to be the community's daily ritual — for the office worker grabbing a protein latte before work, the wellness enthusiast recovering after class, and the parent supporting their family's health.</p>
				<p>Our three pillars — <span style="color: #ff2d55">ENERGIZE</span>, <span style="color: #bf5af2">GLOW</span>, and <span style="color: #00e8cc">RESET</span> — guide everything we create. Building a full lineup of purpose-driven beverages tailored to your market.</p>
			</div>
			<div class="about-stats">
				<div class="about-stat">
					<div class="about-stat-value">74</div>
					<div class="about-stat-label">Menu Items</div>
				</div>
				<div class="about-stat">
					<div class="about-stat-value">3</div>
					<div class="about-stat-label">Wellness Pillars</div>
				</div>
				<div class="about-stat">
					<div class="about-stat-value">5</div>
					<div class="about-stat-label">Signature Drinks</div>
				</div>
				<div class="about-stat">
					<div class="about-stat-value">1</div>
					<div class="about-stat-label">Mission</div>
				</div>
			</div>
		</div>
		<div class="about-values">
			<div class="value-card">
				<div class="value-icon">🌱</div>
				<h4>Real Ingredients</h4>
				<p>Every ingredient is transparent, functional, and purposeful. No artificial anything.</p>
			</div>
			<div class="value-card">
				<div class="value-icon">🔬</div>
				<h4>Science-Backed</h4>
				<p>Our formulations are built on adaptogenic science — ashwagandha, collagen, magnesium, and more.</p>
			</div>
			<div class="value-card">
				<div class="value-icon">🏘️</div>
				<h4>Community First</h4>
				<p>From our kids menu to our loyalty program, {lpData?.businessName?.split(' ')[0] || 'Your Brand'} is built for the neighborhood.</p>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="website-footer">
		<div class="footer-content">
			<h3>{lpData?.businessName || 'Your Brand'}</h3>
			<p>Fuel your purpose • 600 Sixth Avenue, Manhattan, NY • yourwebsite.com</p>
		</div>
	</footer>
</div>

<style>
	.website-container {
		background: var(--white);
		color: var(--text);
		min-height: 100vh;
		overflow-x: hidden;
	}

	/* Hero Section */
	.hero-section {
		background: linear-gradient(135deg, var(--surface-alt) 0%, #f0f0f5 100%);
		padding: 100px 20px;
		text-align: center;
		border-bottom: 2px solid var(--border);
	}

	.hero-content {
		max-width: 900px;
		margin: 0 auto;
	}

	.soma-logo {
		font-size: 5rem;
		font-weight: 900;
		margin: 0 0 10px 0;
		letter-spacing: 6px;
		background: linear-gradient(90deg, var(--danger), var(--warning), var(--accent));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.hero-subtitle {
		font-size: 1.8rem;
		color: var(--text-secondary);
		margin: 0 0 5px 0;
		font-weight: 300;
	}

	.hero-tagline {
		font-size: 2.2rem;
		color: var(--warning);
		margin: 20px 0;
		font-weight: 400;
	}

	.location {
		font-size: 1.2rem;
		color: var(--text-secondary);
		margin: 20px 0;
	}

	.cta-button {
		background: linear-gradient(90deg, var(--danger), #ff7f7f);
		color: white;
		border: none;
		padding: 14px 40px;
		font-size: 1.1rem;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		margin-top: 20px;
		transition: all 0.3s ease;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.cta-button:hover {
		transform: scale(1.05);
		box-shadow: 0 10px 30px rgba(220, 38, 38, 0.25);
	}

	/* Pillars Section */
	.pillars-section {
		padding: 80px 20px;
		max-width: 1200px;
		margin: 0 auto;
	}

	.section-title {
		text-align: center;
		font-size: 2.8rem;
		font-weight: 700;
		margin-bottom: 60px;
		color: var(--text);
	}

	.pillars-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 30px;
	}

	.pillar-card {
		background: var(--surface-alt);
		border: 2px solid var(--pillar-color);
		border-radius: 12px;
		padding: 45px 25px;
		text-align: center;
		transition: all 0.3s ease;
	}

	.pillar-card:hover {
		transform: translateY(-10px);
		box-shadow: 0 15px 40px rgba(220, 38, 38, 0.25);
	}

	.pillar-emoji {
		font-size: 3.5rem;
		margin-bottom: 15px;
	}

	.pillar-card h3 {
		font-size: 1.6rem;
		margin: 15px 0 10px 0;
		color: var(--pillar-color);
		text-transform: uppercase;
		letter-spacing: 2px;
		font-weight: 700;
	}

	.pillar-card p {
		color: var(--text-secondary);
		font-size: 1.1rem;
		margin: 0;
	}

	/* Menu Section */
	.menu-section {
		padding: 80px 20px;
		max-width: 1200px;
		margin: 0 auto;
	}

	.menu-tabs {
		display: flex;
		justify-content: center;
		gap: 12px;
		margin-bottom: 50px;
		flex-wrap: wrap;
	}

	.tab-button {
		padding: 12px 24px;
		border: 2px solid var(--border);
		background: transparent;
		color: var(--text-secondary);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.3s ease;
		font-size: 1rem;
		font-weight: 600;
	}

	.tab-button:hover {
		color: var(--success);
		border-color: var(--success);
	}

	.tab-button.active {
		background: var(--success);
		color: white;
		border-color: var(--success);
	}

	.menu-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 20px;
	}

	.menu-item {
		background: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 20px;
		transition: all 0.3s ease;
		position: relative;
	}

	.menu-item:hover {
		border-color: var(--success);
		transform: translateY(-5px);
		box-shadow: var(--shadow);
	}

	.menu-item.functional {
		border-left: 4px solid var(--pillar-color);
	}

	.item-name {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 8px;
	}

	.item-price {
		font-size: 1.2rem;
		color: var(--warning);
		font-weight: 700;
	}

	.pillar-badge {
		display: inline-block;
		margin-top: 12px;
		padding: 6px 14px;
		background: var(--badge-color);
		color: white;
		font-size: 0.75rem;
		font-weight: 700;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	/* Bundles Section */
	.bundles-section {
		padding: 80px 20px;
		max-width: 1200px;
		margin: 0 auto;
		background: linear-gradient(135deg, rgba(220, 38, 38, 0.06) 0%, rgba(13, 124, 110, 0.06) 100%);
		border-radius: 20px;
		margin-bottom: 80px;
	}

	.bundles-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 25px;
	}

	.bundle-card {
		background: linear-gradient(135deg, var(--surface-alt) 0%, #f0f0f5 100%);
		border: 2px solid var(--danger);
		border-radius: 12px;
		padding: 35px;
		text-align: center;
		transition: all 0.3s ease;
	}

	.bundle-card:hover {
		transform: scale(1.08);
		box-shadow: 0 15px 40px rgba(220, 38, 38, 0.20);
	}

	.bundle-card h3 {
		font-size: 1.4rem;
		margin: 0 0 15px 0;
		color: var(--danger);
		font-weight: 700;
	}

	.bundle-price {
		font-size: 2.2rem;
		font-weight: 800;
		color: var(--warning);
		margin: 15px 0;
	}

	.bundle-desc {
		color: var(--text-secondary);
		margin: 12px 0;
		font-size: 1rem;
	}

	.bundle-savings {
		color: var(--accent);
		font-weight: 700;
		margin-top: 15px;
		font-size: 1.05rem;
	}

	/* About Section */
	.about-section { padding: 60px 20px; max-width: 1100px; margin: 0 auto; }
	.about-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 40px; margin-top: 30px; }
	.about-lead { font-size: 1.3rem; color: var(--text); font-weight: 600; line-height: 1.5; margin-bottom: 20px; }
	.about-text p { color: var(--text-secondary); line-height: 1.7; margin-bottom: 16px; font-size: 1rem; }
	.about-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
	.about-stat { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 12px; padding: 24px; text-align: center; }
	.about-stat-value { font-size: 2.5rem; font-weight: 800; color: var(--danger); }
	.about-stat-label { font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
	.about-values { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 40px; }
	.value-card { background: var(--surface-alt); border: 1px solid var(--border); border-radius: 12px; padding: 30px; text-align: center; transition: all 0.3s; }
	.value-card:hover { border-color: var(--danger); transform: translateY(-2px); }
	.value-icon { font-size: 2.5rem; margin-bottom: 12px; }
	.value-card h4 { font-size: 1.1rem; color: var(--text); margin: 0 0 10px 0; }
	.value-card p { color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5; margin: 0; }
	@media (max-width: 768px) { .about-grid { grid-template-columns: 1fr; } .about-values { grid-template-columns: 1fr; } }

	/* Footer */
	.website-footer {
		background: var(--surface-alt);
		border-top: 2px solid var(--border);
		padding: 50px 20px;
		text-align: center;
	}

	.footer-content h3 {
		font-size: 1.6rem;
		margin: 0 0 10px 0;
		color: var(--text);
	}

	.footer-content p {
		color: var(--text-secondary);
		margin: 0;
		font-size: 1.05rem;
	}

	.pillar-card p {
		color: var(--text-secondary);
	}

	@media (max-width: 768px) {
		.soma-logo {
			font-size: 3.5rem;
		}

		.hero-tagline {
			font-size: 1.6rem;
		}

		.section-title {
			font-size: 2rem;
		}

		.pillars-grid {
			grid-template-columns: 1fr;
		}

		.menu-grid {
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		}

		.bundles-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
