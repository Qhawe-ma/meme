# Meme Market (fake rand): build spec — v2

A mobile-first web game (installable PWA) where South African players launch **meme coins** and trade them with **fake rand (FR)**, a play currency with **zero cash value**. Pump.fun-style mechanics, no real money, no crypto.

All numbers here (balances, fees, caps, curve parameters, timings) are **starting values to tune**. Nothing in this spec is a statistic or a promise of results. Day estimates are estimates.

**Fee override (v2.1, supersedes every "burn" sentence below):** 1.25% fee on every buy and every sell. **0.25 percentage points** go to the coin creator as claimable rewards. The remaining **1.00 percentage point** goes to a **PLATFORM_TREASURY** ledger account owned by the platform operator. The FR20 create fee and the 5% graduation fee also credit that treasury. **Nothing is burned.** There is no BURN account.

Global identity:

```
−balance(MINT) == Σ USER_CASH + Σ CREATOR_REWARDS + Σ COIN_RESERVE + balance(PLATFORM_TREASURY)
```

The treasury cannot be withdrawn, cashed out, or paid to a user. The admin dashboard shows its total. Where older paragraphs still say "burned", read them as "credited to the platform treasury".

**What changed in v2:** FR200 signup grant (the only default mint), FR20 to create a coin, graduation at FR100,000 (with a beta preset), 1.25% buy and sell fees (0.25 pp to creator as claimable rewards, 1.00 pp to the platform treasury), immutable versioned "coin contracts", socials on coins, a full trading chart (candles, volume, market cap, holders, trades, progress), a much stricter money-integrity design, and a step-by-step build plan.

---

## 0. Paste this prompt into your AI coding agent first

```text
You are building "Meme Market", a mobile-first responsive web game (PWA) specified in BUILD_SPEC.md (attached).
Players launch meme coins and trade them with FAKE RAND (FR), which has zero cash value.

HOW TO WORK
1. Read the whole spec first. Then build ONE milestone at a time, in order (M0, M1, M2 ...).
2. For each milestone do exactly the "Tasks", create the "Files", write the "Tests", and do NOT build anything
   listed under "Not yet".
3. At the end of each milestone: run lint, typecheck and all tests; paste the results; list every acceptance
   criterion with PASS or FAIL; tell me exactly how to try it locally; then STOP and wait until I type "next".
   If any criterion FAILs, fix it before asking for "next".
4. Never guess. If the spec is silent or ambiguous, choose the simplest option that keeps every hard rule,
   write it in DECISIONS.md, and tell me at the end of the milestone.
5. Use the exact stack, folder names, table names, endpoint paths, constants and formulas in the spec.
   Tunable defaults live in src/lib/config/economy.ts. Per-coin parameters come ONLY from that coin's
   immutable coin contract record, never from config at trade time.
6. Money: all FR amounts are integers in micro-FR (1 FR = 1_000_000 uFR), BIGINT in Postgres, BigInt in
   TypeScript. Never use floating point for money or curve math. Shares are integers.
7. Every FR movement goes through the double-entry ledger. Balances are changed ONLY by the ledger trigger.
   The app's database role must not be able to UPDATE balances, ledger rows or coin contracts.

HARD RULES (never break these, even if I ask later; tell me instead)
- Currency is "fake rand", shown as "FR". It has ZERO cash value.
- NO real-money top-ups. NO buying FR. NO cash-out, withdrawal or redemption of FR for money, vouchers,
  airtime, crypto, goods or anything of value.
- NO crypto, NO blockchain, NO wallets, NO on-chain tokens, NO NFTs. A "coin contract" is a database record.
- NO FR transfers between users outside trades. No send, gift, tip, P2P order book or escrow. FR moves
  between users only via trades against a coin's bonding curve/pool and via claimable creator rewards.
- FR can only be created by the mint events listed in the spec (signup grant; optional bailout flag).
  No admin, endpoint, script or migration may mint FR any other way.
- 18+ only. The UI is clearly labelled as a game: "GAME · FR has no cash value" in the header,
  trade sheet, onboarding, coin page and terms.
- No payment SDKs. No "invest", "returns", "earn money", "profit" wording in UI copy.
Start with M0 now.
```

---

## 1. Hard rules

| Rule | Enforced by |
|---|---|
| FR has zero cash value | Copy everywhere; terms: FR is a game score, not money or property, cannot be sold or redeemed. |
| No top-ups / buying FR | No payment code at all. Mint rules (§9.2) make any other mint impossible at DB level. |
| No cash-out | No withdrawal/redeem endpoints. Terms ban selling FR, coins or accounts for real money ("real-money trading"); report reason `real_money_offer`. |
| No crypto / on-chain | Postgres is the only source of truth. "Coin contract" = immutable DB record (§6). |
| No FR transfers outside trades | No send/gift/tip endpoints. Ledger trigger allows only whitelisted transaction kinds (§9.1). |
| Only fixed mint events | `SIGNUP_GRANT` (FR200, once per verified person) and `BAILOUT` (disabled by default). Enforced by DB trigger. |
| 18+ | DOB at onboarding; under-18 blocked; phone verification before grant. |
| Clearly a game | Persistent "GAME · FR has no cash value" pill. |

**Monetisation later (not in MVP), only via:** ads, sponsors, cosmetics / premium profile (no FR, no trading edge), brand-sponsored coin launches labelled "Sponsored", and sponsor-funded prizes run as free-to-enter promotional competitions compliant with the Consumer Protection Act (section 36) and its regulations. Lawyer review before any prize or payment.

---

## 2. Economy at a glance (defaults)

| Item | Default | Beta preset (small test) |
|---|---|---|
| Signup grant (only mint) | FR200 once per verified person | same |
| Daily bonus | **removed** | removed |
| Bailout | feature flag, **off** (FR20 top-up if net worth < FR5, once per 14 days) | consider turning on |
| Create coin | FR20, to the platform treasury | same |
| Buy fee / sell fee | 1.25% / 1.25% | same |
| Fee split | 0.25 pp → creator rewards (claimable), 1.00 pp → platform treasury | same |
| Total supply per coin | 1,000,000,000 shares | same |
| Curve supply (sold before graduation) | 800,000,000 (80%) | same |
| Graduation target (real FR in reserve, after fees) | **FR100,000** | **FR2,000** |
| Virtual FR reserve x0 (= target ÷ 4) | FR25,000 | FR500 |
| Virtual shares y0 | 1,000,000,000 | same |
| Start price / start market cap | FR25.00 per 1M shares / FR25,000 | FR0.50 per 1M / FR500 |
| Price at graduation / market cap | FR625.00 per 1M / FR625,000 (25× start) | FR12.50 per 1M / FR12,500 |
| Max position per player per coin | 5% of supply (50M shares) | 10% (100M shares) |
| Launch protection | first 60 s: max FR20 per buy (non-creators) | first 60 s: max FR10 |
| Graduation fee | 5% of reserve, burned | same |

### 2.1 Design calls and why

- **FR200 grant is the only mint by default.** FR200 per player is a lot of fake money. A daily bonus would keep printing FR, inflate prices, reward multi-accounting every single day, and undercut the "FR is scarce" feel you want. So the daily bonus is removed. Total FR in the game = FR200 × verified players, minus burns. That also makes the money-integrity check simple (§9).
- **Bailout exists but is off.** If the beta shows many players stuck at zero and leaving, an admin can turn on a small bailout (FR20 once per 14 days when net worth < FR5, phone-verified only). Turning it on requires 2-person approval (§9.8). It's the only other mint kind the database allows.
- **Graduation bonus removed.** v1 minted FR10 to creators at graduation. Creators now earn only from creator rewards (fee share), so no extra mint is needed.
- **Fees burned, not sent to a treasury.** A treasury balance is a pile of FR that someone could be tempted (or tricked) into paying out, which is minting by another name. Burning is a one-way sink: the BURN account can only ever increase (DB trigger), so it can never become a source. It also offsets the signup mint so FR stays scarce.
- **Creator daily cap removed.** A creator earns 0.25 pp but every trade costs 1.25%. Even if one person controls every account trading their coin, each round trip loses 2.5% and earns back at most 0.5%, so wash trading to farm rewards always loses FR. The cap was only needed for that. The real abuse (multi-accounts funnelling FR to a main account) is handled by sybil detection, which freezes reward claims for flagged accounts (§9.6).
- **FR100,000 graduation is the default because you asked, but be aware:** with FR200 per player, graduating a coin needs at least 500 players' entire starting balances in one coin (100,000 ÷ 200). With a 5% position cap it also needs at least 16 different holders. With a few hundred players, coins will rarely or never graduate, and a FR200 buy moves the price only about 1.6%. **For a small beta (50–100 players), use the beta preset (FR2,000)**, where a FR50 buy moves the price about 20%. The preset is a single config switch, and every coin's contract records which values it launched with.
- **Max position cap** stops one player (or one funnelled account) owning a coin. A side effect: graduation needs at least 16 distinct holders by default (80% ÷ 5%) and 8 in beta, which also helps against fake graduations by sybils.

---

## 3. Core loop

