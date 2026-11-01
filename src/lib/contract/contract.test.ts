import { describe, expect, it } from "vitest";
import { buildContractRecord, contractIdFromHash, hashContract, type ContractRecord } from "./contract";

describe("coin contracts", () => {
  const base = () =>
    buildContractRecord({
      coinId: "0192f3c1-0000-7000-8000-000000000001",
      ticker: "BRAAI",
      creatorUserId: "0192f3a0-0000-7000-8000-000000000002",
      createdAt: "2026-10-29T08:15:02.123Z",
      preset: "default",
      prevContractHash: null,
    });

  it("is stable when object keys are inserted in a different order", () => {
    const record = base();
    const reversed = Object.fromEntries(Object.entries(record).reverse()) as ContractRecord;
    expect(hashContract(reversed)).toBe(hashContract(record));
  });

  it("changes the hash when any parameter changes", () => {
    const record = base();
    const hash = hashContract(record);
    const tweaked = { ...record, graduation_target_ufr: "2000000000000" };
    expect(hashContract(tweaked)).not.toBe(hash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(contractIdFromHash(hash)).toMatch(/^MMC-[0-9A-F]{16}$/);
  });

  it("links to the previous contract hash", () => {
    const first = base();
    const second = buildContractRecord({
      coinId: "0192f3c1-0000-7000-8000-000000000099",
      ticker: "KOEK",
      creatorUserId: first.creator_user_id,
      createdAt: "2026-10-29T09:00:00.000Z",
      preset: "beta",
      prevContractHash: hashContract(first),
    });
    expect(second.prev_contract_hash).toBe(hashContract(first));
    expect(hashContract(second)).not.toBe(hashContract(first));
  });
});
