-- Reminder titles are now encrypted. The plaintext column was dropped in 0006, so older rows
-- have nothing to show; remove them before adding the required column.
DELETE FROM "reminders";--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "title_ct" text NOT NULL;
