// ──────────────────────────────────────────────
// RE² Module Registry — Einstein Architecture
// ──────────────────────────────────────────────
// Each "Einstein" module is a standalone product that can be
// purchased individually or as part of a tiered bundle.
//
// Tiers:
//   Founder (Free)  → location-einstein
//   Pro ($99/mo)    → location + space + business + loan + operations
//   Enterprise      → all modules (Pro + launch-einstein)
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Site Configuration — single source of truth for domain/branding
// Change these when migrating to a new domain (e.g. RE² branded domain)
// ──────────────────────────────────────────────
export const SITE_CONFIG = {
	domain: 'resquared.io',
	url: 'https://resquared.io',
	name: 'RE²',
	tagline: 'Real Estate Einstein',
	company: 'RE Squared LLC',
	emails: {
		support: 'support@resquared.io',
		hello: 'hello@resquared.io',
		enterprise: 'enterprise@resquared.io',
	},
	userAgent: 'resquared.io/location-intel',
} as const;

/**
 * SUPER_ADMINS — hardcoded fallback admin list.
 *
 * @deprecated Prefer getAdminEmails() which queries the admin_users Supabase
 * table (migration 024) and falls back to this list on error.
 * Update the DB table to add/remove admins without a code deploy.
 */
export const SUPER_ADMINS = ['gaurav.joshi06@gmail.com', 'kalpna.gaule@gmail.com'];

/**
 * getAdminEmails — returns active super-admin email list from Supabase.
 *
 * Falls back to SUPER_ADMINS if the DB is unavailable or the table doesn't
 * exist yet (e.g. migration 024 not yet run in this environment).
 *
 * Usage: replace `SUPER_ADMINS.includes(email)` with
 *   `(await getAdminEmails()).includes(email)`
 * in hooks.server.ts and API route guards.
 */
export async function getAdminEmails(): Promise<string[]> {
	try {
		const { createClient } = await import('@supabase/supabase-js');
		const url  = (typeof process !== 'undefined' ? process.env.SUPABASE_URL  : undefined) ?? '';
		const key  = (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined) ?? '';
		if (!url || !key) return SUPER_ADMINS;

		const supabase = createClient(url, key);
		const { data, error } = await supabase
			.from('admin_users')
			.select('email')
			.eq('active', true)
			.eq('role', 'super_admin');

		if (error || !data?.length) return SUPER_ADMINS;
		return data.map((r: { email: string }) => r.email.toLowerCase());
	} catch {
		return SUPER_ADMINS;
	}
}

export type EinsteinModule = 'location-einstein' | 'space-einstein' | 'business-einstein' | 'loan-einstein' | 'launch-einstein' | 'operations-einstein';

export const EINSTEIN_MODULES: Record<EinsteinModule, {
	label: string;
	shortLabel: string;
	icon: string;
	color: string;
	description: string;
}> = {
	'location-einstein': {
		label: 'Location Einstein',
		shortLabel: 'Location',
		icon: '📍',
		color: 'var(--accent, #00d9ff)',
		description: 'Score any NYC address across 17 data layers with block-level precision.'
	},
	'business-einstein': {
		label: 'Business Einstein',
		shortLabel: 'Business',
		icon: '📊',
		color: 'var(--coffee, #c89b3c)',
		description: 'Financial modeling, business structure, and revenue projections.'
	},
	'loan-einstein': {
		label: 'Loan Einstein',
		shortLabel: 'Loan',
		icon: '🏦',
		color: '#00ff88',
		description: 'Lender-ready packages, capital structure, and SBA routing.'
	},
	'space-einstein': {
		label: 'Space Einstein',
		shortLabel: 'Space',
		icon: '🏢',
		color: '#ff6b35',
		description: 'Score commercial units across physical readiness, visibility, lease economics, and structural flexibility.'
	},
	'launch-einstein': {
		label: 'Launch Einstein',
		shortLabel: 'Launch',
		icon: '🚀',
		color: '#a78bfa',
		description: 'Launch planning, project management, and go-to-market execution.'
	},
	'operations-einstein': {
		label: 'Operations Einstein',
		shortLabel: 'Operations',
		icon: '📋',
		color: '#10B981',
		description: 'Employee handbook, SOP manual, and compliance checklist generation.'
	}
};

// Pricing tier definitions — 4-segment model
export const PRICING_TIERS = {
	scout: {
		name: 'Scout',
		modules: ['location-einstein'] as EinsteinModule[],
		price: 'Free',
		period: 'during beta'
	},
	builder: {
		name: 'Builder',
		modules: ['location-einstein', 'space-einstein', 'business-einstein'] as EinsteinModule[],
		price: 79,
		period: '/month'
	},
	pro: {
		name: 'Pro',
		modules: ['location-einstein', 'space-einstein', 'business-einstein', 'loan-einstein'] as EinsteinModule[],
		price: 149,
		period: '/month'
	},
	enterprise: {
		name: 'Enterprise',
		modules: ['location-einstein', 'space-einstein', 'business-einstein', 'loan-einstein', 'launch-einstein', 'operations-einstein'] as EinsteinModule[],
		price: 249,
		period: '/month'
	}
};

