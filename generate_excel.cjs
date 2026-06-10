const xlsx = require('xlsx');
const fs = require('fs');

const data = [
  { Endpoint: 'api/admin/+server.ts', Tables: 'users, module_access, email_whitelist', Component: 'Admin Routing', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/block-group-intel/+server.ts', Tables: 'score_events', Component: 'AI Intel', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/brokers/+server.ts', Tables: 'broker_contacts', Component: 'Deals/Brokers', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/checklist/cost-summary/+server.ts', Tables: 'checklist_phases, checklist_templates, enriched_entities', Component: 'Checklist AI', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/checklist/+server.ts', Tables: 'checklist_phases, checklist_templates, checklist_progress, enriched_entities, block_group_scores', Component: 'Checklist AI', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/checklist-sync/+server.ts', Tables: 'checklist_progress', Component: 'Checklist Sync', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/copilot/business/+server.ts', Tables: 'copilot_conversations, block_group_scores', Component: 'Copilot AI', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/copilot/checklist/+server.ts', Tables: 'copilot_conversations', Component: 'Copilot AI', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/copilot/location/+server.ts', Tables: 'copilot_conversations, block_group_visions, block_group_scores, block_group_intel, enriched_entities', Component: 'Copilot AI', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/deals/remove-location/+server.ts', Tables: 'deal_pipeline', Component: 'Deals Pipeline', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/deals/save-location/+server.ts', Tables: 'deal_pipeline, deal_events', Component: 'Deals Pipeline', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/deals/update-location/+server.ts', Tables: 'deal_pipeline, deal_events', Component: 'Deals Pipeline', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/deals/[id]/events/+server.ts', Tables: 'deal_pipeline, deal_events', Component: 'Deals Pipeline', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/deals/[id]/+server.ts', Tables: 'deal_pipeline, deal_events', Component: 'Deals Pipeline', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/deals/+server.ts', Tables: 'deal_pipeline', Component: 'Deals Pipeline', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/feedback/+server.ts', Tables: 'recommendation_feedback', Component: 'Feedback Logging', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/fit-iq/compute/+server.ts', Tables: 'fit_iq_cache, fit_iq_shadow_log', Component: 'Fit IQ Engine', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/generate-brief/+server.ts', Tables: 'ai_briefs', Component: 'AI Content Generation', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/health/+server.ts', Tables: 'founder_sessions, vault-files', Component: 'System Health Check', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/location-iq/+server.ts', Tables: 'block_group_scores', Component: 'Location IQ Scoring', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/neighborhood-intelligence/+server.ts', Tables: 'location_intelligence', Component: 'Neighborhood Intel', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/outcomes/+server.ts', Tables: 'scored_locations, outcomes, outcome_checkins', Component: 'Outcomes Tracking', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/profile-sync/+server.ts', Tables: 'client_profiles', Component: 'Profile Sync', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/re-score/+server.ts', Tables: 'founder_sessions, score_drift_events', Component: 'Score Drift Detection', Status: 'Pending Drizzle Rewrite' },
  { Endpoint: 'api/re2d2/respond/+server.ts', Tables: 'founder_sessions', Component: 'RE2D2 Agent', Status: 'Pending Drizzle Rewrite' },
];

const ws = xlsx.utils.json_to_sheet(data);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, "Endpoint Mapping");

xlsx.writeFile(wb, "supabase-drizzle-ai-endpoint-mapping.05312026.xlsx");
console.log("Excel file generated successfully.");