1. Sign up (18+), verify email and phone → receive **FR200** (once).
2. Browse the feed (Trending / New / About to graduate / Graduated, King of the Hill pinned).
3. Buy shares of a coin; price rises with buys, falls with sells (bonding curve).
4. Launch your own coin for **FR20**: image, name, ticker, description, optional socials, optional initial buy. A **coin contract** is issued.
5. Earn **creator rewards** (0.25% of every trade's FR value) on your coins; press **Claim** to move them to your balance.
6. Coin reaches its graduation target → graduates to a pool; trading continues.
7. Weekly leaderboards reset Monday 00:00 SAST (balances don't reset).

---

## 4. Economy constants (src/lib/config/economy.ts)

```ts
export const UFR = 1_000_000n; // 1 FR in micro-FR

export const PRESETS = {
  default: {
    GRADUATION_TARGET_UFR: 100_000n * UFR,   // FR100,000
    MAX_POSITION_BPS: 500n,                  // 5% of TOTAL_SUPPLY
    LAUNCH_PROTECTION_MAX_BUY_UFR: 20n * UFR,
  },
  beta: {
    GRADUATION_TARGET_UFR: 2_000n * UFR,     // FR2,000
    MAX_POSITION_BPS: 1000n,                 // 10%
    LAUNCH_PROTECTION_MAX_BUY_UFR: 10n * UFR,
  },
} as const;
// Active preset is read from system_settings.economy_preset (default 'default'); changing it needs 2-person approval.

export const ECON = {
  CONTRACT_VERSION: 'mm-curve-v1',
  SIGNUP_GRANT_UFR: 200n * UFR,              // the only default mint
  BAILOUT_TOPUP_TO_UFR: 20n * UFR,           // only if bailout enabled
  BAILOUT_THRESHOLD_UFR: 5n * UFR,
  BAILOUT_COOLDOWN_DAYS: 14,

  CREATE_FEE_UFR: 20n * UFR,                 // burned

  TOTAL_SUPPLY: 1_000_000_000n,
  CURVE_SUPPLY: 800_000_000n,                // 80% sold on the curve
  VIRTUAL_SHARES: 1_000_000_000n,            // y0
  // x0 (virtual FR) = GRADUATION_TARGET / 4  (because x_final = x0*y0/(y0-CURVE) = 5*x0)

  BUY_FEE_BPS: 125n,                         // 1.25%
  SELL_FEE_BPS: 125n,                        // 1.25%
  CREATOR_FEE_BPS: 25n,                      // 0.25 pp of trade value -> creator rewards
  PLATFORM_FEE_BPS: 100n,                    // 1.00 pp of trade value -> platform treasury
  GRADUATION_FEE_BPS: 500n,                  // 5% of reserve to the platform treasury at graduation

  LAUNCH_PROTECTION_SECONDS: 60,
  MIN_TRADE_UFR: 100_000n,                   // FR0.10
  MIN_CLAIM_UFR: 10_000n,                    // FR0.01
  DEFAULT_SLIPPAGE_BPS: 200n,                // 2%

  MAX_COINS_PER_USER_PER_DAY: 3,
  TRADE_RATE_LIMIT_PER_MIN: 20,
  SAME_COIN_COOLDOWN_SECONDS: 3,
  SOCIAL_EDITS_PER_DAY: 10,
  SEASON_MIN_TRADES_TO_RANK: 5,
  REPORTS_TO_AUTO_HIDE: 3,
} as const;
```

---

## 5. Bonding curve — exact spec

### 5.1 Model
Constant product with virtual reserves (pump.fun-style). Per coin, from its contract:
- `x0 = GRADUATION_TARGET / 4` (uFR), `y0 = 1,000,000,000` shares, `k = x0 · y0` (BigInt).
- State: `x` (uFR), `y` (shares), `sold = y0 − y`, `reserve = x − x0` (real FR held).
- **Spot price** = `x / y` FR per share; display as **FR per 1M shares** = `x · 1,000,000 / y` (in FR).
- **Market cap** = spot price × TOTAL_SUPPLY.
- **Graduation progress** = `reserve / GRADUATION_TARGET` (0–100%).
- When `sold = 800,000,000`: `x = k / 200,000,000 = 5 · x0`, so `reserve = 4 · x0 = GRADUATION_TARGET` exactly.

### 5.2 Buy (client sends gross FR to spend)
```
fee      = ceil(gross * BUY_FEE_BPS / 10_000)
creator  = floor(fee * CREATOR_FEE_BPS / BUY_FEE_BPS)     // = floor(fee/5)
burn     = fee - creator
net      = gross - fee
x_new    = x + net
y_new    = ceil(k / x_new)           // round so the pool keeps dust
shares   = y - y_new                 // require > 0
require holding + shares <= TOTAL_SUPPLY * MAX_POSITION_BPS / 10_000   else MAX_POSITION
require sold + shares <= CURVE_SUPPLY                                    else clip (5.4)
```

### 5.3 Sell (client sends shares)
```
y_new    = y + shares
x_new    = ceil(k / y_new)
gross    = x - x_new
fee      = ceil(gross * SELL_FEE_BPS / 10_000)
creator  = floor(fee / 5)
burn     = fee - creator
payout   = gross - fee               // require > 0
```
Creators pay fees and earn rewards on their own trades too (always net-negative for them, see §2.1).

### 5.4 Graduation clip
If a buy would push `sold` past CURVE_SUPPLY: `x_needed = ceil(k / (y0 − CURVE_SUPPLY))`, `net_needed = x_needed − x`, `gross_needed = ceil(net_needed · 10,000 / (10,000 − BUY_FEE_BPS))`; charge only `gross_needed` (fees computed on it), give exactly the remaining shares, then graduate in the same transaction.

### 5.5 Graduation
1. `grad_fee = floor(reserve · 500 / 10,000)` → BURN. Default: FR100,000 → FR5,000 burned.
2. `pool_fr = reserve − grad_fee` = FR95,000.
3. `pool_shares = floor(pool_fr · y / x)` at the graduation price = **152,000,000** shares (same in beta: FR1,900 ↔ 152M). Minted into the pool, not to any user. Total minted shares = 800M + 152M = 952M ≤ 1B; the rest are never minted.
4. `phase = 'pool'`: the same constant-product formulas apply with **real** reserves (`x = pool_fr`, `y = pool_shares`, new `k`). Pool price = 95,000 / 152M = FR625 per 1M, identical to the final curve price.
5. Position cap and fees unchanged. The coin gets a "Graduated" badge, a realtime event and a notification.

### 5.6 Worked examples (exact BigInt math, verified with a script)

**A. Default contract (graduation FR100,000).** Fresh coin: price FR25.0000 per 1M, market cap FR25,000.

| # | Action | FR | Shares | Fee (creator / burn) | Price per 1M after | Market cap | Reserve |
|---|---|---|---|---|---|---|---|
| 1 | Thandi launches (pays FR20, burned), initial buy FR50 | −50.00 | +1,971,107 | 0.625 (0.125 / 0.500) | 25.0988 | 25,098.85 | 49.375 |
| 2 | Sipho buys FR200 (all-in) | −200.00 | +7,807,330 | 2.500 (0.500 / 2.000) | 25.4962 | 25,496.19 | 246.875 |
| 3 | Lebo buys FR150 | −150.00 | +5,775,805 | 1.875 (0.375 / 1.500) | 25.7962 | 25,796.24 | 395.000 |
| 4 | Thandi sells all | +50.111250 | −1,971,107 | 0.634320 (0.126864 / 0.507456) | 25.6932 | 25,693.25 | 344.254430 |
| 5 | Sipho sells all | +196.532705 | −7,807,330 | 2.487756 (0.497551 / 1.990205) | 25.2913 | 25,291.31 | 145.233969 |
| 6 | Lebo sells all | +143.418544 | −5,775,805 | 1.815425 (0.363085 / 1.452340) | 25.0000 | 25,000.00 | 0 |

Result: Thandi +FR0.11 on her trade, plus FR1.9875 of creator rewards to claim. Sipho −FR3.47, Lebo −FR6.58. Burned from fees: FR7.95 (+ FR20 creation fee). On the FR100,000 curve, FR400 of buys moves the price only about 3%, which is why the beta preset exists.

**B. Beta contract (graduation FR2,000, 10% cap).** Fresh coin: price FR0.5000 per 1M, market cap FR500. Max position 100M shares, which costs FR56.26 on a fresh coin.

| # | Action | FR | Shares | Fee (creator / burn) | Price per 1M after | Market cap | Progress |
|---|---|---|---|---|---|---|---|
| 1 | Thandi launches (FR20 burned), initial buy FR20 | −20.00 | +37,999,037 | 0.250 (0.050 / 0.200) | 0.5403 | 540.28 | 0.99% |
| 2 | Sipho buys FR50 | −50.00 | +83,459,342 | 0.625 (0.125 / 0.500) | 0.6478 | 647.81 | 3.46% |
| 3 | Lebo tries FR100 | **rejected `MAX_POSITION`**: 129,898,536 shares > 100M | — | — | — | — | — |
| 4 | Lebo buys FR40 | −40.00 | +57,017,694 | 0.500 (0.100 / 0.400) | 0.7408 | 740.85 | 5.43% |
| 5 | Thandi sells all | +26.570638 | −37,999,037 | 0.336338 (0.067267 / 0.269071) | 0.6768 | 676.79 | 4.09% |
| 6 | Sipho sells all | +50.841813 | −83,459,342 | 0.643568 (0.128713 / 0.514855) | 0.5623 | 562.29 | 1.51% |
| 7 | Lebo sells all | +29.854734 | −57,017,694 | 0.377909 (0.075581 / 0.302328) | 0.5000 | 500.00 | 0% |

Result: Thandi +FR6.57 plus FR0.546561 of creator rewards, Sipho +FR0.84, Lebo −FR10.15. Early buyers win and late buyers lose. That's fine in a free game, and it's why the copy must never suggest this is a way to make money.

**C. Reference numbers.** Default: FR1,332.45 gross buys the 5% cap on a fresh coin; graduation reserve FR100,000 → 5,000 burned → pool FR95,000 + 152M shares. Beta: graduation reserve FR2,000 → 100 burned → pool FR1,900 + 152M shares.

These three tables are the **golden tests** in M3.

### 5.7 Invariants (tests + continuous checker)
- Curve phase: `x · y ≥ k` (rounding only increases k); `sold ≤ CURVE_SUPPLY`; minted shares ≤ TOTAL_SUPPLY.
- `coin.reserve_ufr == balance(COIN_RESERVE account)`.
- `Σ holdings.shares == sold` (curve) / `== 800M + pool_shares_minted − pool_y` (pool).
- No holding exceeds the contract's position cap.
- Global money identity, §9.4.

---

## 6. Coin contracts (immutable, versioned — NOT a blockchain smart contract)

**Plain English:** on pump.fun every coin has a smart contract on a blockchain. Meme Market has no blockchain. Instead, when a coin launches, the server writes a **coin contract record**: the exact rules that coin trades by (curve numbers, fees, split, supply, cap, creator, time). It can never be edited. Its fingerprint (a SHA-256 hash) is shown on the coin page so anyone can check the rules haven't changed. It's a promise the server enforces, not code running on a public chain. The UI must say: *"Coin contract: the fixed rules this coin trades by, stored on Meme Market's servers. Not a blockchain smart contract."*

### 6.1 Record
```json
{
  "version": "mm-curve-v1",
  "coin_id": "0192f3c1-...",
  "ticker": "BRAAI",
  "creator_user_id": "0192f3a0-...",
  "created_at": "2026-10-29T08:15:02.123Z",
  "unit": "uFR",
  "total_supply": "1000000000",
  "curve_supply": "800000000",
  "virtual_fr_ufr": "25000000000",
  "virtual_shares": "1000000000",
  "graduation_target_ufr": "100000000000",
  "buy_fee_bps": 125, "sell_fee_bps": 125,
  "creator_fee_bps": 25, "burn_fee_bps": 100,
  "graduation_fee_bps": 500,
  "max_position_bps": 500,
  "launch_protection_seconds": 60,
  "launch_protection_max_buy_ufr": "20000000",
  "rounding": "fee_ceil;creator_floor;reserve_ceil",
  "prev_contract_hash": "<sha256 of the previous contract>"
}
```
- `params_hash = sha256(JCS(record))`, where JCS = RFC 8785 canonical JSON (npm `canonicalize`). Big numbers are strings.
- `contract_id` = `MMC-` + first 16 hex chars of `params_hash`, uppercased (e.g. `MMC-3FA91C07D2E4B610`). The full hash is shown under "Show full hash".
- `prev_contract_hash` links all contracts into one **append-only hash chain**: editing any old row breaks every hash after it. A nightly job verifies the chain; `/contracts` publicly shows the latest chain-head hash per day.

### 6.2 Immutability (defence in depth)
1. No UPDATE/DELETE path in code: no repository method, admin UI or endpoint.
2. DB trigger `BEFORE UPDATE OR DELETE OR TRUNCATE ON coin_contracts → RAISE EXCEPTION 'coin contracts are immutable'`.
3. App DB role: `GRANT SELECT, INSERT` only; `REVOKE UPDATE, DELETE, TRUNCATE`.
4. `coins.contract_id` is set once at go-live; a trigger blocks any change after that.
5. The trade engine recomputes the hash from stored `params` when it loads a coin (cached by hash) and **refuses to trade**, freezes that coin and alerts on a mismatch.
6. The trade engine reads curve/fee/cap params only from the contract, never from config.
7. Contract creation is written to the audit log.
8. Changing defaults affects **new** coins only; the new contract shows the new values.

### 6.3 Coin page "Coin contract" panel
Contract ID (copy button), version, creator handle, created time (SAST), key params in plain words ("Buy fee 1.25% · Sell fee 1.25% · Creator gets 0.25% · 1.00% burned · Graduates at FR100,000 · Max hold 5%"), the full hash, a **Verify** button that recomputes SHA-256 in the browser (Web Crypto) from the displayed JSON and shows match or mismatch, and the not-a-blockchain sentence.

---

## 7. Coin creation, description and socials

Create form: image (required), name (2–32 chars), ticker (3–8, A–Z0–9, unique, reserved list), description (optional, ≤ 500 chars), socials (all optional), initial buy (optional, ≥ FR0.10, subject to position cap and the balance left after the FR20 fee).

### 7.1 Social link rules (validated server-side with Zod; normalised before storage)

| Kind | Accepted input | Stored (normalised) | Handle rule |
|---|---|---|---|
| X | `x.com/h`, `twitter.com/h`, `@h` | `https://x.com/<h>` | `^[A-Za-z0-9_]{1,15}$` |
| TikTok | `tiktok.com/@h`, `@h` | `https://www.tiktok.com/@<h>` | `^[A-Za-z0-9._]{2,24}$` |
| Instagram | `instagram.com/h`, `@h` | `https://www.instagram.com/<h>` | `^[A-Za-z0-9._]{1,30}$` |
| Telegram | `t.me/h`, `telegram.me/h` | `https://t.me/<h>` | `^[A-Za-z0-9_]{5,32}$` (public usernames only; no `+` invite links) |
| WhatsApp channel | `whatsapp.com/channel/<id>` | `https://whatsapp.com/channel/<id>` | `^[A-Za-z0-9]{10,40}$` (channel links only; no `wa.me` phone links) |
| Website | any `https://` URL | lowercase host, no fragment, ≤ 200 chars | see 7.2 |

Reject: `http://`, userinfo (`user@host`), IP-address hosts, localhost/private TLDs, explicit ports, punycode (`xn--`) hosts, URL shorteners (`src/server/links/shorteners.txt`), `javascript:`/`data:` schemes, and any host outside the kind's allow-listed domains (except Website). Handle regexes are starting values; adjust if a platform's rules differ.

### 7.2 Link-safety checks
- Website URLs are checked against Google Safe Browsing (Lookup API v4) or Google Web Risk at save time and re-checked daily by a job. Unsafe → link hidden, coin flagged for review.
- Own domain blocklist (`src/server/links/blocked-domains.txt`) for scam, betting and real-money-trading sites; add domains as reports come in.
- **The server never fetches user URLs** (prevents SSRF). No link previews in the MVP.
- Rendering: `rel="nofollow noopener noreferrer ugc"`, `target="_blank"`, and an interstitial on first click: "You're leaving Meme Market. Links are added by coin creators. Never pay anyone real money for FR, coins or accounts."
- Description: text moderation (§11); no URLs (socials only), phone numbers, emails or SA ID numbers.

### 7.3 Editing
- Only the coin's creator can edit description and socials. Contract params are never editable.
- `PATCH /api/coins/:ticker/socials`, max 10 edits/day, every edit re-validated and re-moderated.
- Every change is written to append-only `coin_link_edits` (old, new, editor, time, ip_hash). The coin page shows "Socials edited N times · View history" (values and timestamps only, no IPs).
- Admins can lock a coin's socials (single-admin action: reversible and only restricts).

---

## 8. Charts and market data

### 8.1 Coin page market panel
- **Candlestick chart** (TradingView `lightweight-charts`), timeframes **1m, 5m, 15m, 1h, 1d**, with a **Price / Market cap** toggle (market cap = price × 1B, same candles scaled).
- **Volume bars** under the candles (own price scale), coloured by buy-dominant vs sell-dominant bucket.
- Header stats: price (FR per 1M), market cap, 5m/1h/24h change, 24h volume, holder count, lifetime creator rewards.
- **Bonding-curve progress bar**: `reserve / graduation_target`, e.g. "FR41,250 / FR100,000 (41.3%) to graduation"; after graduation shows pool info.
- **Holders list** (top 20): handle, % of supply, "dev" tag for the creator, plus a "Bonding curve" row with unsold curve shares (or "Pool" after graduation). Holder count = rows with shares > 0.
- **Trades feed**: last 50 trades live (time, handle, buy/sell, FR, shares, price), scroll for older.
- **Coin contract** panel (§6.3) and **Socials** row.

### 8.2 OHLC aggregation
- Candle trade price = spot price **after** the trade (`price_after_ufr_per_1m`). The first candle opens at the contract's start price.
- Each trade gets a global, increasing `trade_seq BIGINT` (identity column) inside the trade transaction.
- Table `candles(coin_id, interval, bucket_start, open, high, low, close, volume_ufr, buy_volume_ufr, sell_volume_ufr, trades, first_seq, last_seq)`, PK `(coin_id, interval, bucket_start)`, prices in uFR per 1M shares.
- Buckets: 1m/5m/15m/1h on UTC boundaries; 1d on **SAST midnight** (`date_trunc('day', ts AT TIME ZONE 'Africa/Johannesburg')`).
- **Writer:** worker job `candles` consumes trade events from `outbox` in `trade_seq` order (one consumer, or per-coin Postgres advisory locks) and upserts all 5 intervals:
  ```sql
  INSERT INTO candles AS c (...) VALUES (...)
  ON CONFLICT (coin_id, interval, bucket_start) DO UPDATE SET
    high  = GREATEST(c.high, EXCLUDED.high),
    low   = LEAST(c.low, EXCLUDED.low),
    close = EXCLUDED.close,
    volume_ufr = c.volume_ufr + EXCLUDED.volume_ufr,
    buy_volume_ufr = c.buy_volume_ufr + EXCLUDED.buy_volume_ufr,
    sell_volume_ufr = c.sell_volume_ufr + EXCLUDED.sell_volume_ufr,
    trades = c.trades + 1,
    last_seq = EXCLUDED.last_seq
  WHERE EXCLUDED.last_seq > c.last_seq;   -- replaying an old event is a no-op (idempotent)
  ```
- **Rebuild:** `npm run candles:rebuild -- --coin <id>` recomputes from `trades` (the source of truth). The nightly job spot-checks 20 random coins: rebuilt == stored.
- Retention: 1m candles 30 days; others forever.
- Gaps: the API returns only buckets with trades; the client draws flat candles at the previous close with zero volume.
- `GET /api/coins/:ticker/candles?tf=5m&from=&to=&limit=500` → `{ tf, candles: [{ t, o, h, l, c, v, bv, sv }] }` (prices as decimal strings, FR per 1M).

### 8.3 Realtime (SSE)
`GET /api/stream?topics=feed,coin:<id>,me`. Events:
- `trade` `{ coinId, seq, side, handle, frUfr, shares, priceUfrPer1m, at }`
- `candle` `{ coinId, tf, bucket, o, h, l, c, v }` for the current bucket of each timeframe (max 2/s per coin)
- `coin.stats` `{ coinId, priceUfrPer1m, marketCapUfr, reserveUfr, progressBps, holders }`
- `holders` `{ coinId, top: [...] }` (max once per 5 s)
- `coin.new`, `coin.graduated`, `me.balance`, `me.rewards`, `notification`, `heartbeat` (every 25 s)
- Reconnect with `Last-Event-ID` (= seq); on a gap the client refetches stats, the last 50 trades and current candles.

---

## 9. Money integrity ("un-hackable" as far as anything can be)

**Honest framing:** nothing connected to the internet is literally un-hackable. The goal is that (a) FR can only appear through a tiny set of mint events the **database itself** enforces, (b) any bug or attack that breaks the books is detected within about a minute and trading freezes automatically, and (c) every change is traceable. The main expected attack is **multi-accounting** to collect many FR200 grants, so signup controls matter as much as code.

### 9.1 Ledger design
- Accounts (`ledger_accounts.kind`): `MINT` (one row, the only source; the only account allowed to go negative), `BURN` (one row; can only increase), `USER_CASH` (one per user), `CREATOR_REWARDS` (one per user; pending claimable rewards), `COIN_RESERVE` (one per coin).
- Every movement is a `ledger_transactions` row plus ≥ 2 `ledger_entries` that **sum to zero** (deferred constraint trigger checked at commit).
- `ledger_accounts.balance_ufr` is maintained **only** by an `AFTER INSERT` trigger on `ledger_entries`. The app role has **no UPDATE** on `ledger_accounts` and no UPDATE/DELETE on ledger tables.
- `CHECK (kind = 'MINT' OR balance_ufr >= 0)`; BURN entries must be positive (trigger).
- Allowed pattern per transaction kind (trigger `ledger_kind_rules`):

| Kind | Allowed entries (sum 0) |
|---|---|
| `SIGNUP_GRANT` | MINT −200 · USER_CASH(u) +200 |
| `BAILOUT` (only if enabled) | MINT −a · USER_CASH(u) +a, a ≤ FR20 |
| `COIN_CREATE_FEE` | USER_CASH −20 · BURN +20 |
| `TRADE_BUY` | USER_CASH −gross · COIN_RESERVE +net · CREATOR_REWARDS(creator) +c · BURN +b |
| `TRADE_SELL` | COIN_RESERVE −gross · USER_CASH +payout · CREATOR_REWARDS(creator) +c · BURN +b |
| `CREATOR_CLAIM` | CREATOR_REWARDS(u) −a · USER_CASH(u) +a (same user) |
| `GRADUATION` | COIN_RESERVE −fee · BURN +fee |
| `COIN_REMOVAL_SETTLE` | COIN_RESERVE −g · USER_CASH(holder) +g (fees waived) |
| `ADMIN_CLAWBACK` | USER_CASH or CREATOR_REWARDS −a · BURN +a (never the other way) |

There is **no** admin credit, adjust-up, gift or transfer kind. A user-to-user cash transfer is impossible because no kind allows USER_CASH(a) → USER_CASH(b).

### 9.2 Mint rules (enforced in the database)
- A trigger on inserts touching the MINT account allows them only if the tx kind is `SIGNUP_GRANT`, or `BAILOUT` while `system_settings.bailout_enabled` is true, and the amount equals the value in `mint_rules` (FR200 / ≤ FR20).
- `SIGNUP_GRANT`: partial unique index `UNIQUE (beneficiary_user_id) WHERE kind = 'SIGNUP_GRANT'`, plus `grant_claims.phone_hash` as primary key (one grant per verified phone number, ever). The trigger also checks the profile has `phone_verified_at`, verified email and `age_ok`.
- `mint_rules`: app role SELECT only; changed only by migration plus a 2-person-approved admin request; every change audited.
- Exactly one code path mints: `grantSignup(userId)` after phone verification, idempotency key `signup:<userId>`.

### 9.3 Transactions and concurrency
- Every money operation runs in one Postgres transaction (READ COMMITTED) with explicit `SELECT … FOR UPDATE` locks in a **fixed global order**: (1) coin row, (2) ledger accounts by ascending id, (3) holding row. Deadlock/serialization errors (`40P01`, `40001`) are retried up to 3 times with jitter.
- Idempotency: every mutating request needs an `Idempotency-Key` header (UUID). `trades UNIQUE(user_id, idempotency_key)`, `ledger_transactions UNIQUE(idempotency_key)`, and `idempotency_keys(user_id, key)` for other endpoints. Replays return the stored response; a concurrent duplicate hits the unique index and is answered from the stored row.
- **No client-trusted values:** the client sends only intent (`ticker`, `side`, `amountUfr` or `shares`, `minOut`). User id comes from the session. Price, fees, shares, payout and creator are computed on the server inside the lock from the coin contract and current reserves. UI quotes are advisory.
- Amount parsing: decimal strings of digits only → BigInt, `> 0`, `≤ 10^15`; reject signs, exponents, decimals, whitespace, unicode digits.

### 9.4 Global invariant (continuous)
```
−balance(MINT) == Σ USER_CASH + Σ CREATOR_REWARDS + Σ COIN_RESERVE + balance(PLATFORM_TREASURY)
−balance(MINT) == (number of SIGNUP_GRANT txs × 200) + Σ BAILOUT amounts
Σ all ledger_entries.amount_ufr == 0
each account: balance == Σ its entries
each coin: reserve == COIN_RESERVE balance; Σ holdings == sold (or pool formula); contract hash matches
```
- Worker job `invariants` runs the balance-level checks **every 60 seconds**, a **full recompute from entries every hour**, and contract/audit chain checks nightly.
- On any violation: set `system_settings.trading_frozen = true` (trades, claims, launches and grants return `503 FROZEN`; the UI shows "Market paused for maintenance"), write `integrity_incidents` with the diff, and alert you (Sentry alert + email/Telegram webhook to your phone). Unfreezing needs 2-person approval (§9.8) after investigation.
- Per-coin violation (hash mismatch, holdings ≠ sold): freeze only that coin.

### 9.5 Signup abuse controls (FR200 makes multi-accounting the main attack)
- **One grant per verified person:** verified email + **phone OTP** (SMS or WhatsApp via a provider such as Twilio Verify; check current SA pricing, each verification costs money) + 18+ DOB + Turnstile. Phone stored as `sha256(E.164 + pepper)`; one grant per phone hash forever (deleting the account doesn't free the number).
- Block disposable email domains (maintained list) and, if your OTP provider offers line-type lookup, VoIP numbers.
- Device fingerprint: FingerprintJS (open-source visitor id) + httpOnly device cookie + localStorage id. More than 2 grants on one device → later grants held for manual review.
- IP velocity: more than 3 grants per /24 in 24 h → hold for review (campus/carrier NAT is common, so hold, never auto-ban).
- Unverified accounts can browse and see prices but can't trade until the grant lands.

### 9.6 Sybil and funnelling detection
With no transfers, the way to move FR between your own accounts is through trades: alts buy a coin the main account holds or created, then the main sells. Detection job every 15 min:
- **Clusters:** shared device ids or fingerprints, the same /24 with close signup times, similar phone-number patterns.
- **Funnel score:** for each pair (A, B), the FR value of B's buys followed within 10 min by A's sells on the same coin, divided by B's total buys. High score inside a cluster → flag.
- **Creator self-dealing:** share of a coin's buy volume coming from accounts clustered with its creator.
- Flagged (`sybil_suspect`): hidden from leaderboards, trending and future prizes; **creator reward claims frozen**; grants for new cluster members held. Admin review: clear or confirm. Confirm → ban alts, force-sell their holdings, `ADMIN_CLAWBACK` their cash and pending rewards to BURN (2-person approval).

### 9.7 Rate limits and bots
Redis sliding windows per user **and** per IP: trades 20/min (3 s per coin), launches 3/day, social edits 10/day, claims 10/hour, reports 20/day, OTP sends 3/hour per phone and 10/day per IP, signups 5/hour per IP. Over the limit → 429 with `retry_after_s`. Turnstile on signup, OTP and launch. Launch protection (first 60 s) and max position come from the contract.

### 9.8 Admin security
- Admin role with mandatory **2FA (passkey/WebAuthn or TOTP)**, 30-minute idle sessions, and re-authentication within 5 minutes for any request or approval. Optional admin IP allowlist.
- **2-person approval** through `admin_requests` (requested_by, action, payload, reason, status, approved_by, approved_at, executed_at, expires_at = 24 h). The approver must be a different admin (DB CHECK); the server executes only after approval. Required for: ban + clawback, any `ADMIN_CLAWBACK`, enabling bailout or changing `mint_rules`, switching economy preset, changing default fees for new coins, unfreezing trading, granting admin/moderator roles, force-settling a coin.
- Single-admin actions (reversible and only restrict): hide a coin, lock socials, temporary suspension, dismiss reports.
- Admins **cannot** mint, credit balances, or edit contracts, trades or ledger rows. Those paths don't exist.
- `audit_log` is append-only with a **hash chain** (`row_hash = sha256(prev_hash || row)`), verified nightly.
- You'll need a second trusted admin (co-founder or friend) with their own 2FA. Until then, sensitive actions stay unavailable. Don't build a self-approval bypass.

### 9.9 Security baseline
TLS + HSTS; secure, httpOnly, SameSite=Lax cookies; CSRF protection (same-site cookies + `Origin` check); strict Content Security Policy (no inline scripts; images only from your R2 domain); React escaping, no `dangerouslySetInnerHTML`; uploads: magic-byte check, SVG banned, `sharp` with `limitInputPixels`, everything re-encoded; least-privilege DB roles; secrets in an env manager, never in the repo; dependency audit in CI (`npm audit`, Renovate); daily encrypted backups + monthly restore drill; SSE `me` topic requires the session; `X-Forwarded-For` trusted only from your own proxy.

### 9.10 Pen-test checklist (run before beta and before any public launch; record results in SECURITY.md)
- [ ] Race conditions: 100 parallel buys/sells/claims from one user → balances never negative, ledger identity holds.
- [ ] Idempotency replay: same key 20× concurrently → one effect.
- [ ] Amount fuzzing: negative, zero, decimals, `1e30`, `"NaN"`, huge BigInt, unicode digits, arrays/objects.
- [ ] Tampered fields: `price`, `fee`, `userId`, `creatorId`, `contractId` in bodies → ignored or rejected.
- [ ] IDOR: read/edit another user's portfolio, rewards, coin socials; reach admin endpoints as a player.
- [ ] Mint attempts: double grant, re-verify phone, delete + recreate account, bailout while disabled, parallel grant calls.
- [ ] As `app_rw`: UPDATE a balance; UPDATE/DELETE a contract or ledger row → permission denied.
- [ ] Contract tamper (superuser in a test DB): change a param → that coin freezes and an alert fires.
- [ ] Invariant break (superuser in a test DB): insert an unbalanced entry → global freeze within 60 s and alert.
- [ ] Auth: session fixation, password brute force lockout, OTP brute force (max 5 tries), reset-token reuse, OAuth state.
- [ ] Admin: privilege escalation, approving own request, expired request, missing 2FA re-auth.
- [ ] XSS in coin name/ticker/description/socials, handle, report text; CSP blocks injected scripts.
- [ ] Links: `javascript:`, punycode, shorteners, open redirects, unsafe domains.
- [ ] Uploads: polyglots, SVG, huge dimensions, EXIF GPS stripped.
- [ ] Rate-limit bypass via IP rotation or spoofed headers.
- [ ] SSE: subscribe to another user's `me` topic.
- [ ] SQL injection on search/filter params; OWASP ASVS level 1; dependency audit clean.
- [ ] Backup restore drill; secret rotation drill.
- Consider a paid external pen test or a small bug bounty before any prize exists.

---

## 10. Creator rewards

- Every trade credits `creator` uFR (0.25% of the trade value, from the fee) to the coin creator's `CREATOR_REWARDS` account inside the trade's ledger transaction. Per-coin totals are kept in `trades.fee_creator_ufr` and `coins.creator_rewards_lifetime_ufr` for display.
- `POST /api/creator-rewards/claim` (needs `Idempotency-Key`): locks the user's CREATOR_REWARDS and USER_CASH accounts (ascending id), moves the **whole** pending balance (≥ FR0.01) with a `CREATOR_CLAIM` ledger tx (`idempotency_key = claim:<userId>:<Idempotency-Key>`), returns `{ claimedUfr, cashUfr }`. Replays return the same response; a new claim with nothing pending returns `409 NOTHING_TO_CLAIM`.
- Blocked while the user is `sybil_suspect` (`403 CLAIM_FROZEN`) or trading is frozen.
- UI: "Creator rewards: FR1.99 · Claim" on Portfolio and on each coin you created (lifetime per coin shown).
- No daily cap (see §2.1).

---

## 11. Content moderation

Upload pipeline (worker, target under 10 s): quarantine → magic bytes, ≤ 5 MB, 256–4096 px → `sharp`: strip metadata, first GIF frame, WebP ≤ 1080 px + 320 px thumbnail → perceptual hash vs `blocked_hashes` (Hamming ≤ 6 rejects) plus a near-duplicate notice → image moderation provider (pluggable, e.g. AWS Rekognition moderation or Google Cloud Vision SafeSearch): auto-reject explicit nudity, sexual content, anything sexualising minors, graphic gore and hate symbols; borderline → review queue → text moderation on name, ticker, description and social handles (SA slur blocklist `src/server/moderation/blocklist-za.txt`, threats, personal info) → reserved tickers (brands, public figures) → pass → coin goes live, **FR20 charged only now** (rejected coins cost nothing), contract issued.

Reports (nsfw, hate, harassment, violence, copyright, personal_info, scam, real_money_offer, spam, other): 3 reports from accounts at least 3 days old, or 1 from a trusted reporter, hide the coin (out of lists, buying paused, holders can still sell) and queue it for an admin. Copyright takedown page (check the Electronic Communications and Transactions Act take-down process with a lawyer). A removed coin is settled with `COIN_REMOVAL_SETTLE`: every holder is force-sold at the curve price with fees waived, so nobody loses FR to moderation. The creator gets a strike, and 3 strikes end their launches.

---

## 12. POPIA, age gate, legal (not legal advice; have it reviewed)

18+ by DOB (under-18 blocked, data deleted within 24 h). Minimal data: email, phone hash + encrypted phone (for OTP resend), handle, DOB, hashed device/IP signals, gameplay. Privacy notice at signup (purposes: account, anti-fraud, analytics); separate unticked marketing opt-in; Information Officer registered with the Information Regulator; data export (`GET /api/me/export`) and deletion (`DELETE /api/me`: PII removed, phone hash kept to block repeat grants, which must be disclosed; anonymised ledger kept); breach plan in SECURITY.md; disclose cross-border hosting; signals kept 12 months. Terms: FR has no value; no cash-out; real-money trading of FR, coins or accounts is banned; rules can change; content licence; prohibited content. Check with the Film and Publication Board whether online distributor registration applies.

---

## 13. Tech stack

| Layer | Choice |
|---|---|
| App | Next.js (App Router) + TypeScript strict, long-running Node server (not serverless) |
| UI / PWA | Tailwind + shadcn/ui; web manifest + service worker (Serwist) |
| DB | PostgreSQL 16 + Drizzle ORM (raw SQL migrations for locks, triggers, roles) |
| Auth | Better Auth (email+password with verification, Google) + phone OTP provider adapter |
| Jobs / cache / realtime | Redis + BullMQ worker; SSE fed by Redis pub/sub from the outbox |
| Charts | TradingView `lightweight-charts` |
| Images | Cloudflare R2 + `sharp` |
| Safety | Cloudflare Turnstile, FingerprintJS (open source), Google Safe Browsing / Web Risk, Zod, `canonicalize` (JCS) |
| Observability | PostHog, Sentry, alert webhook (email/Telegram) |
| Tests | Vitest + fast-check, Testcontainers (Postgres, Redis), Playwright, k6 |
| Deploy | Docker `web` + `worker` containers; managed Postgres with point-in-time backups; Redis |

Pin exact versions at M0 to the latest stable releases and record them in DECISIONS.md.

---

## 14. Folder structure

```
meme-market/
  BUILD_SPEC.md  DECISIONS.md  SECURITY.md  README.md  .env.example  docker-compose.yml  Dockerfile
  drizzle.config.ts  vitest.config.ts  playwright.config.ts  package.json
  db/
    migrations/                        # drizzle + raw SQL
    sql/roles.sql  sql/ledger_triggers.sql  sql/mint_rules.sql  sql/contract_immutability.sql  sql/audit_chain.sql
  public/  manifest.webmanifest  icons/
  src/
    app/
      (marketing)/page.tsx
      (auth)/sign-in  sign-up  verify-email  verify-phone  age
      (game)/layout.tsx                # GAME pill, FR balance, bottom nav, freeze banner
      (game)/feed/page.tsx
      (game)/c/[ticker]/page.tsx       # coin page: chart, holders, trades, contract, socials
      (game)/c/[ticker]/socials/history/page.tsx
      (game)/launch/page.tsx           # create coin
      (game)/portfolio/page.tsx        # cash, holdings, creator rewards + Claim
      (game)/leaderboard/page.tsx
      (game)/u/[handle]/page.tsx
      (game)/settings/page.tsx
      contracts/page.tsx               # public contract chain head + verify by id
      admin/                           # overview, integrity, moderation, flags, users, requests, economy, audit
      legal/                           # terms, privacy, rules, takedown
      api/ ...                         # §16
    components/ ui/ feed/ coin/ chart/ trade/ portfolio/ leaderboard/ admin/ layout/
    lib/
      config/economy.ts
      curve/curve.ts  curve/golden.test.ts  curve/curve.property.test.ts
      contract/contract.ts             # params, JCS, sha256, id, chain
      money/parse.ts  money/format.ts
      links/validate.ts
      time/sast.ts
      validation/                      # zod schema per endpoint
    server/
      db/schema.ts  db/client.ts
      ledger/post.ts  ledger/kinds.ts
      integrity/invariants.ts  integrity/freeze.ts  integrity/alerts.ts
      auth/  verification/phone.ts  verification/grant.ts
      coins/launch.ts  coins/graduate.ts  coins/socials.ts  coins/settle.ts
      trade/execute.ts  trade/quote.ts
      rewards/claim.ts
      market/candles.ts  market/holders.ts
      moderation/provider.ts  moderation/pipeline.ts  moderation/blocklist-za.txt
      links/safety.ts  links/shorteners.txt  links/blocked-domains.txt
      abuse/rateLimit.ts  abuse/turnstile.ts  abuse/fingerprint.ts  abuse/sybil.ts  abuse/funnel.ts
      admin/requests.ts  admin/audit.ts
      realtime/publish.ts  realtime/sse.ts
      seasons/  leaderboard/  analytics/track.ts
    worker/
      index.ts
      jobs/ invariants.ts  candles.ts  trending.ts  leaderboard.ts  seasonRollover.ts  sybilScan.ts
            linkRecheck.ts  moderationScan.ts  contractChainVerify.ts  auditChainVerify.ts
  sim/economy-sim.ts
  tests/ integration/  e2e/  security/  load/k6-trading.js
```

---

## 15. Data model (Postgres). Money is BIGINT uFR; ids are UUID v7.

```sql
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  handle CITEXT UNIQUE NOT NULL CHECK (handle ~ '^[a-zA-Z0-9_]{3,20}$'),
  display_name TEXT NOT NULL, avatar_key TEXT,
  date_of_birth DATE NOT NULL, age_ok BOOLEAN NOT NULL DEFAULT false,
  phone_hash TEXT UNIQUE, phone_enc BYTEA, phone_verified_at TIMESTAMPTZ,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player','moderator','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned','deleted')),
  flags TEXT[] NOT NULL DEFAULT '{}',
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE grant_claims (phone_hash TEXT PRIMARY KEY, user_id UUID UNIQUE NOT NULL, ledger_tx_id UUID NOT NULL,
  device_id TEXT, ip_hash TEXT, created_at TIMESTAMPTZ DEFAULT now());              -- never deleted
CREATE TABLE grant_holds (user_id UUID PRIMARY KEY, reason TEXT, status TEXT DEFAULT 'open', created_at TIMESTAMPTZ DEFAULT now());

-- ledger
CREATE TABLE ledger_accounts (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('MINT','BURN','USER_CASH','CREATOR_REWARDS','COIN_RESERVE')),
  user_id UUID, coin_id UUID,
  balance_ufr BIGINT NOT NULL DEFAULT 0,
  CHECK (kind = 'MINT' OR balance_ufr >= 0),
  UNIQUE (kind, user_id), UNIQUE (kind, coin_id)
);
CREATE UNIQUE INDEX one_mint ON ledger_accounts (kind) WHERE kind IN ('MINT','BURN');
CREATE TABLE ledger_transactions (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('SIGNUP_GRANT','BAILOUT','COIN_CREATE_FEE','TRADE_BUY','TRADE_SELL',
       'CREATOR_CLAIM','GRADUATION','COIN_REMOVAL_SETTLE','ADMIN_CLAWBACK')),
  idempotency_key TEXT UNIQUE NOT NULL,
  beneficiary_user_id UUID, coin_id UUID, admin_request_id UUID, memo JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_signup_grant ON ledger_transactions (beneficiary_user_id) WHERE kind = 'SIGNUP_GRANT';
CREATE TABLE ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  tx_id UUID NOT NULL REFERENCES ledger_transactions(id),
  account_id BIGINT NOT NULL REFERENCES ledger_accounts(id),
  amount_ufr BIGINT NOT NULL CHECK (amount_ufr <> 0)
);
-- db/sql/ledger_triggers.sql:
--  BEFORE INSERT ledger_entries  -> ledger_kind_rules(): allowed account kinds/directions per tx kind (§9.1),
--                                   MINT only for SIGNUP_GRANT/BAILOUT with mint_rules amount + eligibility (§9.2),
--                                   BURN only positive
--  AFTER INSERT ledger_entries   -> UPDATE ledger_accounts SET balance_ufr = balance_ufr + NEW.amount_ufr (SECURITY DEFINER)
--  CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED -> per tx_id: SUM(amount) = 0 and >= 2 entries
--  BEFORE UPDATE OR DELETE on ledger_transactions / ledger_entries -> RAISE EXCEPTION
CREATE TABLE mint_rules (kind TEXT PRIMARY KEY CHECK (kind IN ('SIGNUP_GRANT','BAILOUT')),
  amount_ufr BIGINT NOT NULL CHECK (amount_ufr > 0), enabled BOOLEAN NOT NULL, updated_by_request UUID);
CREATE TABLE system_settings (id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  trading_frozen BOOLEAN NOT NULL DEFAULT false, frozen_reason TEXT, frozen_at TIMESTAMPTZ,
  economy_preset TEXT NOT NULL DEFAULT 'default' CHECK (economy_preset IN ('default','beta')),
  bailout_enabled BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE integrity_incidents (id BIGSERIAL PRIMARY KEY, scope TEXT, coin_id UUID, details JSONB,
  detected_at TIMESTAMPTZ DEFAULT now(), resolved_by_request UUID, resolved_at TIMESTAMPTZ);

-- coins + immutable contracts
CREATE TABLE coin_contracts (
  id TEXT PRIMARY KEY CHECK (id ~ '^MMC-[0-9A-F]{16}$'),
  seq BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  coin_id UUID UNIQUE NOT NULL,
  version TEXT NOT NULL,
  params JSONB NOT NULL,
  params_hash TEXT UNIQUE NOT NULL CHECK (params_hash ~ '^[0-9a-f]{64}$'),
  prev_contract_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);  -- trigger: BEFORE UPDATE OR DELETE OR TRUNCATE -> RAISE EXCEPTION; app role: SELECT, INSERT only
CREATE TABLE coins (
  id UUID PRIMARY KEY,
  contract_id TEXT UNIQUE REFERENCES coin_contracts(id),   -- set once at go-live; trigger blocks changes
  creator_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 32),
  ticker CITEXT UNIQUE NOT NULL CHECK (ticker ~ '^[A-Z0-9]{3,8}$'),
  description TEXT CHECK (char_length(description) <= 500),
  image_key TEXT NOT NULL, image_phash BIT(64),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','live','hidden','removed','frozen')),
  phase TEXT NOT NULL DEFAULT 'curve' CHECK (phase IN ('curve','pool')),
  x_ufr BIGINT, y_shares BIGINT, k NUMERIC(50,0),
  sold_shares BIGINT NOT NULL DEFAULT 0 CHECK (sold_shares >= 0),
  reserve_ufr BIGINT NOT NULL DEFAULT 0 CHECK (reserve_ufr >= 0),
  pool_shares_minted BIGINT,
  price_ufr_per_1m BIGINT, holder_count INT NOT NULL DEFAULT 0, trade_count INT NOT NULL DEFAULT 0,
  volume_24h_ufr BIGINT NOT NULL DEFAULT 0, creator_rewards_lifetime_ufr BIGINT NOT NULL DEFAULT 0,
  trending_score DOUBLE PRECISION NOT NULL DEFAULT 0, socials_locked BOOLEAN NOT NULL DEFAULT false,
  live_at TIMESTAMPTZ, graduated_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE coin_links (coin_id UUID, kind TEXT CHECK (kind IN ('x','tiktok','instagram','telegram','whatsapp_channel','website')),
  url TEXT NOT NULL, safety_status TEXT NOT NULL DEFAULT 'pending' CHECK (safety_status IN ('ok','unsafe','pending')),
  checked_at TIMESTAMPTZ, PRIMARY KEY (coin_id, kind));
CREATE TABLE coin_link_edits (id BIGSERIAL PRIMARY KEY, coin_id UUID, editor_id UUID, field TEXT,
  old_value TEXT, new_value TEXT, ip_hash TEXT, created_at TIMESTAMPTZ DEFAULT now());   -- append-only

CREATE TABLE holdings (user_id UUID, coin_id UUID, shares BIGINT NOT NULL DEFAULT 0 CHECK (shares >= 0),
  cost_basis_ufr BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (user_id, coin_id));
CREATE INDEX ON holdings (coin_id, shares DESC);

CREATE TABLE trades (
  id UUID PRIMARY KEY, seq BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id UUID NOT NULL, coin_id UUID NOT NULL, contract_id TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy','sell')), phase TEXT NOT NULL,
  gross_ufr BIGINT NOT NULL, fee_ufr BIGINT NOT NULL, fee_creator_ufr BIGINT NOT NULL, fee_burn_ufr BIGINT NOT NULL,
  shares BIGINT NOT NULL CHECK (shares > 0),
  price_before_ufr_per_1m BIGINT NOT NULL, price_after_ufr_per_1m BIGINT NOT NULL,
  ledger_tx_id UUID NOT NULL, idempotency_key TEXT NOT NULL, ip_hash TEXT, device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (user_id, idempotency_key),
  CHECK (fee_creator_ufr + fee_burn_ufr = fee_ufr)
);
CREATE INDEX ON trades (coin_id, seq);  CREATE INDEX ON trades (user_id, created_at);
CREATE TABLE candles (coin_id UUID, interval TEXT CHECK (interval IN ('1m','5m','15m','1h','1d')), bucket_start TIMESTAMPTZ,
  open BIGINT, high BIGINT, low BIGINT, close BIGINT, volume_ufr BIGINT DEFAULT 0, buy_volume_ufr BIGINT DEFAULT 0,
  sell_volume_ufr BIGINT DEFAULT 0, trades INT DEFAULT 0, first_seq BIGINT, last_seq BIGINT,
  PRIMARY KEY (coin_id, interval, bucket_start));

CREATE TABLE seasons (id SERIAL PRIMARY KEY, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, status TEXT);
CREATE TABLE season_baselines (season_id INT, user_id UUID, net_worth_ufr BIGINT, PRIMARY KEY (season_id, user_id));
CREATE TABLE season_results (season_id INT, board TEXT, rank INT, user_id UUID, coin_id UUID, score NUMERIC,
  PRIMARY KEY (season_id, board, rank));
CREATE TABLE reports (id UUID PRIMARY KEY, coin_id UUID, reporter_id UUID, reason TEXT, details TEXT,
  status TEXT DEFAULT 'open', created_at TIMESTAMPTZ DEFAULT now(), UNIQUE (coin_id, reporter_id));
CREATE TABLE moderation_queue (id UUID PRIMARY KEY, coin_id UUID, source TEXT, labels JSONB, status TEXT DEFAULT 'open',
  decided_by UUID, decision TEXT, decided_at TIMESTAMPTZ);
CREATE TABLE blocked_hashes (phash BIT(64) PRIMARY KEY, reason TEXT);
CREATE TABLE user_signals (user_id UUID, kind TEXT, value_hash TEXT, first_seen TIMESTAMPTZ, last_seen TIMESTAMPTZ,
  PRIMARY KEY (user_id, kind, value_hash));
CREATE TABLE abuse_flags (id UUID PRIMARY KEY, user_id UUID, kind TEXT, score REAL, evidence JSONB,
  status TEXT DEFAULT 'open', created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE admin_requests (id UUID PRIMARY KEY, action TEXT NOT NULL, payload JSONB NOT NULL, reason TEXT NOT NULL,
  requested_by UUID NOT NULL, approved_by UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','executed','failed')),
  created_at TIMESTAMPTZ DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL, approved_at TIMESTAMPTZ, executed_at TIMESTAMPTZ,
  CHECK (approved_by IS NULL OR approved_by <> requested_by));
CREATE TABLE audit_log (id BIGSERIAL PRIMARY KEY, actor_id UUID, action TEXT, target_type TEXT, target_id TEXT,
  before JSONB, after JSONB, prev_hash TEXT, row_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());  -- append-only
CREATE TABLE outbox (id BIGSERIAL PRIMARY KEY, topic TEXT, payload JSONB, created_at TIMESTAMPTZ DEFAULT now(), published_at TIMESTAMPTZ);
CREATE TABLE idempotency_keys (user_id UUID, key TEXT, endpoint TEXT, response JSONB, created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, key));
CREATE TABLE notifications (id UUID PRIMARY KEY, user_id UUID, kind TEXT, payload JSONB, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());
```

DB roles (`db/sql/roles.sql`): `app_rw` (web + worker) gets SELECT/INSERT on most tables and UPDATE only on mutable state (`coins` except `contract_id`, `holdings`, limited `profiles` columns, `candles`, `moderation_queue`, `reports`, `admin_requests`, `outbox.published_at`, `system_settings` only via a SECURITY DEFINER function). It gets **no** UPDATE/DELETE on `ledger_*`, `coin_contracts`, `coin_link_edits`, `audit_log`, `mint_rules` or `grant_claims`. `migrator` owns the schema. `readonly` is for analytics.

---

## 16. API

Amounts are uFR strings plus a `display` string. Writes need `Idempotency-Key`. Errors: `{ error: { code, message, details } }`.

Error codes: `UNAUTHENTICATED, AGE_GATE, EMAIL_UNVERIFIED, PHONE_UNVERIFIED, GRANT_HELD, INSUFFICIENT_FR, INSUFFICIENT_SHARES, MAX_POSITION, MIN_TRADE, SLIPPAGE, LAUNCH_PROTECTION, COIN_NOT_TRADABLE, FROZEN, RATE_LIMITED, TICKER_TAKEN, TICKER_RESERVED, IMAGE_REJECTED, LINK_INVALID, LINK_UNSAFE, NOTHING_TO_CLAIM, CLAIM_FROZEN, FORBIDDEN, APPROVAL_REQUIRED, TURNSTILE_FAILED, INVALID_AMOUNT`.

| Method + path | Request | Response |
|---|---|---|
| `POST /api/onboarding/profile` | `{ handle, displayName, dateOfBirth, acceptTerms, turnstileToken }` | `{ profile, next: "verify-phone" }` |
| `POST /api/verify/phone/start` | `{ phone: "+27…", channel: "sms"\|"whatsapp", turnstileToken }` | `{ sent: true, retryAfterS }` |
| `POST /api/verify/phone/confirm` | `{ phone, code }` | `{ verified: true, grant: { status: "granted"\|"held", amountUfr: "200000000" } }` |
| `GET /api/me` | — | `{ user, cashUfr, rewardsPendingUfr, netWorthUfr, frozen, display }` |
| `GET /api/me/export` · `DELETE /api/me` | `{ confirm: "DELETE" }` | POPIA export / deletion |
| `POST /api/uploads/coin-image` | `{ contentType, bytes }` | `{ uploadUrl, uploadKey, expiresAt }` |
| `POST /api/coins` | `{ name, ticker, description?, socials?: { x?, tiktok?, instagram?, telegram?, whatsappChannel?, website? }, uploadKey, initialBuyUfr?, turnstileToken }` | `201 { coin: CoinDTO (live\|pending), contract?: ContractDTO, initialTrade? }` |
| `GET /api/coins?tab=trending\|new\|graduating\|graduated&cursor` | — | `{ items: CoinCardDTO[], nextCursor }` |
| `GET /api/coins/:ticker` | — | `{ coin: CoinDTO, contract: ContractDTO, socials, myHolding?, rewardsEarnedUfr }` |
| `GET /api/coins/:ticker/contract` | — | `ContractDTO` |
| `GET /api/coins/:ticker/candles?tf=1m\|5m\|15m\|1h\|1d&from&to&limit` | — | `{ tf, candles: [{ t, o, h, l, c, v, bv, sv }] }` |
| `GET /api/coins/:ticker/holders?limit=20` | — | `{ holderCount, items: [{ label, shares, pctBps, isCreator, isCurve }] }` |
| `GET /api/coins/:ticker/trades?before=seq` | — | `{ items: [{ seq, side, handle, frUfr, shares, priceUfrPer1m, at }] }` |
| `GET /api/coins/:ticker/quote?side&amountUfr\|shares` | — | `{ sharesOut\|payoutUfr, feeUfr, creatorUfr, burnUfr, priceAfterUfrPer1m, impactBps, maxBuyUfr, warnings }` |
| `PATCH /api/coins/:ticker/socials` (creator only) | `{ description?, socials? }` (null removes) | `{ socials, editsToday }` |
| `GET /api/coins/:ticker/socials/history` | — | `{ items: [{ field, oldValue, newValue, at }] }` |
| `POST /api/coins/:ticker/report` | `{ reason, details? }` | `201` |
| `POST /api/trades` | `{ ticker, side: "buy", amountUfr, minSharesOut }` or `{ ticker, side: "sell", shares \| "all", minPayoutUfr }` | `{ trade, balances: { cashUfr, holdingShares }, coin: CoinDTO }` |
| `POST /api/creator-rewards/claim` | — | `{ claimedUfr, cashUfr }` |
| `GET /api/portfolio` | — | `{ cashUfr, rewardsPendingUfr, netWorthUfr, seasonScoreUfr, holdings[], createdCoins[], history[] }` |
| `GET /api/leaderboards?board=traders\|creators\|coins&season` | — | `{ season, entries[], me? }` |
| `GET /api/contracts/head` | — | `{ latestSeq, latestHash, dailyHeads: [{ date, hash }] }` |
| `GET /api/stream?topics=` | SSE | §8.3 |
| `/api/admin/...` | moderation, flags, users, requests (create/approve/reject), integrity, economy, audit | All audited. Sensitive actions return `202 { requestId, status: "pending" }` |

`ContractDTO = { id, version, paramsHash, prevContractHash, createdAt, params }`
`CoinDTO = { id, ticker, name, description, imageUrl, creator: { handle }, status, phase, contractId, priceUfrPer1m, marketCapUfr, reserveUfr, graduationTargetUfr, progressBps, holders, trades24h, volume24hUfr, change24hBps, liveAt, graduatedAt }`

Trade engine (`src/server/trade/execute.ts`):
```
if system_settings.trading_frozen -> 503 FROZEN
idempotency fast path: existing trade for (user, key) -> return it
BEGIN
  SELECT coin FOR UPDATE; require live (or hidden and side = sell)
  load contract by coin.contract_id; verify hash (cache by hash); mismatch -> freeze coin, alert, abort
  SELECT ledger_accounts (user cash, coin reserve, creator rewards, burn) ORDER BY id FOR UPDATE
  upsert holding; SELECT holding FOR UPDATE
  checks: launch protection, min trade, balance/shares, max position, slippage, graduation clip
  q = quote(contract, coin state)                      -- lib/curve, BigInt
  INSERT ledger_transactions + ledger_entries           -- triggers update balances and enforce rules
  UPDATE coins (x, y, sold, reserve, price, counters); UPDATE holdings
  INSERT trades (seq assigned); INSERT outbox
  if q.graduates: graduate(tx)
COMMIT                                                  -- deferred zero-sum check runs here
retry whole tx on 40P01 / 40001 (max 3)
```

---

## 17. Leaderboards, seasons, trending

- Season: Monday 00:00 → Sunday 23:59:59 SAST. Balances don't reset.
- **Net worth** = cash + pending creator rewards + liquidation value of holdings (what selling everything now would pay after fees, not spot price × shares).
- **Season score** = net worth now − baseline at season start − FR minted to you this season (signup grant if you joined this season; bailout if enabled).
- Boards: Top traders (min 5 trades), Top creators (distinct non-flagged traders on your coins this season), Top coins (distinct buyers this season), Hall of Fame (graduated coins). Flagged accounts hidden.
- Trending score (every 60 s): `(3·distinct buyers in 1h + 2·log10(1 + 1h volume in FR, each user's volume capped at 1% of the graduation target) + 0.02·clip(1h price change %, −50, 200)) / (1 + age_hours/24)^1.2`. King of the Hill = the non-graduated coin with the highest progress ≥ 50%.

---

## 18. UI screens (mobile-first 360 px; two columns ≥ 1024 px; dark mode default)

Header: logo, **GAME · FR has no cash value** pill, cash balance; freeze banner when frozen. Bottom nav: Feed · Launch (+) · Portfolio · Leaders · Me.

1. **Landing:** "Launch and trade meme coins with fake rand" · Get FR200 free once (after a phone check) · 18+ · It's a game.
2. **Onboarding:** sign up → handle + DOB + terms ("I understand FR has no cash value") → phone OTP → "You got FR200" → 3 swipe cards → guided FR10 buy on King of the Hill → share to WhatsApp → "Launch your own coin for FR20".
3. **Feed:** King of the Hill; tabs; cards (image, name, $TICKER, market cap, 1h change, progress bar, holders, quick-buy chips FR5/10/25).
4. **Coin page:** image, name, ticker, creator (dev), description; socials row; price, market cap, changes; **candlestick chart + volume** (1m/5m/15m/1h/1d, Price/Mcap toggle); graduation progress bar; trade panel (desktop) or sticky Buy/Sell buttons opening the trade sheet (mobile); tabs Trades · Holders · Contract · Socials history; report.
5. **Trade sheet:** buy/sell; chips (buy FR5/10/25/Max; sell 25/50/100%); live quote: shares, fee 1.25% (creator 0.25% · burned 1.00%), price impact, max-position notice, 2% slippage; confirm; footer "Game · FR has no cash value".
6. **Launch coin:** image crop, name, ticker (live availability), description, socials (X, TikTok, Instagram, Telegram, WhatsApp channel, website, with inline validation), initial buy slider, summary "FR20 launch fee (burned) + FRx initial buy", contract preview ("Your coin's fixed rules"), rules checkbox, Turnstile.
7. **Portfolio:** cash, net worth, season score; **Creator rewards card with Claim**; holdings; my coins (lifetime rewards each); history.
8. **Leaderboard**, **Profile**, **Settings** (export/delete), **/contracts** (chain head, verify a contract by ID).
9. **Admin:** Overview (users, DAU, trades, FR supply split into minted, burned, cash, reserves and pending rewards, plus an invariant status light), Integrity (incidents, freeze/unfreeze request), Moderation, Flags, Users, Requests (pending approvals), Economy (preset, fees for new coins, bailout, all as requests), Audit log.

---

## 19. Analytics (PostHog) and success metrics

Events: `landing_viewed, signup_started, signup_completed, age_gate_failed, phone_verify_started, phone_verified, grant_received, grant_held, onboarding_step, first_trade_completed, trade_completed {side, fr, coin_age_min, phase, impact_bps}, trade_failed {code}, coin_launch_started, coin_launched {has_socials, initial_buy}, coin_rejected {reason}, coin_graduated {hours_to_graduate, holders}, creator_rewards_claimed {amount}, socials_edited, link_clicked {kind}, share_clicked {target, context}, invite_landing, leaderboard_viewed, report_submitted, pwa_installed, frozen_banner_seen`.

| Metric | Definition | Your target |
|---|---|---|
| Verification completion | % of signups who verify their phone | you set |
| Activation | % of granted players who trade within 10 min | you set |
| D1 / D7 retention | active the next SAST day / on day 7 | you set |
| Trades per DAU | trades ÷ daily actives | you set |
| Launch rate | % of weekly actives who launch a coin | you set |
| Graduations per week | count | you set |
| Broke rate | % of actives with net worth < FR5 (decides bailout) | you set |
| Share rate | shares per DAU | you set |
| Grant holds / sybil flags | per 100 signups | you set |

---

## 20. Testing summary

- **Golden tests:** §5.6 tables A, B and C reproduced exactly (shares, fees, creator/burn split, prices, reserves).
- **Property tests** (fast-check, ≥ 1,000 runs, both presets): x·y ≥ k; reserve ≥ 0; sold ≤ curve supply; minted shares ≤ total supply; buy-then-sell returns less than spent; splitting a buy never yields more shares; price rises on buys and falls on sells; a full unwind leaves reserve ≥ 0 and < FR0.01; `creator + burn = fee`; `creator = floor(fee/5)`; graduation clip exact; pool price = final curve price ± 1 uFR per 1M; contract hash unchanged by key order (JCS).
- **Ledger/DB:** every allowed kind posts; forbidden patterns rejected by the database (user→user, MINT outside grant/bailout, negative BURN, admin credit); zero-sum at commit; `app_rw` can't UPDATE balances, contracts or ledger rows; second grant fails; second grant for the same phone fails.
- **Concurrency:** 50 users buying one coin in parallel; 1 user firing 20 parallel FR50 buys with FR200 (at most 4 succeed); 10 parallel claims → one effect; graduation race.
- **Integrity drills:** imbalance injected as superuser in a test DB → freeze within 60 s and alert; contract tamper → coin frozen.
- **Candles:** replayed events are no-ops; rebuild == incremental; SAST day boundary.
- **Links:** table of valid/invalid URLs per kind; unsafe domain via a mock.
- **Economy sim** (`npm run sim -- --preset beta --players 100 --days 28`): agents (casual, degen, creator, holder, a 5-account sybil ring, bot) → daily supply, burn, broke %, graduations, net-worth spread, sybil-ring gains with and without detection. Simulated results only, not predictions.
- **E2E** (Playwright at 390×844 and desktop): onboarding → trade → launch with socials → claim → chart updates in a second browser → admin 2-person approval.
- **Load:** k6, 100 virtual users × 10 coins × 5 min, zero invariant violations.
- **Security:** §9.10 checklist, automated where possible in `tests/security/`.

---

## 21. Build plan

### 21.1 Overview

| # | Milestone | Days (est.) | Goal | Done when |
|---|---|---|---|---|
| M0 | Foundation | 1 | Repo, stack, CI, shell UI with GAME label | App runs; CI green |
| M1 | Ledger & money integrity core | 3 | FR books that app code can't break | DB rejects every illegal money move; imbalance → auto-freeze |
| M2 | Accounts, 18+, verification, FR200 grant | 2 | One FR200 per verified adult | One grant per user and per phone; under-18 blocked |
| M3 | Curve math & coin contracts | 2 | Exact pricing + immutable contracts | Golden tables exact; contracts can't change |
| M4 | Launch a coin (moderation + socials) | 2 | Launch coins for FR20 | Live coin with contract; rejected = free; links validated |
| M5 | Trading engine, creator rewards, graduation | 3 | Safe buys, sells, claims, graduation | Concurrency + idempotency tests pass |
| M6 | Coin page market data & realtime | 3 | Chart, volume, holders, trades, progress, live | Second browser updates in < 2 s; candles correct |
| M7 | Feed, portfolio, leaderboards, onboarding | 2 | The full playable loop | First trade ≤ 6 taps after grant |
| M8 | Admin, 2-person approval, abuse detection | 3 | Run and protect the game | Sybil ring flagged; approvals enforced |
| M9 | Hardening, pen-test, analytics, beta | 2 | Ready for 50–100 testers | Checklist passed; deployed behind invite codes |
| | **Total** | **about 23 working days (estimate)** | | |

### M0 — Foundation (1 day)
- **Goal:** a working skeleton.
- **Tasks:** init Next.js + TS strict, Tailwind, shadcn/ui; ESLint + Prettier; Vitest; Playwright; docker-compose with Postgres 16 + Redis; Drizzle config; `.env.example`; GitHub Actions CI (lint, typecheck, unit tests, build); `(game)/layout.tsx` with the GAME pill and bottom nav; PWA manifest + icons; `economy.ts` (§4); `money/format.ts`; DECISIONS.md and SECURITY.md stubs.
- **Files:** `package.json, docker-compose.yml, Dockerfile, drizzle.config.ts, .github/workflows/ci.yml, src/app/(game)/layout.tsx, src/app/(marketing)/page.tsx, public/manifest.webmanifest, src/lib/config/economy.ts, src/lib/money/format.ts`.
- **Acceptance (PASS/FAIL):** `docker compose up -d && npm run dev` serves the landing page · GAME pill visible on every page at 360 px · CI green · PWA installable in Lighthouse · `formatFR(12345678n)` returns "FR12.35".
- **Tests:** format unit tests; one Playwright smoke test.
- **Not yet:** auth, DB tables, any money logic.

### M1 — Ledger & money integrity core (3 days)
- **Goal:** FR books that app code can't break.
- **Tasks:** migrations for `ledger_accounts, ledger_transactions, ledger_entries, mint_rules, system_settings, integrity_incidents, audit_log, outbox, idempotency_keys`; triggers in `db/sql/ledger_triggers.sql` (balance update, kind rules, mint rules, burn-only-positive, deferred zero-sum, no update/delete); roles `app_rw`, `migrator`, `readonly`; seed MINT and BURN accounts and `mint_rules` (SIGNUP_GRANT 200 enabled, BAILOUT 20 disabled); `postLedgerTx()` with idempotency; invariant checker + freeze + alert webhook; audit-log hash chain; worker skeleton with the 60 s `invariants` job.
- **Files:** `db/sql/{roles,ledger_triggers,mint_rules,audit_chain}.sql, src/server/db/schema.ts, src/server/ledger/{post,kinds}.ts, src/server/integrity/{invariants,freeze,alerts}.ts, src/server/admin/audit.ts, src/worker/index.ts, src/worker/jobs/invariants.ts, tests/integration/ledger.test.ts`.
- **Acceptance:** every allowed pattern in §9.1 posts · user→user, admin credit, MINT for any other kind, negative BURN and unbalanced transactions are rejected **by the database** (raw SQL as `app_rw`) · `app_rw` gets permission denied on UPDATE `ledger_accounts` and DELETE `ledger_entries` · same idempotency key twice → one transaction · injected imbalance (superuser) → `trading_frozen = true` within 60 s and an alert is sent · audit chain verifies.
- **Tests:** Testcontainers integration suite; property test that random valid transactions keep the global identity.
- **Not yet:** users, coins, any money UI.

### M2 — Accounts, 18+, verification, FR200 grant (2 days)
- **Goal:** one FR200 per verified adult.
- **Tasks:** Better Auth (email+password with email verification, Google); profiles + onboarding page (handle, DOB, terms); phone OTP start/confirm with a provider adapter + mock; `grant_claims`, `grant_holds`; device cookie + FingerprintJS + IP hash signals; Turnstile; disposable-email blocklist; `grantSignup()`; `/api/me`; signup/OTP rate limits.
- **Files:** `src/server/auth/*, src/server/verification/{phone,grant}.ts, src/server/abuse/{turnstile,fingerprint,rateLimit}.ts, src/app/(auth)/*, src/app/api/onboarding/profile/route.ts, src/app/api/verify/phone/{start,confirm}/route.ts, src/app/api/me/route.ts`.
- **Acceptance:** under-18 DOB blocked · verified user sees FR200 · second grant attempt (replay, 10 parallel, re-verify) leaves the balance at FR200 · new account with the same phone gets no grant · 3rd account on one device → `grant_held` · OTP locked after 5 wrong codes.
- **Tests:** grant idempotency and phone uniqueness integration tests; e2e onboarding with mock OTP.
- **Not yet:** coins, trading, bailout UI.

### M3 — Curve math & coin contracts (2 days)
- **Goal:** exact pricing and immutable contracts.
- **Tasks:** `lib/curve` (quoteBuy, quoteSell, clip, graduate, price, marketCap, liquidationValue) in BigInt for both presets; `lib/contract` (build params, JCS, sha256, ID, chain link); `coin_contracts` table + immutability trigger + grants; `GET /api/coins/:ticker/quote` against a seeded test coin.
- **Files:** `src/lib/curve/{curve,golden.test,curve.property.test}.ts, src/lib/contract/contract.ts, db/sql/contract_immutability.sql`.
- **Acceptance:** golden tables A, B, C match to the uFR and the share · all properties pass (1,000 runs × both presets) · UPDATE/DELETE on `coin_contracts` fails for every non-superuser role · hash identical regardless of JSON key order · changing any param changes the hash.
- **Tests:** golden, property, contract unit, DB immutability.
- **Not yet:** UI, persisted trades.

### M4 — Launch a coin (2 days)
- **Goal:** players launch coins for FR20 with optional socials.
- **Tasks:** presigned upload; moderation pipeline (provider interface + mock + one real provider); text blocklist; reserved tickers; `coins`, `coin_links`, `coin_link_edits`; social validation + safety adapter (mock + Safe Browsing); `launchCoin()` charges FR20 and issues the contract only at go-live; initial buy stubbed until M5; launch page; socials edit endpoint + history page.
- **Files:** `src/server/coins/{launch,socials}.ts, src/server/moderation/*, src/lib/links/validate.ts, src/server/links/*, src/app/(game)/launch/page.tsx, src/app/api/coins/route.ts, src/app/api/uploads/coin-image/route.ts, src/app/api/coins/[ticker]/socials/*`.
- **Acceptance:** valid launch → coin live, balance FR200 → FR180, contract ID + hash shown · rejected image → nothing charged · invalid or unsafe links rejected with field errors · `wa.me`, punycode, shortener and `javascript:` links rejected · only the creator can edit socials; edits recorded; contract unchanged · 4th launch in a day → 429.
- **Tests:** link table tests; launch integration; moderation mock e2e.
- **Not yet:** charts, trading UI, admin queue UI (just write to the tables).

### M5 — Trading engine, creator rewards, graduation (3 days)
- **Goal:** safe trades end to end.
- **Tasks:** `execute.ts` per §16; holdings + cost basis; max position, launch protection, min trade, slippage; graduation + pool phase; `trades.seq`; outbox; creator rewards accrual, `claim.ts` + endpoint; hidden coins sell-only; coin freeze on contract hash mismatch; wire the initial buy.
- **Files:** `src/server/trade/{execute,quote}.ts, src/server/coins/graduate.ts, src/server/rewards/claim.ts, src/app/api/trades/route.ts, src/app/api/creator-rewards/claim/route.ts, tests/integration/{trade,concurrency,claim,graduation}.test.ts`.
- **Acceptance:** scenarios A and B replayed through the API give the golden numbers · 50-user parallel test: final state = serial replay and invariants hold · 1 user, 20 parallel FR50 buys with FR200 → at most 4 succeed, balance never negative · same Idempotency-Key 20× → one trade · 10 parallel claims → one transfer · graduation race → exactly one graduation, price continuous · tampered body fields ignored.
- **Tests:** the suites above + a property test running random API sequences against the invariant checker.
- **Not yet:** chart UI, leaderboards.

### M6 — Coin page market data & realtime (3 days)
- **Goal:** a pump.fun-style coin page.
- **Tasks:** `candles` job (5 timeframes, idempotent upsert, SAST days), rebuild script, retention; holders endpoint (with curve/pool row); trades endpoint; SSE + Redis pub/sub + outbox publisher; coin page with candlesticks + volume (lightweight-charts), Price/Mcap toggle, timeframe switch, progress bar, Holders and Trades tabs, Contract panel with browser Verify, socials row with link interstitial; trade sheet.
- **Files:** `src/worker/jobs/candles.ts, src/server/market/*, src/server/realtime/*, src/app/api/stream/route.ts, src/app/api/coins/[ticker]/{candles,holders,trades,contract}/route.ts, src/app/(game)/c/[ticker]/page.tsx, src/components/{chart,coin,trade}/*`.
- **Acceptance:** with two browsers, a trade in one updates price, candle, volume, trades, holders and progress in the other within 2 s · candles rebuilt from trades == incremental candles for a seeded 1,000-trade coin · replaying outbox events changes nothing · Verify shows "match" · usable at 360 px.
- **Tests:** candle unit + integration; SSE integration; Playwright two-context test.
- **Not yet:** leaderboards, admin UI.

### M7 — Feed, portfolio, leaderboards, onboarding (2 days)
- **Goal:** the full playable loop.
- **Tasks:** feed tabs + trending job + King of the Hill; portfolio (cash, rewards + Claim, holdings at liquidation value, my coins, history); seasons, baselines, rollover job, cached leaderboards; profiles; guided onboarding; WhatsApp share + OG images; `/contracts` page.
- **Files:** `src/app/(game)/{feed,portfolio,leaderboard,u/[handle]}/page.tsx, src/worker/jobs/{trending,leaderboard,seasonRollover}.ts, src/server/seasons/*, src/app/contracts/page.tsx, src/app/api/og/*`.
- **Acceptance:** Monday 00:00 SAST rollover snapshots baselines · season score excludes the grant · first trade ≤ 6 taps after the grant · OG image renders for a coin · new coins appear in the feed live.
- **Tests:** season boundary tests; full-loop e2e.
- **Not yet:** prizes, cosmetics, push notifications.

### M8 — Admin, 2-person approval, abuse detection (3 days)
- **Goal:** operate and protect the game.
- **Tasks:** admin area with 2FA (passkey or TOTP) + re-auth; `admin_requests` flow (create, approve, reject, expire, execute) for every sensitive action in §9.8; moderation queue, reports, auto-hide, coin removal settlement; sybil clustering + funnel jobs, flags queue, claim freeze; clawback; economy page (supply breakdown, invariant light, preset/bailout requests); integrity page; audit viewer + nightly chain checks; legal pages, takedown form, data export/delete.
- **Files:** `src/app/admin/**, src/server/admin/requests.ts, src/server/abuse/{sybil,funnel}.ts, src/worker/jobs/{sybilScan,auditChainVerify,contractChainVerify,linkRecheck}.ts, src/server/coins/settle.ts, src/app/legal/**`.
- **Acceptance:** a requester can't approve their own request (UI and DB CHECK) · a sensitive action without approval → `APPROVAL_REQUIRED` · a seeded 5-account sybil ring funnelling FR is flagged and its claims frozen · a removed coin settles holders with the ledger balanced · a tampered audit row (superuser) is caught by the nightly job · no admin path can increase any balance.
- **Tests:** admin integration; sybil fixture; e2e approval with two admin users.
- **Not yet:** prizes, sponsor tools.

### M9 — Hardening, pen-test, analytics, beta (2 days)
- **Goal:** a safe beta for 50–100 testers.
- **Tasks:** CSP and security headers; run the §9.10 checklist and record results; k6 load test; economy sim on the beta preset with chosen values recorded; PostHog events (§19) + Sentry; backups + restore drill; invite codes; production deploy; switch to `beta` preset through the approval flow.
- **Files:** `SECURITY.md, tests/security/*, tests/load/k6-trading.js, sim/economy-sim.ts, src/server/analytics/track.ts`.
- **Acceptance:** every checklist item PASS or documented as an accepted risk · k6: p95 trade latency recorded, zero invariant violations · all §19 events visible in PostHog · restore drill succeeds · production live behind invite codes.
- **Not yet:** monetisation of any kind, prizes, public launch.

**After the beta (only once you've reviewed the numbers):** push notifications, referrals, cosmetics (real money, cosmetic only), sponsor seasons, sponsored coin launches, CPA-compliant prize promotions, local-language copy. Each needs its own spec section, plus legal review where money or prizes are involved.

---

## 22. How to test the waters

1. Before launch, write your targets into §19, run the sim on the beta preset, and seed 20–30 original coins.
2. Closed beta for 2–4 weeks with 50–100 invited players from your WhatsApp groups, campus and dev communities, on the **beta preset** (graduation FR2,000).
3. Daily TikTok/Reels/Shorts from real game moments (a coin graduating, a chart's first hour, the Monday board reveal), always saying "free game, fake rand".
4. Share cards with OG images for every trade and launch; a WhatsApp Channel for announcements.
5. Watch daily: verification completion, broke rate (decides whether to enable the bailout), grant holds, invariant status, moderation load.
6. Decide: if you hit your targets, open signups, and move new coins to the FR100,000 default once the player count can support it; then cosmetics and sponsors. If you miss, fix onboarding or discovery, or reuse the stack for the next idea.
7. Before any prize or payment: lawyer review (terms, CPA promotional competition rules, POPIA, FPB).
