import { describe, expect, it } from "vitest";
import { ECON, PRESETS, UFR } from "./economy";

describe("economy constants", () => {
  it("splits the buy and sell fee exactly into creator and platform shares", () => {
    expect(ECON.CREATOR_FEE_BPS + ECON.PLATFORM_FEE_BPS).toBe(ECON.BUY_FEE_BPS);
    expect(ECON.BUY_FEE_BPS).toBe(ECON.SELL_FEE_BPS);
    expect(ECON.CREATOR_FEE_BPS * 5n).toBe(ECON.BUY_FEE_BPS);
  });

  it("keeps the curve supply inside the total supply", () => {
    expect(ECON.CURVE_SUPPLY).toBeLessThan(ECON.TOTAL_SUPPLY);
    expect(ECON.VIRTUAL_SHARES).toBe(ECON.TOTAL_SUPPLY);
  });

  it("makes the final virtual reserve exactly 5x the start, so reserve hits the target", () => {
    for (const preset of Object.values(PRESETS)) {
      const x0 = preset.GRADUATION_TARGET_UFR / 4n;
      const k = x0 * ECON.VIRTUAL_SHARES;
      const xFinal = k / (ECON.VIRTUAL_SHARES - ECON.CURVE_SUPPLY);
      expect(xFinal).toBe(5n * x0);
      expect(xFinal - x0).toBe(preset.GRADUATION_TARGET_UFR);
    }
  });

  it("states the headline numbers from the spec", () => {
    expect(ECON.SIGNUP_GRANT_UFR).toBe(200n * UFR);
    expect(ECON.CREATE_FEE_UFR).toBe(20n * UFR);
    expect(PRESETS.default.GRADUATION_TARGET_UFR).toBe(100_000n * UFR);
    expect(PRESETS.beta.GRADUATION_TARGET_UFR).toBe(2_000n * UFR);
  });
});
