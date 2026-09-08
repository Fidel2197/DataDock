import io

import boto3
import pytest
from botocore.response import StreamingBody
from botocore.stub import Stubber

from app.config import Settings
from app.storage import Storage


def test_local_storage_roundtrip_and_path_bounds(tmp_path):
    store = Storage(Settings(storage_dir=tmp_path))
    store.put("owner/report/source.csv", b"id,x\n1,2")
    assert store.get("owner/report/source.csv") == b"id,x\n1,2"
    with pytest.raises(ValueError):
        store.put("../outside.csv", b"bad")
    store.delete("owner/report/source.csv")
    assert not (tmp_path / "owner/report/source.csv").exists()


def test_s3_adapter_requests_encryption_and_exact_bucket(monkeypatch, tmp_path):
    client = boto3.client(
        "s3", region_name="us-east-1", aws_access_key_id="testing", aws_secret_access_key="testing"
    )
    monkeypatch.setattr(boto3, "client", lambda *args, **kwargs: client)
    content = b"id,x\n1,2"
    with Stubber(client) as stub:
        stub.add_response(
            "put_object",
            {},
            {
                "Bucket": "datadock-test",
                "Key": "owner/report/source.csv",
                "Body": content,
                "ContentType": "text/csv",
                "ServerSideEncryption": "AES256",
            },
        )
        stub.add_response(
            "get_object",
            {"Body": StreamingBody(io.BytesIO(content), len(content))},
            {"Bucket": "datadock-test", "Key": "owner/report/source.csv"},
        )
        stub.add_response("delete_object", {}, {"Bucket": "datadock-test", "Key": "owner/report/source.csv"})
        store = Storage(Settings(storage_dir=tmp_path, s3_bucket="datadock-test"))
        store.put("owner/report/source.csv", content)
        assert store.get("owner/report/source.csv") == content
        store.delete("owner/report/source.csv")
        stub.assert_no_pending_responses()
