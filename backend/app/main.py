import io
import json
import logging
import re
import time
from contextlib import asynccontextmanager
from datetime import timezone
from functools import wraps
from pathlib import Path
from threading import BoundedSemaphore
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, func, insert, select, text
from sqlalchemy.orm import Session, sessionmaker
from starlette.concurrency import run_in_threadpool

from .analysis import (
    DatasetError,
    clean_dataset,
    normalized,
    parse_csv,
    profile_dataset,
    sample_csv,
    spreadsheet_safe_csv,
)
from .auth import Authentication
from .config import Settings, settings
from .models import Account, AuthSession, Base, DataRow, Report
from .storage import DatabaseStorage, Storage

logger = logging.getLogger("datadock")
logger.setLevel(logging.INFO)
if not logger.handlers:
    logger.addHandler(logging.StreamHandler())
logger.propagate = False


class CleanOptions(BaseModel):
    trim_whitespace: bool = True
    drop_duplicates: bool = True
    drop_empty_rows: bool = True


def create_app(config: Settings = settings) -> FastAPI:
    if config.database_url.startswith("sqlite") and ":memory:" not in config.database_url:
        Path(config.database_url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        config.database_url,
        pool_pre_ping=True,
        **(
            {"connect_args": {"check_same_thread": False}} if config.database_url.startswith("sqlite") else {}
        ),
    )
    sessions = sessionmaker(engine, expire_on_commit=False)
    storage = DatabaseStorage(sessions) if config.storage_backend == "database" else Storage(config)
    work_slot = BoundedSemaphore(1)

    def bounded_work(function):
        @wraps(function)
        def run(*args, **kwargs):
            if not work_slot.acquire(blocking=False):
                raise HTTPException(429, "Another dataset is being processed. Please try again in a moment.")
            try:
                return function(*args, **kwargs)
            finally:
                work_slot.release()

        return run

    @asynccontextmanager
    async def lifespan(_app):
        # Version 1 schema. Future schema changes require explicit migrations.
        Base.metadata.create_all(engine)
        yield
        engine.dispose()

    app = FastAPI(
        title="DataDock API",
        version="1.0.0",
        description="CSV quality analysis and reporting. Start with /api/session; use its CSRF token for writes.",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )

    def db():
        with sessions() as session:
            yield session

    authentication = Authentication(config, sessions)
    owner = authentication.owner
    app.include_router(authentication.router())

    def owned_report(report_id: str, session: Session, owner_id: str) -> Report:
        report = session.scalar(select(Report).where(Report.id == report_id, Report.owner == owner_id))
        if report is None:
            raise HTTPException(404, "This report was not found in your workspace.")
        return report

    def summary(report: Report):
        stamp = report.created_at
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=timezone.utc)
        return {
            "id": report.id,
            "name": report.name,
            "created_at": stamp.isoformat(),
            "byte_size": report.byte_size,
            "sample": report.sample,
            "row_count": report.profile["row_count"],
            "column_count": report.profile["column_count"],
            "quality_score": report.profile["quality_score"],
            "issue_rows": report.profile["issue_rows"],
            "clean_summary": report.clean_summary,
        }

    @app.middleware("http")
    async def request_metadata(request: Request, call_next):
        request_id = str(uuid4())
        start = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Server-Timing"] = f"app;dur={(time.perf_counter() - start) * 1000:.2f}"
        logger.info(
            json.dumps(
                {
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": round((time.perf_counter() - start) * 1000, 2),
                }
            )
        )
        return response

    @app.get("/api/health")
    def health(session: Session = Depends(db)):
        session.execute(text("SELECT 1"))
        return {"status": "ok", "version": "1.0.0", "database": "ready"}

    @bounded_work
    def create_report(content: bytes, name: str, owner_id: str, session: Session, is_sample=False):
        # Serialize quota checks and guest migration for this workspace across instances.
        if len(owner_id) == 36:
            session.scalar(select(Account).where(Account.id == owner_id).with_for_update())
        else:
            session.scalar(select(AuthSession).where(AuthSession.token_hash == owner_id).with_for_update())
        count = session.scalar(select(func.count()).select_from(Report).where(Report.owner == owner_id))
        if count >= config.max_reports_per_session:
            raise HTTPException(429, "This workspace has reached its 30-report limit.")
        total = session.scalar(select(func.count()).select_from(Report))
        if total >= config.max_reports_total:
            raise HTTPException(503, "Storage is currently full. Please try again later.")
        try:
            frame = parse_csv(content, config)
            profile, issues = profile_dataset(frame)
        except DatasetError as exc:
            raise HTTPException(422, str(exc)) from exc
        report_id = str(uuid4())
        key = f"{owner_id}/{report_id}/source.csv"
        report = Report(
            id=report_id,
            owner=owner_id,
            name=name,
            byte_size=len(content),
            source_key=key,
            profile=profile,
            sample=is_sample,
        )
        storage.put(key, content)
        try:
            session.add(report)
            session.flush()
            records = frame.to_dict(orient="records")
            for start in range(0, len(records), 1000):
                session.execute(
                    insert(DataRow),
                    [
                        {
                            "report_id": report_id,
                            "row_number": i + 1,
                            "values": values,
                            "issues": issues[i],
                            "has_issues": bool(issues[i]),
                            "search_text": " | ".join(str(v) for v in values.values()).lower(),
                        }
                        for i, values in enumerate(records[start : start + 1000], start=start)
                    ],
                )
            session.commit()
        except Exception:
            session.rollback()
            storage.delete(key)
            raise
        return {**summary(report), "profile": profile, "clean_options": report.clean_options}

    @app.post("/api/reports", status_code=201)
    async def upload(
        file: UploadFile = File(...), owner_id: str = Depends(owner), session: Session = Depends(db)
    ):
        try:
            if not file.filename or not file.filename.lower().endswith(".csv"):
                raise HTTPException(422, "Choose a .csv file.")
            content = await file.read(config.max_upload_bytes + 1)
            if len(content) > config.max_upload_bytes:
                raise HTTPException(
                    413, f"This file exceeds the {config.max_upload_bytes // (1024 * 1024)} MB limit."
                )
            name = re.sub(r"[^\w .()\-]", "_", file.filename.replace("\\", "/").split("/")[-1])[:180]
            return await run_in_threadpool(create_report, content, name, owner_id, session)
        finally:
            await file.close()

    @app.post("/api/sample", status_code=201)
    def sample(owner_id: str = Depends(owner), session: Session = Depends(db)):
        previous = session.scalar(
            select(Report)
            .where(Report.owner == owner_id, Report.sample.is_(True))
            .order_by(Report.created_at.desc())
        )
        if previous:
            return {**summary(previous), "profile": previous.profile, "clean_options": previous.clean_options}
        return create_report(sample_csv(), "research_programs_2026.csv", owner_id, session, True)

    @app.get("/api/sample.csv")
    def download_sample():
        return Response(
            sample_csv(),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="research_programs_2026.csv"'},
        )

    @app.get("/api/reports")
    def reports(owner_id: str = Depends(owner), session: Session = Depends(db)):
        return [
            summary(report)
            for report in session.scalars(
                select(Report).where(Report.owner == owner_id).order_by(Report.created_at.desc())
            )
        ]

    @app.get("/api/reports/{report_id}")
    def report_detail(report_id: str, owner_id: str = Depends(owner), session: Session = Depends(db)):
        report = owned_report(report_id, session, owner_id)
        return {**summary(report), "profile": report.profile, "clean_options": report.clean_options}

    @app.get("/api/reports/{report_id}/rows")
    def rows(
        report_id: str,
        page: int = Query(1, ge=1),
        page_size: int = Query(25, ge=1, le=100),
        issues_only: bool = False,
        search: str = Query("", max_length=100),
        owner_id: str = Depends(owner),
        session: Session = Depends(db),
    ):
        report = owned_report(report_id, session, owner_id)
        filters = [DataRow.report_id == report_id]
        if issues_only:
            filters.append(DataRow.has_issues.is_(True))
        if search:
            filters.append(DataRow.search_text.contains(search.lower(), autoescape=True))
        total = session.scalar(select(func.count()).select_from(DataRow).where(*filters))
        values = session.scalars(
            select(DataRow)
            .where(*filters)
            .order_by(DataRow.row_number)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return {
            "rows": [{"row_number": r.row_number, "values": r.values, "issues": r.issues} for r in values],
            "total": total,
            "page": page,
            "page_size": page_size,
            "columns": [c["name"] for c in report.profile["columns"]],
        }

    @app.get("/api/reports/{report_id}/chart")
    @bounded_work
    def chart(
        report_id: str,
        category: str,
        metric: str = "",
        aggregation: str = Query("sum", pattern="^(sum|mean|count)$"),
        owner_id: str = Depends(owner),
        session: Session = Depends(db),
    ):
        report = owned_report(report_id, session, owner_id)
        columns = {c["name"]: c for c in report.profile["columns"]}
        if category not in columns or (
            aggregation != "count" and (metric not in columns or columns[metric]["kind"] != "number")
        ):
            raise HTTPException(422, "Choose a category and a numeric measure from this dataset.")
        frame = normalized(parse_csv(storage.get(report.source_key), config))
        group_labels = frame[category].replace("", "(Missing)")
        if aggregation == "count":
            grouped = group_labels.value_counts()
        else:
            from .analysis import numeric_values

            values = numeric_values(frame[metric])
            groups = values.groupby(group_labels, dropna=False)
            grouped = groups.sum(min_count=1) if aggregation == "sum" else groups.mean()
        grouped = grouped.dropna().sort_values(ascending=False)
        return {
            "data": [
                {"label": str(label), "value": round(float(value), 2)}
                for label, value in grouped.head(12).items()
            ],
            "categories": len(grouped),
            "shown": min(12, len(grouped)),
            "basis": "Original data, with whitespace trimmed. Includes duplicates; missing and invalid numeric values are excluded from numeric aggregation.",
        }

    @app.post("/api/reports/{report_id}/clean")
    @bounded_work
    def clean(
        report_id: str, options: CleanOptions, owner_id: str = Depends(owner), session: Session = Depends(db)
    ):
        report = owned_report(report_id, session, owner_id)
        frame = parse_csv(storage.get(report.source_key), config)
        _, result = clean_dataset(frame, options.model_dump())
        report.clean_options = options.model_dump()
        report.clean_summary = result
        session.commit()
        return {"options": options, "summary": result}

    @app.get("/api/reports/{report_id}/export")
    @bounded_work
    def export(
        report_id: str,
        format: str = Query("csv", pattern="^(csv|json)$"),
        owner_id: str = Depends(owner),
        session: Session = Depends(db),
    ):
        report = owned_report(report_id, session, owner_id)
        if format == "json":
            content = json.dumps(
                {**summary(report), "profile": report.profile, "clean_options": report.clean_options},
                indent=2,
            ).encode()
            return Response(
                content,
                media_type="application/json",
                headers={
                    "Content-Disposition": f'attachment; filename="datadock-{report_id[:8]}-report.json"'
                },
            )
        if report.clean_options is None:
            raise HTTPException(409, "Choose and apply cleaning options before exporting a cleaned CSV.")
        frame = parse_csv(storage.get(report.source_key), config)
        cleaned, _ = clean_dataset(frame, report.clean_options)
        return StreamingResponse(
            io.BytesIO(spreadsheet_safe_csv(cleaned)),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="datadock-{report_id[:8]}-cleaned.csv"'},
        )

    return app


app = create_app()
