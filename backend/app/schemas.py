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
    receipt_name: str | None = None
    created_at: datetime


class CategoryTotal(BaseModel):
    category: str
    total: float


class Summary(BaseModel):
    total: float
    count: int
    by_category: list[CategoryTotal]
    income_total: float
    income_pending: float
    income_count: int
    net: float


class MonthlyTotal(BaseModel):
    month: str
    total: float
    count: int
    income: float
    income_confirmed: float = 0.0
    income_pending: float = 0.0


class IncomeCreate(BaseModel):
    description: str = Field(min_length=1, max_length=200)
    source: str = Field(default="", max_length=200)
    category: str = Field(default="Other", max_length=60)
    amount: float = Field(gt=0)
    payout_method: str = Field(default="Unknown", max_length=40)
    status: str = Field(default="pending", pattern="^(pending|confirmed)$")
    received_at: datetime | None = None


class IncomeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: str
    source: str
    category: str
    amount: float
    payout_method: str
    status: str
    received_at: datetime


class OpportunityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    url: str
    source: str
    kind: str
    payout_method: str
    payout_text: str | None
    budget_text: str | None
    payout_floor: float | None = None
    status: str
    discovered_at: datetime


class OpportunityStatus(BaseModel):
    status: str = Field(pattern="^(new|shortlisted|dismissed)$")


class AgentStatus(BaseModel):
    interval_seconds: int
    last_run: datetime | None
    last_discovery: datetime | None
    last_report: dict | None
    last_error: str | None
    stored: dict[str, int]


class PageElement(BaseModel):
    label: str
    kind: str
    url: str | None = None


class PageView(BaseModel):
    url: str
    title: str
    text: str
    links: list[PageElement]
    buttons: list[PageElement]
    icons: list[PageElement]


class FollowLink(BaseModel):
    index: int = Field(ge=0)


class VoiceCommand(BaseModel):
    phrase: str = Field(min_length=1, max_length=400)


class VoiceResult(BaseModel):
    intent: str
    reply: str
    payload: dict | None = None
