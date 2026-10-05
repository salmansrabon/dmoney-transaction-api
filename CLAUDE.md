# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Node.js/Express REST API for a mobile-money style ledger system (DMoney), modeled on
bKash/Nagad-type flows: Users have roles (Admin, Agent, Customer, Merchant, SYSTEM) and move
money between each other via Deposit, Withdraw, SendMoney, Payment, and Stripe cash-in
transactions. There is no `balance` column anywhere — every balance is derived by summing
ledger rows in the `Transactions` table at query time.

## Commands

```bash
npm run dev      # start with nodemon (auto-reload), reads PORT from env (default 3000)
npm start        # start with plain node

# One-off DB migration / maintenance scripts (no CLI framework, no sequelize-cli) — run directly:
node migrations/<file>.js
node add_role_index.js

# Manual integration test scripts (no test runner/framework wired up — `tests/` are standalone
# scripts invoked directly, NOT jest/mocha specs; there is no `npm test` script):
node tests/sendPersonalEmail.test.js [recipientEmail]
node tests/sendServiceAccountEmail.test.js [recipientEmail]
```

There is no lint config and no `npm test` script, despite `.github/workflows/node.js.yml` invoking
`npm test` on push/PR to `main` — that CI step currently has nothing to run.

## Environment configuration (inconsistent across the codebase — read before touching env loading)

Three different env-loading conventions coexist:
- `sequelizeModel/db.js` (the single Sequelize connection used everywhere) always calls
  `require('custom-env').env('dev')`, which loads **`.env.dev`** regardless of `NODE_ENV`.
- `jwtMiddleware.js` and some migrations use plain `require('dotenv').config()`, which loads **`.env`**.
- Other migrations/tests explicitly load `.env` via an absolute path
  (`dotenv.config({ path: path.join(__dirname, '../.env') })`).

Practically: DB connection settings come from `.env.dev`; JWT/partner-key/mail secrets come from
`.env`. Both files must be kept in sync for DB_* values, or the app will silently connect to the
wrong database. When adding a new script, check which loader sibling scripts in the same directory
use before assuming `.env`.

Key env vars (see `.env.example`): `DB_HOST/DB_NAME/DB_USER/DB_PASSWORD/DB_PORT`,
`ACCESS_TOKEN_SECRET`, `expires_in`, `PARTNER_KEY` (required in `X-AUTH-SECRET-KEY` header for
`authenticateJWT`-protected routes), `DEFAULT_OTP` (dev-only OTP bypass value), `STRIPE_SECRET_KEY`,
`SEND_MAIL`, `EMAIL_*` (Gmail SMTP fallback), `FRONTEND_URL`, `DISCOUNT_CODE`.

`config/gmail-service-account.json` (gitignored) is optional — when present, `gmailPersonalHelper.js`
sends mail via a Google Service Account; when absent it falls back to Nodemailer/Gmail SMTP using
the `EMAIL_*` vars.

## Architecture

**Layering:** `routes/*.route.js` → `controllers/**/*.controller.js` → `sequelizeModel/*.js` (models)
+ `services/*.js` (shared business logic). There is no separate repository/DAO layer — controllers
call Sequelize models and raw `sequelize.query` directly.

- `app.js` wires middleware, mounts three route files (`user.route.js`, `transaction.route.js`,
  `default.route.js`) all at `/`, and mounts Swagger UI at `/api-docs/user` and `/api-docs/transaction`.
  A catch-all 404 handler and a global JSON error handler sit at the bottom.
- `server.js` just creates the HTTP server from `app.js` and listens on `process.env.PORT`.
- `sequelizeModel/db.js` is the single Sequelize instance (MySQL, `logging: false`). Model files call
  `sequelize.sync()` themselves at import time and several **seed data on startup** (`Users.js` seeds
  SYSTEM/Admin/test accounts, `Transactions.js` seeds a `TRNX1001` SYSTEM opening-balance row) —
  importing a model has side effects, not just schema declaration.
- `jwtMiddleware.js` exports two guards:
  - `authenticateJWT` — requires both a `Bearer` JWT **and** a matching `X-AUTH-SECRET-KEY: PARTNER_KEY`
    header. Used on write/admin-ish routes.
  - `publicAuthenticateJWT` — JWT only, no partner-key check. Used on read-only user lookup routes.
  Both throw raw, unhandled errors on missing/invalid token in the `publicAuthenticateJWT` path
  (relies on the global error handler in `app.js`), whereas `authenticateJWT` returns responses inline.

