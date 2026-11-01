import { createHash } from "node:crypto";
import canonicalize from "canonicalize";
import { ECON, PRESETS, virtualFr, type PresetName } from "@/lib/config/economy";

export type ContractRecord = {
  version: string;
  coin_id: string;
  ticker: string;
  creator_user_id: string;
  created_at: string;
  unit: "uFR";
  total_supply: string;
  curve_supply: string;
  virtual_fr_ufr: string;
  virtual_shares: string;
  graduation_target_ufr: string;
  buy_fee_bps: number;
  sell_fee_bps: number;
  creator_fee_bps: number;
  platform_fee_bps: number;
  graduation_fee_bps: number;
  max_position_bps: number;
  launch_protection_seconds: number;
  launch_protection_max_buy_ufr: string;
  rounding: "fee_ceil;creator_floor;reserve_ceil";
  prev_contract_hash: string | null;
};

export function buildContractRecord(input: {
  coinId: string;
  ticker: string;
  creatorUserId: string;
  createdAt: string;
  preset: PresetName;
  prevContractHash: string | null;
}): ContractRecord {
  const preset = PRESETS[input.preset];
  return {
    version: ECON.CONTRACT_VERSION,
    coin_id: input.coinId,
    ticker: input.ticker,
    creator_user_id: input.creatorUserId,
    created_at: input.createdAt,
    unit: "uFR",
    total_supply: ECON.TOTAL_SUPPLY.toString(),
    curve_supply: ECON.CURVE_SUPPLY.toString(),
    virtual_fr_ufr: virtualFr(preset.GRADUATION_TARGET_UFR).toString(),
    virtual_shares: ECON.VIRTUAL_SHARES.toString(),
    graduation_target_ufr: preset.GRADUATION_TARGET_UFR.toString(),
    buy_fee_bps: Number(ECON.BUY_FEE_BPS),
    sell_fee_bps: Number(ECON.SELL_FEE_BPS),
    creator_fee_bps: Number(ECON.CREATOR_FEE_BPS),
    platform_fee_bps: Number(ECON.PLATFORM_FEE_BPS),
    graduation_fee_bps: Number(ECON.GRADUATION_FEE_BPS),
    max_position_bps: Number(preset.MAX_POSITION_BPS),
    launch_protection_seconds: ECON.LAUNCH_PROTECTION_SECONDS,
    launch_protection_max_buy_ufr: preset.LAUNCH_PROTECTION_MAX_BUY_UFR.toString(),
    rounding: "fee_ceil;creator_floor;reserve_ceil",
    prev_contract_hash: input.prevContractHash,
  };
}

export function canonicalContract(record: ContractRecord): string {
  const canon = canonicalize(record);
  if (!canon) throw new Error("contract JSON could not be canonicalised");
  return canon;
}

export function hashContract(record: ContractRecord): string {
  return createHash("sha256").update(canonicalContract(record)).digest("hex");
}

export function contractIdFromHash(hash: string): string {
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("contract hash must be 64 hex chars");
  return `MMC-${hash.slice(0, 16).toUpperCase()}`;
}

/** Plain-language line shown on the coin page. */
export function contractSummary(record: ContractRecord): string {
  const gradFr = (BigInt(record.graduation_target_ufr) / 1_000_000n).toString();
  const hold = record.max_position_bps / 100;
  return `Buy fee 1.25% · Sell fee 1.25% · Creator gets 0.25% · 1.00% to the platform treasury · Graduates at FR${Number(gradFr).toLocaleString("en-ZA")} · Max hold ${hold}%`;
}
