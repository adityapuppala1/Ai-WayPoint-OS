-- People count from a week after they CHOSE to be counted, not after they joined: switching
-- counting on for a programme joined long ago starts the week then.
ALTER TABLE "org_enrolments" ADD COLUMN "counted_since" timestamp with time zone;--> statement-breakpoint
UPDATE "org_enrolments" SET "counted_since" = "enrolled_at" WHERE "counted" = true;
