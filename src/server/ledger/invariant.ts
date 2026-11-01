import { db, bi, jsonb } from "@/server/db";

export type SupplyTotals = {
  mint: bigint;
  cash: bigint;
  rewards: bigint;
  reserves: bigint;
  treasury: bigint;
};

/** -mint must equal cash + pending rewards + curve reserves + platform treasury. */
export function supplyGap(totals: SupplyTotals): bigint {
  return -totals.mint - (totals.cash + totals.rewards + totals.reserves + totals.treasury);
}

export async function readSupply(): Promise<SupplyTotals> {
  const [row] = await db()<{ mint: bigint; cash: bigint; rewards: bigint; reserves: bigint; treasury: bigint }[]>`
    SELECT
      COALESCE(SUM(balance_ufr) FILTER (WHERE kind = 'MINT'), 0) AS mint,
      COALESCE(SUM(balance_ufr) FILTER (WHERE kind = 'USER_CASH'), 0) AS cash,
      COALESCE(SUM(balance_ufr) FILTER (WHERE kind = 'CREATOR_REWARDS'), 0) AS rewards,
      COALESCE(SUM(balance_ufr) FILTER (WHERE kind = 'COIN_RESERVE'), 0) AS reserves,
      COALESCE(SUM(balance_ufr) FILTER (WHERE kind = 'PLATFORM_TREASURY'), 0) AS treasury
    FROM ledger_accounts
  `;
  if (!row) throw new Error("supply query failed");
  return {
    mint: bi(row.mint),
    cash: bi(row.cash),
    rewards: bi(row.rewards),
    reserves: bi(row.reserves),
    treasury: bi(row.treasury),
  };
}

export async function freezeForInvariant(details: Record<string, string>) {
  await db()`SELECT freeze_trading(${"ledger invariant failed"})`;
  await db()`
    INSERT INTO integrity_incidents (scope, details)
    VALUES ('global', ${jsonb(db(), details)})
  `;
  const hook = process.env.ALERT_WEBHOOK_URL;
  const text = `Meme Market froze trading. Ledger invariant failed: ${JSON.stringify(details)}`;
  console.error(`[integrity] ${text}`);
  if (hook) {
    await fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch((error) => console.error("[integrity] alert failed", error));
  }
}

export async function assertSupplyOrFreeze(): Promise<SupplyTotals> {
  const totals = await readSupply();
  const gap = supplyGap(totals);
  if (gap !== 0n) {
    await freezeForInvariant({
      gap: gap.toString(),
      mint: totals.mint.toString(),
      cash: totals.cash.toString(),
      rewards: totals.rewards.toString(),
      reserves: totals.reserves.toString(),
      treasury: totals.treasury.toString(),
    });
    throw new Error("ledger invariant failed");
  }
  return totals;
}
