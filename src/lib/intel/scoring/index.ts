/**
 * RE² Intelligence Scoring Pipeline
 * ─────────────────────────────────────────────────────────────────────────────
 * 04.19.2026 13:35 Score Consolidation
 * Canonical entry point for all scoring concerns.
 */

// 1. Core Entry Points
export { runIQScore, type IQScoreInput, type IQScoreOutput } from './iq-score';

// 2. Canonical Math Utilities
export { clamp, haversine, scoreLinear } from './geo-math';

// 3. Canonical Grade Scale
export { scoreToGrade } from './grade-scale';

// 4. Fit IQ Pure Dimensions
export {
  expandVariance,
  computeDimension,
  applyRiskTolerance,
  applyExperience,
  parseRentBudget,
  type BlockGroupData,
  type BusinessConfig
} from './fit-dimensions';
