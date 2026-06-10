import { s as scoreToGrade$1 } from "./primitives.js";
import { d as detectBorough, g as getBoroughTransitFloor } from "./borough-bounds.js";
import { d as TRANSIT_THRESHOLDS } from "./scoring-thresholds.js";
import { R as RULES } from "./vital-rules.js";
import { B as BUSINESS_TYPE_CONFIGS, n as normalizeBusinessType } from "./business-type-registry.js";
const IMPACT_TYPE_PRIORS = {
  destroyed_commercial_corridor: {
    multipliers: {
      vibrancy: 0.7,
      // API data may miss structural damage
      safety: 0.8,
      momentum: 0.8
      // signals may be gentrification, not organic growth
    },
    notes: [
      "Vibrancy API data may not reflect structural corridor severance.",
      "Momentum signals should be interpreted as potential recovery, not current vitality."
    ]
  },
  isolated_neighborhood: {
    multipliers: {
      vibrancy: 0.6,
      // destination vibrancy ≠ daily foot traffic
      transit: 1.4,
      // transit MORE predictive in isolated areas (absence is critical)
      accessibility: 1.3
    },
    notes: [
      "Neighborhood is structurally isolated — transit absence is more punishing than average.",
      "Vibrancy from destination venues (breweries, art spaces) does not generate daily foot traffic."
    ]
  },
  destroyed_organic_commercial_fabric: {
    multipliers: {
      demographics: 0.6,
      // Census may lag rapid change
      competition: 0.7,
      momentum: 0.9
    },
    notes: [
      "Census demographics may lag 2-3 years behind actual neighborhood composition change.",
      "Competition data may not reflect the pre-displacement commercial mix."
    ]
  },
  systemic_pattern: {
    multipliers: {
      transit: 1.3
      // PB-015: subway proximity even MORE predictive citywide
    },
    notes: [
      "Pre-1940 subway proximity is the strongest predictor of walkable commercial viability.",
      "Block groups near original IRT/BMT/IND stations have 40% higher commercial viability baseline."
    ]
  },
  rapid_gentrification: {
    multipliers: {
      vibrancy: 1.1,
      competition: 1.1,
      // Competition is real and intense
      demographics: 0.9
      // Demographics shifting — census may be 2 years stale
    },
    notes: [
      "Rapid gentrification area — census income data may understate current demographic.",
      "Competition is intense and growing. Saturation risks are real."
    ]
  },
  institutional_anchor: {
    multipliers: {
      demographics: 0.8,
      // Student population inflates density, deflates income
      vibrancy: 0.9
      // Academic calendar creates seasonal dead zones
    },
    notes: [
      "Institutional anchor creates seasonal demand patterns — summer dead zones.",
      "Student demographics distort income scoring — actual discretionary spend lower than HHI suggests."
    ]
  },
  transit_hub_effect: {
    multipliers: {
      accessibility: 1.2,
      vibrancy: 0.8
      // Transit-transient foot traffic ≠ neighborhood vibrancy
    },
    notes: [
      "Transit hub generates high foot traffic counts but mostly transient commuters.",
      "Grab-and-go and commuter-serving concepts outperform destination retail here."
    ]
  },
  commercial_district_maturation: {
    multipliers: {
      competition: 1.2,
      // Mature market — competition is real and intensifying
      momentum: 0.9
      // Growth plateau — momentum may not continue
    },
    notes: [
      "Mature commercial district — differentiation is critical for new entrants.",
      "High competition intensity. Chain penetration likely high."
    ]
  },
  commercial_district_emergence: {
    multipliers: {
      vibrancy: 0.8,
      // Retail lagging residential
      momentum: 1.2
      // Momentum is a leading indicator here
    },
    notes: [
      "Emerging district — retail infrastructure lags residential by 3-5 years.",
      "Momentum is the key signal; vibrancy will follow."
    ]
  },
  commercial_district_revival: {
    multipliers: {
      momentum: 1.2,
      safety: 1.1
      // Safety improvements are real and meaningful here
    },
    notes: [
      "Revival corridor — safety improvements are confirmed by ground data.",
      "Momentum is leading. Demographics shifting toward higher income."
    ]
  },
  residential_overbuild: {
    multipliers: {
      vibrancy: 0.7,
      // Retail significantly lags residential
      momentum: 1.1,
      // Construction pipeline is real
      demographics: 0.9
    },
    notes: [
      "Rapid residential buildout without proportional retail infrastructure.",
      "Vibrancy will improve as retail catches up — timing is 3-5 years."
    ]
  },
  ethnic_commercial_corridor: {
    multipliers: {
      demographics: 1.2,
      // Demographic alignment is especially predictive
      vibrancy: 0.9
      // F&D saturation flag may be false alarm
    },
    notes: [
      "Ethnic commercial corridor — demographic alignment is the primary success factor.",
      "F&D saturation benchmark is structural, not over-saturation."
    ]
  },
  suburban_pattern: {
    multipliers: {
      transit: 0.7,
      // Transit is less predictive in auto-dependent markets
      accessibility: 0.7
    },
    notes: [
      "Auto-dependent market — transit and walkability metrics are less predictive.",
      "Parking availability and visibility from main roads are key factors not in current scoring."
    ]
  }
};
function getConfidenceMultipliers(impactType) {
  const prior = IMPACT_TYPE_PRIORS[impactType];
  return prior?.multipliers ?? {};
}
function scoreToGrade(score) {
  return scoreToGrade$1(score);
}
function resolveConceptType(businessType, businessSubType) {
  return normalizeBusinessType(businessType);
}
function getWeights(businessType) {
  const concept = resolveConceptType(businessType);
  return BUSINESS_TYPE_CONFIGS[concept].locationWeights;
}
function computeLocationIQ(report, businessType = "cafe", historicalImpactTypes) {
  const signals = [];
  const missing = [];
  let availableSources = 0;
  const totalSources = 19;
  if (report.census) availableSources++;
  else missing.push("Census");
  if (report.censusHousing) availableSources++;
  else missing.push("Census Housing");
  if (report.walkScore) availableSources++;
  else missing.push("WalkScore");
  if (report.inspections) availableSources++;
  else missing.push("Inspections");
  if (report.crime) availableSources++;
  else missing.push("Crime");
  if (report.places) availableSources++;
  else missing.push("Places");
  if (report.marketDensity) availableSources++;
  else missing.push("Market Density");
  if (report.competitors) availableSources++;
  else missing.push("Competitors");
  if (report.lpc) availableSources++;
  else missing.push("Landmarks");
  if (report.mtaRidership) availableSources++;
  else missing.push("MTA Ridership");
  if (report.dcaLicenses) availableSources++;
  else missing.push("DCA Licenses");
  if (report.dob) availableSources++;
  else missing.push("DOB");
  if (report.complaints311) availableSources++;
  else missing.push("311 Complaints");
  if (report.pedestrian) availableSources++;
  else missing.push("Pedestrian");
  if (report.pluto) availableSources++;
  else missing.push("PLUTO");
  if (report.sidewalkCafes) availableSources++;
  else missing.push("Sidewalk Cafes");
  if (report.liquorLicenses) availableSources++;
  else missing.push("Liquor Licenses");
  if (report.foursquare) availableSources++;
  else missing.push("Foursquare");
  if (report.momentum) availableSources++;
  else missing.push("Momentum");
  const priorMults = {};
  if (historicalImpactTypes && historicalImpactTypes.length > 0) {
    for (const impactType of historicalImpactTypes) {
      const m = getConfidenceMultipliers(impactType);
      for (const [k, v] of Object.entries(m)) {
        const key = k;
        priorMults[key] = (priorMults[key] ?? 1) * (v ?? 1);
      }
    }
  }
  const pm = (key) => priorMults[key] ?? 1;
  const dataFraction = availableSources / totalSources;
  const niqBreakdown = computeNIQ(report, businessType, signals);
  const niqRaw = Math.round(
    niqBreakdown.population * 0.25 * pm("demographics") + niqBreakdown.lifecycle * 0.2 * pm("momentum") + niqBreakdown.businessEcosystem * 0.3 * pm("competition") + niqBreakdown.disruption * 0.15 * pm("vibrancy") + niqBreakdown.transit * 0.1 * pm("transit")
  );
  let niq = expandVariance(niqRaw, 1.65, dataFraction);
  const siqBreakdown = computeSIQ(report, businessType, signals);
  const siqRaw = Math.round(
    siqBreakdown.walkability * 0.3 * pm("accessibility") + siqBreakdown.competitors * 0.3 * pm("competition") + siqBreakdown.buildingRisk * 0.2 * pm("safety") + siqBreakdown.landmarks * 0.2
  );
  let siq = expandVariance(siqRaw, 1.65, dataFraction);
  const tiqBreakdown = computeTIQ(report, businessType, signals);
  const tiqRaw = Math.round(
    tiqBreakdown.cuisineDiversity * 0.4 + tiqBreakdown.qualityGap * 0.3 + tiqBreakdown.marketGap * 0.3
  );
  let tiq = expandVariance(tiqRaw, 1.65, dataFraction);
  const liqRaw = computeLIQ(report, businessType, signals);
  let liq = expandVariance(liqRaw, 1.65, dataFraction);
  const weights = getWeights(businessType);
  const compositeRaw = Math.round(
    Math.max(5, Math.min(
      98,
      niq * weights.niq + siq * weights.siq + tiq * weights.tiq + liq * weights.liq
    ))
  );
  let locationIQ = expandVariance(compositeRaw, 1.55, dataFraction);
  const churnData = report.churnRisk;
  if (churnData && typeof churnData.score === "number" && churnData.tenantCount5yr > 0) {
    const churnAdj = Math.round((churnData.score - 50) * 0.2);
    locationIQ = Math.max(5, Math.min(98, locationIQ + churnAdj));
    if (churnData.tenantCount5yr >= 4) {
      signals.push({ layer: "SIQ", type: "negative", message: `High address turnover: ${churnData.tenantCount5yr} tenants in 5 years (avg tenure: ${churnData.avgTenureMonths ? Math.round(churnData.avgTenureMonths) + " mo" : "unknown"}). Investigate why businesses leave.` });
    } else if (churnData.tenantCount5yr === 1) {
      signals.push({ layer: "SIQ", type: "positive", message: `Stable address: single tenant in 5 years — low turnover risk.` });
    }
  }
  const concept = resolveConceptType(businessType);
  const borough = detectBorough(report.lat ?? 40.75, report.lng ?? -73.98);
  const boroughName = borough?.name || "";
  if (report.census) {
    const pop = report.census.totalPopulation || 0;
    const POPULATION_MINIMUMS = {
      retail: 1e4,
      specialty_coffee: 8e3,
      qsr: 2e4,
      full_service_restaurant: 1e4,
      fitness_studio: 12e3,
      personal_services: 8e3
    };
    const minPop = POPULATION_MINIMUMS[concept];
    if (minPop && pop > 0 && pop < minPop) {
      locationIQ = Math.min(locationIQ, 40);
      signals.push({ layer: "NIQ", type: "negative", message: `Catchment population ${pop.toLocaleString()} is below the ${minPop.toLocaleString()} minimum for ${BUSINESS_TYPE_CONFIGS[concept].label}. Location capped at 40.` });
    }
  }
  if (report.walkScore) {
    const ws = report.walkScore.walkScore || 50;
    let wsMult = 1;
    if (ws >= 90) wsMult = 1.1;
    else if (ws >= 70) wsMult = 1;
    else if (ws >= 50) wsMult = 0.9;
    else wsMult = 0.75;
    if (wsMult !== 1) {
      const before = locationIQ;
      locationIQ = Math.max(5, Math.min(98, Math.round(locationIQ * wsMult)));
      if (wsMult < 1) {
        signals.push({ layer: "SIQ", type: "negative", message: `Walk Score ${ws} (${ws < 50 ? "car-dependent" : "somewhat walkable"}) reduces Location IQ from ${before} → ${locationIQ}` });
      } else {
        signals.push({ layer: "SIQ", type: "positive", message: `Walk Score ${ws} (walker's paradise) boosts Location IQ from ${before} → ${locationIQ}` });
      }
    }
  }
  const LOCAL_RESIDENTIAL_CONCEPTS = [
    "specialty_coffee",
    "qsr",
    "personal_services",
    "fitness_studio",
    "medical_office",
    "retail"
  ];
  if (["Brooklyn", "Queens", "Bronx"].includes(boroughName) && LOCAL_RESIDENTIAL_CONCEPTS.includes(concept)) {
    const outerBonus = boroughName === "Bronx" ? 10 : 8;
    locationIQ = Math.min(98, locationIQ + outerBonus);
    signals.push({ layer: "SIQ", type: "positive", message: `${boroughName} location: +${outerBonus} pts — 40-60% lower rent than comparable Manhattan corridor with growing local demand` });
  }
  if (report.census) {
    const medianIncome = report.census.medianHouseholdIncome || 0;
    const CONCEPT_INCOME_TARGETS = {
      specialty_coffee: { min: 5e4, max: 2e5 },
      qsr: { min: 3e4, max: 12e4 },
      full_service_restaurant: { min: 6e4, max: 25e4 },
      bar_nightlife: { min: 5e4, max: 2e5 },
      fitness_studio: { min: 6e4, max: 25e4 },
      retail: { min: 4e4, max: 2e5 },
      coworking: { min: 7e4, max: 3e5 },
      personal_services: { min: 4e4, max: 18e4 },
      medical_office: { min: 4e4, max: 25e4 }
    };
    const target = CONCEPT_INCOME_TARGETS[concept];
    if (target && medianIncome > 0) {
      const mid = (target.min + target.max) / 2;
      const divergence = Math.abs(medianIncome - mid) / mid;
      if (medianIncome < target.min * 0.7) {
        locationIQ = Math.max(5, locationIQ - 15);
        signals.push({ layer: "NIQ", type: "negative", message: `Median income $${(medianIncome / 1e3).toFixed(0)}K is well below target range for ${BUSINESS_TYPE_CONFIGS[concept].label} — customer base may not support concept` });
      } else if (divergence > 0.3) {
        locationIQ = Math.max(5, locationIQ - 8);
        signals.push({ layer: "NIQ", type: "negative", message: `Median income $${(medianIncome / 1e3).toFixed(0)}K diverges ${Math.round(divergence * 100)}% from ${BUSINESS_TYPE_CONFIGS[concept].label} target — demographic mismatch risk` });
      }
    }
  }
  if (report.competitors) {
    const nearby = (report.competitors.rings?.ring1?.length || 0) + (report.competitors.rings?.ring2?.length || 0);
    const COMPARISON_CONCEPTS = ["retail"];
    const FB_CONCEPTS = ["specialty_coffee", "qsr", "full_service_restaurant", "bar_nightlife"];
    if (COMPARISON_CONCEPTS.includes(concept) && nearby >= 3) {
      const clusterBonus = Math.min(6, nearby);
      locationIQ = Math.min(98, locationIQ + clusterBonus);
      signals.push({ layer: "TIQ", type: "positive", message: `${nearby} similar businesses nearby — comparison shopping district effect (+${clusterBonus} pts)` });
    } else if (FB_CONCEPTS.includes(concept)) {
      if (nearby >= 2 && nearby <= 5) {
        locationIQ = Math.min(98, locationIQ + 4);
        signals.push({ layer: "TIQ", type: "positive", message: `${nearby} competing F&B venues — dining district effect (+4 pts). Sweet spot before saturation.` });
      } else if (nearby > 8) {
        locationIQ = Math.max(5, locationIQ - 8);
        signals.push({ layer: "TIQ", type: "negative", message: `${nearby} F&B competitors within 800m — saturation zone (-8 pts). Differentiation critical.` });
      }
    }
    if (["personal_services", "fitness_studio", "medical_office"].includes(concept) && nearby >= 5) {
      locationIQ = Math.max(5, locationIQ - 6);
      signals.push({ layer: "TIQ", type: "negative", message: `${nearby} direct competitors for a service-based concept — oversaturation risk (-6 pts)` });
    }
  }
  if (report.census && report.dcaLicenses && report.dob) {
    const incomeChange5yr = report.census.incomeChange5yr ?? 0;
    const newBizRate = report.dcaLicenses.newBusinessRate ?? 0;
    const newBuildings = report.dob.newBuildingCount ?? 0;
    let stage = "unknown";
    if (incomeChange5yr > 25 && newBizRate > 20 && newBuildings > 3) {
      stage = "peak";
    } else if (incomeChange5yr >= 10 && incomeChange5yr <= 25 && newBizRate >= 15) {
      stage = "mid";
    } else if (incomeChange5yr > 25 && newBizRate < 15) {
      stage = "late";
    } else if (incomeChange5yr > 0 && incomeChange5yr < 10 && newBizRate >= 10) {
      stage = "early";
    }
    if (stage === "mid") {
      locationIQ = Math.min(98, locationIQ + 12);
      signals.push({ layer: "NIQ", type: "positive", message: `Mid-gentrification stage: income up ${Math.round(incomeChange5yr)}%, ${newBizRate}% new businesses — optimal entry window (+12 pts)` });
    } else if (stage === "peak") {
      locationIQ = Math.max(5, locationIQ - 5);
      signals.push({ layer: "NIQ", type: "negative", message: `Peak gentrification: rapid income growth + high construction activity — rent correction risk (-5 pts)` });
    } else if (stage === "early") {
      signals.push({ layer: "NIQ", type: "neutral", message: `Early-stage neighborhood change: income rising ${Math.round(incomeChange5yr)}% — cheaper rent but customer base still forming` });
    } else if (stage === "late") {
      signals.push({ layer: "NIQ", type: "neutral", message: `Late-stage: high incomes but slower business growth — premium rent zone, only high-revenue concepts viable` });
    }
  }
  if (report.census) {
    const daytimeRatio = report.census.daytimePopulationRatio ?? 1;
    const isOfficeDependent = daytimeRatio > 2 && boroughName === "Manhattan";
    const isResidentialRecreational = daytimeRatio < 1.3 && ["Brooklyn", "Queens"].includes(boroughName);
    if (isOfficeDependent) {
      const before = locationIQ;
      locationIQ = Math.max(5, Math.round(locationIQ * 0.85));
      signals.push({ layer: "NIQ", type: "negative", message: `Office-dependent zone (daytime ratio ${daytimeRatio.toFixed(1)}x) — foot traffic still ~75-85% of pre-pandemic. Score ${before} → ${locationIQ}` });
    } else if (isResidentialRecreational) {
      const before = locationIQ;
      locationIQ = Math.min(98, Math.round(locationIQ * 1.05));
      signals.push({ layer: "NIQ", type: "positive", message: `Residential/recreational neighborhood — foot traffic recovered or exceeded pre-pandemic levels. Score ${before} → ${locationIQ}` });
    }
  }
  if (report.marketDensity) {
    const md = report.marketDensity;
    const totalBiz = md.totalBusinesses || 0;
    const hasAnchor = md.commercialVitality > 80 && totalBiz > 100;
    const isIsolated = totalBiz < 20 && md.commercialVitality < 30;
    if (hasAnchor) {
      locationIQ = Math.min(98, locationIQ + 7);
      signals.push({ layer: "NIQ", type: "positive", message: `High commercial density (${totalBiz} businesses, vitality ${md.commercialVitality}/100) — likely anchor tenant halo effect (+7 pts)` });
    } else if (isIsolated) {
      locationIQ = Math.max(5, locationIQ - 8);
      signals.push({ layer: "NIQ", type: "negative", message: `Isolated commercial zone — only ${totalBiz} businesses, low vitality. All traffic generation falls on you (-8 pts)` });
    }
  }
  if (report.dcaLicenses && report.dcaLicenses.industryBreakdown) {
    const breakdown = report.dcaLicenses.industryBreakdown;
    const total = report.dcaLicenses.totalCount || 1;
    const BASELINES = { food: 0.21, retail: 0.29, services: 0.32 };
    const CONCEPT_CATEGORY = {
      specialty_coffee: "food",
      qsr: "food",
      full_service_restaurant: "food",
      bar_nightlife: "food",
      retail: "retail",
      fitness_studio: "services",
      personal_services: "services",
      coworking: "services",
      medical_office: "services"
    };
    const targetCategory = CONCEPT_CATEGORY[concept];
    if (targetCategory && BASELINES[targetCategory]) {
      const categoryCount = breakdown.filter(
        (b) => targetCategory === "food" ? /food|restaurant|cafe|bar|bakery/i.test(b.industry || b.name || "") : targetCategory === "retail" ? /retail|store|shop/i.test(b.industry || b.name || "") : /service|salon|gym|medical|office/i.test(b.industry || b.name || "")
      ).reduce((sum, b) => sum + (b.count || 1), 0);
      const neighborhoodPct = categoryCount / total;
      const baseline = BASELINES[targetCategory];
      const divergence = neighborhoodPct - baseline;
      if (divergence < -0.08) {
        locationIQ = Math.min(98, locationIQ + 8);
        signals.push({ layer: "TIQ", type: "positive", message: `${targetCategory.charAt(0).toUpperCase() + targetCategory.slice(1)} underrepresented here (${Math.round(neighborhoodPct * 100)}% vs ${Math.round(baseline * 100)}% citywide) — gap opportunity (+8 pts)` });
      } else if (divergence > 0.1) {
        locationIQ = Math.max(5, locationIQ - 8);
        signals.push({ layer: "TIQ", type: "negative", message: `${targetCategory.charAt(0).toUpperCase() + targetCategory.slice(1)} oversaturated (${Math.round(neighborhoodPct * 100)}% vs ${Math.round(baseline * 100)}% citywide) — differentiation critical (-8 pts)` });
      }
    }
  }
  {
    let communityScore = 0;
    let hasCommunityInfra = false;
    if (report.sidewalkCafes && report.sidewalkCafes.activeCount > 5) {
      communityScore += 6;
      hasCommunityInfra = true;
      signals.push({ layer: "NIQ", type: "positive", message: `Active outdoor dining corridor (${report.sidewalkCafes.activeCount} permits) — likely BID zone with shared marketing and sanitation (+6 pts)` });
    }
    if (report.lpc && report.lpc.isHistoricDistrict) {
      communityScore += 4;
      hasCommunityInfra = true;
      signals.push({ layer: "NIQ", type: "positive", message: `Historic/cultural district — generates consistent visitor traffic and storytelling value (+4 pts)` });
    }
    if (communityScore > 0) {
      locationIQ = Math.min(98, locationIQ + communityScore);
    } else if (!hasCommunityInfra && report.marketDensity && (report.marketDensity.totalBusinesses || 0) < 30) {
      locationIQ = Math.max(5, locationIQ - 6);
      signals.push({ layer: "NIQ", type: "negative", message: `No community infrastructure detected (no BID, low business density) — all marketing falls on you (-6 pts)` });
    }
  }
  {
    const LIQUOR_CONCEPTS = /* @__PURE__ */ new Set([
      "bar_nightlife",
      "full_service_restaurant",
      "fine_dining"
    ]);
    if (LIQUOR_CONCEPTS.has(businessType) && report.liquorLicenses) {
      const onPremise = report.liquorLicenses.onPremiseCount ?? 0;
      if (onPremise >= 8) {
        siq = Math.max(5, siq - 12);
        locationIQ = Math.min(45, locationIQ);
        signals.push({
          layer: "SIQ",
          type: "negative",
          message: `Liquor license SATURATED: ${onPremise} on-premises licenses within 500 m — SLA will require "public interest" review and likely deny. Hard cap applied (-12 SIQ, max 45).`
        });
      } else if (onPremise >= 5) {
        siq = Math.max(5, siq - 8);
        signals.push({
          layer: "SIQ",
          type: "negative",
          message: `Liquor license DIFFICULT: ${onPremise} on-premises licenses within 500 m — expect SLA "500-ft rule" scrutiny, 6–18 month timeline, possible denial (-8 SIQ).`
        });
      } else {
        siq = Math.min(98, siq + 5);
        signals.push({
          layer: "SIQ",
          type: "positive",
          message: `Liquor license path CLEAR: only ${onPremise} on-premises licenses nearby — straightforward SLA approval expected (+5 SIQ).`
        });
      }
      if (report.schools) {
        const r17Ctx = {
          businessType,
          concept,
          schools: {
            slaBlocked: !!report.schools.slaBlocked,
            within200ft: report.schools.within200ft ?? 0,
            closestSchool: report.schools.closestSchool ? {
              name: report.schools.closestSchool.name,
              distanceMeters: report.schools.closestSchool.distanceMeters
            } : null
          }
        };
        const r17 = RULES[17].check(r17Ctx);
        if (!r17.passes) {
          const distFt = r17.data.distFt ?? 0;
          const closestName = r17.data.closestName ?? "School";
          const within200 = r17.data.within200ft ?? 0;
          siq = Math.max(5, siq - 15);
          locationIQ = Math.min(30, locationIQ);
          signals.push({
            layer: "SIQ",
            type: "negative",
            message: `🚫 SLA 200-ft BLOCK: ${closestName} is ${distFt} ft away — liquor license is IMPOSSIBLE at this location. Zero exceptions. ${within200} school(s) within 200 ft.`
          });
        } else if (report.schools.within200ft === 0) {
          signals.push({
            layer: "SIQ",
            type: "positive",
            message: `SLA 200-ft school check CLEAR: no schools within 200 ft (closest: ${report.schools.closestSchool ? Math.round(report.schools.closestSchool.distanceMeters * 3.281) + " ft" : "none nearby"}). Church proximity still requires manual verification.`
          });
        }
      } else {
        signals.push({
          layer: "SIQ",
          type: "info",
          message: `MUST VERIFY: NYS SLA 200-ft rule — if a school or church entrance is within 200 ft on the same street, liquor license is BLOCKED with zero exceptions. Confirm with SLA before signing a lease.`
        });
      }
      const r17w = getWeights(businessType);
      const r17Composite = Math.round(niq * r17w.niq + siq * r17w.siq + tiq * r17w.tiq + liq * r17w.liq);
      locationIQ = Math.max(5, Math.min(locationIQ, r17Composite));
    }
  }
  signals.length;
  {
    const nearby = report.competitors ? (report.competitors.rings?.ring1?.length || 0) + (report.competitors.rings?.ring2?.length || 0) : 0;
    const CLUSTER_RULES = {
      // Coffee Scoring Rewire (D3): saturation=2 is Ring 1 (100m) threshold.
      // dynamic-concept-config.ts saturation=8 is full trade area (400m).
      // Both coexist — this fires on immediate neighbors, that on broader market.
      specialty_coffee: { positive: 0, saturation: 2, effect: "negative" },
      // coffee: 2 before saturation
      full_service_restaurant: { positive: 3, saturation: 8, effect: "mixed" },
      // dining district 3-8
      bar_nightlife: { positive: 3, saturation: 6, effect: "mixed" },
      // nightlife district 3-6
      retail: { positive: 3, saturation: 99, effect: "positive" },
      // retail: 5+ helps (comparison shopping)
      personal_services: { positive: 0, saturation: 3, effect: "negative" },
      // salons: 3 before saturation
      fitness_studio: { positive: 0, saturation: 1, effect: "negative" },
      // same-modality: 1 before price war
      medical_office: { positive: 0, saturation: 2, effect: "negative" }
      // med spa: 2 before competition
    };
    const rule = CLUSTER_RULES[concept];
    if (rule && nearby > 0) {
      if (rule.effect === "negative" && nearby > rule.saturation) {
        const penalty = concept === "fitness_studio" ? -10 : -6;
        tiq = Math.max(5, tiq + penalty);
        signals.push({
          layer: "TIQ",
          type: "negative",
          message: `${nearby} ${BUSINESS_TYPE_CONFIGS[concept].label} competitors nearby — exceeds saturation threshold of ${rule.saturation} (${penalty} pts). Differentiation critical.`
        });
      } else if (rule.effect === "mixed") ;
    }
  }
  if (concept === "medical_office" && report.census) {
    const medIncome = report.census.medianHouseholdIncome || 0;
    if (medIncome > 0 && medIncome < 6e4) {
      niq = Math.max(5, niq - 15);
      locationIQ = Math.max(5, locationIQ - 15);
      signals.push({
        layer: "NIQ",
        type: "negative",
        message: `Median income $${(medIncome / 1e3).toFixed(0)}K is below $60K — med spa treatments ($200-$1,500/visit) are discretionary luxury; market too thin (-15 pts)`
      });
    }
  }
  {
    const inspections = report.inspections;
    const prevTenantType = inspections?.previousTenantType || report.previousTenantType;
    const vacantMonths = report.vacantMonths ?? inspections?.vacantMonths;
    if (prevTenantType) {
      const prevConcept = resolveConceptType(prevTenantType);
      const isMatch = prevConcept === concept;
      const isRecentVacancy = vacantMonths == null || vacantMonths < 12;
      if (isMatch && isRecentVacancy) {
        siq = Math.min(98, siq + 10);
        signals.push({
          layer: "SIQ",
          type: "positive",
          message: `Second-generation space: previous tenant was same business type — saves $200K+ in buildout (exhaust hood, grease trap, plumbing already in place, +10 SIQ)`
        });
      } else if (!isMatch && prevTenantType) {
        signals.push({
          layer: "SIQ",
          type: "info",
          message: `Change of use required: previous tenant was ${prevTenantType}. Expect $5K-$50K+ in conversion costs and 6-18 months for new Certificate of Occupancy.`
        });
      }
    }
  }
  {
    const FB_ELIGIBLE = ["full_service_restaurant", "specialty_coffee", "bar_nightlife", "qsr"];
    if (FB_ELIGIBLE.includes(concept) && report.sidewalkCafes) {
      const activeNearby = report.sidewalkCafes.activeCount ?? 0;
      if (activeNearby > 0) {
        siq = Math.min(98, siq + 5);
        signals.push({
          layer: "SIQ",
          type: "positive",
          message: `Sidewalk cafe corridor (${activeNearby} active permits on block) — outdoor dining can add 15-25% revenue (+5 SIQ)`
        });
      }
    }
  }
  if (concept === "bar_nightlife" && report.complaints311) {
    const complaints = report.complaints311;
    const noiseCount = complaints.noiseComplaints ?? complaints.totalComplaints ?? 0;
    if (noiseCount > 15) {
      siq = Math.max(5, siq - 8);
      signals.push({
        layer: "SIQ",
        type: "negative",
        message: `High noise complaint area (${noiseCount} recent 311 complaints) — residential neighbors likely above; expect Community Board pushback (-8 SIQ)`
      });
    }
  }
  {
    const places = report.places || report.googlePlaces;
    if (places && Array.isArray(places)) {
      const placeTypes = new Set(places.flatMap((p) => p.types || []));
      if (["specialty_coffee", "qsr"].includes(concept)) {
        const hasAnchor = placeTypes.has("university") || placeTypes.has("hospital") || placeTypes.has("school") || placeTypes.has("train_station") || placeTypes.has("subway_station");
        if (hasAnchor) {
          niq = Math.min(98, niq + 8);
          signals.push({
            layer: "NIQ",
            type: "positive",
            message: `Near university, hospital, or major transit hub — captive repeat audience for ${BUSINESS_TYPE_CONFIGS[concept].label} (+8 NIQ)`
          });
        }
      }
      if (concept === "fitness_studio") {
        const nearTransit = placeTypes.has("train_station") || placeTypes.has("subway_station") || placeTypes.has("transit_station");
        if (nearTransit) {
          niq = Math.min(98, niq + 6);
          signals.push({
            layer: "NIQ",
            type: "positive",
            message: `Transit-adjacent fitness — commuters can work out before/after work (+6 NIQ)`
          });
        }
      }
    }
  }
  if (["specialty_coffee", "qsr"].includes(concept) && report.census) {
    const daytimeRatio = report.census.daytimePopulationRatio ?? 1;
    if (daytimeRatio > 2 && boroughName === "Manhattan") {
      niq = Math.max(5, niq - 8);
      signals.push({
        layer: "NIQ",
        type: "negative",
        message: `Weekday-only risk: office district (daytime ratio ${daytimeRatio.toFixed(1)}x) — ${BUSINESS_TYPE_CONFIGS[concept].label} revenue drops 40%+ on weekends (-8 NIQ)`
      });
    }
  }
  if (["specialty_coffee", "retail"].includes(concept) && report.walkScore) {
    const ws = report.walkScore.walkScore || 50;
    if (ws < 70) {
      niq = Math.max(5, niq - 12);
      signals.push({
        layer: "NIQ",
        type: "negative",
        message: `Walk Score ${ws} is below 70 — ${BUSINESS_TYPE_CONFIGS[concept].label} depends on pedestrian impulse traffic. Low walkability is a structural disadvantage (-12 NIQ)`
      });
    }
  }
  if (["personal_services", "qsr"].includes(concept) && report.census) {
    const pop = report.census.totalPopulation || 0;
    if (pop > 1e4) {
      niq = Math.min(98, niq + 5);
      signals.push({
        layer: "NIQ",
        type: "positive",
        message: `Dense residential catchment (${pop.toLocaleString()} population) — ${BUSINESS_TYPE_CONFIGS[concept].label} thrives on repeat local clients (+5 NIQ)`
      });
    }
  }
  if (concept === "retail" && report.competitors) {
    const nearby = report.competitors.rings?.ring1?.length || 0;
    const isGrocery = /grocery|bodega|market|food.*store/i.test(businessType);
    if (isGrocery && nearby >= 1) {
      tiq = Math.max(5, tiq - 10);
      signals.push({
        layer: "TIQ",
        type: "negative",
        message: `Grocery has NEGATIVE clustering — ${nearby} competitor(s) within immediate radius means price war. Homogeneous products + proximity = margin destruction (-10 TIQ)`
      });
    }
  }
  {
    const isFlorist = /florist|flower/i.test(businessType);
    if (isFlorist && report.census) {
      const medIncome = report.census.medianHouseholdIncome || 0;
      if (medIncome > 0 && medIncome < 8e4) {
        niq = Math.max(5, niq - 10);
        signals.push({
          layer: "NIQ",
          type: "negative",
          message: `Median income $${(medIncome / 1e3).toFixed(0)}K is below $80K — flowers/gifts are discretionary; foot traffic alone won't sustain (-10 NIQ)`
        });
      }
    }
    if (isFlorist) {
      const places = report.places || report.googlePlaces;
      if (places && Array.isArray(places)) {
        const venueTypes = new Set(places.flatMap((p) => p.types || []));
        const hasEventVenues = venueTypes.has("lodging") || venueTypes.has("hotel") || venueTypes.has("event_venue") || venueTypes.has("wedding_hall") || venueTypes.has("church");
        if (hasEventVenues) {
          niq = Math.min(98, niq + 8);
          signals.push({
            layer: "NIQ",
            type: "positive",
            message: `Near event venues (hotels, churches, event spaces) — wedding/event revenue pipeline ($3K-$15K/event) +8 NIQ`
          });
        }
      }
    }
  }
  {
    const isGrocery = /grocery|bodega|market|food.*store/i.test(businessType);
    if (isGrocery && report.competitors) {
      const nearby = (report.competitors.rings?.ring1?.length || 0) + (report.competitors.rings?.ring2?.length || 0);
      if (nearby === 0) {
        tiq = Math.min(98, tiq + 12);
        niq = Math.min(98, niq + 5);
        signals.push({
          layer: "TIQ",
          type: "positive",
          message: `No competing grocery within radius — potential food desert / underserved area. Essential service creates community loyalty (+12 TIQ, +5 NIQ)`
        });
      }
    }
  }
  {
    const isBakery = /bakery|bake/i.test(businessType) || concept === "specialty_coffee";
    if (isBakery && concept !== "specialty_coffee") {
      const places = report.places || report.googlePlaces;
      if (places && Array.isArray(places)) {
        const placeTypes = new Set(places.flatMap((p) => p.types || []));
        const nearOffice = placeTypes.has("office") || placeTypes.has("corporate") || placeTypes.has("finance") || placeTypes.has("accounting");
        if (nearOffice) {
          niq = Math.min(98, niq + 5);
          signals.push({
            layer: "NIQ",
            type: "positive",
            message: `Near office buildings — corporate catering pipeline potential ($500-$2K/week per account) +5 NIQ`
          });
        }
      }
      if (report.census) {
        const daytimeRatio = report.census.daytimePopulationRatio ?? 1;
        if (daytimeRatio > 1.3) {
          signals.push({
            layer: "NIQ",
            type: "info",
            message: `Morning commute area (daytime ratio ${daytimeRatio.toFixed(1)}x) — bakery + coffee combo thrives on commute impulse`
          });
        }
      }
    }
  }
  if (concept === "retail") {
    const places = report.places || report.googlePlaces;
    if (places && Array.isArray(places)) {
      const placeTypes = new Set(places.flatMap((p) => p.types || []));
      const hasIdentity = placeTypes.has("art_gallery") || placeTypes.has("museum") || placeTypes.has("tourist_attraction") || placeTypes.has("cultural_center");
      if (hasIdentity) {
        niq = Math.min(98, niq + 5);
        signals.push({
          layer: "NIQ",
          type: "positive",
          message: `Neighborhood has cultural identity (galleries, museums, landmarks) — boutiques thrive in areas with foot-traffic-drawing character (+5 NIQ)`
        });
      }
    }
  }
  if (concept === "fitness_studio" && report.census) {
    const pop = report.census.totalPopulation || 0;
    if (pop > 15e3) {
      niq = Math.min(98, niq + 10);
      signals.push({
        layer: "NIQ",
        type: "positive",
        message: `Dense residential catchment (${pop.toLocaleString()} population) — recurring membership base for fitness (+10 NIQ)`
      });
    }
  }
  if (concept === "personal_services" && report.census) {
    const pop = report.census.totalPopulation || 0;
    if (pop > 8e3 && pop <= 1e4) {
      niq = Math.min(98, niq + 4);
      signals.push({
        layer: "NIQ",
        type: "positive",
        message: `Residential density (${pop.toLocaleString()}) supports neighborhood salon model — repeat local clients (+4 NIQ)`
      });
    }
  }
  if (concept === "medical_office") {
    const places = report.places || report.googlePlaces;
    if (places && Array.isArray(places)) {
      const placeTypes = new Set(places.flatMap((p) => p.types || []));
      const placeNames = places.map((p) => (p.name || "").toLowerCase()).join(" ");
      const nearLuxury = placeTypes.has("jewelry_store") || placeTypes.has("clothing_store") || placeTypes.has("department_store") || placeTypes.has("shopping_mall");
      if (nearLuxury) {
        niq = Math.min(98, niq + 8);
        signals.push({
          layer: "NIQ",
          type: "positive",
          message: `Near luxury retail corridor — affluent foot traffic aligns with med spa clientele (+8 NIQ)`
        });
      }
      const hasMedCompetition = /dermatolog|plastic.surg|cosmetic.surg|derm\b/i.test(placeNames);
      if (hasMedCompetition) {
        tiq = Math.max(5, tiq - 8);
        signals.push({
          layer: "TIQ",
          type: "negative",
          message: `Nearby dermatologists or plastic surgeons — licensed physicians with broader scope compete for same clients (-8 TIQ)`
        });
      }
    }
  }
  if (boroughName) {
    signals.push({
      layer: "LIQ",
      type: "info",
      message: `NYC lease advisory: negotiate a Good Guy Guarantee — it's market standard and limits personal liability to the lease term. Full personal guarantee without GGG = excessive risk.`
    });
  }
  {
    report.places || report.googlePlaces;
    const dofProfile = report.dof?.buildingProfile || report.buildingProfile;
    const yearBuilt = dofProfile?.avgYearBuilt || 0;
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    if (yearBuilt > 0 && currentYear - yearBuilt > 30) {
      const buildingAge = currentYear - yearBuilt;
      signals.push({
        layer: "SIQ",
        type: "info",
        message: `Building is ~${buildingAge} years old — budget for ADA compliance upgrades (typically 20% of renovation budget). Pre-1990 buildings almost always need ramp, restroom, and egress updates.`
      });
    }
  }
  {
    const r3 = RULES[3].check({ businessType, concept });
    if (!r3.passes) {
      const impliedRevPerSF = r3.data.impliedRevPerSF ?? 0;
      const floor = r3.data.floor ?? 150;
      locationIQ = Math.min(locationIQ, 35);
      signals.push({
        layer: "LIQ",
        type: "negative",
        message: `Revenue-per-SF floor fail: implied $${impliedRevPerSF}/SF vs minimum $${floor}/SF for this concept. Economics may not work at this density.`
      });
    }
  }
  {
    const r2 = RULES[2].check({ businessType, concept });
    if (!r2.passes) {
      const year3PctDisplay = r2.data.year3RentPctDisplay ?? 0;
      const ceilingPct = r2.data.ceilingPct ?? 0;
      const ceilingNote = r2.data.ceilingNote ?? "";
      signals.push({
        layer: "LIQ",
        type: "warning",
        message: `Rent escalation risk: at 3%/yr, rent reaches ~${year3PctDisplay}% of revenue by Year 3, exceeding the ${ceilingPct}% ceiling for this concept. ${ceilingNote}.`
      });
      locationIQ = Math.max(5, locationIQ - 4);
    }
  }
  {
    const isManhattanBelow96 = boroughName === "Manhattan";
    if (isManhattanBelow96) {
      signals.push({
        layer: "LIQ",
        type: "info",
        message: `Manhattan Commercial Rent Tax (CRT) applies to ground-floor spaces below 96th St with annual rent >$250K (3.9% of excess). Factor into total occupancy cost calculation.`
      });
    }
  }
  {
    const p3w = getWeights(businessType);
    const p3Composite = Math.round(niq * p3w.niq + siq * p3w.siq + tiq * p3w.tiq + liq * p3w.liq);
    locationIQ = expandVariance(p3Composite, 1.55, dataFraction);
  }
  locationIQ = Math.max(5, Math.min(98, locationIQ));
  {
    const pillars = [
      { name: "Neighborhood", score: niq },
      { name: "Site", score: siq },
      { name: "Trade Area", score: tiq },
      { name: "Lease", score: liq }
    ];
    const strong = pillars.filter((p) => p.score >= 65);
    const weak = pillars.filter((p) => p.score < 40);
    if (strong.length >= 3) {
      const names = strong.map((p) => p.name).join(", ");
      signals.push({
        layer: "COMPOSITE",
        type: "positive",
        message: `Strong consensus: ${strong.length} of 4 dimensions score well (${names}) — high-confidence result`
      });
    } else if (weak.length >= 3) {
      const names = weak.map((p) => p.name).join(", ");
      signals.push({
        layer: "COMPOSITE",
        type: "negative",
        message: `Consistent concern: ${weak.length} of 4 dimensions flag risk (${names}) — location faces structural challenges`
      });
    } else if (strong.length >= 1 && weak.length >= 1) {
      const best = strong.map((p) => p.name).join(", ");
      const worst = weak.map((p) => p.name).join(", ");
      signals.push({
        layer: "COMPOSITE",
        type: "neutral",
        message: `Mixed signals: strong on ${best} but weak on ${worst} — dig into the specifics before deciding`
      });
    }
  }
  const confidence = Math.round(availableSources / totalSources * 100);
  return {
    niq: clamp(niq),
    siq: clamp(siq),
    tiq: clamp(tiq),
    liq: clamp(liq),
    locationIQ: clamp(locationIQ),
    confidence,
    grade: scoreToGrade(locationIQ),
    breakdown: { niq: niqBreakdown, siq: siqBreakdown, tiq: tiqBreakdown },
    signals,
    dataCompleteness: {
      available: availableSources,
      total: totalSources,
      missing,
      percentage: confidence
    }
  };
}
function computeNIQ(r, _businessType, signals) {
  let population = 50;
  if (r.census) {
    let scoreIncomeNYC = function(annualHHI) {
      if (annualHHI <= 0) return 0;
      if (annualHHI < 35e3) return Math.round(annualHHI / 35e3 * 25);
      if (annualHHI < 7e4) return Math.round(25 + (annualHHI - 35e3) / 35e3 * 25);
      if (annualHHI < 12e4) return Math.round(50 + (annualHHI - 7e4) / 5e4 * 25);
      if (annualHHI < 2e5) return Math.round(75 + (annualHHI - 12e4) / 8e4 * 20);
      return 95 + Math.min(5, Math.round((annualHHI - 2e5) / 4e4));
    };
    const c = r.census;
    const incomeScore = scoreIncomeNYC(c.medianHouseholdIncome || 0);
    const ageScore = scoreLinear(c.medianAge || 30, 20, 50, true);
    const popDensity = scoreLinear(c.populationDensity || 0, 5e3, 7e4);
    const educScore = scoreLinear(c.bachelorsPlusPercent || 0, 10, 70);
    population = Math.round(incomeScore * 0.4 + ageScore * 0.15 + popDensity * 0.25 + educScore * 0.2);
    if (incomeScore > 70) signals.push({ layer: "NIQ", type: "positive", message: `Median income $${((c.medianHouseholdIncome || 0) / 1e3).toFixed(0)}K supports spending power` });
    if (incomeScore < 40) signals.push({ layer: "NIQ", type: "negative", message: `Lower median income ($${((c.medianHouseholdIncome || 0) / 1e3).toFixed(0)}K) may limit average ticket` });
    if (educScore > 70) signals.push({ layer: "NIQ", type: "positive", message: `${c.bachelorsPlusPercent}% college-educated — receptive to specialty concepts` });
  }
  if (r.censusHousing) {
    const h = r.censusHousing;
    if (h.rentBurdenedPct > 50) {
      population = Math.round(population * 0.85);
      signals.push({ layer: "NIQ", type: "negative", message: `${h.rentBurdenedPct}% rent-burdened — less disposable income for discretionary spending` });
    }
    if (h.vacancyRate > 15) {
      population = Math.round(population * 0.9);
      signals.push({ layer: "NIQ", type: "negative", message: `${h.vacancyRate}% housing vacancy — possible population decline` });
    } else if (h.vacancyRate < 5) {
      population = Math.round(population * 1.05);
      signals.push({ layer: "NIQ", type: "positive", message: `Only ${h.vacancyRate}% vacancy — strong housing demand, stable neighborhood` });
    }
  }
  let lifecycle = 50;
  if (r.dcaLicenses) {
    const newRate = r.dcaLicenses.newBusinessRate;
    if (newRate >= 10 && newRate <= 25) lifecycle = 80;
    else if (newRate > 25) lifecycle = 55;
    else lifecycle = 35;
    const diversity = r.dcaLicenses.industryBreakdown.length;
    lifecycle += Math.min(15, diversity * 2);
    if (newRate > 25) signals.push({ layer: "NIQ", type: "negative", message: `High business turnover (${newRate}% new in 12mo) — market may be volatile` });
    if (newRate >= 10 && newRate <= 25) signals.push({ layer: "NIQ", type: "positive", message: `Healthy business turnover (${newRate}% new businesses) — active market` });
  }
  let businessEcosystem = 50;
  if (r.dcaLicenses) {
    businessEcosystem = r.dcaLicenses.ecosystemScore;
    if (businessEcosystem > 70) signals.push({ layer: "NIQ", type: "positive", message: `${r.dcaLicenses.totalCount} active licensed businesses — thriving ecosystem` });
  }
  if (r.sidewalkCafes) {
    const cafes = r.sidewalkCafes;
    if (cafes.activeCount > 3) {
      businessEcosystem = Math.round(businessEcosystem * 1.08);
      signals.push({ layer: "NIQ", type: "positive", message: `${cafes.activeCount} sidewalk café permits, ${cafes.totalSeatingCapacity} outdoor seats — vibrant street life` });
    } else if (cafes.activeCount === 0) {
      signals.push({ layer: "NIQ", type: "neutral", message: "No sidewalk café permits — limited outdoor dining culture" });
    }
  }
  if (r.liquorLicenses) {
    const liq = r.liquorLicenses;
    if (liq.totalCount > 10) {
      businessEcosystem = Math.round(businessEcosystem * 1.05);
      signals.push({ layer: "NIQ", type: "positive", message: `${liq.totalCount} liquor licenses (${liq.onPremiseCount} bars/restaurants) — active nightlife corridor` });
    }
    if (liq.nightlifeDensity > 70) {
      signals.push({ layer: "NIQ", type: "positive", message: `High nightlife density (${liq.nightlifeDensity}/100) — evening foot traffic advantage` });
    }
  }
  let disruption = 70;
  if (r.dob) {
    disruption = Math.max(20, 100 - r.dob.riskScore);
    if (r.dob.newBuildingCount > 2) {
      signals.push({ layer: "NIQ", type: "neutral", message: `${r.dob.newBuildingCount} new building permits — area is developing but may face construction disruption` });
    }
    if (r.dob.activeViolationCount > 5) {
      signals.push({ layer: "NIQ", type: "negative", message: `${r.dob.activeViolationCount} active DOB violations nearby — building risk elevated` });
      disruption -= 10;
    }
  }
  if (r.complaints311) {
    const qol = r.complaints311.qualityScore;
    disruption = Math.round(disruption * 0.6 + qol * 0.4);
    if (r.complaints311.noiseCount > 20) {
      signals.push({ layer: "NIQ", type: "negative", message: `${r.complaints311.noiseCount} noise complaints in 3mo — could impact customer experience` });
    }
  }
  let transit = getBoroughTransitFloor(r.lat ?? 40.75, r.lng ?? -73.98);
  if (r.mtaRidership) {
    transit = r.mtaRidership.transitScore;
    if (transit > TRANSIT_THRESHOLDS.positiveSignalFloor) signals.push({ layer: "NIQ", type: "positive", message: `${r.mtaRidership.stationCount} subway stations, ${(r.mtaRidership.totalDailyRidership / 1e3).toFixed(0)}K daily riders — excellent transit access` });
  }
  if (r.pedestrian) {
    const pedScore = r.pedestrian.footTrafficScore;
    transit = Math.round(transit * 0.6 + pedScore * 0.4);
    if (pedScore > 70) signals.push({ layer: "NIQ", type: "positive", message: `High verified foot traffic: ${r.pedestrian.totalPedestrians.toLocaleString()} pedestrians counted at ${r.pedestrian.countLocationCount} DOT points` });
  }
  return {
    population: clamp(population),
    lifecycle: clamp(lifecycle),
    businessEcosystem: clamp(businessEcosystem),
    disruption: clamp(disruption),
    transit: clamp(transit)
  };
}
function computeSIQ(r, _businessType, signals) {
  let walkability = 50;
  if (r.walkScore) {
    walkability = r.walkScore.walkScore || 50;
    if (r.walkScore.transitScore && r.walkScore.transitScore > 70) {
      walkability = Math.round(walkability * 0.7 + r.walkScore.transitScore * 0.3);
    }
    if (walkability > 80) signals.push({ layer: "SIQ", type: "positive", message: `Walk Score ${r.walkScore.walkScore} — highly walkable location` });
  }
  let competitors = 50;
  if (r.competitors) {
    const rings = r.competitors.rings;
    const nearby = rings?.ring1?.length || 0;
    const mid = rings?.ring2?.length || 0;
    const total = nearby + mid;
    if (total === 0) competitors = 40;
    else if (total <= 3) competitors = 85;
    else if (total <= 8) competitors = 65;
    else competitors = Math.max(25, 65 - (total - 8) * 5);
    if (total === 0) signals.push({ layer: "SIQ", type: "neutral", message: "No direct competitors detected — unproven market or niche opportunity" });
    else if (total > 8) signals.push({ layer: "SIQ", type: "negative", message: `${total} competitors within 800m — saturated, differentiation critical` });
  }
  if (r.foursquare) {
    const fsq = r.foursquare;
    if (fsq.directCompetitors.length > 0) {
      if (fsq.avgPopularity > 0.6) {
        competitors = Math.round(competitors * 1.08);
        signals.push({ layer: "SIQ", type: "positive", message: `High venue popularity (${(fsq.avgPopularity * 100).toFixed(0)}%) — proven customer demand in area` });
      }
      if (fsq.categoryDiversity > 15) {
        signals.push({ layer: "SIQ", type: "positive", message: `${fsq.categoryDiversity} business categories nearby (Foursquare) — diverse commercial ecosystem` });
      }
    }
    if (fsq.chainCount > 0 && fsq.independentCount > 0) {
      const chainPct = Math.round(fsq.chainCount / (fsq.chainCount + fsq.independentCount) * 100);
      if (chainPct > 60) {
        signals.push({ layer: "SIQ", type: "positive", message: `${chainPct}% chain venues — opportunity for independent differentiation` });
      }
    }
  }
  let buildingRisk = 70;
  if (r.dob) {
    buildingRisk = Math.max(15, 100 - r.dob.riskScore);
    if (r.dob.riskScore > 50) signals.push({ layer: "SIQ", type: "negative", message: `High building risk score (${r.dob.riskScore}/100) — inspect thoroughly before signing lease` });
  }
  if (r.pluto) {
    const p = r.pluto;
    const zone = p.zoneProfile;
    const commercialFriendly = zone.commercialPct + zone.mixedUsePct;
    if (commercialFriendly > 50) {
      buildingRisk = Math.round(buildingRisk * 1.1);
      signals.push({ layer: "SIQ", type: "positive", message: `${commercialFriendly}% commercial/mixed zoning — favorable for retail` });
    } else if (commercialFriendly < 20) {
      buildingRisk = Math.round(buildingRisk * 0.8);
      signals.push({ layer: "SIQ", type: "negative", message: `Only ${commercialFriendly}% commercial zoning — check use-group restrictions` });
    }
    if (p.buildingProfile.totalRetailSqFt > 5e4) {
      signals.push({ layer: "SIQ", type: "positive", message: `${(p.buildingProfile.totalRetailSqFt / 1e3).toFixed(0)}K sq ft of retail nearby — established retail corridor` });
    }
    if (p.developmentPotential > 70) {
      signals.push({ layer: "SIQ", type: "positive", message: `High development potential (${p.developmentPotential}/100) — area likely to grow` });
    }
    if (p.buildingProfile.avgYearBuilt > 0 && p.buildingProfile.avgYearBuilt < 1940) {
      signals.push({ layer: "SIQ", type: "neutral", message: `Average building age ${(/* @__PURE__ */ new Date()).getFullYear() - p.buildingProfile.avgYearBuilt}+ years — charming but check for infrastructure issues` });
    }
  }
  const lienDetail = r.propertyTax?.taxLienDetail;
  if (lienDetail && lienDetail.severity !== "NONE") {
    const severityPenalty = {
      MINOR: 2,
      MODERATE: 5,
      SEVERE: 10,
      CRITICAL: 15
    };
    const penalty = severityPenalty[lienDetail.severity] ?? 5;
    buildingRisk = Math.max(0, buildingRisk - penalty);
    const amtText = lienDetail.totalLienAmount > 0 ? ` ($${Math.round(lienDetail.totalLienAmount / 1e3)}K outstanding)` : "";
    const yearsText = lienDetail.yearsInArrears > 0 ? `, ${lienDetail.yearsInArrears} years in arrears` : "";
    signals.push({
      layer: "SIQ",
      type: "negative",
      message: `Tax lien ${lienDetail.severity.toLowerCase()} severity${amtText}${yearsText} — financial distress signal. Discuss property stability with attorney before signing.`
    });
  } else if (r.propertyTax?.hasTaxLien) {
    buildingRisk = Math.max(0, buildingRisk - 5);
    signals.push({ layer: "SIQ", type: "negative", message: "Building has outstanding tax liens — financial distress risk. Discuss stability with attorney before signing." });
  }
  if (r.propertyTax?.mortgageContext === "high_leverage") {
    signals.push({ layer: "SIQ", type: "negative", message: "Highly leveraged owner with recent purchase — landlord may be under financial pressure to maintain high rents." });
  }
  let landmarks = 50;
  if (r.lpc) {
    const count = r.lpc.nearbyLandmarks?.length || 0;
    if (count > 0) {
      landmarks = Math.min(90, 60 + count * 10);
      if (r.lpc.isHistoricDistrict) {
        landmarks += 10;
        signals.push({ layer: "SIQ", type: "positive", message: `Historic district — character draw, but check renovation restrictions` });
      }
    }
  }
  return {
    walkability: clamp(walkability),
    competitors: clamp(competitors),
    buildingRisk: clamp(buildingRisk),
    landmarks: clamp(landmarks)
  };
}
function computeTIQ(r, _businessType, signals) {
  let cuisineDiversity = 50;
  if (r.inspections) {
    const cuisines = Object.keys(r.inspections.cuisineBreakdown || {}).length;
    cuisineDiversity = Math.min(95, 30 + cuisines * 5);
    if (cuisines > 10) signals.push({ layer: "TIQ", type: "positive", message: `${cuisines} cuisine types nearby — diverse food scene attracts adventurous eaters` });
  }
  let qualityGap = 50;
  if (r.inspections) {
    const avgGrade = r.inspections.avgScore || 50;
    qualityGap = Math.max(20, 100 - avgGrade);
    if (avgGrade < 60) signals.push({ layer: "TIQ", type: "positive", message: `Average restaurant grade below B — room for a quality-first concept` });
  }
  if (r.places) {
    const avgRating = r.places.avgRating || 0;
    if (avgRating > 0 && avgRating < 4) {
      qualityGap += 10;
      signals.push({ layer: "TIQ", type: "positive", message: `Average nearby rating ${avgRating.toFixed(1)}★ — quality gap to exploit` });
    } else if (avgRating >= 4.3) {
      qualityGap -= 10;
      signals.push({ layer: "TIQ", type: "neutral", message: `Average rating ${avgRating.toFixed(1)}★ — high quality bar, must match or exceed` });
    }
  }
  let marketGap = 50;
  if (r.dcaLicenses && r.competitors) {
    const licensedBiz = r.dcaLicenses.totalCount;
    const competitorCount = (r.competitors.rings?.ring1?.length || 0) + (r.competitors.rings?.ring2?.length || 0);
    if (licensedBiz > 50 && competitorCount < 5) {
      marketGap = 80;
      signals.push({ layer: "TIQ", type: "positive", message: `${licensedBiz} businesses but only ${competitorCount} direct competitors — clear market gap` });
    } else if (competitorCount > licensedBiz * 0.1) {
      marketGap = 35;
    }
  }
  if (r.marketDensity) {
    const md = r.marketDensity;
    if (md.commercialVitality > 70) {
      marketGap = Math.round(marketGap * 1.1);
      signals.push({ layer: "TIQ", type: "positive", message: `Commercial vitality ${md.commercialVitality}/100 — ${md.totalBusinesses} businesses across ${md.categories.filter((c) => c.count > 0).length} categories` });
    }
    const highChainCats = md.categories.filter((c) => c.chainPct > 60 && c.count > 3);
    if (highChainCats.length > 0) {
      signals.push({ layer: "TIQ", type: "positive", message: `Chain-heavy market (${highChainCats.map((c) => c.category).join(", ")}) — opportunity for authentic independent concept` });
      marketGap = Math.round(marketGap * 1.05);
    }
  }
  return {
    cuisineDiversity: clamp(cuisineDiversity),
    qualityGap: clamp(qualityGap),
    marketGap: clamp(marketGap)
  };
}
function computeLIQ(r, _businessType, signals) {
  let laborPool = 50;
  let commutability = 50;
  let wageViability = 50;
  if (r.census) {
    const c = r.census;
    const daytimeScore = scoreLinear(c.daytimePopulationRatio || 1, 0.5, 2.5);
    const popScore = scoreLinear(c.populationDensity || 0, 5e3, 8e4);
    const youthScore = scoreLinear(c.medianAge || 35, 20, 50, true);
    laborPool = Math.round(daytimeScore * 0.4 + popScore * 0.35 + youthScore * 0.25);
    if (daytimeScore > 70) {
      signals.push({ layer: "LIQ", type: "positive", message: `High daytime population ratio (${(c.daytimePopulationRatio || 1).toFixed(1)}x) — strong commuter labor pool` });
    }
    if (daytimeScore < 30) {
      signals.push({ layer: "LIQ", type: "negative", message: `Low daytime population — workers may need to commute in` });
    }
  }
  if (r.mtaRidership) {
    const mta = r.mtaRidership;
    const riderScore = scoreLinear(mta.totalDailyRidership || 0, 1e3, 5e4);
    const stationScore = scoreLinear(mta.stationCount || 0, 1, 8);
    commutability = Math.round(riderScore * 0.6 + stationScore * 0.4);
    if (mta.stationCount >= 3) {
      signals.push({ layer: "LIQ", type: "positive", message: `${mta.stationCount} subway stations nearby — easy commute for staff` });
    }
  } else if (r.walkScore) {
    commutability = r.walkScore.transitScore || 50;
  }
  if (r.census) {
    const income = r.census.medianHouseholdIncome || 6e4;
    if (income >= 4e4 && income <= 8e4) {
      wageViability = 75;
    } else if (income < 4e4) {
      wageViability = 60;
      signals.push({ layer: "LIQ", type: "neutral", message: "Lower-income area may see higher staff turnover" });
    } else if (income <= 12e4) {
      wageViability = 65;
    } else {
      wageViability = 50;
      signals.push({ layer: "LIQ", type: "neutral", message: "High-income area — hourly workers likely commute from other neighborhoods" });
    }
  }
  return clamp(Math.round(laborPool * 0.4 + commutability * 0.35 + wageViability * 0.25));
}
function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(v)));
}
function expandVariance(raw, strength, dataCompleteness) {
  if (strength <= 1) return raw;
  const confidenceDamper = Math.min(1, dataCompleteness / 0.6);
  const effectiveStrength = 1 + (strength - 1) * confidenceDamper;
  const delta = raw - 50;
  const absDelta = Math.abs(delta);
  let expanded;
  if (absDelta <= 30) {
    expanded = delta * effectiveStrength;
  } else {
    const base = 30 * effectiveStrength;
    const remainder = absDelta - 30;
    const dampedRemainder = Math.sqrt(remainder) * Math.sqrt(30) * (effectiveStrength - 1) + remainder;
    expanded = Math.sign(delta) * (base + dampedRemainder);
  }
  return clamp(Math.round(50 + expanded), 5, 98);
}
function scoreLinear(value, low, high, invert = false) {
  const normalized = Math.max(0, Math.min(1, (value - low) / (high - low)));
  const score = Math.round((invert ? 1 - normalized : normalized) * 100);
  return clamp(score);
}
export {
  computeLocationIQ as c
};
