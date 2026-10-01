CREATE TABLE "activity_days" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"platforms" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "activity_days_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "usage_views" (
	"day" date NOT NULL,
	"hour" smallint NOT NULL,
	"module" text NOT NULL,
	"platform" text NOT NULL,
	"audience" text NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"locale" text DEFAULT '' NOT NULL,
	"n" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_views_day_hour_module_platform_audience_country_locale_pk" PRIMARY KEY("day","hour","module","platform","audience","country","locale")
);
--> statement-breakpoint
ALTER TABLE "activity_days" ADD CONSTRAINT "activity_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_days_day_idx" ON "activity_days" USING btree ("day");