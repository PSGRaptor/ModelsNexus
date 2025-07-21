-- schema.sql for Models Nexus SQLite Database

-- Table: models
CREATE TABLE IF NOT EXISTS models (
                                      id              INTEGER PRIMARY KEY AUTOINCREMENT,
                                      file_name       TEXT NOT NULL,
                                      model_hash      TEXT NOT NULL UNIQUE,
                                      file_path       TEXT NOT NULL,
                                      model_type      TEXT,
                                      version         TEXT,
                                      base_model      TEXT,
                                      file_size       INTEGER,
                                      date_added      TEXT NOT NULL,
                                      civitai_id      TEXT,
                                      huggingface_id  TEXT,
                                      source_url      TEXT,
                                      is_favorite     INTEGER DEFAULT 0, -- 1 for true, 0 for false
                                      last_scanned    TEXT,
                                      civitai_version_id INTEGER,
                                      model_name      TEXT,              -- Added for editable model name
                                      prompt_positive TEXT,              -- Added for editable positive prompt
                                      prompt_negative TEXT,              -- Added for editable negative prompt
                                      main_image_path TEXT
);

-- Table: images (up to 25 per model)
CREATE TABLE IF NOT EXISTS images (
                                      id              INTEGER PRIMARY KEY AUTOINCREMENT,
                                      model_hash      TEXT NOT NULL,
                                      image_path      TEXT NOT NULL,
                                      source_url      TEXT,
                                      created_at      TEXT NOT NULL,
                                      meta_json       TEXT, -- JSON metadata (EXIF, prompts, etc.)
                                      FOREIGN KEY (model_hash) REFERENCES models(model_hash)
    );

-- Table: tags (user and API)
CREATE TABLE IF NOT EXISTS tags (
                                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                                    model_hash      TEXT NOT NULL,
                                    tag             TEXT NOT NULL,
                                    source          TEXT DEFAULT 'user', -- 'user' or 'api'
                                    FOREIGN KEY (model_hash) REFERENCES models(model_hash)
    );

-- Table: user_notes
CREATE TABLE IF NOT EXISTS user_notes (
                                          id              INTEGER PRIMARY KEY AUTOINCREMENT,
                                          model_hash      TEXT UNIQUE,
                                          note            TEXT,
                                          created_at      TEXT NOT NULL,
                                          updated_at      TEXT,
                                          FOREIGN KEY (model_hash) REFERENCES models(model_hash)
    );

-- Table: scan_paths
CREATE TABLE IF NOT EXISTS scan_paths (
                                          id              INTEGER PRIMARY KEY AUTOINCREMENT,
                                          path            TEXT NOT NULL UNIQUE,
                                          enabled         INTEGER DEFAULT 1, -- 1 for true, 0 for false
                                          date_added      TEXT NOT NULL
);

-- Table: api_keys
CREATE TABLE IF NOT EXISTS api_keys (
                                        id              INTEGER PRIMARY KEY AUTOINCREMENT,
                                        provider        TEXT NOT NULL,      -- e.g. 'civitai', 'huggingface'
                                        api_key         TEXT NOT NULL,
                                        date_added      TEXT NOT NULL
);

-- Table: settings
CREATE TABLE IF NOT EXISTS settings (
                                        key             TEXT PRIMARY KEY,
                                        value           TEXT
);
