import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { p as private_env } from "./private.js";
import { pgTable, timestamp, jsonb, real, text, integer, serial, varchar } from "drizzle-orm/pg-core";
const scoreEvents = pgTable("score_events", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  geoid: text("geoid"),
  scoreType: text("score_type"),
  score: real("score"),
  components: jsonb("components"),
  createdAt: timestamp("created_at").defaultNow()
});
const locationIntelligence = pgTable("location_intelligence", {
  id: text("id").primaryKey(),
  geoid: text("geoid"),
  intelType: text("intel_type"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const scoredLocations = pgTable("scored_locations", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  geoid: text("geoid"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const outcomes = pgTable("outcomes", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  locationId: text("location_id"),
  status: text("status"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const outcomeCheckins = pgTable("outcome_checkins", {
  id: text("id").primaryKey(),
  outcomeId: text("outcome_id"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const blockGroupScores = pgTable("block_group_scores", {
  id: text("id").primaryKey(),
  geoid: text("geoid"),
  scoreType: text("score_type"),
  score: real("score"),
  components: jsonb("components"),
  createdAt: timestamp("created_at").defaultNow()
});
const blockGroupIntel = pgTable("block_group_intel", {
  id: text("id").primaryKey(),
  geoid: text("geoid"),
  source: text("source"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const blockGroupVisions = pgTable("block_group_visions", {
  id: text("id").primaryKey(),
  geoid: text("geoid"),
  vision: text("vision"),
  createdAt: timestamp("created_at").defaultNow()
});
const fitIqCache = pgTable("fit_iq_cache", {
  id: text("id").primaryKey(),
  geoid: text("geoid"),
  userId: text("user_id"),
  score: real("score"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const fitIqShadowLog = pgTable("fit_iq_shadow_log", {
  id: text("id").primaryKey(),
  geoid: text("geoid"),
  logData: jsonb("log_data"),
  createdAt: timestamp("created_at").defaultNow()
});
const dealPipeline = pgTable("deal_pipeline", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  address: text("address"),
  geoid: text("geoid"),
  stage: text("stage"),
  status: text("status"),
  notes: text("notes"),
  pinned: text("pinned"),
  starred: text("starred"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const dealEvents = pgTable("deal_events", {
  id: text("id").primaryKey(),
  dealId: text("deal_id"),
  eventType: text("event_type"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const checklistPhases = pgTable("checklist_phases", {
  id: text("id").primaryKey(),
  name: text("name"),
  sortOrder: integer("sort_order"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const checklistTemplates = pgTable("checklist_templates", {
  id: text("id").primaryKey(),
  phaseId: text("phase_id"),
  name: text("name"),
  sortOrder: integer("sort_order"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const checklistProgress = pgTable("checklist_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  templateId: text("template_id"),
  status: text("status"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const enrichedEntities = pgTable("enriched_entities", {
  id: text("id").primaryKey(),
  entityType: text("entity_type"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const copilotConversations = pgTable("copilot_conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  context: text("context"),
  messages: jsonb("messages"),
  createdAt: timestamp("created_at").defaultNow()
});
const aiBriefs = pgTable("ai_briefs", {
  id: text("id").primaryKey(),
  geoid: text("geoid"),
  briefData: jsonb("brief_data"),
  createdAt: timestamp("created_at").defaultNow()
});
const recommendationFeedback = pgTable("recommendation_feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  recommendationId: text("recommendation_id"),
  feedback: text("feedback"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const aiCalls = pgTable("ai_calls", {
  id: serial("id").primaryKey(),
  // wait, we don't pass an ID in the insert! We should use serial or defaultRandom
  userId: text("user_id"),
  sessionId: text("session_id"),
  route: text("route"),
  model: text("model"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  costUsd: real("cost_usd"),
  durationMs: integer("duration_ms"),
  status: text("status"),
  errorCode: text("error_code"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow()
});
const brokerContacts = pgTable("broker_contacts", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  name: text("name"),
  brokerage: text("brokerage"),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow()
});
const clientProfiles = pgTable("client_profiles", {
  userId: text("user_id").primaryKey(),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const scoreDriftEvents = pgTable("score_drift_events", {
  id: text("id").primaryKey(),
  geoid: text("geoid"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  // Clerk User ID
  role: varchar("role", { length: 50 }).notNull().default("pending"),
  email: varchar("email", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow()
});
const founderSessions = pgTable("founder_sessions", {
  userId: varchar("user_id", { length: 255 }).primaryKey(),
  sessionId: varchar("session_id", { length: 255 }),
  personaType: varchar("persona_type", { length: 50 }),
  conceptDescription: text("concept_description"),
  address: text("address"),
  fullData: jsonb("full_data"),
  journeyState: jsonb("journey_state"),
  shortlistedLocations: jsonb("shortlisted_locations"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow()
});
const moduleAccess = pgTable("module_access", {
  userId: varchar("user_id", { length: 255 }).notNull(),
  module: varchar("module", { length: 100 }).notNull(),
  grantedBy: varchar("granted_by", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
const emailWhitelist = pgTable("email_whitelist", {
  email: varchar("email", { length: 255 }).primaryKey(),
  modules: jsonb("modules").default([]),
  // array of strings
  createdAt: timestamp("created_at").defaultNow()
});
const vaultItems = pgTable("vault_items", {
  id: varchar("id", { length: 255 }).primaryKey(),
  // Usually UUID, but varchar for simplicity
  userId: varchar("user_id", { length: 255 }).notNull(),
  propertyAddr: varchar("property_addr", { length: 255 }),
  itemType: varchar("item_type", { length: 50 }).notNull(),
  title: text("title"),
  body: text("body"),
  filePath: text("file_path"),
  fileType: varchar("file_type", { length: 100 }),
  fileSize: varchar("file_size", { length: 50 }),
  tags: jsonb("tags").default([]),
  metadata: jsonb("metadata").default({}),
  pinned: varchar("pinned", { length: 10 }).default("false"),
  // boolean as string or boolean
  createdAt: timestamp("created_at").defaultNow()
});
const schema = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  aiBriefs,
  aiCalls,
  blockGroupIntel,
  blockGroupScores,
  blockGroupVisions,
  brokerContacts,
  checklistPhases,
  checklistProgress,
  checklistTemplates,
  clientProfiles,
  copilotConversations,
  dealEvents,
  dealPipeline,
  emailWhitelist,
  enrichedEntities,
  fitIqCache,
  fitIqShadowLog,
  founderSessions,
  locationIntelligence,
  moduleAccess,
  outcomeCheckins,
  outcomes,
  recommendationFeedback,
  scoreDriftEvents,
  scoreEvents,
  scoredLocations,
  users,
  vaultItems
}, Symbol.toStringTag, { value: "Module" }));
const queryClient = postgres(private_env.DATABASE_URL || "", { prepare: false });
const rawDb = drizzle(queryClient, { schema });
const originalExecute = rawDb.execute.bind(rawDb);
rawDb.execute = async (...args) => {
  const res = await originalExecute(...args);
  if (Array.isArray(res)) {
    res.rows = res;
  }
  return res;
};
const db = rawDb;
const dbServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  db,
  queryClient
}, Symbol.toStringTag, { value: "Module" }));
export {
  blockGroupScores as a,
  brokerContacts as b,
  copilotConversations as c,
  db as d,
  emailWhitelist as e,
  blockGroupIntel as f,
  dealPipeline as g,
  fitIqShadowLog as h,
  fitIqCache as i,
  aiBriefs as j,
  founderSessions as k,
  clientProfiles as l,
  moduleAccess as m,
  dbServer as n,
  recommendationFeedback as r,
  users as u,
  vaultItems as v
};
