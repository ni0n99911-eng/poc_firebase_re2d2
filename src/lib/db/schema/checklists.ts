import { pgTable, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

export const checklistPhases = pgTable('checklist_phases', {
  id: text('id').primaryKey(),
  name: text('name'),
  sortOrder: integer('sort_order'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});

export const checklistTemplates = pgTable('checklist_templates', {
  id: text('id').primaryKey(),
  phaseId: text('phase_id'),
  name: text('name'),
  sortOrder: integer('sort_order'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});

export const checklistProgress = pgTable('checklist_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  templateId: text('template_id'),
  status: text('status'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});

export const enrichedEntities = pgTable('checklist_enriched_entities', {
  id: text('id').primaryKey(),
  entityType: text('entity_type'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').defaultNow()
});
