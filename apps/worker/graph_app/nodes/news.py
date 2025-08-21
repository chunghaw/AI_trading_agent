"""News analysis node for LangGraph."""

import json
import os
from typing import Dict, Any
import structlog
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from ..schemas import Opinion, State
from ..tools import news_search

logger = structlog.get_logger()


def news_node(state: State) -> State:
    """
    News analysis node that searches news and forms an opinion.
    
    Args:
        state: Current graph state
    
    Returns:
        Updated state with news opinion
    """
    try:
        logger.info("Starting news analysis", run_id=state.run_id, symbol=state.symbol)
        
        # Search for news
        news_items = news_search(state.symbol, since_days=7)
        state.news = news_items
        
        if not news_items:
            logger.warning("No news found", run_id=state.run_id)
            # Create a neutral opinion
            opinion = Opinion(
                score=0.5,
                action="FLAT",
                rationale="No recent news found for analysis",
                citations=["news_search"]
            )
        else:
            # Generate opinion using LLM
            opinion = _generate_news_opinion(state.symbol, news_items)
        
        # Store opinion in state
        state.opinions["news"] = opinion
        state.updated_at = state.updated_at
        
        logger.info("News analysis completed", 
                   run_id=state.run_id, 
                   action=opinion.action, 
                   score=opinion.score)
        
        return state
        
    except Exception as e:
        logger.error("News analysis failed", run_id=state.run_id, error=str(e))
        state.status = "FAILED"
        state.error_message = f"News analysis failed: {str(e)}"
        return state


def _generate_news_opinion(symbol: str, news_items: list) -> Opinion:
    """
    Generate news opinion using LLM.
    
    Args:
        symbol: Trading symbol
        news_items: List of news articles
    
    Returns:
        News opinion
    """
    llm = ChatOpenAI(
        model=os.getenv("MODEL_NAME", "gpt-4o"),
        temperature=0.1
    )
    
    # Format news for analysis
    news_text = "\n\n".join([
        f"Article {i+1}:\n{item['text']}\nScore: {item.get('score', 0.0)}"
        for i, item in enumerate(news_items[:5])  # Limit to top 5 articles
    ])
    
    prompt = ChatPromptTemplate.from_template("""
You are a financial news analyst. Analyze the following news articles about {symbol} and provide a trading opinion.

NEWS ARTICLES:
{news_text}

You must respond with a valid JSON object in this exact format:
{{
    "score": <float between 0.0 and 1.0>,
    "action": "BUY" | "SELL" | "FLAT",
    "rationale": "<detailed reasoning based on news sentiment, minimum 10 characters>",
    "citations": ["<news_source1>", "<news_source2>"],
    "red_flags": ["<risk1>", "<risk2>"]  // optional
}}

Guidelines:
- Positive news (earnings beats, upgrades, positive outlook): BUY
- Negative news (misses, downgrades, negative outlook): SELL
- Mixed or neutral news: FLAT
- Score based on sentiment strength and news recency
- Include specific news sources in citations
- Only respond with valid JSON, no other text.
""")
    
    try:
        response = llm.invoke(prompt.format(
            symbol=symbol,
            news_text=news_text
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
        
        # Fallback opinion based on simple sentiment
        sentiment_score = _calculate_simple_sentiment(news_items)
        
        return Opinion(
            score=sentiment_score,
            action="BUY" if sentiment_score > 0.6 else "SELL" if sentiment_score < 0.4 else "FLAT",
            rationale="Fallback opinion based on simple sentiment analysis due to LLM parsing error",
            citations=["news_sentiment_analysis"],
            red_flags=["LLM response parsing failed"]
        )


def _calculate_simple_sentiment(news_items: list) -> float:
    """
    Calculate simple sentiment score as fallback.
    
    Args:
        news_items: List of news articles
    
    Returns:
        Sentiment score between 0.0 and 1.0
    """
    if not news_items:
        return 0.5
    
    # Simple keyword-based sentiment
    positive_words = ["positive", "beat", "upgrade", "bullish", "growth", "profit", "gain"]
    negative_words = ["negative", "miss", "downgrade", "bearish", "loss", "decline", "risk"]
    
    total_score = 0.0
    for item in news_items:
        text = item.get('text', '').lower()
        score = item.get('score', 0.5)
        
        # Count positive and negative words
        pos_count = sum(1 for word in positive_words if word in text)
        neg_count = sum(1 for word in negative_words if word in text)
        
        # Calculate sentiment
        if pos_count > neg_count:
            sentiment = 0.7 + (score * 0.3)
        elif neg_count > pos_count:
            sentiment = 0.3 - (score * 0.3)
        else:
            sentiment = 0.5
        
        total_score += sentiment
    
    return total_score / len(news_items)
