import { c as clamp } from "./geo-math.js";
import { s as scoreToGrade } from "./primitives.js";
import { n as normalizeBusinessType, B as BUSINESS_TYPE_CONFIGS } from "./business-type-registry.js";
function getConceptScanRadius(bizCategory) {
  const canonical = normalizeBusinessType(bizCategory);
  return BUSINESS_TYPE_CONFIGS[canonical]?.tradeRadiusM || 800;
}
function resolveConceptType(businessType, businessSubType) {
  return normalizeBusinessType(businessType);
}
function computeSixIndex(report, businessType, precomputed, visionTier, avgTicket, historicalImpactTypes) {
  return {
    locationIQ: 50,
    grade: "C",
    indices: {},
    conceptType: businessType,
    conceptLabel: businessType,
    archetype: "impulse",
    signals: [],
    sourcesPerIndex: {}
  };
}
function computeDynamicVisionIQ(indexScores, config) {
  const transit = indexScores.transit ?? indexScores.dailyRitualDensity ?? 50;
  const demographics = indexScores.demographics ?? indexScores.spendVibrancy ?? 50;
  const competition = indexScores.competition ?? indexScores.coffeeCompetition ?? 50;
  const vibrancy = indexScores.vibrancy ?? indexScores.blockActivity ?? 50;
  const safety = indexScores.safety ?? indexScores.streetSafety ?? 50;
  const momentum = indexScores.momentum ?? indexScores.marketTrajectory ?? 50;
  const neighborhoodHealth = indexScores.neighborhoodHealth ?? 50;
  const survivalRate = indexScores.survivalRate ?? 50;
  const transitW = 0.04 + config.transitDependency * 0.1;
  const vibrancyW = 0.02 + config.footTrafficDependency * 0.07;
  const compSensitivity = Math.max(0, 1 - config.saturationThreshold / 20);
  const competitionW = 0.04 + compSensitivity * 0.1;
  const incomeSensitivity = Math.max(0, Math.min(1, (config.incomeSweet - 5e4) / 9e4));
  const demographicsW = 0.02 + incomeSensitivity * 0.06;
  const safetyW = 0.01;
  const momentumW = 0.02;
  const allocatedW = transitW + vibrancyW + competitionW + demographicsW + safetyW + momentumW;
  const remainingW = Math.max(0.5, 1 - allocatedW);
  const nhW = remainingW * 0.37;
  const srW = remainingW * 0.63;
  const weights = {
    transit: transitW,
    demographics: demographicsW,
    competition: competitionW,
    vibrancy: vibrancyW,
    safety: safetyW,
    momentum: momentumW,
    neighborhoodHealth: nhW,
    survivalRate: srW
  };
  const raw = transit * transitW + demographics * demographicsW + competition * competitionW + vibrancy * vibrancyW + safety * safetyW + momentum * momentumW + neighborhoodHealth * nhW + survivalRate * srW;
  const totalW = Object.values(weights).reduce((a, b) => a + b, 0);
  const normalized = totalW > 0 ? raw / totalW * 100 : raw;
  const score = clamp(Math.round(normalized));
  const components = {
    transit: Math.round(transit * transitW * 100) / 100,
    demographics: Math.round(demographics * demographicsW * 100) / 100,
    competition: Math.round(competition * competitionW * 100) / 100,
    vibrancy: Math.round(vibrancy * vibrancyW * 100) / 100,
    safety: Math.round(safety * safetyW * 100) / 100,
    momentum: Math.round(momentum * momentumW * 100) / 100,
    neighborhoodHealth: Math.round(neighborhoodHealth * nhW * 100) / 100,
    survivalRate: Math.round(survivalRate * srW * 100) / 100
  };
  return {
    score,
    grade: scoreToGrade(score),
    weights,
    components,
    archetype: config.archetype
  };
}
export {
  computeSixIndex as a,
  computeDynamicVisionIQ as c,
  getConceptScanRadius as g,
  resolveConceptType as r
};
