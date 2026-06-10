import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const dealPipeline = pgTable('deal_pipeline', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  address: text('address'),
  geoid: text('geoid'),
  stage: text('stage'),
  status: text('status'),
  notes: text('notes'),
  pinned: text('pinned'),
  starred: text('starred'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});

export const dealEvents = pgTable('deal_events', {
  id: text('id').primaryKey(),
  dealId: text('deal_id'),
  eventType: text('event_type'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});
