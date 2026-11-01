import { ECON } from "@/lib/config/economy";
import type { ContractRecord } from "@/lib/contract/contract";
import { contractSummary } from "@/lib/contract/contract";
import { liquidationPayout, progressBps, spot, type CurveContract, type CurveState } from "@/lib/curve/curve";
import { currentSeason } from "@/lib/time/sast";
import { bi, db } from "@/server/db";
import { imagePath } from "@/server/images/store";

export type CoinCard = {
  id: string;
  ticker: string;
  name: string;
  imageUrl: string;
  priceUfrPer1m: string;
  marketCapUfr: string;
  reserveUfr: string;
  graduationTargetUfr: string;
  progressBps: string;
  holders: number;
  change1hBps: string;
  phase: string;
  status: string;
  creatorHandle: string;
};

type CoinRow = {
  id: string;
  ticker: string;
  name: string;
  image_key: string;
  description: string | null;
  status: string;
  phase: "curve" | "pool";
  x_ufr: bigint;
  y_shares: bigint;
  k: string;
  sold_shares: bigint;
  reserve_ufr: bigint;
  price_ufr_per_1m: bigint;
  holder_count: number;
  trade_count: number;
  volume_24h_ufr: bigint;
  creator_rewards_lifetime_ufr: bigint;
  live_at: Date | null;
  graduated_at: Date | null;
  contract_id: string | null;
  creator_id: string;
  handle: string;
  params: ContractRecord | string;
  pool_shares_minted: bigint | null;
};

function recordOf(value: ContractRecord | string): ContractRecord {
  return typeof value === "string" ? (JSON.parse(value) as ContractRecord) : value;
}

function curveOf(record: ContractRecord): CurveContract {
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

function stateOf(row: CoinRow, curve: CurveContract): CurveState {
  return { x: bi(row.x_ufr), y: bi(row.y_shares), k: bi(row.k), sold: bi(row.sold_shares), phase: row.phase, x0: curve.x0 };
}

const COIN_SELECT = `
  SELECT c.id, c.ticker, c.name, c.image_key, c.description, c.status, c.phase, c.x_ufr, c.y_shares, c.k::text AS k,
    c.sold_shares, c.reserve_ufr, c.price_ufr_per_1m, c.holder_count, c.trade_count, c.volume_24h_ufr,
    c.creator_rewards_lifetime_ufr, c.live_at, c.graduated_at, c.contract_id, c.creator_id, c.pool_shares_minted,
    p.handle, cc.params
  FROM coins c
  JOIN profiles p ON p.user_id = c.creator_id
  LEFT JOIN coin_contracts cc ON cc.id = c.contract_id
`;

function cardOf(row: CoinRow, change1h = 0n): CoinCard {
  const record = recordOf(row.params);
  const curve = curveOf(record);
  const state = stateOf(row, curve);
  const priced = spot(state, curve);
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    imageUrl: imagePath(row.image_key, true),
    priceUfrPer1m: priced.priceUfrPer1m.toString(),
    marketCapUfr: priced.marketCapUfr.toString(),
    reserveUfr: priced.reserveUfr.toString(),
    graduationTargetUfr: curve.graduationTarget.toString(),
    progressBps: progressBps(state, curve).toString(),
    holders: row.holder_count,
    change1hBps: change1h.toString(),
    phase: row.phase,
    status: row.status,
    creatorHandle: row.handle,
  };
}

export async function listCoins(tab: string, q: string) {
  const query = q.trim();
  const rows = await db().unsafe<CoinRow[]>(
    `${COIN_SELECT}
     WHERE c.status = 'live'
       AND ($1 = '' OR c.ticker ILIKE $2 OR c.name ILIKE $2)
       AND ($3 <> 'graduated' OR c.phase = 'pool')
       AND ($3 <> 'graduating' OR (c.phase = 'curve' AND c.reserve_ufr > 0))
     ORDER BY
       CASE WHEN $3 = 'new' THEN c.live_at END DESC NULLS LAST,
       CASE WHEN $3 = 'graduating' THEN c.reserve_ufr END DESC NULLS LAST,
       CASE WHEN $3 = 'graduated' THEN c.graduated_at END DESC NULLS LAST,
       c.trending_score DESC, c.volume_24h_ufr DESC, c.live_at DESC
     LIMIT 60`,
    [query, `%${query}%`, tab],
  );
  const cards = rows.map((row) => cardOf(row));
  const hill = cards
    .filter((coin) => coin.phase === "curve" && BigInt(coin.progressBps) >= 5000n)
    .sort((a, b) => (BigInt(a.progressBps) > BigInt(b.progressBps) ? -1 : 1))[0] ?? null;
  return { items: cards, king: hill };
}

