function scoreToGrade(score) {
  if (score >= 93) return "A+";
  if (score >= 87) return "A";
  if (score >= 80) return "A-";
  if (score >= 73) return "B+";
  if (score >= 67) return "B";
  if (score >= 60) return "B-";
  if (score >= 53) return "C+";
  if (score >= 47) return "C";
  if (score >= 40) return "C-";
  if (score >= 30) return "D";
  return "F";
}
function pulseTier(score) {
  if (score >= 80) return "Buzzing";
  if (score >= 65) return "Busy";
  if (score >= 50) return "Steady";
  if (score >= 35) return "Quiet";
  return "Sleepy";
}
function conceptRevenueModel(businessType) {
  const key = (businessType || "").toLowerCase().replace(/[^a-z]/g, "_");
  if (/coffee|cafe|qsr|fast|bakery|juice|ice_cream|bar|nightlife/.test(key)) return "walk-in";
  if (/restaurant|full_service|fine_dining|grocery|market|florist/.test(key)) return "destination";
  if (/salon|spa|barber|nail|hair|medical|dental|clinic|fitness|yoga|pilates|gym|studio/.test(key)) return "appointment";
  if (/law|legal|accounting|consult|office|professional/.test(key)) return "professional";
  return "walk-in";
}
function pulseNarrative(tier, model, conceptRadius) {
  const ring = `${conceptRadius}m`;
  {
    if (model === "walk-in") return `Concept Pulse — ${tier} (within ${ring}). Your customers walk here on impulse. Inside your ring this block is calm — you'll need to pull people in rather than catch them passing by.`;
    if (model === "destination") return `Concept Pulse — ${tier} (within ${ring}). Your diners will walk ~10 min for a planned visit. This ring is light on co-visit traffic, so you'll rely on destination marketing more than spillover energy.`;
    if (model === "appointment") return `Concept Pulse — ${tier} (within ${ring}). You don't need walk-ins, but a quiet ring means less visibility to future clients passing through. Bookings and referrals will carry more of the load.`;
    return `Concept Pulse — ${tier} (within ${ring}). Your ring has light co-tenancy. Credibility and referrals will matter more than foot traffic.`;
  }
}
export {
  pulseTier as a,
  conceptRevenueModel as c,
  pulseNarrative as p,
  scoreToGrade as s
};
