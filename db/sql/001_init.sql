-- Meme Market schema. Money is BIGINT micro-FR. The app role cannot edit balances,
-- ledger rows, coin contracts, or the audit log. Triggers are the backstop.

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- identity ----------
CREATE TABLE "user" (
  id UUID PRIMARY KEY,
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  failed_logins INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  handle CITEXT UNIQUE NOT NULL CHECK (handle ~ '^[a-zA-Z0-9_]{3,20}$'),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  avatar_key TEXT,
  date_of_birth DATE,
  age_ok BOOLEAN NOT NULL DEFAULT false,
  phone_hash TEXT UNIQUE,
  phone_enc BYTEA,
  phone_verified_at TIMESTAMPTZ,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'moderator', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'deleted')),
  flags TEXT[] NOT NULL DEFAULT '{}',
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status = 'deleted' OR (date_of_birth IS NOT NULL AND age_ok))
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE email_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE email_messages (
  id BIGSERIAL PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE grant_claims (
  user_id UUID PRIMARY KEY,
  phone_hash TEXT UNIQUE,
  ledger_tx_id UUID NOT NULL,
  device_id TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE grant_holds (
  user_id UUID PRIMARY KEY,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- ledger ----------
CREATE TABLE ledger_accounts (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('MINT', 'PLATFORM_TREASURY', 'USER_CASH', 'CREATOR_REWARDS', 'COIN_RESERVE')),
  user_id UUID,
  coin_id UUID,
  balance_ufr BIGINT NOT NULL DEFAULT 0,
  CHECK (kind = 'MINT' OR balance_ufr >= 0),
  CHECK (
    (kind IN ('MINT', 'PLATFORM_TREASURY') AND user_id IS NULL AND coin_id IS NULL)
    OR (kind IN ('USER_CASH', 'CREATOR_REWARDS') AND user_id IS NOT NULL AND coin_id IS NULL)
    OR (kind = 'COIN_RESERVE' AND coin_id IS NOT NULL AND user_id IS NULL)
  )
);
CREATE UNIQUE INDEX ledger_accounts_user_kind ON ledger_accounts (kind, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX ledger_accounts_coin_kind ON ledger_accounts (kind, coin_id) WHERE coin_id IS NOT NULL;
CREATE UNIQUE INDEX ledger_accounts_singleton ON ledger_accounts (kind) WHERE kind IN ('MINT', 'PLATFORM_TREASURY');

CREATE TABLE ledger_transactions (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN (
    'SIGNUP_GRANT', 'BAILOUT', 'COIN_CREATE_FEE', 'TRADE_BUY', 'TRADE_SELL',
    'CREATOR_CLAIM', 'GRADUATION', 'COIN_REMOVAL_SETTLE', 'ADMIN_CLAWBACK'
  )),
  idempotency_key TEXT UNIQUE NOT NULL,
  beneficiary_user_id UUID,
  coin_id UUID,
  admin_request_id UUID,
  memo JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_signup_grant ON ledger_transactions (beneficiary_user_id) WHERE kind = 'SIGNUP_GRANT';

CREATE TABLE ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  tx_id UUID NOT NULL REFERENCES ledger_transactions(id),
  account_id BIGINT NOT NULL REFERENCES ledger_accounts(id),
  amount_ufr BIGINT NOT NULL CHECK (amount_ufr <> 0)
);
CREATE INDEX ledger_entries_tx ON ledger_entries (tx_id);
CREATE INDEX ledger_entries_account ON ledger_entries (account_id);

CREATE TABLE mint_rules (
  kind TEXT PRIMARY KEY CHECK (kind IN ('SIGNUP_GRANT', 'BAILOUT')),
  amount_ufr BIGINT NOT NULL CHECK (amount_ufr > 0),
  enabled BOOLEAN NOT NULL,
  updated_by_request UUID
);

CREATE TABLE system_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  trading_frozen BOOLEAN NOT NULL DEFAULT false,
  frozen_reason TEXT,
  frozen_at TIMESTAMPTZ,
  economy_preset TEXT NOT NULL DEFAULT 'default' CHECK (economy_preset IN ('default', 'beta')),
  bailout_enabled BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE integrity_incidents (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL,
  coin_id UUID,
  details JSONB NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by_request UUID,
  resolved_at TIMESTAMPTZ
);

-- ---------- coins ----------
CREATE TABLE coin_contracts (
  id TEXT PRIMARY KEY CHECK (id ~ '^MMC-[0-9A-F]{16}$'),
  seq BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  coin_id UUID UNIQUE NOT NULL,
  version TEXT NOT NULL,
  params JSONB NOT NULL,
  params_hash TEXT UNIQUE NOT NULL CHECK (params_hash ~ '^[0-9a-f]{64}$'),
  prev_contract_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coins (
  id UUID PRIMARY KEY,
  contract_id TEXT UNIQUE REFERENCES coin_contracts(id),
  creator_id UUID NOT NULL REFERENCES "user"(id),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 32),
  ticker CITEXT UNIQUE NOT NULL CHECK (ticker ~ '^[A-Z0-9]{3,8}$'),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  image_key TEXT NOT NULL,
  image_phash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'hidden', 'removed', 'frozen')),
  phase TEXT NOT NULL DEFAULT 'curve' CHECK (phase IN ('curve', 'pool')),
  x_ufr BIGINT,
  y_shares BIGINT,
  k NUMERIC(50, 0),
  sold_shares BIGINT NOT NULL DEFAULT 0 CHECK (sold_shares >= 0),
  reserve_ufr BIGINT NOT NULL DEFAULT 0 CHECK (reserve_ufr >= 0),
  pool_shares_minted BIGINT,
  price_ufr_per_1m BIGINT,
  holder_count INT NOT NULL DEFAULT 0,
  trade_count INT NOT NULL DEFAULT 0,
  volume_24h_ufr BIGINT NOT NULL DEFAULT 0,
  creator_rewards_lifetime_ufr BIGINT NOT NULL DEFAULT 0,
  trending_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  socials_locked BOOLEAN NOT NULL DEFAULT false,
  live_at TIMESTAMPTZ,
  graduated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX coins_live_trending ON coins (status, trending_score DESC);
CREATE INDEX coins_creator ON coins (creator_id);

CREATE TABLE coin_links (
  coin_id UUID NOT NULL REFERENCES coins(id),
  kind TEXT NOT NULL CHECK (kind IN ('x', 'tiktok', 'instagram', 'telegram', 'whatsapp_channel', 'website')),
  url TEXT NOT NULL,
  safety_status TEXT NOT NULL DEFAULT 'ok' CHECK (safety_status IN ('ok', 'unsafe', 'pending')),
  checked_at TIMESTAMPTZ,
  PRIMARY KEY (coin_id, kind)
);

CREATE TABLE coin_link_edits (
  id BIGSERIAL PRIMARY KEY,
  coin_id UUID NOT NULL,
  editor_id UUID NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE holdings (
  user_id UUID NOT NULL,
  coin_id UUID NOT NULL REFERENCES coins(id),
  shares BIGINT NOT NULL DEFAULT 0 CHECK (shares >= 0),
  cost_basis_ufr BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, coin_id)
);
CREATE INDEX holdings_coin_shares ON holdings (coin_id, shares DESC);

CREATE TABLE trades (
  id UUID PRIMARY KEY,
  seq BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id UUID NOT NULL,
  coin_id UUID NOT NULL REFERENCES coins(id),
  contract_id TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  phase TEXT NOT NULL,
  gross_ufr BIGINT NOT NULL,
  fee_ufr BIGINT NOT NULL,
  fee_creator_ufr BIGINT NOT NULL,
  fee_platform_ufr BIGINT NOT NULL,
  shares BIGINT NOT NULL CHECK (shares > 0),
  price_before_ufr_per_1m BIGINT NOT NULL,
  price_after_ufr_per_1m BIGINT NOT NULL,
  ledger_tx_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  ip_hash TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key),
  CHECK (fee_creator_ufr + fee_platform_ufr = fee_ufr)
);
CREATE INDEX trades_coin_seq ON trades (coin_id, seq);
CREATE INDEX trades_user_time ON trades (user_id, created_at);

