import { ECON } from "@/lib/config/economy";
import { db, jsonb, withRetry } from "@/server/db";
import { AppError } from "@/server/http";
import { accountBalance, ensureUserAccounts, lockAccounts, postLedger } from "@/server/ledger/post";

export async function claimRewards(userId: string, idempotencyKey: string) {
  const stored = await db()<{ response: { claimedUfr: string; cashUfr: string } | null }[]>`
    SELECT response FROM idempotency_keys WHERE user_id = ${userId} AND key = ${`claim:${idempotencyKey}`}
  `;
  if (stored[0]?.response) return stored[0].response;

  try {
    return await withRetry(() =>
      db().begin(async (tx) => {
        const [settings] = await tx<{ trading_frozen: boolean }[]>`SELECT trading_frozen FROM system_settings WHERE id = 1`;
        if (settings?.trading_frozen) throw new AppError("FROZEN", "The market is paused for maintenance.", 503);
        const [player] = await tx<{ flags: string[]; status: string }[]>`
          SELECT flags, status FROM profiles WHERE user_id = ${userId}
        `;
        if (!player || player.status !== "active") throw new AppError("FORBIDDEN", "This account can't claim.", 403);
        if ((player.flags ?? []).includes("sybil_suspect")) {
          throw new AppError("CLAIM_FROZEN", "Claims are paused on this account while it is under review.", 403);
        }
        const accounts = await ensureUserAccounts(tx, userId);
        await lockAccounts(tx, [accounts.rewardsId, accounts.cashId]);
        const pending = await accountBalance(tx, accounts.rewardsId);
        if (pending < ECON.MIN_CLAIM_UFR) throw new AppError("NOTHING_TO_CLAIM", "Nothing to claim yet.", 409);
        await postLedger(tx, {
          kind: "CREATOR_CLAIM",
          idempotencyKey: `claim:${userId}:${idempotencyKey}`,
          beneficiaryUserId: userId,
          legs: [
            { accountId: accounts.rewardsId, amount: -pending },
            { accountId: accounts.cashId, amount: pending },
          ],
        });
        const cash = await accountBalance(tx, accounts.cashId);
        const body = { claimedUfr: pending.toString(), cashUfr: cash.toString() };
        await tx`
          INSERT INTO idempotency_keys (user_id, key, endpoint, response)
          VALUES (${userId}, ${`claim:${idempotencyKey}`}, 'POST /api/creator-rewards/claim', ${jsonb(tx, body)})
        `;
        return body;
      }),
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      const again = await db()<{ response: { claimedUfr: string; cashUfr: string } }[]>`
        SELECT response FROM idempotency_keys WHERE user_id = ${userId} AND key = ${`claim:${idempotencyKey}`}
      `;
      if (again[0]?.response) return again[0].response;
    }
    throw error;
  }
}
