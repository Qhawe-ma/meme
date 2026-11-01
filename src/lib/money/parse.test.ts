import { describe, expect, it } from "vitest";
import { AmountError, parseAmount } from "./parse";

describe("parseAmount", () => {
  it("accepts a digit string", () => {
    expect(parseAmount("1000000")).toBe(1_000_000n);
  });

  it.each([
    "-1",
    "0",
    "1.5",
    "1e6",
    "NaN",
    " 1",
    "١",
    "1_000",
    "",
    "9999999999999999",
  ])("rejects %j", (value) => {
    expect(() => parseAmount(value)).toThrow(AmountError);
  });

  it("rejects non-strings", () => {
    expect(() => parseAmount(100)).toThrow(AmountError);
    expect(() => parseAmount(["100"])).toThrow(AmountError);
    expect(() => parseAmount(null)).toThrow(AmountError);
  });
});
