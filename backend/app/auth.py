"""Optional accounts, revocable browser sessions, and recovery without email delivery."""

import hashlib
import re
import secrets
import time
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError

from .models import Account, AuthAttempt, AuthSession, Report

COOKIE = "datadock_session"
SESSION_SECONDS = 30 * 24 * 3600


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def password_hash(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    result = hashlib.scrypt(
        password.encode(), salt=bytes.fromhex(salt), n=32768, r=8, p=1, maxmem=64 * 1024 * 1024
    )
    return f"scrypt$32768$8$1${salt}${result.hex()}"


def valid_password(password: str, encoded: str) -> bool:
    try:
        return secrets.compare_digest(password_hash(password, encoded.split("$")[4]), encoded)
    except (ValueError, IndexError):
        return False


class Registration(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    name: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=12, max_length=128)
    keep_reports: bool = True


class Login(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=1, max_length=128)
    keep_reports: bool = True


class Recovery(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    recovery_code: str = Field(min_length=20, max_length=100)
    password: str = Field(min_length=12, max_length=128)
    keep_reports: bool = True


class Authentication:
    def __init__(self, config, sessions):
        self.config, self.sessions = config, sessions
        self.dummy_hash = password_hash("a-long-unused-account-password")

    def resolve(self, request: Request, session, lock=False):
        token = request.cookies.get(COOKIE, "")
        if not re.fullmatch(r"[a-f0-9]{64}", token):
            return None
        query = select(AuthSession).where(AuthSession.token_hash == digest(token))
        record = session.scalar(query.with_for_update() if lock else query)
        return record if record and record.expires_at > int(time.time()) else None

    def require_current(self, request, session):
        record = self.resolve(request, session, lock=True)
        if record is None:
            raise HTTPException(401, "Your session changed. Refresh the page and try again.")
        return record

    def owner(self, request: Request) -> str:
        with self.sessions() as session:
            record = self.resolve(request, session)
            if record is None:
                raise HTTPException(401, "Your session has expired. Refresh the page or sign in again.")
            if request.method not in {"GET", "HEAD", "OPTIONS"}:
                expected = digest("csrf:" + request.cookies[COOKIE])
                if not secrets.compare_digest(request.headers.get("x-csrf-token", ""), expected):
                    raise HTTPException(403, "Refresh the page and try again.")
            return record.account_id or record.token_hash

    def payload(self, token: str, account=None):
        return {
            "csrf_token": digest("csrf:" + token),
            "user": {"id": account.id, "username": account.username, "name": account.name}
            if account
            else None,
            "max_upload_mb": self.config.max_upload_bytes // (1024 * 1024),
            "max_rows": self.config.max_rows,
        }

    def issue(self, response: Response, session, account=None, old=None, keep_reports=False):
        token = secrets.token_hex(32)
        new = AuthSession(
            token_hash=digest(token),
            account_id=account.id if account else None,
            expires_at=int(time.time()) + SESSION_SECONDS,
        )
        session.add(new)
        if old:
            if not old.account_id and keep_reports:
                count = session.scalar(
                    select(func.count())
                    .select_from(Report)
                    .where(Report.owner.in_([old.token_hash, account.id if account else new.token_hash]))
                )
                if count > self.config.max_reports_per_session:
                    raise HTTPException(
                        409,
                        "These guest reports would exceed your account’s 30-report limit. Uncheck ‘Keep this browser’s guest reports’ to continue without them.",
                    )
                session.execute(
                    update(Report)
                    .where(Report.owner == old.token_hash)
                    .values(owner=account.id if account else new.token_hash)
                )
            session.delete(old)
        response.set_cookie(
            COOKIE,
            token,
            httponly=True,
            secure=self.config.secure_cookies,
            samesite="strict",
            max_age=SESSION_SECONDS,
            path="/",
        )
        return self.payload(token, account)

    def throttle(self, session, request, username, action):
        now = int(time.time())
        window = now // 900
        ip = request.client.host if request.client else "unknown"
        if self.config.trust_proxy:
            ip = request.headers.get("x-forwarded-for", ip).split(",")[0].strip()
        pairs = [(f"user:{username.lower()}:{action}:{window}", 10), (f"ip:{ip}:{action}:{window}", 60)]
        session.execute(delete(AuthAttempt).where(AuthAttempt.expires_at < now))
        insert = sqlite_insert if session.bind.dialect.name == "sqlite" else pg_insert
        exceeded = False
        for key, maximum in pairs:
            statement = insert(AuthAttempt).values(key=digest(key), attempts=1, expires_at=(window + 1) * 900)
            statement = statement.on_conflict_do_update(
                index_elements=[AuthAttempt.key], set_={"attempts": AuthAttempt.attempts + 1}
            ).returning(AuthAttempt.attempts)
            exceeded = session.scalar(statement) > maximum or exceeded
        session.commit()
        if exceeded:
            raise HTTPException(429, "Too many attempts. Please wait 15 minutes before trying again.")

    def router(self):
        router = APIRouter(prefix="/api")

        @router.get("/session")
        def current(request: Request, response: Response):
            with self.sessions() as session:
                record = self.resolve(request, session)
                if record:
                    account = session.get(Account, record.account_id) if record.account_id else None
                    return self.payload(request.cookies[COOKIE], account)
                data = self.issue(response, session)
                session.commit()
                return data

        @router.post("/auth/register", status_code=201)
        def register(body: Registration, request: Request, response: Response, _: str = Depends(self.owner)):
            with self.sessions() as session:
                self.throttle(session, request, body.username, "register")
                old = self.require_current(request, session)
                if old.account_id:
                    raise HTTPException(409, "Sign out before creating a different account.")
                if not body.name.strip():
                    raise HTTPException(422, "Enter a display name.")
                recovery = secrets.token_urlsafe(32)
                account = Account(
                    id=str(uuid4()),
                    username=body.username.lower(),
                    name=body.name.strip(),
                    password_hash=password_hash(body.password),
                    recovery_hash=digest(recovery),
                )
                session.add(account)
                try:
                    session.flush()
                except IntegrityError as exc:
                    session.rollback()
                    raise HTTPException(
                        409, "That username is already taken. Choose another or sign in."
                    ) from exc
                data = self.issue(response, session, account, old, body.keep_reports)
                session.commit()
                return {**data, "recovery_code": recovery}

        @router.post("/auth/login")
        def login(body: Login, request: Request, response: Response, _: str = Depends(self.owner)):
            with self.sessions() as session:
                self.throttle(session, request, body.username, "login")
                account = session.scalar(
                    select(Account).where(Account.username == body.username.lower()).with_for_update()
                )
                matches = valid_password(body.password, account.password_hash if account else self.dummy_hash)
                if not account or not matches:
                    raise HTTPException(401, "The username or password is incorrect.")
                old = self.require_current(request, session)
                data = self.issue(response, session, account, old, body.keep_reports)
                session.commit()
                return data

        @router.post("/auth/logout")
        def logout(request: Request, response: Response, _: str = Depends(self.owner)):
            with self.sessions() as session:
                data = self.issue(response, session, old=self.require_current(request, session))
                session.commit()
                return data

        @router.post("/auth/recover")
        def recover(body: Recovery, request: Request, response: Response, _: str = Depends(self.owner)):
            with self.sessions() as session:
                self.throttle(session, request, body.username, "recover")
                account = session.scalar(
                    select(Account).where(Account.username == body.username.lower()).with_for_update()
                )
                if not account or not secrets.compare_digest(
                    account.recovery_hash, digest(body.recovery_code.strip())
                ):
                    raise HTTPException(400, "The username or recovery code is incorrect.")
                old = self.require_current(request, session)
                account.password_hash = password_hash(body.password)
                recovery = secrets.token_urlsafe(32)
                account.recovery_hash = digest(recovery)
                session.execute(
                    delete(AuthSession).where(
                        AuthSession.account_id == account.id, AuthSession.token_hash != old.token_hash
                    )
                )
                data = self.issue(response, session, account, old, body.keep_reports)
                session.commit()
                return {**data, "recovery_code": recovery}

        return router
