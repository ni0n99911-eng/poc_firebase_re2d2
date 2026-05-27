/**
 * Feedback Persistence API
 *
 * Records user feedback (helpful/not_helpful) on AI-generated content:
 * - Heads Up cards
 * - Playbook steps
 * - Bottom Line verdict
 * - Business Model narrative
 *
 * Writes to recommendation_feedback table in Supabase.
 * Fire-and-forget from the client — never blocks the UI.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/supabase-server';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const {
			component,
			itemId,
			feedback,
			sessionId,
			userId,
			context
		} = body;

		// Validate required fields
		if (!component || !feedback) {
			return json({ error: 'Missing required fields: component, feedback' }, { status: 400 });
		}

		if (!['helpful', 'not_helpful'].includes(feedback)) {
			return json({ error: 'feedback must be "helpful" or "not_helpful"' }, { status: 400 });
		}

		const validComponents = ['heads_up', 'playbook', 'verdict', 'business_model'];
		if (!validComponents.includes(component)) {
			return json({ error: `component must be one of: ${validComponents.join(', ')}` }, { status: 400 });
		}

		const supabase = getServiceSupabase();

		const { error } = await supabase
			.from('recommendation_feedback')
			.insert({
				user_id: userId || 'anonymous',
				recommendation_type: component,
				recommendation_id: null,
				recommended_item: {
					component,
					item_id: itemId || null,
					snapshot_at: new Date().toISOString()
				},
				action: feedback === 'helpful' ? 'upvoted' : 'downvoted',
				context: {
					session_id: sessionId || null,
					source: 'feedback_button',
					...(context || {})
				},
				// Also populate the new columns from migration 006
				session_id: sessionId || null,
				component,
				item_id: itemId || null,
				feedback
			});

		if (error) {
			console.error('[Feedback API] Supabase insert error:', error);
			// Still return 200 — feedback failure should never surface to user
			return json({ ok: false, error: error.message });
		}

		return json({ ok: true });
	} catch (err) {
		console.error('[Feedback API] Error:', err);
		return json({ ok: false, error: 'Internal error' }, { status: 500 });
	}
};

/**
 * GET: Retrieve aggregate feedback stats for a component
 * Used for internal analytics, not exposed to users.
 */
export const GET: RequestHandler = async ({ url }) => {
	try {
		const component = url.searchParams.get('component');

		const supabase = getServiceSupabase();

		let query = supabase
			.from('recommendation_feedback')
			.select('component, feedback, action', { count: 'exact' });

		if (component) {
			query = query.eq('component', component);
		}

		const { data, error, count } = await query;

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		// Aggregate by component
		const stats: Record<string, { helpful: number; not_helpful: number; total: number }> = {};

		for (const row of data || []) {
			const comp = row.component || row.recommendation_type || 'unknown';
			if (!stats[comp]) {
				stats[comp] = { helpful: 0, not_helpful: 0, total: 0 };
			}
			stats[comp].total++;
			if (row.feedback === 'helpful' || row.action === 'upvoted') {
				stats[comp].helpful++;
			} else {
				stats[comp].not_helpful++;
			}
		}

		return json({ stats, totalRecords: count });
	} catch (err) {
		console.error('[Feedback API] GET error:', err);
		return json({ error: 'Internal error' }, { status: 500 });
	}
};
