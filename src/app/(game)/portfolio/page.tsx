import Link from "next/link";
import { ClaimButton } from "@/components/portfolio/claim-button";
import { formatFR } from "@/lib/money/format";
import { currentUser } from "@/server/auth/service";
import { portfolioFor } from "@/server/read/market";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await currentUser();
  if (!user) {
    return (
      <div className="py-10">
        <h1 className="font-display text-3xl font-extrabold">Portfolio</h1>
        <p className="mt-3 text-ink-dim">
          <Link href="/sign-in" className="text-taxi underline">
            Sign in
          </Link>{" "}
          to see your balance.
        </p>
      </div>
    );
  }
  const book = await portfolioFor(user.id);
  return (
    <div className="space-y-4 py-6">
      <h1 className="font-display text-3xl font-extrabold">Portfolio</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Cash", book.cashUfr],
          ["Net worth", book.netWorthUfr],
          ["Season score", book.seasonScoreUfr],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-ink-dim">{label}</p>
            <p className="num font-display text-2xl font-extrabold">{formatFR(BigInt(value ?? "0"))}</p>
          </div>
        ))}
      </div>
      <ClaimButton pendingUfr={book.rewardsPendingUfr} />
      <section>
        <h2 className="font-display text-xl font-extrabold">Holdings</h2>
        <ul className="mt-2 space-y-2">
          {book.holdings.length === 0 ? <li className="text-sm text-ink-dim">No shares yet.</li> : null}
          {book.holdings.map((holding) => (
            <li key={holding.ticker}>
              <Link href={`/c/${holding.ticker}`} className="card flex items-center justify-between p-3">
                <span className="font-semibold">
                  {holding.name} <span className="text-ink-dim">${holding.ticker}</span>
                </span>
                <span className="num text-sm text-ink-dim">Sell value {formatFR(BigInt(holding.sellValueUfr))}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-display text-xl font-extrabold">Your coins</h2>
        <ul className="mt-2 space-y-2">
          {book.createdCoins.length === 0 ? <li className="text-sm text-ink-dim">You have not launched one.</li> : null}
          {book.createdCoins.map((coin) => (
            <li key={coin.ticker} className="card flex items-center justify-between p-3">
              <Link href={`/c/${coin.ticker}`} className="font-semibold">
                {coin.name}
              </Link>
              <span className="num text-sm text-ink-dim">Rewards {formatFR(BigInt(coin.rewardsUfr))}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-display text-xl font-extrabold">History</h2>
        <ul className="mt-2 divide-y divide-white/5 text-sm">
          {book.history.map((row, index) => (
            <li key={`${row.at}-${index}`} className="flex justify-between py-2">
              <span>
                {row.side} ${row.ticker}
              </span>
              <span className="num text-ink-dim">{formatFR(BigInt(row.grossUfr))}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
