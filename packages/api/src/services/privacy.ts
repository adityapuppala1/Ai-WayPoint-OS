/**
 * Your data: a complete, readable export and permanent deletion.
 * Encrypted fields are decrypted for the export (it goes only to the person).
 */
import { openDek, openFor, SEALED } from '@waypoint/core/privacy';
import * as s from '@waypoint/db';
import { and, type Database, eq, inArray, ne, or, sql } from '@waypoint/db';
import { getConsents, getProfile, listTrustedContacts } from './me';
import { handOverOrganisations } from './org';

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function exportData(db: Database, userId: string): Promise<Record<string, unknown>> {
  const [profileRow] = await db
    .select()
    .from(s.profiles)
    .where(eq(s.profiles.userId, userId))
    .limit(1);
  const dek = profileRow?.dekWrapped ? openDek(profileRow.dekWrapped) : null;
  const parseJson = (text: string | null): unknown => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return text;
    }
  };
  const open = (ct: string | null, table: string, rowId?: string) => {
    if (!ct || !dek) return null;
    try {
      return openFor(dek, ct, table, userId, rowId);
    } catch {
      return '[could not be decrypted]';
    }
  };

  const [user] = await db
    .select({
      id: s.users.id,
      name: s.users.name,
      email: s.users.email,
      createdAt: s.users.createdAt,
      isAnonymous: s.users.isAnonymous,
    })
    .from(s.users)
    .where(eq(s.users.id, userId));

  const convos = await db.select().from(s.conversations).where(eq(s.conversations.userId, userId));
  const msgs = convos.length
    ? await db
        .select()
        .from(s.messages)
        .where(
          inArray(
            s.messages.conversationId,
            convos.map((c) => c.id),
          ),
        )
    : [];
  const planRows = await db.select().from(s.plans).where(eq(s.plans.userId, userId));
  const stepRows = planRows.length
    ? await db
        .select()
        .from(s.planSteps)
        .where(
          inArray(
            s.planSteps.planId,
            planRows.map((p) => p.id),
          ),
        )
    : [];
  const checklistRows = await db
    .select()
    .from(s.userChecklists)
    .where(eq(s.userChecklists.userId, userId));
  const checklistItems = checklistRows.length
    ? await db
        .select()
        .from(s.userChecklistItems)
        .where(
          inArray(
            s.userChecklistItems.checklistId,
            checklistRows.map((c) => c.id),
          ),
        )
    : [];
  const [money] = await db
    .select()
    .from(s.moneySnapshots)
    .where(eq(s.moneySnapshots.userId, userId));

  const [
    consentEvents,
    crisisEvents,
    skills,
    projects,
    credentials,
    shieldChecks,
    scamReports,
    memberships,
    posts,
    memories,
    signalStates,
    predictions,
    moods,
    journal,
    health,
    reminders,
    places,
    goals,
    reviews,
    nudges,
    usage,
    feedback,
    requests,
    enrolments,
    teams,
  ] = await Promise.all([
    db.select().from(s.consentEvents).where(eq(s.consentEvents.userId, userId)),
    db.select().from(s.crisisEvents).where(eq(s.crisisEvents.userId, userId)),
    db.select().from(s.userSkills).where(eq(s.userSkills.userId, userId)),
    db.select().from(s.projects).where(eq(s.projects.userId, userId)),
    db.select().from(s.credentials).where(eq(s.credentials.userId, userId)),
    db.select().from(s.shieldChecks).where(eq(s.shieldChecks.userId, userId)),
    db.select().from(s.scamReports).where(eq(s.scamReports.userId, userId)),
    db.select().from(s.circleMembers).where(eq(s.circleMembers.userId, userId)),
    db.select().from(s.circlePosts).where(eq(s.circlePosts.authorId, userId)),
    db.select().from(s.memories).where(eq(s.memories.userId, userId)),
    db.select().from(s.signalStates).where(eq(s.signalStates.userId, userId)),
    db.select().from(s.forecastPredictions).where(eq(s.forecastPredictions.userId, userId)),
    db.select().from(s.moodCheckins).where(eq(s.moodCheckins.userId, userId)),
    db.select().from(s.journalEntries).where(eq(s.journalEntries.userId, userId)),
    db.select().from(s.healthLogs).where(eq(s.healthLogs.userId, userId)),
    db.select().from(s.reminders).where(eq(s.reminders.userId, userId)),
    db.select().from(s.places).where(eq(s.places.userId, userId)),
    db.select().from(s.goals).where(eq(s.goals.userId, userId)),
    db.select().from(s.weeklyReviews).where(eq(s.weeklyReviews.userId, userId)),
    db.select().from(s.nudges).where(eq(s.nudges.userId, userId)),
    db.select().from(s.aiUsage).where(eq(s.aiUsage.userId, userId)),
    db.select().from(s.feedback).where(eq(s.feedback.userId, userId)),
    db.select().from(s.dataRequests).where(eq(s.dataRequests.userId, userId)),
    db
      .select({
        programme: s.orgProgrammes.name,
        organisation: s.organizations.name,
        joinedAt: s.orgEnrolments.enrolledAt,
        countedInTotals: s.orgEnrolments.counted,
      })
      .from(s.orgEnrolments)
      .innerJoin(s.orgProgrammes, eq(s.orgProgrammes.id, s.orgEnrolments.programmeId))
      .innerJoin(s.organizations, eq(s.organizations.id, s.orgProgrammes.organizationId))
      .where(eq(s.orgEnrolments.userId, userId)),
    db
      .select({
        organisation: s.organizations.name,
        role: s.members.role,
        since: s.members.createdAt,
      })
      .from(s.members)
      .innerJoin(s.organizations, eq(s.organizations.id, s.members.organizationId))
      .where(eq(s.members.userId, userId)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    format: 'waypoint-export/1',
    note: 'Everything Waypoint stores about you. Scam checks never stored the text you pasted, so it is not here.',
    account: user
      ? {
          id: user.id,
          name: user.name,
          email: user.isAnonymous ? null : user.email,
          guest: user.isAnonymous ?? false,
          createdAt: iso(user.createdAt),
        }
      : null,
    profile: await getProfile(db, userId),
    consents: await getConsents(db, userId),
    consentHistory: consentEvents,
    trustedContacts: await listTrustedContacts(db, userId),
    skills,
    plans: planRows.map((p) => ({ ...p, steps: stepRows.filter((st) => st.planId === p.id) })),
    projects,
    credentials,
    conversations: convos.map((c) => ({
      ...c,
      messages: msgs.filter((m) => m.conversationId === c.id),
    })),
    memories: memories.map(({ embedding: _e, contentCt, ...m }) => ({
      ...m,
      content: m.content ?? open(contentCt, SEALED.memory, m.id),
    })),
    shieldChecks,
    scamReports,
    circles: { memberships, posts },
    signals: signalStates,
    forecastPredictions: predictions,
    mind: {
      moodCheckins: moods.map(({ noteCt, ...m }) => ({
        ...m,
        note: open(noteCt, SEALED.mood, m.id),
      })),
      journal: journal.map(({ bodyCt, ...j }) => ({
        ...j,
        body: open(bodyCt, SEALED.journal, j.id),
      })),
    },
    health: health.map(({ noteCt, ...h }) => ({ ...h, note: open(noteCt, SEALED.health, h.id) })),
    money: money
      ? {
          currency: money.currency,
          data: parseJson(open(money.dataCt, SEALED.money)),
          updatedAt: iso(money.updatedAt),
        }
      : null,
    checklists: checklistRows.map((c) => ({
      ...c,
      items: checklistItems.filter((i) => i.checklistId === c.id),
    })),
    reminders: reminders.map(({ titleCt, ...r }) => ({
      ...r,
      title: open(titleCt, SEALED.reminder, r.id),
    })),
    places,
    goals: goals.map(({ titleCt, whyCt, ...g }) => ({
      ...g,
      title: open(titleCt, SEALED.goal, g.id),
      why: open(whyCt, SEALED.goal, g.id),
    })),
    weeklyReviews: reviews.map(({ bodyCt, ...r }) => ({
      ...r,
      answers: parseJson(open(bodyCt, SEALED.weeklyReview, r.id)),
    })),
    nudges,
    programmes: enrolments,
    organisationTeams: teams,
    safetyRecords: crisisEvents,
    aiUsage: usage,
    feedback,
    dataRequests: requests,
  };
}

/**
 * Delete the account and everything linked to it. Rows cascade from `users`; the data key
 * goes with the profile, so any stray ciphertext is unreadable (crypto-shredding).
 */
export async function deleteAccount(db: Database, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(s.auditLog)
      .values({ actorUserId: null, action: 'account.deleted', targetType: 'user', meta: {} });
    await tx.update(s.profiles).set({ dekWrapped: null }).where(eq(s.profiles.userId, userId));
    // Organisations this person alone owns pass to an admin (or close if there is none).
    await handOverOrganisations(tx, userId);
    // The activity log keeps what happened to shared things, not who did it once they leave.
    await tx
      .update(s.auditLog)
      .set({ actorUserId: null, ipHash: null })
      .where(eq(s.auditLog.actorUserId, userId));
    await tx
      .update(s.auditLog)
      .set({ targetId: null })
      .where(and(eq(s.auditLog.targetType, 'user'), eq(s.auditLog.targetId, userId)));
    // Circle posts would otherwise outlive the account (author set to null): remove them, with
    // the replies they received, and free the person's seats.
    const posts = await tx
      .select({ id: s.circlePosts.id })
      .from(s.circlePosts)
      .where(eq(s.circlePosts.authorId, userId));
    const ids = posts.map((p) => p.id);
    if (ids.length) {
      await tx
        .delete(s.circlePosts)
        .where(or(inArray(s.circlePosts.id, ids), inArray(s.circlePosts.parentId, ids)));
    }
    const seats = await tx
      .select({ circleId: s.circleMembers.circleId })
      .from(s.circleMembers)
      .where(eq(s.circleMembers.userId, userId));
    if (seats.length) {
      await tx
        .update(s.circles)
        .set({ memberCount: sql`greatest(${s.circles.memberCount} - 1, 0)` })
        .where(
          inArray(
            s.circles.id,
            seats.map((m) => m.circleId),
          ),
        );
    }
    // Rows that would otherwise stay behind without an owner (their link to the account is
    // only set to null): what the person wrote in feedback, scam reports nobody has published
    // (a published one has already become a warning for others: it keeps the kind of scam and
    // the websites named, and loses the description and the amount), and messages still
    // waiting to be sent to them.
    await tx.delete(s.feedback).where(eq(s.feedback.userId, userId));
    await tx
      .delete(s.scamReports)
      .where(and(eq(s.scamReports.userId, userId), ne(s.scamReports.status, 'published')));
    await tx
      .update(s.scamReports)
      .set({ descriptionRedacted: null, amountLost: null, currency: null })
      .where(eq(s.scamReports.userId, userId));
    await tx.execute(sql`delete from outbox where payload->>'userId' = ${userId}`);
    await tx.delete(s.users).where(eq(s.users.id, userId));
  });
}
