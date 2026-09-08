from pathlib import Path

from .config import Settings
from .models import StoredUpload


class DatabaseStorage:
    """Durable bounded uploads in Postgres for serverless deployment."""

    def __init__(self, sessions):
        self.sessions = sessions

    def put(self, key: str, content: bytes) -> None:
        with self.sessions.begin() as session:
            session.add(StoredUpload(key=key, content=content))

    def get(self, key: str) -> bytes:
        with self.sessions() as session:
            row = session.get(StoredUpload, key)
            if row is None:
                raise FileNotFoundError("The original upload is unavailable.")
            return row.content

    def delete(self, key: str) -> None:
        with self.sessions.begin() as session:
            row = session.get(StoredUpload, key)
            if row:
                session.delete(row)


class Storage:
    """One contract for local development and private S3 objects in AWS."""

    def __init__(self, settings: Settings):
        self.root = settings.storage_dir.resolve()
        self.bucket = settings.s3_bucket
        self.s3 = None
        if self.bucket:
            import boto3

            self.s3 = boto3.client("s3", region_name=settings.aws_region)
        else:
            self.root.mkdir(parents=True, exist_ok=True)

    def path(self, key: str) -> Path:
        target = (self.root / key).resolve()
        if not target.is_relative_to(self.root):
            raise ValueError("Invalid storage key")
        return target

    def put(self, key: str, content: bytes) -> None:
        if self.s3:
            self.s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=content,
                ContentType="text/csv",
                ServerSideEncryption="AES256",
            )
        else:
            path = self.path(key)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)

    def get(self, key: str) -> bytes:
        if self.s3:
            return self.s3.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        return self.path(key).read_bytes()

    def delete(self, key: str) -> None:
        if self.s3:
            self.s3.delete_object(Bucket=self.bucket, Key=key)
        else:
            self.path(key).unlink(missing_ok=True)
