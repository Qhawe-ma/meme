import { UFR } from "@/lib/config/economy";

type FormatOptions = {
  /** Digits after the decimal point. Default 2. */
  decimals?: number;
  /** Drop the decimals when the amount is a whole number of FR, e.g. "FR200". */
  trimWhole?: boolean;
};

/** Round-half-up integer division for non-negative values. */
function divRound(n: bigint, d: bigint): bigint {
  return (n + d / 2n) / d;
}

/**
 * Format micro-FR as text, e.g. 12_345_678n -> "FR12.35".
 * Pure BigInt, no floating point. Negative amounts read "-FR1.50".
 */
export function formatFR(uFR: bigint, options: FormatOptions = {}): string {
  const { decimals = 2, trimWhole = false } = options;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) {
    throw new RangeError("decimals must be an integer from 0 to 6");
  }

  const negative = uFR < 0n;
  const abs = negative ? -uFR : uFR;

  const scale = 10n ** BigInt(decimals);
  const scaled = divRound(abs * scale, UFR); // value in units of 10^-decimals FR
  const whole = scaled / scale;
  const fraction = scaled % scale;

  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const hasFraction = decimals > 0 && !(trimWhole && fraction === 0n);
  const fractionText = hasFraction ? `.${fraction.toString().padStart(decimals, "0")}` : "";

  // A tiny negative that rounds to zero should not read "-FR0.00".
  const sign = negative && scaled !== 0n ? "-" : "";
  return `${sign}FR${wholeText}${fractionText}`;
}