CREATE TABLE candles (
  coin_id UUID NOT NULL,
  interval TEXT NOT NULL CHECK (interval IN ('1m', '5m', '15m', '1h', '1d')),
  bucket_start TIMESTAMPTZ NOT NULL,
  open BIGINT NOT NULL,
  high BIGINT NOT NULL,
  low BIGINT NOT NULL,
  close BIGINT NOT NULL,
  volume_ufr BIGINT NOT NULL DEFAULT 0,
  buy_volume_ufr BIGINT NOT NULL DEFAULT 0,
  sell_volume_ufr BIGINT NOT NULL DEFAULT 0,
  trades INT NOT NULL DEFAULT 0,
  first_seq BIGINT,
  last_seq BIGINT,
  PRIMARY KEY (coin_id, interval, bucket_start)
);

CREATE TABLE seasons (
  id SERIAL PRIMARY KEY,
  season_key TEXT UNIQUE NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
);
CREATE TABLE season_baselines (
  season_id INT NOT NULL REFERENCES seasons(id),
  user_id UUID NOT NULL,
  net_worth_ufr BIGINT NOT NULL,
  PRIMARY KEY (season_id, user_id)
);
CREATE TABLE season_results (
  season_id INT NOT NULL,
  board TEXT NOT NULL,
  rank INT NOT NULL,
  user_id UUID,
  coin_id UUID,
  score NUMERIC NOT NULL,
  PRIMARY KEY (season_id, board, rank)
);

