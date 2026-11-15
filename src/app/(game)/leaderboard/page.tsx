import Link from "next/link";
import { formatFR } from "@/lib/money/format";
import { currentUser } from "@/server/auth/service";
import { leaderboard } from "@/server/read/market";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const user = await currentUser();
  const board = await leaderboard(user?.id);
  return (
    <div className="px-3 py-4">
      <h1 className="display text-5xl leading-none">This week</h1>
      <p className="mt-2 max-w-lg text-sm text-ink-dim">
        Top traders need {board.minTrades} trades. Score is the change in game net worth, with this week&apos;s grant taken out. Balances do not reset.
      </p>
      {board.me ? (
        <p className="mt-4 border-l-4 border-taxi bg-night-2 px-3 py-2 font-mono text-[12px]">
          Your week, @{board.me.handle}: {formatFR(BigInt(board.me.scoreUfr))} · {board.me.trades} trades
          {board.me.ranked ? "" : ". Five trades puts you on the board."}
        </p>
      ) : null}
      <ol className="mt-4 border-t border-line">
        {board.traders.length === 0 ? <li className="py-4 text-sm text-ink-dim">No one has five trades yet.</li> : null}
        {board.traders.map((entry) => (
          <li key={entry.handle} className="flex items-baseline justify-between border-b border-line py-2">
            <span className="flex items-baseline gap-3">
              <span className="num w-8 text-ink-dim">{String(entry.rank).padStart(2, "0")}</span>
              <Link href={`/u/${entry.handle}`} className="display text-3xl">
                {entry.handle}
              </Link>
            </span>
            <span className="num text-sm">{formatFR(BigInt(entry.scoreUfr))}</span>
          </li>
        ))}
      </ol>
      <h2 className="mt-8 display text-3xl">Hall of fame</h2>
      <ul className="mt-2 border-t border-line">
        {board.graduated.length === 0 ? <li className="py-3 text-sm text-ink-dim">No coin has left the curve.</li> : null}
        {board.graduated.map((coin) => (
          <li key={coin.ticker} className="border-b border-line py-2">
            <Link href={`/c/${coin.ticker}`} className="display text-2xl">
              {coin.ticker} <span className="text-sm text-ink-dim">{coin.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