**Ledger model (`sequelizeModel/Transactions.js`):** every money movement writes exactly one `debit`
row and one `credit` row (same `trnxId`, both tagged with a `transaction_type` like `Deposit`,
`Withdraw`, `SendMoney`, `Payment`, `StripeCashIn`, `AdminDeposit`). A user's balance is always
`SUM(credit) - SUM(debit)` over rows where `account = <phone_number>`, computed on the fly
(`services/getBalance.js`, and inline in `services/limitChecker.js`). There is deliberately no
stored balance column — do not add one; keep balance derivation consistent with existing queries.

**Transaction controllers (`controllers/transactions/*.controller.js`)** follow one recurring pattern
— see `deposit.controller.js` as the canonical example:
1. Validate amount, look up `from_account`/`to_account` in `Users` by `phone_number`.
2. Authorize: the JWT's `req.user.identifier` must match the `from_account` holder's phone or email
   (case-insensitive).
3. Check both accounts are `status = 'active'` and have the expected `role` for the operation.
4. Load fee/commission config for the transaction type from `Commission.getConfig(type)`
   (`sequelizeModel/Commission.js`) — falls back to hardcoded defaults if no active DB rule exists.
5. Wrap the balance check + ledger writes in `sequelize.transaction(...)` at
   `Transaction.ISOLATION_LEVELS.READ_COMMITTED`, using `SELECT ... FOR UPDATE` on the raw
   `Transactions` table to lock the payer's (and sometimes payee's) running balance before writing,
   preventing concurrent over-spend/over-cap races.
6. Map specific thrown error messages (`INSUFFICIENT_BALANCE`, `CUSTOMER_CAP_EXCEEDED`,
   `AMOUNT_EXCEEDS_REMAINING_LIMIT`, ...) to HTTP responses — note **208** is used (non-standard here)
   for "transaction understood but not performed due to a business rule" (insufficient balance, limit
   exceeded), not 400/409.

When adding a new transaction type, follow this same lock-then-write-both-rows-in-one-transaction
shape rather than separate debit/credit calls outside a transaction — the existing code relies on
`FOR UPDATE` row locking specifically to prevent double-spend under concurrent requests.

`services/limitChecker.js` enforces **daily/monthly** cumulative limits per customer
(`TransactionLimit` model) on top of the Commission-derived min/max per-transaction limits — it sums
debit rows for `SendMoney`/`Payment`/`Withdraw` since the start of the period. `totalDebit` passed in
must already include fees, since the historical `debit` column it compares against also includes fees.

**Commission/fee config (`sequelizeModel/Commission.js`):** rules are DB-driven
(`transaction_type` + `recipient` [`SYSTEM`/`Agent`/`Merchant`] + `fee_type` [`percentage`/`flat`]).
`Commission.getConfig(type)` flattens active rules into a convenience object
(`agentCommissionRate`, `merchantCommissionRate`, `serviceFeeRate`, `minTxnAmount`, `maxTxnAmount`).
`Commission.calcFee(rule, amount)` applies `min_fee` as a floor. Per repo history, merchants do not
currently receive commission on payments — check current `Commissions` table rows/`recipient` values
before assuming a role earns a fee.

**Auth/OTP:** `controllers/users/user.controller.js` handles register/login/OTP-verify; there is a
**dev-only bypass**: `?env=dev` query param combined with an OTP equal to `process.env.DEFAULT_OTP`
skips expiry/match checks. Don't rely on this path in anything production-facing.
`controllers/users/forgotPassword.controller.js` handles the reset-token email flow via the unified
mailer in `services/emailHelper.js` / `services/gmailPersonalHelper.js`.

**Migrations (`migrations/*.js`):** plain idempotent Node scripts, not sequelize-cli migrations —
each checks `INFORMATION_SCHEMA` for the column/table/index before altering, then calls
`sequelize.close()`. Run manually with `node migrations/<file>.js`; there is no migration runner or
tracking table, so order/idempotency must be maintained by hand in each script.

## Known rough edges worth knowing before touching adjacent code

- `services/getBalance.js` builds its SQL via string concatenation rather than parameterized
  `replacements` (unlike every other query in the codebase). Don't copy this pattern into new code —
  use `sequelize.query(..., { replacements: [...] })` as done elsewhere (e.g. `limitChecker.js`,
  `deposit.controller.js`).
- Swagger docs are hand-maintained YAML (`swagger/swaggerUser.yaml`, `swagger/swaggerTrnx.yaml`), not
  generated from route/controller JSDoc — update them manually when changing request/response shapes.
  `swagger/API_ENDPOINTS_SUMMARY.md` is a human-readable mirror of the same endpoints; keep it in sync
  too when adding/changing routes.
