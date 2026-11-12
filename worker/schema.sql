-- D1 (SQLite) schema. Apply with: wrangler d1 execute eventpromoter --file=worker/schema.sql
-- Privacy by design: no IP address and no raw user-agent string is ever stored.

CREATE TABLE IF NOT EXISTS campaigns (
  id          TEXT PRIMARY KEY,          -- slug, e.g. "welcome-week-kickoff"
  name        TEXT NOT NULL,
  event_date  TEXT,                      -- free text, display only
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
  code         TEXT PRIMARY KEY,         -- short code in /r/:code
  campaign_id  TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL,            -- instagram-post | instagram-story | poster | slide | screen
  dest_url     TEXT NOT NULL,            -- where the click ends up (UTM params are added on redirect)
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_links_campaign ON links(campaign_id);

CREATE TABLE IF NOT EXISTS clicks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL REFERENCES links(code) ON DELETE CASCADE,
  ts            INTEGER NOT NULL,        -- epoch ms
  day           TEXT NOT NULL,           -- YYYY-MM-DD in the configured timezone
  via           TEXT NOT NULL DEFAULT 'link',  -- 'qr' when the QR variant of the URL was used
  device        TEXT NOT NULL DEFAULT 'other', -- mobile | desktop | other
  country       TEXT,                    -- ISO code from Cloudflare, if known
  referrer_host TEXT,                    -- host only, never the full URL
  is_bot        INTEGER NOT NULL DEFAULT 0     -- link-preview fetchers and crawlers, excluded from stats
);
CREATE INDEX IF NOT EXISTS idx_clicks_code_day ON clicks(code, day);
