/**
 * POST /api/business-case-model
 *
 * Runs the full 60-month financial model and returns a FinancialModel JSON object.
 * Called by the Business Case page's "Run Full Model" button.
 *
 * Body (all fields from BusinessCaseSidebar + session context):
 * {
 *   dailyCustomers: number,
 *   avgTicket: number,
 *   cogsPercent: number,       // 0–100
 *   fullTimeStaff: number,
 *   fullTimeRate: number,      // $/hr
 *   partTimeStaff: number,
 *   partTimeRate: number,      // $/hr
 *   monthlyRent: number,
 *   monthlyOpEx: number,
 *   daysPerWeek: number,
 *   loanRate: number,          // 0 = auto from creditScore
 *   loanTermYears: number,
 *   loanAmount: number,
 *   conceptKey: string,
 *   // Optional session context (defaults if absent)
 *   transitScore?: number,
 *   vibrancyScore?: number,
 *   personalInvestment?: number,
 *   startupCapital?: number,
 *   creditScore?: string,
 *   squareFootage?: number,
 *   hasPersonalGuarantee?: boolean,
 * }
 *
 * Returns: FinancialModel (UX-facing, all field names as consumed by tab components)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import {
  computeFullModel,
  mapToFinancialModel,
  type ModelInputs,
} from '$lib/stores/business-case-store.svelte';

export const POST: RequestHandler = async ({ request }) => {
  let body: Partial<ModelInputs & {
    transitScore?: number;
    vibrancyScore?: number;
    personalInvestment?: number;
    startupCapital?: number;
    creditScore?: string;
    squareFootage?: number;
    hasPersonalGuarantee?: boolean;
  }>;

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  // ── Input validation ───────────────────────────────────────────────────────

  const dailyCustomers = Number(body.dailyCustomers ?? 180);
  const avgTicket      = Number(body.avgTicket      ?? 8.75);
  const cogsPercent    = Number(body.cogsPercent    ?? 30);
  const fullTimeStaff  = Number(body.fullTimeStaff  ?? 2);
  const fullTimeRate   = Number(body.fullTimeRate   ?? 22);
  const partTimeStaff  = Number(body.partTimeStaff  ?? 3);
  const partTimeRate   = Number(body.partTimeRate   ?? 18);
  const monthlyRent    = Number(body.monthlyRent    ?? 5_000);
  const monthlyOpEx    = Number(body.monthlyOpEx    ?? 5_000);
  const daysPerWeek    = Number(body.daysPerWeek    ?? 6);
  const loanAmount     = Number(body.loanAmount     ?? 0);
  const loanTermYears  = Number(body.loanTermYears  ?? 10);
  const loanRate       = Number(body.loanRate       ?? 0);
  const conceptKey     = String(body.conceptKey     ?? 'specialty_coffee');

  // Sanity guards: prevent garbage inputs from producing nonsensical output
  if (dailyCustomers < 0 || dailyCustomers > 10_000)
    throw error(400, `dailyCustomers out of range (0–10000): ${dailyCustomers}`);
  if (avgTicket < 0 || avgTicket > 10_000)
    throw error(400, `avgTicket out of range (0–10000): ${avgTicket}`);
  if (cogsPercent < 0 || cogsPercent > 100)
    throw error(400, `cogsPercent out of range (0–100): ${cogsPercent}`);
  if (daysPerWeek < 1 || daysPerWeek > 7)
    throw error(400, `daysPerWeek out of range (1–7): ${daysPerWeek}`);

  // ── Build ModelInputs ──────────────────────────────────────────────────────

  const inp: ModelInputs = {
    dailyCustomers,
    avgTicket,
    cogsPercent,
    fullTimeStaff,
    fullTimeRate,
    partTimeStaff,
    partTimeRate,
    monthlyRent,
    monthlyOpEx,
    daysPerWeek,
    loanAmount,
    loanTermYears,
    loanRate,
    conceptKey,
    transitScore:        Number(body.transitScore        ?? 0),
    vibrancyScore:       Number(body.vibrancyScore       ?? 0),
    personalInvestment:  Number(body.personalInvestment  ?? 50_000),
    startupCapital:      Number(body.startupCapital      ?? 200_000),
    creditScore:         String(body.creditScore         ?? 'good'),
    squareFootage:       Number(body.squareFootage       ?? 1_000),
    hasPersonalGuarantee: body.hasPersonalGuarantee !== false,  // default true
  };

  // ── Run engine → map → return ──────────────────────────────────────────────

  const summary = computeFullModel(inp);
  const model   = mapToFinancialModel(summary);

  return json(model);
};
