import Link from "next/link";
import { formatFR } from "@/lib/money/format";
import { currentUser } from "@/server/auth/service";
import { leaderboard } from "@/server/read/market";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const user = await currentUser();
  const board = await leaderboard(user?.id);
  return (
    <div className="py-6">
      <h1 className="font-display text-3xl font-extrabold">This week</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Top traders need {board.minTrades} trades. Score is the change in game net worth, with this week&apos;s grant taken out. Balances do not reset.
      </p>
      {board.me ? (
        <p className="card mt-4 p-4 text-sm">
          Your week, @{board.me.handle}: {formatFR(BigInt(board.me.scoreUfr))} across {board.me.trades} trades.
          {board.me.ranked ? "" : " Five trades puts you on the board."}
        </p>
      ) : null}
      <ol className="mt-4 space-y-2">
        {board.traders.length === 0 ? <li className="text-sm text-ink-dim">No one has five trades yet.</li> : null}
        {board.traders.map((entry) => (
          <li key={entry.handle} className="card flex items-center justify-between p-3">
            <span>
              <span className="text-ink-dim">{entry.rank}.</span>{" "}
              <Link href={`/u/${entry.handle}`} className="font-semibold">
                @{entry.handle}
              </Link>
            </span>
            <span className="num text-sm">{formatFR(BigInt(entry.scoreUfr))}</span>
          </li>
        ))}
      </ol>
      <h2 className="mt-8 font-display text-2xl font-extrabold">Hall of fame</h2>
      <ul className="mt-3 space-y-2">
        {board.graduated.length === 0 ? <li className="text-sm text-ink-dim">No coin has graduated yet.</li> : null}
        {board.graduated.map((coin) => (
          <li key={coin.ticker}>
            <Link href={`/c/${coin.ticker}`} className="card block p-3">
              {coin.name} <span className="text-ink-dim">${coin.ticker}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
