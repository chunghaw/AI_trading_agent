"""Risk management node for LangGraph."""

import os
from typing import Dict, Any
import structlog
from datetime import datetime, timedelta
from ..schemas import State
from ..tools import risk_limits

logger = structlog.get_logger()


def risk_node(state: State) -> State:
    """
    Risk management node that evaluates exposure and embargo rules.
    
    Args:
        state: Current graph state
    
    Returns:
        Updated state with risk assessment
    """
    try:
        logger.info("Starting risk assessment", run_id=state.run_id, symbol=state.symbol)
        
        # Get risk limits
        limits = risk_limits()
        
        # Check for risk violations
        violations = _check_risk_violations(state, limits)
        
        if violations:
            logger.warning("Risk violations detected", 
                          run_id=state.run_id, 
                          violations=violations)
            
            # Set decision to FLAT if violations
            from ..schemas import FinalDecision, EntryOrder
            state.decision = FinalDecision(
                symbol=state.symbol,
                action="FLAT",
                size_pct=0.01,  # Minimum allowed value
                entry=EntryOrder(type="market", price=None),
                confidence=0.0,
                citations=["risk_management"],
                sl=None,
                tp=None
            )
            state.status = "EXECUTED"
            state.updated_at = datetime.utcnow()
            
            return state
        
        # Check if approval is required
        approval_required = os.getenv("WORKER_APPROVAL_REQUIRED", "true").lower() == "true"
        
        if approval_required:
            state.needs_approval = True
            state.status = "WAITING_APPROVAL"
            logger.info("Approval required", run_id=state.run_id)
        else:
            state.needs_approval = False
            state.status = "PENDING"
            logger.info("No approval required", run_id=state.run_id)
        
        state.updated_at = datetime.utcnow()
        return state
        
    except Exception as e:
        logger.error("Risk assessment failed", run_id=state.run_id, error=str(e))
        state.status = "FAILED"
        state.error_message = f"Risk assessment failed: {str(e)}"
        return state


def _check_risk_violations(state: State, limits: Dict[str, Any]) -> list:
    """
    Check for risk management violations.
    
    Args:
        state: Current state
        limits: Risk limits configuration
    
    Returns:
        List of violations
    """
    violations = []
    
    # Check if we have opinions to evaluate
    if not state.opinions:
        violations.append("No agent opinions available")
        return violations
    
    # Check confidence levels
    min_confidence = limits.get("min_confidence", 0.7)
    avg_confidence = sum(op.score for op in state.opinions.values()) / len(state.opinions)
    
    if avg_confidence < min_confidence:
        violations.append(f"Average confidence {avg_confidence:.2f} below minimum {min_confidence}")
    
    # Check for red flags in opinions
    for agent, opinion in state.opinions.items():
        if opinion.red_flags:
            violations.append(f"{agent} agent red flags: {', '.join(opinion.red_flags)}")
    
    # Check news embargo (if recent news)
    if state.news:
        embargo_minutes = limits.get("embargo_minutes_after_news", 30)
        latest_news_time = _get_latest_news_time(state.news)
        
        if latest_news_time:
            time_since_news = datetime.utcnow() - latest_news_time
            if time_since_news.total_seconds() < embargo_minutes * 60:
                violations.append(f"News embargo: {embargo_minutes} minutes after news")
    
    # Check position size limits
    max_position_size = limits.get("max_position_size_pct", 0.1)
    # This would be checked when creating the final decision
    
    return violations


def _get_latest_news_time(news_items: list) -> datetime:
    """
    Get the timestamp of the latest news article.
    
    Args:
        news_items: List of news articles
    
    Returns:
        Latest news timestamp or None
    """
    if not news_items:
        return None
    
    latest_time = None
    for item in news_items:
        published_str = item.get("published_utc")
        if published_str:
            try:
                # Try to parse ISO format
                if "T" in published_str:
                    news_time = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
                else:
                    news_time = datetime.fromisoformat(published_str)
                
                if latest_time is None or news_time > latest_time:
                    latest_time = news_time
            except ValueError:
                continue
    
    return latest_time
