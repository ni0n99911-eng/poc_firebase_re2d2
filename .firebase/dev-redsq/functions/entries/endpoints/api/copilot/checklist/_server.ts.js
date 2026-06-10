import { r as requireAuth } from "../../../../../chunks/auth-middleware.js";
import { c as callLLM } from "../../../../../chunks/openrouter-llm.js";
import { d as db, c as copilotConversations } from "../../../../../chunks/db-server.js";
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
async function logCopilotConversation(userId, action, requestData, responseSummary, modelUsed, latencyMs) {
  try {
    await db.insert(copilotConversations).values({
      id: crypto.randomUUID(),
      userId,
      context: action,
      messages: {
        copilot_type: "checklist",
        geoid: null,
        action,
        request_data: requestData,
        response_summary: responseSummary.slice(0, 200),
        model_used: modelUsed,
        latency_ms: latencyMs
      }
    });
  } catch (err) {
    console.warn("[ChecklistCopilot] Failed to log conversation:", err instanceof Error ? err.message : err);
  }
}
const CHECKLIST_SYSTEM_PROMPT = `You are the RE² Launch CoPilot. You help first-time founders navigate the commercial lease process in New York City. You know what brokers, lawyers, and experienced operators know — but you explain it like a patient mentor, never a textbook.

RULES:
- Keep answers under 200 words. End with one specific action the founder can take today.
- Never use acronyms without explaining them first.
- If you are not sure, say so — never guess on legal or financial matters.
- When citing costs or timelines, give ranges, not single numbers.
- If a question is outside your knowledge (e.g. current interest rates, specific property listings), say so honestly.

═══ GROUND TRUTH: NYC COMMERCIAL REAL ESTATE ═══

COMMERCIAL RENT TAX (CRT):
- Applies to tenants south of 96th St in Manhattan only
- Rate: 3.9% of annual rent (effective rate after credits)
- Filed quarterly: Sep 20, Dec 20, Mar 20, Jun 20
- Exemption: Tenants with annual rent under $250,000
- For a $10K/mo space in Midtown, CRT adds ~$4,680/year

ZONING DISTRICTS (what you can open where):
- C1/C2: Local retail, cafes, small services (most common for first-timers)
- C3: Waterfront/recreation
- C4: General commercial, larger retail
- C5/C6: Central commercial (Midtown, FiDi), offices + retail
- C7: Amusement (Coney Island)
- C8: Heavy commercial, auto, manufacturing overlay
- Ground floor rule: Many districts require active retail on ground floor
- FAR (Floor Area Ratio) limits building size; varies by district
- Always verify with NYC ZoLa (zoning map) before signing anything

LANDMARK & HISTORIC DISTRICTS:
- LPC (Landmarks Preservation Commission) approval needed for exterior changes
- Timeline: 5–10 weeks for approval, $500–$5,000 in fees
- Includes signage, awnings, lighting, facade changes
- 120+ historic districts across all 5 boroughs

BID (BUSINESS IMPROVEMENT DISTRICT) ZONES:
- 76 BIDs citywide, each with own assessment rate
- Typical cost: $10–$25 per 1,000 SF annual assessment
- Benefits: extra sanitation, security, marketing, streetscape
- Notable: Times Square, DUMBO, Fulton Mall, 125th St, Fordham Rd

ADA COMPLIANCE:
- 32-inch minimum door clearance, 1:12 ramp ratio
- Accessible restroom if public-facing
- Typical retrofit: $10,000–$30,000
- Non-compliance fines: $500–$1,000/day + lawsuits

ENVIRONMENTAL:
- Pre-1978 buildings: assume lead paint + asbestos until tested
- Phase I Environmental Assessment: $1,500–$3,000 (always get one)
- Phase II (if Phase I flags issues): $5,000–$15,000
- NYC E-Designation properties: extra DEP requirements

BOROUGH MARKET DATA:
- Manhattan: lowest vacancy (3–5%), highest rents ($80–$300/SF)
- Brooklyn: strong demand, vacancy 4–7%, rents $40–$120/SF
- Queens: diverse neighborhoods, vacancy 5–8%, rents $30–$80/SF
- Bronx: emerging, vacancy 6–10%, rents $25–$60/SF
- Staten Island: suburban, vacancy 5–9%, rents $20–$50/SF
- Business mix citywide: Food 21%, Retail 29%, Services 32%, Office 18%

═══ LEASE & LEGAL KNOWLEDGE ═══

LEASE TYPES:
- Gross lease: Landlord pays taxes, insurance, maintenance. Simpler. Common for small retail.
- NNN (Triple Net): Tenant pays rent + property tax + insurance + maintenance. Common for larger spaces. Read carefully — costs add 20–40% on top of base rent.
- Modified Gross: Landlord covers some, tenant covers some. Most negotiable.

AFFORDABILITY RULE: Rent should be 6–10% of projected annual revenue, MAX. If your rent is more than 10% of expected revenue, the numbers probably don't work.

KEY COST BENCHMARKS:
- Security deposit: 1–3 months rent (negotiate for 1)
- Insurance: $3M general liability minimum, $1M per occurrence
- Rent escalation: 2–3% annual is standard. Red flag if higher than 3%.
- TI (Tenant Improvement) allowance: $20–$80/SF typical for new tenants
- Broker commission: 4–6% of total lease value (paid by tenant or landlord, varies)
- Attorney for lease review: $2,000–$10,000

9 CRITICAL LEASE CLAUSES (negotiate all of these):
1. Permitted Use — broad as possible ("any lawful retail use" beats "coffee shop only")
2. Assignment & Subletting — right to assign or sublet with reasonable landlord consent
3. Renewal Option — 5+5 or 10-year with capped escalation
4. Rent Escalation — fixed % preferred over CPI-linked
5. TI Allowance — get it in writing with clear disbursement terms
6. SNDA (Subordination, Non-Disturbance, Attornment) — protects you if landlord defaults on mortgage
7. Insurance — verify what landlord requires vs. what you actually need
8. Default & Cure Period — 30–45 days to fix problems before eviction
9. Restoration — negotiate to leave improvements in place at lease end

LEGAL PROTECTIONS:
- SBJA (Small Business Jobs Act): renewal protections for qualifying businesses
- Yellowstone Injunction: emergency court order to stop eviction while you cure default
- Personal Guaranty: ALWAYS negotiate a cap or "burn-off" (e.g. guaranty reduces 25%/year)
- Red flags: No attorney review period, unlimited personal guaranty, no renewal option, open DOB violations, Certificate of Occupancy mismatch, rent > 10% of revenue

═══ TIMELINE & COST REFERENCE ═══

4-PHASE TIMELINE (20 weeks total):
Phase 1 — Know Before You Look (weeks 1–4): Entity formation, budget, team assembly
Phase 2 — Search & Evaluate (weeks 4–12): Site visits, zoning checks, LOI
Phase 3 — Negotiate & Close (weeks 12–20): Lease negotiation, due diligence, signing
Phase 4 — Ongoing Compliance: CRT filing, insurance renewal, ADA maintenance

PERMIT TIMELINES:
- DOB (Dept of Buildings) permit: 2–4 weeks
- Health Department license: 4–8 weeks
- SLA (liquor license): 8–12 weeks (start early!)
- Certificate of Occupancy amendment: 2–4 weeks, $500–$1,000
- Fire Department permit: 1–2 weeks
- DOT sidewalk cafe: 6–12 weeks

BUILDOUT COSTS:
- Basic renovation: $75–$125/SF
- Full buildout (restaurant): $150–$300/SF
- Coffee shop/cafe: $100–$200/SF
- Retail store: $50–$150/SF
- Always budget 15–20% contingency

TOTAL OCCUPANCY COST = Base Rent + CRT (if applicable) + BID assessment + Insurance + CAM charges + Utilities

DUE DILIGENCE (before signing):
- Certificate of Occupancy matches your intended use
- No open DOB violations (check DOB BIS online)
- Verify zoning allows your business type (check ZoLa)
- Phase I environmental (especially pre-1978 buildings)
- Check for landmark/historic district restrictions
- Confirm ADA compliance or budget for retrofit
- Review landlord's financial stability`;
const PHASE_PROMPTS = {
  entity: [
    "What kind of business entity should I form?",
    "Do I need an EIN before signing a lease?",
    "How much does a commercial real estate lawyer cost?",
    "What is a personal guaranty and should I worry?",
    "What is the SBJA and does it protect me?"
  ],
  lease: [
    "How do I know if the rent is fair for this area?",
    "What is a good occupancy cost ratio?",
    "What should I check on a site visit?",
    "What are BID zones and do they help me?",
    "How do I read a zoning map?",
    "Is there a tax on commercial rent?"
  ],
  design: [
    "How much does buildout typically cost per square foot?",
    "What is a TI allowance and how much should I ask for?",
    "Do I need an architect for my buildout?",
    "What if my building is landmarked?",
    "How long does a DOB permit take?"
  ],
  permits: [
    "What permits do I need to open?",
    "How long does a DOB permit take?",
    "Do I need a health department license?",
    "What is a Certificate of Occupancy?",
    "How do I get a liquor license in NYC?",
    "What if my building is landmarked?"
  ],
  finance: [
    "What insurance do I need before I open?",
    "How do SBA loans work for small businesses?",
    "What is my total occupancy cost?",
    "How much should I keep in reserve?",
    "What are typical startup costs for my type of business?"
  ],
  ops: [
    "What systems should I set up before opening?",
    "How do I find reliable suppliers in NYC?",
    "What staff do I need for opening day?",
    "How do I set up payroll for a small business?"
  ],
  marketing: [
    "How do I market my business before opening?",
    "Should I do a soft opening?",
    "How much should I budget for pre-launch marketing?",
    "What social media strategy works for local businesses?"
  ],
  opening: [
    "What final inspections do I need?",
    "Do I need to file for Commercial Rent Tax?",
    "What is my first quarterly CRT deadline?",
    "How do I set up ADA compliance?",
    "What ongoing compliance do I need to track?"
  ]
};
function buildUserContext(ctx) {
  const lines = ["USER CONTEXT:"];
  if (ctx.businessType) lines.push(`- Business type: ${ctx.businessType}${ctx.businessSubType ? ` (${ctx.businessSubType})` : ""}`);
  if (ctx.address) lines.push(`- Location: ${ctx.address}${ctx.borough ? `, ${ctx.borough}` : ""}`);
  if (ctx.rentBudget) lines.push(`- Monthly rent budget: $${ctx.rentBudget.toLocaleString()}`);
  if (ctx.startupCapital) lines.push(`- Startup capital: $${ctx.startupCapital.toLocaleString()}`);
  if (ctx.activePhase) lines.push(`- Current checklist phase: ${ctx.activePhase}`);
  if (ctx.activeTask) lines.push(`- Working on: ${ctx.activeTask}`);
  if (ctx.completedCount != null && ctx.totalCount != null) {
    lines.push(`- Progress: ${ctx.completedCount}/${ctx.totalCount} tasks complete`);
  }
  return lines.join("\n");
}
async function handleAskQuestion(question, ctx) {
  const userContext = buildUserContext(ctx);
  const phase = ctx.activePhase || "entity";
  const userMsg = `${userContext}

User asks: "${question}"

Answer using your NYC CRE knowledge. Be specific with numbers, timelines, and costs. If the question relates to their specific business type or location, tailor the answer. If you don't know the current/exact answer, say so.`;
  const result = await callLLM({
    model: "sonnet",
    system: CHECKLIST_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
    maxTokens: 600,
    temperature: 0.4
  });
  const phasePrompts = PHASE_PROMPTS[phase] || PHASE_PROMPTS.entity;
  const shuffled = phasePrompts.sort(() => Math.random() - 0.5);
  return {
    message: result.content,
    suggestedPrompts: shuffled.slice(0, 3)
  };
}
async function handleExplainTask(taskName, ctx) {
  const userContext = buildUserContext(ctx);
  const userMsg = `${userContext}

The user is looking at this checklist task: "${taskName}"

Explain what this task involves, why it matters, how much it typically costs, and how long it takes. Give NYC-specific guidance. End with the one most important thing they should do first.`;
  const result = await callLLM({
    model: "sonnet",
    system: CHECKLIST_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
    maxTokens: 500,
    temperature: 0.4
  });
  return {
    message: result.content,
    suggestedPrompts: [
      "What does this typically cost?",
      "How long does this take?",
      "What can go wrong with this step?"
    ]
  };
}
async function handleWhatShouldIKnow(ctx) {
  const userContext = buildUserContext(ctx);
  const phase = ctx.activePhase || "entity";
  const userMsg = `${userContext}

The user is in the "${phase}" phase of their launch checklist. Based on their business type and current phase, what are the 3 most important things they need to know RIGHT NOW? Be specific to NYC. Include costs and timelines where relevant.`;
  const result = await callLLM({
    model: "sonnet",
    system: CHECKLIST_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
    maxTokens: 600,
    temperature: 0.4
  });
  const phasePrompts = PHASE_PROMPTS[phase] || PHASE_PROMPTS.entity;
  const shuffled = phasePrompts.sort(() => Math.random() - 0.5);
  return {
    message: result.content,
    suggestedPrompts: shuffled.slice(0, 4)
  };
}
const POST = async ({ request }) => {
  const auth = await requireAuth(request);
  if ("response" in auth) return auth.response;
  const rateLimited = checkRateLimit(auth.userId);
  if (rateLimited) return rateLimited;
  try {
    const body = await request.json();
    if (!body.action || !["ask_question", "explain_task", "what_should_i_know"].includes(body.action)) {
      return new Response(JSON.stringify({
        error: "Invalid action. Must be: ask_question, explain_task, or what_should_i_know"
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const startMs = Date.now();
    let result;
    switch (body.action) {
      case "ask_question":
        if (!body.question) {
          return new Response(JSON.stringify({ error: "Missing question" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        result = await handleAskQuestion(body.question, body.context || {});
        break;
      case "explain_task":
        if (!body.taskName) {
          return new Response(JSON.stringify({ error: "Missing taskName for explain_task" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        result = await handleExplainTask(body.taskName, body.context || {});
        break;
      case "what_should_i_know":
        result = await handleWhatShouldIKnow(body.context || {});
        break;
      default:
        result = { message: "Unknown action" };
    }
    const durationMs = Date.now() - startMs;
    logCopilotConversation(
      auth.userId,
      body.action,
      { businessType: body.context?.businessType, phase: body.context?.activePhase },
      result.message,
      "claude-sonnet-4",
      durationMs
    );
    return new Response(JSON.stringify({
      ...result,
      _meta: { action: body.action, durationMs }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("[ChecklistCopilot] Error:", err);
    return new Response(JSON.stringify({
      error: "Checklist copilot error",
      message: err instanceof Error ? err.message : "Unknown error"
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
export {
  POST
};
