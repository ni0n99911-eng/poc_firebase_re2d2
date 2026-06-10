import { json } from "@sveltejs/kit";
import { a as computeStreetSideIntel } from "../../../../chunks/street-side.js";
const CONCEPT_SENSITIVITY_MAP = {
  // High sensitivity — habitual/impulse visits
  "cafe": { archetype: "habitual", sensitivity: 0.9, label: "Coffee is a daily habit — side of street matters a lot" },
  "coffee": { archetype: "habitual", sensitivity: 0.9, label: "Coffee is a daily habit — side of street matters a lot" },
  "Specialty Coffee / Café": { archetype: "habitual", sensitivity: 0.9, label: "Coffee is a daily habit — side of street matters a lot" },
  "juice": { archetype: "impulse", sensitivity: 0.85, label: "Impulse purchase — people rarely cross the street" },
  "bakery": { archetype: "habitual", sensitivity: 0.85, label: "Morning routine purchase — side matters" },
  "deli": { archetype: "habitual", sensitivity: 0.8, label: "Grab-and-go — people choose the convenient side" },
  // Moderate sensitivity — discovery/browsing
  "restaurant": { archetype: "discovery", sensitivity: 0.5, label: "People browse both sides but prefer the active one" },
  "Restaurant / Fast Casual": { archetype: "discovery", sensitivity: 0.5, label: "People browse both sides but prefer the active one" },
  "retail": { archetype: "discovery", sensitivity: 0.6, label: "Window shopping favors the busier side" },
  "boutique": { archetype: "discovery", sensitivity: 0.55, label: "Discovery shopping — moderate side preference" },
  "bar": { archetype: "discovery", sensitivity: 0.4, label: "Evening destination — less side-sensitive" },
  // Low sensitivity — appointment/destination
  "fitness": { archetype: "destination", sensitivity: 0.2, label: "Gym members will cross the street" },
  "gym": { archetype: "destination", sensitivity: 0.2, label: "Gym members will cross the street" },
  "yoga": { archetype: "destination", sensitivity: 0.2, label: "Yoga students will cross the street" },
  "Barbershop / Salon": { archetype: "appointment", sensitivity: 0.15, label: "Appointment-based — side barely matters" },
  "salon": { archetype: "appointment", sensitivity: 0.15, label: "Appointment-based — side barely matters" },
  "dentist": { archetype: "appointment", sensitivity: 0.1, label: "Appointment-based — side irrelevant" },
  "medical": { archetype: "appointment", sensitivity: 0.1, label: "Appointment-based — side irrelevant" },
  "tutoring": { archetype: "destination", sensitivity: 0.1, label: "Scheduled visits — side irrelevant" },
  "Other": { archetype: "discovery", sensitivity: 0.4, label: "Moderate street-side sensitivity" }
};
const DEFAULT_SENSITIVITY = {
  archetype: "discovery",
  sensitivity: 0.4,
  label: "Moderate street-side sensitivity"
};
function getConceptSensitivity(categoryId) {
  return CONCEPT_SENSITIVITY_MAP[categoryId] || DEFAULT_SENSITIVITY;
}
function streetSideModifier(streetSideData, categoryId) {
  const sensitivity = getConceptSensitivity(categoryId);
  const { streetSideScore, hostilityPenalty, hostilityFactors } = streetSideData;
  let baseModifier;
  if (streetSideScore >= 70) {
    baseModifier = 1 + (streetSideScore - 70) * 5e-3;
  } else if (streetSideScore >= 50) {
    baseModifier = 1;
  } else {
    baseModifier = 1 - (50 - streetSideScore) * 6e-3;
  }
  const modifier = 1 + (baseModifier - 1) * sensitivity.sensitivity;
  const clampedModifier = Math.max(0.7, Math.min(1.15, modifier));
  let explanation;
  if (clampedModifier >= 1.05) {
    explanation = `Strong foot traffic on your side — ${sensitivity.label}`;
  } else if (clampedModifier >= 0.98) {
    explanation = `Balanced foot traffic across both sides`;
  } else if (clampedModifier >= 0.9) {
    explanation = `Most foot traffic is on the opposite side — ${sensitivity.label}`;
  } else {
    explanation = `Wrong side of the street for this concept — ${sensitivity.label}`;
  }
  if (hostilityPenalty < -5) {
    explanation += `. Traffic hostility nearby (${hostilityFactors.map((f) => f.name).join(", ")})`;
  }
  return { modifier: Math.round(clampedModifier * 100) / 100, sensitivity, explanation };
}
const GET = async ({ url }) => {
  const lat = parseFloat(url.searchParams.get("lat") || "0");
  const lng = parseFloat(url.searchParams.get("lng") || "0");
  const address = url.searchParams.get("address") || "";
  const type = url.searchParams.get("type") || "cafe";
  if (!lat || !lng || !address) {
    return json({ error: "Missing lat, lng, or address" }, { status: 400 });
  }
  try {
    const streetSide = await computeStreetSideIntel(lat, lng, address);
    const modifier = streetSideModifier(streetSide, type);
    const sensitivity = getConceptSensitivity(type);
    return json({
      streetSide,
      modifier,
      sensitivity,
      conceptType: type,
      summary: `${address}: ${streetSide.streetType} (${streetSide.addressSide === "A" ? streetSide.sideALabel : streetSide.sideBLabel}). Street-side score: ${streetSide.streetSideScore}/100. Modifier for ${type}: ${modifier.modifier}x. ` + modifier.explanation
    });
  } catch (err) {
    return json({
      error: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack : void 0
    }, { status: 500 });
  }
};
export {
  GET
};
