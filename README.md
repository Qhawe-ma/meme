# Meme Market

A free South African PWA where you launch meme coins and trade them with fake rand (FR). FR is a game score with no cash value.

## What it does today

This is the foundation, not a playable game.

- A landing page, plus five game screens: feed, launch, portfolio, leaderboard, and settings. The game screens are placeholders.
- A header label, "GAME · FR has no cash value", a bottom nav, and a web manifest so the site can be installed. There is no service worker.
- Economy defaults and `formatFR`, covered by unit tests.

There are no accounts, no ledger, and no trades. Sign-up is not open. The landing page links into the empty feed.

## Stack

- Next.js 16 (App Router), React 19, TypeScript in strict mode
- Tailwind CSS 4
- Postgres 16 and Drizzle, configured, with an empty schema
- Vitest, Playwright, ESLint, Prettier
- Node 22

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app boots without a database.

Postgres is only for later migrations:

```bash
cp .env.example .env.local
docker compose up -d
```

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Smoke tests, after installing a browser the first time:

```bash
npx playwright install chromium
npm run test:e2e
```

`PW_CHROMIUM_PATH` can point Playwright at a Chromium you already have.

## Environment

Copy `.env.example` to `.env.local`. Names only:

| Name | Read by |
| --- | --- |
| `DATABASE_URL` | `drizzle-kit`. The Next.js app does not open it. |
| `PW_CHROMIUM_PATH` | Playwright, optional. |

## Project structure

```
src/app/(marketing)    landing page
src/app/(game)         shell and placeholder screens
src/components         header, bottom nav, button
src/lib/config         economy defaults
src/lib/money          formatFR
src/server/db          Drizzle schema (empty)
public                 manifest and icons
tests/e2e              Playwright smoke tests
```

`Dockerfile` builds the standalone server (`node server.js`). Day-to-day work is `npm run dev`.

## Roadmap

In the order they have to land:

1. A double-entry ledger in Postgres. Balances change only through the ledger.
2. Accounts, an 18+ check, and one FR200 grant per verified person.
3. Bonding-curve quotes, and a per-coin contract row that is written once.
4. Launching a coin (FR20, burned) and trading against that contract.
5. A coin page with a chart, then the live feed, portfolio, and a weekly leaderboard. The board resets Monday 00:00 SAST. Balances do not.

## Design notes

- Amounts are integers in micro-FR (`1 FR = 1_000_000`). `formatFR` is the display path. No floating point.
- The signup grant is the only mint. Fees are 1.25% each way: 0.25 percentage points to the creator, the rest burned. There is no treasury to pay out.
- Graduation defaults to FR100,000 in the reserve. A `beta` preset uses FR2,000, because a small test will not fill the larger curve when everyone starts with FR200.
- Dark theme only. Fonts are self-hosted.

The longer version is in [docs/architecture.md](docs/architecture.md).
