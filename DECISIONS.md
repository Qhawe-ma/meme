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
