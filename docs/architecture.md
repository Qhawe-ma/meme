# Architecture

Meme Market is a Next.js app at foundation stage. This note describes the code that exists, and the rules the rest of the game has to follow. The five game screens are placeholders.

## App

Two route groups:

- `(marketing)` is the landing page.
- `(game)` is the mobile shell: a sticky header, the game label, and a five-tab bottom nav. Content sits in a `max-w-xl` column.

The theme is dark. Night indigo for the ground, taxi yellow for the game sticker, protea pink for the primary action. Headings are Bricolage Grotesque and body text is Figtree, both self-hosted with Fontsource, so a page view stays on our origin.

`public/manifest.webmanifest` is enough to install the site. There is no service worker. Caching a balance for offline use can wait until a screen needs to work offline.

The example coin on the landing page (`$BRAAI`, about 5% of the way to FR2,000) is a static figure from the beta curve. It is labelled as such.

## Money

Every amount is an integer in micro-FR. `UFR` is `1_000_000n`, so FR12.35 is `12_350_000n`. `formatFR` prints that with bigint half-up rounding and thousands separators. A negative amount that rounds to zero prints as `FR0.00`.

Defaults live in `src/lib/config/economy.ts`. The unit tests and the formatter are the only code that import them.

| | Default | Beta preset |
| --- | --- | --- |
| Signup grant | FR200, once | same |
| Coin creation fee | FR20, burned | same |
| Buy fee and sell fee | 1.25% | same |
| Creator's share of that fee | 0.25 percentage points | same |
| Burned share of that fee | 1.00 percentage points | same |
| Supply | 1,000,000,000 shares, 80% on the curve | same |
| Graduation reserve | FR100,000 | FR2,000 |
| Max position | 5% of supply | 10% |
| First minute, buy cap for everyone but the creator | FR20 | FR10 |

The signup grant is the only way new FR comes into the game. A daily bonus would keep printing it, and it would pay someone for opening another account every day. Supply is grants minus burns.

The creator's reward is taken out of the 1.25% fee. The rest of the fee is burned, so there is no treasury balance waiting to be paid out. A round trip costs more than the creator earns back, which means trading your own coin does not farm rewards.

FR100,000 in a single reserve is large when each player starts with FR200. A small beta will not get there, and one grant barely moves that curve. The beta preset sets graduation at FR2,000 for that case. A coin should store the numbers it launched with, so changing the defaults later leaves old coins alone. That storage is still to be built.

The virtual FR reserve is the graduation target divided by 4. On a constant-product curve, once 80% of the curve supply is sold, the real reserve equals the target. `src/lib/config/economy.test.ts` checks that identity for both presets.

## Data

`docker-compose.yml` runs Postgres 16 for local migrations. Drizzle points at `src/server/db/schema.ts`, which exports nothing. `npm run dev` does not open a connection. `drizzle-kit` reads `DATABASE_URL` and refuses to start without it.

## Rules the rest of the build has to keep

Nothing in the database enforces these yet. They are the constraints the ledger and the trade path have to respect.

- FR is a score. Players cannot buy it, cash it out, or send it to each other. It moves when someone trades against a coin, and when a creator claims rewards.
- A bailout (top up to FR20 when net worth is under FR5, at most once every 14 days) is in the config and stays off.
- Launching a coin writes a contract row: curve inputs, fees, supply, and the position cap, once. "Contract" means that row, stored on our servers. The coin page has to say so in plain language.
- A fill is integer math from that row. `economy.ts` supplies the numbers when a coin is created. Fills read the contract row.
- `GAME · FR has no cash value` stays on every page, including the trade sheet, onboarding, the coin page, and the terms, when those exist. Copy stays off words like invest, returns, profit, and earn money.
- Play is for people 18 and over. The grant is one per verified person, after a phone check.

The ledger should be double-entry. The application database role should have no `UPDATE` on balances, ledger rows, or contract rows. Until those tables exist, that is the plan, not a control.
