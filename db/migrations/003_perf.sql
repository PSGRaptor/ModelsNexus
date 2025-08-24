-- START OF FILE: db/migrations/003_perf.sql

-- Used by models:list ORDER BY and filtering.
CREATE INDEX IF NOT EXISTS idx_models_file_name_nocase
    ON models(file_name COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_models_model_type
    ON models(model_type);

CREATE INDEX IF NOT EXISTS idx_models_has_images
    ON models(has_images);

CREATE INDEX IF NOT EXISTS idx_models_has_metadata
    ON models(has_metadata);

CREATE INDEX IF NOT EXISTS idx_models_is_favorite
    ON models(is_favorite);

-- If you filter by base_model often, add this too:
CREATE INDEX IF NOT EXISTS idx_models_base_model
    ON models(base_model);

-- Keep SQLite’s stats up to date:
ANALYZE;

-- END OF FILE
