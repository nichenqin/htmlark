CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  head_version INTEGER NOT NULL,
  follow_latest INTEGER NOT NULL,
  source_public INTEGER NOT NULL,
  password_hash TEXT,
  dirty INTEGER NOT NULL,
  vendor_specs TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS versions (
  artifact_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  dirty INTEGER NOT NULL,
  PRIMARY KEY (artifact_id, version)
);
