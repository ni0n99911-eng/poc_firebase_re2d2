// ─── RE² First-Time Owner Checklist: Shared Data Layer ────────────────────────
// Source of truth for PHASES and ITEMS with full Brain schema.
// The Brain API (GET /api/checklist) serves concept-filtered variants.
// UX can import this directly as a static fallback before API is wired.

export interface ChecklistPhase {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  description?: string;
}

export interface ChecklistItemTemplate {
  id: string;
  phase: string;
  name: string;
  desc: string;
  priority: 'now' | 'soon' | 'later';
  costLow: number;
  costHigh: number;
  weeks: number;
  proType: string | null;
  conceptTags: string[];
  nycSpecific: boolean;
  dependsOn: string[];
}

export type ItemState = ChecklistItemTemplate & {
  done: boolean;
  notes: string;
};

// ── All 6 supported concepts ────────────────────────────────────────────────
export const ALL_CONCEPTS = [
  'specialty_coffee',
  'full_service_restaurant',
  'fast_casual',
  'juice_bar',
  'boutique_retail',
  'fitness_wellness',
  'bar_nightlife',
  'personal_services',
  'medical_office',
  'qsr',
  'coworking',
  'retail',
  'florist',
  'grocery',
  'bakery',
] as const;
export type ConceptType = (typeof ALL_CONCEPTS)[number];

// Shorthand for concept tag arrays
const FOOD = ['specialty_coffee', 'full_service_restaurant', 'fast_casual', 'juice_bar'];
const ALL6 = [...FOOD, 'boutique_retail', 'fitness_wellness'];
const COOKING = ['full_service_restaurant', 'fast_casual']; // concepts needing grease trap / hood

export const PHASES: ChecklistPhase[] = [
  { id: 'entity',    name: 'Legal & Entity',        icon: '⚖️',  color: '#8E44AD', sort_order: 1, description: 'Set up your business structure and professional team' },
  { id: 'lease',     name: 'Lease & Real Estate',    icon: '🏠',  color: '#2E75B6', sort_order: 2, description: 'Secure and negotiate your space' },
  { id: 'design',    name: 'Design & Build-Out',     icon: '🔨',  color: '#E67E22', sort_order: 3, description: 'Plan and construct your space' },
  { id: 'permits',   name: 'Permits & Licenses',     icon: '📋',  color: '#27AE60', sort_order: 4, description: 'Get legal permission to operate' },
  { id: 'finance',   name: 'Financing & Insurance',  icon: '💰',  color: '#F39C12', sort_order: 5, description: 'Fund your business and protect it' },
  { id: 'ops',       name: 'Operations Setup',       icon: '⚙️',  color: '#3498DB', sort_order: 6, description: 'Systems, staff, and suppliers' },
  { id: 'marketing', name: 'Marketing & Pre-Launch', icon: '📣',  color: '#E74C3C', sort_order: 7, description: 'Build awareness before you open' },
  { id: 'opening',   name: 'Opening Week',           icon: '🚀',  color: '#1B3A5C', sort_order: 8, description: 'Final checks and go-live' },
];

