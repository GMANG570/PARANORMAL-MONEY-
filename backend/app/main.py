import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from . import agent, models, schemas
from .db import Base, SessionLocal, engine, get_db

SEED_TRANSACTIONS = [
    {"description": "Midnight séance deposit", "category": "Séance", "amount": 120.0},
    {"description": "Backup salt circle", "category": "Salt & Iron", "amount": 34.5},
    {"description": "Ectoplasm mop rental", "category": "Ectoplasm", "amount": 18.75},
    {"description": "Cursed amulet (returns accepted)", "category": "Cursed Relics", "amount": 210.0},
    {"description": "Haunted attic tour, off-peak", "category": "Ghost Tours", "amount": 45.0},
    {"description": "Emergency exorcism, house call", "category": "Exorcism", "amount": 400.0},
]

# Receipt photos are written here (a compose volume) and streamed back per entry.
RECEIPTS_DIR = Path(os.environ.get("RECEIPTS_DIR", "/data/receipts"))
MAX_RECEIPT_BYTES = 8 * 1024 * 1024


def _receipt_file(transaction_id: int) -> Path | None:
    matches = sorted(RECEIPTS_DIR.glob(f"{transaction_id}.*"))
    return matches[0] if matches else None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)
    with SessionLocal() as db:
        empty = db.scalar(select(func.count()).select_from(models.Transaction)) == 0
        if empty:
            db.add_all(models.Transaction(**row) for row in SEED_TRANSACTIONS)
            db.commit()

    # The scout agent keeps looking while this process lives; 0 disables it.
    interval = agent.interval_seconds()
    scout = asyncio.create_task(agent.run_forever(interval)) if interval > 0 else None
    try:
        yield
    finally:
        if scout:
            scout.cancel()


app = FastAPI(title="Paranormal Money API", lifespan=lifespan)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/transactions", response_model=list[schemas.TransactionOut])
def list_transactions(db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Transaction).order_by(models.Transaction.created_at.desc())
    ).all()


@app.post(
    "/api/transactions",
    response_model=schemas.TransactionOut,
    status_code=201,
)
def create_transaction(payload: schemas.TransactionCreate, db: Session = Depends(get_db)):
    transaction = models.Transaction(**payload.model_dump())
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


