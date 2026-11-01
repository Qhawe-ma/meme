import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { GamePill } from "@/components/layout/game-pill";
import { Logo } from "@/components/layout/logo";
import { formatFR } from "@/lib/money/format";
import { cn } from "@/lib/utils";

const rules = [
  {
    title: "FR is not money.",
    body: "It's a game score. You can't buy it, cash it out, or send it to a friend outside a trade.",
  },
  {
    title: "Everyone starts with FR200.",
    body: "One grant, after you verify your email and confirm you're 18 or older. No top-ups.",
  },
  {
    title: "Launch a coin for FR20.",
    body: "Image, name, ticker, a line of copy, and optional socials. The rules lock in when it goes live.",
  },
  {
    title: "Every trade has a 1.25% fee.",
    body: "0.25% goes to the coin's creator as claimable rewards. 1.00% goes to the platform treasury. Nothing is burned.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
        <Logo />
        <div className="ml-auto flex items-center gap-3">
          <Link href="/sign-in" className="text-sm font-semibold">
            Sign in
          </Link>
          <Link href="/sign-up" className={cn(buttonVariants({ size: "md" }), "hidden sm:inline-flex")}>
            Get FR200
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4">
        <GamePill />
      </div>

      <main className="mx-auto max-w-6xl px-4">
        <section className="grid items-center gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-taxi">South Africa · 18+ · free to play</p>
            <h1 className="mt-3 font-display text-[2.7rem] font-extrabold leading-[0.98] tracking-tight sm:text-6xl">
              Launch a meme coin. Trade it with fake rand.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-dim">
              Meme Market is a mobile game, not a market. Prices move when people buy and sell on a bonding curve.
              The rand is fake. The jokes are yours.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }))}>
                Get your FR200
              </Link>
              <Link href="/feed" className={cn(buttonVariants({ variant: "quiet", size: "lg" }))}>
                Browse the floor
              </Link>
            </div>
          </div>

          <figure className="card card-hover p-5" aria-label="Example coin card">
            <div className="flex items-center gap-3">
              <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-protea to-taxi font-display text-2xl font-extrabold text-night">
                B
              </div>
              <div>
                <p className="font-display text-2xl font-extrabold">Braai</p>
                <p className="text-sm text-ink-dim">$BRAAI · example, not live</p>
              </div>
              <p className="ml-auto rounded-full bg-up/15 px-2 py-1 text-sm font-bold text-up">+48%</p>
            </div>
            <svg viewBox="0 0 320 120" className="mt-4 h-32 w-full" role="img" aria-label="A rising example chart">
              <polyline
                points="0,96 28,90 48,92 78,70 108,74 140,52 168,58 200,36 230,42 268,18 320,10"
                fill="none"
                stroke="#3ddc97"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            <dl className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-ink-dim">Price / 1M</dt>
                <dd className="font-display text-xl font-bold">{formatFR(740_800n, { decimals: 4 })}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-dim">Market cap</dt>
                <dd className="font-display text-xl font-bold">{formatFR(740_850_000n)}</dd>
              </div>
            </dl>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-night">
              <div className="h-full w-[5.43%] rounded-full bg-taxi" />
            </div>
            <p className="mt-2 text-xs text-ink-dim">5.4% of the way to graduating. Example from the beta curve.</p>
            <figcaption className="mt-4 border-t border-white/10 pt-3 text-xs font-semibold text-taxi">
              Game · FR has no cash value
            </figcaption>
          </figure>
        </section>

        <section className="grid gap-4 py-6 sm:grid-cols-3">
          {[
            ["1", "Verify", "Email, date of birth, and the terms. Then FR200, once."],
            ["2", "Trade or launch", "Buy shares as the price climbs, or launch your own coin for FR20."],
            ["3", "Claim rewards", "Creators take 0.25% of the fee. Press Claim when you want it in your balance."],
          ].map(([step, title, body]) => (
            <article key={step} className="card p-5">
              <p className="font-display text-3xl font-extrabold text-taxi">{step}</p>
              <h2 className="mt-2 font-display text-xl font-extrabold">{title}</h2>
              <p className="mt-2 text-sm text-ink-dim">{body}</p>
            </article>
          ))}
        </section>

        <section className="py-10">
          <h2 className="font-display text-3xl font-extrabold">The rules, plainly</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {rules.map((rule) => (
              <li key={rule.title} className="card p-5">
                <p className="font-semibold">{rule.title}</p>
                <p className="mt-1 text-sm text-ink-dim">{rule.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap gap-4 border-t border-white/10 px-4 py-8 text-sm text-ink-dim">
        <p>Meme Market is a game. Nobody should ever ask you to pay real money for FR, coins or accounts.</p>
        <Link href="/legal/terms" className="underline">
          Terms
        </Link>
        <Link href="/legal/privacy" className="underline">
          Privacy
        </Link>
        <Link href="/legal/rules" className="underline">
          Rules
        </Link>
      </footer>
    </div>
  );
}
