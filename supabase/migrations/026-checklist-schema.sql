-- ═══════════════════════════════════════════════════════════════════════════════
-- RE² Migration 026: First-Time Owner Checklist Schema
-- ═══════════════════════════════════════════════════════════════════════════════
-- Tables: checklist_phases, checklist_templates, checklist_progress
-- RLS: Users manage their own progress rows only
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Phase definitions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checklist_phases (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  color       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL,
  description TEXT
);

-- ── 2. Template items (master catalog) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS checklist_templates (
  id           TEXT PRIMARY KEY,
  phase        TEXT NOT NULL REFERENCES checklist_phases(id),
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  priority     TEXT NOT NULL CHECK (priority IN ('now', 'soon', 'later')),
  cost_low     INTEGER NOT NULL DEFAULT 0,
  cost_high    INTEGER NOT NULL DEFAULT 0,
  weeks        NUMERIC(4,1) NOT NULL DEFAULT 0,
  pro_type     TEXT,
  concept_tags TEXT[] DEFAULT '{}',
  nyc_specific BOOLEAN DEFAULT true,
  depends_on   TEXT[] DEFAULT '{}',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ── 3. User progress (per location × item) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS checklist_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  location_id  TEXT NOT NULL,
  item_id      TEXT NOT NULL REFERENCES checklist_templates(id),
  done         BOOLEAN DEFAULT false,
  notes        TEXT DEFAULT '',
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, location_id, item_id)
);

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE checklist_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own checklist progress"
  ON checklist_progress FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Templates and phases are read-only for all authenticated users
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read templates"
  ON checklist_templates FOR SELECT
  USING (true);

ALTER TABLE checklist_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read phases"
  ON checklist_phases FOR SELECT
  USING (true);

-- ── 5. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX idx_checklist_progress_user_location
  ON checklist_progress(user_id, location_id);

CREATE INDEX idx_checklist_templates_phase
  ON checklist_templates(phase);

CREATE INDEX idx_checklist_templates_concept_tags
  ON checklist_templates USING GIN(concept_tags);

-- ── 6. Seed: Phases ─────────────────────────────────────────────────────────
INSERT INTO checklist_phases (id, name, icon, color, sort_order, description) VALUES
  ('entity',    'Legal & Entity',        '⚖️',  '#8E44AD', 1, 'Set up your business structure and professional team'),
  ('lease',     'Lease & Real Estate',    '🏠',  '#2E75B6', 2, 'Secure and negotiate your space'),
  ('design',    'Design & Build-Out',     '🔨',  '#E67E22', 3, 'Plan and construct your space'),
  ('permits',   'Permits & Licenses',     '📋',  '#27AE60', 4, 'Get legal permission to operate'),
  ('finance',   'Financing & Insurance',  '💰',  '#F39C12', 5, 'Fund your business and protect it'),
  ('ops',       'Operations Setup',       '⚙️',  '#3498DB', 6, 'Systems, staff, and suppliers'),
  ('marketing', 'Marketing & Pre-Launch', '📣',  '#E74C3C', 7, 'Build awareness before you open'),
  ('opening',   'Opening Week',           '🚀',  '#1B3A5C', 8, 'Final checks and go-live')
ON CONFLICT (id) DO NOTHING;

-- ── 7. Seed: Baseline items (specialty_coffee default) ──────────────────────
-- Universal items get all 6 concept tags.
-- Food-service items exclude boutique_retail.
-- concept_tags key:
--   sc = specialty_coffee, fsr = full_service_restaurant, fc = fast_casual,
--   jb = juice_bar, br = boutique_retail, fw = fitness_wellness

