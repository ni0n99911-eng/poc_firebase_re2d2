import { pgTable, text, timestamp, jsonb, integer, real, serial } from 'drizzle-orm/pg-core';

export const copilotConversations = pgTable('copilot_conversations', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  context: text('context'),
  messages: jsonb('messages'),
  createdAt: timestamp('created_at').defaultNow()
});

export const aiBriefs = pgTable('ai_briefs', {
  id: text('id').primaryKey(),
  geoid: text('geoid'),
  briefData: jsonb('brief_data'),
  createdAt: timestamp('created_at').defaultNow()
});

export const recommendationFeedback = pgTable('recommendation_feedback', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  recommendationId: text('recommendation_id'),
  feedback: text('feedback'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});

export const aiCalls = pgTable('ai_calls', {
  id: serial('id').primaryKey(), // wait, we don't pass an ID in the insert! We should use serial or defaultRandom
  userId: text('user_id'),
  sessionId: text('session_id'),
  route: text('route'),
  model: text('model'),
  tokensIn: integer('tokens_in'),
  tokensOut: integer('tokens_out'),
  costUsd: real('cost_usd'),
  durationMs: integer('duration_ms'),
  status: text('status'),
  errorCode: text('error_code'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow()
});
