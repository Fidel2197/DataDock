import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./data/datadock.db")
    storage_dir: Path = Path(os.getenv("STORAGE_DIR", "./data/uploads"))
    s3_bucket: str = os.getenv("S3_BUCKET", "")
    aws_region: str = os.getenv("AWS_REGION", "us-east-1")
    secure_cookies: bool = os.getenv("SECURE_COOKIES", "false").lower() == "true"
    max_upload_bytes: int = 10 * 1024 * 1024
    max_rows: int = 100_000
    max_columns: int = 64
    max_cells: int = 1_000_000
    max_reports_per_session: int = 30
    max_reports_total: int = int(os.getenv("MAX_REPORTS_TOTAL", "500"))


settings = Settings()
