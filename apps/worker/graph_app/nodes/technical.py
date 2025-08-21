"""Technical analysis node for LangGraph."""

import json
from typing import Dict, Any
import structlog
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from ..schemas import Opinion, State
from ..tools import get_bars, compute_indicators
import os

logger = structlog.get_logger()


def technical_node(state: State) -> State:
    """
    Technical analysis node that computes indicators and forms an opinion.
    
    Args:
        state: Current graph state
    
    Returns:
        Updated state with technical opinion
    """
    try:
        logger.info("Starting technical analysis", run_id=state.run_id, symbol=state.symbol)
        
        # Get market data
        df = get_bars(state.symbol, state.timeframe)
        state.bars = df.tail(100).to_dict('records')  # Store last 100 bars
        
        # Compute technical indicators
        indicators = compute_indicators(df)
        
        if not indicators:
            logger.warning("No indicators computed", run_id=state.run_id)
            # Create a neutral opinion
            opinion = Opinion(
                score=0.5,
                action="FLAT",
                rationale="Unable to compute technical indicators due to insufficient data",
                citations=["technical_analysis"]
            )
        else:
            # Generate opinion using LLM
            opinion = _generate_technical_opinion(state.symbol, indicators)
        
        # Store opinion in state
        state.opinions["technical"] = opinion
        state.updated_at = state.updated_at
        
        logger.info("Technical analysis completed", 
                   run_id=state.run_id, 
                   action=opinion.action, 
                   score=opinion.score)
        
        return state
        
    except Exception as e:
        logger.error("Technical analysis failed", run_id=state.run_id, error=str(e))
        state.status = "FAILED"
        state.error_message = f"Technical analysis failed: {str(e)}"
        return state


def _generate_technical_opinion(symbol: str, indicators: Dict[str, float]) -> Opinion:
    """
    Generate technical opinion using LLM.
    
    Args:
        symbol: Trading symbol
        indicators: Technical indicators
    
    Returns:
        Technical opinion
    """
    llm = ChatOpenAI(
        model=os.getenv("MODEL_NAME", "gpt-4o"),
        temperature=0.1
    )
    
    prompt = ChatPromptTemplate.from_template("""
You are a technical analyst. Analyze the following indicators for {symbol} and provide a trading opinion.

INDICATORS:
{indicators}

You must respond with a valid JSON object in this exact format:
{{
    "score": <float between 0.0 and 1.0>,
    "action": "BUY" | "SELL" | "FLAT",
    "rationale": "<detailed reasoning, minimum 10 characters>",
    "citations": ["<source1>", "<source2>"],
    "red_flags": ["<risk1>", "<risk2>"]  // optional
}}

Guidelines:
- RSI > 70: overbought (bearish), RSI < 30: oversold (bullish)
- MACD above signal: bullish, MACD below signal: bearish
- Price above upper BB: overbought, Price below lower BB: oversold
- Price above SMA20 > SMA50: uptrend, Price below SMA20 < SMA50: downtrend
- Score 0.0-0.3: weak signal, 0.3-0.7: moderate, 0.7-1.0: strong
- Only respond with valid JSON, no other text.
""")
    
    try:
        # Format indicators for display
        indicators_text = "\n".join([f"{k}: {v:.4f}" for k, v in indicators.items()])
        
        response = llm.invoke(prompt.format(
            symbol=symbol,
            indicators=indicators_text
        ))
        
        # Parse JSON response - handle markdown formatting
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:]  # Remove ```json
        if content.endswith("```"):
            content = content[:-3]  # Remove ```
        content = content.strip()
        
        opinion_data = json.loads(content)
        
        # Validate and create Opinion
        opinion = Opinion(
            score=opinion_data["score"],
            action=opinion_data["action"],
            rationale=opinion_data["rationale"],
            citations=opinion_data.get("citations", []),
            red_flags=opinion_data.get("red_flags")
        )
        
        return opinion
        
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        logger.error("Failed to parse LLM response", error=str(e), response=response.content)
        
        # Fallback opinion
        return Opinion(
            score=0.5,
            action="FLAT",
            rationale="Unable to generate technical opinion due to invalid LLM response",
            citations=["technical_analysis"],
            red_flags=["LLM response parsing failed"]
        )
