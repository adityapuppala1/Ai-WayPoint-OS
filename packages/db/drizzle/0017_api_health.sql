CREATE TABLE "api_errors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"method" text NOT NULL,
	"route" text NOT NULL,
	"status" smallint NOT NULL,
	"code" text,
	"message" text NOT NULL,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_metrics" (
	"bucket" timestamp with time zone NOT NULL,
	"method" text NOT NULL,
	"route" text NOT NULL,
	"status_class" smallint NOT NULL,
	"n" integer DEFAULT 0 NOT NULL,
	"sum_ms" integer DEFAULT 0 NOT NULL,
	"max_ms" integer DEFAULT 0 NOT NULL,
	"h0" integer DEFAULT 0 NOT NULL,
	"h1" integer DEFAULT 0 NOT NULL,
	"h2" integer DEFAULT 0 NOT NULL,
	"h3" integer DEFAULT 0 NOT NULL,
	"h4" integer DEFAULT 0 NOT NULL,
	"h5" integer DEFAULT 0 NOT NULL,
	"h6" integer DEFAULT 0 NOT NULL,
	"h7" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_metrics_bucket_method_route_status_class_pk" PRIMARY KEY("bucket","method","route","status_class")
);
--> statement-breakpoint
CREATE INDEX "api_errors_created_idx" ON "api_errors" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_metrics_bucket_idx" ON "api_metrics" USING btree ("bucket");