import os
from datetime import datetime
from pathlib import Path

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker


DATABASE_PATH = Path(
    os.getenv("SHADOWTRAFFIC_DATABASE", str(Path(__file__).resolve().parents[1] / "shadow_traffic.db"))
).resolve()
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{DATABASE_PATH.as_posix()}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base = declarative_base()


class CapturedRequest(Base):
    __tablename__ = "captured_requests"

    id = Column(Integer, primary_key=True, index=True)
    service = Column(String(80), nullable=False, default="manual")
    method = Column(String(10), nullable=False)
    path = Column(String(512), nullable=False)
    query_json = Column(Text, nullable=False, default="{}")
    headers_json = Column(Text, nullable=False, default="{}")
    body_json = Column(Text, nullable=True)
    source = Column(String(80), nullable=False, default="manual")
    recorded_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    results = relationship("TrafficDiffResult", back_populates="captured_request")


class ReplayRun(Base):
    __tablename__ = "replay_runs"

    id = Column(String(24), primary_key=True)
    name = Column(String(120), nullable=False)
    status = Column(String(16), nullable=False, default="queued", index=True)
    request_limit = Column(Integer, nullable=False)
    concurrency = Column(Integer, nullable=False)
    processed_count = Column(Integer, nullable=False, default=0)
    diff_count = Column(Integer, nullable=False, default=0)
    error_count = Column(Integer, nullable=False, default=0)
    diff_rate = Column(Float, nullable=False, default=0)
    baseline_p95_ms = Column(Float, nullable=True)
    candidate_p95_ms = Column(Float, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    results = relationship("TrafficDiffResult", back_populates="run", cascade="all, delete-orphan")


class TrafficDiffResult(Base):
    __tablename__ = "traffic_diff_results"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(String(24), ForeignKey("replay_runs.id"), nullable=False, index=True)
    captured_request_id = Column(Integer, ForeignKey("captured_requests.id"), nullable=False)
    has_diff = Column(Boolean, nullable=False, default=False, index=True)
    differences_json = Column(Text, nullable=False, default="[]")
    baseline_response_json = Column(Text, nullable=False)
    candidate_response_json = Column(Text, nullable=False)
    baseline_latency_ms = Column(Float, nullable=False)
    candidate_latency_ms = Column(Float, nullable=False)
    request_error = Column(Boolean, nullable=False, default=False)

    run = relationship("ReplayRun", back_populates="results")
    captured_request = relationship("CapturedRequest", back_populates="results")


class RegressionCase(Base):
    __tablename__ = "regression_cases"

    id = Column(String(24), primary_key=True)
    source_diff_id = Column(Integer, ForeignKey("traffic_diff_results.id"), nullable=False, unique=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

