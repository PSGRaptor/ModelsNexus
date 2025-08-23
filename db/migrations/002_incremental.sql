-- START OF FILE: db/migrations/002_incremental.sql

-- Columns (add if missing). If you already have any of these, your migration runner should skip/ignore errors.
-- You likely already store some; this is a superset for incremental scanning/hydration flags.

-- IMPORTANT: run these conditionally in your migration runner. If not, you can wrap in pragmatic try/catch.

ALTER TABLE models ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE models ADD COLUMN IF NOT EXISTS file_size INTEGER;           -- bytes
ALTER TABLE models ADD COLUMN IF NOT EXISTS mtime_epoch INTEGER;         -- epoch seconds
ALTER TABLE models ADD COLUMN IF NOT EXISTS content_hash TEXT;           -- BLAKE3 hex
ALTER TABLE models ADD COLUMN IF NOT EXISTS has_metadata INTEGER DEFAULT 0;  -- 0/1
ALTER TABLE models ADD COLUMN IF NOT EXISTS has_images   INTEGER DEFAULT 0;  -- 0/1
ALTER TABLE models ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;
ALTER TABLE models ADD COLUMN IF NOT EXISTS last_scanned_at INTEGER;     -- epoch seconds

-- Indices to accelerate startup listing and incremental checks
CREATE INDEX IF NOT EXISTS idx_models_file_path      ON models(file_path);
CREATE INDEX IF NOT EXISTS idx_models_hash           ON models(content_hash);
CREATE INDEX IF NOT EXISTS idx_models_mtime          ON models(mtime_epoch);
CREATE INDEX IF NOT EXISTS idx_models_has_meta       ON models(has_metadata);
CREATE INDEX IF NOT EXISTS idx_models_has_images     ON models(has_images);

-- END OF FILE
