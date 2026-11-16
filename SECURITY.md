# Security

FR has no cash value. There is no top-up, cash-out, or player-to-player transfer outside a trade or a creator-reward claim. There is no crypto, blockchain, or wallet. A coin contract is a database row.

## Contact

Set `INFORMATION_OFFICER_EMAIL` before inviting anyone. That address is the privacy and takedown contact. There is no public bug-bounty mailbox yet.

## What the database enforces

- Balances change only in the ledger trigger. `app_rw` has no UPDATE or DELETE on ledger tables.
- Ledger accounts are row-locked through `lock_ledger_account()` (security definer). A direct `SELECT … FOR UPDATE` is denied, and a direct `UPDATE` of a balance is denied.
- Every ledger transaction must match an allowed shape and sum to zero at commit. Minting is only `SIGNUP_GRANT` (FR200, once per user, email verified, 18+) or `BAILOUT` while that flag is on.
- Platform treasury entries can only increase. Nothing spends it.
- Coin contracts cannot be updated or deleted. `coins.contract_id` cannot change once set.
- An admin cannot approve their own `admin_requests` row (CHECK constraint). Unfreeze, preset changes and bailout run only from an approved request.
- The supply identity is checked every 60 seconds. A mismatch freezes trading and writes `integrity_incidents`.

## Checklist (spec 9.10)

Recorded against this build. Items that were not exercised against a hostile superuser are marked as not yet run.

| Check | Result |
|---|---|
| Parallel trades keep balances non-negative and the identity | Partial. One integration test covers grant, launch, buy, sell, claim, replay, and the identity. A 100-way race was not run. |
| Idempotency replay | Pass in the integration test (same key returns the same trade). |
| Amount fuzzing | Pass for the parser unit tests (negatives, decimals, exponents, unicode digits, non-strings). |
| Tampered price or user id in the body | Ignored. The server recomputes the quote from the locked coin. |
| Second grant | Pass. Unique signup grant plus single-use verification token. |
| `app_rw` UPDATE of a balance | Pass. Permission denied. |
| Illegal ledger shape (cash straight into the treasury) | Pass. The database rejects it. |
| Contract tamper and injected imbalance drills | Not run. They need a superuser in a throwaway database. The freeze function and the checker exist. |
| Password lockout | Implemented. Five failures lock the account for 15 minutes. |
| OTP brute force | Not applicable. Phone OTP is not the grant gate (see DECISIONS). |
| Admin self-approval | Blocked by a CHECK constraint and by `execute_admin_request`. |
| XSS | React text rendering. No `dangerouslySetInnerHTML`. CSP is set, with `unsafe-inline` because Next.js needs it for its bootstrap. |
| Link schemes, shorteners, private hosts | Pass in unit tests. |
| Uploads | Magic bytes, size, dimensions, sharp re-encode. SVG rejected. |
| Rate limits | In-memory per process. Spoofed `X-Forwarded-For` is ignored unless `TRUST_PROXY=1`. |
| SQL injection | Queries are parameterised. |

## Breach note

If personal data is exposed, tell the Information Regulator and the people affected, and rotate `IP_PEPPER`, `APP_DB_PASSWORD`, and SMTP credentials. Deleting an account removes email, name and date of birth. The anonymised ledger is kept so the books still balance.
