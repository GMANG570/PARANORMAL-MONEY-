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
