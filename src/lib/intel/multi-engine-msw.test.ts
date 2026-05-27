import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { server } from '../../../tests/mocks/server';
import { fetchLocationIntel } from './index';
import { computeSixIndex } from './six-index';

// ── Boot Mock Service Worker (MSW) ──
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Mock SvelteKit Environment & Supabase ──
// We force a cache miss so fetchLocationIntel is forced to hit the external
// NYC Open Data APIs, which proves MSW successfully intercepts them.

vi.mock('$env/dynamic/private', () => ({
	env: { 
		SUPABASE_SERVICE_ROLE_KEY: 'test-key', 
		PUBLIC_SUPABASE_URL: 'http://localhost:54321',
		WALKSCORE_API_KEY: 'test-key',
		GOOGLE_PLACES_API_KEY: 'test-key',
		FOURSQUARE_API_KEY: 'test-key',
		YELP_API_KEY: 'test-key'
	}
}));

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_SUPABASE_URL: 'http://localhost:54321' }
}));

vi.mock('../supabase-server', () => ({
	getServiceSupabase: () => ({
		from: () => ({
			select: () => ({
				eq: () => ({
					maybeSingle: async () => ({ error: { message: 'Forced cache miss for MSW testing' } })
				})
			}),
			upsert: async () => ({ error: null }),
			insert: async () => ({ error: null })
		}),
		rpc: async () => ({ error: null, data: null })
	})
}));

describe('Multi-Engine Architecture (Brain 3) Integration Test', () => {
	it('intercepts external APIs via MSW and pipelines data into the new Strategy Engines', async () => {
		console.log('Fetching intelligence with MSW interceptors active...');
		const lat = 40.7484;
		const lng = -74.0037;
		
		// 1. Fetch raw intelligence. MSW will intercept the outgoing fetch() calls.
		const report = await fetchLocationIntel(lat, lng, 'qsr', '450 9th Ave, New York, NY 10001');

		// 2. Validate MSW mocked the WalkScore (defined in handlers.ts as 98)
		expect(report.walkScore).toBeDefined();
		expect(report.walkScore?.walkScore).toBe(98);
		console.log('✅ MSW successfully intercepted and mocked external API responses');

		// 3. Route the mocked data through the new Multi-Engine Architecture
		console.log('Sending mock payload to the QSR Engine...');
		const qsrResult = computeSixIndex(report, 'qsr');
		
		expect(qsrResult).toBeDefined();
		expect(qsrResult.conceptType).toBe('qsr');
		expect(qsrResult.locationIQ).toBeGreaterThan(0);
		expect(Object.keys(qsrResult.indices).length).toBe(8); // Generic model uses 8 indices
		console.log(`✅ QSR Engine successfully computed Location IQ: ${qsrResult.locationIQ}`);

		console.log('Sending same mock payload to the Coffee Engine...');
		const coffeeResult = computeSixIndex(report, 'coffee');
		
		expect(coffeeResult).toBeDefined();
		expect(coffeeResult.conceptType).toBe('specialty_coffee');
		expect(Object.keys(coffeeResult.indices).length).toBe(8); // General indices fallback
		expect(coffeeResult.coffeeDimensions).toBeDefined();
		expect(Object.keys(coffeeResult.coffeeDimensions!).length).toBe(8); // 6 dimensions + multiplier + composite
		expect(coffeeResult.locationIQ).not.toBe(qsrResult.locationIQ); // The math diverges!
		console.log(`✅ Coffee Engine successfully computed custom Location IQ: ${coffeeResult.locationIQ}`);
	}, 30000);
});
