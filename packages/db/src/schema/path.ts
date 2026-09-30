/**
 * Path (Earn + Learn): skills, plans, steps, proof projects, reviews and verifiable credentials.
 * Skill, role and resource ids refer to curated @waypoint/content data, not database rows.
 */

import type { PlanText } from '@waypoint/core';
import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, pk, updatedAt } from './_shared';
import { users } from './auth';

export const userSkills = pgTable(
  'user_skills',
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillId: text().notNull(),
    /** 0 none · 1 aware · 2 basic · 3 working · 4 strong */
    level: smallint().notNull(),
    /** self | assessed | verified */
    source: text().notNull().default('self'),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skillId] })],
);

export const plans = pgTable(
  'plans',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    summary: text().notNull(),
    targetRoleId: text(),
    horizonWeeks: smallint().notNull(),
    hoursPerWeek: smallint().notNull(),
    /** template | ai */
    generatedBy: text().notNull(),
    /** The language the plan's stored text was written in. */
    locale: text(),
    /** How the planner wrote the title and summary, to render them in another language. */
    text: jsonb().$type<{ title: PlanText; summary: PlanText }>(),
    /** active | paused | completed | archived */
    status: text().notNull().default('active'),
    /** Skill gaps at creation: [{ skillId, from, to }] */
    gaps: jsonb()
      .$type<Array<{ skillId: string; from: number; to: number }>>()
      .notNull()
      .default([]),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('plans_user_status_idx').on(t.userId, t.status)],
);

export const planSteps = pgTable(
  'plan_steps',
  {
    id: pk(),
    planId: uuid()
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    week: smallint().notNull(),
    position: smallint().notNull(),
    /** learn | build | connect | apply | reflect */
    kind: text().notNull(),
    title: text().notNull(),
    detail: text().notNull(),
    minutes: smallint().notNull(),
    resourceId: text(),
    skillIds: text().array().notNull().default([]),
    href: text(),
    /** How the planner wrote the title and detail (null once AI reworded them). */
    text: jsonb().$type<{ title: PlanText; detail: PlanText }>(),
    /** todo | doing | done | skipped */
    status: text().notNull().default('todo'),
    doneAt: timestamp({ withTimezone: true }),
    note: text(),
    updatedAt: updatedAt(),
  },
  (t) => [index('plan_steps_plan_idx').on(t.planId, t.week, t.position)],
);

export const projects = pgTable(
  'projects',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: uuid().references(() => plans.id, { onDelete: 'set null' }),
    title: text().notNull(),
    summary: text().notNull(),
    evidenceUrl: text(),
    skillIds: text().array().notNull().default([]),
    /** draft | submitted | verified */
    status: text().notNull().default('draft'),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('projects_user_idx').on(t.userId, t.status)],
);

/** A review from a peer, mentor or employer. External reviewers use a one-time link. */
export const projectReviews = pgTable(
  'project_reviews',
  {
    id: pk(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    reviewerUserId: text().references(() => users.id, { onDelete: 'set null' }),
    reviewerName: text().notNull(),
    /** peer | mentor | employer */
    level: text().notNull(),
    /** Hash of the one-time review token sent to an external reviewer. */
    tokenHash: text(),
    tokenExpiresAt: timestamp({ withTimezone: true }),
    /** pending | approved | changes-requested */
    decision: text().notNull().default('pending'),
    comment: text(),
    decidedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('project_reviews_project_idx').on(t.projectId),
    uniqueIndex('project_reviews_token_idx').on(t.tokenHash),
  ],
);

/** Signed W3C Verifiable Credentials. The id is public and used in /verify/[id]. */
export const credentials = pgTable(
  'credentials',
  {
    id: pk(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid().references(() => projects.id, { onDelete: 'set null' }),
    vc: jsonb().$type<Record<string, unknown>>().notNull(),
    /** active | revoked */
    status: text().notNull().default('active'),
    revokedAt: timestamp({ withTimezone: true }),
    revocationReason: text(),
    createdAt: createdAt(),
  },
  (t) => [index('credentials_user_idx').on(t.userId)],
);

/** The issuer's signing keys. Private keys are stored encrypted with the server KEK. */
export const issuerKeys = pgTable('issuer_keys', {
  id: pk(),
  did: text().notNull(),
  keyId: text().notNull().unique(),
  publicKeyMultibase: text().notNull(),
  privateKeyCt: text().notNull(),
  createdAt: createdAt(),
  retiredAt: timestamp({ withTimezone: true }),
});
