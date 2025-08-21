"""FastAPI Worker API for trading proposals and webhooks."""

import json
import sqlite3
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from .models import (
    Proposal, TradingDecision, RiskAssessment, PortfolioConstraints,
    WebhookPayload, HealthCheck, ApprovalStatus, ActionType, EntryType
)
from .trading_orchestrator import TradingOrchestrator
from .risk_manager import RiskManager
from .data_connector import DataConnector
from .vector_service import get_collection_stats
from .paper_broker import PaperBroker
from .config import Config


class ProposalStore:
    """Simple SQLite-based proposal store."""
    
    def __init__(self, db_path: str = "proposals.db"):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize the database."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS proposals (
                    id TEXT PRIMARY KEY,
                    decision_data TEXT NOT NULL,
                    risk_assessment_data TEXT NOT NULL,
                    constraints_data TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    metadata TEXT
                )
            """)
            conn.commit()
    
    def create_proposal(self, proposal: Proposal) -> Proposal:
        """Create a new proposal."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO proposals 
                (id, decision_data, risk_assessment_data, constraints_data, status, created_at, updated_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                proposal.id,
                proposal.decision.json(),
                proposal.risk_assessment.json(),
                proposal.constraints.json(),
                proposal.status.value,
                proposal.created_at.isoformat(),
                proposal.updated_at.isoformat(),
                json.dumps(proposal.metadata) if proposal.metadata else None
            ))
            conn.commit()
        return proposal
    
    def get_proposal(self, proposal_id: str) -> Optional[Proposal]:
        """Get a proposal by ID."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT decision_data, risk_assessment_data, constraints_data, 
                       status, created_at, updated_at, metadata
                FROM proposals WHERE id = ?
            """, (proposal_id,))
            row = cursor.fetchone()
            
            if not row:
                return None
            
            decision = TradingDecision.parse_raw(row[0])
            risk_assessment = RiskAssessment.parse_raw(row[1])
            constraints = PortfolioConstraints.parse_raw(row[2])
            metadata = json.loads(row[6]) if row[6] else None
            
            return Proposal(
                id=proposal_id,
                decision=decision,
                risk_assessment=risk_assessment,
                constraints=constraints,
                status=ApprovalStatus(row[3]),
                created_at=datetime.fromisoformat(row[4]),
                updated_at=datetime.fromisoformat(row[5]),
                metadata=metadata
            )
    
    def get_proposals(self, limit: int = 100, offset: int = 0) -> List[Proposal]:
        """Get all proposals with pagination."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT id, decision_data, risk_assessment_data, constraints_data,
                       status, created_at, updated_at, metadata
                FROM proposals 
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """, (limit, offset))
            
            proposals = []
            for row in cursor.fetchall():
                decision = TradingDecision.parse_raw(row[1])
                risk_assessment = RiskAssessment.parse_raw(row[2])
                constraints = PortfolioConstraints.parse_raw(row[3])
                metadata = json.loads(row[7]) if row[7] else None
                
                proposals.append(Proposal(
                    id=row[0],
                    decision=decision,
                    risk_assessment=risk_assessment,
                    constraints=constraints,
                    status=ApprovalStatus(row[4]),
                    created_at=datetime.fromisoformat(row[5]),
                    updated_at=datetime.fromisoformat(row[6]),
                    metadata=metadata
                ))
            
            return proposals
    
    def update_proposal_status(self, proposal_id: str, status: ApprovalStatus, reason: str = "") -> bool:
        """Update proposal status."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                UPDATE proposals 
                SET status = ?, updated_at = ?, metadata = ?
                WHERE id = ?
            """, (
                status.value,
                datetime.now().isoformat(),
                json.dumps({"rejection_reason": reason}) if reason else None,
                proposal_id
            ))
            conn.commit()
            return cursor.rowcount > 0