CREATE TABLE reports (
  id UUID PRIMARY KEY,
  coin_id UUID NOT NULL REFERENCES coins(id),
  reporter_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coin_id, reporter_id)
);

CREATE TABLE moderation_queue (
  id UUID PRIMARY KEY,
  coin_id UUID,
  source TEXT NOT NULL,
  labels JSONB,
  status TEXT NOT NULL DEFAULT 'open',
  decided_by UUID,
  decision TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE blocked_hashes (
  phash TEXT PRIMARY KEY,
  reason TEXT NOT NULL
);

CREATE TABLE user_signals (
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  value_hash TEXT NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, value_hash)
);

CREATE TABLE abuse_flags (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  score REAL NOT NULL,
  evidence JSONB,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_requests (
  id UUID PRIMARY KEY,
  action TEXT NOT NULL,
  payload JSONB NOT NULL,
  reason TEXT NOT NULL,
  requested_by UUID NOT NULL,
  approved_by UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'executed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  CHECK (approved_by IS NULL OR approved_by <> requested_by)
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  before JSONB,
  after JSONB,
  prev_hash TEXT,
  row_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE outbox (
  id BIGSERIAL PRIMARY KEY,
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE TABLE idempotency_keys (
  user_id UUID NOT NULL,
  key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- triggers ----------
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER ledger_tx_no_change BEFORE UPDATE OR DELETE ON ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER ledger_tx_no_truncate BEFORE TRUNCATE ON ledger_transactions
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER ledger_entry_no_change BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER ledger_entry_no_truncate BEFORE TRUNCATE ON ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER contract_no_change BEFORE UPDATE OR DELETE ON coin_contracts
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER contract_no_truncate BEFORE TRUNCATE ON coin_contracts
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER link_edit_no_change BEFORE UPDATE OR DELETE ON coin_link_edits
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_no_change BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER grant_claim_no_change BEFORE UPDATE OR DELETE ON grant_claims
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER mint_rules_no_change BEFORE UPDATE OR DELETE ON mint_rules
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE OR REPLACE FUNCTION coins_contract_id_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.contract_id IS NOT NULL AND NEW.contract_id IS DISTINCT FROM OLD.contract_id THEN
    RAISE EXCEPTION 'coin contract_id is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER coins_contract_id_frozen BEFORE UPDATE ON coins
  FOR EACH ROW EXECUTE FUNCTION coins_contract_id_frozen();

CREATE OR REPLACE FUNCTION ledger_apply_balance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acct ledger_accounts%ROWTYPE;
BEGIN
  SELECT * INTO acct FROM ledger_accounts WHERE id = NEW.account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ledger account missing' USING ERRCODE = '23514';
  END IF;
  IF acct.kind = 'PLATFORM_TREASURY' AND NEW.amount_ufr <= 0 THEN
    RAISE EXCEPTION 'platform treasury can only increase' USING ERRCODE = '23514';
  END IF;
  IF acct.kind = 'MINT' AND NEW.amount_ufr >= 0 THEN
    RAISE EXCEPTION 'mint account can only be debited' USING ERRCODE = '23514';
  END IF;
  IF acct.kind <> 'MINT' AND acct.balance_ufr + NEW.amount_ufr < 0 THEN
    RAISE EXCEPTION 'insufficient balance' USING ERRCODE = '23514';
  END IF;
  UPDATE ledger_accounts SET balance_ufr = balance_ufr + NEW.amount_ufr WHERE id = NEW.account_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ledger_apply_balance
  AFTER INSERT ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_apply_balance();

CREATE OR REPLACE FUNCTION ledger_tx_is_balanced() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  k TEXT;
  beneficiary UUID;
  total BIGINT;
  n INT;
  mint_sum BIGINT;
  cash_sum BIGINT;
  reward_sum BIGINT;
  reserve_sum BIGINT;
  treasury_sum BIGINT;
  cash_users INT;
  grant_amount BIGINT;
  bailout_cap BIGINT;
  bailout_on BOOLEAN;
BEGIN
  SELECT kind, beneficiary_user_id INTO k, beneficiary
  FROM ledger_transactions WHERE id = NEW.tx_id;

  SELECT COALESCE(SUM(amount_ufr), 0), COUNT(*) INTO total, n
  FROM ledger_entries WHERE tx_id = NEW.tx_id;
  IF total <> 0 OR n < 2 THEN
    RAISE EXCEPTION 'ledger transaction is not balanced' USING ERRCODE = '23514';
  END IF;

  SELECT
    COALESCE(SUM(e.amount_ufr) FILTER (WHERE a.kind = 'MINT'), 0),
    COALESCE(SUM(e.amount_ufr) FILTER (WHERE a.kind = 'USER_CASH'), 0),
    COALESCE(SUM(e.amount_ufr) FILTER (WHERE a.kind = 'CREATOR_REWARDS'), 0),
    COALESCE(SUM(e.amount_ufr) FILTER (WHERE a.kind = 'COIN_RESERVE'), 0),
    COALESCE(SUM(e.amount_ufr) FILTER (WHERE a.kind = 'PLATFORM_TREASURY'), 0),
    COUNT(DISTINCT a.user_id) FILTER (WHERE a.kind = 'USER_CASH')
  INTO mint_sum, cash_sum, reward_sum, reserve_sum, treasury_sum, cash_users
  FROM ledger_entries e
  JOIN ledger_accounts a ON a.id = e.account_id
  WHERE e.tx_id = NEW.tx_id;

  IF k = 'SIGNUP_GRANT' THEN
    SELECT amount_ufr INTO grant_amount FROM mint_rules WHERE kind = 'SIGNUP_GRANT' AND enabled;
    IF grant_amount IS NULL OR mint_sum <> -grant_amount OR cash_sum <> grant_amount
       OR reward_sum <> 0 OR reserve_sum <> 0 OR treasury_sum <> 0 OR cash_users <> 1 THEN
      RAISE EXCEPTION 'illegal signup grant' USING ERRCODE = '23514';
    END IF;
    PERFORM 1 FROM "user" u
      JOIN profiles p ON p.user_id = u.id
      WHERE u.id = beneficiary AND u.email_verified_at IS NOT NULL AND p.age_ok AND p.status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'signup grant beneficiary is not eligible' USING ERRCODE = '23514';
    END IF;
    PERFORM 1 FROM ledger_entries e
      JOIN ledger_accounts a ON a.id = e.account_id
      WHERE e.tx_id = NEW.tx_id AND a.kind = 'USER_CASH' AND a.user_id = beneficiary;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'signup grant paid the wrong account' USING ERRCODE = '23514';
    END IF;
  ELSIF k = 'BAILOUT' THEN
    SELECT bailout_enabled INTO bailout_on FROM system_settings WHERE id = 1;
    SELECT amount_ufr INTO bailout_cap FROM mint_rules WHERE kind = 'BAILOUT' AND enabled;
    IF NOT COALESCE(bailout_on, false) OR bailout_cap IS NULL THEN
      RAISE EXCEPTION 'bailout is disabled' USING ERRCODE = '23514';
    END IF;
    IF mint_sum >= 0 OR -mint_sum > bailout_cap OR cash_sum <> -mint_sum
       OR reward_sum <> 0 OR reserve_sum <> 0 OR treasury_sum <> 0 THEN
      RAISE EXCEPTION 'illegal bailout' USING ERRCODE = '23514';
    END IF;
  ELSIF k = 'COIN_CREATE_FEE' THEN
    IF cash_sum <> -20000000 OR treasury_sum <> 20000000 OR mint_sum <> 0
       OR reward_sum <> 0 OR reserve_sum <> 0 OR cash_users <> 1 THEN
      RAISE EXCEPTION 'illegal coin create fee' USING ERRCODE = '23514';
    END IF;
  ELSIF k = 'TRADE_BUY' THEN
    IF mint_sum <> 0 OR cash_sum >= 0 OR reserve_sum <= 0 OR reward_sum < 0 OR treasury_sum < 0 OR cash_users <> 1 THEN
      RAISE EXCEPTION 'illegal buy' USING ERRCODE = '23514';
    END IF;
    IF -cash_sum <> reserve_sum + reward_sum + treasury_sum THEN
      RAISE EXCEPTION 'buy fees do not add up' USING ERRCODE = '23514';
    END IF;
  ELSIF k = 'TRADE_SELL' THEN
    IF mint_sum <> 0 OR reserve_sum >= 0 OR cash_sum <= 0 OR reward_sum < 0 OR treasury_sum < 0 OR cash_users <> 1 THEN
      RAISE EXCEPTION 'illegal sell' USING ERRCODE = '23514';
    END IF;
    IF -reserve_sum <> cash_sum + reward_sum + treasury_sum THEN
      RAISE EXCEPTION 'sell fees do not add up' USING ERRCODE = '23514';
    END IF;
  ELSIF k = 'CREATOR_CLAIM' THEN
    IF mint_sum <> 0 OR reserve_sum <> 0 OR treasury_sum <> 0 OR reward_sum >= 0 OR cash_sum <> -reward_sum OR cash_users <> 1 THEN
      RAISE EXCEPTION 'illegal creator claim' USING ERRCODE = '23514';
    END IF;
    PERFORM 1 FROM ledger_entries e
      JOIN ledger_accounts a ON a.id = e.account_id
      WHERE e.tx_id = NEW.tx_id
      GROUP BY e.tx_id
      HAVING COUNT(DISTINCT a.user_id) = 1 AND MIN(a.user_id::text) = beneficiary::text;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'claim beneficiary mismatch' USING ERRCODE = '23514';
    END IF;
  ELSIF k = 'GRADUATION' THEN
    IF mint_sum <> 0 OR cash_sum <> 0 OR reward_sum <> 0 OR reserve_sum >= 0 OR treasury_sum <> -reserve_sum THEN
      RAISE EXCEPTION 'illegal graduation' USING ERRCODE = '23514';
    END IF;
  ELSIF k = 'COIN_REMOVAL_SETTLE' THEN
    IF mint_sum <> 0 OR reward_sum <> 0 OR treasury_sum <> 0 OR reserve_sum >= 0 OR cash_sum <> -reserve_sum THEN
      RAISE EXCEPTION 'illegal settlement' USING ERRCODE = '23514';
    END IF;
    PERFORM 1 FROM ledger_entries e
      JOIN ledger_accounts a ON a.id = e.account_id
      WHERE e.tx_id = NEW.tx_id AND a.kind = 'USER_CASH' AND e.amount_ufr < 0;
    IF FOUND THEN
      RAISE EXCEPTION 'settlement cannot debit a player' USING ERRCODE = '23514';
    END IF;
  ELSIF k = 'ADMIN_CLAWBACK' THEN
    IF mint_sum <> 0 OR reserve_sum <> 0 OR treasury_sum <= 0 THEN
      RAISE EXCEPTION 'illegal clawback' USING ERRCODE = '23514';
    END IF;
    IF NOT (
      (cash_sum < 0 AND reward_sum = 0 AND treasury_sum = -cash_sum)
      OR (reward_sum < 0 AND cash_sum = 0 AND treasury_sum = -reward_sum)
    ) THEN
      RAISE EXCEPTION 'clawback direction is illegal' USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'unknown ledger kind' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER ledger_balanced
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_tx_is_balanced();

CREATE OR REPLACE FUNCTION freeze_trading(reason TEXT) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE system_settings
     SET trading_frozen = true, frozen_reason = reason, frozen_at = now()
   WHERE id = 1 AND trading_frozen = false;
END;
$$;

CREATE OR REPLACE FUNCTION unfreeze_trading() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE system_settings
     SET trading_frozen = false, frozen_reason = NULL, frozen_at = NULL
   WHERE id = 1;
END;
$$;

REVOKE ALL ON FUNCTION freeze_trading(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION unfreeze_trading() FROM PUBLIC;

CREATE OR REPLACE FUNCTION execute_admin_request(request_id UUID) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req admin_requests%ROWTYPE;
BEGIN
  SELECT * INTO req FROM admin_requests WHERE id = request_id FOR UPDATE;
  IF NOT FOUND OR req.status <> 'approved' OR req.approved_by IS NULL OR req.approved_by = req.requested_by THEN
    RAISE EXCEPTION 'request is not approved by a second admin' USING ERRCODE = '42501';
  END IF;
  IF req.expires_at < now() THEN
    RAISE EXCEPTION 'request expired' USING ERRCODE = '42501';
  END IF;
  IF req.action = 'unfreeze' THEN
    PERFORM unfreeze_trading();
  ELSIF req.action = 'set_preset' THEN
    UPDATE system_settings SET economy_preset = req.payload->>'preset' WHERE id = 1
      AND req.payload->>'preset' IN ('default', 'beta');
  ELSIF req.action = 'set_bailout' THEN
    UPDATE system_settings SET bailout_enabled = (req.payload->>'enabled')::boolean WHERE id = 1;
  ELSE
    RAISE EXCEPTION 'action is not executable' USING ERRCODE = '42501';
  END IF;
  UPDATE admin_requests SET status = 'executed', executed_at = now() WHERE id = request_id;
END;
$$;
REVOKE ALL ON FUNCTION execute_admin_request(UUID) FROM PUBLIC;

-- ---------- seed ----------
INSERT INTO system_settings (id) VALUES (1);
INSERT INTO mint_rules (kind, amount_ufr, enabled) VALUES
  ('SIGNUP_GRANT', 200000000, true),
  ('BAILOUT', 20000000, false);
INSERT INTO ledger_accounts (kind) VALUES ('MINT'), ('PLATFORM_TREASURY');

-- ---------- privileges ----------
GRANT CONNECT ON DATABASE meme_market TO app_rw;
GRANT USAGE ON SCHEMA public TO app_rw;
GRANT DELETE ON sessions, coin_links TO app_rw;
GRANT SELECT, INSERT ON
  "user", profiles, sessions, email_tokens, email_messages,
  grant_holds, ledger_accounts, ledger_transactions, ledger_entries,
  coins, coin_contracts, coin_links, coin_link_edits, holdings, trades, candles,
  seasons, season_baselines, season_results, reports, moderation_queue,
  user_signals, abuse_flags, admin_requests, audit_log, outbox, idempotency_keys, notifications
TO app_rw;
GRANT SELECT ON mint_rules, system_settings, integrity_incidents, blocked_hashes, grant_claims TO app_rw;
GRANT INSERT ON grant_claims, integrity_incidents TO app_rw;

GRANT UPDATE (
  display_name, avatar_key, date_of_birth, phone_hash, phone_enc, phone_verified_at, role, status, flags, marketing_opt_in
) ON profiles TO app_rw;
GRANT UPDATE (email, password_hash, email_verified_at, failed_logins, locked_until) ON "user" TO app_rw;
GRANT UPDATE (last_seen_at) ON sessions TO app_rw;
GRANT UPDATE (used_at) ON email_tokens TO app_rw;
GRANT UPDATE (status) ON grant_holds TO app_rw;
GRANT UPDATE (
  description, image_key, image_phash, status, phase, x_ufr, y_shares, k, sold_shares, reserve_ufr,
  pool_shares_minted, price_ufr_per_1m, holder_count, trade_count, volume_24h_ufr,
  creator_rewards_lifetime_ufr, trending_score, socials_locked, live_at, graduated_at
) ON coins TO app_rw;
GRANT UPDATE (shares, cost_basis_ufr) ON holdings TO app_rw;
GRANT UPDATE (safety_status, checked_at) ON coin_links TO app_rw;
GRANT UPDATE (
  open, high, low, close, volume_ufr, buy_volume_ufr, sell_volume_ufr, trades, first_seq, last_seq
) ON candles TO app_rw;
GRANT UPDATE (status, decision, decided_by, decided_at) ON moderation_queue TO app_rw;
GRANT UPDATE (status) ON reports TO app_rw;
GRANT UPDATE (status, approved_by, approved_at, executed_at) ON admin_requests TO app_rw;
GRANT UPDATE (published_at) ON outbox TO app_rw;
GRANT UPDATE (response) ON idempotency_keys TO app_rw;
GRANT UPDATE (last_seen) ON user_signals TO app_rw;
GRANT UPDATE (status) ON abuse_flags TO app_rw;
GRANT UPDATE (status) ON seasons TO app_rw;
GRANT UPDATE (read_at) ON notifications TO app_rw;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rw;
GRANT EXECUTE ON FUNCTION freeze_trading(TEXT) TO app_rw;
GRANT EXECUTE ON FUNCTION execute_admin_request(UUID) TO app_rw;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
