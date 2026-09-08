import os
from dataclasses import dataclass
from pathlib import Path


def database_url() -> str:
    value = os.getenv("DATABASE_URL", "")
    if os.getenv("VERCEL") and not value:
        raise RuntimeError("DATABASE_URL is required for hosted storage.")
    for prefix in ("postgres://", "postgresql://"):
        if value.startswith(prefix):
            return "postgresql+psycopg://" + value[len(prefix) :]
    return value or "sqlite:///./data/datadock.db"


@dataclass(frozen=True)
class Settings:
    database_url: str = database_url()
    storage_dir: Path = Path(os.getenv("STORAGE_DIR", "./data/uploads"))
    s3_bucket: str = os.getenv("S3_BUCKET", "")
    aws_region: str = os.getenv("AWS_REGION", "us-east-1")
    secure_cookies: bool = bool(os.getenv("VERCEL")) or os.getenv("SECURE_COOKIES", "false").lower() == "true"
    trust_proxy: bool = os.getenv("VERCEL", "") == "1"
    max_upload_bytes: int = (
        int(os.getenv("MAX_UPLOAD_MB", "3" if os.getenv("VERCEL") else "10")) * 1024 * 1024
    )
    storage_backend: str = os.getenv("STORAGE_BACKEND", "database" if os.getenv("VERCEL") else "local")
    max_rows: int = 100_000
    max_columns: int = 64
    max_cells: int = 1_000_000
    max_reports_per_session: int = 30
    max_reports_total: int = int(os.getenv("MAX_REPORTS_TOTAL", "500"))


settings = Settings()
