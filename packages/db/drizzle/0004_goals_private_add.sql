-- Goal titles and weekly reviews become encrypted. The plaintext columns were dropped in 0003,
-- so any older rows no longer have text to show; remove them before adding the required columns.
DELETE FROM "goals";--> statement-breakpoint
DELETE FROM "weekly_reviews";--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "title_ct" text NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "why_ct" text;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD COLUMN "body_ct" text NOT NULL;