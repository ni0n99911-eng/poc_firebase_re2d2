const DECISION_STATES = {
  strong_go: { min: 75, max: 100, label: "STRONG GO", color: "#27AE60" },
  go_with_refinements: { min: 65, max: 74, label: "GO WITH REFINEMENTS", color: "#F39C12" },
  worth_testing: { min: 50, max: 64, label: "WORTH TESTING", color: "#E67E22" },
  high_risk: { min: 40, max: 49, label: "HIGH RISK", color: "#E74C3C" },
  do_not_pursue: { min: 0, max: 39, label: "DO NOT PURSUE", color: "#C0392B" }
};
function getDecisionState(fitScore) {
  for (const [key, state] of Object.entries(DECISION_STATES)) {
    if (fitScore >= state.min && fitScore <= state.max) {
      return { key, label: state.label, color: state.color };
    }
  }
  return { key: "do_not_pursue", label: "DO NOT PURSUE", color: "#C0392B" };
}
function getScoreColor(score) {
  const state = getDecisionState(score);
  return state.color;
}
function getScoreGrade(score) {
  if (score >= 85) return "A+";
  const s = getDecisionState(score);
  switch (s.key) {
    case "strong_go":
      return "A";
    case "go_with_refinements":
      return "B";
    case "worth_testing":
      return "C";
    case "high_risk":
      return "D";
    case "do_not_pursue":
      return "F";
  }
}
export {
  getScoreGrade as a,
  getScoreColor as g
};
