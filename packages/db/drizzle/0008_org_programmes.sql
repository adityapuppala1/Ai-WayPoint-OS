-- Programmes get a join code (what people type or scan to join), can be closed, and use plain
-- dates. Leaving a programme now deletes the enrolment, so `left_at` goes.
ALTER TABLE "org_programmes" ALTER COLUMN "starts_on" SET DATA TYPE date USING "starts_on"::date;--> statement-breakpoint
ALTER TABLE "org_programmes" ALTER COLUMN "ends_on" SET DATA TYPE date USING "ends_on"::date;--> statement-breakpoint
ALTER TABLE "org_programmes" ADD COLUMN "join_code" text;--> statement-breakpoint
-- Existing programmes get a random code from the same unambiguous alphabet as new ones
-- (correlated with the row so every programme gets its own).
UPDATE "org_programmes" SET "join_code" = (
  SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  FROM generate_series(1, 8)
  WHERE "org_programmes"."id" IS NOT NULL
) WHERE "join_code" IS NULL;--> statement-breakpoint
ALTER TABLE "org_programmes" ALTER COLUMN "join_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "org_programmes" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "org_programmes" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "org_enrolments_user_idx" ON "org_enrolments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_programmes_join_code_idx" ON "org_programmes" USING btree ("join_code");--> statement-breakpoint
ALTER TABLE "org_enrolments" DROP COLUMN "left_at";
