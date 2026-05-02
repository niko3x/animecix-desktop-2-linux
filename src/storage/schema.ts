// SQLite schema definitions for animecix-v2
// All tables use CREATE TABLE IF NOT EXISTS for idempotent initialization

export const INIT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS window_bounds (
    id     INTEGER PRIMARY KEY CHECK (id = 1),
    x      INTEGER,
    y      INTEGER,
    width  INTEGER NOT NULL DEFAULT 1280,
    height INTEGER NOT NULL DEFAULT 800,
    maximized INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO window_bounds (id) VALUES (1);
  CREATE TABLE IF NOT EXISTS subtitle_prefs (
    anime_id   TEXT PRIMARY KEY NOT NULL,
    language   TEXT NOT NULL DEFAULT 'tr',
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS download_queue (
    id          TEXT PRIMARY KEY NOT NULL,
    episode_id  TEXT NOT NULL,
    title       TEXT NOT NULL,
    url         TEXT NOT NULL,
    sub_urls    TEXT NOT NULL DEFAULT '[]',
    output_path TEXT NOT NULL,
    total_bytes INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'queued',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS download_chunks (
    download_id      TEXT NOT NULL REFERENCES download_queue(id) ON DELETE CASCADE,
    chunk_index      INTEGER NOT NULL,
    byte_start       INTEGER NOT NULL,
    byte_end         INTEGER NOT NULL,
    bytes_downloaded INTEGER NOT NULL DEFAULT 0,
    temp_path        TEXT NOT NULL,
    completed        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (download_id, chunk_index)
  );
  CREATE TABLE IF NOT EXISTS cache_index (
    episode_id    TEXT PRIMARY KEY NOT NULL,
    mp4_path      TEXT NOT NULL,
    sub_paths     TEXT NOT NULL DEFAULT '[]',
    size_bytes    INTEGER NOT NULL DEFAULT 0,
    last_accessed INTEGER NOT NULL DEFAULT (unixepoch()),
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS episode_metadata (
    episode_id     TEXT PRIMARY KEY NOT NULL,
    anime_title    TEXT NOT NULL,
    season_number  TEXT NOT NULL DEFAULT '',
    episode_number TEXT NOT NULL DEFAULT '',
    translator     TEXT NOT NULL DEFAULT '',
    poster_url     TEXT NOT NULL DEFAULT '',
    poster_path    TEXT NOT NULL DEFAULT '',
    source         TEXT NOT NULL DEFAULT 'download',
    created_at     INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_episode_metadata_anime ON episode_metadata (anime_title);
`;
