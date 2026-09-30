/**
 * Tools the companion can use. Read-only tools run immediately; tools that save something
 * (goals, memories, plans) require the person's approval in the UI first, and approvals are
 * HMAC-signed so a client cannot forge them.
 */
import {
  getChecklist,
  getCountry,
  getEmergency,
  getSupportResources,
  LEARNING_RESOURCES,
  type LifeEvent,
  localizeRole,
  localizeSkill,
  ROLES,
  SKILLS,
  type SupportKind,
  skillName,
} from '@waypoint/content';
import {
  checkMessage,
  draftPlan,
  type PathInput,
  pickResource,
  runway,
  type Situation,
  suggestRoles,
} from '@waypoint/core';
import { newId } from '@waypoint/core/ids';
import { SEALED, sealFor } from '@waypoint/core/privacy';
import { type Database, dataKeyFor, eq, goals, memories, savePlan, userSkills } from '@waypoint/db';
import { isLocale, planTemplates } from '@waypoint/i18n';
import { tool } from 'ai';
import { z } from 'zod';

export interface ToolContext {
  db: Database;
  userId: string;
  isGuest: boolean;
  country?: string | null;
  locale: string;
  situation?: string | null;
  canRemember: boolean;
}

const SUPPORT_KINDS = [
  'crisis-line',
  'text-line',
  'chat',
  'mental-health',
  'domestic-violence',
  'child-helpline',
  'elder-abuse',
  'poison',
] as const satisfies readonly SupportKind[];

const LIFE_EVENTS = [
  'job-loss',
  'first-job',
  'moving-country',
  'moving-city',
  'new-baby',
  'bereavement',
  'retirement',
  'disability',
  'serious-illness',
  'starting-business',
  'disaster',
] as const satisfies readonly LifeEvent[];

/** Roles and skills named in the person's language, for suggestions and plans. */
function pathData(locale: string) {
  return {
    roles: ROLES.map((r) => localizeRole(r, locale)),
    skills: SKILLS.map((s) => localizeSkill(s, locale)),
    resources: LEARNING_RESOURCES,
  };
}

