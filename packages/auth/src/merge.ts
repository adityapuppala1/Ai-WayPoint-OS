/**
 * When someone who started as a guest creates an account (or signs in and asks for it),
 * everything they did as a guest moves to their account: plans, checks, journal, goals…
 * Encrypted fields are re-encrypted for the account's data key. Runs in one transaction.
 */
import { openDek, openFor, SEALED, sealFor } from '@waypoint/core/privacy';
import * as s from '@waypoint/db';
import { type Database, eq, inArray, or, sql } from '@waypoint/db';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Simple tables: move every row. */
const MOVE = [
  s.consentEvents,
  s.crisisEvents,
  s.plans,
  s.projects,
  s.credentials,
  s.shieldChecks,
  s.conversations,
  s.places,
  s.nudges,
  s.pushSubscriptions,
  s.dataRequests,
] as const;

/** Composite-key tables: keep the account's row when both exist. */
const MERGE: Array<{ table: s.AnyUserTable; key: string[] }> = [
  { table: s.consents, key: ['purpose'] },
  { table: s.userSkills, key: ['skill_id'] },
  { table: s.signalStates, key: ['signal_id'] },
  { table: s.circleMembers, key: ['circle_id'] },
  { table: s.circleReactions, key: ['post_id', 'kind'] },
  { table: s.orgEnrolments, key: ['programme_id'] },
  { table: s.userChecklists, key: ['event', 'country'] },
];

async function moveAll(tx: Tx, table: s.AnyUserTable, from: string, to: string) {
  await tx.execute(sql`update ${table} set user_id = ${to} where user_id = ${from}`);
}

async function mergeKeyed(tx: Tx, table: s.AnyUserTable, key: string[], from: string, to: string) {
  const match = sql.join(
    key.map((k) => sql`t2.${sql.identifier(k)} = t.${sql.identifier(k)}`),
    sql` and `,
  );
  await tx.execute(
    sql`update ${table} as t set user_id = ${to}
        where t.user_id = ${from}
        and not exists (select 1 from ${table} as t2 where t2.user_id = ${to} and ${match})`,
  );
  await tx.execute(sql`delete from ${table} where user_id = ${from}`);
}

