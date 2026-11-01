# Meme Market

A free mobile-first game (installable PWA) for South Africans 18 and over. Launch meme coins and trade them
with **fake rand (FR)**, which has **zero cash value**. No real money, no crypto.

The full design is in [BUILD_SPEC.md](./BUILD_SPEC.md). Decisions the spec left open are in [DECISIONS.md](./DECISIONS.md).

## Run it locally

```bash
cp .env.example .env.local
docker compose up -d     # Postgres 16 + Redis 7
npm install
npm run dev              # http://localhost:3000
```

## Checks

```bash
npm run lint
npm run typecheck
npm test                 # unit tests (Vitest)
npm run build
npx playwright install chromium   # first time only
npm run test:e2e         # smoke tests at 360, 390 and desktop widths
```

## Status

Built milestone by milestone (spec section 21). Currently: **M0 Foundation**.
