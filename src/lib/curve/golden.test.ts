import { describe, expect, it } from "vitest";
import { formatFR } from "@/lib/money/format";
import { UFR } from "@/lib/config/economy";
import {
  contractForPreset,
  freshState,
  quoteBuy,
  quoteSell,
  type CurveState,
  type QuoteOk,
} from "./curve";

function fr(whole: bigint, micros = 0n): bigint {
  return whole * UFR + micros;
}

function mustBuy(state: CurveState, gross: bigint, holding: bigint, preset: "default" | "beta") {
  const quote = quoteBuy(state, contractForPreset(preset), gross, holding);
  expect(quote.ok, !quote.ok ? quote.code : "").toBe(true);
  return quote as QuoteOk;
}

function mustSell(state: CurveState, shares: bigint, preset: "default" | "beta") {
  const quote = quoteSell(state, contractForPreset(preset), shares);
  expect(quote.ok, !quote.ok ? quote.code : "").toBe(true);
  return quote as QuoteOk;
}

describe("golden table A (default, FR100,000)", () => {
  const preset = "default" as const;

  it("replays the worked example exactly", () => {
    const open = freshState(contractForPreset(preset));
    expect(formatFR((open.x * 1_000_000n) / open.y, { decimals: 4 })).toBe("FR25.0000");

    const b1 = mustBuy(open, fr(50n), 0n, preset);
    expect(b1.shares).toBe(1_971_107n);
    expect(b1.fee).toBe(625_000n);
    expect(b1.creator).toBe(125_000n);
    expect(b1.platform).toBe(500_000n);
    expect(formatFR(b1.priceUfrPer1m, { decimals: 4 })).toBe("FR25.0988");
    expect(b1.reserveUfr).toBe(49_375_000n);

    const b2 = mustBuy(b1.state, fr(200n), 0n, preset);
    expect(b2.shares).toBe(7_807_330n);
    expect(b2.fee).toBe(2_500_000n);
    expect(b2.creator).toBe(500_000n);
    expect(b2.platform).toBe(2_000_000n);
    expect(formatFR(b2.priceUfrPer1m, { decimals: 4 })).toBe("FR25.4962");
    expect(b2.reserveUfr).toBe(246_875_000n);

    const b3 = mustBuy(b2.state, fr(150n), 0n, preset);
    expect(b3.shares).toBe(5_775_805n);
    expect(b3.fee).toBe(1_875_000n);
    expect(b3.creator).toBe(375_000n);
    expect(b3.platform).toBe(1_500_000n);
    expect(formatFR(b3.priceUfrPer1m, { decimals: 4 })).toBe("FR25.7962");
    expect(b3.reserveUfr).toBe(395_000_000n);

    const s1 = mustSell(b3.state, b1.shares, preset);
    expect(s1.payout).toBe(50_111_250n);
    expect(s1.fee).toBe(634_320n);
    expect(s1.creator).toBe(126_864n);
    expect(s1.platform).toBe(507_456n);
    expect(formatFR(s1.priceUfrPer1m, { decimals: 4 })).toBe("FR25.6932");
    expect(s1.reserveUfr).toBe(344_254_430n);

    const s2 = mustSell(s1.state, b2.shares, preset);
    expect(s2.payout).toBe(196_532_705n);
    expect(s2.fee).toBe(2_487_756n);
    expect(s2.creator).toBe(497_551n);
    expect(s2.platform).toBe(1_990_205n);
    expect(formatFR(s2.priceUfrPer1m, { decimals: 4 })).toBe("FR25.2913");
    expect(s2.reserveUfr).toBe(145_233_969n);

    const s3 = mustSell(s2.state, b3.shares, preset);
    expect(s3.payout).toBe(143_418_544n);
    expect(s3.fee).toBe(1_815_425n);
    expect(s3.creator).toBe(363_085n);
    expect(s3.platform).toBe(1_452_340n);
    expect(formatFR(s3.priceUfrPer1m, { decimals: 4 })).toBe("FR25.0000");
    expect(s3.reserveUfr).toBe(0n);
    expect(s3.state.sold).toBe(0n);

    const rows = [b1, b2, b3, s1, s2, s3];
    const creatorRewards = rows.reduce((sum, row) => sum + row.creator, 0n);
    const fees = rows.reduce((sum, row) => sum + row.fee, 0n);
    expect(creatorRewards).toBe(1_987_500n);
    expect(rows.reduce((sum, row) => sum + row.platform, 0n)).toBe(fees - creatorRewards);
    expect(formatFR(fees - creatorRewards)).toBe("FR7.95");
  });
});

