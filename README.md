# PARANORMAL-MONEY

A small full-stack ledger for paranormal expenses — every séance, salt line and
spirit fee, tracked to the cent.

- `frontend/` — React (Vite) single-page app
- `backend/` — FastAPI + SQLAlchemy API backed by Postgres

## Run it

```bash
docker compose -f docker-compose.base44.yml up -d
```

Then open <http://localhost:3000>. The API is also published on <http://localhost:8000>
(`/api/transactions`, `/api/summary`, `/api/health`); the browser talks to it through
the Vite dev server's `/api` proxy.

Postgres is seeded with demo entries on first boot. To reset:
`docker compose -f docker-compose.base44.yml down -v`.

See `AGENTS.md` for sandbox-specific setup notes.