INSERT INTO checklist_templates (id, phase, name, description, priority, cost_low, cost_high, weeks, pro_type, concept_tags, nyc_specific, depends_on, sort_order) VALUES
  -- ── Legal & Entity (universal) ──
  ('ent-01', 'entity', 'Choose your business structure',
   'LLC is the most common for restaurants/cafes. Protects personal assets. File with NY Dept of State.',
   'now', 200, 800, 1, 'attorney',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', true, '{}', 1),

  ('ent-02', 'entity', 'Get an EIN from the IRS',
   'Free. Takes 10 minutes online. Required for bank accounts, hiring, and tax filings.',
   'now', 0, 0, 0.1, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 2),

  ('ent-03', 'entity', 'Register your business name (DBA)',
   'File with your county clerk. Required if operating under a name different from your LLC.',
   'now', 50, 150, 1, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 3),

  ('ent-04', 'entity', 'Open a business bank account',
   'Keep personal and business finances separate from day one. Bring EIN, LLC docs, and ID.',
   'now', 0, 100, 0.5, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{ent-02}', 4),

  ('ent-05', 'entity', 'Hire a business attorney',
   'For lease review, entity setup, and regulatory guidance. Critical for first-time owners.',
   'now', 2000, 5000, 1, 'attorney',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 5),

  ('ent-06', 'entity', 'Hire an accountant / CPA',
   'Set up bookkeeping from the start. They will handle tax filings, payroll setup, and financial projections.',
   'now', 1500, 4000, 1, 'accountant',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 6),

  -- ── Lease & Real Estate (universal) ──
  ('lea-01', 'lease', 'Have your attorney review the lease',
   'Never sign without legal review. Key terms: rent escalation, CAM charges, exclusivity clause, assignment rights, personal guarantee.',
   'now', 1500, 3000, 2, 'attorney',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{ent-05}', 1),

  ('lea-02', 'lease', 'Negotiate lease terms',
   'Push for: 3-6 months free rent during build-out, cap on annual escalation (2-3%), tenant improvement allowance, early termination clause.',
   'now', 0, 0, 2, 'broker',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 2),

  ('lea-03', 'lease', 'Verify zoning allows your use',
   'Check with NYC Dept of Buildings that your concept is permitted at this address. Some zones restrict food service, alcohol, or late-night operation.',
   'now', 0, 500, 1, 'expediter',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', true, '{}', 3),

  ('lea-04', 'lease', 'Get a property condition assessment',
   'Before signing: check plumbing, electrical, HVAC, grease trap, ventilation. Hidden issues can add $50K+ to build-out.',
   'now', 500, 2000, 1, 'contractor',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 4),

  -- ── Design & Build-Out ──
  ('des-01', 'design', 'Hire an architect',
   'Required for DOB permits. They design the layout, create construction drawings, and file with the city. Get 3 quotes.',
   'soon', 8000, 25000, 4, 'architect',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', true, '{}', 1),

  ('des-02', 'design', 'Hire a general contractor',
   'Manages the build-out. Get 3 bids based on architect drawings. Check references and insurance. Never pay more than 30% upfront.',
   'soon', 40000, 150000, 8, 'contractor',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{des-01}', 2),

  ('des-03', 'design', 'Design your kitchen layout',
   'Work with a kitchen consultant or your equipment vendor. Flow matters: receiving → storage → prep → cook → plate → serve → wash.',
   'soon', 2000, 8000, 2, 'kitchen_consultant',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar}', false, '{}', 3),

  ('des-04', 'design', 'Select equipment and fixtures',
   'Espresso machine, grinder, refrigeration, POS system, furniture, lighting. New vs. used. Lease vs. buy.',
   'soon', 15000, 80000, 3, 'equipment_vendor',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 4),

  ('des-05', 'design', 'Plan your brand identity',
   'Logo, color palette, typography, menu design, signage. This defines how customers experience your space.',
   'soon', 2000, 10000, 3, 'designer',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 5),

  -- ── Permits & Licenses ──
  ('per-01', 'permits', 'DOB work permit (alteration type)',
   'Required before any construction begins. Your architect files this. Timeline: 2-8 weeks depending on scope.',
   'soon', 1000, 5000, 4, 'expediter',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', true, '{des-01}', 1),

  ('per-02', 'permits', 'DOHMH food service permit',
   'Required to serve food in NYC. Apply through NYC Business Express. Includes initial inspection.',
   'soon', 200, 500, 4, 'expediter',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar}', true, '{}', 2),

  ('per-03', 'permits', 'Certificate of Occupancy verification',
   'Confirm the C of O matches your intended use. If not, you need an alteration — adds time and cost.',
   'now', 0, 1000, 1, 'expediter',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', true, '{}', 3),

  ('per-04', 'permits', 'Food protection certificate',
   'At least one person on staff must complete the NYC food handler course and pass the exam.',
   'later', 50, 150, 1, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar}', true, '{}', 4),

  ('per-05', 'permits', 'Liquor license (if applicable)',
   'Apply through NYS Liquor Authority. Beer/wine: $1K, 2-4 months. Full liquor: $4.5K, 6-12 months. Start early.',
   'soon', 1000, 5000, 16, 'attorney',
   '{specialty_coffee,full_service_restaurant,fast_casual}', true, '{}', 5),

  ('per-06', 'permits', 'Sidewalk cafe permit (if applicable)',
   'DCA permit for outdoor seating. Seasonal and year-round options. Apply through NYC Open Restaurants.',
   'later', 500, 2000, 6, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar}', true, '{}', 6),

  ('per-07', 'permits', 'Sign permit (DOB/DOT)',
   'Exterior signage requires a DOB permit. Illuminated signs have additional requirements.',
   'later', 200, 1000, 3, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', true, '{}', 7),

  -- ── Financing & Insurance (universal) ──
  ('fin-01', 'finance', 'Finalize your startup budget',
   'Add up everything: entity costs, lease deposits, build-out, equipment, permits, 6-month operating reserve. RE² Business Case has your numbers.',
   'now', 0, 0, 0.5, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 1),

  ('fin-02', 'finance', 'Apply for SBA loan (if needed)',
   'SBA 7(a) for general business, SBA 504 for real estate/equipment. Need: business plan, financial projections, personal financial statement.',
   'soon', 0, 0, 6, 'lender',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 2),

  ('fin-03', 'finance', 'Get general liability insurance',
   'Required before opening. Covers slip-and-fall, property damage, product liability. $2K-5K/year for a cafe.',
   'soon', 2000, 5000, 1, 'insurance',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 3),

  ('fin-04', 'finance', 'Get workers compensation insurance',
   'Required by law in NY if you have any employees. Get quotes from 3 providers.',
   'soon', 2000, 8000, 1, 'insurance',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 4),

  ('fin-05', 'finance', 'Set up payroll',
   'Use Gusto, ADP, or similar. Handles tax withholding, direct deposit, W-2s. Set up before your first hire.',
   'later', 500, 1500, 0.5, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 5),

  -- ── Operations Setup ──
  ('ops-01', 'ops', 'Choose and set up POS system',
   'Square, Toast, Clover, or Lightspeed. Consider: menu complexity, tip handling, reporting, inventory, online ordering integration.',
   'soon', 500, 3000, 1, 'pos_vendor',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 1),

  ('ops-02', 'ops', 'Build your menu and price it',
   'Cost every item. Target food cost: 28-35%. Price to hit your daily target from the Business Case. Test recipes for consistency.',
   'soon', 0, 2000, 2, 'consultant',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar}', false, '{}', 2),

  ('ops-03', 'ops', 'Find and vet suppliers',
   'Coffee roaster, dairy, baked goods, paper goods, cleaning supplies. Get samples. Negotiate terms. Set up accounts.',
   'soon', 0, 500, 2, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar}', false, '{}', 3),

  ('ops-04', 'ops', 'Hire your team',
   'Start with key hires: manager, lead barista/chef. Post on Indeed, Culinary Agents, or Poached. Budget 2-3 weeks for training.',
   'later', 1000, 3000, 4, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 4),

  ('ops-05', 'ops', 'Write your operations manual',
   'Opening/closing procedures, recipes, food safety, customer service standards, cash handling. RE² can generate this for you.',
   'later', 0, 0, 1, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 5),

  ('ops-06', 'ops', 'Set up accounting and inventory tracking',
   'QuickBooks or Xero for accounting. MarketMan, BlueCart, or manual spreadsheet for inventory. Track from day one.',
   'later', 300, 1500, 1, 'accountant',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 6),

  -- ── Marketing & Pre-Launch (universal) ──
  ('mkt-01', 'marketing', 'Claim your Google Business profile',
   'Free. Critical for local search. Add photos, hours, menu. Do this as soon as you have a location confirmed.',
   'soon', 0, 0, 0.5, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 1),

  ('mkt-02', 'marketing', 'Set up Instagram and build hype',
   'Post build-out progress, behind-the-scenes, menu previews. Target 500+ followers before opening. Engage with local accounts.',
   'soon', 0, 1000, 4, 'marketing',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 2),

  ('mkt-03', 'marketing', 'Build a simple website',
   'One-pager: location, hours, menu, story, contact. Use Squarespace or a free template.',
   'later', 0, 2000, 1, 'designer',
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 3),

  ('mkt-04', 'marketing', 'Plan your soft opening',
   'Invite friends, family, neighbors for 3-5 days before public opening. Iron out systems, train staff under real conditions, collect feedback.',
   'later', 500, 2000, 1, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 4),

  -- ── Opening Week (universal) ──
  ('opn-01', 'opening', 'Final DOH inspection',
   'Schedule with DOHMH. Inspector checks: food temps, hand-washing stations, pest control, refrigeration, fire suppression. Must pass to open.',
   'later', 0, 0, 1, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar}', true, '{}', 1),

  ('opn-02', 'opening', 'Staff training and dry runs',
   '3-5 days of full service rehearsal with no paying customers. Practice every scenario: rush hour, equipment failure, difficult customer.',
   'later', 1000, 3000, 1, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 2),

  ('opn-03', 'opening', 'Soft opening (3-5 days)',
   'Limited hours, limited menu. Fix problems in private. Adjust recipes, timing, staffing levels based on real service.',
   'later', 500, 1500, 1, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 3),

  ('opn-04', 'opening', 'Grand opening',
   'Go public. Post on social, invite local press, offer a first-day special. Have extra staff scheduled. Expect chaos. Embrace it.',
   'later', 500, 3000, 0.5, NULL,
   '{specialty_coffee,full_service_restaurant,fast_casual,juice_bar,boutique_retail,fitness_wellness}', false, '{}', 4),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- Concept-specific items
  -- ═══════════════════════════════════════════════════════════════════════════

  -- ── Full-service restaurant extras ──
  ('fsr-01', 'design', 'Install grease trap',
   'Required by DEP for any food establishment with cooking. Size depends on kitchen output. Professional install + DEP registration.',
   'soon', 3000, 8000, 2, 'contractor',
   '{full_service_restaurant,fast_casual}', true, '{des-02}', 10),

  ('fsr-02', 'design', 'Install Ansul fire suppression system',
   'Required for commercial kitchens with cooking equipment. Hood-mounted suppression. Must be installed by licensed contractor.',
   'soon', 4000, 12000, 2, 'contractor',
   '{full_service_restaurant,fast_casual}', true, '{des-02}', 11),

  ('fsr-03', 'design', 'Install commercial hood ventilation',
   'Type I hood for grease-laden vapors (cooking), Type II for steam/heat. Sized to kitchen equipment. Requires HVAC engineer sign-off.',
   'soon', 5000, 20000, 3, 'contractor',
   '{full_service_restaurant,fast_casual}', true, '{des-01}', 12),

  -- ── Juice bar extras ──
  ('jb-01', 'design', 'Source commercial juice press equipment',
   'Cold-press hydraulic press, centrifugal juicers, blenders. Budget for maintenance contracts. Consider lease vs. buy.',
   'soon', 5000, 25000, 2, 'equipment_vendor',
   '{juice_bar}', false, '{}', 13),

  ('jb-02', 'permits', 'Cold-press production licensing',
   'If bottling for retail sale, may need separate FDA/state manufacturing license. HACCP plan required for wholesale.',
   'soon', 500, 2000, 4, 'expediter',
   '{juice_bar}', true, '{}', 8),

  -- ── Boutique retail extras ──
  ('br-01', 'permits', 'Certificate of Authority (sales tax)',
   'Register with NYS Dept of Taxation for sales tax collection. Required before your first sale. Free to obtain.',
   'now', 0, 0, 1, NULL,
   '{boutique_retail}', true, '{}', 8),

  ('br-02', 'permits', 'Sales tax registration and setup',
   'Configure POS for NYS sales tax rates. Set up quarterly filing schedule. Your CPA should handle ongoing compliance.',
   'soon', 0, 500, 0.5, 'accountant',
   '{boutique_retail}', true, '{br-01}', 9),

  -- ── Fitness/wellness extras ──
  ('fw-01', 'permits', 'DOHMH body work license',
   'Required in NYC for massage therapy, acupuncture, and related body work services. Apply through NYC Business Express.',
   'now', 200, 500, 4, 'expediter',
   '{fitness_wellness}', true, '{}', 8),

  ('fw-02', 'ops', 'Create liability waiver template',
   'Have your attorney draft a comprehensive liability waiver. Must cover injury, health conditions, and equipment use. Require before first session.',
   'now', 500, 1500, 1, 'attorney',
   '{fitness_wellness}', false, '{}', 7),

  ('fw-03', 'ops', 'Equipment safety certifications',
   'All fitness equipment must meet safety standards. Schedule annual inspection. Maintain service records. Post safety instructions.',
   'soon', 500, 2000, 2, NULL,
   '{fitness_wellness}', false, '{}', 8)

ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Done. 41 baseline items + 10 concept-specific items = 51 total templates.
-- ═══════════════════════════════════════════════════════════════════════════════
