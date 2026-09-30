ALTER TABLE "forecasts" ADD COLUMN "what_to_do" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "forecasts" ADD COLUMN "sources" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "forecasts" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "forecasts" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "forecasts" ADD COLUMN "base_rate" numeric(5, 4);