import { r as requireAuth } from "../../../../../chunks/auth-middleware.js";
import { c as callLLM } from "../../../../../chunks/openrouter-llm.js";
import { d as db, a as blockGroupScores, c as copilotConversations } from "../../../../../chunks/db-server.js";
import { eq } from "drizzle-orm";
import { g as getBenchmark } from "../../../../../chunks/industry-benchmarks.js";
import { n as normalizeBusinessType } from "../../../../../chunks/business-type-registry.js";
import { a as computeWhatIf, c as computeFinancialProjection } from "../../../../../chunks/financial-projections.js";
import { g as getDoc09Intelligence } from "../../../../../chunks/conceptKPIs.js";
function buildConceptKnowledge(bizType) {
  const intel = getDoc09Intelligence(normalizeBusinessType(bizType));
  if (!intel) return "";
  const lines = [
    `
CONCEPT INTELLIGENCE (${intel.label}):`,
    `- Realistic net margin: ${(intel.costStructure.netMarginRange[0] * 100).toFixed(0)}–${(intel.costStructure.netMarginRange[1] * 100).toFixed(0)}%`,
    `- Cost structure: COGS ${(intel.costStructure.cogsPct * 100).toFixed(0)}%, Labor ${(intel.costStructure.laborPct * 100).toFixed(0)}%, Rent ceiling ${(intel.costStructure.rentCeilingPct * 100).toFixed(0)}%`,
    `- Prime cost target (COGS + Labor): ${(intel.costStructure.primeCostTarget * 100).toFixed(0)}% of revenue`,
    `- Startup capital range: $${intel.startupCapitalRange[0].toLocaleString()}–$${intel.startupCapitalRange[1].toLocaleString()}`,
    `- Break-even timeline: ${intel.breakEvenMonths[0]}–${intel.breakEvenMonths[1]} months`,
    `- Failure rates: ${intel.failureRates.year1Pct}% close Year 1, ${intel.failureRates.year3Pct}% by Year 3, ${intel.failureRates.year5Pct}% by Year 5`,
    `- #1 cause of failure: ${intel.failureRates.topCause}`
  ];
  if (intel.failureRates.mythBust) {
    lines.push(`- MYTH TO DEBUNK: ${intel.failureRates.mythBust}`);
  }
  if (intel.unanticipatedCosts.length > 0) {
    lines.push(`
UNANTICIPATED COSTS TO WARN ABOUT:`);
    for (const c of intel.unanticipatedCosts.slice(0, 6)) {
      lines.push(`  - ${c.item}: ${c.amount} (${c.frequency})`);
    }
  }
  if (intel.competitiveStrategy.length > 0) {
    lines.push(`
STRATEGIC INSIGHTS:`);
    for (const s of intel.competitiveStrategy) {
      lines.push(`  - ${s}`);
    }
  }
  if (intel.regulatoryNotes.length > 0) {
    lines.push(`
REGULATORY REQUIREMENTS (NYC):`);
    for (const r of intel.regulatoryNotes) {
      lines.push(`  - ${r}`);
    }
  }
  if (intel.seasonalPattern) {
    lines.push(`
SEASONAL PATTERN: ${intel.seasonalPattern}`);
  }
  return lines.join("\n");
}
async function logCopilotConversation(userId, copilotType, geoid, action, requestData, responseSummary, modelUsed, latencyMs) {
  try {
    await db.insert(copilotConversations).values({
      id: crypto.randomUUID(),
      userId,
      context: action,
      messages: {
        copilot_type: copilotType,
        geoid,
        action,
        request_data: requestData,
        response_summary: responseSummary.slice(0, 200),
        model_used: modelUsed,
        latency_ms: latencyMs
      }
    });
  } catch (err) {
    console.warn("[Copilot] Failed to log conversation:", err instanceof Error ? err.message : err);
  }
}
const RATE_LIMIT_WINDOW_MS = 6e4;
const RATE_LIMIT_MAX = 10;
const _rateLimitMap = /* @__PURE__ */ new Map();
function checkRateLimit(userId) {
  const now = Date.now();
  const timestamps = (_rateLimitMap.get(userId) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    return new Response(JSON.stringify({
      error: "Rate limit exceeded. Max 10 requests per minute."
    }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } });
  }
  timestamps.push(now);
  _rateLimitMap.set(userId, timestamps);
  if (_rateLimitMap.size > 1e3) {
    for (const [uid, ts] of _rateLimitMap) {
      if (ts.every((t) => now - t > RATE_LIMIT_WINDOW_MS)) _rateLimitMap.delete(uid);
    }
  }
  return null;
}
function computeFinancials(financialData, launchpad) {
  const bench = getBenchmark(launchpad.businessType);
  const projection = computeFinancialProjection({
    businessType: launchpad.businessType,
    rent: financialData.rent || parseRent(launchpad.rent || "") || void 0,
    avgTransaction: financialData.avgTransaction || void 0,
    dailyCustomers: financialData.dailyCustomers || void 0,
    staffCount: financialData.staffCount || void 0,
    operatingHours: launchpad.hours || void 0
  });
  return {
    monthlyRevenue: projection.monthlyPL.revenue,
    monthlyCOGS: projection.monthlyPL.cogs,
    monthlyGrossProfit: projection.monthlyPL.grossProfit,
    monthlyExpenses: projection.monthlyPL.totalExpenses,
    monthlyNetIncome: projection.monthlyPL.netIncome,
    breakEvenDaily: projection.breakEven.dailyTransactionsNeeded,
    rent: projection.monthlyPL.rent,
    avgTxn: financialData.avgTransaction || bench.avgTransaction,
    dailyCust: financialData.dailyCustomers || bench.dailyCustomers,
    margin: bench.grossMargin,
    staffCost: projection.monthlyPL.labor,
    benchmark: bench,
    projection
    // Full projection available for detailed responses
  };
}
function parseRent(raw) {
  if (!raw) return 0;
  const matches = raw.match(/(\d[\d,]*)/g);
  if (!matches) return 0;
  const nums = matches.map((m) => parseInt(m.replace(/,/g, "")));
  if (nums.length >= 2) return Math.round((nums[0] + nums[1]) / 2);
  const n = nums[0];
  return n < 100 ? n * 1e3 : n;
}
const BUSINESS_SYSTEM_PROMPT = `You are the RE² Business Plan Co-Pilot — an AI assistant that helps first-time small business founders understand financial projections for their planned business in NYC.

VOICE & TONE:
- Speak like a supportive mentor, not an MBA textbook.
- Say "the cost of your ingredients/supplies" instead of "COGS."
- Say "what you keep after costs" instead of "gross margin."
- Say "monthly profit" instead of "net income" or "EBITDA."
- If a number looks scary, acknowledge it: "That rent is a big chunk — here's how to think about it."
- Frame break-even positively: "You need X customers/day to cover your costs — that's about Y per hour during peak."

RULES:
1. Explain financial concepts in plain English. Zero jargon — if a term wouldn't appear on a restaurant menu, rephrase it.
2. Always use actual numbers — show the math, don't just state conclusions.
3. Be honest about risks. If the numbers don't work, say so kindly but directly — then suggest ONE concrete lever they can pull (raise price, cut hours, find cheaper space).
4. Compare against industry benchmarks when available.
5. Keep responses under 250 words unless doing detailed what-if analysis.
6. When doing what-if scenarios, show both the original and modified numbers side by side.
7. End every response with ONE actionable next step the founder can take today.
8. Never give legal or tax advice — remind them to consult professionals for those.
9. When numbers are tight, don't catastrophize. Frame it as: "This is fixable — here's how."
10. Celebrate wins: if their rent-to-revenue ratio is healthy or their ticket is above benchmark, say so.`;
async function handleExplainNumbers(financialData, launchpad, page, locationScores) {
  const calcs = computeFinancials(financialData, launchpad);
  const bench = calcs.benchmark;
  const locationScore = locationScores["location_iq"]?.score ?? 0;
  const conceptKnowledge = buildConceptKnowledge(launchpad.businessType);
  const userMsg = `Explain these financial numbers for a ${launchpad.businessType} business on the "${page}" page:
${conceptKnowledge}

CALCULATED FINANCIALS:
- Monthly Revenue: $${calcs.monthlyRevenue.toLocaleString()} (${calcs.dailyCust} customers/day × $${calcs.avgTxn} avg transaction × 30 days)
- Monthly COGS: $${calcs.monthlyCOGS.toLocaleString()} (${calcs.margin * 100}% margin)
- Gross Profit: $${calcs.monthlyGrossProfit.toLocaleString()}
- Monthly Expenses: $${calcs.monthlyExpenses.toLocaleString()} (rent $${calcs.rent.toLocaleString()} + staff $${calcs.staffCost.toLocaleString()} + other)
- Net Income: $${calcs.monthlyNetIncome.toLocaleString()}/month
- Break-even: ${calcs.breakEvenDaily} transactions/day
- Location Score: ${locationScore}/100

INDUSTRY BENCHMARKS for ${launchpad.businessType}:
- Avg transaction: $${bench.avgTransaction}
- Daily customers: ${bench.dailyCustomers}
- Gross margin: ${bench.grossMargin * 100}%
- Typical startup cost: $${bench.startupCostRange[0].toLocaleString()}–$${bench.startupCostRange[1].toLocaleString()}
- Avg NYC rent: $${Math.round((bench.idealRentRange[0] + bench.idealRentRange[1]) / 2).toLocaleString()}/mo

USER PROFILE:
- Budget: ${launchpad.budget || "not specified"}
- Rent tolerance: ${launchpad.rent || "not specified"}
- Owner type: ${launchpad.ownerType || "not specified"}
- Hours: ${launchpad.hours || "not specified"}

Explain these numbers in plain English. Highlight what looks healthy and what's concerning. Compare to benchmarks.`;
  const result = await callLLM({
    model: "sonnet",
    system: BUSINESS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
    maxTokens: 700,
    temperature: 0.4
  });
  return {
    message: result.content,
    suggestedPrompts: [
      "What if my rent was 20% lower?",
      "How many customers do I really need per day?",
      `Is $${calcs.avgTxn} realistic for a ${launchpad.businessType}?`
    ]
  };
}
async function handleWhatIf(question, financialData, launchpad, locationScores) {
  const calcs = computeFinancials(financialData, launchpad);
  const bench = calcs.benchmark;
  const changes = {};
  const qLower = question.toLowerCase();
  const extractNum = (str) => {
    const match = str.match(/([\d,.]+)[\s]*(k|m)?/i);
    if (!match) return null;
    let val = parseFloat(match[1].replace(/,/g, ""));
    if (match[2]?.toLowerCase() === "k") val *= 1e3;
    if (match[2]?.toLowerCase() === "m") val *= 1e6;
    return val;
  };
  if (qLower.includes("rent")) {
    const moneyMatch = question.match(/\$?\s*([\d,.]+[kK]?)/);
    if (moneyMatch && !qLower.includes("%")) {
      const val = extractNum(moneyMatch[1]);
      if (val !== null) changes.rent = Math.round(val);
    } else if (qLower.includes("%")) {
      const pctMatch = question.match(/(\d+(?:\.\d+)?)%/);
      if (pctMatch) {
        const pct = parseFloat(pctMatch[1]) / 100;
        if (qLower.match(/(lower|less|decrease|drop|reduce)/)) changes.rent = Math.round(calcs.rent * (1 - pct));
        else if (qLower.match(/(higher|more|increase|raise|up)/)) changes.rent = Math.round(calcs.rent * (1 + pct));
      }
    }
  }
  if (qLower.match(/(price|ticket|transaction|charge|cost)/)) {
    let moneyMatch = question.match(/\$\s*([\d,.]+)/);
    if (!moneyMatch) {
      const fallbackMatch = question.match(/(?:to|by|is|at|for)\s*([\d,.]+)/);
      if (fallbackMatch && fallbackMatch[1] && !question.substring(fallbackMatch.index + fallbackMatch[0].length).trim().startsWith("%")) {
        moneyMatch = fallbackMatch;
      } else {
        const bareNum = question.match(/(?:^|\s)([\d,.]+)(?:\s|$)/);
        if (bareNum && !question.includes("%")) {
          moneyMatch = [bareNum[0], bareNum[1]];
        }
      }
    }
    if (moneyMatch) {
      const val = extractNum(moneyMatch[1]);
      if (val !== null) changes.avgTransaction = Math.round(val * 100) / 100;
    } else if (qLower.includes("%")) {
      const pctMatch = question.match(/(\d+(?:\.\d+)?)%/);
      if (pctMatch) {
        const pct = parseFloat(pctMatch[1]) / 100;
        if (qLower.match(/(higher|increase|raise|up)/)) changes.avgTransaction = Math.round(calcs.avgTxn * (1 + pct) * 100) / 100;
        else changes.avgTransaction = Math.round(calcs.avgTxn * (1 - pct) * 100) / 100;
      }
    }
  }
  if (qLower.match(/(customer|people|traffic|guest|client)/)) {
    if (qLower.includes("%")) {
      const pctMatch = question.match(/(\d+(?:\.\d+)?)%/);
      if (pctMatch) {
        const pct = parseFloat(pctMatch[1]) / 100;
        if (qLower.match(/(more|higher|increase|grow|up)/)) changes.dailyCustomers = Math.round(calcs.dailyCust * (1 + pct));
        else changes.dailyCustomers = Math.round(calcs.dailyCust * (1 - pct));
      }
    } else {
      const numMatch = question.match(/(\d+)\s*(more|fewer|less|extra)?.*(customer|people|traffic|guest)/i);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        if (numMatch[2] && numMatch[2].match(/(more|extra)/i)) changes.dailyCustomers = calcs.dailyCust + num;
        else if (numMatch[2] && numMatch[2].match(/(fewer|less)/i)) changes.dailyCustomers = Math.max(0, calcs.dailyCust - num);
        else changes.dailyCustomers = num;
      }
    }
  }
  if (qLower.match(/(staff|employee|hire|worker|team)/)) {
    let count = 0;
    if (qLower.match(/\b(one|a)\b/)) count = 1;
    else if (qLower.includes("two")) count = 2;
    else if (qLower.includes("three")) count = 3;
    else if (qLower.includes("four")) count = 4;
    else if (qLower.includes("five")) count = 5;
    else {
      const m = question.match(/(?:\s|^)(\d+)(?:\s|$)/);
      if (m) count = parseInt(m[1], 10);
    }
    if (count > 0) {
      const currentStaff = financialData.staffCount || bench.staffPerShift;
      if (qLower.match(/(more|add|extra|another)/)) changes.staffCount = currentStaff + count;
      else if (qLower.match(/(fewer|less|remove|fire|drop)/)) changes.staffCount = Math.max(1, currentStaff - count);
      else changes.staffCount = count;
    }
  }
  const baseInputs = {
    businessType: launchpad.businessType,
    rent: financialData.rent || parseRent(launchpad.rent || "") || void 0,
    avgTransaction: financialData.avgTransaction || void 0,
    dailyCustomers: financialData.dailyCustomers || void 0,
    staffCount: financialData.staffCount || void 0,
    operatingHours: launchpad.hours || void 0
  };
  const whatIfResult = computeWhatIf(calcs.projection, changes, baseInputs);
  const { after, impact } = whatIfResult;
  const conceptKnowledge = buildConceptKnowledge(launchpad.businessType);
  const userMsg = `The user asks a what-if scenario: "${question}"
${conceptKnowledge}

CURRENT FINANCIALS (BEFORE):
- Monthly Revenue: $${calcs.monthlyRevenue.toLocaleString()}
- Monthly Expenses: $${calcs.monthlyExpenses.toLocaleString()} (rent $${calcs.rent.toLocaleString()}, staff $${calcs.staffCost.toLocaleString()})
- Net Income: $${calcs.monthlyNetIncome.toLocaleString()}/month
- Break-even: ${calcs.breakEvenDaily} transactions/day
- Avg transaction: $${calcs.avgTxn}, Daily customers: ${calcs.dailyCust}

SCENARIO RESULTS (AFTER DETERMINISTIC CALCULATION):
Do not change these numbers; explain them.
- Monthly Revenue: $${after.monthlyPL.revenue.toLocaleString()} (Change: $${impact.revenueChange.toLocaleString()})
- Monthly Expenses: $${after.monthlyPL.totalExpenses.toLocaleString()} (rent $${after.monthlyPL.rent.toLocaleString()}, staff $${after.monthlyPL.labor.toLocaleString()})
- Net Income: $${after.monthlyPL.netIncome.toLocaleString()}/month (Change: $${impact.netIncomeChange.toLocaleString()})
- Break-even: ${after.breakEven.dailyTransactionsNeeded} transactions/day (Change: ${impact.breakEvenChange})

Explain the impact of this scenario in plain English based on the DETERMINISTIC CALCULATIONS provided above. Show the math and why it matters.`;
  const result = await callLLM({
    model: "sonnet",
    system: BUSINESS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
    maxTokens: 800,
    temperature: 0.4
  });
  let chartUpdate = void 0;
  if (Object.keys(changes).length > 0) {
    chartUpdate = {
      type: "scenario_comparison",
      data: {
        original: {
          revenue: calcs.monthlyRevenue,
          rent: calcs.rent,
          expenses: calcs.monthlyExpenses,
          netIncome: calcs.monthlyNetIncome,
          breakEven: calcs.breakEvenDaily
        },
        scenario: {
          revenue: after.monthlyPL.revenue,
          rent: after.monthlyPL.rent,
          expenses: after.monthlyPL.totalExpenses,
          netIncome: after.monthlyPL.netIncome,
          breakEven: after.breakEven.dailyTransactionsNeeded
        },
        label: `Scenario: ${Object.keys(changes).join(", ")} changed`
      }
    };
  }
  return {
    message: result.content,
    suggestedPrompts: [
      "What if I hired one fewer staff member?",
      "What if I increased prices by 15%?",
      "Show me the 12-month projection"
    ],
    chartUpdate
  };
}
async function handleAskQuestion(question, financialData, launchpad, locationScores) {
  const calcs = computeFinancials(financialData, launchpad);
  const locationScore = locationScores["location_iq"]?.score ?? 0;
  const conceptKnowledge = buildConceptKnowledge(launchpad.businessType);
  const userMsg = `User asks: "${question}"
${conceptKnowledge}

Context — ${launchpad.businessType} business:
- Monthly Revenue: $${calcs.monthlyRevenue.toLocaleString()}, Net: $${calcs.monthlyNetIncome.toLocaleString()}
- Rent: $${calcs.rent.toLocaleString()}/mo, Break-even: ${calcs.breakEvenDaily}/day
- Location Score: ${locationScore}/100
- Budget: ${launchpad.budget || "not specified"}

Answer their question with financial context. Use specific numbers. Be helpful and honest.`;
  const result = await callLLM({
    model: "sonnet",
    system: BUSINESS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
    maxTokens: 600,
    temperature: 0.5
  });
  return {
    message: result.content,
    suggestedPrompts: [
      "How long until I break even?",
      "What are the hidden costs I should plan for?",
      "Is my pricing competitive?"
    ]
  };
}
const POST = async ({ request }) => {
  const auth = await requireAuth(request);
  if ("response" in auth) return auth.response;
  const rateLimited = checkRateLimit(auth.userId);
  if (rateLimited) return rateLimited;
  try {
    const body = await request.json();
    if (!body.geoid) {
      return new Response(JSON.stringify({ error: "Missing geoid" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!body.launchpad?.businessType) {
      return new Response(JSON.stringify({ error: "Missing launchpad.businessType" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    body.launchpad.businessType = normalizeBusinessType(body.launchpad.businessType);
    if (!["explain_numbers", "what_if", "ask_question", "strategy_playbook"].includes(body.action)) {
      return new Response(JSON.stringify({
        error: "Invalid action. Must be: explain_numbers, what_if, ask_question, or strategy_playbook"
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const startMs = Date.now();
    const scoreRows = await db.select({
      score_type: blockGroupScores.scoreType,
      score: blockGroupScores.score,
      components: blockGroupScores.components
    }).from(blockGroupScores).where(eq(blockGroupScores.geoid, body.geoid));
    const locationScores = {};
    if (scoreRows) {
      for (const r of scoreRows) locationScores[r.score_type] = { score: r.score, components: r.components };
    }
    let result;
    switch (body.action) {
      case "explain_numbers":
        result = await handleExplainNumbers(body.financialData || {}, body.launchpad, body.page, locationScores);
        break;
      case "what_if":
        if (!body.question) {
          return new Response(JSON.stringify({ error: "Missing question for what_if action" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        result = await handleWhatIf(body.question, body.financialData || {}, body.launchpad, locationScores);
        break;
      case "ask_question":
        if (!body.question) {
          return new Response(JSON.stringify({ error: "Missing question for ask_question action" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        result = await handleAskQuestion(body.question, body.financialData || {}, body.launchpad, locationScores);
        break;
      case "strategy_playbook": {
        const strategy = body.strategy || "negotiate_rent";
        const lp = body.launchpad || {};
        const rent = lp.monthlyRent || 0;
        const revenue = (lp.avgTicket || 0) * (lp.dailyCustomers || 0) * (lp.daysPerWeek || 6) * 4.33;
        const rentPct = revenue > 0 ? Math.round(rent / revenue * 100) : 0;
        const freeRentSavings = rent * 3;
        const yr1rent = Math.round(rent * 0.8);
        const tiLow = (lp.sqft || 1e3) * 20;
        const tiHigh = (lp.sqft || 1e3) * 80;
        const avgTicket = lp.avgTicket || 8.75;
        const upsellTicket = avgTicket + 3 * 0.4;
        const dailyCustomers = lp.dailyCustomers || 250;
        const dailyGain = Math.round((upsellTicket - avgTicket) * dailyCustomers);
        const dailyTarget = Math.round((rent * 12 + revenue * 0.88 * 0.3) / 365);
        let message = "";
        if (strategy === "negotiate_rent") {
          message = "Your rent is " + rentPct + "% of projected revenue. The safe zone is 6-12%.\n\n**1. ASK FOR FREE RENT DURING BUILDOUT**\nStandard: 1 free month per year of lease. On a 5-year lease, that is 5 months free. At $" + rent.toLocaleString() + "/mo, you save $" + freeRentSavings.toLocaleString() + ".\nSay: We will need 3-5 months free rent during buildout. This is standard.\n\n**2. GRADUATED RENT SCHEDULE**\nYear 1: $" + yr1rent.toLocaleString() + " (20% below asking)\nYear 2: $" + Math.round(rent * 0.9).toLocaleString() + "\nYear 3+: Full asking\n\n**3. REQUEST A TI ALLOWANCE**\nTypical: $20-$80/SF. For your space: $" + tiLow.toLocaleString() + "-$" + tiHigh.toLocaleString() + " off buildout.\n\n**4. LONGER LEASE FOR LOWER RATE**\nA 7-year lease at $" + Math.round(rent * 0.85).toLocaleString() + "/mo costs less than a 3-year at $" + rent.toLocaleString() + ".\n\n**5. USE VACANCY AS LEVERAGE**\nIf vacancy above 5%, say: I see comparable spaces available. I need the numbers to work.";
        } else if (strategy === "increase_revenue") {
          message = "Right now you need ~$" + dailyTarget + "/day to break even.\n\n**1. RAISE AVERAGE TICKET**\nCurrent: $" + avgTicket.toFixed(2) + ". Add $3 upsell to 40% of orders = $" + upsellTicket.toFixed(2) + ". That is $" + dailyGain + "/day more.\n\n**2. EXTEND HOURS**\nEarly morning or late evening catches different traffic.\n\n**3. SECOND REVENUE STREAM**\nFor " + (lp.businessType || "your concept") + ": merch, catering, delivery-only, subscriptions.\n\n**4. FOOT TRAFFIC CONVERSION**\nSidewall signage converts 2-5% of passersby.";
        } else {
          message = "Here is how your rent compares:\n\n**YOUR RENT:** $" + rent.toLocaleString() + "/mo" + (lp.sqft ? " ($" + Math.round(rent / lp.sqft * 12) + "/SF/yr)" : "") + "\n\nAsk me: What are rents like here? Are they going up or down? What neighborhoods nearby are cheaper?";
        }
        result = { message };
        break;
      }
      default:
        result = { message: "Unknown action" };
    }
    const durationMs = Date.now() - startMs;
    logCopilotConversation(
      auth.userId,
      "business",
      body.geoid,
      body.action,
      { businessType: body.launchpad.businessType, page: body.page },
      result.message,
      "claude-sonnet-4",
      durationMs
    );
    return new Response(JSON.stringify({
      ...result,
      _meta: {
        geoid: body.geoid,
        action: body.action,
        page: body.page,
        durationMs
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("[BusinessCopilot] Error:", err);
    return new Response(JSON.stringify({
      error: "Business copilot error",
      message: err instanceof Error ? err.message : "Unknown error"
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
export {
  POST
};
