import { g as getBenchmark } from "../../../../../chunks/industry-benchmarks.js";
import { r as requireAuth } from "../../../../../chunks/auth-middleware.js";
function sigmoid(x) {
  return 100 / (1 + Math.exp(-1.5 * x));
}
function normalize(score) {
  return (score - 50) / 25;
}
function computeOverallProbability(inputs, bench) {
  const w_loc = 0.35;
  const w_fit = 0.35;
  const w_fin = 0.2;
  const w_arch = 0.1;
  let weightedSum = 0;
  weightedSum += w_loc * normalize(inputs.locationIQ);
  weightedSum += w_fit * normalize(inputs.fitIQ);
  if (inputs.breakEvenCushion !== void 0) {
    const finScore = Math.max(0, Math.min(100, 50 + inputs.breakEvenCushion));
    weightedSum += w_fin * normalize(finScore);
  } else {
    weightedSum += w_fin * normalize(inputs.locationIQ * 0.8);
  }
  if (inputs.archetypeScore !== void 0) {
    weightedSum += w_arch * normalize(inputs.archetypeScore);
  } else {
    weightedSum += w_arch * normalize((inputs.locationIQ + inputs.fitIQ) / 2);
  }
  if (inputs.rentToRevenueRatio !== void 0 && inputs.rentToRevenueRatio > 0.15) {
    const penalty = (inputs.rentToRevenueRatio - 0.1) * 5;
    weightedSum -= Math.min(0.8, penalty);
  }
  return Math.round(sigmoid(weightedSum));
}
function computeMetricProbabilities(inputs, bench) {
  const metrics = [];
  {
    let score = inputs.locationIQ;
    let dataPoints = 1;
    if (inputs.sixIndex?.transit !== void 0) {
      score = score * 0.5 + inputs.sixIndex.transit * 0.5 * bench.transitWeight + inputs.sixIndex.transit * 0.5 * (1 - bench.transitWeight);
      dataPoints++;
    }
    if (inputs.archetypeScore !== void 0 && bench.footTrafficWeight > 0.5) {
      score = score * 0.7 + inputs.archetypeScore * 0.3;
      dataPoints++;
    }
    const prob = Math.round(sigmoid(normalize(score)));
    metrics.push({
      label: "Foot Traffic Adequacy",
      probability: prob,
      weight: bench.footTrafficWeight,
      dataPoints,
      explanation: prob > 65 ? "Location has strong foot traffic patterns for your business type" : prob > 45 ? "Foot traffic is moderate — you may need to build destination draw" : "Low foot traffic zone — heavy reliance on marketing and destination traffic"
    });
  }
  {
    let score = 50;
    let dataPoints = 0;
    if (inputs.sixIndex?.competition !== void 0) {
      score = inputs.sixIndex.competition;
      dataPoints++;
    }
    const fitCompDim = inputs.fitDimensions?.find((d) => d.label.toLowerCase().includes("competition"));
    if (fitCompDim) {
      score = dataPoints > 0 ? score * 0.5 + fitCompDim.score * 0.5 : fitCompDim.score;
      dataPoints++;
    }
    if (dataPoints === 0) {
      score = inputs.fitIQ;
      dataPoints = 1;
    }
    const prob = Math.round(sigmoid(normalize(score)));
    metrics.push({
      label: "Competitive Survival",
      probability: prob,
      weight: bench.competitionSensitivity,
      dataPoints,
      explanation: prob > 65 ? "Competitive landscape is favorable — room for a new entrant" : prob > 45 ? "Moderate competition — differentiation will be key" : "Highly competitive area — strong concept and execution required"
    });
  }
  {
    let score = (inputs.locationIQ + inputs.fitIQ) / 2;
    let dataPoints = 2;
    if (inputs.breakEvenCushion !== void 0) {
      score = Math.max(0, Math.min(100, 50 + inputs.breakEvenCushion));
      dataPoints++;
    }
    if (inputs.rentToRevenueRatio !== void 0) {
      const rentScore = inputs.rentToRevenueRatio < 0.08 ? 80 : inputs.rentToRevenueRatio < 0.12 ? 60 : inputs.rentToRevenueRatio < 0.15 ? 40 : 20;
      score = score * 0.6 + rentScore * 0.4;
      dataPoints++;
    }
    const prob = Math.round(sigmoid(normalize(score)));
    metrics.push({
      label: "Financial Viability",
      probability: prob,
      weight: 0.9,
      // Always critical
      dataPoints,
      explanation: prob > 65 ? "Numbers look healthy — projected to be above break-even" : prob > 45 ? "Tight margins — careful cost management will be essential" : "Financial risk is elevated — revisit rent, pricing, or customer volume assumptions"
    });
  }
  {
    let score = 50;
    let dataPoints = 0;
    if (inputs.sixIndex?.demographics !== void 0) {
      score = inputs.sixIndex.demographics;
      dataPoints++;
    }
    const fitDemDim = inputs.fitDimensions?.find((d) => d.label.toLowerCase().includes("demographic") || d.label.toLowerCase().includes("income"));
    if (fitDemDim) {
      score = dataPoints > 0 ? score * 0.5 + fitDemDim.score * 0.5 : fitDemDim.score;
      dataPoints++;
    }
    if (dataPoints === 0) {
      score = inputs.fitIQ;
      dataPoints = 1;
    }
    const prob = Math.round(sigmoid(normalize(score)));
    metrics.push({
      label: "Demographic Alignment",
      probability: prob,
      weight: bench.demographicsWeight,
      dataPoints,
      explanation: prob > 65 ? "Local demographics match your target customer profile well" : prob > 45 ? "Partial demographic match — some customer segments align, others do not" : "Demographic mismatch — your target customer is underrepresented in this area"
    });
  }
  {
    let score = 70;
    let dataPoints = 0;
    if (inputs.sixIndex?.safety !== void 0) {
      score = inputs.sixIndex.safety;
      dataPoints++;
    }
    if (inputs.sixIndex?.momentum !== void 0) {
      score = score * 0.7 + inputs.sixIndex.momentum * 0.3;
      dataPoints++;
    }
    if (dataPoints === 0) {
      dataPoints = 1;
    }
    const prob = Math.round(sigmoid(normalize(score)));
    metrics.push({
      label: "Safety & Stability",
      probability: prob,
      weight: 0.5,
      dataPoints,
      explanation: prob > 65 ? "Area is safe and stable — low risk of disruption" : prob > 45 ? "Some safety or stability concerns — factor into insurance and security planning" : "Higher risk area — budget for security measures and higher insurance"
    });
  }
  return metrics;
}
function computeRiskTier(probability) {
  if (probability >= 70) return "low";
  if (probability >= 50) return "medium";
  if (probability >= 35) return "high";
  return "very-high";
}
function computeConfidence(inputs) {
  let signals = 2;
  let totalSignals = 10;
  if (inputs.sixIndex) {
    const six = inputs.sixIndex;
    if (six.transit !== void 0) signals++;
    if (six.demographics !== void 0) signals++;
    if (six.competition !== void 0) signals++;
    if (six.vibrancy !== void 0) signals++;
    if (six.safety !== void 0) signals++;
    if (six.momentum !== void 0) signals++;
  }
  if (inputs.fitDimensions?.length) signals++;
  if (inputs.breakEvenCushion !== void 0) signals++;
  if (inputs.rentToRevenueRatio !== void 0) signals++;
  if (inputs.archetypeScore !== void 0) signals++;
  return Math.round(signals / totalSignals * 100);
}
function generateSummary(probability, riskTier, businessType, locationIQ, fitIQ) {
  const alignment = fitIQ - locationIQ;
  const alignmentNote = Math.abs(alignment) < 5 ? "Your business concept aligns well with the general location quality." : alignment > 0 ? `Your specific concept scores ${alignment} points above the general location quality — this spot is a better fit for you than for most businesses.` : `Your concept scores ${Math.abs(alignment)} points below the general location quality — this location works better for other business types than yours.`;
  if (probability >= 70) {
    return `Strong match. With a ${probability}% estimated success probability, this location shows real promise for a ${businessType} business. ${alignmentNote}`;
  } else if (probability >= 50) {
    return `Moderate match. At ${probability}%, this location could work for a ${businessType} business, but success depends on execution and differentiation. ${alignmentNote}`;
  } else if (probability >= 35) {
    return `Challenging match. A ${probability}% probability means this location has meaningful headwinds for a ${businessType} business. Consider alternatives or plan for higher marketing spend. ${alignmentNote}`;
  } else {
    return `Difficult match. At ${probability}%, the data suggests significant challenges for a ${businessType} here. We recommend exploring other locations unless you have a compelling reason to be in this specific spot. ${alignmentNote}`;
  }
}
function computeProbability(inputs) {
  const bench = getBenchmark(inputs.businessType);
  const overallSuccess = computeOverallProbability(inputs);
  const metrics = computeMetricProbabilities(inputs, bench);
  const confidence = computeConfidence(inputs);
  const riskTier = computeRiskTier(overallSuccess);
  const summary = generateSummary(overallSuccess, riskTier, inputs.businessType, inputs.locationIQ, inputs.fitIQ);
  return {
    overallSuccess,
    metrics,
    confidence,
    riskTier,
    summary
  };
}
const POST = async ({ request }) => {
  const auth = await requireAuth(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await request.json();
    if (body.locationIQ === void 0 || body.fitIQ === void 0 || !body.businessType) {
      return new Response(JSON.stringify({
        error: "Required: locationIQ (0-100), fitIQ (0-100), businessType (string)"
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const startMs = Date.now();
    const result = computeProbability(body);
    return new Response(JSON.stringify({
      ...result,
      _meta: {
        businessType: body.businessType,
        locationIQ: body.locationIQ,
        fitIQ: body.fitIQ,
        durationMs: Date.now() - startMs
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("[Probability] Error:", err);
    return new Response(JSON.stringify({
      error: "Probability computation failed",
      message: err instanceof Error ? err.message : "Unknown error"
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
export {
  POST
};
