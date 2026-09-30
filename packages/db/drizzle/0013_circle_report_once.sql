-- One report per person per post. Reports made twice by the same person (possible before this
-- index existed, when requests arrived together) are reduced to the earliest one first.
DELETE FROM "circle_reports" a USING "circle_reports" b
WHERE a."post_id" = b."post_id"
  AND a."reporter_id" = b."reporter_id"
  AND (a."created_at" > b."created_at" OR (a."created_at" = b."created_at" AND a."id" > b."id"));--> statement-breakpoint
CREATE UNIQUE INDEX "circle_reports_once_idx" ON "circle_reports" USING btree ("post_id","reporter_id");
