# AGENTS.md

## What this app is
`PARANORMAL-MONEY` — a small full-stack ledger for "paranormal" expenses.
React (Vite) frontend, FastAPI + SQLAlchemy API, Postgres database.

## Running it here (Base44 sandbox)
```bash
docker compose -f docker-compose.base44.yml up -d --build
```
- Host port **3000** is the preview entry point (Vite dev server). The API is also
  published on **8000**, but the browser only ever talks to `/api`, which Vite proxies
  to `http://api:8000` — single-origin, so no CORS or cross-origin cookie handling.
- The repo's own compose/production setup, if you add one, is unrelated to this file.

## Non-obvious things
- **Dependencies are installed at container start**, not baked into a project image:
  the `api` service runs `pip install -r backend/requirements.txt` and the `web`
  service runs `npm install` on every boot, then `exec`s the dev command. Both
  source trees are bind-mounted, so edits live-reload (uvicorn `--reload`, Vite HMR).
- **`web_node_modules` is a named volume**, so `frontend/node_modules` does not exist
  on the host. That is expected — don't `rm -rf` it looking for a stale install.
- **Python deps resolve at runtime**, so a `requirements.txt` change needs an
  `api` restart (`docker compose -f docker-compose.base44.yml restart api`), not a rebuild.
- **Postgres is seeded on first boot only**: `app/main.py` creates tables and inserts
  the demo rows when `transactions` is empty. To start from scratch:
  `docker compose -f docker-compose.base44.yml down -v`.
- **Receipt photos** are stored on their own volume: `RECEIPTS_DIR` (`/data/receipts`)
  holds `<transaction id>.<ext>`, served back by `GET /api/transactions/{id}/receipt`
  (images only, 8 MB cap, deleted together with the entry). `python-multipart` in
  `requirements.txt` is what makes the upload route importable at all.
- **No external credentials are required.** Postgres user/password are generated inline
  in the compose file (local infra, not user secrets); `secrets` in
  `.base44/environment.json` is intentionally empty. There is no `/run/base44/app.env`
  wiring because nothing needs it.

## The scout agent (money-in side)
- `backend/app/agent.py` reads **public** listings — RemoteOK, Arbeitnow, and GitHub's
  open `label:"bounty"` search — and stores new finds in the `opportunities` table,
  tagged with how they pay (Bitcoin / PayPal / Crypto). It is **read-only**: it never
  registers, applies, signs up or logs in anywhere. Nothing in the app creates accounts.
- It runs as a background asyncio task inside the API process: first sweep ~15s after
  boot, then every `AGENT_SCAN_INTERVAL_SECONDS` (default `21600` = 6h; `0` disables).
  `POST /api/agent/scan` runs one on demand. Both paths share `agent.run_scan()`.
- A sweep re-reads listings it already has and refreshes their payout/budget fields, so
  detection tweaks reach existing rows — no need to wipe the table.
- Every find is tagged by **payout type** (Bitcoin / PayPal / Crypto) and a **payout
  floor**: the lowest amount a listing says it pays, read from a quoted salary range or
  the first money amount in the body (`$500`, `50$`, `500 usd`). Coin-only rewards
  ("3 RTC") have no floor and read "floor unknown". `?min_floor=500` filters on it, and
  the list comes back highest floor first.
- **No credentials are needed.** General boards rarely state a payout method, so the
  default list filters to Bitcoin/PayPal (`?payout=btc-paypal`); `?payout=crypto` also
  includes token-denominated rewards (`1 RTC`, `0.5 SOL`) and `?payout=all` shows
  everything. Payout detection skips negated mentions ("No Stripe/PayPal needed").
- The `transactions`, `income` and `opportunities` tables are created by
  `Base.metadata.create_all` at startup — this project has no migration tool, so a new
  column on an already-created database needs either a manual
  `ALTER TABLE ... ADD COLUMN` (what a live sandbox DB needs, so existing entries
  survive: `docker compose -f docker-compose.base44.yml exec -T db psql -U paranormal -d
  paranormal_money -c "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_name
  varchar(240)"`) or a `down -v` reset.

## Sandbox-only overrides (gated on `BASE44_PREVIEW_MODE=1`)
The preview proxy reaches the dev server through a rotating hostname, which Vite would
otherwise reject. In `frontend/vite.config.js`, when `BASE44_PREVIEW_MODE === '1'`:
- `server.allowedHosts` gains `.${BASE44_SANDBOX_HOST_DOMAIN}` and
  `3000-${BASE44_PUBLIC_HOST_SUFFIX}`;
- `server.watch.usePolling` is enabled for bind-mounted source;
- the same flag turns on `WATCHFILES_FORCE_POLLING` for uvicorn (compose `${...:+1}`).
With the flag unset or any other value, none of this applies and Vite/uvicorn keep
their defaults. `BASE44_*` values are never hardcoded — they are passed through from
the environment.

## How to verify
```bash
curl -s localhost:3000/api/health          # {"status":"ok"} — through the Vite proxy
curl -s localhost:8000/api/transactions    # seeded rows from the API directly
curl -s localhost:8000/api/summary
docker compose -f docker-compose.base44.yml ps
```
Money in and the scout agent:
```bash
curl -s -X POST localhost:3000/api/agent/scan        # sweep now, returns the report
curl -s localhost:3000/api/agent/status              # last run, counts, last error
curl -s "localhost:3000/api/opportunities?payout=all&limit=5"
curl -s "localhost:3000/api/opportunities?payout=all&min_floor=500"   # floor filter
# attach a receipt to an entry (images only), then read it back inline:
curl -s -X POST localhost:3000/api/transactions/<id>/receipt -F "file=@/tmp/receipt.png"
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' \
  localhost:3000/api/transactions/<id>/receipt
curl -s -X POST localhost:3000/api/income -H 'Content-Type: application/json' \
  -d '{"description":"Bounty payout","category":"Bounty","amount":150,"payout_method":"Bitcoin","status":"confirmed"}'
```
A sweep takes ~10-20s (three sources fetched in series) and logs one line per failed
source in the report's `errors`; a dead source never fails the run.
Editing `frontend/src/**` should hot-reload; editing `backend/app/**` should restart uvicorn.
