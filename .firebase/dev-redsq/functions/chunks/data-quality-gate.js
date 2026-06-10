import { p as private_env } from "./private.js";
import { o as openrouterFetch } from "./retry.js";
import { d as db } from "./db-server.js";
import { sql } from "drizzle-orm";
const SOURCE_IMPACT = {
  census: "Population and demographic data unavailable — neighborhood demand estimates less reliable",
  censusHousing: "Housing and rent data missing — lease affordability signals degraded",
  walkScore: "Walk/transit/bike scores unavailable — foot traffic estimates less accurate",
  inspections: "Restaurant inspection grades missing — food safety and compliance signals absent",
  crime: "Crime data unavailable — safety scoring relies on defaults",
  places: "Google Places data missing — nearby business ecosystem incomplete",
  marketDensity: "Market density scan failed — amenity counts may be understated",
  competitors: "Competitor scan failed — saturation analysis unavailable",
  lpc: "Landmark data missing — no impact on most analyses",
  mtaRidership: "Subway ridership data missing — transit demand estimates less precise",
  dcaLicenses: "Business license data missing — local business activity signal absent",
  dob: "Building permits/violations missing — construction activity unknown",
  complaints311: "311 complaint data missing — quality of life signals degraded",
  pedestrian: "Pedestrian count data missing — foot traffic estimates rely on proxies",
  pluto: "Tax lot data missing — zoning and building class unknown",
  sidewalkCafes: "Sidewalk café data missing — minor impact (supplementary signal)",
  liquorLicenses: "Liquor license data missing — SLA clustering analysis unavailable",
  foursquare: "Foursquare venue data missing — competitor quality signals degraded",
  momentum: "Trend data missing — neighborhood momentum direction unknown",
  schools: "School proximity data missing — SLA 200-ft rule cannot be verified automatically"
};
const SOURCE_WEIGHTS = {
  census: 10,
  censusHousing: 6,
  walkScore: 7,
  inspections: 7,
  crime: 6,
  places: 5,
  marketDensity: 7,
  competitors: 9,
  lpc: 3,
  mtaRidership: 9,
  dcaLicenses: 9,
  dob: 7,
  complaints311: 6,
  pedestrian: 9,
  pluto: 10,
  sidewalkCafes: 6,
  liquorLicenses: 5,
  foursquare: 8,
  momentum: 7,
  schools: 4
};
const CRITICAL_SOURCES = {
  impulse: ["mtaRidership", "pedestrian", "competitors", "walkScore", "dcaLicenses", "pluto", "sidewalkCafes"],
  planned: ["census", "censusHousing", "inspections", "dcaLicenses", "competitors", "crime", "pluto", "liquorLicenses", "schools"],
  destination: ["competitors", "dcaLicenses", "census", "walkScore", "dob", "pluto", "marketDensity"]
};
const BIZ_ARCHETYPE = {
  // Display names
  "Specialty Coffee/Café": "impulse",
  "Quick-Service Restaurant": "impulse",
  "Restaurant": "planned",
  "Retail": "impulse",
  "Fitness": "destination",
  "Prof Services": "destination",
  "Bar/Nightlife": "planned",
  "Grocery": "planned",
  "Salon": "planned",
  // Lowercase slugs
  "cafe": "impulse",
  "coffee": "impulse",
  "qsr": "impulse",
  "fast_food": "impulse",
  "restaurant": "planned",
  "retail": "impulse",
  "fitness": "destination",
  "gym": "destination",
  "services": "destination",
  "coworking": "destination",
  "bar": "planned",
  "nightlife": "planned",
  "grocery": "planned",
  "salon": "planned"
};
function computeConfidence(report, businessType = "cafe") {
  const archetype = BIZ_ARCHETYPE[businessType] || "impulse";
  const criticalSources = CRITICAL_SOURCES[archetype];
  const sources = {
    census: report.census,
    censusHousing: report.censusHousing,
    walkScore: report.walkScore,
    inspections: report.inspections,
    crime: report.crime,
    places: report.places,
    marketDensity: report.marketDensity,
    competitors: report.competitors,
    lpc: report.lpc,
    mtaRidership: report.mtaRidership,
    dcaLicenses: report.dcaLicenses,
    dob: report.dob,
    complaints311: report.complaints311,
    pedestrian: report.pedestrian,
    pluto: report.pluto,
    sidewalkCafes: report.sidewalkCafes,
    liquorLicenses: report.liquorLicenses,
    foursquare: report.foursquare,
    momentum: report.momentum,
    schools: report.schools
  };
  let weightedScore = 0;
  let totalWeight = 0;
  const criticalMissing = [];
  const sourceCoverage = [];
  for (const [key, weight] of Object.entries(SOURCE_WEIGHTS)) {
    const available = sources[key] != null;
    const isCritical = criticalSources.includes(key);
    const effectiveWeight = isCritical ? weight * 1.5 : weight;
    totalWeight += effectiveWeight;
    if (available) {
      weightedScore += effectiveWeight;
    } else if (isCritical) {
      criticalMissing.push(formatSourceName(key));
    }
    sourceCoverage.push({
      source: formatSourceName(key),
      available,
      critical: isCritical,
      weight: effectiveWeight,
      freshness: available ? "live" : "missing",
      impact: available ? void 0 : SOURCE_IMPACT[key]
    });
  }
  const mtaConfidencePenalty = report.mtaRidership?.dataQuality === "estimated" ? 8 : report.mtaRidership?.dataQuality === "mixed" ? 4 : 0;
  const percentage = Math.max(0, Math.round(weightedScore / totalWeight * 100) - mtaConfidencePenalty);
  let level;
  if (percentage >= 85) level = "HIGH";
  else if (percentage >= 65) level = "GOOD";
  else if (percentage >= 40) level = "MODERATE";
  else level = "PRELIMINARY";
  const bandWidth = percentage >= 85 ? 3 : percentage >= 65 ? 6 : percentage >= 40 ? 10 : 15;
  const band = { low: bandWidth, high: bandWidth };
  const recommendation = generateConfidenceRecommendation(level, criticalMissing, percentage);
  return {
    level,
    percentage,
    band,
    sourceCoverage,
    criticalMissing,
    recommendation
  };
}
function computeScoreAgreement(subScores) {
  const values = Object.values(subScores).filter((v) => v != null && v > 0);
  if (values.length < 3) {
    return {
      coefficientOfVariation: 50,
      level: "MODERATE",
      explanation: "Insufficient sub-scores to measure agreement"
    };
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) {
    return { coefficientOfVariation: 100, level: "LOW", explanation: "All sub-scores are zero" };
  }
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  const sd = Math.sqrt(variance);
  const cv = Math.round(sd / mean * 100);
  let level;
  let explanation;
  if (cv < 15) {
    level = "HIGH";
    explanation = `Sub-scores agree strongly (CV=${cv}%). All signals point the same direction — composite score is reliable.`;
  } else if (cv < 25) {
    level = "GOOD";
    explanation = `Sub-scores mostly agree (CV=${cv}%). Minor signal disagreement — composite score is directionally reliable.`;
  } else if (cv < 35) {
    level = "MODERATE";
    explanation = `Sub-scores show moderate disagreement (CV=${cv}%). Some signals conflict — drill into individual dimensions before deciding.`;
  } else {
    level = "LOW";
    explanation = `Sub-scores disagree significantly (CV=${cv}%). Signals contradict each other — the composite score hides important nuance. Look at individual dimensions.`;
  }
  return { coefficientOfVariation: cv, level, explanation };
}
function formatSourceName(key) {
  const names = {
    census: "Census Demographics",
    censusHousing: "Census Housing",
    walkScore: "Walk Score",
    inspections: "Health Inspections",
    crime: "Crime Data",
    places: "Google Places",
    marketDensity: "Market Density",
    competitors: "Competitor Scan",
    lpc: "Landmarks",
    mtaRidership: "MTA Ridership",
    dcaLicenses: "Business Licenses",
    dob: "Building Permits",
    complaints311: "311 Complaints",
    pedestrian: "Pedestrian Counts",
    pluto: "PLUTO Tax Lots",
    sidewalkCafes: "Sidewalk Café Permits",
    liquorLicenses: "Liquor Licenses",
    foursquare: "Foursquare Places",
    momentum: "Momentum Trends"
  };
  return names[key] || key;
}
function generateConfidenceRecommendation(level, criticalMissing, percentage) {
  switch (level) {
    case "HIGH":
      return "Excellent data coverage. This Location IQ score is reliable for decision-making.";
    case "GOOD":
      return criticalMissing.length > 0 ? `Good data coverage (${percentage}%). Missing: ${criticalMissing.join(", ")}. Score is directionally reliable.` : `Good data coverage (${percentage}%). Score is reliable for shortlisting and further investigation.`;
    case "MODERATE":
      return `Partial data coverage (${percentage}%). Missing critical sources: ${criticalMissing.join(", ")}. Use for exploration — validate with field research before committing.`;
    case "PRELIMINARY":
      return `Limited data coverage (${percentage}%). Missing: ${criticalMissing.join(", ")}. Treat this as a preliminary signal only — significantly more data needed.`;
  }
}
const OPENROUTER_KEY$2 = private_env?.OPENROUTER_API_KEY || "";
const HAIKU_MODEL$1 = "anthropic/claude-haiku-4.5";
function emptyExtraction() {
  return {
    competitorFreshness: [],
    sentimentSignals: [],
    conceptGaps: [],
    pricePositioning: null,
    footTrafficPatterns: [],
    extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
    model: "none",
    latencyMs: 0
  };
}
async function extractWithHaiku(report) {
  if (!OPENROUTER_KEY$2) return emptyExtraction();
  const start = Date.now();
  const snapshot = buildDataSnapshot(report);
  if (!snapshot) return emptyExtraction();
  const systemPrompt = `You are a commercial real estate data analyst. Extract structured intelligence from raw API data about a NYC neighborhood.

Return ONLY valid JSON with this exact structure:
{
  "competitorFreshness": [{"name": "string", "source": "google|yelp|foursquare", "estimatedAge": "new_under_1yr|established_1_3yr|mature_3plus|unknown", "confidence": 0.0-1.0, "signals": ["why you think this"]}],
  "sentimentSignals": [{"theme": "string", "sentiment": "positive|negative|mixed", "frequency": "common|occasional|rare", "relevantTo": "business type this matters for", "example": "brief example"}],
  "conceptGaps": [{"missingType": "what's missing", "demandSignal": "evidence of demand", "confidence": 0.0-1.0, "reasoning": "why"}],
  "pricePositioning": {"areaAvgPriceLevel": 1-4, "distribution": {"budget": 0.0-1.0, "mid": 0.0-1.0, "upscale": 0.0-1.0}, "openingFor": "price tier with opportunity", "reasoning": "why"},
  "footTrafficPatterns": [{"timeSlot": "morning|lunch|afternoon|evening|late_night|weekend", "intensity": "high|medium|low|dead", "primaryDrivers": ["what drives traffic"], "source": "data source"}]
}

Be precise. Only include what the data supports. Max 5 items per array. No explanations outside JSON.`;
  try {
    const response = await openrouterFetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_KEY$2}`,
          "HTTP-Referer": "https://resquared.io",
          "X-Title": "RE² Haiku Extractor"
        },
        body: JSON.stringify({
          model: HAIKU_MODEL$1,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: snapshot }
          ],
          temperature: 0.2,
          max_tokens: 1500
        })
      },
      "HaikuExtractor"
    );
    if (!response) {
      return emptyExtraction();
    }
    const completion = await response.json();
    const content = completion.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      return {
        competitorFreshness: (parsed.competitorFreshness || []).slice(0, 5),
        sentimentSignals: (parsed.sentimentSignals || []).slice(0, 5),
        conceptGaps: (parsed.conceptGaps || []).slice(0, 5),
        pricePositioning: parsed.pricePositioning || null,
        footTrafficPatterns: (parsed.footTrafficPatterns || []).slice(0, 6),
        extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
        model: HAIKU_MODEL$1,
        latencyMs: Date.now() - start
      };
    } catch {
      console.error("[HaikuExtractor] JSON parse failed");
      return emptyExtraction();
    }
  } catch (err) {
    console.error("[HaikuExtractor] Fetch error:", err);
    return emptyExtraction();
  }
}
function buildDataSnapshot(report) {
  const parts = [];
  parts.push(`Location: ${report.address || `${report.lat},${report.lng}`}`);
  parts.push(`Business type: ${report.businessType}`);
  if (report.places?.results?.length) {
    const top = report.places.results.slice(0, 8);
    parts.push(`
Nearby competitors (Google Places):`);
    top.forEach((p) => {
      parts.push(`- ${p.name}: rating ${p.rating || "?"}/5, ${p.user_ratings_total || 0} reviews, price_level ${p.price_level || "?"}`);
    });
  }
  if (report.yelp?.businesses?.length) {
    const top = report.yelp.businesses.slice(0, 8);
    parts.push(`
Nearby businesses (Yelp):`);
    top.forEach((b) => {
      parts.push(`- ${b.name}: ${b.rating}/5, ${b.review_count} reviews, price=${b.price || "?"}, categories=[${(b.categories || []).map((c) => c.title || c.alias).join(", ")}]`);
    });
  }
  if (report.foursquare?.venues?.length) {
    const top = report.foursquare.venues.slice(0, 6);
    parts.push(`
Venues (Foursquare):`);
    top.forEach((v) => {
      parts.push(`- ${v.name}: popularity=${v.popularity || "?"}, categories=[${(v.categories || []).map((c) => c.name || c).join(", ")}]`);
    });
  }
  if (report.marketDensity?.categories?.length) {
    parts.push(`
Market density (500m radius):`);
    report.marketDensity.categories.forEach((c) => {
      parts.push(`- ${c.category}: ${c.count} businesses`);
    });
  }
  if (report.census) {
    const c = report.census;
    parts.push(`
Demographics: median_income=$${c.medianIncome || "?"}, population_density=${c.populationDensity || "?"}/sqmi`);
  }
  if (report.mtaRidership?.stations?.length) {
    const topStation = report.mtaRidership.stations[0];
    parts.push(`
Nearest subway: ${topStation.stationName}, daily ridership ~${topStation.avgDailyRidership || "?"}`);
  }
  if (report.pedestrian?.counts?.length) {
    const top = report.pedestrian.counts[0];
    parts.push(`Pedestrian count: ${top.count || "?"} at ${top.location || "nearby intersection"}`);
  }
  if (report.dcaLicenses) {
    const d = report.dcaLicenses;
    parts.push(`
Business licenses: ${d.totalActive || d.total || "?"} active, new_business_rate=${d.newBusinessRate || "?"}%`);
  }
  if (report.sidewalkCafes) {
    const sc = report.sidewalkCafes;
    parts.push(`Sidewalk cafes: ${sc.total || sc.permits?.length || 0} permits nearby`);
  }
  if (report.liquorLicenses) {
    const ll = report.liquorLicenses;
    parts.push(`Liquor licenses: ${ll.total || ll.licenses?.length || 0} nearby`);
  }
  if (report.crime) {
    const cr = report.crime;
    parts.push(`
Crime: ${cr.totalIncidents || cr.total || "?"} incidents (500m radius)`);
  }
  if (parts.length < 3) return null;
  return parts.join("\n");
}
const OPENROUTER_KEY$1 = private_env?.OPENROUTER_API_KEY || "";
const SONNET_MODEL = "anthropic/claude-sonnet-4";
function emptyAnalysis() {
  return {
    marketTiming: {
      phase: "mature",
      trajectory: "steady",
      confidence: 0.3,
      reasoning: "Insufficient data for AI analysis",
      signals: [],
      windowOfOpportunity: "Unknown"
    },
    conceptFit: {
      score: 50,
      grade: "C",
      strengths: [],
      weaknesses: [],
      dealBreakers: [],
      oneLineSummary: "Insufficient data for detailed analysis"
    },
    hiddenRisks: [],
    competitiveMoat: {
      existingCompetitors: 0,
      moatStrength: "none",
      primaryAdvantage: "Unknown",
      vulnerabilities: [],
      recommendation: "Gather more data before committing"
    },
    revenueConfidence: {
      confidenceLevel: "speculative",
      dataCompleteness: 0,
      keyAssumptions: [],
      biggestUnknown: "All projections need verification"
    },
    executiveSummary: "AI analysis unavailable — using deterministic scoring only.",
    analyzedAt: (/* @__PURE__ */ new Date()).toISOString(),
    model: "none",
    latencyMs: 0
  };
}
async function analyzeNeighborhood(report, reconciled, extrapolated, haikuData, historicalContext, scoringFlags) {
  if (!OPENROUTER_KEY$1) return emptyAnalysis();
  const start = Date.now();
  const briefing = buildAnalystBriefing(report, reconciled, extrapolated, haikuData);
  let historicalContextBlock = "";
  if (historicalContext && historicalContext.length > 0) {
    const lines = historicalContext.map((entry) => {
      const yearStr = entry.year_range ? ` (${entry.year_range})` : "";
      return `### ${entry.neighborhood}: ${entry.infrastructure}${yearStr}
${entry.description || ""}
Current relevance: ${entry.current_relevance || "See scoring data."}`;
    });
    historicalContextBlock = `
## Historical Context (from documented sources)
The following historically documented facts are relevant to this location.
Use them to EXPLAIN scoring patterns, not to override API data.
If current data contradicts historical patterns, note the divergence — it may indicate genuine transformation or a data gap.

${lines.join("\n\n")}
`;
  }
  let scoringFlagsBlock = "";
  const systemPrompt = `You are a senior commercial real estate analyst specializing in NYC retail locations. You've been given a comprehensive data briefing about a specific location and business concept.
${historicalContextBlock}${scoringFlagsBlock}
## Professional Broker Assessment Framework (BRAIN-COP-01)
When generating location analysis, frame observations using the 7-criterion professional broker assessment:
1. Business Diversity → use competition sub-score + type_distribution data
2. Concentrated Retail → use vibrancy sub-score + POI density
3. Gathering Spots/Transit → use accessibility sub-score (transit + park proximity)
4. Target Audience Proximity → use demographics + price-income fit sub-scores
5. Visibility (note if data unavailable — flag as unknown)
6. Double-Sided Streets (note if data unavailable — flag as unknown)
7. Parking/Car Access (note if data unavailable — flag for future data collection)

## Lease Economics Intelligence (BRAIN-COP-02)
When relevant (especially for Manhattan or high-rent areas), reference:
- Lease types: Gross (landlord covers expenses) vs NNN (tenant covers all operating costs)
- Escalation benchmark: 2-3% annual is standard. 3% annual = 34% cumulative by year 10
- TI allowance: $20-$80/SF typical. Free rent: 2-6 months during buildout
- Security deposit: 1-3 months rent. Insurance: $3M liability minimum
- 9 Critical Lease Clauses to warn about: Assignment/Subletting ("not unreasonably withheld"), Renewal (fixed rent, not FMV), Permitted Use (broad language), Escalation (cap at 2-3%), TI Allowance ($20-$80/SF), SNDA (pre-approved by lender), Insurance ($3M not $10M+), Default/Remedies (30-day cure), Restoration (as-is condition)
- NYC Legal Traps: CRT (Manhattan <96th St, +3.9%), no commercial rent stabilization (landlord can demand 50%+ at renewal), personal guaranty (negotiate burn-off 3-5 years or cap 6 months)

## Regulatory Cost Calculator (BRAIN-COP-03)
If CRT_ZONE, BID_ZONE, or ADA_RETROFIT_LIKELY flags are present in Scoring Engine Flags above,
include a "leaseCostBreakdown" section in your response with estimated components:
True Occupancy Cost = base_rent + CRT (3.9% if CRT_ZONE) + BID assessment + insurance + ADA retrofit (amortized)
Affordability benchmark: <8% of gross revenue = viable, 8-10% = marginal, >10% = RED FLAG

## Decision States (BRAIN-COP-04)
The RE² scoring system uses 5 decision states based on Fit IQ:
- STRONG GO (75-100): Location-concept match is compelling
- GO WITH REFINEMENTS (65-74): Viable with specific operational adjustments
- WORTH TESTING (50-64): Proceed only if rent is favorable and concept is differentiated
- HIGH RISK (40-49): Significant structural challenges — requires extraordinary concept or terms
- DO NOT PURSUE (0-39): Location does not support this concept type

Align your conceptFit.score and executiveSummary with the appropriate decision state.

Analyze the data and return ONLY valid JSON with this structure:
{
  "marketTiming": {
    "phase": "emerging|growing|peak|mature|declining",
    "trajectory": "accelerating|steady|slowing|reversing",
    "confidence": 0.0-1.0,
    "reasoning": "2-3 sentences connecting specific data points",
    "signals": ["max 4 specific data-backed signals"],
    "windowOfOpportunity": "1 sentence: when to act"
  },
  "conceptFit": {
    "score": 0-100,
    "grade": "A+ through F",
    "strengths": ["max 3, each must reference data"],
    "weaknesses": ["max 3, each must reference data"],
    "dealBreakers": ["only include if truly fatal — empty array is fine"],
    "oneLineSummary": "1 sentence plain-English verdict",
    "decisionState": "STRONG GO|GO WITH REFINEMENTS|WORTH TESTING|HIGH RISK|DO NOT PURSUE"
  },
  "hiddenRisks": [
    {"risk": "what could go wrong", "severity": "critical|high|medium|low", "likelihood": 0.0-1.0, "dataSource": "which data revealed this", "mitigation": "what to do about it"}
  ],
  "competitiveMoat": {
    "existingCompetitors": number,
    "moatStrength": "strong|moderate|weak|none",
    "primaryAdvantage": "this concept's best competitive angle at this location",
    "vulnerabilities": ["max 3"],
    "recommendation": "1-2 sentences"
  },
  "revenueConfidence": {
    "confidenceLevel": "high|moderate|low|speculative",
    "dataCompleteness": 0.0-1.0,
    "keyAssumptions": ["max 3 critical assumptions"],
    "biggestUnknown": "the one thing that could change everything"
  },
  "leaseCostBreakdown": {
    "include": true/false,
    "crtApplies": true/false,
    "bidZone": "BID name or null",
    "estimatedComponents": [{"component": "CRT (3.9%)", "monthlyEst": "$X", "annualEst": "$Y"}],
    "affordabilityVerdict": "viable|marginal|red_flag|unknown",
    "leaseWarnings": ["critical lease clause warnings"]
  },
  "executiveSummary": "3-4 sentences. Lead with the verdict including decision state. Every sentence must contain a specific number or data point. No fluff."
}

Rules:
- Every claim must trace to specific data from the briefing
- Be contrarian when the data warrants it — don't just confirm positive scores
- If data is missing, say so explicitly and lower confidence
- NYC-specific: reference neighborhoods, subway lines, zoning by name
- Max 3 hidden risks, max 3 deal breakers
- Include leaseCostBreakdown.include=true if CRT_ZONE or BID_ZONE flags are present
- Grade scale: A+ (95+), A (90-94), A- (87-89), B+ (83-86), B (78-82), B- (74-77), C+ (70-73), C (65-69), C- (60-64), D (50-59), F (<50)`;
  try {
    const response = await openrouterFetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_KEY$1}`,
          "HTTP-Referer": "https://resquared.io",
          "X-Title": "RE² Neighborhood Analyst"
        },
        body: JSON.stringify({
          model: SONNET_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: briefing }
          ],
          temperature: 0.4,
          max_tokens: 2e3
        })
      },
      "SonnetAnalyst"
    );
    if (!response) {
      return emptyAnalysis();
    }
    const completion = await response.json();
    const content = completion.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      const analysis = {
        marketTiming: {
          phase: parsed.marketTiming?.phase || "mature",
          trajectory: parsed.marketTiming?.trajectory || "steady",
          confidence: Math.min(1, Math.max(0, parsed.marketTiming?.confidence || 0.5)),
          reasoning: parsed.marketTiming?.reasoning || "",
          signals: (parsed.marketTiming?.signals || []).slice(0, 4),
          windowOfOpportunity: parsed.marketTiming?.windowOfOpportunity || "Unclear"
        },
        conceptFit: {
          score: Math.min(100, Math.max(0, parsed.conceptFit?.score || 50)),
          grade: parsed.conceptFit?.grade || "C",
          strengths: (parsed.conceptFit?.strengths || []).slice(0, 3),
          weaknesses: (parsed.conceptFit?.weaknesses || []).slice(0, 3),
          dealBreakers: (parsed.conceptFit?.dealBreakers || []).slice(0, 3),
          oneLineSummary: parsed.conceptFit?.oneLineSummary || ""
        },
        hiddenRisks: (parsed.hiddenRisks || []).slice(0, 5).map((r) => ({
          risk: r.risk || "",
          severity: r.severity || "medium",
          likelihood: Math.min(1, Math.max(0, r.likelihood || 0.5)),
          dataSource: r.dataSource || "unknown",
          mitigation: r.mitigation || ""
        })),
        competitiveMoat: {
          existingCompetitors: parsed.competitiveMoat?.existingCompetitors || 0,
          moatStrength: parsed.competitiveMoat?.moatStrength || "none",
          primaryAdvantage: parsed.competitiveMoat?.primaryAdvantage || "",
          vulnerabilities: (parsed.competitiveMoat?.vulnerabilities || []).slice(0, 3),
          recommendation: parsed.competitiveMoat?.recommendation || ""
        },
        revenueConfidence: {
          confidenceLevel: parsed.revenueConfidence?.confidenceLevel || "speculative",
          dataCompleteness: Math.min(1, Math.max(0, parsed.revenueConfidence?.dataCompleteness || 0)),
          keyAssumptions: (parsed.revenueConfidence?.keyAssumptions || []).slice(0, 3),
          biggestUnknown: parsed.revenueConfidence?.biggestUnknown || ""
        },
        executiveSummary: parsed.executiveSummary || "Analysis complete.",
        analyzedAt: (/* @__PURE__ */ new Date()).toISOString(),
        model: SONNET_MODEL,
        latencyMs: Date.now() - start
      };
      return analysis;
    } catch {
      console.error("[SonnetAnalyst] JSON parse failed");
      return emptyAnalysis();
    }
  } catch (err) {
    console.error("[SonnetAnalyst] Fetch error:", err);
    return emptyAnalysis();
  }
}
function buildAnalystBriefing(report, reconciled, extrapolated, haikuData) {
  const sections = [];
  sections.push(`# Location Analysis Briefing`);
  sections.push(`Address: ${report.address || `${report.lat}, ${report.lng}`}`);
  sections.push(`Business Type: ${report.businessType}`);
  sections.push(`Data Sources Available: ${report.sourceCoverage?.available || 0}/${report.sourceCoverage?.total || 20}`);
  if (report.census) {
    const c = report.census;
    sections.push(`
## Demographics`);
    sections.push(`Median household income: $${c.medianIncome?.toLocaleString() || "?"}`);
    sections.push(`Population density: ${c.populationDensity?.toLocaleString() || "?"}/sqmi`);
    if (c.medianAge) sections.push(`Median age: ${c.medianAge}`);
    if (c.bachelorsPct) sections.push(`College educated: ${c.bachelorsPct}%`);
  }
  if (report.censusHousing) {
    const h = report.censusHousing;
    if (h.medianRent) sections.push(`Median rent: $${h.medianRent?.toLocaleString()}`);
    if (h.vacancyRate) sections.push(`Vacancy rate: ${h.vacancyRate}%`);
  }
  sections.push(`
## Transit & Foot Traffic`);
  if (report.walkScore) {
    const ws = report.walkScore;
    sections.push(`Walk Score: ${ws.walkscore || "?"}, Transit: ${ws.transit?.score || "?"}, Bike: ${ws.bike?.score || "?"}`);
  }
  if (report.mtaRidership?.stations?.length) {
    report.mtaRidership.stations.slice(0, 3).forEach((s) => {
      sections.push(`Subway: ${s.stationName} — ${s.avgDailyRidership?.toLocaleString() || "?"} daily riders`);
    });
  }
  if (report.pedestrian?.counts?.length) {
    const p = report.pedestrian.counts[0];
    sections.push(`Pedestrian count: ${p.count?.toLocaleString() || "?"} (${p.location || "nearby"})`);
  }
  sections.push(`
## Competition`);
  if (reconciled) {
    sections.push(`Unique entities (deduplicated): ${reconciled.totalEntities}`);
    sections.push(`Cross-source conflicts resolved: ${reconciled.conflictsResolved}`);
  }
  if (report.places?.results?.length) {
    sections.push(`Google Places competitors: ${report.places.results.length}`);
    const avgRating = report.places.results.reduce((s, p) => s + (p.rating || 0), 0) / report.places.results.length;
    sections.push(`Average competitor rating: ${avgRating.toFixed(1)}/5`);
  }
  if (report.yelp?.businesses?.length) {
    sections.push(`Yelp businesses: ${report.yelp.businesses.length}`);
    const priceDist = report.yelp.businesses.reduce((acc, b) => {
      const p = b.price || "?";
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});
    sections.push(`Price distribution: ${JSON.stringify(priceDist)}`);
  }
  if (report.marketDensity?.categories?.length) {
    sections.push(`
## Market Ecosystem (500m)`);
    report.marketDensity.categories.forEach((c) => {
      sections.push(`${c.category}: ${c.count}`);
    });
  }
  sections.push(`
## Safety & Quality of Life`);
  if (report.crime) {
    const cr = report.crime;
    sections.push(`Crime incidents (500m): ${cr.totalIncidents || cr.total || "?"}`);
  }
  if (report.complaints311) {
    const c311 = report.complaints311;
    sections.push(`311 complaints: ${c311.total || c311.complaints?.length || "?"}`);
  }
  if (report.dob) {
    const dob = report.dob;
    sections.push(`DOB violations: ${dob.violations?.length || dob.totalViolations || "?"}`);
    sections.push(`Active permits: ${dob.permits?.length || dob.totalPermits || "?"}`);
  }
  sections.push(`
## Vibrancy`);
  if (report.sidewalkCafes) {
    const sc = report.sidewalkCafes;
    sections.push(`Sidewalk café permits: ${sc.total || sc.permits?.length || 0}`);
  }
  if (report.liquorLicenses) {
    const ll = report.liquorLicenses;
    sections.push(`Liquor licenses: ${ll.total || ll.licenses?.length || 0}`);
  }
  if (report.dcaLicenses) {
    const d = report.dcaLicenses;
    sections.push(`Active business licenses: ${d.totalActive || d.total || "?"}`);
    if (d.newBusinessRate) sections.push(`New business rate: ${d.newBusinessRate}%`);
  }
  if (report.pluto) {
    const pl = report.pluto;
    sections.push(`
## Zoning`);
    if (pl.zoneDistrict || pl.zone) sections.push(`Zone: ${pl.zoneDistrict || pl.zone}`);
    if (pl.buildingClass) sections.push(`Building class: ${pl.buildingClass}`);
    if (pl.far) sections.push(`FAR: ${pl.far}`);
  }
  if (report.momentum) {
    const m = report.momentum;
    sections.push(`
## Momentum`);
    if (m.signals?.length) {
      m.signals.slice(0, 5).forEach((s) => {
        sections.push(`- ${s.description || s.signal}: ${s.direction || s.trend || "?"}`);
      });
    }
  }
  if (extrapolated.extrapolations.length > 0) {
    sections.push(`
## Deterministic Extrapolations (Layer 3)`);
    extrapolated.extrapolations.slice(0, 8).forEach((e) => {
      sections.push(`- [${e.category}] ${e.title}: ${e.interpretation} (confidence: ${(e.confidence * 100).toFixed(0)}%, sentiment: ${e.sentiment})`);
    });
  }
  if (haikuData && haikuData.model !== "none") {
    sections.push(`
## Haiku AI Extraction Results`);
    if (haikuData.competitorFreshness.length) {
      sections.push(`Competitor freshness:`);
      haikuData.competitorFreshness.forEach((c) => {
        sections.push(`- ${c.name}: ${c.estimatedAge} (confidence: ${c.confidence})`);
      });
    }
    if (haikuData.conceptGaps.length) {
      sections.push(`Concept gaps identified:`);
      haikuData.conceptGaps.forEach((g) => {
        sections.push(`- Missing: ${g.missingType} — ${g.reasoning}`);
      });
    }
    if (haikuData.pricePositioning) {
      sections.push(`Price positioning: avg level ${haikuData.pricePositioning.areaAvgPriceLevel}, opening for ${haikuData.pricePositioning.openingFor}`);
    }
    if (haikuData.footTrafficPatterns.length) {
      sections.push(`Foot traffic patterns:`);
      haikuData.footTrafficPatterns.forEach((f) => {
        sections.push(`- ${f.timeSlot}: ${f.intensity} (${f.primaryDrivers.join(", ")})`);
      });
    }
  }
  return sections.join("\n");
}
const OPENROUTER_KEY = private_env?.OPENROUTER_API_KEY || "";
const HAIKU_MODEL = "anthropic/claude-haiku-4.5";
function runDeterministicChecks(report, businessType) {
  const issues = [];
  if (report.walkScore && report.pedestrian) {
    const walkScore = report.walkScore.walkscore;
    const pedCount = report.pedestrian.nearestCount?.avgDaily || 0;
    if (walkScore >= 80 && pedCount > 0 && pedCount < 500) {
      issues.push({
        severity: "warning",
        category: "contradiction",
        source1: "Walk Score",
        source2: "NYC Pedestrian Counts",
        field: "walkability vs foot traffic",
        description: `Walk Score is ${walkScore} (very walkable) but nearest pedestrian count is only ${pedCount}/day`,
        userMessage: `This area has a high walkability score (${walkScore}) but relatively low measured foot traffic. The block may be walkable but not heavily trafficked — important for businesses relying on walk-in customers.`
      });
    }
    if (walkScore < 50 && pedCount > 1e4) {
      issues.push({
        severity: "warning",
        category: "contradiction",
        source1: "Walk Score",
        source2: "NYC Pedestrian Counts",
        field: "walkability vs foot traffic",
        description: `Walk Score is ${walkScore} (car-dependent) but pedestrian count is ${pedCount}/day`,
        userMessage: `Walk Score rates this area low (${walkScore}) but pedestrian data shows high foot traffic (${pedCount.toLocaleString()}/day). The foot traffic may be transit-driven rather than neighborhood walkability.`
      });
    }
  }
  if (report.census && report.censusHousing) {
    const medianIncome = report.census.medianIncome;
    const medianRent = report.censusHousing.medianRent;
    if (medianIncome && medianRent) {
      const rentToIncomeRatio = medianRent * 12 / medianIncome;
      if (rentToIncomeRatio > 0.5) {
        issues.push({
          severity: "info",
          category: "suspicious_pattern",
          source1: "Census Demographics",
          source2: "Census Housing",
          field: "income vs rent ratio",
          description: `Median rent ($${medianRent}/mo) is ${Math.round(rentToIncomeRatio * 100)}% of median income ($${medianIncome}/yr)`,
          userMessage: `Housing costs in this area take up ${Math.round(rentToIncomeRatio * 100)}% of median income — this could mean residents are cost-burdened, which may affect their discretionary spending at local businesses.`
        });
      }
    }
  }
  if (report.crime && report.walkScore) {
    const totalIncidents = report.crime.totalIncidents;
    const walkScore = report.walkScore.walkscore;
    if (walkScore >= 85 && totalIncidents > 50) {
      issues.push({
        severity: "warning",
        category: "contradiction",
        source1: "Walk Score",
        source2: "NYPD Crime Data",
        field: "walkability vs crime",
        description: `Walk Score ${walkScore} suggests a great walking neighborhood, but ${totalIncidents} recent crime incidents nearby`,
        userMessage: `While this area scores high for walkability (${walkScore}), there are ${totalIncidents} recent crime incidents in the area. High-traffic neighborhoods can have both high walkability and higher incident counts — consider the types of crimes, not just the count.`
      });
    }
  }
  if (report.competitors && report.competitors.totalCount === 0 && report.places) {
    const placesCount = report.places.results?.length || 0;
    if (placesCount > 5) {
      issues.push({
        severity: "warning",
        category: "contradiction",
        source1: "Competitor Scan (Overpass)",
        source2: "Google Places",
        field: "competitor count",
        description: `Competitor scan found 0 businesses but Google Places found ${placesCount} nearby`,
        userMessage: `Our competitor scan came up empty, but Google shows ${placesCount} businesses nearby. The competitor data may be incomplete — we'll use Google Places and Foursquare data to fill the gap.`
      });
    }
  }
  if (report.census) {
    if (report.census.totalPopulation !== void 0 && report.census.totalPopulation < 100) {
      issues.push({
        severity: "warning",
        category: "implausible",
        source1: "Census Demographics",
        field: "total population",
        description: `Census reports only ${report.census.totalPopulation} people in this tract`,
        userMessage: `The Census data shows very few residents (${report.census.totalPopulation}) in this area. This could mean the area is primarily commercial/industrial, or the Census tract boundary doesn't align well with the neighborhood. Foot traffic may come from workers and visitors, not residents.`
      });
    }
    if (report.census.medianIncome && report.census.medianIncome < 1e4) {
      issues.push({
        severity: "critical",
        category: "implausible",
        source1: "Census Demographics",
        field: "median income",
        description: `Median income reported as $${report.census.medianIncome} — likely a data error or institutional housing`,
        userMessage: `The reported median income ($${report.census.medianIncome?.toLocaleString()}) is unusually low. This Census tract may include institutional housing (dorms, shelters) that skews the data. Take income-based projections with extra caution here.`
      });
    }
  }
  if (report.mtaRidership) {
    const stations = report.mtaRidership.stations || [];
    const hasStations = stations.length > 0;
    const allZeroRidership = hasStations && stations.every((s) => (s.avgDailyRidership || 0) === 0);
    if (allZeroRidership) {
      issues.push({
        severity: "warning",
        category: "stale",
        source1: "MTA Ridership",
        field: "daily ridership",
        description: `Found ${stations.length} subway station(s) but all report 0 daily ridership`,
        userMessage: `We found nearby subway stations but couldn't get ridership numbers. The MTA data may be temporarily unavailable. Transit access exists, but we can't quantify how busy these stations are right now.`
      });
    }
  }
  if (report.foursquare && report.yelp && report.places) {
    const fsqAvg = report.foursquare.avgRating;
    const yelpAvg = report.yelp.avgRating;
    const googleAvg = report.places.avgRating;
    if (fsqAvg && yelpAvg && googleAvg) {
      const normalizedFsq = fsqAvg > 5 ? fsqAvg / 2 : fsqAvg;
      const ratings = [normalizedFsq, yelpAvg, googleAvg].filter((r) => r > 0);
      if (ratings.length >= 2) {
        const spread = Math.max(...ratings) - Math.min(...ratings);
        if (spread > 1.5) {
          issues.push({
            severity: "info",
            category: "contradiction",
            source1: "Foursquare/Yelp/Google",
            field: "average ratings",
            description: `Ratings spread of ${spread.toFixed(1)} across sources (Foursquare: ${normalizedFsq.toFixed(1)}, Yelp: ${yelpAvg.toFixed(1)}, Google: ${googleAvg.toFixed(1)})`,
            userMessage: `Business ratings in this area vary significantly across platforms. This is normal — different platforms attract different audiences. We use a weighted average (Yelp 40%, Google 35%, Foursquare 25%) for our scoring.`
          });
        }
      }
    }
  }
  return issues;
}
function buildQualityCheckPrompt(report, businessType) {
  const snapshot = {};
  if (report.census) {
    snapshot.census = {
      population: report.census.totalPopulation,
      medianIncome: report.census.medianIncome,
      medianAge: report.census.medianAge,
      bachelorsPct: report.census.educationBachelorsPlus
    };
  }
  if (report.censusHousing) {
    snapshot.housing = {
      medianRent: report.censusHousing.medianRent,
      vacancyRate: report.censusHousing.vacancyRate,
      renterPct: report.censusHousing.renterOccupiedPct
    };
  }
  if (report.walkScore) {
    snapshot.walkScore = {
      walk: report.walkScore.walkscore,
      transit: report.walkScore.transit?.score,
      bike: report.walkScore.bike?.score
    };
  }
  if (report.crime) {
    snapshot.crime = {
      total: report.crime.totalIncidents,
      topTypes: report.crime.topOffenses?.slice(0, 3)
    };
  }
  if (report.pedestrian) {
    snapshot.pedestrian = {
      nearestDaily: report.pedestrian.nearestCount?.avgDaily,
      avgAreaDaily: report.pedestrian.avgDailyCount
    };
  }
  if (report.mtaRidership) {
    snapshot.transit = {
      stationCount: report.mtaRidership.stations?.length,
      nearestStation: report.mtaRidership.stations?.[0]?.stationName,
      nearestRidership: report.mtaRidership.stations?.[0]?.avgDailyRidership
    };
  }
  if (report.competitors) {
    snapshot.competitors = {
      total: report.competitors.totalCount,
      directCompetitors: report.competitors.directCompetitors
    };
  }
  if (report.foursquare) {
    snapshot.foursquare = {
      venueCount: report.foursquare.totalResults,
      avgRating: report.foursquare.avgRating,
      avgPrice: report.foursquare.avgPriceLevel
    };
  }
  if (report.yelp) {
    snapshot.yelp = {
      businessCount: report.yelp.totalResults,
      avgRating: report.yelp.avgRating,
      avgPrice: report.yelp.avgPriceLevel
    };
  }
  if (report.pluto) {
    snapshot.zoning = {
      primaryZone: report.pluto.zoneProfile?.primaryZone,
      buildingClass: report.pluto.buildingProfile?.primaryClass
    };
  }
  snapshot.sourceCoverage = report.sourceCoverage;
  snapshot.errors = report.errors.slice(0, 10);
  return `You are a data quality auditor for a commercial real estate intelligence platform.

You have been given a snapshot of data from ${report.sourceCoverage?.available || "?"} out of 20 API sources for a location in NYC that a ${businessType} business is evaluating.

Your job: Find CONTRADICTIONS, IMPLAUSIBLE values, and SUSPICIOUS PATTERNS in this data that could lead to a bad scoring decision.

DATA SNAPSHOT:
${JSON.stringify(snapshot, null, 2)}

ADDRESS: ${report.address || "Unknown"}

Respond with a JSON array of issues found. Each issue:
{
  "severity": "critical" | "warning" | "info",
  "category": "contradiction" | "implausible" | "suspicious_pattern",
  "field": "which data field(s)",
  "sources": "which source(s) are involved",
  "description": "what's wrong (technical)",
  "userMessage": "what the business owner should know (plain English, 1-2 sentences)"
}

Rules:
- Only flag things that could actually affect a business decision
- Don't flag normal urban patterns (high crime + high foot traffic is normal in busy areas)
- "implausible" = the number doesn't make sense (e.g., median income of $3,000 in Manhattan)
- "contradiction" = two sources disagree in a way that matters
- "suspicious_pattern" = not wrong per se, but worth flagging (e.g., zero vacancy in a high-rent area)
- If the data looks clean and consistent, return an empty array []
- Maximum 5 issues. Only the most important.

Respond with ONLY the JSON array, no other text.`;
}
async function runLLMCheck(report, businessType, historicalContextPrompt) {
  if (!OPENROUTER_KEY) return [];
  try {
    const basePrompt = buildQualityCheckPrompt(report, businessType);
    const fullPrompt = historicalContextPrompt ? `${basePrompt}

---
${historicalContextPrompt}` : basePrompt;
    const response = await openrouterFetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://resquared.io",
          "X-Title": "RE2 Quality Gate"
        },
        body: JSON.stringify({
          model: HAIKU_MODEL,
          messages: [
            { role: "user", content: fullPrompt }
          ],
          temperature: 0.1,
          max_tokens: 1500
        })
      },
      "QualityGate"
    );
    if (!response) {
      return [];
    }
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content?.trim();
    if (!content) return [];
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 5).map((issue) => ({
      severity: ["critical", "warning", "info"].includes(issue.severity) ? issue.severity : "info",
      category: ["contradiction", "implausible", "suspicious_pattern", "missing_critical", "stale"].includes(issue.category) ? issue.category : "suspicious_pattern",
      source1: issue.sources || "Multiple sources",
      field: issue.field || "unknown",
      description: issue.description || "",
      userMessage: issue.userMessage || issue.description || ""
    }));
  } catch (err) {
    console.error("[QualityGate] Haiku check failed (non-blocking):", err);
    return [];
  }
}
async function lookupHistoricalContext(geohash5) {
  try {
    const result = await db.execute(sql`
			SELECT id, neighborhood, infrastructure, impact_type, description, current_relevance, scoring_notes
			FROM historical_ground_truths
			WHERE active = true AND geohash_prefix @> ARRAY[${geohash5}]::text[]
		`);
    if (!result.rows || result.rows.length === 0) return [];
    return result.rows;
  } catch {
    return [];
  }
}
function buildHistoricalContextPrompt(entries, flaggedSubScores = []) {
  if (!entries || entries.length === 0) return null;
  const lines = entries.map((entry) => {
    const relevantNotes = flaggedSubScores.length > 0 && entry.scoring_notes ? Object.entries(entry.scoring_notes).filter(([k]) => flaggedSubScores.some((f) => k.includes(f.split("_")[0].toLowerCase()))).map(([, v]) => String(v)).join("; ") : "";
    return `- ${entry.neighborhood}: ${entry.infrastructure} (${entry.impact_type})${relevantNotes ? "\n  Note: " + relevantNotes : ""}`;
  });
  return `Historical structural factors for this location:
${lines.join("\n")}
Consider whether flagged score divergence is explained by these structural factors.`;
}
async function runDataQualityGate(report, businessType = "cafe", geohash5) {
  const start = Date.now();
  const confidence = computeConfidence(report, businessType);
  const deterministicIssues = runDeterministicChecks(report);
  let llmIssues = [];
  let llmCheckRan = false;
  try {
    const historicalEntries = geohash5 ? await lookupHistoricalContext(geohash5) : [];
    const historicalPrompt = historicalEntries.length > 0 ? buildHistoricalContextPrompt(historicalEntries, []) : null;
    llmIssues = await runLLMCheck(report, businessType, historicalPrompt);
    llmCheckRan = llmIssues.length >= 0;
    llmCheckRan = true;
  } catch {
  }
  const allIssues = deduplicateIssues([...deterministicIssues, ...llmIssues]);
  const criticalCount = allIssues.filter((i) => i.severity === "critical").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;
  const infoCount = allIssues.filter((i) => i.severity === "info").length;
  const grade = calculateGrade(confidence, criticalCount, warningCount);
  let action;
  if (grade === "F" || confidence.level === "PRELIMINARY" && criticalCount >= 2) {
    action = "gate";
  } else if (grade === "D" || criticalCount > 0 || warningCount >= 3) {
    action = "proceed_with_warnings";
  } else {
    action = "proceed";
  }
  const summary = generateSummary(grade, action, confidence, allIssues);
  return {
    grade,
    action,
    confidence,
    issues: allIssues,
    criticalCount,
    warningCount,
    infoCount,
    summary,
    llmCheckRan,
    latencyMs: Date.now() - start
  };
}
function calculateGrade(confidence, criticalCount, warningCount) {
  let score = confidence.percentage;
  score -= criticalCount * 15;
  score -= warningCount * 5;
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 35) return "D";
  return "F";
}
function deduplicateIssues(issues) {
  const seen = /* @__PURE__ */ new Set();
  return issues.filter((issue) => {
    const key = `${issue.category}:${issue.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function generateSummary(grade, action, confidence, issues) {
  const criticals = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");
  if (action === "gate") {
    return `Data quality is too low to produce a reliable score (Grade ${grade}). ${confidence.criticalMissing.length > 0 ? `Missing critical data: ${confidence.criticalMissing.join(", ")}.` : ""} ${criticals.length > 0 ? `Found ${criticals.length} critical issue(s) that could lead to misleading results.` : ""} We recommend trying a nearby address or checking back later when more data sources are available.`;
  }
  if (action === "proceed_with_warnings") {
    const topIssue = criticals[0] || warnings[0];
    return `Data quality is ${grade === "C" ? "acceptable" : "limited"} (Grade ${grade}, ${confidence.percentage}% coverage). ${topIssue ? topIssue.userMessage : ""} ${warnings.length > 1 ? `Plus ${warnings.length - 1} other data note(s) — see details below.` : ""} Your score is directionally useful but should be validated with a site visit.`;
  }
  if (issues.length === 0) {
    return `Excellent data quality (Grade ${grade}, ${confidence.percentage}% coverage). All sources are consistent and no red flags detected.`;
  }
  return `Good data quality (Grade ${grade}, ${confidence.percentage}% coverage) with ${issues.length} minor note(s). Your score is reliable for decision-making.`;
}
export {
  computeScoreAgreement as a,
  analyzeNeighborhood as b,
  computeConfidence as c,
  extractWithHaiku as e,
  lookupHistoricalContext as l,
  runDataQualityGate as r
};