/**
 * fetchPricingTiers — returns pricing tier config from Supabase pricing_tiers table.
 *
 * Falls back to inline PRICING_TIERS if the DB is unavailable or migration 025
 * has not yet been applied in this environment.
 *
 * The returned shape mirrors PRICING_TIERS so callers are drop-in compatible.
 */
export async function fetchPricingTiers(): Promise<typeof PRICING_TIERS> {
	try {
		const { createClient } = await import('@supabase/supabase-js');
		const url  = (typeof process !== 'undefined' ? process.env.SUPABASE_URL  : undefined) ?? '';
		const key  = (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined) ?? '';
		if (!url || !key) return PRICING_TIERS;

		const supabase = createClient(url, key);
		const { data, error } = await supabase
			.from('pricing_tiers')
			.select('slug, name, price_cents, period, modules')
			.eq('active', true)
			.order('display_order');

		if (error || !data?.length) return PRICING_TIERS;

		// Reconstruct into the same shape as the inline constant
		return Object.fromEntries(
			data.map((row: { slug: string; name: string; price_cents: number | null; period: string; modules: string[] }) => [
				row.slug,
				{
					name: row.name,
					modules: row.modules as EinsteinModule[],
					price: row.price_cents == null ? 'Free' : row.price_cents / 100,
					period: row.period,
				}
			])
		) as unknown as typeof PRICING_TIERS;
	} catch {
		return PRICING_TIERS;
	}
}

// ──────────────────────────────────────────────
// Route → Module mapping
// Maps specific route paths to the Einstein module that gates them.
// ──────────────────────────────────────────────
export const ROUTE_MODULE_MAP: Record<string, EinsteinModule> = {
	// Phase 1: Your Vision (free tier — location-einstein)
	'/app/vision': 'location-einstein',

	// Phase 2: Reality Check
	'/app/location': 'location-einstein',
	'/app/outcomes': 'location-einstein',
	'/app/recommendations': 'location-einstein',

	// Phase 2.5: Space Einstein (under Reality Check)
	'/app/space': 'space-einstein',

	// Phase 3: Your Path Forward
	'/app/model': 'business-einstein',
	'/app/financials': 'business-einstein',
	'/app/business-plan': 'business-einstein',   // was launch-einstein — same gate as old /app/financials
	'/app/loans': 'loan-einstein',

	// Phase 4: Launch Kit
	'/app/launch-pack': 'launch-einstein',
	'/app/kanban': 'launch-einstein',

	// Phase 6: Operations
	'/app/operations': 'operations-einstein',

	// Generated outputs
	'/app/website': 'location-einstein',
	'/app/about': 'location-einstein',
	'/app/rwa': 'location-einstein',

	// Legacy /coffee/* routes removed — all routes now under /app/*
};

// Public routes (no auth required)
export const PUBLIC_ROUTES = ['/', '/login', '/pending', '/methodology', '/sign-in', '/pricing', '/about', '/contact', '/demo', '/privacy', '/terms'];

// Legacy support — still used by hooks.server.ts for backward compat
export const ALL_MODULES = ['location-einstein', 'space-einstein', 'business-einstein', 'loan-einstein', 'launch-einstein', 'operations-einstein'];

/**
 * Get the required Einstein module for a route path.
 * Returns null for public routes or routes that don't require a specific module.
 */
export function getModuleForRoute(path: string): string | null {
	// Exact match first
	if (ROUTE_MODULE_MAP[path]) return ROUTE_MODULE_MAP[path];

	// Check if any route prefix matches (for nested routes like /coffee/financials/sba)
	for (const [route, mod] of Object.entries(ROUTE_MODULE_MAP)) {
		if (path.startsWith(route + '/')) return mod;
	}

	// Admin routes
	if (path.startsWith('/admin')) return null; // admin access checked separately

	return null;
}

// ──────────────────────────────────────────────
// Recommendation section → module mapping
// Used by the Recommendations page to show/hide sections based on access
// ──────────────────────────────────────────────
export const RECOMMENDATION_SECTIONS: Record<string, EinsteinModule> = {
	'section1': 'location-einstein',   // Is this location right?
	'section2': 'business-einstein',   // Can I make money here?
	'section3': 'location-einstein',   // Competitive landscape
	'section4': 'business-einstein',   // What will it cost?
	'section5': 'location-einstein',   // Hidden risks
	'section6': 'business-einstein',   // Improve my odds
	'section7': 'loan-einstein'        // Can I get funded?
};

// Recommendation tab definitions
export const RECOMMENDATION_TABS = [
	{ id: 'all', label: 'All', icon: '🔍', module: null },
	{ id: 'location', label: 'Location', icon: '📍', module: 'location-einstein' as EinsteinModule },
	{ id: 'business', label: 'Business', icon: '📊', module: 'business-einstein' as EinsteinModule },
	{ id: 'loan', label: 'Loan', icon: '🏦', module: 'loan-einstein' as EinsteinModule }
];
