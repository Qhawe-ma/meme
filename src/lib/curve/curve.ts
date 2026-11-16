import { ECON, virtualFr, type PresetName, PRESETS } from "@/lib/config/economy";
import { ceilDiv, marketCapUfr, priceUfrPer1m } from "@/lib/money/math";

export type Phase = "curve" | "pool";

export type CurveContract = {
  x0: bigint;
  y0: bigint;
  totalSupply: bigint;
  curveSupply: bigint;
  graduationTarget: bigint;
  buyFeeBps: bigint;
  sellFeeBps: bigint;
  creatorFeeBps: bigint;
  graduationFeeBps: bigint;
  maxPositionBps: bigint;
};

export type CurveState = {
  x: bigint;
  y: bigint;
  k: bigint;
  sold: bigint;
  phase: Phase;
  x0: bigint;
};

export type QuoteFail = { ok: false; code: "MAX_POSITION" | "MIN_TRADE" | "NO_SHARES" };

export type QuoteOk = {
  ok: true;
  gross: bigint;
  net: bigint;
  fee: bigint;
  creator: bigint;
  platform: bigint;
  shares: bigint;
  payout: bigint;
  state: CurveState;
  priceUfrPer1m: bigint;
  marketCapUfr: bigint;
  reserveUfr: bigint;
  graduates: boolean;
  gradFee: bigint;
  poolSharesMinted: bigint;
};

export type Quote = QuoteOk | QuoteFail;

export function contractForPreset(preset: PresetName, overrides: Partial<CurveContract> = {}): CurveContract {
  const target = PRESETS[preset].GRADUATION_TARGET_UFR;
  return {
    x0: virtualFr(target),
    y0: ECON.VIRTUAL_SHARES,
    totalSupply: ECON.TOTAL_SUPPLY,
    curveSupply: ECON.CURVE_SUPPLY,
    graduationTarget: target,
    buyFeeBps: ECON.BUY_FEE_BPS,
    sellFeeBps: ECON.SELL_FEE_BPS,
    creatorFeeBps: ECON.CREATOR_FEE_BPS,
    graduationFeeBps: ECON.GRADUATION_FEE_BPS,
    maxPositionBps: PRESETS[preset].MAX_POSITION_BPS,
    ...overrides,
  };
}

export function freshState(contract: CurveContract): CurveState {
  return {
    x: contract.x0,
    y: contract.y0,
    k: contract.x0 * contract.y0,
    sold: 0n,
    phase: "curve",
    x0: contract.x0,
  };
}

export function reserveOf(state: CurveState): bigint {
  return state.phase === "curve" ? state.x - state.x0 : state.x;
}

export function spot(state: CurveState, contract: CurveContract) {
  return {
    priceUfrPer1m: priceUfrPer1m(state.x, state.y),
    marketCapUfr: marketCapUfr(state.x, state.y, contract.totalSupply),
    reserveUfr: reserveOf(state),
  };
}

export function splitFee(fee: bigint, feeBps: bigint, creatorBps: bigint) {
  const creator = (fee * creatorBps) / feeBps;
  return { creator, platform: fee - creator };
}

function feeOn(gross: bigint, bps: bigint): bigint {
  return ceilDiv(gross * bps, 10_000n);
}

function positionCap(contract: CurveContract): bigint {
  return (contract.totalSupply * contract.maxPositionBps) / 10_000n;
}

function finish(
  contract: CurveContract,
  state: CurveState,
  parts: Omit<QuoteOk, "ok" | "state" | "priceUfrPer1m" | "marketCapUfr" | "reserveUfr">,
): QuoteOk {
  const priced = spot(state, contract);
  return { ok: true, state, ...priced, ...parts };
}

/**
 * Buy with a gross FR amount (fees included). On the curve, a buy that would
 * pass the curve supply is clipped and graduates in the same step.
 * `enforceMin` is false for quotes used only to value a holding.
 */
export function quoteBuy(
  state: CurveState,
  contract: CurveContract,
  gross: bigint,
  holding: bigint,
  enforceMin = true,
): Quote {
  if (gross <= 0n || (enforceMin && gross < ECON.MIN_TRADE_UFR)) return { ok: false, code: "MIN_TRADE" };

  if (state.phase === "pool") {
    return quoteBuyPool(state, contract, gross, holding);
  }

  const preview = previewBuy(state, contract, gross);
  if (!preview.ok) return preview;
  const cap = positionCap(contract);
  if (holding + preview.shares > cap) return { ok: false, code: "MAX_POSITION" };

  if (state.sold + preview.shares > contract.curveSupply) {
    return quoteBuyClip(state, contract, gross, holding);
  }

  const next: CurveState = {
    ...state,
    x: preview.x,
    y: preview.y,
    sold: state.sold + preview.shares,
  };
  return finish(contract, next, {
    gross,
    net: preview.net,
    fee: preview.fee,
    creator: preview.creator,
    platform: preview.platform,
    shares: preview.shares,
    payout: 0n,
    graduates: false,
    gradFee: 0n,
    poolSharesMinted: 0n,
  });
}

