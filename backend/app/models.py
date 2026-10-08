from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String

from .db import Base


class Transaction(Base):
    """A single charge against the spirit budget."""

    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    description = Column(String(200), nullable=False)
    category = Column(String(60), nullable=False, default="Other")
    amount = Column(Float, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class Income(Base):
    """Money coming in, so the ledger shows both directions."""

    __tablename__ = "income"

    id = Column(Integer, primary_key=True)
    description = Column(String(200), nullable=False)
    source = Column(String(200), nullable=False, default="")
    category = Column(String(60), nullable=False, default="Other")
    amount = Column(Float, nullable=False)
    payout_method = Column(String(40), nullable=False, default="Unknown")
    status = Column(String(20), nullable=False, default="pending")
    received_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class Opportunity(Base):
    """A paid opportunity the scout agent found. Read-only discovery: nothing here
    was registered, applied or signed up for on your behalf."""

    __tablename__ = "opportunities"

    id = Column(Integer, primary_key=True)
    title = Column(String(300), nullable=False)
    url = Column(String(600), nullable=False, unique=True)
    source = Column(String(120), nullable=False)
    kind = Column(String(40), nullable=False, default="gig")
    payout_method = Column(String(40), nullable=False, default="Unknown")
    payout_text = Column(String(200))
    budget_text = Column(String(120))
    status = Column(String(20), nullable=False, default="new")
    discovered_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
