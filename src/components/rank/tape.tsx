"use client";

import { formatFR } from "@/lib/money/format";

export type TapeItem = { side: string; ticker: string; handle: string; grossUfr: string };

export function TradeTape({ items }: { items: TapeItem[] }) {
  if (items.length === 0) {
    return (
      <div className="border-y border-line bg-night-2 px-3 py-1.5 font-mono text-[11px] text-ink-dim">
        The tape is quiet. First trade of the day has not landed.
      </div>
    );
  }
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden border-y border-line bg-night-2">
      <div className="tape-track">
        {row.map((item, index) => (
          <span key={`${item.ticker}-${index}`} className="font-geist-mono flex items-center gap-2 px-4 py-1.5 text-[12px]">
            <span className={item.side === "buy" ? "text-up" : "text-down"}>{item.side === "buy" ? "Buy" : "Sell"}</span>
            <span className="font-medium tracking-[-0.02em]">{item.ticker}</span>
            <span className="text-ink-dim">{formatFR(BigInt(item.grossUfr))}</span>
            <span className="text-ink-dim">@{item.handle}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
