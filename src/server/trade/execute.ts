import { ECON } from "@/lib/config/economy";
import type { ContractRecord } from "@/lib/contract/contract";
import { hashContract } from "@/lib/contract/contract";
import { freshState, progressBps, quoteBuy, quoteSell, reserveOf, spot, type CurveContract, type CurveState, type QuoteOk } from "@/lib/curve/curve";
import { bi, db, jsonb, withRetry, type Tx } from "@/server/db";
import { AppError } from "@/server/http";
import { uuidv7 } from "@/server/ids";
import { accountBalance, ensureCoinReserve, ensureUserAccounts, lockAccounts, postLedger, treasuryId } from "@/server/ledger/post";
import { applyTradeToCandles } from "@/server/market/candles";
import { publish } from "@/server/realtime/bus";

export type TradeInput = {
  userId: string;
  ticker: string;
  side: "buy" | "sell";
  amountUfr?: bigint;
  shares?: bigint | "all";
  minSharesOut?: bigint;
  minPayoutUfr?: bigint;
  idempotencyKey: string;
  ipHash?: string | null;
  deviceId?: string | null;
};

export type TradeJson = {
  trade: {
    id: string;
    seq: string;
    side: "buy" | "sell";
    shares: string;
    grossUfr: string;
    feeUfr: string;
    creatorUfr: string;
    platformUfr: string;
    payoutUfr: string;
    priceUfrPer1m: string;
  };
  balances: { cashUfr: string; holdingShares: string };
  coin: {
    ticker: string;
    priceUfrPer1m: string;
    marketCapUfr: string;
    reserveUfr: string;
    progressBps: string;
    phase: string;
    status: string;
  };
};

const recent = new Map<string, number>();

function curveFrom(record: ContractRecord): CurveContract {
  return {
    x0: BigInt(record.virtual_fr_ufr),
    y0: BigInt(record.virtual_shares),
    totalSupply: BigInt(record.total_supply),
    curveSupply: BigInt(record.curve_supply),
    graduationTarget: BigInt(record.graduation_target_ufr),
    buyFeeBps: BigInt(record.buy_fee_bps),
    sellFeeBps: BigInt(record.sell_fee_bps),
    creatorFeeBps: BigInt(record.creator_fee_bps),
    graduationFeeBps: BigInt(record.graduation_fee_bps),
    maxPositionBps: BigInt(record.max_position_bps),
  };
}

function stateFrom(row: { x_ufr: bigint; y_shares: bigint; k: string; sold_shares: bigint; phase: "curve" | "pool" }, x0: bigint): CurveState {
  return { x: bi(row.x_ufr), y: bi(row.y_shares), k: bi(row.k), sold: bi(row.sold_shares), phase: row.phase, x0 };
}

async function readStored(userId: string, key: string): Promise<TradeJson | null> {
  const [row] = await db()<{ response: TradeJson | null }[]>`
    SELECT response FROM idempotency_keys WHERE user_id = ${userId} AND key = ${key}
  `;
  return row?.response ?? null;
}

