/** Relations for Drizzle's relational query API (`db.query.*`). */
import { relations } from 'drizzle-orm';
import { members, organizations, users } from './auth';
import { circleMembers, circlePosts, circles } from './community';
import { conversations, forecastPredictions, forecasts, messages } from './knowledge';
import { goals, userChecklistItems, userChecklists } from './life';
import { planSteps, plans, projectReviews, projects } from './path';
import { consents, profiles } from './people';
import { orgEnrolments, orgProfiles, orgProgrammes } from './platform';

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  consents: many(consents),
  plans: many(plans),
  goals: many(goals),
  memberships: many(members),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
}));

export const consentsRelations = relations(consents, ({ one }) => ({
  user: one(users, { fields: [consents.userId], references: [users.id] }),
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
  user: one(users, { fields: [plans.userId], references: [users.id] }),
  steps: many(planSteps),
  projects: many(projects),
}));

export const planStepsRelations = relations(planSteps, ({ one }) => ({
  plan: one(plans, { fields: [planSteps.planId], references: [plans.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  plan: one(plans, { fields: [projects.planId], references: [plans.id] }),
  reviews: many(projectReviews),
}));

export const projectReviewsRelations = relations(projectReviews, ({ one }) => ({
  project: one(projects, { fields: [projectReviews.projectId], references: [projects.id] }),
}));

export const circlesRelations = relations(circles, ({ many }) => ({
  members: many(circleMembers),
  posts: many(circlePosts),
}));

export const circleMembersRelations = relations(circleMembers, ({ one }) => ({
  circle: one(circles, { fields: [circleMembers.circleId], references: [circles.id] }),
  user: one(users, { fields: [circleMembers.userId], references: [users.id] }),
}));

export const circlePostsRelations = relations(circlePosts, ({ one }) => ({
  circle: one(circles, { fields: [circlePosts.circleId], references: [circles.id] }),
  author: one(users, { fields: [circlePosts.authorId], references: [users.id] }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const forecastsRelations = relations(forecasts, ({ many }) => ({
  predictions: many(forecastPredictions),
}));

export const forecastPredictionsRelations = relations(forecastPredictions, ({ one }) => ({
  forecast: one(forecasts, {
    fields: [forecastPredictions.forecastId],
    references: [forecasts.id],
  }),
}));

export const userChecklistsRelations = relations(userChecklists, ({ many }) => ({
  items: many(userChecklistItems),
}));

export const userChecklistItemsRelations = relations(userChecklistItems, ({ one }) => ({
  checklist: one(userChecklists, {
    fields: [userChecklistItems.checklistId],
    references: [userChecklists.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  profile: one(orgProfiles, {
    fields: [organizations.id],
    references: [orgProfiles.organizationId],
  }),
  members: many(members),
  programmes: many(orgProgrammes),
}));

export const membersRelations = relations(members, ({ one }) => ({
  organization: one(organizations, {
    fields: [members.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [members.userId], references: [users.id] }),
}));

export const orgProgrammesRelations = relations(orgProgrammes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [orgProgrammes.organizationId],
    references: [organizations.id],
  }),
  enrolments: many(orgEnrolments),
}));

export const orgEnrolmentsRelations = relations(orgEnrolments, ({ one }) => ({
  programme: one(orgProgrammes, {
    fields: [orgEnrolments.programmeId],
    references: [orgProgrammes.id],
  }),
}));
