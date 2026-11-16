import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { ECON, type PresetName } from "@/lib/config/economy";
import { UFR } from "@/lib/config/economy";
import {
  contractForPreset,
  freshState,
  quoteBuy,
  quoteSell,
  reserveOf,
  type CurveContract,
  type CurveState,
  type QuoteOk,
} from "./curve";

const presets: PresetName[] = ["default", "beta"];

function buy(state: CurveState, contract: CurveContract, gross: bigint, holding = 0n) {
  return quoteBuy(state, contract, gross, holding);
}

describe("bonding curve properties", () => {
  for (const preset of presets) {
    const contract = contractForPreset(preset);

    it(`${preset}: x·y stays at least k, reserve stays non-negative, supply stays inside the cap`, () => {
      fc.assert(
        fc.property(fc.array(fc.bigInt({ min: ECON.MIN_TRADE_UFR, max: 30n * UFR }), { minLength: 1, maxLength: 12 }), (grosses) => {
          let state = freshState(contract);
          let holding = 0n;
          for (const gross of grosses) {
            const quote = buy(state, contract, gross, holding);
            if (!quote.ok) continue;
            state = quote.state;
            holding += quote.shares;
            expect(state.x * state.y >= state.k).toBe(true);
            expect(reserveOf(state) >= 0n).toBe(true);
            if (state.phase === "curve") expect(state.sold <= contract.curveSupply).toBe(true);
            expect(holding <= contract.totalSupply).toBe(true);
            expect(quote.creator + quote.platform).toBe(quote.fee);
            expect(quote.creator).toBe((quote.fee * contract.creatorFeeBps) / contract.buyFeeBps);
          }
        }),
        { numRuns: 1000 },
      );
    });

    it(`${preset}: a buy raises the price and a sell lowers it`, () => {
      fc.assert(
        fc.property(fc.bigInt({ min: UFR, max: 40n * UFR }), (gross) => {
          const open = freshState(contract);
          const before = (open.x * 1_000_000n) / open.y;
          const bought = buy(open, contract, gross, 0n);
          if (!bought.ok) return;
          const mid = (bought.state.x * 1_000_000n) / bought.state.y;
          expect(mid > before).toBe(true);
          const sold = quoteSell(bought.state, contract, bought.shares);
          if (!sold.ok) return;
          const after = (sold.state.x * 1_000_000n) / sold.state.y;
          expect(after < mid).toBe(true);
        }),
        { numRuns: 1000 },
      );
    });

    it(`${preset}: buy-then-sell returns less than was spent`, () => {
      fc.assert(
        fc.property(fc.bigInt({ min: UFR, max: 40n * UFR }), (gross) => {
          const open = freshState(contract);
          const bought = buy(open, contract, gross, 0n);
          if (!bought.ok) return;
          const sold = quoteSell(bought.state, contract, bought.shares);
          expect(sold.ok).toBe(true);
          if (!sold.ok) return;
          expect(sold.payout < bought.gross).toBe(true);
        }),
        { numRuns: 1000 },
      );
    });

    it(`${preset}: splitting a buy never yields more shares`, () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 2n * UFR, max: 40n * UFR }),
          fc.integer({ min: 1, max: 99 }),
          (gross, pct) => {
            const open = freshState(contract);
            const whole = buy(open, contract, gross, 0n);
            if (!whole.ok || whole.graduates) return;
            const firstGross = (gross * BigInt(pct)) / 100n;
            const secondGross = gross - firstGross;
            if (firstGross < ECON.MIN_TRADE_UFR || secondGross < ECON.MIN_TRADE_UFR) return;
            const a = buy(open, contract, firstGross, 0n);
            if (!a.ok || a.graduates) return;
            const b = buy(a.state, contract, secondGross, a.shares);
            if (!b.ok || b.graduates) return;
            expect(a.shares + b.shares <= whole.shares).toBe(true);
          },
        ),
        { numRuns: 1000 },
      );
    });

    it(`${preset}: a round trip leaves reserve under FR0.01`, () => {
      fc.assert(
        fc.property(
          fc.array(fc.bigInt({ min: UFR, max: 15n * UFR }), { minLength: 1, maxLength: 5 }),
          (grosses) => {
            let state = freshState(contract);
            const lots: bigint[] = [];
            for (const gross of grosses) {
              const quote = buy(state, contract, gross, lots.reduce((s, n) => s + n, 0n));
              if (!quote.ok || quote.graduates) return;
              state = quote.state;
              lots.push(quote.shares);
            }
            for (const shares of [...lots].reverse()) {
              const sold = quoteSell(state, contract, shares);
              expect(sold.ok).toBe(true);
              if (!sold.ok) return;
              state = sold.state;
            }
            const reserve = reserveOf(state);
            expect(reserve >= 0n).toBe(true);
            expect(reserve < 10_000n).toBe(true);
          },
        ),
        { numRuns: 1000 },
      );
    });
  }

  it("graduation clip sells the remaining curve shares and the pool price matches", () => {
    for (const preset of presets) {
      const contract = contractForPreset(preset, { maxPositionBps: 10_000n });
      let state = freshState(contract);
      let last: QuoteOk | null = null;
      for (let i = 0; i < 400 && state.phase === "curve"; i += 1) {
        const quote = quoteBuy(state, contract, 500n * UFR, 0n);
        expect(quote.ok).toBe(true);
        if (!quote.ok) return;
        last = quote;
        state = quote.state;
      }
      expect(state.phase).toBe("pool");
      expect(last?.graduates).toBe(true);
      expect(last?.shares).toBeGreaterThan(0n);
      const curvePrice = priceAtGraduation(preset);
      const poolPrice = (state.x * 1_000_000n) / state.y;
      const drift = poolPrice > curvePrice ? poolPrice - curvePrice : curvePrice - poolPrice;
      expect(drift <= 1n).toBe(true);
    }
  });
});

function priceAtGraduation(preset: PresetName): bigint {
  const contract = contractForPreset(preset);
  const y = contract.y0 - contract.curveSupply;
  const x = 5n * contract.x0;
  return (x * 1_000_000n) / y;
}
