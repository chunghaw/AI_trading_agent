"""Pydantic schemas for LangGraph trading agent."""

from typing import Literal, List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime


class Opinion(BaseModel):
    """Agent opinion with strict validation."""
    score: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0-1")
    action: Literal["BUY", "SELL", "FLAT"] = Field(..., description="Recommended action")
    rationale: str = Field(..., min_length=10, max_length=1000, description="Reasoning")
    citations: List[str] = Field(default_factory=list, description="Source citations")
    red_flags: Optional[List[str]] = Field(default=None, description="Risk warnings")

    @validator('score')
    def validate_score(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError('Score must be between 0.0 and 1.0')
        return v

    @validator('rationale')
    def validate_rationale(cls, v):
        if len(v.strip()) < 10:
            raise ValueError('Rationale must be at least 10 characters')
        return v


class EntryOrder(BaseModel):
    """Entry order configuration."""
    type: Literal["market", "limit"] = Field(..., description="Order type")
    price: Optional[float] = Field(None, ge=0.0, description="Limit price if applicable")

    @validator('price')
    def validate_price(cls, v, values):
        if values.get('type') == 'limit' and v is None:
            raise ValueError('Limit orders require a price')
        return v


class FinalDecision(BaseModel):
    """Final trading decision with strict validation."""
    symbol: str = Field(..., min_length=1, max_length=10, description="Trading symbol")
    action: Literal["BUY", "SELL", "FLAT"] = Field(..., description="Trading action")
    size_pct: float = Field(..., ge=0.01, le=1.0, description="Position size as percentage")
    entry: EntryOrder = Field(..., description="Entry order details")
    sl: Optional[float] = Field(None, ge=0.0, description="Stop loss price")
    tp: Optional[List[float]] = Field(None, description="Take profit targets")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Overall confidence")
    citations: List[str] = Field(default_factory=list, description="Decision citations")

    @validator('size_pct')
    def validate_size_pct(cls, v):
        if not 0.01 <= v <= 1.0:
            raise ValueError('Size percentage must be between 0.01 and 1.0')
        return v

    @validator('confidence')
    def validate_confidence(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError('Confidence must be between 0.0 and 1.0')
        return v

    @validator('tp')
    def validate_tp(cls, v):
        if v is not None:
            for price in v:
                if price <= 0:
                    raise ValueError('Take profit prices must be positive')
        return v


class State(BaseModel):
    """LangGraph state with strict validation."""
    run_id: str = Field(..., description="Unique run identifier")
    symbol: str = Field(..., min_length=1, max_length=10, description="Trading symbol")
    timeframe: str = Field(..., description="Timeframe for analysis")
    bars: Optional[List[Dict[str, Any]]] = Field(None, description="OHLCV data")
    news: Optional[List[Dict[str, Any]]] = Field(None, description="News articles")
    opinions: Dict[str, Opinion] = Field(default_factory=dict, description="Agent opinions")
    decision: Optional[FinalDecision] = Field(None, description="Final decision")
    needs_approval: bool = Field(default=False, description="Human approval required")
    status: Literal["PENDING", "WAITING_APPROVAL", "EXECUTED", "REJECTED", "FAILED"] = Field(
        default="PENDING", description="Current status"
    )
    error_message: Optional[str] = Field(None, description="Error details if failed")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class RunRequest(BaseModel):
    """Request to start a new trading run."""
    symbol: str = Field(..., min_length=1, max_length=10, description="Trading symbol")
    timeframe: str = Field(..., description="Analysis timeframe")

    @validator('symbol')
    def validate_symbol(cls, v):
        return v.upper().strip()


class ResumeRequest(BaseModel):
    """Request to resume a trading run."""
    command: Literal["approve", "reject"] = Field(..., description="Approval command")


class RunResponse(BaseModel):
    """Response for run operations."""
    run_id: str = Field(..., description="Run identifier")
    state: State = Field(..., description="Current state")
    message: str = Field(..., description="Status message")


class ErrorResponse(BaseModel):
    """Error response."""
    error: str = Field(..., description="Error message")
    details: Optional[str] = Field(None, description="Additional details")
