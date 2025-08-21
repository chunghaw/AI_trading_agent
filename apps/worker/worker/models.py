"""Pydantic models for standardized trading decisions and responses."""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum


class ActionType(str, Enum):
    """Trading action types."""
    BUY = "BUY"
    SELL = "SELL"
    FLAT = "FLAT"


class EntryType(str, Enum):
    """Entry order types."""
    MARKET = "market"
    LIMIT = "limit"


class RiskLevel(str, Enum):
    """Risk assessment levels."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ApprovalStatus(str, Enum):
    """Approval status."""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class EntryOrder(BaseModel):
    """Entry order details."""
    type: EntryType = Field(..., description="Order type")
    price: Optional[float] = Field(None, description="Limit price (if applicable)")


class StopLoss(BaseModel):
    """Stop loss configuration."""
    price: Optional[float] = Field(None, description="Stop loss price")
    percentage: Optional[float] = Field(None, description="Stop loss percentage")


class TakeProfit(BaseModel):
    """Take profit configuration."""
    targets: List[Dict[str, Any]] = Field(default_factory=list, description="Take profit targets")


class Citation(BaseModel):
    """Citation for decision rationale."""
    source: str = Field(..., description="Source identifier (e.g., 'news://...', 'ta://...')")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in this citation")
    timestamp: datetime = Field(default_factory=datetime.now, description="Citation timestamp")


class TradingDecision(BaseModel):
    """Standardized trading decision model."""
    symbol: str = Field(..., description="Trading symbol")
    action: ActionType = Field(..., description="Trading action")
    size_pct: float = Field(..., ge=0.0, le=1.0, description="Position size as percentage")
    entry: EntryOrder = Field(..., description="Entry order details")
    sl: Optional[StopLoss] = Field(None, description="Stop loss configuration")
    tp: Optional[TakeProfit] = Field(None, description="Take profit configuration")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Overall confidence")
    citations: List[Citation] = Field(default_factory=list, description="Decision citations")
    timestamp: datetime = Field(default_factory=datetime.now, description="Decision timestamp")
    
    @validator('size_pct')
    def validate_size_pct(cls, v):
        if v <= 0 or v > 1:
            raise ValueError('size_pct must be between 0 and 1')
        return v
    
    @validator('confidence')
    def validate_confidence(cls, v):
        if v < 0 or v > 1:
            raise ValueError('confidence must be between 0 and 1')
        return v


class RiskAssessment(BaseModel):
    """Risk assessment model."""
    position_risk: float = Field(..., ge=0.0, le=1.0)
    market_risk: float = Field(..., ge=0.0, le=1.0)
    liquidity_risk: float = Field(..., ge=0.0, le=1.0)
    concentration_risk: float = Field(..., ge=0.0, le=1.0)
    total_risk: float = Field(..., ge=0.0, le=1.0)
    risk_level: RiskLevel = Field(..., description="Risk level assessment")
    
    @validator('total_risk')
    def validate_total_risk(cls, v):
        if v < 0 or v > 1:
            raise ValueError('total_risk must be between 0 and 1')
        return v


class PortfolioConstraints(BaseModel):
    """Portfolio constraints model."""
    max_exposure_per_symbol: float = Field(..., ge=0.0, le=1.0)
    daily_loss_cap: float = Field(..., ge=0.0, le=1.0)
    max_daily_trades: int = Field(..., ge=0)
    min_confidence_threshold: float = Field(..., ge=0.0, le=1.0)
    kill_switch_enabled: bool = Field(default=False, description="Emergency stop flag")


class AgentResponse(BaseModel):
    """Standardized agent response model."""
    success: bool = Field(..., description="Whether the analysis was successful")
    data: Dict[str, Any] = Field(default_factory=dict, description="Analysis data")
    message: str = Field(..., description="Response message")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in the analysis")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    timestamp: datetime = Field(default_factory=datetime.now, description="Response timestamp")
    
    @validator('confidence')
    def validate_confidence(cls, v):
        if v < 0 or v > 1:
            raise ValueError('confidence must be between 0 and 1')
        return v


class Proposal(BaseModel):
    """Trading proposal model."""
    id: str = Field(..., description="Unique proposal ID")
    decision: TradingDecision = Field(..., description="Trading decision")
    risk_assessment: RiskAssessment = Field(..., description="Risk assessment")
    constraints: PortfolioConstraints = Field(..., description="Portfolio constraints")
    status: ApprovalStatus = Field(default=ApprovalStatus.PENDING, description="Approval status")
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update timestamp")
    
    def approve(self) -> None:
        """Approve the proposal."""
        self.status = ApprovalStatus.APPROVED
        self.updated_at = datetime.now()
    
    def reject(self, reason: str = "") -> None:
        """Reject the proposal."""
        self.status = ApprovalStatus.REJECTED
        self.updated_at = datetime.now()
        if reason:
            self.metadata = self.metadata or {}
            self.metadata["rejection_reason"] = reason


class WebhookPayload(BaseModel):
    """Webhook payload model with validation."""
    symbol: str = Field(..., description="Trading symbol")
    action: ActionType = Field(..., description="Requested action")
    size_pct: float = Field(..., ge=0.0, le=1.0, description="Position size")
    idempotency_key: str = Field(..., description="Idempotency key for deduplication")
    timestamp: datetime = Field(default_factory=datetime.now, description="Request timestamp")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    
    @validator('size_pct')
    def validate_size_pct(cls, v):
        if v <= 0 or v > 1:
            raise ValueError('size_pct must be between 0 and 1')
        return v


class HealthCheck(BaseModel):
    """Health check response model."""
    status: str = Field(..., description="Service status")
    timestamp: datetime = Field(default_factory=datetime.now, description="Check timestamp")
    version: str = Field(..., description="Service version")
    uptime: float = Field(..., description="Service uptime in seconds")
    dependencies: Dict[str, str] = Field(default_factory=dict, description="Dependency statuses")
