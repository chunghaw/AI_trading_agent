"""ID generation utilities for AI Trading Agent."""

import uuid
import time
from typing import Optional


def generate_uuid() -> str:
    """Generate a UUID4 string."""
    return str(uuid.uuid4())


def generate_ulid() -> str:
    """Generate a ULID (Universally Unique Lexicographically Sortable Identifier)."""
    # Simple ULID implementation
    timestamp = int(time.time() * 1000)  # Current time in milliseconds
    random_part = uuid.uuid4().hex[:10]  # First 10 chars of UUID
    
    # Convert timestamp to base32 (ULID format)
    timestamp_base32 = _to_base32(timestamp)
    
    return f"{timestamp_base32}{random_part}"


def _to_base32(num: int) -> str:
    """Convert number to base32 string."""
    alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    base32 = ""
    
    while num > 0:
        num, remainder = divmod(num, 32)
        base32 = alphabet[remainder] + base32
    
    # Pad to 10 characters (ULID timestamp length)
    return base32.zfill(10)


def generate_short_id(prefix: Optional[str] = None) -> str:
    """Generate a short ID with optional prefix."""
    short_id = uuid.uuid4().hex[:8]
    if prefix:
        return f"{prefix}-{short_id}"
    return short_id 