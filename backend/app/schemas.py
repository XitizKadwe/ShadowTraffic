from typing import Any

from pydantic import BaseModel, Field


class RecordTrafficRequest(BaseModel):
    method: str = Field(min_length=3, max_length=10)
    path: str = Field(min_length=2, max_length=512)
    query: dict[str, str] = Field(default_factory=dict)
    headers: dict[str, str] = Field(default_factory=dict)
    body: Any = None
    batch: bool = False
    service: str = Field(default="manual", min_length=1, max_length=80)
    source: str = Field(default="manual", min_length=1, max_length=80)


class CreateReplayRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    request_limit: int = Field(default=50, ge=1, le=100)
    concurrency: int = Field(default=2, ge=1, le=4)


class GenerateRegressionRequest(BaseModel):
    diff_ids: list[int] | None = None
