/**
 * POST /api/re-score — BR-5 § 5.3
 *
 * User-initiated Re-score action. Runs the full scorer against current inputs,
 * writes a new snapshot to the shortlisted_locations JSONB array in founder_sessions,
 * detects drift > 3 points, logs a score_drift_event if applicable.
 *
 * Auth: Clerk JWT via locals.user (same as session-sync).
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
// 04.22.2026 Deprecating: Direct imports of fetchEnhancedLocationIntel, computeLocationIQ,
// computeDynamicVisionIQ, runIQScore, lookupHistoricalContext, buildDynamicConfig,
// resolveConceptType, and latLngToGeoid are no longer needed here — all orchestrated
// internally by buildLocationScoreBundle(). See $lib/intel/scoring/bundle-builder.ts.
import { buildLocationScoreBundle } from '$lib/intel/scoring/bundle-builder';
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';
// 04.19.2026 13:00 Changed from normalizeConceptKey to normalizeBusinessType (canonical registry)
import { normalizeBusinessType } from '$lib/intel/registry/business-type-registry';
import { computeInputsHash } from '$lib/utils/inputs-hash';

// B3-1.5: Bump for grade-cap rule on critical safety (≤35) or 1Y survival (≤40).
// Existing cached scores must be invalidated because their letter grades/verdicts
// may disagree with the new capped outputs.
const SCORER_VERSION = 'v4.4';

// Plain-language templates per sub-score for drift explanation
const DRIFT_COPY: Record<string, string> = {
  transit:             'transit data refreshed',
  demographics:        'new census release',
  competition:         'competition density updated',
  vibrancy:            'new neighborhood signals',
  safety:              'safety data updated',
  momentum:            'momentum indicators updated',
  neighborhoodHealth:  'updated neighborhood health indicators',
  survivalRate:        'survival rate data refreshed',
};

function friendlyName(key: string): string {
  const map: Record<string, string> = {
    transit:            'transit access',
    demographics:       'demographics',
    competition:        'competition density',
    vibrancy:           'foot traffic & vibrancy',
    safety:             'safety',
    momentum:           'neighborhood momentum',
    neighborhoodHealth: 'neighborhood health',
    survivalRate:       'business survival rate',
  };
  return map[key] ?? key;
}

// Rate limit: max 5 re-scores per address per user per hour (in-memory, per instance)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
function isRateLimited(userId: string, address: string): boolean {
  const key = `${userId}:${address}`;
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const entry = rateLimitMap.get(key);
  
  if (!entry || now - entry.windowStart > window) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    // Global bound check: prevent memory leak from infinite unique addresses
    if (rateLimitMap.size > 1000) {
      for (const [k, v] of rateLimitMap) {
        if (now - v.windowStart > window) rateLimitMap.delete(k);
      }
      if (rateLimitMap.size > 2000) rateLimitMap.clear(); // Hard eviction
    }
    return false;
  }
  
  if (entry.count >= 5) return true;
  entry.count++;
  return false;
}

export const POST: RequestHandler = async ({ request, locals }: { request: Request; locals: App.Locals }) => {
  const user = locals.user;
  if (!user?.id) throw error(401, 'Authentication required');

  let body: {
    address?: string;
    lat?: number;
    lng?: number;
    concept?: string;
    dailyTransactions?: number | null;
    avgTicket?: number | null;
    monthlyRentBudget?: number | null;
    fundingCapital?: number | null;
    buildoutBudget?: number | null;
    creditScoreBand?: string | null;
    visionIQCompletionPct?: number;
    conceptAnswers?: Record<string, string>;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { address, lat, lng, concept, conceptAnswers = {} } = body;

  if (!address || lat == null || lng == null || !concept) {
    return json({
      error: 'Missing required fields',
      missing: ['address', 'lat', 'lng', 'concept'].filter(f => !(body as Record<string, unknown>)[f]),
    }, { status: 400 });
  }

  if (isRateLimited(user.id, address)) {
    return json({ error: 'Too many re-score requests for this address. Try again later.' }, { status: 429 });
  }

  try {
    // 1. Load existing record to get previous score for drift comparison
    let fsRow: any;
    try {
      const fsRes = await db.execute(sql`SELECT shortlisted_locations FROM founder_sessions WHERE user_id = ${user.id} LIMIT 1`);
      fsRow = fsRes.rows[0];
    } catch (fsReadErr: any) {
      console.warn('[re-score] founder_sessions read error:', fsReadErr.message);
    }

    const locations: Record<string, unknown>[] = fsRow?.shortlisted_locations || [];
    const prevEntry = locations.find((l: Record<string, unknown>) =>
      (l.addr as string)?.toLowerCase() === address.toLowerCase()
    );
    const prevScore = typeof prevEntry?.score === 'number' ? prevEntry.score : null;
    const prevSixScores = (prevEntry?.sixScores as Record<string, number>) || null;

    // 2. Run full scorer via canonical bundle builder
    // 04.22.2026 Deprecating: The inline scoring pipeline (fetchEnhancedLocationIntel,
    // geohash computation, lookupHistoricalContext, latLngToGeoid, block_group_scores
    // fetch, runIQScore, and the standalone Fit IQ formula) has been replaced by a
    // single call to buildLocationScoreBundle(). See $lib/intel/scoring/bundle-builder.ts.
    const bundle = await buildLocationScoreBundle({
      lat,
      lng,
      businessType: normalizeBusinessType(concept),
      address,
      conceptAnswers,
    });

    const geoid = bundle.geoid;
    const newLocationIQ = bundle.locationIQ;
    const newSixScores = bundle.sixScores;
    const newVisionIQ = bundle.visionIQ ?? (prevEntry?.visionScore as number ?? 0);
    // 04.22.2026 Deprecating: newFitIQ was previously calculated inline as:
    //   Math.round(newLocationIQ * 0.60 + newVisionIQ * 0.40)
    // Now sourced from bundle.fitScore (canonical computeCanonicalFitIQ).
    const newFitIQ = bundle.fitScore ?? (prevEntry?.fitScore as number ?? 0);

    // 3. Compute inputs_hash
    const inputsHash = computeInputsHash({
      address,
      lat,
      lng,
      concept: normalizeBusinessType(concept),
      dailyTransactions: body.dailyTransactions ?? null,
      avgTicket: body.avgTicket ?? null,
      monthlyRentBudget: body.monthlyRentBudget ?? null,
      fundingCapital: body.fundingCapital ?? null,
      buildoutBudget: body.buildoutBudget ?? null,
      creditScoreBand: body.creditScoreBand ?? null,
      visionIQCompletionPct: body.visionIQCompletionPct ?? 0,
      scorerVersion: SCORER_VERSION,
    });

    const scoredAt = Date.now();

    // 4. Update the location entry in the JSONB array
    const updatedEntry = {
      ...(prevEntry || {}),
      addr: address,
      score: newLocationIQ,
      fitScore: newFitIQ,
      visionScore: newVisionIQ,
      sixScores: newSixScores,
      conceptType: normalizeBusinessType(concept),
      scoredAt,
      scorer_version: SCORER_VERSION,
      inputs_hash: inputsHash,
      geoid: geoid || prevEntry?.geoid || null,
    };

    const updatedLocations = prevEntry
      ? locations.map(l => (l.addr as string)?.toLowerCase() === address.toLowerCase() ? updatedEntry : l)
      : [...locations, updatedEntry];

    try {
      await db.execute(sql`
        UPDATE founder_sessions 
        SET shortlisted_locations = ${JSON.stringify(updatedLocations)}, updated_at = ${new Date().toISOString()}
        WHERE user_id = ${user.id}
      `);
    } catch (writeErr: any) {
      console.error('[re-score] DB write error:', writeErr);
      return json({ error: 'Failed to save score' }, { status: 500 });
    }

    // 5. Drift detection
    let drift: {
      delta: number;
      direction: 'up' | 'down';
      topMovers: Array<{ name: string; friendlyName: string; delta: number; plainLanguage: string }>;
    } | undefined;

    if (prevScore !== null) {
      const delta = newLocationIQ - prevScore;
      if (Math.abs(delta) > 3) {
        // Find sub-scores that moved >= 3 points
        const movers = Object.entries(newSixScores)
          .map(([name, newVal]) => ({
            name,
            friendlyName: friendlyName(name),
            delta: newVal - (prevSixScores?.[name] ?? newVal),
            plainLanguage: DRIFT_COPY[name] ?? 'data updated',
          }))
          .filter(s => Math.abs(s.delta) >= 3)
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
          .slice(0, 2);

        drift = {
          delta,
          direction: delta > 0 ? 'up' : 'down',
          topMovers: movers,
        };

        // Write score_drift_event (fire-and-forget)
        db.execute(sql`
          INSERT INTO score_drift_events (
            user_id, address, geoid, old_score, new_score, sub_scores_moved, 
            old_scorer_version, new_scorer_version, old_inputs_hash, new_inputs_hash
          ) VALUES (
            ${user.id}, ${address}, ${geoid || null}, ${prevScore}, ${newLocationIQ}, ${JSON.stringify(movers)},
            ${(prevEntry?.scorer_version as string) || 'v4.legacy'}, ${SCORER_VERSION}, ${(prevEntry?.inputs_hash as string) || 'legacy'}, ${inputsHash}
          )
        `).catch(err => console.error('[re-score] score_drift_events insert error', err));
      }
    }

    return json({
      locationIQ: newLocationIQ,
      fitIQ: newFitIQ,
      visionIQ: newVisionIQ,
      sixScores: newSixScores,
      scoredAt: new Date(scoredAt).toISOString(),
      scorerVersion: SCORER_VERSION,
      inputsHash,
      ...(drift ? { drift } : {}),
    });

  } catch (e: unknown) {
    console.error('[re-score] Error:', e);
    return json({
      error: 'Scoring failed',
      detail: e instanceof Error ? e.message : 'Unknown error',
    }, { status: 500 });
  }
};
