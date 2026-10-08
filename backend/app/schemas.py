from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TransactionCreate(BaseModel):
    description: str = Field(min_length=1, max_length=200)
    category: str = Field(default="Other", max_length=60)
    amount: float = Field(gt=0)


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: str
    category: str
    amount: float
    created_at: datetime


class CategoryTotal(BaseModel):
    category: str
    total: float


class Summary(BaseModel):
    total: float
    count: int
    by_category: list[CategoryTotal]
