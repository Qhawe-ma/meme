import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { ECON, UFR } from "@/lib/config/economy";
import { contractForPreset, freshState, quoteBuy, quoteSell, type CurveState } from "@/lib/curve/curve";
import { supplyGap, type SupplyTotals } from "./invariant";

type Book = SupplyTotals & { reserve: bigint };

function emptyBook(): Book {
  return { mint: 0n, cash: 0n, rewards: 0n, reserves: 0n, treasury: 0n, reserve: 0n };
}

function grant(book: Book) {
  book.mint -= ECON.SIGNUP_GRANT_UFR;
  book.cash += ECON.SIGNUP_GRANT_UFR;
}

function createCoin(book: Book) {
  book.cash -= ECON.CREATE_FEE_UFR;
  book.treasury += ECON.CREATE_FEE_UFR;
}

function applyBuy(book: Book, gross: bigint, net: bigint, creator: bigint, platform: bigint) {
  book.cash -= gross;
  book.reserves += net;
  book.rewards += creator;
  book.treasury += platform;
}

function applySell(book: Book, gross: bigint, payout: bigint, creator: bigint, platform: bigint) {
  book.reserves -= gross;
  book.cash += payout;
  book.rewards += creator;
  book.treasury += platform;
}

function claim(book: Book) {
  const amount = book.rewards;
  book.rewards = 0n;
  book.cash += amount;
}

describe("ledger invariant", () => {
  it("holds the identity minted = cash + reserves + creator rewards + platform treasury", () => {
    const book = emptyBook();
    expect(supplyGap(book)).toBe(0n);
    grant(book);
    createCoin(book);
    applyBuy(book, 50_000_000n, 49_375_000n, 125_000n, 500_000n);
    applySell(book, 10_000_000n, 9_875_000n, 25_000n, 100_000n);
    claim(book);
    expect(supplyGap(book)).toBe(0n);
    expect(book.mint + book.cash + book.rewards + book.reserves + book.treasury).toBe(0n);
  });

  it("detects a mint that was not balanced", () => {
    const book = emptyBook();
    grant(book);
    book.cash += 1n;
    expect(supplyGap(book)).not.toBe(0n);
  });

  it("keeps the identity across random curve trades for both presets", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("default" as const, "beta" as const),
        fc.array(fc.bigInt({ min: UFR, max: 25n * UFR }), { minLength: 1, maxLength: 8 }),
        (preset, grosses) => {
          const contract = contractForPreset(preset);
          const book = emptyBook();
          grant(book);
          createCoin(book);
          let state: CurveState = freshState(contract);
          let holding = 0n;
          for (const gross of grosses) {
            if (book.cash < gross) continue;
            const bought = quoteBuy(state, contract, gross, holding);
            if (!bought.ok || bought.graduates) continue;
            applyBuy(book, bought.gross, bought.net, bought.creator, bought.platform);
            state = bought.state;
            holding += bought.shares;
            expect(supplyGap(book)).toBe(0n);
            if (holding > 0n && book.reserves > 0n) {
              const sold = quoteSell(state, contract, holding);
              if (sold.ok) {
                applySell(book, sold.gross, sold.payout, sold.creator, sold.platform);
                state = sold.state;
                holding = 0n;
                expect(supplyGap(book)).toBe(0n);
              }
            }
          }
          if (book.rewards > 0n) claim(book);
          expect(supplyGap(book)).toBe(0n);
          expect(book.cash >= 0n && book.rewards >= 0n && book.reserves >= 0n && book.treasury >= 0n).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });
});
