const VERSION_KEY = "re2_state_version";
let _lastKnownVersion = 0;
function getStateVersion() {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(VERSION_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}
function bumpVersion() {
  if (typeof window === "undefined") return 0;
  const next = getStateVersion() + 1;
  try {
    localStorage.setItem(VERSION_KEY, String(next));
    _lastKnownVersion = next;
  } catch {
  }
  return next;
}
const STORAGE_KEY = "re2_launchpad";
const DEFAULTS = {
  founderProfile: {
    motivation: "",
    ownerType: "",
    riskTolerance: "",
    experience: "",
    yearOneGoals: {
      revenueTarget: 0,
      personalIncomeTarget: 0,
      employeeCount: 0,
      locationCount: 1
    }
  },
  creditProfile: {
    scoreRange: "",
    bankruptcy: false,
    latePayments: false,
    collections: false,
    existingDebt: ""
  },
  businessType: "",
  businessSubType: "",
  priceLevel: "",
  businessName: "",
  visionStatement: "",
  differentiator: "",
  businessFormat: "",
  financialGoals: {
    targetSDE: 0,
    revenueY1: 0,
    revenueY3: 0,
    dailyTransactions: 0,
    avgTicket: 0,
    numberOfLocations: 1,
    startupCapital: 0,
    personalInvestment: 0,
    emergencyReserveMonths: 0,
    monthlyRentBudget: 0,
    buildoutBudget: 0,
    teamSize: 0,
    squareFootage: 0,
    liquidCapital: 0,
    monthlyPersonalExpenses: 0,
    externalFunding: 0
  },
  weights: {
    l0_macro: 10,
    l1_city: 15,
    l2_block: 18,
    l3_planfit: 18,
    l4_talent: 10,
    l5_resilience: 10,
    l6_zoning: 7,
    l7_feel: 12
  },
  idealArea: "",
  preferredNeighborhoods: "",
  sacred: {},
  flexible: {},
  launchPackProgress: {},
  conceptProfiles: [],
  lastSaved: 0
};
function loadLaunchPadData() {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return mergeWithDefaults(parsed);
    }
    loadFromSupabase().catch((err) => {
      console.debug("[Launchpad] Supabase load failed:", err);
    });
    return { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}
function mergeWithDefaults(parsed) {
  return {
    ...DEFAULTS,
    ...parsed,
    founderProfile: {
      ...DEFAULTS.founderProfile,
      ...parsed.founderProfile,
      yearOneGoals: {
        ...DEFAULTS.founderProfile.yearOneGoals,
        ...parsed.founderProfile?.yearOneGoals || {}
      }
    },
    creditProfile: { ...DEFAULTS.creditProfile, ...parsed.creditProfile },
    financialGoals: { ...DEFAULTS.financialGoals, ...parsed.financialGoals },
    launchPackProgress: { ...DEFAULTS.launchPackProgress, ...parsed.launchPackProgress },
    conceptProfiles: parsed.conceptProfiles || []
  };
}
async function loadFromSupabase() {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/session-sync");
    if (!res.ok) return;
    const json = await res.json();
    if (!json.found || !json.data) return;
    const launchpadData = json.data.launchpad || {};
    const remoteLocations = json.shortlistedLocations || null;
    if (remoteLocations && !launchpadData.scoredLocations?.length) {
      launchpadData.scoredLocations = remoteLocations;
    }
    if (!Object.keys(launchpadData).length) return;
    try {
      const localData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (!localData.lastSaved || launchpadData.lastSaved && launchpadData.lastSaved > localData.lastSaved) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(launchpadData));
      } else if (remoteLocations) {
        const lp = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        if (!lp.scoredLocations?.length) {
          lp.scoredLocations = remoteLocations;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(lp));
        }
      }
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(launchpadData));
    }
  } catch (err) {
    console.debug("[Launchpad] API load error:", err);
  }
}
function saveLaunchPadData(data) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadLaunchPadData();
    if (data.businessType && existing.businessType && data.businessType !== existing.businessType && existing.businessType !== "") {
      const profiles = [...existing.conceptProfiles || []];
      if (!profiles.some((p) => p.conceptKey === existing.businessType)) {
        profiles.push({
          conceptKey: existing.businessType,
          businessType: existing.businessType,
          businessSubType: existing.businessSubType,
          priceLevel: existing.priceLevel,
          differentiator: existing.differentiator,
          visionStatement: existing.visionStatement,
          businessFormat: existing.businessFormat,
          createdAt: existing.lastSaved || Date.now()
        });
      }
      data = { ...data, conceptProfiles: profiles };
    }
    const merged = { ...existing, ...data, lastSaved: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    bumpVersion();
    syncToSupabase(merged).catch((err) => {
      console.debug("[Launchpad] Supabase sync failed:", err);
    });
  } catch (e) {
    console.error("Failed to save Launch Pad data:", e);
  }
}
async function syncToSupabase(data) {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/session-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ launchpad: data, shortlistedLocations: data.scoredLocations || void 0 })
    });
  } catch (err) {
    console.debug("[Launchpad] API sync error:", err);
  }
}
function getLaunchPadDefaults() {
  return { ...DEFAULTS };
}
function hasFounderProfile() {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.founderProfile?.motivation) return true;
    }
    const sessionRaw = localStorage.getItem("re2_session");
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      if (session.personaType || session.bizType || session.budgetRange) return true;
    }
    return false;
  } catch {
    return false;
  }
}
function hasBusinessConcept() {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.businessType && (parsed.visionStatement || parsed.differentiator)) return true;
    }
    const sessionRaw = localStorage.getItem("re2_session");
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      if (session.personaType || session.bizType) return true;
    }
    return false;
  } catch {
    return false;
  }
}
export {
  getLaunchPadDefaults,
  hasBusinessConcept,
  hasFounderProfile,
  loadLaunchPadData,
  saveLaunchPadData
};
