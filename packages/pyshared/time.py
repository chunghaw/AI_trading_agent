"""Time utilities for AI Trading Agent."""

from datetime import datetime, timezone
from typing import Union


def now_utc() -> datetime:
    """Get current UTC timestamp."""
    return datetime.now(timezone.utc)


def to_utc(dt: Union[datetime, str]) -> datetime:
    """Convert datetime to UTC."""
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
    
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    return dt.astimezone(timezone.utc)


def format_iso(dt: datetime) -> str:
    """Format datetime as ISO string."""
    return dt.isoformat() 