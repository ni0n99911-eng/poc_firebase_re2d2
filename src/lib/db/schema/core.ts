import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const brokerContacts = pgTable('broker_contacts', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  name: text('name'),
  brokerage: text('brokerage'),
  email: text('email'),
  phone: text('phone'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow()
});

export const clientProfiles = pgTable('client_profiles', {
  userId: text('user_id').primaryKey(),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});

export const scoreDriftEvents = pgTable('score_drift_events', {
  id: text('id').primaryKey(),
  geoid: text('geoid'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});
