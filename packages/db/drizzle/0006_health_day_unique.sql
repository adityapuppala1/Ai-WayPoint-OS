-- Health logs become one row per person, kind and day (so a day's values can be updated in
-- place). Keep the newest row if older data has duplicates.
DELETE FROM "health_logs" a USING "health_logs" b
  WHERE a."user_id" = b."user_id" AND a."kind" = b."kind" AND a."logged_for" = b."logged_for"
  AND (a."created_at" < b."created_at" OR (a."created_at" = b."created_at" AND a."id" < b."id"));--> statement-breakpoint
DROP INDEX "health_logs_user_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "health_logs_day_idx" ON "health_logs" USING btree ("user_id","kind","logged_for");--> statement-breakpoint
-- Reminder titles become encrypted (added in 0007).
ALTER TABLE "reminders" DROP COLUMN "title";