"""Vercel's ASGI entry point; all application routes retain the /api prefix."""

from backend.app.main import app

__all__ = ["app"]
