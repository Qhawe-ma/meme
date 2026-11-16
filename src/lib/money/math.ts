/** Integer helpers. Money and curve math stay in BigInt. */

export function ceilDiv(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new RangeError("divisor must be positive");
  if (n <= 0n) return 0n;
  return (n + d - 1n) / d;
}

export function priceUfrPer1m(x: bigint, y: bigint): bigint {
  if (y <= 0n) throw new RangeError("shares must be positive");
  return (x * 1_000_000n) / y;
}

export function marketCapUfr(x: bigint, y: bigint, totalSupply: bigint): bigint {
  if (y <= 0n) throw new RangeError("shares must be positive");
  return (x * totalSupply) / y;
}
