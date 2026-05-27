/**
 * inputs-hash.ts — BR-5 § 5.2 (SERVER-SIDE ONLY)
 *
 * Computes a stable SHA-256 hash of the scoring inputs using Node's crypto module.
 * Use ONLY in API routes and server-side code.
 *
 * For Svelte components / browser code, use:
 *   import { computeInputsHashBrowser } from '$lib/utils/inputs-hash-browser';
 */

import { createHash } from 'crypto';

export interface ScoringInputs {
  // Address
  address: string;
  lat: number;
  lng: number;

  // Concept
  concept: string;

  // User-adjustable levers that affect score
  dailyTransactions: number | null;
  avgTicket: number | null;
  monthlyRentBudget: number | null;
  fundingCapital: number | null;
  buildoutBudget: number | null;
  creditScoreBand: string | null;

  // Vision IQ state
  visionIQCompletionPct: number;

  // Scorer version (ties hash to algo version)
  scorerVersion: string;
}

function canonicalize(inputs: ScoringInputs): string {
  const canonical = {
    address: inputs.address.trim().toLowerCase(),
    avg_ticket: inputs.avgTicket ?? null,
    buildout_budget: inputs.buildoutBudget ?? null,
    concept: inputs.concept.toLowerCase(),
    credit_score_band: inputs.creditScoreBand ?? null,
    daily_transactions: inputs.dailyTransactions ?? null,
    funding_capital: inputs.fundingCapital ?? null,
    lat: Math.round(inputs.lat * 100000) / 100000,
    lng: Math.round(inputs.lng * 100000) / 100000,
    monthly_rent_budget: inputs.monthlyRentBudget ?? null,
    scorer_version: inputs.scorerVersion,
    vision_iq_completion_pct: Math.round(inputs.visionIQCompletionPct ?? 0),
  };
  return JSON.stringify(canonical, Object.keys(canonical).sort());
}

/**
 * Returns a stable hex SHA-256 of the canonicalized scoring inputs.
 * Same inputs + same scorer version = same hash.
 * Synchronous. SERVER-SIDE ONLY — do not import in Svelte components.
 */
export function computeInputsHash(inputs: ScoringInputs): string {
  return createHash('sha256').update(canonicalize(inputs)).digest('hex');
}