export async function executeTrade(input: TradeInput, existing?: Tx): Promise<TradeJson> {
  if (!existing) {
    const stored = await readStored(input.userId, input.idempotencyKey);
    if (stored) return stored;
  }
  const run = (tx: Tx) => runTrade(tx, input);
  try {
    const result = existing ? await run(existing) : await withRetry(() => db().begin(run));
    if (!existing) {
      publish(`coin:${result.coin.ticker}`, { type: "trade", ticker: result.coin.ticker, side: result.trade.side, priceUfrPer1m: result.trade.priceUfrPer1m });
      publish("feed", { type: "trade", ticker: result.coin.ticker });
    }
    return result;
  } catch (error) {
    if (error instanceof AppError && error.code === "CONTRACT_MISMATCH" && !existing) {
      await db()`UPDATE coins SET status = 'frozen' WHERE ticker = ${input.ticker.toUpperCase()}`;
      await db()`
        INSERT INTO integrity_incidents (scope, details)
        VALUES ('coin', ${jsonb(db(), { ticker: input.ticker, reason: "contract hash mismatch" })})
      `;
      throw new AppError("COIN_NOT_TRADABLE", "This coin is paused because its contract does not match.", 403);
    }
    if ((error as { code?: string }).code === "23505" && !existing) {
      for (let i = 0; i < 8; i += 1) {
        const stored = await readStored(input.userId, input.idempotencyKey);
        if (stored) return stored;
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    }
    throw error;
  }
}

async function runTrade(tx: Tx, input: TradeInput): Promise<TradeJson> {
  const [settings] = await tx<{ trading_frozen: boolean }[]>`SELECT trading_frozen FROM system_settings WHERE id = 1`;
  if (settings?.trading_frozen) throw new AppError("FROZEN", "The market is paused for maintenance.", 503);

  const [player] = await tx<{
    email_verified_at: Date | null;
    status: string;
    age_ok: boolean;
    granted: boolean;
  }[]>`
    SELECT u.email_verified_at, p.status, p.age_ok,
      EXISTS (SELECT 1 FROM grant_claims g WHERE g.user_id = u.id) AS granted
    FROM "user" u JOIN profiles p ON p.user_id = u.id
    WHERE u.id = ${input.userId}
  `;
  if (!player?.email_verified_at) throw new AppError("EMAIL_UNVERIFIED", "Verify your email first.", 403);
  if (!player.age_ok) throw new AppError("AGE_GATE", "You need to be 18 or older.", 403);
  if (player.status !== "active") throw new AppError("FORBIDDEN", "This account can't trade.", 403);
  if (!player.granted) throw new AppError("GRANT_HELD", "Your starting grant is not available yet.", 403);

  const [coin] = await tx<{
    id: string;
    ticker: string;
    creator_id: string;
    contract_id: string | null;
    status: string;
    phase: "curve" | "pool";
    x_ufr: bigint;
    y_shares: bigint;
    k: string;
    sold_shares: bigint;
    reserve_ufr: bigint;
    pool_shares_minted: bigint | null;
    live_at: Date | null;
  }[]>`
    SELECT id, ticker, creator_id, contract_id, status, phase, x_ufr, y_shares, k::text AS k,
      sold_shares, reserve_ufr, pool_shares_minted, live_at
    FROM coins WHERE ticker = ${input.ticker.toUpperCase()} FOR UPDATE
  `;
  if (!coin?.contract_id) throw new AppError("COIN_NOT_TRADABLE", "That coin is not live.", 404);
  if (coin.status === "hidden" && input.side !== "sell") {
    throw new AppError("COIN_NOT_TRADABLE", "This coin is hidden. Holders can still sell.", 403);
  }
  if (coin.status !== "live" && coin.status !== "hidden") {
    throw new AppError("COIN_NOT_TRADABLE", "That coin is not open for trading.", 403);
  }

  const [contractRow] = await tx<{ params: ContractRecord; params_hash: string }[]>`
    SELECT params, params_hash FROM coin_contracts WHERE id = ${coin.contract_id}
  `;
  if (!contractRow) throw new AppError("COIN_NOT_TRADABLE", "This coin has no contract.", 500);
  const params = typeof contractRow.params === "string" ? (JSON.parse(contractRow.params) as ContractRecord) : contractRow.params;
  if (hashContract(params) !== contractRow.params_hash) {
    throw new AppError("CONTRACT_MISMATCH", "Contract hash mismatch.", 403);
  }

  const record = params;
  const curve = curveFrom(record);
  const trader = await ensureUserAccounts(tx, input.userId);
  const creator = await ensureUserAccounts(tx, coin.creator_id);
  const reserveAccount = await ensureCoinReserve(tx, coin.id);
  const treasury = await treasuryId(tx);
  await lockAccounts(tx, [trader.cashId, creator.rewardsId, reserveAccount, treasury]);
  await tx`
    INSERT INTO holdings (user_id, coin_id, shares, cost_basis_ufr)
    VALUES (${input.userId}, ${coin.id}, 0, 0)
    ON CONFLICT (user_id, coin_id) DO NOTHING
  `;
  const [holdingRow] = await tx<{ shares: bigint }[]>`
    SELECT shares FROM holdings WHERE user_id = ${input.userId} AND coin_id = ${coin.id} FOR UPDATE
  `;
  const holding = bi(holdingRow?.shares ?? 0n);
  const state = stateFrom(coin, curve.x0);
  const priceBefore = spot(state, curve).priceUfrPer1m;

  const coolKey = `${input.userId}:${coin.id}`;
  if (process.env.RATE_LIMIT_DISABLED !== "1") {
    const prev = recent.get(coolKey) ?? 0;
    const waitMs = ECON.SAME_COIN_COOLDOWN_SECONDS * 1000 - (Date.now() - prev);
    if (waitMs > 0) throw new AppError("RATE_LIMITED", "Give this coin a few seconds between trades.", 429);
  }

  let quote: QuoteOk;
  if (input.side === "buy") {
    const gross = input.amountUfr ?? 0n;
    if (gross < ECON.MIN_TRADE_UFR) throw new AppError("MIN_TRADE", "The smallest buy is FR0.10.");
    const liveAt = coin.live_at ? new Date(coin.live_at).getTime() : Date.now();
    const protectUntil = liveAt + Number(record.launch_protection_seconds) * 1000;
    if (input.userId !== coin.creator_id && Date.now() < protectUntil && gross > BigInt(record.launch_protection_max_buy_ufr)) {
      throw new AppError("LAUNCH_PROTECTION", "Buys are capped for the first minute after launch.", 400);
    }
    const cash = await accountBalance(tx, trader.cashId);
    if (cash < gross) throw new AppError("INSUFFICIENT_FR", "Not enough FR for that buy.", 400);
    const next = quoteBuy(state, curve, gross, holding);
    if (!next.ok) {
      throw new AppError(next.code === "MAX_POSITION" ? "MAX_POSITION" : "MIN_TRADE", next.code === "MAX_POSITION" ? "That would put you over the max holding for this coin." : "That buy is too small to move the curve.");
    }
    if (next.shares < (input.minSharesOut ?? 0n)) throw new AppError("SLIPPAGE", "The price moved. Check the quote and try again.");
    quote = next;
  } else {
    const shares = input.shares === "all" ? holding : (input.shares ?? 0n);
    if (shares <= 0n || shares > holding) throw new AppError("INSUFFICIENT_SHARES", "You don't hold that many shares.", 400);
    const next = quoteSell(state, curve, shares);
    if (!next.ok) throw new AppError(next.code === "NO_SHARES" ? "INSUFFICIENT_SHARES" : "MIN_TRADE", "That sell is too small.");
    if (next.payout < (input.minPayoutUfr ?? 0n)) throw new AppError("SLIPPAGE", "The price moved. Check the quote and try again.");
    quote = next;
  }

  const ledgerKind = input.side === "buy" ? "TRADE_BUY" : "TRADE_SELL";
  const legs =
    input.side === "buy"
      ? [
          { accountId: trader.cashId, amount: -quote.gross },
          { accountId: reserveAccount, amount: quote.net },
          { accountId: creator.rewardsId, amount: quote.creator },
          { accountId: treasury, amount: quote.platform },
        ]
      : [
          { accountId: reserveAccount, amount: -quote.gross },
          { accountId: trader.cashId, amount: quote.payout },
          { accountId: creator.rewardsId, amount: quote.creator },
          { accountId: treasury, amount: quote.platform },
        ];
  const ledgerTxId = await postLedger(tx, {
    kind: ledgerKind,
    idempotencyKey: `trade:${input.userId}:${input.idempotencyKey}`,
    beneficiaryUserId: input.userId,
    coinId: coin.id,
    legs,
  });

  if (quote.graduates && quote.gradFee > 0n) {
    await postLedger(tx, {
      kind: "GRADUATION",
      idempotencyKey: `grad:${coin.id}`,
      coinId: coin.id,
      legs: [
        { accountId: reserveAccount, amount: -quote.gradFee },
        { accountId: treasury, amount: quote.gradFee },
      ],
    });
  }

  const nextShares = input.side === "buy" ? holding + quote.shares : holding - quote.shares;
  const [costRow] = await tx<{ cost_basis_ufr: bigint }[]>`
    SELECT cost_basis_ufr FROM holdings WHERE user_id = ${input.userId} AND coin_id = ${coin.id}
  `;
  const prevCost = bi(costRow?.cost_basis_ufr ?? 0n);
  const nextCost = input.side === "buy" ? prevCost + quote.gross : holding === 0n ? 0n : (prevCost * nextShares) / holding;
  await tx`
    UPDATE holdings SET shares = ${nextShares}, cost_basis_ufr = ${nextCost}
    WHERE user_id = ${input.userId} AND coin_id = ${coin.id}
  `;

  const next = quote.state;
  const priced = spot(next, curve);
  const poolMinted = quote.graduates ? quote.poolSharesMinted : bi(coin.pool_shares_minted ?? 0n);
  await tx`
    UPDATE coins SET
      phase = ${next.phase},
      x_ufr = ${next.x},
      y_shares = ${next.y},
      k = ${next.k.toString()}::numeric,
      sold_shares = ${next.sold},
      reserve_ufr = ${reserveOf(next)},
      pool_shares_minted = ${poolMinted === 0n ? null : poolMinted},
      price_ufr_per_1m = ${priced.priceUfrPer1m},
      creator_rewards_lifetime_ufr = creator_rewards_lifetime_ufr + ${quote.creator},
      trade_count = trade_count + 1,
      graduated_at = CASE WHEN ${quote.graduates} THEN now() ELSE graduated_at END,
      status = status
    WHERE id = ${coin.id}
  `;

  const tradeId = uuidv7();
  const [trade] = await tx<{ seq: bigint }[]>`
    INSERT INTO trades (
      id, user_id, coin_id, contract_id, side, phase, gross_ufr, fee_ufr, fee_creator_ufr, fee_platform_ufr,
      shares, price_before_ufr_per_1m, price_after_ufr_per_1m, ledger_tx_id, idempotency_key, ip_hash, device_id
    ) VALUES (
      ${tradeId}, ${input.userId}, ${coin.id}, ${coin.contract_id}, ${input.side}, ${coin.phase},
      ${quote.gross}, ${quote.fee}, ${quote.creator}, ${quote.platform}, ${quote.shares},
      ${priceBefore}, ${priced.priceUfrPer1m}, ${ledgerTxId}, ${input.idempotencyKey},
      ${input.ipHash ?? null}, ${input.deviceId ?? null}
    )
    RETURNING seq
  `;
  if (!trade) throw new Error("trade insert failed");

  await applyTradeToCandles(tx, {
    coinId: coin.id,
    at: new Date(),
    seq: bi(trade.seq),
    side: input.side,
    gross: quote.gross,
    priceBefore,
    priceAfter: priced.priceUfrPer1m,
  });

  const reserveBalance = await accountBalance(tx, reserveAccount);
  if (reserveBalance !== reserveOf(next)) throw new Error("coin reserve does not match the curve");
  const [held] = await tx<{ shares: bigint }[]>`
    SELECT COALESCE(SUM(shares), 0) AS shares FROM holdings WHERE coin_id = ${coin.id}
  `;
  const expectedHeld = next.phase === "curve" ? next.sold : curve.curveSupply + (poolMinted || 0n) - next.y;
  if (bi(held?.shares ?? 0n) !== expectedHeld) throw new Error("holdings do not match shares sold");

  await tx`
    UPDATE coins SET
      holder_count = (SELECT COUNT(*)::int FROM holdings WHERE coin_id = ${coin.id} AND shares > 0),
      volume_24h_ufr = (
        SELECT COALESCE(SUM(gross_ufr), 0) FROM trades
        WHERE coin_id = ${coin.id} AND created_at > now() - interval '24 hours'
      ),
      trending_score = (
        SELECT COALESCE(SUM(gross_ufr), 0)::float8 / 1000000
        FROM trades WHERE coin_id = ${coin.id} AND created_at > now() - interval '1 hour'
      )
    WHERE id = ${coin.id}
  `;

  const cashAfter = await accountBalance(tx, trader.cashId);
  const body: TradeJson = {
    trade: {
      id: tradeId,
      seq: bi(trade.seq).toString(),
      side: input.side,
      shares: quote.shares.toString(),
      grossUfr: quote.gross.toString(),
      feeUfr: quote.fee.toString(),
      creatorUfr: quote.creator.toString(),
      platformUfr: quote.platform.toString(),
      payoutUfr: quote.payout.toString(),
      priceUfrPer1m: priced.priceUfrPer1m.toString(),
    },
    balances: { cashUfr: cashAfter.toString(), holdingShares: nextShares.toString() },
    coin: {
      ticker: coin.ticker,
      priceUfrPer1m: priced.priceUfrPer1m.toString(),
      marketCapUfr: priced.marketCapUfr.toString(),
      reserveUfr: reserveOf(next).toString(),
      progressBps: progressBps(next, curve).toString(),
      phase: next.phase,
      status: coin.status,
    },
  };
  await tx`
    INSERT INTO outbox (topic, payload) VALUES (${`coin:${coin.id}`}, ${jsonb(tx, { type: "trade", ...body.trade, ticker: coin.ticker })})
  `;
  await tx`
    INSERT INTO idempotency_keys (user_id, key, endpoint, response)
    VALUES (${input.userId}, ${input.idempotencyKey}, 'POST /api/trades', ${jsonb(tx, body)})
  `;
  recent.set(coolKey, Date.now());
  return body;
}

export function quoteCoin(record: ContractRecord, row: { x_ufr: bigint; y_shares: bigint; k: string; sold_shares: bigint; phase: "curve" | "pool" }, holding: bigint, side: "buy" | "sell", amount: bigint) {
  const curve = curveFrom(record);
  const state = stateFrom(row, curve.x0);
  const quote = side === "buy" ? quoteBuy(state, curve, amount, holding, false) : quoteSell(state, curve, amount, false);
  return { curve, state, quote, spot: spot(state, curve) };
}

export { freshState };
