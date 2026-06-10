const CONCEPT_LABELS = {
  specialty_coffee: "Specialty Coffee",
  coffee_shop: "Coffee Shop",
  coffee: "Coffee",
  cafe: "Café",
  bakery: "Bakery",
  fast_casual: "Fast Casual",
  full_service_restaurant: "Full-Service Restaurant",
  restaurant: "Restaurant",
  qsr: "Quick-Service Restaurant",
  bar_nightlife: "Bar / Nightlife",
  bar: "Bar",
  juice_bar: "Juice Bar",
  wellness_beverage: "Wellness Beverage",
  retail: "Retail",
  fitness_studio: "Fitness Studio",
  personal_services: "Personal Services",
  medical_office: "Medical Office",
  florist: "Florist",
  boutique: "Boutique",
  salon: "Salon",
  spa: "Spa",
  something_else: "Other"
};
function formatConcept(slug) {
  if (!slug) return "";
  return CONCEPT_LABELS[slug] ?? slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
export {
  formatConcept as f
};
