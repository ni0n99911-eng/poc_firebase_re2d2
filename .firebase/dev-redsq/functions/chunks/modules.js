const SITE_CONFIG = {
  domain: "resquared.io",
  url: "https://resquared.io",
  name: "RE²",
  tagline: "Real Estate Einstein",
  company: "RE Squared LLC",
  emails: {
    support: "support@resquared.io",
    hello: "hello@resquared.io",
    enterprise: "enterprise@resquared.io"
  },
  userAgent: "resquared.io/location-intel"
};
const SUPER_ADMINS = ["gaurav.joshi06@gmail.com", "kalpna.gaule@gmail.com"];
async function getAdminEmails() {
  return SUPER_ADMINS;
}
const PRICING_TIERS = {
  scout: {
    name: "Scout",
    modules: ["location-einstein"],
    price: "Free",
    period: "during beta"
  },
  builder: {
    name: "Builder",
    modules: ["location-einstein", "space-einstein", "business-einstein"],
    price: 79,
    period: "/month"
  },
  pro: {
    name: "Pro",
    modules: ["location-einstein", "space-einstein", "business-einstein", "loan-einstein"],
    price: 149,
    period: "/month"
  },
  enterprise: {
    name: "Enterprise",
    modules: ["location-einstein", "space-einstein", "business-einstein", "loan-einstein", "launch-einstein", "operations-einstein"],
    price: 249,
    period: "/month"
  }
};
async function fetchPricingTiers() {
  return PRICING_TIERS;
}
const ROUTE_MODULE_MAP = {
  // Phase 1: Your Vision (free tier — location-einstein)
  "/app/vision": "location-einstein",
  // Phase 2: Reality Check
  "/app/location": "location-einstein",
  "/app/outcomes": "location-einstein",
  "/app/recommendations": "location-einstein",
  // Phase 2.5: Space Einstein (under Reality Check)
  "/app/space": "space-einstein",
  // Phase 3: Your Path Forward
  "/app/model": "business-einstein",
  "/app/financials": "business-einstein",
  "/app/business-plan": "business-einstein",
  // was launch-einstein — same gate as old /app/financials
  "/app/loans": "loan-einstein",
  // Phase 4: Launch Kit
  "/app/launch-pack": "launch-einstein",
  "/app/kanban": "launch-einstein",
  // Phase 6: Operations
  "/app/operations": "operations-einstein",
  // Generated outputs
  "/app/website": "location-einstein",
  "/app/about": "location-einstein",
  "/app/rwa": "location-einstein"
  // Legacy /coffee/* routes removed — all routes now under /app/*
};
const PUBLIC_ROUTES = ["/", "/login", "/pending", "/methodology", "/sign-in", "/pricing", "/about", "/contact", "/demo", "/privacy", "/terms"];
const ALL_MODULES = ["location-einstein", "space-einstein", "business-einstein", "loan-einstein", "launch-einstein", "operations-einstein"];
function getModuleForRoute(path) {
  if (ROUTE_MODULE_MAP[path]) return ROUTE_MODULE_MAP[path];
  for (const [route, mod] of Object.entries(ROUTE_MODULE_MAP)) {
    if (path.startsWith(route + "/")) return mod;
  }
  if (path.startsWith("/admin")) return null;
  return null;
}
export {
  ALL_MODULES as A,
  PUBLIC_ROUTES as P,
  SITE_CONFIG as S,
  getModuleForRoute as a,
  fetchPricingTiers as f,
  getAdminEmails as g
};