function previewBuy(state: CurveState, contract: CurveContract, gross: bigint) {
  const fee = feeOn(gross, contract.buyFeeBps);
  const { creator, platform } = splitFee(fee, contract.buyFeeBps, contract.creatorFeeBps);
  const net = gross - fee;
  if (net <= 0n) return { ok: false as const, code: "MIN_TRADE" as const };
  const x = state.x + net;
  const y = ceilDiv(state.k, x);
  const shares = state.y - y;
  if (shares <= 0n) return { ok: false as const, code: "MIN_TRADE" as const };
  return { ok: true as const, fee, creator, platform, net, x, y, shares };
}

function quoteBuyPool(state: CurveState, contract: CurveContract, gross: bigint, holding: bigint): Quote {
  const preview = previewBuy(state, contract, gross);
  if (!preview.ok) return preview;
  const cap = positionCap(contract);
  if (holding + preview.shares > cap) return { ok: false, code: "MAX_POSITION" };
  const next: CurveState = { ...state, x: preview.x, y: preview.y };
  return finish(contract, next, {
    gross,
    net: preview.net,
    fee: preview.fee,
    creator: preview.creator,
    platform: preview.platform,
    shares: preview.shares,
    payout: 0n,
    graduates: false,
    gradFee: 0n,
    poolSharesMinted: 0n,
  });
}

function quoteBuyClip(state: CurveState, contract: CurveContract, gross: bigint, holding: bigint): Quote {
  const yAtGrad = contract.y0 - contract.curveSupply;
  const xNeeded = ceilDiv(state.k, yAtGrad);
  const netNeeded = xNeeded - state.x;
  if (netNeeded <= 0n) return { ok: false, code: "MIN_TRADE" };
  const grossNeeded = ceilDiv(netNeeded * 10_000n, 10_000n - contract.buyFeeBps);
  if (grossNeeded > gross) return { ok: false, code: "MIN_TRADE" };

  const fee = feeOn(grossNeeded, contract.buyFeeBps);
  const { creator, platform } = splitFee(fee, contract.buyFeeBps, contract.creatorFeeBps);
  const net = grossNeeded - fee;
  const shares = contract.curveSupply - state.sold;
  if (shares <= 0n) return { ok: false, code: "MIN_TRADE" };
  const cap = positionCap(contract);
  if (holding + shares > cap) return { ok: false, code: "MAX_POSITION" };

  const atEdge: CurveState = {
    ...state,
    x: state.x + net,
    y: state.y - shares,
    sold: contract.curveSupply,
  };
  const grad = graduate(atEdge, contract);
  return finish(contract, grad.state, {
    gross: grossNeeded,
    net,
    fee,
    creator,
    platform,
    shares,
    payout: 0n,
    graduates: true,
    gradFee: grad.gradFee,
    poolSharesMinted: grad.poolShares,
  });
}

export function graduate(state: CurveState, contract: CurveContract) {
  const reserve = state.x - state.x0;
  const gradFee = (reserve * contract.graduationFeeBps) / 10_000n;
  const poolFr = reserve - gradFee;
  const poolShares = (poolFr * state.y) / state.x;
  if (poolFr <= 0n || poolShares <= 0n) throw new Error("graduation produced an empty pool");
  return {
    gradFee,
    poolShares,
    state: {
      x: poolFr,
      y: poolShares,
      k: poolFr * poolShares,
      sold: state.sold,
      phase: "pool" as const,
      x0: state.x0,
    },
  };
}

export function quoteSell(
  state: CurveState,
  contract: CurveContract,
  shares: bigint,
  enforceMin = true,
): Quote {
  if (shares <= 0n) return { ok: false, code: "NO_SHARES" };
  if (shares > state.y) return { ok: false, code: "NO_SHARES" };

  const y = state.y + shares;
  const x = ceilDiv(state.k, y);
  const gross = state.x - x;
  if (gross <= 0n) return { ok: false, code: "MIN_TRADE" };
  const fee = feeOn(gross, contract.sellFeeBps);
  const { creator, platform } = splitFee(fee, contract.sellFeeBps, contract.creatorFeeBps);
  const payout = gross - fee;
  if (payout <= 0n || (enforceMin && gross < ECON.MIN_TRADE_UFR)) return { ok: false, code: "MIN_TRADE" };

  const next: CurveState = {
    ...state,
    x,
    y,
    sold: state.phase === "curve" ? state.sold - shares : state.sold,
  };
  if (next.sold < 0n) return { ok: false, code: "NO_SHARES" };

  return finish(contract, next, {
    gross,
    net: payout,
    fee,
    creator,
    platform,
    shares,
    payout,
    graduates: false,
    gradFee: 0n,
    poolSharesMinted: 0n,
  });
}

/** What the holder would receive for selling `shares` now, ignoring the min-trade rule. */
export function liquidationPayout(state: CurveState, contract: CurveContract, shares: bigint): bigint {
  if (shares <= 0n) return 0n;
  const quote = quoteSell(state, contract, shares, false);
  return quote.ok ? quote.payout : 0n;
}

export function progressBps(state: CurveState, contract: CurveContract): bigint {
  if (state.phase === "pool") return 10_000n;
  const reserve = reserveOf(state);
  if (contract.graduationTarget === 0n) return 0n;
  const bps = (reserve * 10_000n) / contract.graduationTarget;
  return bps > 10_000n ? 10_000n : bps;
}