# Initialize FastAPI app
app = FastAPI(
    title="AI Trading Agent Worker API",
    description="Worker API for trading proposals and webhooks",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
config = Config()
proposal_store = ProposalStore()
trading_orchestrator = TradingOrchestrator(config.dict())
risk_manager = RiskManager(config.dict())
data_connector = DataConnector(config.dict())
paper_broker = PaperBroker(config.dict())

# Idempotency tracking (in-memory for now, use Redis in production)
processed_webhooks = set()


@app.get("/healthz")
async def health_check() -> HealthCheck:
    """Health check endpoint."""
    start_time = datetime.now()
    
    # Check dependencies
    dependencies = {
        "database": "healthy",
        "trading_orchestrator": "healthy",
        "risk_manager": "healthy",
        "data_connector": "healthy",
        "vector_db": "healthy",
        "paper_broker": "healthy"
    }
    
    # Simple dependency checks
    try:
        proposal_store.get_proposals(limit=1)
    except Exception:
        dependencies["database"] = "unhealthy"
    
    try:
        stats = get_collection_stats()
        if stats["fallback_mode"]:
            dependencies["vector_db"] = "fallback"
    except Exception:
        dependencies["vector_db"] = "unhealthy"
    
    return HealthCheck(
        status="healthy",
        version="1.0.0",
        uptime=(datetime.now() - start_time).total_seconds(),
        dependencies=dependencies
    )


@app.post("/proposals")
async def create_proposal(webhook_payload: WebhookPayload, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Create a trading proposal from webhook."""
    
    # Check idempotency
    if webhook_payload.idempotency_key in processed_webhooks:
        raise HTTPException(status_code=409, detail="Duplicate webhook request")
    
    # Add to processed set
    processed_webhooks.add(webhook_payload.idempotency_key)
    
    try:
        # Analyze the symbol
        analysis_result = await trading_orchestrator.analyze_symbol(webhook_payload.symbol)
        
        if not analysis_result.get("success"):
            raise HTTPException(status_code=400, detail="Analysis failed")
        
        # Create trading decision
        decision = TradingDecision(
            symbol=webhook_payload.symbol,
            action=webhook_payload.action,
            size_pct=webhook_payload.size_pct,
            entry={"type": EntryType.MARKET, "price": None},
            confidence=analysis_result.get("summary", {}).get("confidence", 0.0),
            citations=[
                {
                    "source": f"analysis://{webhook_payload.symbol}",
                    "confidence": analysis_result.get("summary", {}).get("confidence", 0.0),
                    "timestamp": datetime.now()
                }
            ]
        )
        
        # Risk assessment
        risk_assessment = await risk_manager.assess_risk(decision)
        
        # Portfolio constraints
        constraints = PortfolioConstraints(
            max_exposure_per_symbol=0.1,  # 10% max per symbol
            daily_loss_cap=0.05,  # 5% daily loss cap
            max_daily_trades=10,
            min_confidence_threshold=0.7,
            kill_switch_enabled=False
        )
        
        # Create proposal
        proposal = Proposal(
            id=str(uuid.uuid4()),
            decision=decision,
            risk_assessment=risk_assessment,
            constraints=constraints
        )
        
        # Store proposal
        proposal_store.create_proposal(proposal)
        
        # Background task for additional processing
        background_tasks.add_task(process_proposal_background, proposal.id)
        
        return {
            "success": True,
            "proposal_id": proposal.id,
            "status": proposal.status.value,
            "message": "Proposal created successfully"
        }
        
    except Exception as e:
        # Remove from processed set on error
        processed_webhooks.discard(webhook_payload.idempotency_key)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/proposals")
async def get_proposals(limit: int = 100, offset: int = 0) -> Dict[str, Any]:
    """Get all proposals with pagination."""
    proposals = proposal_store.get_proposals(limit=limit, offset=offset)
    
    return {
        "proposals": [proposal.dict() for proposal in proposals],
        "total": len(proposals),
        "limit": limit,
        "offset": offset
    }


@app.get("/proposals/{proposal_id}")
async def get_proposal(proposal_id: str) -> Dict[str, Any]:
    """Get a specific proposal."""
    proposal = proposal_store.get_proposal(proposal_id)
    
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    return proposal.dict()


@app.post("/proposals/{proposal_id}/approve")
async def approve_proposal(proposal_id: str) -> Dict[str, Any]:
    """Approve a proposal and fill it immediately."""
    proposal = proposal_store.get_proposal(proposal_id)
    
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    if proposal.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Proposal is not pending")
    
    # Check risk constraints
    if proposal.risk_assessment.total_risk > 0.8:
        raise HTTPException(status_code=400, detail="Risk too high for approval")
    
    # Update status to approved
    success = proposal_store.update_proposal_status(proposal_id, ApprovalStatus.APPROVED)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update proposal")
    
    # Fill the proposal immediately
    fill_result = paper_broker.fill_proposal(proposal_id, proposal.decision)
    
    if not fill_result.get("success"):
        raise HTTPException(status_code=500, detail=f"Failed to fill proposal: {fill_result.get('error')}")
    
    return {
        "success": True,
        "proposal_id": proposal_id,
        "status": "APPROVED",
        "message": "Proposal approved and filled successfully",
        "fill_details": fill_result
    }


@app.post("/proposals/{proposal_id}/reject")
async def reject_proposal(proposal_id: str, reason: str = "") -> Dict[str, Any]:
    """Reject a proposal."""
    proposal = proposal_store.get_proposal(proposal_id)
    
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    if proposal.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Proposal is not pending")
    
    # Update status
    success = proposal_store.update_proposal_status(proposal_id, ApprovalStatus.REJECTED, reason)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update proposal")
    
    return {
        "success": True,
        "proposal_id": proposal_id,
        "status": "REJECTED",
        "message": "Proposal rejected successfully",
        "reason": reason
    }


@app.get("/portfolio")
async def get_portfolio() -> Dict[str, Any]:
    """Get current portfolio summary."""
    return paper_broker.get_portfolio_summary()


@app.get("/trades")
async def get_trades(limit: int = 100) -> Dict[str, Any]:
    """Get recent trade history."""
    trades = paper_broker.get_trade_history(limit)
    return {
        "trades": trades,
        "total": len(trades),
        "limit": limit
    }


@app.get("/performance")
async def get_performance() -> Dict[str, Any]:
    """Get performance metrics."""
    return paper_broker.get_performance_metrics()


@app.post("/portfolio/reset")
async def reset_portfolio(initial_cash: float = 100000) -> Dict[str, Any]:
    """Reset portfolio to initial state."""
    paper_broker.reset_portfolio(initial_cash)
    return {
        "success": True,
        "message": f"Portfolio reset to ${initial_cash:,.2f}",
        "cash_balance": initial_cash
    }


@app.get("/analysis/{symbol}")
async def analyze_symbol(symbol: str) -> Dict[str, Any]:
    """Analyze a symbol using the RAG system."""
    try:
        result = await trading_orchestrator.analyze_symbol(symbol)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/market-data/{symbol}")
async def get_market_data(symbol: str, timeframe: str = "1h") -> Dict[str, Any]:
    """Get market data for a symbol."""
    try:
        market_data = data_connector.get_market_data(symbol, timeframe)
        return market_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/portfolio/analysis")
async def get_portfolio_analysis(symbols: str = None) -> Dict[str, Any]:
    """Get portfolio analysis for multiple symbols."""
    try:
        symbol_list = []
        if symbols:
            symbol_list = [s.strip() for s in symbols.split(",")]
        
        result = await trading_orchestrator.get_portfolio_analysis(symbol_list)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/data-quality/{symbol}")
async def get_data_quality(symbol: str) -> Dict[str, Any]:
    """Get data quality metrics for a symbol."""
    try:
        quality_metrics = data_connector.validate_data_quality(symbol)
        return quality_metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/vector-stats")
async def get_vector_stats() -> Dict[str, Any]:
    """Get vector database statistics."""
    try:
        stats = get_collection_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/system-status")
async def get_system_status() -> Dict[str, Any]:
    """Get comprehensive system status."""
    try:
        agent_status = trading_orchestrator.get_agent_status()
        vector_stats = get_collection_stats()
        portfolio_summary = paper_broker.get_portfolio_summary()
        
        return {
            "timestamp": datetime.now().isoformat(),
            "agents": agent_status,
            "vector_db": vector_stats,
            "data_connector": {
                "status": "active",
                "indicators_dir": data_connector.indicators_dir
            },
            "paper_broker": {
                "status": "active",
                "cash_balance": portfolio_summary["cash_balance"],
                "total_value": portfolio_summary["total_value"],
                "num_positions": portfolio_summary["num_positions"],
                "num_trades": portfolio_summary["num_trades"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def process_proposal_background(proposal_id: str):
    """Background task for proposal processing."""
    # This could include:
    # - Additional analysis
    # - Notification sending
    # - Logging
    # - Integration with external systems
    pass


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