export const ALL_ITEMS: ChecklistItemTemplate[] = [
  // ════════════════════════════════════════════════════════════════════════
  // Phase 1: Legal & Entity (universal)
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'ent-01', phase: 'entity',
    name: 'Choose your business structure',
    desc: 'LLC is the most common for restaurants/cafes. Protects personal assets. File with NY Dept of State.',
    priority: 'now', costLow: 200, costHigh: 800, weeks: 1, proType: 'attorney',
    conceptTags: ALL6, nycSpecific: true, dependsOn: [],
  },
  {
    id: 'ent-02', phase: 'entity',
    name: 'Get an EIN from the IRS',
    desc: 'Free. Takes 10 minutes online. Required for bank accounts, hiring, and tax filings.',
    priority: 'now', costLow: 0, costHigh: 0, weeks: 0.1, proType: null,
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'ent-03', phase: 'entity',
    name: 'Register your business name (DBA)',
    desc: 'File with your county clerk. Required if operating under a name different from your LLC.',
    priority: 'now', costLow: 50, costHigh: 150, weeks: 1, proType: null,
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'ent-04', phase: 'entity',
    name: 'Open a business bank account',
    desc: 'Keep personal and business finances separate from day one. Bring EIN, LLC docs, and ID.',
    priority: 'now', costLow: 0, costHigh: 100, weeks: 0.5, proType: null,
    conceptTags: ALL6, nycSpecific: false, dependsOn: ['ent-02'],
  },
  {
    id: 'ent-05', phase: 'entity',
    name: 'Hire a business attorney',
    desc: 'For lease review, entity setup, and regulatory guidance. Critical for first-time owners.',
    priority: 'now', costLow: 2000, costHigh: 5000, weeks: 1, proType: 'attorney',
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'ent-06', phase: 'entity',
    name: 'Hire an accountant / CPA',
    desc: 'Set up bookkeeping from the start. They will handle tax filings, payroll setup, and financial projections.',
    priority: 'now', costLow: 1500, costHigh: 4000, weeks: 1, proType: 'accountant',
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },

  // ════════════════════════════════════════════════════════════════════════
  // Phase 2: Lease & Real Estate (universal)
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'lea-01', phase: 'lease',
    name: 'Have your attorney review the lease',
    desc: 'Never sign without legal review. Key terms: rent escalation, CAM charges, exclusivity clause, assignment rights, personal guarantee.',
    priority: 'now', costLow: 1500, costHigh: 3000, weeks: 2, proType: 'attorney',
    conceptTags: ALL6, nycSpecific: false, dependsOn: ['ent-05'],
  },
  {
    id: 'lea-02', phase: 'lease',
    name: 'Negotiate lease terms',
    desc: 'Push for: 3-6 months free rent during build-out, cap on annual escalation (2-3%), tenant improvement allowance, early termination clause.',
    priority: 'now', costLow: 0, costHigh: 0, weeks: 2, proType: 'broker',
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'lea-03', phase: 'lease',
    name: 'Verify zoning allows your use',
    desc: 'Check with NYC Dept of Buildings that your concept is permitted at this address. Some zones restrict food service, alcohol, or late-night operation.',
    priority: 'now', costLow: 0, costHigh: 500, weeks: 1, proType: 'expediter',
    conceptTags: ALL6, nycSpecific: true, dependsOn: [],
  },
  {
    id: 'lea-04', phase: 'lease',
    name: 'Get a property condition assessment',
    desc: 'Before signing: check plumbing, electrical, HVAC, grease trap, ventilation. Hidden issues can add $50K+ to build-out.',
    priority: 'now', costLow: 500, costHigh: 2000, weeks: 1, proType: 'contractor',
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },

  // ════════════════════════════════════════════════════════════════════════
  // Phase 3: Design & Build-Out
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'des-01', phase: 'design',
    name: 'Hire an architect',
    desc: 'Required for DOB permits. They design the layout, create construction drawings, and file with the city. Get 3 quotes.',
    priority: 'soon', costLow: 8000, costHigh: 25000, weeks: 4, proType: 'architect',
    conceptTags: ALL6, nycSpecific: true, dependsOn: [],
  },
  {
    id: 'des-02', phase: 'design',
    name: 'Hire a general contractor',
    desc: 'Manages the build-out. Get 3 bids based on architect drawings. Check references and insurance. Never pay more than 30% upfront.',
    priority: 'soon', costLow: 40000, costHigh: 150000, weeks: 8, proType: 'contractor',
    conceptTags: ALL6, nycSpecific: false, dependsOn: ['des-01'],
  },
  {
    id: 'des-03', phase: 'design',
    name: 'Design your kitchen layout',
    desc: 'Work with a kitchen consultant or your equipment vendor. Flow matters: receiving → storage → prep → cook → plate → serve → wash.',
    priority: 'soon', costLow: 2000, costHigh: 8000, weeks: 2, proType: 'kitchen_consultant',
    conceptTags: FOOD, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'des-04', phase: 'design',
    name: 'Select equipment and fixtures',
    desc: 'Espresso machine, grinder, refrigeration, POS system, furniture, lighting. New vs. used. Lease vs. buy.',
    priority: 'soon', costLow: 15000, costHigh: 80000, weeks: 3, proType: 'equipment_vendor',
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'des-05', phase: 'design',
    name: 'Plan your brand identity',
    desc: 'Logo, color palette, typography, menu design, signage. This defines how customers experience your space.',
    priority: 'soon', costLow: 2000, costHigh: 10000, weeks: 3, proType: 'designer',
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },

  // ════════════════════════════════════════════════════════════════════════
  // Phase 4: Permits & Licenses
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'per-01', phase: 'permits',
    name: 'DOB work permit (alteration type)',
    desc: 'Required before any construction begins. Your architect files this. Timeline: 2-8 weeks depending on scope.',
    priority: 'soon', costLow: 1000, costHigh: 5000, weeks: 4, proType: 'expediter',
    conceptTags: ALL6, nycSpecific: true, dependsOn: ['des-01'],
  },
  {
    id: 'per-02', phase: 'permits',
    name: 'DOHMH food service permit',
    desc: 'Required to serve food in NYC. Apply through NYC Business Express. Includes initial inspection.',
    priority: 'soon', costLow: 200, costHigh: 500, weeks: 4, proType: 'expediter',
    conceptTags: FOOD, nycSpecific: true, dependsOn: [],
  },
  {
    id: 'per-03', phase: 'permits',
    name: 'Certificate of Occupancy verification',
    desc: 'Confirm the C of O matches your intended use. If not, you need an alteration — adds time and cost.',
    priority: 'now', costLow: 0, costHigh: 1000, weeks: 1, proType: 'expediter',
    conceptTags: ALL6, nycSpecific: true, dependsOn: [],
  },
  {
    id: 'per-04', phase: 'permits',
    name: 'Food protection certificate',
    desc: 'At least one person on staff must complete the NYC food handler course and pass the exam.',
    priority: 'later', costLow: 50, costHigh: 150, weeks: 1, proType: null,
    conceptTags: FOOD, nycSpecific: true, dependsOn: [],
  },
  {
    id: 'per-05', phase: 'permits',
    name: 'Liquor license (if applicable)',
    desc: 'Apply through NYS Liquor Authority. Beer/wine: $1K, 2-4 months. Full liquor: $4.5K, 6-12 months. Start early.',
    priority: 'soon', costLow: 1000, costHigh: 5000, weeks: 16, proType: 'attorney',
    conceptTags: ['specialty_coffee', 'full_service_restaurant', 'fast_casual'], nycSpecific: true, dependsOn: [],
  },
  {
    id: 'per-06', phase: 'permits',
    name: 'Sidewalk cafe permit (if applicable)',
    desc: 'DCA permit for outdoor seating. Seasonal and year-round options. Apply through NYC Open Restaurants.',
    priority: 'later', costLow: 500, costHigh: 2000, weeks: 6, proType: null,
    conceptTags: FOOD, nycSpecific: true, dependsOn: [],
  },
  {
    id: 'per-07', phase: 'permits',
    name: 'Sign permit (DOB/DOT)',
    desc: 'Exterior signage requires a DOB permit. Illuminated signs have additional requirements.',
    priority: 'later', costLow: 200, costHigh: 1000, weeks: 3, proType: null,
    conceptTags: ALL6, nycSpecific: true, dependsOn: [],
  },

  // ════════════════════════════════════════════════════════════════════════
  // Phase 5: Financing & Insurance (universal)
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'fin-01', phase: 'finance',
    name: 'Finalize your startup budget',
    desc: 'Add up everything: entity costs, lease deposits, build-out, equipment, permits, 6-month operating reserve. RE² Business Case has your numbers.',
    priority: 'now', costLow: 0, costHigh: 0, weeks: 0.5, proType: null,
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'fin-02', phase: 'finance',
    name: 'Apply for SBA loan (if needed)',
    desc: 'SBA 7(a) for general business, SBA 504 for real estate/equipment. Need: business plan, financial projections, personal financial statement.',
    priority: 'soon', costLow: 0, costHigh: 0, weeks: 6, proType: 'lender',
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'fin-03', phase: 'finance',
    name: 'Get general liability insurance',
    desc: 'Required before opening. Covers slip-and-fall, property damage, product liability. $2K-5K/year for a cafe.',
    priority: 'soon', costLow: 2000, costHigh: 5000, weeks: 1, proType: 'insurance',
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'fin-04', phase: 'finance',
    name: 'Get workers compensation insurance',
    desc: 'Required by law in NY if you have any employees. Get quotes from 3 providers.',
    priority: 'soon', costLow: 2000, costHigh: 8000, weeks: 1, proType: 'insurance',
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'fin-05', phase: 'finance',
    name: 'Set up payroll',
    desc: 'Use Gusto, ADP, or similar. Handles tax withholding, direct deposit, W-2s. Set up before your first hire.',
    priority: 'later', costLow: 500, costHigh: 1500, weeks: 0.5, proType: null,
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },

  // ════════════════════════════════════════════════════════════════════════
  // Phase 6: Operations Setup
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'ops-01', phase: 'ops',
    name: 'Choose and set up POS system',
    desc: 'Square, Toast, Clover, or Lightspeed. Consider: menu complexity, tip handling, reporting, inventory, online ordering integration.',
    priority: 'soon', costLow: 500, costHigh: 3000, weeks: 1, proType: 'pos_vendor',
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'ops-02', phase: 'ops',
    name: 'Build your menu and price it',
    desc: 'Cost every item. Target food cost: 28-35%. Price to hit your daily target from the Business Case. Test recipes for consistency.',
    priority: 'soon', costLow: 0, costHigh: 2000, weeks: 2, proType: 'consultant',
    conceptTags: FOOD, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'ops-03', phase: 'ops',
    name: 'Find and vet suppliers',
    desc: 'Coffee roaster, dairy, baked goods, paper goods, cleaning supplies. Get samples. Negotiate terms. Set up accounts.',
    priority: 'soon', costLow: 0, costHigh: 500, weeks: 2, proType: null,
    conceptTags: FOOD, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'ops-04', phase: 'ops',
    name: 'Hire your team',
    desc: 'Start with key hires: manager, lead barista/chef. Post on Indeed, Culinary Agents, or Poached. Budget 2-3 weeks for training.',
    priority: 'later', costLow: 1000, costHigh: 3000, weeks: 4, proType: null,
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'ops-05', phase: 'ops',
    name: 'Write your operations manual',
    desc: 'Opening/closing procedures, recipes, food safety, customer service standards, cash handling. RE² can generate this for you.',
    priority: 'later', costLow: 0, costHigh: 0, weeks: 1, proType: null,
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'ops-06', phase: 'ops',
    name: 'Set up accounting and inventory tracking',
    desc: 'QuickBooks or Xero for accounting. MarketMan, BlueCart, or manual spreadsheet for inventory. Track from day one.',
    priority: 'later', costLow: 300, costHigh: 1500, weeks: 1, proType: 'accountant',
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },

  // ════════════════════════════════════════════════════════════════════════
  // Phase 7: Marketing & Pre-Launch (universal)
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'mkt-01', phase: 'marketing',
    name: 'Claim your Google Business profile',
    desc: 'Free. Critical for local search. Add photos, hours, menu. Do this as soon as you have a location confirmed.',
    priority: 'soon', costLow: 0, costHigh: 0, weeks: 0.5, proType: null,
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'mkt-02', phase: 'marketing',
    name: 'Set up Instagram and build hype',
    desc: 'Post build-out progress, behind-the-scenes, menu previews. Target 500+ followers before opening. Engage with local accounts.',
    priority: 'soon', costLow: 0, costHigh: 1000, weeks: 4, proType: 'marketing',
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'mkt-03', phase: 'marketing',
    name: 'Build a simple website',
    desc: 'One-pager: location, hours, menu, story, contact. Use Squarespace or a free template.',
    priority: 'later', costLow: 0, costHigh: 2000, weeks: 1, proType: 'designer',
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'mkt-04', phase: 'marketing',
    name: 'Plan your soft opening',
    desc: 'Invite friends, family, neighbors for 3-5 days before public opening. Iron out systems, train staff under real conditions, collect feedback.',
    priority: 'later', costLow: 500, costHigh: 2000, weeks: 1, proType: null,
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },

  // ════════════════════════════════════════════════════════════════════════
  // Phase 8: Opening Week
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'opn-01', phase: 'opening',
    name: 'Final DOH inspection',
    desc: 'Schedule with DOHMH. Inspector checks: food temps, hand-washing stations, pest control, refrigeration, fire suppression. Must pass to open.',
    priority: 'later', costLow: 0, costHigh: 0, weeks: 1, proType: null,
    conceptTags: FOOD, nycSpecific: true, dependsOn: [],
  },
  {
    id: 'opn-02', phase: 'opening',
    name: 'Staff training and dry runs',
    desc: '3-5 days of full service rehearsal with no paying customers. Practice every scenario: rush hour, equipment failure, difficult customer.',
    priority: 'later', costLow: 1000, costHigh: 3000, weeks: 1, proType: null,
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'opn-03', phase: 'opening',
    name: 'Soft opening (3-5 days)',
    desc: 'Limited hours, limited menu. Fix problems in private. Adjust recipes, timing, staffing levels based on real service.',
    priority: 'later', costLow: 500, costHigh: 1500, weeks: 1, proType: null,
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },
  {
    id: 'opn-04', phase: 'opening',
    name: 'Grand opening',
    desc: 'Go public. Post on social, invite local press, offer a first-day special. Have extra staff scheduled. Expect chaos. Embrace it.',
    priority: 'later', costLow: 500, costHigh: 3000, weeks: 0.5, proType: null,
    conceptTags: ALL6, nycSpecific: false, dependsOn: [],
  },

  // ════════════════════════════════════════════════════════════════════════
  // Concept-Specific Extra Items
  // ════════════════════════════════════════════════════════════════════════

  // ── Full-Service Restaurant / Fast Casual extras ──
  {
    id: 'fsr-01', phase: 'design',
    name: 'Install grease trap',
    desc: 'Required by DEP for any food establishment with cooking. Size depends on kitchen output. Professional install + DEP registration.',
    priority: 'soon', costLow: 3000, costHigh: 8000, weeks: 2, proType: 'contractor',
    conceptTags: COOKING, nycSpecific: true, dependsOn: ['des-02'],
  },
  {
    id: 'fsr-02', phase: 'design',
    name: 'Install Ansul fire suppression system',
    desc: 'Required for commercial kitchens with cooking equipment. Hood-mounted suppression. Must be installed by licensed contractor.',
    priority: 'soon', costLow: 4000, costHigh: 12000, weeks: 2, proType: 'contractor',
    conceptTags: COOKING, nycSpecific: true, dependsOn: ['des-02'],
  },
  {
    id: 'fsr-03', phase: 'design',
    name: 'Install commercial hood ventilation',
    desc: 'Type I hood for grease-laden vapors (cooking), Type II for steam/heat. Sized to kitchen equipment. Requires HVAC engineer sign-off.',
    priority: 'soon', costLow: 5000, costHigh: 20000, weeks: 3, proType: 'contractor',
    conceptTags: COOKING, nycSpecific: true, dependsOn: ['des-01'],
  },

  // ── Juice Bar extras ──
  {
    id: 'jb-01', phase: 'design',
    name: 'Source commercial juice press equipment',
    desc: 'Cold-press hydraulic press, centrifugal juicers, blenders. Budget for maintenance contracts. Consider lease vs. buy.',
    priority: 'soon', costLow: 5000, costHigh: 25000, weeks: 2, proType: 'equipment_vendor',
    conceptTags: ['juice_bar'], nycSpecific: false, dependsOn: [],
  },
  {
    id: 'jb-02', phase: 'permits',
    name: 'Cold-press production licensing',
    desc: 'If bottling for retail sale, may need separate FDA/state manufacturing license. HACCP plan required for wholesale.',
    priority: 'soon', costLow: 500, costHigh: 2000, weeks: 4, proType: 'expediter',
    conceptTags: ['juice_bar'], nycSpecific: true, dependsOn: [],
  },

  // ── Boutique Retail extras ──
  {
    id: 'br-01', phase: 'permits',
    name: 'Certificate of Authority (sales tax)',
    desc: 'Register with NYS Dept of Taxation for sales tax collection. Required before your first sale. Free to obtain.',
    priority: 'now', costLow: 0, costHigh: 0, weeks: 1, proType: null,
    conceptTags: ['boutique_retail'], nycSpecific: true, dependsOn: [],
  },
  {
    id: 'br-02', phase: 'permits',
    name: 'Sales tax registration and setup',
    desc: 'Configure POS for NYS sales tax rates. Set up quarterly filing schedule. Your CPA should handle ongoing compliance.',
    priority: 'soon', costLow: 0, costHigh: 500, weeks: 0.5, proType: 'accountant',
    conceptTags: ['boutique_retail'], nycSpecific: true, dependsOn: ['br-01'],
  },

  // ── Fitness & Wellness extras ──
  {
    id: 'fw-01', phase: 'permits',
    name: 'DOHMH body work license',
    desc: 'Required in NYC for massage therapy, acupuncture, and related body work services. Apply through NYC Business Express.',
    priority: 'now', costLow: 200, costHigh: 500, weeks: 4, proType: 'expediter',
    conceptTags: ['fitness_wellness'], nycSpecific: true, dependsOn: [],
  },
  {
    id: 'fw-02', phase: 'ops',
    name: 'Create liability waiver template',
    desc: 'Have your attorney draft a comprehensive liability waiver. Must cover injury, health conditions, and equipment use. Require before first session.',
    priority: 'now', costLow: 500, costHigh: 1500, weeks: 1, proType: 'attorney',
    conceptTags: ['fitness_wellness'], nycSpecific: false, dependsOn: [],
  },
  {
    id: 'fw-03', phase: 'ops',
    name: 'Equipment safety certifications',
    desc: 'All fitness equipment must meet safety standards. Schedule annual inspection. Maintain service records. Post safety instructions.',
    priority: 'soon', costLow: 500, costHigh: 2000, weeks: 2, proType: null,
    conceptTags: ['fitness_wellness'], nycSpecific: false, dependsOn: [],
  },

  // ════════════════════════════════════════════════════════════════════════
  // Doc 09: Concept-specific items from Business Intelligence KB
  // ════════════════════════════════════════════════════════════════════════

  // ── Bar / Nightlife ──
  {
    id: 'bar-01', phase: 'permits',
    name: 'Verify NYS SLA 200-ft school/church rule',
    desc: 'ABSOLUTE bar on liquor license if a school or church entrance is within 200 ft on same street. No exceptions. Verify with SLA BEFORE signing a lease.',
    priority: 'now', costLow: 0, costHigh: 500, weeks: 1, proType: 'attorney',
    conceptTags: ['bar_nightlife', 'full_service_restaurant'], nycSpecific: true, dependsOn: [],
  },
  {
    id: 'bar-02', phase: 'permits',
    name: 'Check 500-ft liquor license clustering',
    desc: 'If 3+ on-premises liquor licenses exist within 500 ft, SLA requires Community Board approval ("public interest" review). Timeline: 30+ days.',
    priority: 'now', costLow: 0, costHigh: 0, weeks: 0.5, proType: null,
    conceptTags: ['bar_nightlife'], nycSpecific: true, dependsOn: [],
  },
  {
    id: 'bar-03', phase: 'design',
    name: 'Soundproofing assessment (if residential above)',
    desc: 'Noise complaints from residents above can shut you down. Budget $10K-$30K for soundproofing if residential units above or adjacent.',
    priority: 'soon', costLow: 10000, costHigh: 30000, weeks: 3, proType: 'contractor',
    conceptTags: ['bar_nightlife'], nycSpecific: false, dependsOn: [],
  },

  // ── Salon / Barbershop ──
  {
    id: 'sal-01', phase: 'permits',
    name: 'Cosmetology or barber license verification',
    desc: 'NY requires 1,000 hours training + state exams for cosmetology. Natural hair styling: 300 hours. All operators must be individually licensed. Salon itself needs a separate permit from NY Dept of State.',
    priority: 'now', costLow: 200, costHigh: 1000, weeks: 2, proType: null,
    conceptTags: ['personal_services'], nycSpecific: true, dependsOn: [],
  },
  {
    id: 'sal-02', phase: 'design',
    name: 'Plumbing upgrade for shampoo stations',
    desc: 'Shampoo stations require dedicated hot/cold water lines and drainage. Verify plumbing capacity before signing lease — retrofit cost can be $5K-$15K.',
    priority: 'soon', costLow: 5000, costHigh: 15000, weeks: 3, proType: 'plumber',
    conceptTags: ['personal_services'], nycSpecific: false, dependsOn: [],
  },
  {
    id: 'sal-03', phase: 'design',
    name: 'Ventilation system for chemical odors',
    desc: 'Hair color and perm chemicals require proper ventilation. NYC DOB and fire code have specific requirements. Factor into buildout design.',
    priority: 'soon', costLow: 3000, costHigh: 8000, weeks: 2, proType: 'contractor',
    conceptTags: ['personal_services'], nycSpecific: true, dependsOn: [],
  },

  // ── Med Spa ──
  {
    id: 'med-01', phase: 'entity',
    name: 'Secure NY-licensed Medical Director (MD/DO)',
    desc: 'REQUIRED: Medical Director must be NY-licensed MD or DO — CANNOT be a PA. "Real, not nominal" oversight required. All clinical services must flow through physician-owned PC or PLLC (NY Education Law §6522). Cost: $50K-$150K/yr. 87 citations in 223 inspections in 2026.',
    priority: 'now', costLow: 50000, costHigh: 150000, weeks: 8, proType: 'healthcare attorney',
    conceptTags: ['medical_office'], nycSpecific: true, dependsOn: [],
  },
  {
    id: 'med-02', phase: 'permits',
    name: 'HIPAA compliance setup',
    desc: 'All patient records and treatment photos must be HIPAA-secured. Setup cost $3K-$10K including software, training, and physical safeguards.',
    priority: 'now', costLow: 3000, costHigh: 10000, weeks: 4, proType: 'HIPAA consultant',
    conceptTags: ['medical_office'], nycSpecific: false, dependsOn: [],
  },
  {
    id: 'med-03', phase: 'finance',
    name: 'Malpractice insurance ($1M/$3M limits)',
    desc: 'General liability does NOT cover medical procedures. Malpractice insurance with $1M/$3M limits is REQUIRED. Cost: $5K-$7.5K/yr.',
    priority: 'now', costLow: 5000, costHigh: 7500, weeks: 2, proType: 'insurance broker',
    conceptTags: ['medical_office'], nycSpecific: false, dependsOn: ['med-01'],
  },
  {
    id: 'med-04', phase: 'design',
    name: 'Medical-grade HVAC and waste disposal',
    desc: 'Treatment rooms need medical-grade HVAC for air quality. Medical waste disposal service required for injectables and biohazard materials.',
    priority: 'soon', costLow: 8000, costHigh: 25000, weeks: 4, proType: 'contractor',
    conceptTags: ['medical_office'], nycSpecific: false, dependsOn: [],
  },

  // ── Restaurant/Cafe buildout specifics ──
  {
    id: 'fb-hood', phase: 'design',
    name: 'Install commercial exhaust hood + Ansul fire suppression',
    desc: 'Required for any cooking operation. Hood system: $12K-$15K ($1K-$1.5K per linear foot). Ansul fire suppression system required by FDNY. Must be installed before C of O inspection.',
    priority: 'now', costLow: 12000, costHigh: 20000, weeks: 4, proType: 'contractor',
    conceptTags: ['full_service_restaurant', 'fast_casual', 'specialty_coffee'], nycSpecific: true, dependsOn: [],
  },

  // ── Fitness buildout specifics ──
  {
    id: 'fit-floor', phase: 'design',
    name: 'Reinforced flooring for heavy equipment',
    desc: 'Weight rooms, reformer studios, and CrossFit boxes need reinforced floors. Standard commercial flooring may not support heavy equipment drops. Verify load capacity with structural engineer.',
    priority: 'soon', costLow: 5000, costHigh: 20000, weeks: 3, proType: 'structural engineer',
    conceptTags: ['fitness_wellness'], nycSpecific: false, dependsOn: [],
  },

  // ── FLORIST: Doc09 concept-specific items ─────────────────────────────────
  {
    id: 'flo-01', phase: 'design',
    name: 'Walk-in cooler installation (34–38°F)',
    desc: 'Temperature control is critical for flower preservation. Walk-in cooler must maintain 34–38°F. Every hour outside cooler accelerates wilting. Budget $5K–$15K.',
    priority: 'now', costLow: 5000, costHigh: 15000, weeks: 3, proType: 'HVAC contractor',
    conceptTags: ['florist'], nycSpecific: false, dependsOn: [],
  },
  {
    id: 'flo-02', phase: 'design',
    name: 'Display cooler for retail area',
    desc: 'Separate display cooler for customer-facing arrangements. Budget $2K–$5K. Critical for impulse walk-in sales which are ~40% of revenue.',
    priority: 'soon', costLow: 2000, costHigh: 5000, weeks: 2, proType: null,
    conceptTags: ['florist'], nycSpecific: false, dependsOn: [],
  },
  {
    id: 'flo-03', phase: 'ops',
    name: 'Establish wholesale vendor relationships (28th St Flower District)',
    desc: 'NYC: West 28th St between 6th and 7th Ave — 100+ year old wholesale market. Wholesale before 8 AM, retail after. Key vendors: New York Flower Group, Holly Rose Wholesale, CFD Flower. Early-morning visits required for best selection.',
    priority: 'now', costLow: 0, costHigh: 500, weeks: 2, proType: null,
    conceptTags: ['florist'], nycSpecific: true, dependsOn: [],
  },
  {
    id: 'flo-04', phase: 'ops',
    name: 'Valentine\'s Day prep plan (30–35% of annual revenue)',
    desc: 'Valentine\'s Day is 30–35% of annual florist income in ONE WEEK. Revenue can be 5–10x a normal weekend. Start planning 3 months ahead: pre-orders, temp staff, extended hours, delivery logistics.',
    priority: 'soon', costLow: 5000, costHigh: 15000, weeks: 4, proType: null,
    conceptTags: ['florist'], nycSpecific: false, dependsOn: [],
  },

  // ── GROCERY: Doc09 concept-specific items ─────────────────────────────────
  {
    id: 'gro-01', phase: 'permits',
    name: 'SNAP/EBT certification',
    desc: 'If serving lower-income neighborhoods (>30% SNAP-eligible), EBT acceptance is essential for viability. Guarantees base demand but adds margin pressure. Apply through USDA FNS.',
    priority: 'soon', costLow: 0, costHigh: 500, weeks: 4, proType: null,
    conceptTags: ['grocery'], nycSpecific: false, dependsOn: [],
  },
  {
    id: 'gro-02', phase: 'ops',
    name: 'Shrinkage control system (inventory management)',
    desc: 'Shrinkage costs 5–10% of inventory value ($70K–$140K on $1.4M). 65% is theft, 29% employee theft. Implement inventory tracking, camera system, and produce waste monitoring. Target <5% total shrinkage.',
    priority: 'now', costLow: 3000, costHigh: 15000, weeks: 3, proType: null,
    conceptTags: ['grocery'], nycSpecific: false, dependsOn: [],
  },
  {
    id: 'gro-03', phase: 'design',
    name: 'Loading dock / delivery access verification',
    desc: 'Grocery requires regular large deliveries. Verify loading dock access, delivery time windows (NYC has overnight delivery restrictions in residential areas), and truck clearance. No loading access = operational nightmare.',
    priority: 'now', costLow: 0, costHigh: 5000, weeks: 1, proType: null,
    conceptTags: ['grocery'], nycSpecific: true, dependsOn: [],
  },
  {
    id: 'gro-04', phase: 'design',
    name: 'Heavy-duty commercial refrigeration',
    desc: 'Walk-in cooler, display cases, freezer units — grocery needs significantly more refrigeration than any other concept. Budget $15K–$40K initial + $3K–$8K/yr maintenance. Verify electrical panel capacity.',
    priority: 'now', costLow: 15000, costHigh: 40000, weeks: 4, proType: 'refrigeration contractor',
    conceptTags: ['grocery'], nycSpecific: false, dependsOn: [],
  },

  // ── BAKERY: Doc09 concept-specific items ──────────────────────────────────
  {
    id: 'bak-01', phase: 'design',
    name: 'Type II exhaust hood for commercial ovens',
    desc: 'Required for commercial baking ovens. Cost: $5K–$15K ($1K–$1.5K per linear foot). Must meet NYC fire code. Plan hood location before finalizing kitchen layout.',
    priority: 'now', costLow: 5000, costHigh: 15000, weeks: 3, proType: 'HVAC contractor',
    conceptTags: ['bakery'], nycSpecific: false, dependsOn: [],
  },
  {
    id: 'bak-02', phase: 'design',
    name: 'Verify electrical panel capacity for commercial ovens',
    desc: 'Commercial deck ovens, proofers, and mixers draw heavy power. Standard 200A panels may not suffice. Verify with electrician before signing lease — panel upgrade costs $3K–$8K.',
    priority: 'now', costLow: 0, costHigh: 8000, weeks: 2, proType: 'electrician',
    conceptTags: ['bakery'], nycSpecific: false, dependsOn: [],
  },
  {
    id: 'bak-03', phase: 'ops',
    name: 'Waste reduction plan (24–72hr shelf life)',
    desc: 'Baked goods have 24–72 hour shelf life — unsold product is total loss. Implement: pre-order system, daily production tracking, end-of-day discount strategy, wholesale/cafe partnerships for surplus.',
    priority: 'soon', costLow: 0, costHigh: 1000, weeks: 2, proType: null,
    conceptTags: ['bakery'], nycSpecific: false, dependsOn: [],
  },

  // ── RESTAURANT: Doc09 concept-specific items ──────────────────────────────
  {
    id: 'rst-01', phase: 'design',
    name: 'Ansul fire suppression system for kitchen',
    desc: 'Required for all commercial kitchens with cooking equipment. Automatic fire suppression over cooking surfaces. Budget included in hood system cost but must be inspected every 6 months.',
    priority: 'now', costLow: 3000, costHigh: 8000, weeks: 2, proType: 'fire protection contractor',
    conceptTags: ['full_service_restaurant', 'fast_casual'], nycSpecific: false, dependsOn: [],
  },
  {
    id: 'rst-02', phase: 'ops',
    name: 'Health Department Grade A prep plan',
    desc: 'NYC DOH Letter Grade system: A (0–13 pts), B (14–27), C (28+). A Grade = 9.3% revenue boost citywide. Pre-opening inspection prep: pest control, food temp logs, handwashing stations, employee training.',
    priority: 'now', costLow: 500, costHigh: 3000, weeks: 2, proType: null,
    conceptTags: ['full_service_restaurant', 'fast_casual', 'specialty_coffee'], nycSpecific: true, dependsOn: [],
  },
  {
    id: 'rst-03', phase: 'ops',
    name: 'Reservation no-show mitigation policy',
    desc: 'No-shows cost the average restaurant ~$78K/yr at 5% rate on 100 weekly reservations. Implement: credit card holds, confirmation texts, waitlist system, overbooking strategy.',
    priority: 'later', costLow: 0, costHigh: 500, weeks: 1, proType: null,
    conceptTags: ['full_service_restaurant'], nycSpecific: false, dependsOn: [],
  },

  // ── FITNESS: Doc09 additional items ───────────────────────────────────────
  {
    id: 'fit-02', phase: 'ops',
    name: 'Equipment maintenance schedule (3–5% of equipment value/yr)',
    desc: 'Fitness equipment degrades with heavy use. Budget 3–5% of equipment value annually for maintenance. Treadmill belts, cable replacements, upholstery repair. Create preventive maintenance calendar.',
    priority: 'soon', costLow: 3000, costHigh: 15000, weeks: 1, proType: null,
    conceptTags: ['fitness_wellness'], nycSpecific: false, dependsOn: [],
  },
  {
    id: 'fit-03', phase: 'finance',
    name: 'CrossFit affiliate fee (if applicable)',
    desc: 'CrossFit boxes require annual affiliate fee of $4,500/yr to use the CrossFit name. Without it, you cannot market as CrossFit. Consider whether the brand premium justifies the cost.',
    priority: 'soon', costLow: 4500, costHigh: 4500, weeks: 1, proType: null,
    conceptTags: ['fitness_wellness'], nycSpecific: false, dependsOn: [],
  },
  {
    id: 'fit-04', phase: 'ops',
    name: 'January retention plan (50% of annual signups, 40–50% churn by March)',
    desc: 'January drives 50% of annual signups but 40–50% churn by March. Invest in retention systems NOW: 30-day check-ins, goal-setting sessions, community events, referral incentives. ClassPass: use for acquisition only, convert to direct membership within 3–6 months.',
    priority: 'soon', costLow: 0, costHigh: 2000, weeks: 2, proType: null,
    conceptTags: ['fitness_wellness'], nycSpecific: false, dependsOn: [],
  },
];

// ── Convenience: filter items for a concept (client-side fallback) ────────────
export function getItemsForConcept(concept: string): ChecklistItemTemplate[] {
  return ALL_ITEMS.filter(
    (item) => item.conceptTags.length === 0 || item.conceptTags.includes(concept),
  );
}

// ── Legacy compat: BaseItem type alias ──────────────────────────────────────
/** @deprecated Use ChecklistItemTemplate instead */
export type BaseItem = ChecklistItemTemplate;
/** @deprecated Use ALL_ITEMS instead */
export const BASE_ITEMS = ALL_ITEMS;
