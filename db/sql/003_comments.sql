CREATE TABLE IF NOT EXISTS coin_comments (
  id UUID PRIMARY KEY,
  coin_id UUID NOT NULL REFERENCES coins(id),
  user_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coin_comments_coin ON coin_comments (coin_id, created_at DESC);
GRANT SELECT, INSERT ON coin_comments TO app_rw;
