-- Enabled once when the Postgres volume is first created.
CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector: embeddings + ANN search
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- trigram: fuzzy / hybrid text search
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- uuid helpers (defaultRandom uses gen_random_uuid)