export async function getCoin(ticker: string, userId?: string) {
  const [row] = await db().unsafe<CoinRow[]>(`${COIN_SELECT} WHERE c.ticker = $1`, [ticker.toUpperCase()]);
  if (!row || !row.params) return null;
  const record = recordOf(row.params);
  const curve = curveOf(record);
  const state = stateOf(row, curve);
  const priced = spot(state, curve);
  const links = await db()<{ kind: string; url: string }[]>`
    SELECT kind, url FROM coin_links WHERE coin_id = ${row.id} AND safety_status = 'ok'
  `;
  let myShares = 0n;
  if (userId) {
    const [holding] = await db()<{ shares: bigint }[]>`
      SELECT shares FROM holdings WHERE user_id = ${userId} AND coin_id = ${row.id}
    `;
    myShares = bi(holding?.shares ?? 0n);
  }
  const [change] = await db()<{ then_price: bigint | null }[]>`
    SELECT price_after_ufr_per_1m AS then_price FROM trades
    WHERE coin_id = ${row.id} AND created_at <= now() - interval '1 hour'
    ORDER BY seq DESC LIMIT 1
  `;
  const thenPrice = change?.then_price ? bi(change.then_price) : priced.priceUfrPer1m;
  const changeBps = thenPrice === 0n ? 0n : ((priced.priceUfrPer1m - thenPrice) * 10_000n) / thenPrice;
  return {
    card: cardOf(row, changeBps),
    description: row.description,
    imageUrl: imagePath(row.image_key, false),
    contractId: row.contract_id,
    contract: record,
    summary: contractSummary(record),
    links,
    myShares: myShares.toString(),
    rewardsLifetimeUfr: bi(row.creator_rewards_lifetime_ufr).toString(),
    creatorId: row.creator_id,
    liveAt: row.live_at?.toISOString() ?? null,
    graduatedAt: row.graduated_at?.toISOString() ?? null,
    tradeCount: row.trade_count,
    volume24hUfr: bi(row.volume_24h_ufr).toString(),
    curve,
    state,
  };
}

export async function coinCandles(ticker: string, tf: string) {
  const allowed = new Set(["1m", "5m", "15m", "1h", "1d"]);
  const interval = allowed.has(tf) ? tf : "5m";
  const rows = await db()<{
    bucket_start: Date;
    open: bigint;
    high: bigint;
    low: bigint;
    close: bigint;
    volume_ufr: bigint;
    buy_volume_ufr: bigint;
    sell_volume_ufr: bigint;
  }[]>`
    SELECT c.bucket_start, c.open, c.high, c.low, c.close, c.volume_ufr, c.buy_volume_ufr, c.sell_volume_ufr
    FROM candles c JOIN coins coin ON coin.id = c.coin_id
    WHERE coin.ticker = ${ticker.toUpperCase()} AND c.interval = ${interval}
    ORDER BY c.bucket_start DESC LIMIT 500
  `;
  return {
    tf: interval,
    candles: rows.reverse().map((row) => ({
      t: new Date(row.bucket_start).toISOString(),
      o: bi(row.open).toString(),
      h: bi(row.high).toString(),
      l: bi(row.low).toString(),
      c: bi(row.close).toString(),
      v: bi(row.volume_ufr).toString(),
      bv: bi(row.buy_volume_ufr).toString(),
      sv: bi(row.sell_volume_ufr).toString(),
    })),
  };
}

export async function coinHolders(ticker: string) {
  const coin = await getCoin(ticker);
  if (!coin) return null;
  const rows = await db()<{ handle: string; shares: bigint; user_id: string }[]>`
    SELECT p.handle, h.shares, h.user_id
    FROM holdings h JOIN profiles p ON p.user_id = h.user_id
    WHERE h.coin_id = ${coin.card.id} AND h.shares > 0
    ORDER BY h.shares DESC LIMIT 20
  `;
  const supply = coin.curve.totalSupply;
  const items = rows.map((row) => ({
    label: row.handle,
    shares: bi(row.shares).toString(),
    pctBps: ((bi(row.shares) * 10_000n) / supply).toString(),
    isCreator: row.user_id === coin.creatorId,
    isCurve: false,
  }));
  if (coin.state.phase === "curve") {
    const unsold = coin.curve.curveSupply - coin.state.sold;
    items.push({
      label: "Bonding curve",
      shares: (unsold < 0n ? 0n : unsold).toString(),
      pctBps: (((unsold < 0n ? 0n : unsold) * 10_000n) / supply).toString(),
      isCreator: false,
      isCurve: true,
    });
  } else {
    items.push({
      label: "Pool",
      shares: coin.state.y.toString(),
      pctBps: ((coin.state.y * 10_000n) / supply).toString(),
      isCreator: false,
      isCurve: true,
    });
  }
  return { holderCount: coin.card.holders, items };
}

