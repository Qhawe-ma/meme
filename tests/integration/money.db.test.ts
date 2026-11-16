import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { db } from "@/server/db";
import { signUp, verifyEmail } from "@/server/auth/service";
import { saveCoinImage } from "@/server/images/store";
import { launchCoin } from "@/server/coins/launch";
import { executeTrade } from "@/server/trade/execute";
import { claimRewards } from "@/server/rewards/claim";
import { readSupply, supplyGap } from "@/server/ledger/invariant";
import { ECON } from "@/lib/config/economy";

const hasDb = Boolean(process.env.DATABASE_URL);
const maybe = hasDb ? describe : describe.skip;

maybe("ledger on postgres", () => {
  it("grants once, trades, claims, and rejects illegal money moves", async () => {
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `player${stamp}@example.com`;
    const handle = `p${stamp}`.slice(0, 20);
    const ticker = `Z${stamp.slice(-5)}`.toUpperCase();
    await signUp({
      email,
      password: "password123",
      handle,
      displayName: "Tester",
      dateOfBirth: "1995-04-02",
      marketingOptIn: false,
    });
    const [mail] = await db()<{ body: string }[]>`
      SELECT body FROM email_messages WHERE to_email = ${email} ORDER BY id DESC LIMIT 1
    `;
    const token = /token=([a-f0-9]+)/.exec(mail?.body ?? "")?.[1];
    expect(token).toBeTruthy();
    const device = `device-${stamp}`;
    const ip = `10.${stamp.slice(-3)}.${stamp.slice(-6, -3) || "1"}.8`;
    const verified = await verifyEmail(token!, device, ip);
    expect(verified.grant).toBe("granted");

    const [cash] = await db()<{ balance_ufr: bigint }[]>`
      SELECT balance_ufr FROM ledger_accounts WHERE user_id = ${verified.userId} AND kind = 'USER_CASH'
    `;
    expect(cash?.balance_ufr).toBe(ECON.SIGNUP_GRANT_UFR);

    await expect(verifyEmail(token!, "device-a", "127.0.0.1")).rejects.toThrow();

    const png = await sharp({
      create: { width: 256, height: 256, channels: 3, background: { r: 214, g: 58, b: 108 } },
    })
      .png()
      .toBuffer();
    const image = await saveCoinImage(png);
    const launched = await launchCoin({
      userId: verified.userId,
      name: "Braai Coin",
      ticker,
      description: "A game coin about a Saturday braai.",
      socials: { x: "@braai_test" },
      uploadKey: image.key,
      phash: image.phash,
      initialBuyUfr: null,
      ipHash: null,
      deviceId: device,
    });
    expect(launched.contractId).toMatch(/^MMC-/);

    const buy = await executeTrade({
      userId: verified.userId,
      ticker,
      side: "buy",
      amountUfr: 10_000_000n,
      minSharesOut: 1n,
      idempotencyKey: `buy-${stamp}`,
    });
    const replay = await executeTrade({
      userId: verified.userId,
      ticker,
      side: "buy",
      amountUfr: 10_000_000n,
      minSharesOut: 1n,
      idempotencyKey: `buy-${stamp}`,
    });
    expect(replay.trade.id).toBe(buy.trade.id);

    await new Promise((resolve) => setTimeout(resolve, 3100));
    const sell = await executeTrade({
      userId: verified.userId,
      ticker,
      side: "sell",
      shares: "all",
      minPayoutUfr: 1n,
      idempotencyKey: `sell-${stamp}`,
    });
    expect(BigInt(sell.trade.payoutUfr) > 0n).toBe(true);

    const claimed = await claimRewards(verified.userId, `claim-${stamp}`);
    expect(BigInt(claimed.claimedUfr) >= ECON.MIN_CLAIM_UFR).toBe(true);
    const totals = await readSupply();
    expect(supplyGap(totals)).toBe(0n);
    expect(totals.treasury > 0n).toBe(true);

    await expect(db()`UPDATE ledger_accounts SET balance_ufr = balance_ufr + 1 WHERE kind = 'PLATFORM_TREASURY'`).rejects.toThrow();
    await expect(
      db().begin(async (tx) => {
        const id = crypto.randomUUID();
        await tx`
          INSERT INTO ledger_transactions (id, kind, idempotency_key, beneficiary_user_id)
          VALUES (${id}, 'TRADE_BUY', ${`bad-${stamp}`}, ${verified.userId})
        `;
        const [cashAccount] = await tx<{ id: bigint }[]>`
          SELECT id FROM ledger_accounts WHERE user_id = ${verified.userId} AND kind = 'USER_CASH'
        `;
        const [other] = await tx<{ id: bigint }[]>`
          SELECT id FROM ledger_accounts WHERE kind = 'PLATFORM_TREASURY'
        `;
        await tx`INSERT INTO ledger_entries (tx_id, account_id, amount_ufr) VALUES (${id}, ${cashAccount!.id}, ${-1n})`;
        await tx`INSERT INTO ledger_entries (tx_id, account_id, amount_ufr) VALUES (${id}, ${other!.id}, ${1n})`;
      }),
    ).rejects.toThrow();
  }, 30_000);
});