describe("golden table B (beta, FR2,000)", () => {
  const preset = "beta" as const;

  it("replays the worked example and rejects the position cap", () => {
    const open = freshState(contractForPreset(preset));
    expect(formatFR((open.x * 1_000_000n) / open.y, { decimals: 4 })).toBe("FR0.5000");

    const b1 = mustBuy(open, fr(20n), 0n, preset);
    expect(b1.shares).toBe(37_999_037n);
    expect(b1.fee).toBe(250_000n);
    expect(b1.creator).toBe(50_000n);
    expect(b1.platform).toBe(200_000n);
    expect(formatFR(b1.priceUfrPer1m, { decimals: 4 })).toBe("FR0.5403");

    const b2 = mustBuy(b1.state, fr(50n), 0n, preset);
    expect(b2.shares).toBe(83_459_342n);
    expect(b2.creator).toBe(125_000n);
    expect(b2.platform).toBe(500_000n);
    expect(formatFR(b2.priceUfrPer1m, { decimals: 4 })).toBe("FR0.6478");

    const rejected = quoteBuy(b2.state, contractForPreset(preset), fr(100n), 0n);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.code).toBe("MAX_POSITION");

    const b3 = mustBuy(b2.state, fr(40n), 0n, preset);
    expect(b3.shares).toBe(57_017_694n);
    expect(b3.creator).toBe(100_000n);
    expect(b3.platform).toBe(400_000n);
    expect(formatFR(b3.priceUfrPer1m, { decimals: 4 })).toBe("FR0.7408");

    const s1 = mustSell(b3.state, b1.shares, preset);
    expect(s1.payout).toBe(26_570_638n);
    expect(s1.fee).toBe(336_338n);
    expect(s1.creator).toBe(67_267n);
    expect(s1.platform).toBe(269_071n);
    expect(formatFR(s1.priceUfrPer1m, { decimals: 4 })).toBe("FR0.6768");

    const s2 = mustSell(s1.state, b2.shares, preset);
    expect(s2.payout).toBe(50_841_813n);
    expect(s2.creator).toBe(128_713n);
    expect(s2.platform).toBe(514_855n);
    expect(formatFR(s2.priceUfrPer1m, { decimals: 4 })).toBe("FR0.5623");

    const s3 = mustSell(s2.state, b3.shares, preset);
    expect(s3.payout).toBe(29_854_734n);
    expect(s3.creator).toBe(75_581n);
    expect(s3.platform).toBe(302_328n);
    expect(formatFR(s3.priceUfrPer1m, { decimals: 4 })).toBe("FR0.5000");
    expect(s3.reserveUfr).toBe(0n);

    const creatorRewards = [b1, b2, b3, s1, s2, s3].reduce((sum, row) => sum + row.creator, 0n);
    expect(creatorRewards).toBe(546_561n);
  });
});

describe("golden table C (graduation pool)", () => {
  it("graduates the default curve into a FR95,000 pool of 152,000,000 shares", () => {
    const contract = contractForPreset("default", { maxPositionBps: 10_000n });
    let state = freshState(contract);
    const step = 1_000n * UFR;
    let guard = 0;
    while (state.phase === "curve" && guard < 500) {
      const quote = quoteBuy(state, contract, step, 0n);
      expect(quote.ok).toBe(true);
      if (!quote.ok) break;
      state = quote.state;
      if (quote.graduates) {
        expect(quote.poolSharesMinted).toBe(152_000_000n);
        expect(quote.gradFee).toBe(5_000n * UFR);
        expect(state.x).toBe(95_000n * UFR);
        expect(state.y).toBe(152_000_000n);
        expect(state.phase).toBe("pool");
        expect(formatFR(quote.priceUfrPer1m, { decimals: 2 })).toBe("FR625.00");
      }
      guard += 1;
    }
    expect(state.phase).toBe("pool");
  });

  it("graduates the beta curve into a FR1,900 pool of 152,000,000 shares", () => {
    const contract = contractForPreset("beta", { maxPositionBps: 10_000n });
    let state = freshState(contract);
    let guard = 0;
    while (state.phase === "curve" && guard < 200) {
      const quote = quoteBuy(state, contract, 100n * UFR, 0n);
      expect(quote.ok).toBe(true);
      if (!quote.ok) break;
      state = quote.state;
      if (quote.graduates) {
        expect(quote.poolSharesMinted).toBe(152_000_000n);
        expect(quote.gradFee).toBe(100n * UFR);
        expect(state.x).toBe(1_900n * UFR);
        expect(state.y).toBe(152_000_000n);
      }
      guard += 1;
    }
    expect(state.phase).toBe("pool");
    expect(formatFR((state.x * 1_000_000n) / state.y, { decimals: 2 })).toBe("FR12.50");
  });
});
