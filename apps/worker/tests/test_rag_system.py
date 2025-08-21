"""Tests for the RAG-based trading system."""

import pytest
import asyncio
from unittest.mock import Mock, patch
from datetime import datetime

from worker.trading_orchestrator import TradingOrchestrator
from worker.models import TradingDecision, RiskAssessment
from worker.agents.base_agent import AgentResponse
from worker.agents import NewsAnalyst


@pytest.mark.asyncio
async def test_news_analyst_rag():
    """Test NewsAnalyst RAG capabilities."""
    config = {"news_analyst": {}}
    analyst = NewsAnalyst(config=config)
    
    # Test basic initialization
    assert analyst.name == "NewsAnalyst"
    assert analyst.collection_name == "newsanalyst_knowledge_base"
    
    # Test knowledge ingestion
    test_knowledge = "Positive news typically includes earnings beats and new product launches."
    analyst.ingest_knowledge(test_knowledge, {"type": "sentiment_pattern", "category": "positive"})
    
    # Test context retrieval
    context = analyst.get_context("positive news sentiment")
    assert isinstance(context, str)
    
    # Test analysis (with mocked data)
    with patch.object(analyst, 'fetch_news_data') as mock_fetch, \
         patch.object(analyst, 'analyze_sentiment') as mock_sentiment, \
         patch.object(analyst, 'get_macro_indicators') as mock_macro, \
         patch.object(analyst, 'get_technical_context') as mock_tech:
        
        mock_fetch.return_value = {
            "articles": [
                {
                    "title": "AAPL reports strong earnings",
                    "description": "Apple beats expectations",
                    "publishedAt": datetime.now().isoformat(),
                    "sentiment": "positive"
                }
            ],
            "total_results": 1,
            "source": "test"
        }
        
        mock_sentiment.return_value = {
            "sentiment_score": 0.8,
            "news_count": 1,
            "positive_news": 1,
            "negative_news": 0,
            "neutral_news": 0,
            "key_events": ["Apple reports strong earnings"],
            "confidence": 0.9
        }
        
        mock_macro.return_value = {
            "inflation_rate": 2.5,
            "interest_rate": 5.25,
            "gdp_growth": 2.1,
            "unemployment_rate": 3.8,
            "market_volatility": 0.15,
            "confidence": 0.8
        }
        
        mock_tech.return_value = {"data_available": False}

        result = await analyst.analyze("AAPL", {})

        assert isinstance(result, AgentResponse)
        assert result.success
        assert "sentiment_score" in result.data
        assert "news_count" in result.data


@pytest.mark.asyncio
async def test_trading_orchestrator_rag():
    """Test TradingOrchestrator with RAG system."""
    config = {}
    orchestrator = TradingOrchestrator(config=config)
    
    # Test basic initialization
    assert orchestrator.news_analyst is not None
    assert orchestrator.risk_manager is not None
    
    # Test symbol analysis (with mocked news analyst)
    with patch.object(orchestrator.news_analyst, 'analyze') as mock_analyze:
        mock_response = AgentResponse(
            success=True,
            data={
                "sentiment_score": 0.6,
                "news_count": 3,
                "positive_news": 2,
                "negative_news": 0,
                "neutral_news": 1,
                "macro_indicators": {
                    "gdp_growth": 2.1,
                    "inflation_rate": 2.5
                }
            },
            message="News analysis completed",
            confidence=0.8
        )
        mock_analyze.return_value = mock_response
        
        result = await orchestrator.analyze_symbol("AAPL")
        
        assert result["success"]
        assert result["symbol"] == "AAPL"
        assert "summary" in result
        assert "rag_metadata" in result
        assert result["rag_metadata"]["context_retrieved"] is True


@pytest.mark.asyncio
async def test_trading_decision_creation():
    """Test creating standardized trading decisions."""
    config = {}
    orchestrator = TradingOrchestrator(config=config)
    
    with patch.object(orchestrator, 'analyze_symbol') as mock_analyze:
        mock_analyze.return_value = {
            "success": True,
            "summary": {"confidence": 0.75}
        }
        
        decision = await orchestrator.create_trading_decision("AAPL", "BUY", 0.1)
        
        assert isinstance(decision, TradingDecision)
        assert decision.symbol == "AAPL"
        assert decision.action == "BUY"
        assert decision.size_pct == 0.1
        assert decision.confidence == 0.75
        assert len(decision.citations) > 0


@pytest.mark.asyncio
async def test_risk_assessment():
    """Test risk assessment functionality."""
    config = {}
    orchestrator = TradingOrchestrator(config=config)
    
    # Create a test decision
    decision = TradingDecision(
        symbol="AAPL",
        action="BUY",
        size_pct=0.1,
        entry={"type": "market", "price": None},
        confidence=0.8,
        citations=[]
    )
    
    # Test risk assessment
    risk_assessment = await orchestrator.assess_risk_for_decision(decision)
    
    assert isinstance(risk_assessment, RiskAssessment)
    assert 0 <= risk_assessment.total_risk <= 1
    assert risk_assessment.risk_level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


@pytest.mark.asyncio
async def test_portfolio_constraints():
    """Test portfolio constraints checking."""
    config = {}
    orchestrator = TradingOrchestrator(config=config)
    
    # Create a test decision
    decision = TradingDecision(
        symbol="AAPL",
        action="BUY",
        size_pct=0.05,  # 5% position size
        entry={"type": "market", "price": None},
        confidence=0.8,
        citations=[]
    )
    
    # Test constraints check
    constraints_result = await orchestrator.check_constraints(decision)
    
    assert "constraints_met" in constraints_result
    assert "violations" in constraints_result
    assert isinstance(constraints_result["violations"], list)


@pytest.mark.asyncio
async def test_portfolio_summary():
    """Test portfolio summary functionality."""
    config = {}
    orchestrator = TradingOrchestrator(config=config)
    
    summary = await orchestrator.get_portfolio_summary()
    
    assert "total_value" in summary
    assert "cash_balance" in summary
    assert "positions_value" in summary
    assert "num_positions" in summary
    assert "daily_trades" in summary
    assert "rag_system" in summary
    assert summary["rag_system"] == "Active"


@pytest.mark.asyncio
async def test_agent_status():
    """Test agent status reporting."""
    config = {}
    orchestrator = TradingOrchestrator(config=config)
    
    status = orchestrator.get_agent_status()
    
    assert "news_analyst" in status
    assert "rag_system" in status
    assert status["rag_system"]["status"] == "active"
    assert status["rag_system"]["agents_available"] == 2
    assert status["rag_system"]["knowledge_base"] == "initialized"


@pytest.mark.asyncio
async def test_error_handling():
    """Test error handling in RAG system."""
    config = {}
    orchestrator = TradingOrchestrator(config=config)
    
    # Test with failing news analyst
    with patch.object(orchestrator.news_analyst, 'analyze') as mock_analyze:
        mock_analyze.side_effect = Exception("News API error")
        
        result = await orchestrator.analyze_symbol("INVALID")
        
        # The orchestrator should still return success=True even if individual agents fail
        # because it handles errors gracefully and continues with available data
        assert result["success"] is True
        assert result["symbol"] == "INVALID"
        assert "analyst_results" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
