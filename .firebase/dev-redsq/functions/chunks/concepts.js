const CONCEPT_REGISTRY = [
  { key: "specialty_coffee", label: "Coffee / Café", displayName: "Specialty Coffee / Café" },
  { key: "bakery", label: "Bakery / Café", displayName: "Bakery / Café" },
  { key: "fast_casual", label: "Fast Casual", displayName: "Fast Casual Restaurant" },
  { key: "full_service_restaurant", label: "Full-Service Restaurant", displayName: "Full-Service Restaurant" },
  { key: "fine_dining", label: "Fine Dining", displayName: "Fine Dining" },
  { key: "bar_nightlife", label: "Bar / Lounge", displayName: "Bar / Lounge" },
  { key: "fitness_studio", label: "Fitness / Gym", displayName: "Fitness / Wellness Studio" },
  { key: "retail", label: "Retail", displayName: "Retail Store" },
  { key: "coworking", label: "Coworking", displayName: "Coworking Space" },
  { key: "wellness_spa", label: "Spa / Wellness", displayName: "Spa / Wellness" },
  { key: "personal_services", label: "Personal Services", displayName: "Personal Services" },
  { key: "barbershop", label: "Barbershop / Salon", displayName: "Barbershop / Salon" },
  { key: "medical_office", label: "Dental / Medical", displayName: "Dental / Medical Office" },
  { key: "something_else", label: "Other", displayName: "Custom Concept" }
];
const CONCEPT_LABEL_MAP = {
  // ── Canonical keys ────────────────────────────────────────────────────────
  specialty_coffee: "Coffee / Café",
  coffee_shop: "Coffee / Café",
  bakery: "Bakery / Café",
  fast_casual: "Fast Casual Restaurant",
  qsr: "Quick Service Restaurant",
  full_service_restaurant: "Full-Service Restaurant",
  fine_dining: "Fine Dining",
  bar_nightlife: "Bar / Lounge",
  fitness_studio: "Fitness / Wellness",
  retail: "Retail",
  florist: "Florist",
  coworking: "Coworking",
  medical_office: "Dental / Medical",
  medical_dental: "Dental / Medical",
  personal_services: "Personal Services",
  barbershop: "Barbershop / Salon",
  wellness_spa: "Spa / Wellness",
  spa_wellness: "Spa / Wellness",
  juice_bar: "Juice Bar",
  wellness_beverage: "Wellness Beverage",
  something_else: "Custom Concept",
  // ── BIZ_TYPE_MAP display strings (written by store.svelte.ts) ─────────────
  "Restaurant (Fast Casual)": "Fast Casual Restaurant",
  "Restaurant (Full Service)": "Full-Service Restaurant",
  "Fitness / Wellness Studio": "Fitness / Wellness",
  "Barbershop / Salon": "Barbershop / Salon",
  "Retail Store": "Retail",
  "Grocery / Specialty Food": "Grocery / Market",
  "Professional Services": "Professional Services",
  "Bar / Lounge": "Bar / Lounge",
  "Spa / Wellness": "Spa / Wellness",
  "Dental / Medical": "Dental / Medical",
  "Custom Concept": "Custom Concept",
  // ── Legacy / raw onboarding keys ─────────────────────────────────────────
  coffee: "Coffee / Café",
  restaurant: "Restaurant",
  gym: "Fitness / Wellness",
  fitness: "Fitness / Wellness",
  dentist: "Professional Services",
  spa: "Spa / Wellness",
  bodega: "Grocery / Market",
  barber: "Barbershop / Salon",
  boutique: "Retail",
  bar: "Bar / Lounge"
};
function getConceptLabel(raw) {
  if (!raw || raw === "Other") return "Your Business";
  return CONCEPT_LABEL_MAP[raw] || raw;
}
export {
  CONCEPT_REGISTRY as C,
  getConceptLabel as g
};
