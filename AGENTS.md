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
- **No external credentials are required.** Postgres user/password are generated inline
  in the compose file (local infra, not user secrets); `secrets` in
  `.base44/environment.json` is intentionally empty. There is no `/run/base44/app.env`
  wiring because nothing needs it.

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
Editing `frontend/src/**` should hot-reload; editing `backend/app/**` should restart uvicorn.
