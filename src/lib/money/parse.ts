const MAX = 10n ** 15n;

/**
 * Parse a client amount. Digits only, no sign, exponent, decimal, whitespace
 * or unicode digits. Returns micro-FR (or shares) as a BigInt.
 */
export function parseAmount(raw: unknown): bigint {
  if (typeof raw !== "string" || !/^[0-9]+$/.test(raw)) {
    throw new AmountError("INVALID_AMOUNT");
  }
  const value = BigInt(raw);
  if (value <= 0n || value > MAX) throw new AmountError("INVALID_AMOUNT");
  return value;
}

export class AmountError extends Error {
  code = "INVALID_AMOUNT" as const;
  constructor(message: string) {
    super(message);
    this.name = "AmountError";
  }
}
