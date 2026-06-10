import { pgTable, text, timestamp, jsonb, integer, real } from 'drizzle-orm/pg-core';

export const scoreEvents = pgTable('score_events', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  geoid: text('geoid'),
  scoreType: text('score_type'),
  score: real('score'),
  components: jsonb('components'),
  createdAt: timestamp('created_at').defaultNow()
});

export const locationIntelligence = pgTable('location_intelligence', {
  id: text('id').primaryKey(),
  geoid: text('geoid'),
  intelType: text('intel_type'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});

export const scoredLocations = pgTable('scored_locations', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  geoid: text('geoid'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});

export const outcomes = pgTable('outcomes', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  locationId: text('location_id'),
  status: text('status'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});

export const outcomeCheckins = pgTable('outcome_checkins', {
  id: text('id').primaryKey(),
  outcomeId: text('outcome_id'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});

export const blockGroupScores = pgTable('block_group_scores', {
  id: text('id').primaryKey(),
  geoid: text('geoid'),
  scoreType: text('score_type'),
  score: real('score'),
  components: jsonb('components'),
  createdAt: timestamp('created_at').defaultNow()
});

export const blockGroupIntel = pgTable('block_group_intel', {
  id: text('id').primaryKey(),
  geoid: text('geoid'),
  source: text('source'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});

export const blockGroupVisions = pgTable('block_group_visions', {
  id: text('id').primaryKey(),
  geoid: text('geoid'),
  vision: text('vision'),
  createdAt: timestamp('created_at').defaultNow()
});

export const fitIqCache = pgTable('fit_iq_cache', {
  id: text('id').primaryKey(),
  geoid: text('geoid'),
  userId: text('user_id'),
  score: real('score'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});

export const fitIqShadowLog = pgTable('fit_iq_shadow_log', {
  id: text('id').primaryKey(),
  geoid: text('geoid'),
  logData: jsonb('log_data'),
  createdAt: timestamp('created_at').defaultNow()
});
