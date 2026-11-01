import type { Tx } from "@/server/db";
import { bi, jsonb } from "@/server/db";
import { uuidv7 } from "@/server/ids";

export type LedgerKind =
  | "SIGNUP_GRANT"
  | "BAILOUT"
  | "COIN_CREATE_FEE"
  | "TRADE_BUY"
  | "TRADE_SELL"
  | "CREATOR_CLAIM"
  | "GRADUATION"
  | "COIN_REMOVAL_SETTLE"
  | "ADMIN_CLAWBACK";

export async function postLedger(
  tx: Tx,
  input: {
    kind: LedgerKind;
    idempotencyKey: string;
    beneficiaryUserId?: string | null;
    coinId?: string | null;
    memo?: unknown;
    legs: { accountId: bigint; amount: bigint }[];
  },
): Promise<string> {
  const id = uuidv7();
  await tx`
    INSERT INTO ledger_transactions (id, kind, idempotency_key, beneficiary_user_id, coin_id, memo)
    VALUES (
      ${id}, ${input.kind}, ${input.idempotencyKey},
      ${input.beneficiaryUserId ?? null}, ${input.coinId ?? null},
      ${input.memo ? jsonb(tx, input.memo) : null}
    )
  `;
  for (const leg of input.legs) {
    if (leg.amount === 0n) continue;
    await tx`
      INSERT INTO ledger_entries (tx_id, account_id, amount_ufr)
      VALUES (${id}, ${leg.accountId}, ${leg.amount})
    `;
  }
  return id;
}

export async function ensureUserAccounts(tx: Tx, userId: string): Promise<{ cashId: bigint; rewardsId: bigint }> {
  await tx`
    INSERT INTO ledger_accounts (kind, user_id) VALUES ('USER_CASH', ${userId})
    ON CONFLICT (kind, user_id) WHERE user_id IS NOT NULL DO NOTHING
  `;
  await tx`
    INSERT INTO ledger_accounts (kind, user_id) VALUES ('CREATOR_REWARDS', ${userId})
    ON CONFLICT (kind, user_id) WHERE user_id IS NOT NULL DO NOTHING
  `;
  const rows = await tx<{ id: bigint; kind: string }[]>`
    SELECT id, kind FROM ledger_accounts WHERE user_id = ${userId} ORDER BY id
  `;
  const cash = rows.find((row) => row.kind === "USER_CASH");
  const rewards = rows.find((row) => row.kind === "CREATOR_REWARDS");
  if (!cash || !rewards) throw new Error("user accounts missing");
  return { cashId: bi(cash.id), rewardsId: bi(rewards.id) };
}

export async function ensureCoinReserve(tx: Tx, coinId: string): Promise<bigint> {
  await tx`
    INSERT INTO ledger_accounts (kind, coin_id) VALUES ('COIN_RESERVE', ${coinId})
    ON CONFLICT (kind, coin_id) WHERE coin_id IS NOT NULL DO NOTHING
  `;
  const [row] = await tx<{ id: bigint }[]>`
    SELECT id FROM ledger_accounts WHERE kind = 'COIN_RESERVE' AND coin_id = ${coinId}
  `;
  if (!row) throw new Error("coin reserve missing");
  return bi(row.id);
}

export async function treasuryId(tx: Tx): Promise<bigint> {
  const [row] = await tx<{ id: bigint }[]>`SELECT id FROM ledger_accounts WHERE kind = 'PLATFORM_TREASURY'`;
  if (!row) throw new Error("platform treasury missing");
  return bi(row.id);
}

export async function mintId(tx: Tx): Promise<bigint> {
  const [row] = await tx<{ id: bigint }[]>`SELECT id FROM ledger_accounts WHERE kind = 'MINT'`;
  if (!row) throw new Error("mint account missing");
  return bi(row.id);
}

export async function lockAccounts(tx: Tx, ids: bigint[]) {
  const sorted = [...new Set(ids)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const id of sorted) {
    await tx`SELECT lock_ledger_account(${id})`;
  }
}

export async function accountBalance(tx: Tx, id: bigint): Promise<bigint> {
  const [row] = await tx<{ balance_ufr: bigint }[]>`SELECT balance_ufr FROM ledger_accounts WHERE id = ${id}`;
  if (!row) throw new Error("account missing");
  return bi(row.balance_ufr);
}
