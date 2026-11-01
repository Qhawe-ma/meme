-- Row locks on ledger accounts need UPDATE privilege, which the app must not have.
-- A definer function takes the lock as the table owner and holds it for the caller's transaction.
CREATE OR REPLACE FUNCTION lock_ledger_account(account_id BIGINT) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM id FROM ledger_accounts WHERE id = account_id FOR UPDATE;
END;
$$;

REVOKE ALL ON FUNCTION lock_ledger_account(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lock_ledger_account(BIGINT) TO app_rw;
