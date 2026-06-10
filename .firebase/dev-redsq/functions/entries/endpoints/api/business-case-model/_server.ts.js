import { error, json } from "@sveltejs/kit";
import { c as computeFullModel, m as mapToFinancialModel } from "../../../../chunks/business-case-store.svelte.js";
const POST = async ({ request }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON body");
  }
  const dailyCustomers = Number(body.dailyCustomers ?? 180);
  const avgTicket = Number(body.avgTicket ?? 8.75);
  const cogsPercent = Number(body.cogsPercent ?? 30);
  const fullTimeStaff = Number(body.fullTimeStaff ?? 2);
  const fullTimeRate = Number(body.fullTimeRate ?? 22);
  const partTimeStaff = Number(body.partTimeStaff ?? 3);
  const partTimeRate = Number(body.partTimeRate ?? 18);
  const monthlyRent = Number(body.monthlyRent ?? 5e3);
  const monthlyOpEx = Number(body.monthlyOpEx ?? 5e3);
  const daysPerWeek = Number(body.daysPerWeek ?? 6);
  const loanAmount = Number(body.loanAmount ?? 0);
  const loanTermYears = Number(body.loanTermYears ?? 10);
  const loanRate = Number(body.loanRate ?? 0);
  const conceptKey = String(body.conceptKey ?? "specialty_coffee");
  if (dailyCustomers < 0 || dailyCustomers > 1e4)
    throw error(400, `dailyCustomers out of range (0–10000): ${dailyCustomers}`);
  if (avgTicket < 0 || avgTicket > 1e4)
    throw error(400, `avgTicket out of range (0–10000): ${avgTicket}`);
  if (cogsPercent < 0 || cogsPercent > 100)
    throw error(400, `cogsPercent out of range (0–100): ${cogsPercent}`);
  if (daysPerWeek < 1 || daysPerWeek > 7)
    throw error(400, `daysPerWeek out of range (1–7): ${daysPerWeek}`);
  const inp = {
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
    transitScore: Number(body.transitScore ?? 0),
    vibrancyScore: Number(body.vibrancyScore ?? 0),
    personalInvestment: Number(body.personalInvestment ?? 5e4),
    startupCapital: Number(body.startupCapital ?? 2e5),
    creditScore: String(body.creditScore ?? "good"),
    squareFootage: Number(body.squareFootage ?? 1e3),
    hasPersonalGuarantee: body.hasPersonalGuarantee !== false
    // default true
  };
  const summary = computeFullModel(inp);
  const model = mapToFinancialModel(summary);
  return json(model);
};
export {
  POST
};