export function companionTools(ctx: ToolContext) {
  return {
    find_support: tool({
      description:
        'Get verified emergency numbers and helplines for the person’s country. Use whenever safety, crisis, abuse or urgent help comes up. Never state a helpline number that this tool did not return.',
      inputSchema: z.object({
        kinds: z
          .array(z.enum(SUPPORT_KINDS))
          .max(4)
          .optional()
          .describe('Types of support needed, most important first.'),
        country: z
          .string()
          .length(2)
          .optional()
          .describe('ISO country code if different from the person’s country.'),
      }),
      execute: async ({ kinds, country }) => {
        const code = country ?? ctx.country ?? null;
        const em = getEmergency(code);
        const resources = getSupportResources(code, {
          kinds: kinds?.length ? kinds : undefined,
          language: ctx.locale,
        }).slice(0, 5);
        return {
          country: code ? (getCountry(code)?.name ?? code) : 'unknown',
          emergency: em
            ? {
                general: em.general,
                police: em.police,
                ambulance: em.ambulance,
                fire: em.fire,
                notes: em.notes,
              }
            : null,
          services: resources.map((r) => ({
            name: r.name,
            phone: r.phone,
            text: r.sms ? (r.smsKeyword ? `Text ${r.smsKeyword} to ${r.sms}` : r.sms) : undefined,
            whatsapp: r.whatsapp,
            url: r.url,
            hours: r.hours,
            for: r.audience,
          })),
          note: resources.length
            ? undefined
            : 'No verified national line on file; the directories listed cover every country.',
        };
      },
    }),

    check_message: tool({
      description:
        'Check a message, link, phone number or offer for scam signs with Waypoint’s rules engine. Use before giving any opinion on whether something is a scam.',
      inputSchema: z.object({
        text: z.string().min(1).max(4000).describe('The exact text, link or number to check.'),
      }),
      execute: async ({ text }) => {
        const r = checkMessage({ text, country: ctx.country ?? undefined });
        return {
          level: r.level,
          score: r.score,
          signs: r.signals.slice(0, 5).map((s) => s.title),
          categories: r.categories,
          advice: r.advice.slice(0, 4),
          report: r.report.slice(0, 3).map((c) => ({ name: c.name, phone: c.phone, url: c.url })),
        };
      },
    }),

    suggest_roles: tool({
      description:
        'Suggest roles that fit the person’s saved skills and interests, with reasons and missing skills.',
      inputSchema: z.object({
        interests: z
          .array(z.string().max(40))
          .max(6)
          .optional()
          .describe('Skill categories or role families, e.g. data, care, green.'),
        hoursPerWeek: z.number().int().min(1).max(40).optional(),
      }),
      execute: async ({ interests, hoursPerWeek }) => {
        const skills = await ctx.db
          .select()
          .from(userSkills)
          .where(eq(userSkills.userId, ctx.userId));
        const input: PathInput = {
          skills: skills.map((s) => ({ skillId: s.skillId, level: s.level as 0 | 1 | 2 | 3 | 4 })),
          interests: interests ?? [],
          hoursPerWeek: hoursPerWeek ?? 5,
          horizonWeeks: 8,
          situation: (ctx.situation as Situation) ?? 'steady',
          country: ctx.country ?? undefined,
          languages: [ctx.locale],
          budget: 'free',
        };
        const data = pathData(ctx.locale);
        return suggestRoles(input, data, 3).map((s) => {
          const role = data.roles.find((r) => r.id === s.roleId);
          return {
            roleId: s.roleId,
            title: role?.title,
            fit: s.fit,
            reasons: s.reasons,
            missingSkills: s.missingSkills.map((id) => skillName(id, ctx.locale)),
            aiExposure: role?.aiExposure,
            aiNote: role?.aiNote,
          };
        });
      },
    }),

    find_learning: tool({
      description:
        'Find a free or low-cost learning resource for a skill, in the person’s language where possible.',
      inputSchema: z.object({
        skillId: z.string().describe('Skill id, e.g. spreadsheets, sql, first-aid.'),
      }),
      execute: async ({ skillId }) => {
        const r = pickResource(
          skillId,
          { budget: 'low', languages: [ctx.locale, 'en'], country: ctx.country ?? undefined },
          LEARNING_RESOURCES,
        );
        return r
          ? {
              title: r.title,
              provider: r.provider,
              url: r.url,
              cost: r.cost,
              hours: r.hours,
              languages: r.languages,
            }
          : { none: true };
      },
    }),

    money_runway: tool({
      description:
        'Work out how long savings last and how stretched the month is. Does not save anything.',
      inputSchema: z.object({
        currency: z.string().length(3),
        monthlyIncome: z.number().min(0),
        essentialExpenses: z.number().min(0),
        otherExpenses: z.number().min(0),
        savings: z.number().min(0),
        debtMonthly: z.number().min(0),
      }),
      execute: async (input) => runway(input),
    }),

    life_checklist: tool({
      description:
        'Get the practical checklist for a life event (job loss, moving country, new baby, bereavement…).',
      inputSchema: z.object({ event: z.enum(LIFE_EVENTS) }),
      execute: async ({ event }) => {
        const c = getChecklist(event, ctx.country);
        return c
          ? {
              title: c.title,
              items: c.items.map((i) => ({ title: i.title, urgency: i.urgency, links: i.links })),
            }
          : null;
      },
    }),

    create_goal: tool({
      description: 'Save a goal for the person. Requires their approval.',
      inputSchema: z.object({
        title: z.string().min(3).max(120),
        area: z.enum(['path', 'money', 'mind', 'health', 'civic', 'circles', 'goals']),
        targetDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
      execute: async ({ title, area, targetDate }) => {
        // Goals are private: the title is sealed with the person's own data key.
        const id = newId();
        const dek = await dataKeyFor(ctx.db, ctx.userId);
        await ctx.db.insert(goals).values({
          id,
          userId: ctx.userId,
          titleCt: sealFor(dek, title, SEALED.goal, ctx.userId, id),
          area,
          targetDate,
        });
        return { saved: true, goalId: id, href: '/goals' };
      },
    }),

    save_memory: tool({
      description:
        'Remember a fact the person wants you to remember in future conversations. Only if they asked you to remember it. Requires approval.',
      inputSchema: z.object({
        content: z.string().min(3).max(300),
        kind: z.enum(['fact', 'preference', 'goal', 'context']),
      }),
      execute: async ({ content, kind }) => {
        if (!ctx.canRemember)
          return { saved: false, reason: 'Memory is turned off in Privacy settings.' };
        await ctx.db.insert(memories).values({ userId: ctx.userId, kind, content });
        return { saved: true };
      },
    }),

    draft_plan: tool({
      description:
        'Create a week-by-week learning plan towards a role and save it to Path. Requires approval.',
      inputSchema: z.object({
        roleId: z.string().optional().describe('Role id from suggest_roles.'),
        hoursPerWeek: z.number().int().min(1).max(40),
        horizonWeeks: z.union([z.literal(4), z.literal(8), z.literal(12)]),
      }),
      execute: async ({ roleId, hoursPerWeek, horizonWeeks }) => {
        const skills = await ctx.db
          .select()
          .from(userSkills)
          .where(eq(userSkills.userId, ctx.userId));
        const input: PathInput = {
          skills: skills.map((s) => ({ skillId: s.skillId, level: s.level as 0 | 1 | 2 | 3 | 4 })),
          interests: [],
          hoursPerWeek,
          horizonWeeks,
          situation: (ctx.situation as Situation) ?? 'steady',
          country: ctx.country ?? undefined,
          languages: [ctx.locale],
          budget: 'free',
          targetRoleId: roleId,
        };
        const locale = isLocale(ctx.locale) ? ctx.locale : 'en';
        const draft = draftPlan(input, pathData(locale), {
          roleId,
          templates: await planTemplates(locale),
        });
        // Same rules as the Path screen: this becomes the active plan, earlier ones are paused.
        const planId = await savePlan(ctx.db, {
          userId: ctx.userId,
          draft,
          horizonWeeks,
          hoursPerWeek,
          locale,
        });
        return {
          saved: true,
          planId,
          title: draft.title,
          summary: draft.summary,
          href: `/path/plans/${planId}`,
        };
      },
    }),
  };
}

export type CompanionTools = ReturnType<typeof companionTools>;

/** Tools that change data and therefore need the person’s approval. */
export const APPROVAL_TOOLS = ['create_goal', 'save_memory', 'draft_plan'] as const;
