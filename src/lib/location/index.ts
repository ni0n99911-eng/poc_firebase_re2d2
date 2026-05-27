// RE² Location IQ Module — Barrel Export
export { createLocationStore, type LocationStore, type LocationResult, type ScrapeResult } from './store.svelte';
export { HOODS, BROKERS, BANKS, LAYER_DEFS, WEIGHT_PROFILES, HOOD_DATA, defaultLayerScores } from './data/constants';
export { geocode, scanArea, fetchLiveIntel, enrichStationsFromMTA, intelToHoodScores } from './api/geo';
export { calculateVLF, calculateGLF, calculateRR, calculatePoS, calculateLCS, blockScore, buildL2FromScan, buildL3FromGoals, computeComposite, getLayerEffectiveScore, generateCommentary } from './scoring/engines';
export { haversine, fmtD, scoreColor, fitClass, getGrade, getVerdict, cfetch } from './utils/helpers';
