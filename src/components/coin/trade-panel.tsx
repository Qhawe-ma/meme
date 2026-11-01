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
    <section className="card p-4 lg:sticky lg:top-28">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-night p-1">
        {(["buy", "sell"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setSide(item);
              setQuote(null);
            }}
            className={cn(
              "h-10 rounded-lg text-sm font-bold capitalize",
              side === item ? (item === "buy" ? "bg-up text-night" : "bg-down text-night") : "text-ink-dim",
            )}
          >
            {item}
          </button>
        ))}
      </div>
      {side === "buy" ? (
        <div className="mt-4">
          <div className="mb-2 flex justify-between text-xs text-ink-dim">
            <span>Amount</span>
            <span className="num">Cash {formatFR(BigInt(cashUfr || "0"))}</span>
          </div>
          <input
            aria-label="Amount"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setQuote(null);
            }}
            className="num h-12 w-full rounded-xl border border-white/10 bg-night px-3 font-display text-2xl font-bold"
          />
          <div className="mt-2 flex gap-2">
            {["5", "10", "25"].map((chip) => (
              <button key={chip} type="button" className="rounded-full bg-night-3 px-3 py-1 text-xs font-semibold" onClick={() => setAmount(chip)}>
                FR{chip}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-xs text-ink-dim">You hold {holding.toString()} shares</p>
          <div className="mt-2 flex gap-2">
            {[25, 50, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => {
                  setSellPct(pct);
                  setQuote(null);
                }}
                className={cn("rounded-full px-3 py-1 text-xs font-semibold", sellPct === pct ? "bg-taxi text-night" : "bg-night-3")}
              >
                {pct === 100 ? "Sell all" : `${pct}%`}
              </button>
            ))}
          </div>
        </div>
      )}
      {quote?.ok ? (
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-dim">{side === "buy" ? "Shares" : "You receive"}</dt>
            <dd className="num font-semibold">
              {side === "buy" ? quote.shares : formatFR(BigInt(quote.payoutUfr ?? "0"))}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-dim">Fee 1.25%</dt>
            <dd className="num">{formatFR(BigInt(quote.feeUfr ?? "0"), { decimals: 4 })}</dd>
          </div>
          <p className="text-xs text-ink-dim">
            Creator {formatFR(BigInt(quote.creatorUfr ?? "0"), { decimals: 4 })} · Platform treasury{" "}
            {formatFR(BigInt(quote.platformUfr ?? "0"), { decimals: 4 })}
          </p>
        </dl>
      ) : null}
      {error ? <p className="mt-3 text-sm text-down">{error}</p> : null}
      {!signedIn ? (
        <a href="/sign-in" className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-protea font-semibold">
          Sign in to trade
        </a>
      ) : quote?.ok ? (
        <Button type="button" className="mt-4 w-full" disabled={pending} onClick={confirm}>
          {pending ? "Working…" : side === "buy" ? "Confirm buy" : "Confirm sell"}
        </Button>
      ) : (
        <Button type="button" className="mt-4 w-full" onClick={review}>
          {side === "buy" ? "Review buy" : "Review sell"}
        </Button>
      )}
      <p className="mt-3 text-center text-xs font-semibold text-taxi">Game · FR has no cash value</p>
    </section>
  );
}
