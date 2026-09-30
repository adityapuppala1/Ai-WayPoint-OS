-- Extensions Waypoint needs. Hand-written; keep this migration first.
-- pgvector: semantic search over signals and consented memories.
-- pg_trgm: fuzzy search for circles, skills and roles.
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
