-- Text-message channels: consent to AI answers per number, when a number was last heard from
-- (numbers are forgotten after 180 days), and daily counts for the admin console.
CREATE TABLE "channel_stats" (
	"day" date NOT NULL,
	"channel" text NOT NULL,
	"direction" text NOT NULL,
	"intent" text NOT NULL,
	"n" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "channel_stats_day_channel_direction_intent_pk" PRIMARY KEY("day","channel","direction","intent")
);
--> statement-breakpoint
ALTER TABLE "channel_identities" ADD COLUMN "ai_allowed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channel_identities" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "channel_identities_seen_idx" ON "channel_identities" USING btree ("last_seen_at");