export async function coinTrades(ticker: string, before?: string) {
  const rows = await db()<{
    seq: bigint;
    side: string;
    handle: string;
    gross_ufr: bigint;
    shares: bigint;
    price_after_ufr_per_1m: bigint;
    created_at: Date;
  }[]>`
    SELECT t.seq, t.side, p.handle, t.gross_ufr, t.shares, t.price_after_ufr_per_1m, t.created_at
    FROM trades t
    JOIN coins c ON c.id = t.coin_id
    JOIN profiles p ON p.user_id = t.user_id
    WHERE c.ticker = ${ticker.toUpperCase()}
      AND (${before ?? null}::bigint IS NULL OR t.seq < ${before ?? null}::bigint)
    ORDER BY t.seq DESC
    LIMIT 50
  `;
  return {
    items: rows.map((row) => ({
      seq: bi(row.seq).toString(),
      side: row.side,
      handle: row.handle,
      frUfr: bi(row.gross_ufr).toString(),
      shares: bi(row.shares).toString(),
      priceUfrPer1m: bi(row.price_after_ufr_per_1m).toString(),
      at: new Date(row.created_at).toISOString(),
    })),
  };
}

async function ensureSeason() {
  const season = currentSeason();
  await db()`
    INSERT INTO seasons (season_key, starts_at, ends_at)
    VALUES (${season.key}, ${season.startsAt}, ${season.endsAt})
    ON CONFLICT (season_key) DO NOTHING
  `;
  const [row] = await db()<{ id: number }[]>`SELECT id FROM seasons WHERE season_key = ${season.key}`;
  return { ...season, id: row?.id ?? 0 };
}

export async function portfolioFor(userId: string) {
  const season = await ensureSeason();
  const [cash] = await db()<{ cash: bigint; rewards: bigint }[]>`
    SELECT
      COALESCE((SELECT balance_ufr FROM ledger_accounts WHERE user_id = ${userId} AND kind = 'USER_CASH'), 0) AS cash,
      COALESCE((SELECT balance_ufr FROM ledger_accounts WHERE user_id = ${userId} AND kind = 'CREATOR_REWARDS'), 0) AS rewards
  `;
  const rows = await db().unsafe<(CoinRow & { shares: bigint })[]>(
    `${COIN_SELECT.replace("SELECT c.id", "SELECT h.shares, c.id").replace("FROM coins c", "FROM holdings h JOIN coins c ON c.id = h.coin_id")} WHERE h.user_id = $1 AND h.shares > 0`,
    [userId],
  );
  let liquid = 0n;
  const holdingDtos = rows.map((row) => {
    const curve = curveOf(recordOf(row.params));
    const state = stateOf(row, curve);
    const shares = bi(row.shares);
    const payout = liquidationPayout(state, curve, shares);
    liquid += payout;
    return {
      ticker: row.ticker,
      name: row.name,
      imageUrl: imagePath(row.image_key, true),
      shares: shares.toString(),
      sellValueUfr: payout.toString(),
      priceUfrPer1m: spot(state, curve).priceUfrPer1m.toString(),
    };
  });
  const created = await db().unsafe<CoinRow[]>(`${COIN_SELECT} WHERE c.creator_id = $1 ORDER BY c.live_at DESC`, [userId]);
  const history = await db()<{
    side: string;
    ticker: string;
    gross_ufr: bigint;
    shares: bigint;
    created_at: Date;
  }[]>`
    SELECT t.side, c.ticker, t.gross_ufr, t.shares, t.created_at
    FROM trades t JOIN coins c ON c.id = t.coin_id
    WHERE t.user_id = ${userId}
    ORDER BY t.created_at DESC LIMIT 30
  `;
  const cashUfr = bi(cash?.cash ?? 0n);
  const rewardsUfr = bi(cash?.rewards ?? 0n);
  const netWorth = cashUfr + rewardsUfr + liquid;
  const [baseline] = await db()<{ net_worth_ufr: bigint }[]>`
    SELECT net_worth_ufr FROM season_baselines WHERE season_id = ${season.id} AND user_id = ${userId}
  `;
  if (!baseline) {
    await db()`
      INSERT INTO season_baselines (season_id, user_id, net_worth_ufr)
      VALUES (${season.id}, ${userId}, 0)
      ON CONFLICT DO NOTHING
    `;
  }
  const [grant] = await db()<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM grant_claims
    WHERE user_id = ${userId} AND created_at >= ${season.startsAt} AND created_at < ${season.endsAt}
  `;
  const minted = (grant?.n ?? 0) > 0 ? ECON.SIGNUP_GRANT_UFR : 0n;
  const base = bi(baseline?.net_worth_ufr ?? 0n);
  const [trades] = await db()<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM trades WHERE user_id = ${userId} AND created_at >= ${season.startsAt}
  `;
  return {
    cashUfr: cashUfr.toString(),
    rewardsPendingUfr: rewardsUfr.toString(),
    netWorthUfr: netWorth.toString(),
    seasonScoreUfr: (netWorth - base - minted).toString(),
    seasonTrades: trades?.n ?? 0,
    holdings: holdingDtos,
    createdCoins: created.map((row) => ({
      ticker: row.ticker,
      name: row.name,
      imageUrl: imagePath(row.image_key, true),
      rewardsUfr: bi(row.creator_rewards_lifetime_ufr).toString(),
      status: row.status,
    })),
    history: history.map((row) => ({
      side: row.side,
      ticker: row.ticker,
      grossUfr: bi(row.gross_ufr).toString(),
      shares: bi(row.shares).toString(),
      at: new Date(row.created_at).toISOString(),
    })),
  };
}

