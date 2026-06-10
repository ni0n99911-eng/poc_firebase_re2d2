import { pgTable, varchar, timestamp, jsonb, text } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(), // Clerk User ID
  role: varchar('role', { length: 50 }).notNull().default('pending'),
  email: varchar('email', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const founderSessions = pgTable('founder_sessions', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  sessionId: varchar('session_id', { length: 255 }),
  personaType: varchar('persona_type', { length: 50 }),
  conceptDescription: text('concept_description'),
  address: text('address'),
  fullData: jsonb('full_data'),
  journeyState: jsonb('journey_state'),
  shortlistedLocations: jsonb('shortlisted_locations'),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const moduleAccess = pgTable('module_access', {
  userId: varchar('user_id', { length: 255 }).notNull(),
  module: varchar('module', { length: 100 }).notNull(),
  grantedBy: varchar('granted_by', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}); // Needs a composite primary key but leaving out for simple declaration or can add later.

export const emailWhitelist = pgTable('email_whitelist', {
  email: varchar('email', { length: 255 }).primaryKey(),
  modules: jsonb('modules').default([]), // array of strings
  createdAt: timestamp('created_at').defaultNow(),
});

export const vaultItems = pgTable('vault_items', {
  id: varchar('id', { length: 255 }).primaryKey(), // Usually UUID, but varchar for simplicity
  userId: varchar('user_id', { length: 255 }).notNull(),
  propertyAddr: varchar('property_addr', { length: 255 }),
  itemType: varchar('item_type', { length: 50 }).notNull(),
  title: text('title'),
  body: text('body'),
  filePath: text('file_path'),
  fileType: varchar('file_type', { length: 100 }),
  fileSize: varchar('file_size', { length: 50 }),
  tags: jsonb('tags').default([]),
  metadata: jsonb('metadata').default({}),
  pinned: varchar('pinned', { length: 10 }).default('false'), // boolean as string or boolean
  createdAt: timestamp('created_at').defaultNow(),
});
export * from './schema/intel';
export * from './schema/deals';
export * from './schema/checklists';
export * from './schema/ai';
export * from './schema/core';
