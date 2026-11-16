import Link from "next/link";
import { formatFR } from "@/lib/money/format";
import type { CoinCard } from "@/server/read/market";
import { Spark } from "./spark";

export function CoinRow({ coin, rank }: { coin: CoinCard; rank?: number }) {
  const change = BigInt(coin.change1hBps);
  const up = change >= 0n;
  const progress = Math.min(100, Number(coin.progressBps) / 100);
  const meta =
    coin.phase === "pool"
      ? "Graduated"
      : progress >= 1
        ? `${progress.toFixed(0)}% to the koppie · ${coin.holders} holders`
        : `${coin.holders} holders · fresh`;
  return (
    <li className="border-b border-line">
      <Link
        href={`/c/${coin.ticker}`}
        className="grid grid-cols-[1.4rem_2.5rem_minmax(0,1fr)_4.5rem_5.5rem] items-center gap-2 px-2 py-1.5 hover:bg-night-3"
      >
        <span className="num text-[10px] text-ink-dim">{rank ?? ""}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coin.imageUrl} alt="" className="size-10 rounded-[8px] object-cover" />
        <span className="min-w-0">
          <span className="display block truncate text-[17px] leading-none">{coin.ticker}</span>
          <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-night-4">
            <span className="block h-full rounded-full bg-taxi" style={{ width: `${Math.max(progress, 3)}%` }} />
          </span>
          <span className="mt-1 block truncate text-[11px] text-ink-dim">{meta}</span>
        </span>
        <Spark points={coin.spark} up={up} />
        <span className="text-right">
          <span className="num block text-[12px]">{formatFR(BigInt(coin.marketCapUfr))}</span>
          <span className={`num block text-[10px] ${up ? "text-up" : "text-down"}`}>
            {up ? "+" : ""}
            {(Number(change) / 100).toFixed(1)}%
          </span>
        </span>
      </Link>
    </li>
  );
}
