"""Trader node for LangGraph."""

import json
import os
from typing import Dict, Any
import structlog
from datetime import datetime
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from ..schemas import State, FinalDecision, EntryOrder, Opinion
from ..tools import paper_execute, risk_limits

logger = structlog.get_logger()


def trader_node(state: State) -> State:
    """
    Trader node that builds final decision and handles execution.
    
    Args:
        state: Current graph state
    
    Returns:
        Updated state with final decision
    """
    try:
        logger.info("Starting trader decision", run_id=state.run_id, symbol=state.symbol)
        
        # Build final decision from opinions
        decision = _build_final_decision(state)
        state.decision = decision
        
        # Check if approval is needed
        if state.needs_approval:
            logger.info("Decision requires approval", run_id=state.run_id)
            state.status = "WAITING_APPROVAL"
            state.updated_at = datetime.utcnow()
            return state
        
        # Execute immediately if no approval needed
        logger.info("Executing decision immediately", run_id=state.run_id)
        execution_result = paper_execute(decision.dict())
        
        # Update state
        state.status = "EXECUTED"
        state.updated_at = datetime.utcnow()
        
        logger.info("Trade executed", 
                   run_id=state.run_id, 
                   order_id=execution_result["order_id"],
                   action=decision.action)
        
        return state
        
    except Exception as e:
        logger.error("Trader decision failed", run_id=state.run_id, error=str(e))
        state.status = "FAILED"
        state.error_message = f"Trader decision failed: {str(e)}"
        return state


def trader_resume_node(state: State, command: str) -> State:
    """
    Resume trader node after human approval/rejection.
    
    Args:
        state: Current graph state
        command: "approve" or "reject"
    
    Returns:
        Updated state
    """
    try:
        logger.info("Resuming trader with command", run_id=state.run_id, command=command)
        
        if command == "approve":
            if not state.decision:
                raise ValueError("No decision to approve")
            
            # Execute the approved decision
            execution_result = paper_execute(state.decision.dict())
            
            state.status = "EXECUTED"
            logger.info("Decision approved and executed", 
                       run_id=state.run_id,
                       order_id=execution_result["order_id"])
            
        elif command == "reject":
            state.status = "REJECTED"
            logger.info("Decision rejected", run_id=state.run_id)
        
        state.updated_at = datetime.utcnow()
        return state
        
    except Exception as e:
        logger.error("Trader resume failed", run_id=state.run_id, error=str(e))
        state.status = "FAILED"
        state.error_message = f"Trader resume failed: {str(e)}"
        return state


def _build_final_decision(state: State) -> FinalDecision:
    """
    Build final trading decision from agent opinions.
    
    Args:
        state: Current state with opinions
    
    Returns:
        Final decision
    """
    if not state.opinions:
        raise ValueError("No opinions available for decision")
    
    # Use LLM to synthesize opinions into final decision
    decision = _synthesize_decision_with_llm(state)
    
    # Apply risk limits
    limits = risk_limits()
    max_position_size = limits.get("max_position_size_pct", 0.1)
    
    if decision.size_pct > max_position_size:
        decision.size_pct = max_position_size
        logger.info("Position size capped by risk limits", 
                   run_id=state.run_id, 
                   original_size=decision.size_pct,
                   capped_size=max_position_size)
    
    return decision


def _synthesize_decision_with_llm(state: State) -> FinalDecision:
    """
    Use LLM to synthesize opinions into final decision.
    
    Args:
        state: Current state with opinions
    
    Returns:
        Final decision
    """
    llm = ChatOpenAI(
        model=os.getenv("MODEL_NAME", "gpt-4o"),
        temperature=0.1
    )
    
    # Format opinions for LLM
    opinions_text = "\n\n".join([
        f"{agent.upper()} OPINION:\n"
        f"Action: {opinion.action}\n"
        f"Score: {opinion.score}\n"
        f"Rationale: {opinion.rationale}\n"
        f"Citations: {', '.join(opinion.citations)}\n"
        f"Red Flags: {', '.join(opinion.red_flags) if opinion.red_flags else 'None'}"
        for agent, opinion in state.opinions.items()
    ])
    
    prompt = ChatPromptTemplate.from_template("""
You are a senior trader synthesizing multiple agent opinions into a final trading decision.

SYMBOL: {symbol}
TIMEFRAME: {timeframe}

AGENT OPINIONS:
{opinions}

You must respond with a valid JSON object in this exact format:
{{
    "action": "BUY" | "SELL" | "FLAT",
    "size_pct": <float between 0.01 and 0.25>,
    "entry_type": "market" | "limit",
    "entry_price": <float or null>,
    "stop_loss": <float or null>,
    "take_profit": [<float>, <float>] or null,
    "confidence": <float between 0.0 and 1.0>,
    "citations": ["<source1>", "<source2>"]
}}

Guidelines:
- Synthesize opinions considering their confidence scores
- If opinions conflict, favor higher confidence or more recent analysis
- Size percentage should reflect overall confidence (0.01-0.25)
- Set stop loss and take profit based on technical levels
- Only respond with valid JSON, no other text.
""")
    
    try:
        response = llm.invoke(prompt.format(
            symbol=state.symbol,
            timeframe=state.timeframe,
            opinions=opinions_text
        ))
        
        # Parse JSON response - handle markdown formatting
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:]  # Remove ```json
        if content.endswith("```"):
            content = content[:-3]  # Remove ```
        content = content.strip()
        
        decision_data = json.loads(content)
        
        # Create FinalDecision
        decision = FinalDecision(
            symbol=state.symbol,
            action=decision_data["action"],
            size_pct=decision_data["size_pct"],
            entry=EntryOrder(
                type=decision_data["entry_type"],
                price=decision_data.get("entry_price")
            ),
            sl=decision_data.get("stop_loss"),
            tp=decision_data.get("take_profit"),
            confidence=decision_data["confidence"],
            citations=decision_data.get("citations", [])
        )
        
        return decision
        
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        logger.error("Failed to parse LLM decision", error=str(e), response=response.content)
        
        # Fallback decision based on simple averaging
        return _create_fallback_decision(state)


def _create_fallback_decision(state: State) -> FinalDecision:
    """
    Create fallback decision when LLM fails.
    
    Args:
        state: Current state with opinions
    
    Returns:
        Fallback decision
    """
    if not state.opinions:
        raise ValueError("No opinions available for fallback decision")
    
    # Simple averaging of opinions
    actions = [op.action for op in state.opinions.values()]
    scores = [op.score for op in state.opinions.values()]
    
    # Count actions
    action_counts = {"BUY": 0, "SELL": 0, "FLAT": 0}
    for action in actions:
        action_counts[action] += 1
    
    # Determine final action
    if action_counts["BUY"] > action_counts["SELL"] and action_counts["BUY"] > action_counts["FLAT"]:
        final_action = "BUY"
    elif action_counts["SELL"] > action_counts["BUY"] and action_counts["SELL"] > action_counts["FLAT"]:
        final_action = "SELL"
    else:
        final_action = "FLAT"
    
    # Average confidence
    avg_confidence = sum(scores) / len(scores)
    
    # Conservative position size
    size_pct = min(0.1, avg_confidence * 0.15)
    
    # Collect citations
    all_citations = []
    for opinion in state.opinions.values():
        all_citations.extend(opinion.citations)
    
    return FinalDecision(
        symbol=state.symbol,
        action=final_action,
        size_pct=size_pct,
        entry=EntryOrder(type="market", price=None),
        confidence=avg_confidence,
        citations=list(set(all_citations)),  # Remove duplicates
        sl=None,
        tp=None
    )
