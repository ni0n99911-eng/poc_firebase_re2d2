/**
 * inputs-hash-browser.ts — BR-5 § 5.2 (browser-safe)
 *
 * Browser-safe SHA-256 using the Web Crypto API.
 * Import this in Svelte components and client-side code.
 *
 * For server-side (API routes), use computeInputsHash from inputs-hash.ts instead.
 */

export interface ScoringInputsBrowser {
  address: string;
  lat: number;
  lng: number;
  concept: string;
  dailyTransactions: number | null;
  avgTicket: number | null;
  monthlyRentBudget: number | null;
  fundingCapital: number | null;
  buildoutBudget: number | null;
  creditScoreBand: string | null;
  visionIQCompletionPct: number;
  scorerVersion: string;
}

function canonicalize(inputs: ScoringInputsBrowser): string {
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
 * Browser-safe SHA-256 of canonicalized scoring inputs.
 * Async — uses Web Crypto API. Falls back to 'hash-unavailable' in very old browsers.
 */
export async function computeInputsHashBrowser(inputs: ScoringInputsBrowser): Promise<string> {
  try {
    const msgBuffer = new TextEncoder().encode(canonicalize(inputs));
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'hash-unavailable';
  }
}
