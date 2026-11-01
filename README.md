# Meme Market

A free mobile-first game (installable PWA) for South Africans 18 and over. Launch meme coins and trade them
with **fake rand (FR)**, which has **zero cash value**. No real money, no crypto.

The design is in [BUILD_SPEC.md](./BUILD_SPEC.md). The fee override and other calls are in [DECISIONS.md](./DECISIONS.md).

Everyone who verifies their email and is 18 or older receives **FR200 once**. Launching a coin costs **FR20**. Buys and sells pay a **1.25%** fee: **0.25** percentage points to the coin's creator (claim it on Portfolio) and **1.00** percentage point to the platform treasury. Nothing is burned. Graduation defaults to **FR100,000** in the curve. A **beta** preset (FR2,000) is in `src/lib/config/economy.ts` and can be selected at migration time.

## Run it locally

You need Node 22 and Postgres 16.

```bash
cp .env.example .env.local
# If you use Docker for Postgres (and optionally Mailpit):
docker compose up -d
# Mailpit inbox (optional): docker compose --profile mail up -d
# then set SMTP_HOST=127.0.0.1 and SMTP_PORT=1025

npm install
npm run db:migrate
npm run dev          # http://localhost:3000
```

`DATABASE_URL` is the low-privilege `app_rw` role. `MIGRATOR_DATABASE_URL` is the superuser that creates tables, triggers and `app_rw`. The sample passwords in `.env.example` are for a laptop only.

Without SMTP, verification and reset links are printed in the server console. With `EMAIL_CAPTURE=true` they are also stored in `email_messages`.

Sign up, open the link, and you have FR200. Launch a coin from the **+** tab. Buy and sell on the coin page. Claim creator rewards on Portfolio.

To seed the small beta economy (graduation at FR2,000) on an empty database:

```bash
ECONOMY_PRESET=beta npm run db:migrate
```

Changing the preset later needs a second admin and `execute_admin_request`. Emails in `ADMIN_EMAILS` become admins when they sign up. The admin screen is `/admin`.

## Checks

```bash
npm run lint
npm run typecheck
npm test                 # unit tests, curve properties, ledger identity; DB tests if DATABASE_URL is set
npm run build
npx playwright install chromium
npm run test:e2e         # needs Postgres. Migrates, then runs the app.
```

## Deploy

The app is a long-running Node server (`output: "standalone"`), plus Postgres. Redis is optional. One process is enough for a small beta: it serves pages and rechecks the ledger every minute. You can also run `node scripts/worker.mjs` beside it.

### Docker

```bash
docker compose up -d          # Postgres
npm run db:migrate            # from the host, or a one-off container with the migrator URL
docker build -t meme-market .
docker run --rm -p 3000:3000 --env-file .env.local meme-market
```

Mount a volume at `/app/data/uploads` if you want coin images to survive a new container. Point `UPLOAD_DIR` at that directory.

Put TLS in front (Caddy, nginx, or the host's proxy). Set `APP_URL` to the `https://` origin so session cookies are marked Secure. Set `TRUST_PROXY=1` only when that proxy is the only thing that can reach the app.

### A small VPS (Hostinger or similar)

1. Create a VPS with Ubuntu 24.04. Install Node 22 and Postgres 16 (or point `DATABASE_URL` at a managed Postgres that lets you create roles).
2. Clone the repo, copy `.env.example` to `.env.local`, and replace every password, `IP_PEPPER`, and `APP_URL`.
3. Create the database and a superuser matching `MIGRATOR_DATABASE_URL`. `npm run db:migrate` creates `app_rw`.
4. `npm ci && npm run build`.
5. Run `node .next/standalone/server.js` under systemd (or `npm run start` from the repo). Set `PORT=3000` and `HOSTNAME=0.0.0.0`.
6. Proxy `https://your.domain` to port 3000. Open port 443 only.
7. Back up Postgres every day. The ledger is the game. Restoring it is the recovery path. There is no cash to refund because FR cannot be cashed out.

Do not expose Postgres to the internet. Do not run the app as the migrator role. Do not set `RATE_LIMIT_DISABLED`.

## Game rules that do not change

FR cannot be bought, topped up, cashed out, or sent between players outside a trade. The UI says it is a game. Terms ban selling FR for real money.
