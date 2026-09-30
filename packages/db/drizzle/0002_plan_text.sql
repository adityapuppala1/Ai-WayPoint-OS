ALTER TABLE "plan_steps" ADD COLUMN "text" jsonb;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "text" jsonb;