@app.post(
    "/api/transactions/{transaction_id}/receipt",
    response_model=schemas.TransactionOut,
)
async def upload_receipt(
    transaction_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    transaction = db.get(models.Transaction, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Receipt must be an image file")

    data = await file.read(MAX_RECEIPT_BYTES + 1)
    if len(data) > MAX_RECEIPT_BYTES:
        raise HTTPException(status_code=413, detail="Receipt image must be under 8 MB")

    suffix = Path(file.filename or "").suffix.lower()[:10] or ".jpg"
    for previous in RECEIPTS_DIR.glob(f"{transaction.id}.*"):
        previous.unlink(missing_ok=True)
    (RECEIPTS_DIR / f"{transaction.id}{suffix}").write_bytes(data)

    transaction.receipt_name = (file.filename or f"{transaction.id}{suffix}")[:240]
    db.commit()
    db.refresh(transaction)
    return transaction


@app.get("/api/transactions/{transaction_id}/receipt")
def get_receipt(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.get(models.Transaction, transaction_id)
    if transaction is None or not transaction.receipt_name:
        raise HTTPException(status_code=404, detail="No receipt for this entry")
    stored = _receipt_file(transaction_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Receipt file is missing")
    return FileResponse(
        stored, filename=transaction.receipt_name, content_disposition_type="inline"
    )


@app.delete("/api/transactions/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.get(models.Transaction, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    stored = _receipt_file(transaction_id)
    db.delete(transaction)
    db.commit()
    if stored:
        stored.unlink(missing_ok=True)
    return Response(status_code=204)


@app.get("/api/income", response_model=list[schemas.IncomeOut])
def list_income(db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Income).order_by(models.Income.received_at.desc())
    ).all()


@app.post("/api/income", response_model=schemas.IncomeOut, status_code=201)
def create_income(payload: schemas.IncomeCreate, db: Session = Depends(get_db)):
    income = models.Income(**payload.model_dump(exclude_none=True))
    db.add(income)
    db.commit()
    db.refresh(income)
    return income


@app.delete("/api/income/{income_id}", status_code=204)
def delete_income(income_id: int, db: Session = Depends(get_db)):
    income = db.get(models.Income, income_id)
    if income is None:
        raise HTTPException(status_code=404, detail="Income not found")
    db.delete(income)
    db.commit()
    return Response(status_code=204)


@app.get("/api/summary/monthly", response_model=list[schemas.MonthlyTotal])
def monthly_summary(db: Session = Depends(get_db)):
    spend_month = func.to_char(models.Transaction.created_at, "YYYY-MM").label("month")
    spend_rows = db.execute(
        select(spend_month, func.sum(models.Transaction.amount), func.count()).group_by(
            spend_month
        )
    ).all()

    income_month = func.to_char(models.Income.received_at, "YYYY-MM").label("month")
    pending_income = func.coalesce(
        func.sum(case((models.Income.status == "pending", models.Income.amount), else_=0.0)),
        0.0,
    )
    income_rows = db.execute(
        select(income_month, func.sum(models.Income.amount), pending_income).group_by(
            income_month
        )
    ).all()

    months: dict[str, dict] = {}
    for month, amount, count in spend_rows:
        months[month] = {
            "total": float(amount),
            "count": int(count),
            "income": 0.0,
            "income_pending": 0.0,
            "income_confirmed": 0.0,
        }
    for month, amount, pending in income_rows:
        entry = months.setdefault(
            month,
            {
                "total": 0.0,
                "count": 0,
                "income": 0.0,
                "income_pending": 0.0,
                "income_confirmed": 0.0,
            },
        )
        entry["income"] = float(amount)
        entry["income_pending"] = float(pending or 0.0)
        entry["income_confirmed"] = entry["income"] - entry["income_pending"]

    return [schemas.MonthlyTotal(month=month, **months[month]) for month in sorted(months)]


@app.get("/api/summary", response_model=schemas.Summary)
def summary(db: Session = Depends(get_db)):
    total = db.scalar(select(func.coalesce(func.sum(models.Transaction.amount), 0.0)))
    count = db.scalar(select(func.count()).select_from(models.Transaction))
    rows = db.execute(
        select(
            models.Transaction.category,
            func.sum(models.Transaction.amount),
        )
        .group_by(models.Transaction.category)
        .order_by(func.sum(models.Transaction.amount).desc())
    ).all()

    income_total = db.scalar(select(func.coalesce(func.sum(models.Income.amount), 0.0)))
    income_pending = db.scalar(
        select(func.coalesce(func.sum(models.Income.amount), 0.0)).where(
            models.Income.status == "pending"
        )
    )
    income_count = db.scalar(select(func.count()).select_from(models.Income))

    spend = float(total or 0.0)
    earned = float(income_total or 0.0)
    return schemas.Summary(
        total=spend,
        count=int(count or 0),
        by_category=[
            schemas.CategoryTotal(category=category, total=float(amount))
            for category, amount in rows
        ],
        income_total=earned,
        income_pending=float(income_pending or 0.0),
        income_count=int(income_count or 0),
        net=earned - spend,
    )


@app.get("/api/opportunities", response_model=list[schemas.OpportunityOut])
def list_opportunities(
    payout: str = "btc-paypal",
    status: str | None = None,
    min_floor: float | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    stmt = select(models.Opportunity).order_by(
        models.Opportunity.payout_floor.is_(None),
        models.Opportunity.payout_floor.desc(),
        models.Opportunity.discovered_at.desc(),
    )
    if payout == "btc-paypal":
        stmt = stmt.where(models.Opportunity.payout_method.in_(("Bitcoin", "PayPal")))
    elif payout == "crypto":
        stmt = stmt.where(
            models.Opportunity.payout_method.in_(("Bitcoin", "PayPal", "Crypto"))
        )
    if min_floor is not None:
        stmt = stmt.where(models.Opportunity.payout_floor >= min_floor)
    if status:
        stmt = stmt.where(models.Opportunity.status == status)
    else:
        stmt = stmt.where(models.Opportunity.status != "dismissed")
    return db.scalars(stmt.limit(limit)).all()


@app.patch("/api/opportunities/{opportunity_id}", response_model=schemas.OpportunityOut)
def update_opportunity(
    opportunity_id: int, payload: schemas.OpportunityStatus, db: Session = Depends(get_db)
):
    opportunity = db.get(models.Opportunity, opportunity_id)
    if opportunity is None:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    opportunity.status = payload.status
    db.commit()
    db.refresh(opportunity)
    return opportunity


def _agent_status(db: Session) -> schemas.AgentStatus:
    rows = db.execute(
        select(models.Opportunity.status, func.count()).group_by(models.Opportunity.status)
    ).all()
    stored = {status: int(count) for status, count in rows}
    stored["total"] = sum(stored.values())
    return schemas.AgentStatus(
        interval_seconds=agent.STATUS["interval_seconds"] or 0,
        last_run=agent.STATUS["last_run"],
        last_discovery=db.scalar(select(func.max(models.Opportunity.discovered_at))),
        last_report=agent.STATUS["last_report"],
        last_error=agent.STATUS["last_error"],
        stored=stored,
    )


@app.get("/api/agent/status", response_model=schemas.AgentStatus)
def agent_status(db: Session = Depends(get_db)):
    return _agent_status(db)


@app.post("/api/agent/scan", response_model=schemas.AgentStatus)
def run_agent_scan(db: Session = Depends(get_db)):
    agent.run_scan()
    return _agent_status(db)
