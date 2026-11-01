import { describe, expect, it } from "vitest";
import { UFR } from "@/lib/config/economy";
import { formatFR } from "./format";

describe("formatFR", () => {
  it("formats the spec example", () => {
    expect(formatFR(12_345_678n)).toBe("FR12.35");
  });

  it("always shows two decimals by default", () => {
    expect(formatFR(0n)).toBe("FR0.00");
    expect(formatFR(200n * UFR)).toBe("FR200.00");
    expect(formatFR(100_000n)).toBe("FR0.10");
  });

  it("adds thousands separators", () => {
    expect(formatFR(100_000n * UFR)).toBe("FR100,000.00");
    expect(formatFR(1_234_567n * UFR)).toBe("FR1,234,567.00");
  });

  it("rounds half up at the last shown digit", () => {
    expect(formatFR(12_345_000n)).toBe("FR12.35");
    expect(formatFR(12_344_999n)).toBe("FR12.34");
    expect(formatFR(999_999n)).toBe("FR1.00");
  });

  it("supports more decimals for prices", () => {
    expect(formatFR(25_098_850n, { decimals: 4 })).toBe("FR25.0989");
    expect(formatFR(500_000n, { decimals: 6 })).toBe("FR0.500000");
  });

  it("can drop decimals for whole amounts", () => {
    expect(formatFR(200n * UFR, { trimWhole: true })).toBe("FR200");
    expect(formatFR(200_500_000n, { trimWhole: true })).toBe("FR200.50");
    expect(formatFR(2_000n * UFR, { decimals: 0 })).toBe("FR2,000");
  });

  it("handles negative amounts", () => {
    expect(formatFR(-1_500_000n)).toBe("-FR1.50");
    expect(formatFR(-1n)).toBe("FR0.00");
  });

  it("is exact for values far beyond Number.MAX_SAFE_INTEGER", () => {
    expect(formatFR(9_007_199_254_740_993_000_000n)).toBe("FR9,007,199,254,740,993.00");
  });

  it("rejects silly decimals", () => {
    expect(() => formatFR(1n, { decimals: 7 })).toThrow(RangeError);
    expect(() => formatFR(1n, { decimals: -1 })).toThrow(RangeError);
  });
});
