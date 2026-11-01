/** Turn a FR text field ("10" or "10.50") into micro-FR. No floating point. */
export function frInputToUfr(raw: string): bigint | null {
  const text = raw.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  if (!whole) return null;
  const micros = `${frac}000000`.slice(0, 6);
  const value = BigInt(whole) * 1_000_000n + BigInt(micros);
  return value > 0n ? value : null;
}
