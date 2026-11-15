"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatFR } from "@/lib/money/format";
import { frInputToUfr } from "@/lib/client/money";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Quote = {
  ok: boolean;
  code?: string;
  shares?: string;
  payoutUfr?: string;
  grossUfr?: string;
  feeUfr?: string;
  creatorUfr?: string;
  platformUfr?: string;
  priceAfterUfrPer1m?: string;
};

export function TradePanel({
  ticker,
  signedIn,
  cashUfr,
  shares,
}: {
  ticker: string;
  signedIn: boolean;
  cashUfr: string;
  shares: string;
}) {
  const router = useRouter();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("10");
  const [sellPct, setSellPct] = useState(100);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const holding = BigInt(shares || "0");

  async function review() {
    setError("");
    setQuote(null);
    const params = new URLSearchParams({ side });
    if (side === "buy") {
      const ufr = frInputToUfr(amount);
      if (!ufr) {
        setError("Enter an amount like 10 or 2.50.");
        return;
      }
      params.set("amountUfr", ufr.toString());
    } else {
      const portion = (holding * BigInt(sellPct)) / 100n;
      if (portion <= 0n) {
        setError("You don't hold this coin.");
        return;
      }
      params.set("shares", portion.toString());
    }
    const response = await fetch(`/api/coins/${ticker}/quote?${params}`);
    const data = (await response.json()) as Quote;
    if (!data.ok) {
      setError(data.code === "MAX_POSITION" ? "That would pass the max holding." : "That trade is too small.");
      return;
    }
    setQuote(data);
  }

  async function confirm() {
    if (!quote?.ok) return;
    setPending(true);
    setError("");
    const body =
      side === "buy"
        ? {
            ticker,
            side,
            amountUfr: frInputToUfr(amount)?.toString(),
            minSharesOut: ((BigInt(quote.shares ?? "0") * 98n) / 100n).toString(),
          }
        : {
            ticker,
            side,
            shares: sellPct === 100 ? "all" : ((holding * BigInt(sellPct)) / 100n).toString(),
            minPayoutUfr: ((BigInt(quote.payoutUfr ?? "0") * 98n) / 100n).toString(),
          };
    const response = await fetch("/api/trades", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as { error?: { message?: string } };
    setPending(false);
    if (!response.ok) {
      setError(data.error?.message ?? "Trade failed.");
      return;
    }
    setQuote(null);
    router.refresh();
  }

  return (
    <section className="border border-line bg-night-2 lg:sticky lg:top-24">
      <div className="grid grid-cols-2">
        {(["buy", "sell"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setSide(item);
              setQuote(null);
            }}
            className={cn(
              "h-10 text-xs font-semibold uppercase tracking-wider",
              side === item ? (item === "buy" ? "bg-up text-night" : "bg-down text-night") : "text-ink-dim",
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="space-y-3 p-3">
        {side === "buy" ? (
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] uppercase text-ink-dim">
              <span>Amount</span>
              <span>Cash {formatFR(BigInt(cashUfr || "0"))}</span>
            </div>
            <input
              aria-label="Amount"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setQuote(null);
              }}
              className="num h-12 w-full border border-line bg-night px-2 text-2xl"
            />
            <div className="mt-2 flex gap-1">
              {["5", "10", "25"].map((chip) => (
                <button key={chip} type="button" className="border border-line px-2 py-1 font-mono text-[11px]" onClick={() => setAmount(chip)}>
                  FR{chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="font-mono text-[11px] text-ink-dim">{holding.toString()} shares in the bag</p>
            <div className="mt-2 flex gap-1">
              {[25, 50, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    setSellPct(pct);
                    setQuote(null);
                  }}
                  className={cn("px-2 py-1 font-mono text-[11px]", sellPct === pct ? "bg-taxi text-night" : "border border-line")}
                >
                  {pct === 100 ? "Sell all" : `${pct}%`}
                </button>
              ))}
            </div>
          </div>
        )}
        {quote?.ok ? (
          <dl className="space-y-1 border-t border-line pt-2 font-mono text-[11px]">
            <div className="flex justify-between">
              <dt className="text-ink-dim">{side === "buy" ? "Shares" : "You get"}</dt>
              <dd>{side === "buy" ? quote.shares : formatFR(BigInt(quote.payoutUfr ?? "0"))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-dim">Fee 1.25%</dt>
              <dd>{formatFR(BigInt(quote.feeUfr ?? "0"), { decimals: 4 })}</dd>
            </div>
            <p className="text-ink-dim">
              Creator {formatFR(BigInt(quote.creatorUfr ?? "0"), { decimals: 4 })} · Treasury {formatFR(BigInt(quote.platformUfr ?? "0"), { decimals: 4 })}
            </p>
          </dl>
        ) : null}
        {error ? <p className="text-xs text-down">{error}</p> : null}
        {!signedIn ? (
          <a href="/sign-in" className="flex h-11 items-center justify-center bg-taxi text-sm font-semibold text-night">
            Sign in to trade
          </a>
        ) : quote?.ok ? (
          <Button type="button" variant={side === "buy" ? "up" : "down"} className="w-full" disabled={pending} onClick={confirm}>
            {pending ? "Working…" : side === "buy" ? "Confirm buy" : "Confirm sell"}
          </Button>
        ) : (
          <Button type="button" className="w-full" onClick={review}>
            {side === "buy" ? "Review buy" : "Review sell"}
          </Button>
        )}
        <p className="text-center font-mono text-[10px] uppercase tracking-wider text-taxi">Game · FR has no cash value</p>
      </div>
    </section>
  );
}
