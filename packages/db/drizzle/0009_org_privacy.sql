-- Organisation privacy: each programme has its own "count me" choice, totals are taken once a
-- week, and a person has one seat per organisation team.
CREATE TABLE "org_insight_snapshots" (
	"programme_id" uuid NOT NULL,
	"week" date NOT NULL,
	"counts" jsonb NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_insight_snapshots_programme_id_week_pk" PRIMARY KEY("programme_id","week")
);
--> statement-breakpoint
ALTER TABLE "org_enrolments" ADD COLUMN "counted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Until now one account-wide choice covered every programme: keep what people chose.
UPDATE "org_enrolments" e SET "counted" = true
WHERE EXISTS (
  SELECT 1 FROM "consents" c
  WHERE c."user_id" = e."user_id" AND c."purpose" = 'org_aggregates' AND c."granted" = true
);--> statement-breakpoint
ALTER TABLE "org_insight_snapshots" ADD CONSTRAINT "org_insight_snapshots_programme_id_org_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."org_programmes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- If a race ever gave someone two seats in one team, keep the earliest.
DELETE FROM "members" m USING "members" d
WHERE m."organization_id" = d."organization_id" AND m."user_id" = d."user_id"
  AND (m."created_at", m."id") > (d."created_at", d."id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_org_user_idx" ON "members" USING btree ("organization_id","user_id");
