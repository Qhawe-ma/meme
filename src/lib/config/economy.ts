export const UFR = 1_000_000n; // 1 FR in micro-FR

export const PRESETS = {
  default: {
    GRADUATION_TARGET_UFR: 100_000n * UFR, // FR100,000
    MAX_POSITION_BPS: 500n, // 5% of TOTAL_SUPPLY
    LAUNCH_PROTECTION_MAX_BUY_UFR: 20n * UFR,
  },
  beta: {
    GRADUATION_TARGET_UFR: 2_000n * UFR, // FR2,000
    MAX_POSITION_BPS: 1000n, // 10%
    LAUNCH_PROTECTION_MAX_BUY_UFR: 10n * UFR,
  },
} as const;

export type PresetName = keyof typeof PRESETS;

// Active preset is read from system_settings.economy_preset (default 'default');
// changing it needs 2-person approval. That wiring arrives in M1/M8.

export const ECON = {
  CONTRACT_VERSION: "mm-curve-v1",
  SIGNUP_GRANT_UFR: 200n * UFR, // the only default mint
  BAILOUT_TOPUP_TO_UFR: 20n * UFR, // only if bailout enabled
  BAILOUT_THRESHOLD_UFR: 5n * UFR,
  BAILOUT_COOLDOWN_DAYS: 14,

  CREATE_FEE_UFR: 20n * UFR, // burned

  TOTAL_SUPPLY: 1_000_000_000n,
  CURVE_SUPPLY: 800_000_000n, // 80% sold on the curve
  VIRTUAL_SHARES: 1_000_000_000n, // y0
  // x0 (virtual FR) = GRADUATION_TARGET / 4  (because x_final = x0*y0/(y0-CURVE) = 5*x0)

  BUY_FEE_BPS: 125n, // 1.25%
  SELL_FEE_BPS: 125n, // 1.25%
  CREATOR_FEE_BPS: 25n, // 0.25 pp of trade value -> creator rewards
  BURN_FEE_BPS: 100n, // 1.00 pp of trade value -> burned
  GRADUATION_FEE_BPS: 500n, // 5% of reserve burned at graduation

  LAUNCH_PROTECTION_SECONDS: 60,
  MIN_TRADE_UFR: 100_000n, // FR0.10
  MIN_CLAIM_UFR: 10_000n, // FR0.01
  DEFAULT_SLIPPAGE_BPS: 200n, // 2%

  MAX_COINS_PER_USER_PER_DAY: 3,
  TRADE_RATE_LIMIT_PER_MIN: 20,
  SAME_COIN_COOLDOWN_SECONDS: 3,
  SOCIAL_EDITS_PER_DAY: 10,
  SEASON_MIN_TRADES_TO_RANK: 5,
  REPORTS_TO_AUTO_HIDE: 3,
} as const;
