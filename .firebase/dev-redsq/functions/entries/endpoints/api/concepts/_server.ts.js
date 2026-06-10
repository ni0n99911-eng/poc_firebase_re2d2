import { V as VALID_CONCEPTS } from "../../../../chunks/block-group.js";
const CONCEPT_LABELS = {
  full_service_restaurant: "Full-Service Restaurant",
  specialty_coffee: "Specialty Coffee",
  qsr: "Quick Service (QSR)",
  retail: "Retail",
  fitness_studio: "Fitness Studio",
  bar_nightlife: "Bar / Nightlife",
  personal_services: "Personal Services",
  medical_office: "Medical Office",
  wellness_beverage: "Wellness Beverage",
  juice_bar: "Juice Bar",
  fast_casual: "Fast Casual",
  bakery: "Bakery",
  florist: "Florist"
};
const GET = async () => {
  const concepts = VALID_CONCEPTS.map((value) => ({
    value,
    label: CONCEPT_LABELS[value] || value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }));
  return new Response(JSON.stringify({
    concepts,
    default: "full_service_restaurant",
    count: concepts.length
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600"
      // 1 hour — concepts rarely change
    }
  });
};
export {
  GET
};
