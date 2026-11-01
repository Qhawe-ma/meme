import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { GamePill } from "@/components/layout/game-pill";
import { Logo } from "@/components/layout/logo";
import { formatFR } from "@/lib/money/format";
import { cn } from "@/lib/utils";

// Example figures come from the spec's worked beta example (table B), not from live data.
const EXAMPLE = {
  price: formatFR(740_800n, { decimals: 4 }),
  marketCap: formatFR(740_850_000n),
  target: formatFR(2_000_000_000n, { decimals: 0 }),
  progress: 5.43,
};

const rules = [
  {
    title: "FR is not money.",
    body: "It's a game score. You can't buy it, sell it, send it to a friend or cash it out.",
  },
  {
    title: "Everyone starts with FR200.",
    body: "One grant per verified adult, after a phone check. There are no daily top-ups.",
  },
  {
    title: "18 and over only.",
    body: "We ask for your date of birth before you get in.",
  },
  {
    title: "Every trade has a fee.",
    body: "1.25% per trade. A fifth of it goes to the coin's creator as game rewards, the rest disappears from the game.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4">
        <Logo />
        <GamePill />
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="grid gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
          <div>
            <h1 className="font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              Launch a meme coin. Trade it with fake rand.
            </h1>
            <p className="mt-5 max-w-prose text-lg text-ink-dim">
              Meme Market is a free game for South Africans who are 18 or older. Pick a coin, watch
              the price move as people buy and sell, or launch your own for FR20.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/feed" className={cn(buttonVariants({ size: "lg" }))}>
                Take a look inside
              </Link>
              <p className="text-sm text-ink-dim">Sign-up opens with the closed beta.</p>
            </div>
          </div>

          <figure
            aria-label="Example coin card"
            className="rounded-[26px_20px_28px_18px] border border-night-3 bg-night-2 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-2xl font-extrabold">$BRAAI</p>
                <p className="text-sm text-ink-dim">Example coin, not live</p>
              </div>
              <p className="rounded-lg bg-night-3 px-2 py-1 text-sm font-semibold text-up">+48.2%</p>
            </div>

            <svg viewBox="0 0 300 100" role="img" aria-label="Price rising in steps" className="mt-4 h-28 w-full">
              <polyline
                points="0,88 22,84 40,86 62,74 80,78 104,64 126,68 148,52 170,58 196,38 218,46 246,24 270,30 300,12"
                fill="none"
                stroke="var(--color-up)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-ink-dim">Price per 1M shares</dt>
                <dd className="font-display text-xl font-bold">{EXAMPLE.price}</dd>
              </div>
              <div>
                <dt className="text-ink-dim">Market cap</dt>
                <dd className="font-display text-xl font-bold">{EXAMPLE.marketCap}</dd>
              </div>
            </dl>

            <div className="mt-4">
              <div
                role="progressbar"
                aria-label="Progress to graduation"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={EXAMPLE.progress}
                className="h-2.5 overflow-hidden rounded-full bg-night-3"
              >
                <div className="h-full rounded-full bg-taxi" style={{ width: `${EXAMPLE.progress}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-ink-dim">
                {EXAMPLE.progress}% of the way to graduating at {EXAMPLE.target}
              </p>
            </div>
            <figcaption className="mt-4 border-t border-night-3 pt-3 text-xs text-ink-dim">
              Game · FR has no cash value
            </figcaption>
          </figure>
        </section>

        <section aria-labelledby="rules-heading" className="border-t border-night-3 py-12">
          <h2 id="rules-heading" className="font-display text-2xl font-extrabold tracking-tight">
            The rules, plainly
          </h2>
          <ul className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {rules.map((rule) => (
              <li key={rule.title}>
                <p className="font-semibold">{rule.title}</p>
                <p className="mt-1 text-ink-dim">{rule.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl border-t border-night-3 px-4 py-8 text-sm text-ink-dim">
        <p>
          Meme Market is a game. FR is a game score, not money or property, and nobody should ever
          ask you to pay real money for FR, coins or accounts.
        </p>
      </footer>
    </div>
  );
}
