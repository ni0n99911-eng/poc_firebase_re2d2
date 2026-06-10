/**
 * GET /api/deals
 * Returns the user's full pipeline grouped by status with counts.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db-server';
import { dealPipeline } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';

const STATUS_ORDER = ['watching', 'touring', 'negotiating', 'signed', 'passed', 'lost'];

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user?.id) throw error(401, 'Authentication required');

	try {
		const data = await db.select().from(dealPipeline).where(eq(dealPipeline.userId, user.id)).orderBy(desc(dealPipeline.createdAt));
		const pipeline = data || [];

		// Build counts
		const counts: Record<string, number> = {};
		for (const s of STATUS_ORDER) counts[s] = 0;
		for (const row of pipeline) {
			const status = (row.data as any)?.status || row.stage || 'watching';
			if (counts[status] !== undefined) counts[status]++;
		}

		return json({ pipeline, counts });
	} catch (dbErr) {
		console.error('[deals GET] db error:', dbErr);
		return json({ pipeline: [], counts: {} }, { status: 500 });
	}

// Handled inside try block

	return json({ pipeline, counts });
};
