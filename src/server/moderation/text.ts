import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AppError } from "@/server/http";
import { textSafetyIssues } from "@/lib/links/validate";

const RESERVED = new Set([
  "BTC", "ETH", "SOL", "USDT", "USDC", "ZAR", "RAND", "ADMIN", "MOD", "SYSTEM", "SCAM", "PUMP", "NFT", "FRAND", "CASH",
]);

let blocklist: string[] | null = null;

function words(): string[] {
  if (!blocklist) {
    const raw = readFileSync(join(/* turbopackIgnore: true */ process.cwd(), "src/server/moderation/blocklist-za.txt"), "utf8");
    blocklist = raw
      .split("\n")
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line && !line.startsWith("#"));
  }
  return blocklist;
}

export function containsBlockedText(value: string): boolean {
  const haystack = value.toLowerCase();
  return words().some((word) => haystack.includes(word));
}

export function assertCoinText(input: { name: string; ticker: string; description: string }) {
  if (input.name.length < 2 || input.name.length > 32) throw new AppError("FORBIDDEN", "Name must be 2–32 characters.");
  if (!/^[A-Z0-9]{3,8}$/.test(input.ticker)) throw new AppError("TICKER_TAKEN", "Ticker must be 3–8 letters or numbers.");
  if (RESERVED.has(input.ticker)) throw new AppError("TICKER_RESERVED", "That ticker is reserved.");
  const blob = `${input.name}\n${input.ticker}\n${input.description}`;
  if (containsBlockedText(blob)) throw new AppError("FORBIDDEN", "That name, ticker or description isn't allowed.");
  const issues = textSafetyIssues(input.description);
  if (issues.length > 0) {
    throw new AppError("FORBIDDEN", "Keep links, phone numbers, emails and ID numbers out of the description. Put links in the social fields.");
  }
}