export async function mergeGuestIntoUser(
  db: Database,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  if (fromUserId === toUserId) return;
  await db.transaction(async (tx) => {
    const [fromProfile] = await tx
      .select()
      .from(s.profiles)
      .where(eq(s.profiles.userId, fromUserId));
    const [toProfile] = await tx.select().from(s.profiles).where(eq(s.profiles.userId, toUserId));

    const fromDek = fromProfile?.dekWrapped ? openDek(fromProfile.dekWrapped) : null;
    const toDek = toProfile?.dekWrapped ? openDek(toProfile.dekWrapped) : null;

    const recrypt = (ct: string | null, table: string, rowId?: string): string | null => {
      if (!ct || !fromDek || !toDek) return ct;
      return sealFor(toDek, openFor(fromDek, ct, table, fromUserId, rowId), table, toUserId, rowId);
    };

    // Encrypted, per-row tables.
    for (const row of await tx
      .select()
      .from(s.journalEntries)
      .where(eq(s.journalEntries.userId, fromUserId))) {
      await tx
        .update(s.journalEntries)
        .set({
          userId: toUserId,
          bodyCt: recrypt(row.bodyCt, SEALED.journal, row.id) ?? row.bodyCt,
        })
        .where(eq(s.journalEntries.id, row.id));
    }
    for (const row of await tx
      .select()
      .from(s.moodCheckins)
      .where(eq(s.moodCheckins.userId, fromUserId))) {
      await tx
        .update(s.moodCheckins)
        .set({ userId: toUserId, noteCt: recrypt(row.noteCt, SEALED.mood, row.id) })
        .where(eq(s.moodCheckins.id, row.id));
    }
    // Health logs: one per kind and day; the account's own entry wins if both exist.
    const accountDays = new Set(
      (
        await tx
          .select({ kind: s.healthLogs.kind, day: s.healthLogs.loggedFor })
          .from(s.healthLogs)
          .where(eq(s.healthLogs.userId, toUserId))
      ).map((r) => `${r.kind}:${r.day}`),
    );
    for (const row of await tx
      .select()
      .from(s.healthLogs)
      .where(eq(s.healthLogs.userId, fromUserId))) {
      if (accountDays.has(`${row.kind}:${row.loggedFor}`)) {
        await tx.delete(s.healthLogs).where(eq(s.healthLogs.id, row.id));
        continue;
      }
      await tx
        .update(s.healthLogs)
        .set({ userId: toUserId, noteCt: recrypt(row.noteCt, SEALED.health, row.id) })
        .where(eq(s.healthLogs.id, row.id));
    }
    for (const row of await tx
      .select()
      .from(s.reminders)
      .where(eq(s.reminders.userId, fromUserId))) {
      await tx
        .update(s.reminders)
        .set({
          userId: toUserId,
          titleCt: recrypt(row.titleCt, SEALED.reminder, row.id) ?? row.titleCt,
        })
        .where(eq(s.reminders.id, row.id));
    }
    for (const row of await tx.select().from(s.memories).where(eq(s.memories.userId, fromUserId))) {
      await tx
        .update(s.memories)
        .set({ userId: toUserId, contentCt: recrypt(row.contentCt, SEALED.memory, row.id) })
        .where(eq(s.memories.id, row.id));
    }
    for (const row of await tx
      .select()
      .from(s.trustedContacts)
      .where(eq(s.trustedContacts.userId, fromUserId))) {
      await tx
        .update(s.trustedContacts)
        .set({
          userId: toUserId,
          nameCt: recrypt(row.nameCt, SEALED.trustedContact, row.id) ?? row.nameCt,
          phoneCt: recrypt(row.phoneCt, SEALED.trustedContact, row.id),
          emailCt: recrypt(row.emailCt, SEALED.trustedContact, row.id),
        })
        .where(eq(s.trustedContacts.id, row.id));
    }
    for (const row of await tx.select().from(s.goals).where(eq(s.goals.userId, fromUserId))) {
      await tx
        .update(s.goals)
        .set({
          userId: toUserId,
          titleCt: recrypt(row.titleCt, SEALED.goal, row.id) ?? row.titleCt,
          whyCt: recrypt(row.whyCt, SEALED.goal, row.id),
        })
        .where(eq(s.goals.id, row.id));
    }
    // Weekly reviews: one per week; the account's own review wins if both exist.
    const accountWeeks = new Set(
      (
        await tx
          .select({ weekStart: s.weeklyReviews.weekStart })
          .from(s.weeklyReviews)
          .where(eq(s.weeklyReviews.userId, toUserId))
      ).map((r) => r.weekStart),
    );
    for (const row of await tx
      .select()
      .from(s.weeklyReviews)
      .where(eq(s.weeklyReviews.userId, fromUserId))) {
      if (accountWeeks.has(row.weekStart)) {
        await tx.delete(s.weeklyReviews).where(eq(s.weeklyReviews.id, row.id));
        continue;
      }
      await tx
        .update(s.weeklyReviews)
        .set({
          userId: toUserId,
          bodyCt: recrypt(row.bodyCt, SEALED.weeklyReview, row.id) ?? row.bodyCt,
        })
        .where(eq(s.weeklyReviews.id, row.id));
    }
    const [money] = await tx
      .select()
      .from(s.moneySnapshots)
      .where(eq(s.moneySnapshots.userId, fromUserId));
    if (money) {
      const [existing] = await tx
        .select()
        .from(s.moneySnapshots)
        .where(eq(s.moneySnapshots.userId, toUserId));
      if (!existing) {
        await tx.insert(s.moneySnapshots).values({
          userId: toUserId,
          currency: money.currency,
          dataCt: recrypt(money.dataCt, SEALED.money) ?? money.dataCt,
        });
      }
      await tx.delete(s.moneySnapshots).where(eq(s.moneySnapshots.userId, fromUserId));
    }

    for (const table of MOVE) await moveAll(tx, table, fromUserId, toUserId);
    for (const { table, key } of MERGE) await mergeKeyed(tx, table, key, fromUserId, toUserId);
    // The account's own choice about being counted wins: if it does not allow organisations to
    // count it, no programme choice carried over from the guest counts either.
    await tx.execute(sql`
      update ${s.orgEnrolments} set counted = false, counted_since = null
      where user_id = ${toUserId} and not exists (
        select 1 from ${s.consents} c
        where c.user_id = ${toUserId} and c.purpose = 'org_aggregates' and c.granted = true)`);

    // Authored content keeps its author.
    await tx.execute(
      sql`update ${s.circlePosts} set author_id = ${toUserId} where author_id = ${fromUserId}`,
    );
    await tx.execute(
      sql`update ${s.circles} set created_by = ${toUserId} where created_by = ${fromUserId}`,
    );
    await tx.execute(
      sql`update ${s.forecastPredictions} set user_id = ${toUserId} where user_id = ${fromUserId}`,
    );

    // Profile: carry over what the guest set up, without overwriting account choices.
    if (fromProfile && toProfile && !toProfile.onboardedAt) {
      const {
        userId: _u,
        dekWrapped: _d,
        createdAt: _c,
        updatedAt: _up,
        ...settings
      } = fromProfile;
      await tx.update(s.profiles).set(settings).where(eq(s.profiles.userId, toUserId));
    }
  });
}

/**
 * Someone signs in to an account that was not created from the guest session open on this
 * device, and didn't ask to bring it along: on a shared device the guest may have been someone
 * else. What the guest did is deleted, as when anyone deletes an account — its data key is
 * destroyed first (so anything encrypted is unreadable at once), and its circle posts go with
 * the replies they received. Better Auth then deletes the guest itself; everything else it
 * owned goes with it.
 */
export async function discardGuest(db: Database, guestId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [guest] = await tx
      .select({ isAnonymous: s.users.isAnonymous })
      .from(s.users)
      .where(eq(s.users.id, guestId));
    // Only ever a guest: a real account is never deleted here.
    if (!guest?.isAnonymous) return;
    await tx.update(s.profiles).set({ dekWrapped: null }).where(eq(s.profiles.userId, guestId));
    const posts = await tx
      .select({ id: s.circlePosts.id })
      .from(s.circlePosts)
      .where(eq(s.circlePosts.authorId, guestId));
    const ids = posts.map((p) => p.id);
    if (ids.length)
      await tx
        .delete(s.circlePosts)
        .where(or(inArray(s.circlePosts.id, ids), inArray(s.circlePosts.parentId, ids)));
    const seats = await tx
      .select({ circleId: s.circleMembers.circleId })
      .from(s.circleMembers)
      .where(eq(s.circleMembers.userId, guestId));
    if (seats.length)
      await tx
        .update(s.circles)
        .set({ memberCount: sql`greatest(${s.circles.memberCount} - 1, 0)` })
        .where(
          inArray(
            s.circles.id,
            seats.map((m) => m.circleId),
          ),
        );
    await tx.delete(s.circleMembers).where(eq(s.circleMembers.userId, guestId));
  });
}
