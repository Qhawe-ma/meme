# Decisions

Anything the spec left open, or where I chose between options. Newest at the bottom.

## M0

### Pinned versions (latest stable on 2026-10-29)

| Package | Version |
|---|---|
| node (engines) | >= 22 (built on 22.22.2) |
| next | 16.4.3 |
| react / react-dom | 19.3.1 |
| typescript | 6.0.3 (7.0.2 is out, but typescript-eslint does not support it yet, so lint crashes. Move to 7.x once typescript-eslint does.) |
| tailwindcss / @tailwindcss/postcss | 4.3.3 |
| eslint / eslint-config-next | 10.13.0 / 16.4.3 |
| prettier | 3.9.10 |
| vitest | 5.0.5 |
| @playwright/test | 1.64.1 |
| drizzle-orm / drizzle-kit | 0.45.4 / 0.31.11 |
| postgres (driver) | 3.4.9 |
| lucide-react | 1.64.0 |
| class-variance-authority / tailwind-merge / clsx | 0.7.1 / 3.7.0 / 2.1.1 |
| @fontsource-variable/bricolage-grotesque, figtree | 5.3.0 |

Postgres 16 and Redis 7 run from docker-compose.

### Calls made

1. **shadcn/ui by hand.** The shadcn CLI pulls from a remote registry, so I added `components.json`, `cn()`
   and wrote the Button in the same style. More components get added the same way when a screen needs one.
2. **No service worker yet.** The spec names Serwist, but M0 only needs an installable manifest, and an
   offline cache of a money screen is a bad thing to get wrong. Serwist comes in with the first screen that
   benefits from it (planned M7). Revisit before the beta.
3. **Dark mode only.** The spec says dark by default. A light theme is not in any milestone, so I did not build one.
4. **Fonts are self-hosted** via Fontsource (Bricolage Grotesque for headings, Figtree for text). No requests to Google at runtime, which also helps POPIA.
5. **`formatFR` rounds half up**, shows 2 decimals by default and uses commas for thousands (matches the spec's "FR100,000"). Options: `decimals` (0 to 6) and `trimWhole`.
6. **Landing call to action** goes to `/feed` ("Take a look inside"), because sign-up is M2. It will change to the sign-up link then.
7. **Header balance and freeze banner** are left out of `(game)/layout.tsx` until there is a ledger (M1) and accounts (M2). Showing a fake balance would be wrong.
8. **`tsconfig` has `noUncheckedIndexedAccess`** on, on top of strict. Cheap to start with and painful to add later.
9. **`next start` with `output: "standalone"`** prints a warning. The Docker image runs `node server.js` as intended; CI uses `next start` for e2e only.
10. **Example coin on the landing page** uses the spec's worked beta example (table B) and is labelled "Example coin, not live".

## Product build

11. **Trade fees are not burned.** The owner overrode the spec: 1.25% on every buy and every sell, of which 0.25 percentage points are claimable creator rewards and 1.00 percentage point is credited to a single `PLATFORM_TREASURY` ledger account. The FR20 create fee and the 5% graduation fee go to that same account. Nothing is burned, and there is no BURN account. The treasury cannot be withdrawn. Identity: minted FR equals player cash + pending creator rewards + coin reserves + platform treasury.
12. **Email verification is the grant gate.** The owner set email verification as the minimum. Phone OTP is not required before the FR200 grant. One grant per user still holds. Disposable email domains are blocked. A third grant on the same device cookie, or a fourth grant from the same /24 in 24 hours, is held instead of paid. Phone columns remain on the profile for a later OTP adapter.
13. **Sessions are first-party.** Email and password, verification, reset, and httpOnly sessions are implemented in the app rather than Better Auth. The mail sender is provider-agnostic: console plus an `email_messages` capture when `EMAIL_CAPTURE=true` or outside production, and optional SMTP (Mailpit on port 1025, or any authenticated SMTP host).
14. **Candles are written in the trade transaction.** A single Node host does not need a second process for the chart to be right. `scripts/worker.mjs` still rechecks the ledger identity every minute, and the web process does the same.
15. **Uploads stay on local disk** (`data/uploads`, or `UPLOAD_DIR`) and are re-encoded with sharp. There is no R2 in this build. Coin images are served from `/api/media/:key`.
16. **Turnstile, Safe Browsing, PostHog and Sentry are off unless their env vars are set.** The human check is skipped when `TURNSTILE_SECRET` is empty so signup works in dev and in CI.
17. **Admin ban does not move FR.** Hiding a coin, suspending, and banning are single-operator actions. Ban deletes sessions and blocks play. Clawback stays behind the two-admin request check. Unfreeze, economy preset and bailout run only through `execute_admin_request`, which the database rejects unless a different admin approved it.
18. **`app_rw` cannot `SELECT … FOR UPDATE` ledger accounts** without UPDATE privilege, which it must not have. `lock_ledger_account()` is a security-definer function that takes the row lock for the caller's transaction.
19. **Drizzle remains configured; runtime queries use postgres.js.** Money paths need explicit locks, numeric `k` (the curve constant does not fit in int8), and trigger-owned balance updates. `drizzle.config.ts` still points at the schema module.
20. **Rate limits are in memory.** Right for one VPS process. End-to-end tests set `RATE_LIMIT_DISABLED=1` so the scripted buy/sell is not blocked by the 3 second same-coin cooldown. Do not set that flag in production.
21. **Loopback addresses do not count toward the /24 grant hold.** 127.0.0.1 and ::1 are the developer's own machine, not a carrier NAT. The device-cookie hold still applies.