export async function leaderboard(viewerId?: string) {
  const season = await ensureSeason();
  const people = await db()<{
    user_id: string;
    handle: string;
    flags: string[];
    cash: bigint;
    rewards: bigint;
    trades: number;
  }[]>`
    SELECT p.user_id, p.handle, p.flags,
      COALESCE((SELECT balance_ufr FROM ledger_accounts a WHERE a.user_id = p.user_id AND a.kind = 'USER_CASH'), 0) AS cash,
      COALESCE((SELECT balance_ufr FROM ledger_accounts a WHERE a.user_id = p.user_id AND a.kind = 'CREATOR_REWARDS'), 0) AS rewards,
      (SELECT COUNT(*)::int FROM trades t WHERE t.user_id = p.user_id AND t.created_at >= ${season.startsAt}) AS trades
    FROM profiles p
    WHERE p.status = 'active' AND EXISTS (SELECT 1 FROM grant_claims g WHERE g.user_id = p.user_id)
  `;
  const entries = [];
  for (const person of people) {
    if ((person.flags ?? []).includes("sybil_suspect")) continue;
    const rows = await db().unsafe<(CoinRow & { shares: bigint })[]>(
      `${COIN_SELECT.replace("SELECT c.id", "SELECT h.shares, c.id").replace("FROM coins c", "FROM holdings h JOIN coins c ON c.id = h.coin_id")} WHERE h.user_id = $1 AND h.shares > 0`,
      [person.user_id],
    );
    let liquid = 0n;
    for (const row of rows) {
      if (!row.params) continue;
      liquid += liquidationPayout(stateOf(row, curveOf(recordOf(row.params))), curveOf(recordOf(row.params)), bi(row.shares));
    }
    const net = bi(person.cash) + bi(person.rewards) + liquid;
    const [baseline] = await db()<{ net_worth_ufr: bigint }[]>`
      SELECT net_worth_ufr FROM season_baselines WHERE season_id = ${season.id} AND user_id = ${person.user_id}
    `;
    const [grant] = await db()<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM grant_claims
      WHERE user_id = ${person.user_id} AND created_at >= ${season.startsAt}
    `;
    const minted = (grant?.n ?? 0) > 0 ? ECON.SIGNUP_GRANT_UFR : 0n;
    const score = net - bi(baseline?.net_worth_ufr ?? 0n) - minted;
    entries.push({ handle: person.handle, userId: person.user_id, score, trades: person.trades, net });
  }
  const ranked = entries
    .filter((entry) => entry.trades >= ECON.SEASON_MIN_TRADES_TO_RANK)
    .sort((a, b) => (a.score > b.score ? -1 : 1))
    .slice(0, 50)
    .map((entry, index) => ({
      rank: index + 1,
      handle: entry.handle,
      scoreUfr: entry.score.toString(),
      trades: entry.trades,
    }));
  const me = viewerId ? entries.find((entry) => entry.userId === viewerId) : undefined;
  const graduated = await db()<{ ticker: string; name: string; handle: string }[]>`
    SELECT c.ticker, c.name, p.handle FROM coins c JOIN profiles p ON p.user_id = c.creator_id
    WHERE c.phase = 'pool' AND c.status = 'live' ORDER BY c.graduated_at DESC LIMIT 20
  `;
  return {
    season: { startsAt: season.startsAt.toISOString(), endsAt: season.endsAt.toISOString(), key: season.key },
    minTrades: ECON.SEASON_MIN_TRADES_TO_RANK,
    traders: ranked,
    graduated,
    me: me
      ? { handle: me.handle, scoreUfr: me.score.toString(), trades: me.trades, ranked: me.trades >= ECON.SEASON_MIN_TRADES_TO_RANK }
      : null,
  };
}

export async function adminOverview() {
  const [users] = await db()<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM profiles WHERE status <> 'deleted'`;
  const [trades] = await db()<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM trades`;
  const [coins] = await db()<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM coins WHERE status = 'live'`;
  const [settings] = await db()<{ trading_frozen: boolean; economy_preset: string; frozen_reason: string | null }[]>`
    SELECT trading_frozen, economy_preset, frozen_reason FROM system_settings WHERE id = 1
  `;
  const [supply] = await db()<{
    mint: bigint;
    cash: bigint;
    rewards: bigint;
    reserves: bigint;
    treasury: bigint;
  }[]>`
    SELECT
      COALESCE(SUM(balance_ufr) FILTER (WHERE kind = 'MINT'), 0) AS mint,
      COALESCE(SUM(balance_ufr) FILTER (WHERE kind = 'USER_CASH'), 0) AS cash,
      COALESCE(SUM(balance_ufr) FILTER (WHERE kind = 'CREATOR_REWARDS'), 0) AS rewards,
      COALESCE(SUM(balance_ufr) FILTER (WHERE kind = 'COIN_RESERVE'), 0) AS reserves,
      COALESCE(SUM(balance_ufr) FILTER (WHERE kind = 'PLATFORM_TREASURY'), 0) AS treasury
    FROM ledger_accounts
  `;
  const reports = await db()<{
    id: string;
    ticker: string;
    reason: string;
    details: string | null;
    handle: string;
    created_at: Date;
  }[]>`
    SELECT r.id, c.ticker, r.reason, r.details, p.handle, r.created_at
    FROM reports r
    JOIN coins c ON c.id = r.coin_id
    JOIN profiles p ON p.user_id = r.reporter_id
    WHERE r.status = 'open'
    ORDER BY r.created_at DESC LIMIT 50
  `;
  const minted = supply ? -bi(supply.mint) : 0n;
  const treasury = supply ? bi(supply.treasury) : 0n;
  const cash = supply ? bi(supply.cash) : 0n;
  const rewards = supply ? bi(supply.rewards) : 0n;
  const reserves = supply ? bi(supply.reserves) : 0n;
  return {
    users: users?.n ?? 0,
    trades: trades?.n ?? 0,
    coins: coins?.n ?? 0,
    frozen: settings?.trading_frozen ?? false,
    frozenReason: settings?.frozen_reason ?? null,
    preset: settings?.economy_preset ?? "default",
    mintedUfr: minted.toString(),
    treasuryUfr: treasury.toString(),
    cashUfr: cash.toString(),
    rewardsUfr: rewards.toString(),
    reservesUfr: reserves.toString(),
    balanced: minted === cash + rewards + reserves + treasury,
    reports: reports.map((row) => ({
      id: row.id,
      ticker: row.ticker,
      reason: row.reason,
      details: row.details,
      handle: row.handle,
      at: new Date(row.created_at).toISOString(),
    })),
  };
}

export async function publicProfile(handle: string) {
  const [profile] = await db()<{ user_id: string; handle: string; display_name: string; created_at: Date }[]>`
    SELECT user_id, handle, display_name, created_at FROM profiles
    WHERE handle = ${handle} AND status = 'active'
  `;
  if (!profile) return null;
  const coins = await db()<{ ticker: string; name: string; image_key: string }[]>`
    SELECT ticker, name, image_key FROM coins WHERE creator_id = ${profile.user_id} AND status = 'live' ORDER BY live_at DESC
  `;
  return {
    handle: profile.handle,
    displayName: profile.display_name,
    joinedAt: profile.created_at.toISOString(),
    coins: coins.map((coin) => ({ ...coin, imageUrl: imagePath(coin.image_key, true) })),
  };
}
