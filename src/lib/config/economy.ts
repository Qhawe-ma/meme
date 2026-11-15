/** 1 FR, in micro-FR. Amounts in the game are integers in this unit. */
export const UFR = 1_000_000n;

export const PRESETS = {
  default: {
    GRADUATION_TARGET_UFR: 100_000n * UFR,
    MAX_POSITION_BPS: 500n, // 5% of TOTAL_SUPPLY
    LAUNCH_PROTECTION_MAX_BUY_UFR: 20n * UFR,
  },
  beta: {
    GRADUATION_TARGET_UFR: 2_000n * UFR,
    MAX_POSITION_BPS: 1000n, // 10% of TOTAL_SUPPLY
    LAUNCH_PROTECTION_MAX_BUY_UFR: 10n * UFR,
  },
} as const;

export type PresetName = keyof typeof PRESETS;

export const ECON = {
  CONTRACT_VERSION: "mm-curve-v1",
  SIGNUP_GRANT_UFR: 200n * UFR,
  BAILOUT_TOPUP_TO_UFR: 20n * UFR,
  BAILOUT_THRESHOLD_UFR: 5n * UFR,
  BAILOUT_COOLDOWN_DAYS: 14,

  CREATE_FEE_UFR: 20n * UFR,

  TOTAL_SUPPLY: 1_000_000_000n,
  CURVE_SUPPLY: 800_000_000n, // sold on the curve before graduation
  VIRTUAL_SHARES: 1_000_000_000n,
  // Virtual FR (x0) is GRADUATION_TARGET / 4, so selling CURVE_SUPPLY
  // lands the real reserve on the target (x_final = 5 * x0).

  BUY_FEE_BPS: 125n,
  SELL_FEE_BPS: 125n,
  CREATOR_FEE_BPS: 25n, // taken from the 125 bps fee; BURN_FEE_BPS is the rest
  BURN_FEE_BPS: 100n,
  GRADUATION_FEE_BPS: 500n,

  LAUNCH_PROTECTION_SECONDS: 60,
  MIN_TRADE_UFR: 100_000n, // FR0.10
  MIN_CLAIM_UFR: 10_000n, // FR0.01
  DEFAULT_SLIPPAGE_BPS: 200n,

  MAX_COINS_PER_USER_PER_DAY: 3,
  TRADE_RATE_LIMIT_PER_MIN: 20,
  SAME_COIN_COOLDOWN_SECONDS: 3,
  SOCIAL_EDITS_PER_DAY: 10,
  SEASON_MIN_TRADES_TO_RANK: 5,
  REPORTS_TO_AUTO_HIDE: 3,
} as const;
