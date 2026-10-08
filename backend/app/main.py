from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models, schemas
from .db import Base, SessionLocal, engine, get_db

SEED_TRANSACTIONS = [
    {"description": "Midnight séance deposit", "category": "Séance", "amount": 120.0},
    {"description": "Backup salt circle", "category": "Salt & Iron", "amount": 34.5},
    {"description": "Ectoplasm mop rental", "category": "Ectoplasm", "amount": 18.75},
    {"description": "Cursed amulet (returns accepted)", "category": "Cursed Relics", "amount": 210.0},
    {"description": "Haunted attic tour, off-peak", "category": "Ghost Tours", "amount": 45.0},
    {"description": "Emergency exorcism, house call", "category": "Exorcism", "amount": 400.0},
]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        empty = db.scalar(select(func.count()).select_from(models.Transaction)) == 0
        if empty:
            db.add_all(models.Transaction(**row) for row in SEED_TRANSACTIONS)
            db.commit()
    yield


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


@app.delete("/api/transactions/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.get(models.Transaction, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(transaction)
    db.commit()
    return Response(status_code=204)


@app.get("/api/summary/monthly", response_model=list[schemas.MonthlyTotal])
def monthly_summary(db: Session = Depends(get_db)):
    month = func.to_char(models.Transaction.created_at, "YYYY-MM").label("month")
    rows = db.execute(
        select(month, func.sum(models.Transaction.amount), func.count())
        .group_by(month)
        .order_by(month)
    ).all()
    return [
        schemas.MonthlyTotal(month=key, total=float(amount), count=int(count))
        for key, amount, count in rows
    ]


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
    return schemas.Summary(
        total=float(total or 0.0),
        count=int(count or 0),
        by_category=[
            schemas.CategoryTotal(category=category, total=float(amount))
            for category, amount in rows
        ],
    )
