from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    byte_size: Mapped[int] = mapped_column(Integer)
    source_key: Mapped[str] = mapped_column(String(300))
    profile: Mapped[dict] = mapped_column(JSON)
    clean_options: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    clean_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    sample: Mapped[bool] = mapped_column(Boolean, default=False)


class DataRow(Base):
    __tablename__ = "data_rows"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"))
    row_number: Mapped[int] = mapped_column(Integer)
    values: Mapped[dict] = mapped_column(JSON)
    issues: Mapped[list] = mapped_column(JSON)
    has_issues: Mapped[bool] = mapped_column(Boolean)
    search_text: Mapped[str] = mapped_column(Text)
    __table_args__ = (
        Index("ix_data_rows_report_number", "report_id", "row_number", unique=True),
        Index("ix_data_rows_report_issues", "report_id", "has_issues"),
    )
