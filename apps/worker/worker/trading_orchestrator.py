"""Trading Orchestrator - coordinates RAG-based agents and manages trading workflow."""

import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger

from .agents import NewsAnalyst
from .agents.technical_analyst import TechnicalAnalyst
from .models import TradingDecision, RiskAssessment, PortfolioConstraints, AgentResponse
from .risk_manager import RiskManager
from .data_connector import DataConnector


class TradingOrchestrator:
    """Trading Orchestrator for RAG-based multi-agent system."""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.logger = logger.bind(orchestrator="TradingOrchestrator")
        
        # Initialize RAG-based agents
        self.news_analyst = NewsAnalyst(config=self.config.get("news_analyst", {}))
        self.technical_analyst = TechnicalAnalyst(config=self.config.get("technical_analyst", {}))
        
        # Initialize risk manager
        self.risk_manager = RiskManager(config=self.config.get("risk_manager", {}))
        
        # Initialize data connector
        self.data_connector = DataConnector(config=self.config.get("data_connector", {}))
        
        # Portfolio state (simplified for RAG demo)
        self.portfolio_state = {
            "total_value": 1000000,
            "cash_balance": 500000,
            "positions": {},
            "daily_trades": 0,
            "last_updated": datetime.now().isoformat()
        }
    
    async def analyze_symbol(self, symbol: str) -> Dict[str, Any]:
        """Analyze a single symbol using RAG-based agents."""
        self.logger.info(f"Starting RAG analysis for {symbol}")
        
        try:
            # Get market data from data connector
            market_data = self.data_connector.get_market_data(symbol)
            
            # Run RAG-based analysis
            analyst_results = await self._run_rag_analysts(symbol, market_data)
            
            # Generate summary
            summary = self._generate_summary(symbol, analyst_results, market_data)
            
            # Create recommendations
            recommendations = self._generate_recommendations(analyst_results, market_data)
            
            result = {
                "success": True,
                "symbol": symbol,
                "timestamp": datetime.now().isoformat(),
                "summary": summary,
                "analyst_results": analyst_results,
                "market_data": market_data,
                "recommendations": recommendations,
                "rag_metadata": {
                    "agents_used": list(analyst_results.keys()),
                    "context_retrieved": True,
                    "ai_generated": True,
                    "data_sources": self._get_data_sources(market_data, analyst_results)
                }
            }
            
            self.logger.info(f"RAG analysis completed for {symbol}: {summary['action']}")
            return result
            
        except Exception as e:
            self.logger.error(f"RAG analysis failed for {symbol}: {e}")
            return {
                "success": False,
                "symbol": symbol,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def _run_rag_analysts(self, symbol: str, market_data: Dict[str, Any]) -> Dict[str, Any]:
        """Run RAG-based analysts for the symbol."""
        self.logger.info(f"Running RAG analysts for {symbol}")
        
        analyst_results = {}
        
        # Run News Analyst (RAG-based)
        try:
            news_result = await self.news_analyst.analyze(symbol, market_data)
            analyst_results["news"] = news_result
        except Exception as e:
            self.logger.error(f"News analyst failed: {e}")
            analyst_results["news"] = None
        
        # Run Technical Analyst (RAG-based)
        try:
            technical_result = await self.technical_analyst.analyze(symbol, market_data)
            analyst_results["technical"] = technical_result
        except Exception as e:
            self.logger.error(f"Technical analyst failed: {e}")
            analyst_results["technical"] = None
        
        return analyst_results
    
    def _generate_summary(self, symbol: str, analyst_results: Dict[str, Any], market_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate summary from RAG analysis results."""
        news_analysis = analyst_results.get("news")
        technical_analysis = analyst_results.get("technical")
        indicators = market_data.get("indicators", {})
        summary_data = market_data.get("summary", {})
        
        # Combine sentiment and technical analysis
        sentiment_score = 0.0
        if news_analysis and news_analysis.success:
            sentiment_score = news_analysis.data.get("sentiment_score", 0)
        
        # Technical signals
        technical_score = 0.0
        technical_signal = "NEUTRAL"
        if technical_analysis and technical_analysis.success:
            signals = technical_analysis.data.get("signals", {})
            technical_signal = signals.get("overall_signal", "NEUTRAL")
            technical_score = 0.3 if technical_signal == "BUY" else -0.3 if technical_signal == "SELL" else 0.0
        
        # Basic technical indicators
        rsi = indicators.get("rsi", 50)
        macd_signal = indicators.get("macd_signal", 0)
        price_trend = summary_data.get("trend", "neutral")
        
        # Combined analysis
        combined_score = (sentiment_score + technical_score) / 2
        
        # Determine action
        if combined_score > 0.3:
            action = "BUY"
            confidence = min(abs(combined_score) * 2, 1.0)
        elif combined_score < -0.3:
            action = "SELL"
            confidence = min(abs(combined_score) * 2, 1.0)
        else:
            action = "HOLD"
            confidence = 0.5
        
        return {
            "action": action,
            "confidence": confidence,
            "position_size": 0.1 if action != "HOLD" else 0.0,
            "risk_approval": "APPROVED" if confidence > 0.6 else "PENDING",
            "final_status": "APPROVED" if confidence > 0.7 else "PENDING",
            "rag_insights": f"Sentiment: {sentiment_score:.2f}, Technical: {technical_score:.2f}",
            "technical_signals": {
                "rsi": rsi,
                "macd_signal": macd_signal,
                "price_trend": price_trend,
                "technical_signal": technical_signal
            },
            "analysis_breakdown": {
                "sentiment_score": sentiment_score,
                "technical_score": technical_score,
                "combined_score": combined_score
            }
        }
    
    def _generate_recommendations(self, analyst_results: Dict[str, Any], market_data: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on RAG analysis."""
        recommendations = []
        
        # News-based recommendations
        news_analysis = analyst_results.get("news")
        if news_analysis and news_analysis.success:
            sentiment_score = news_analysis.data.get("sentiment_score", 0)
            
            if sentiment_score > 0.3:
                recommendations.append("Positive news sentiment suggests bullish outlook")
            elif sentiment_score < -0.3:
                recommendations.append("Negative news sentiment suggests bearish outlook")
            else:
                recommendations.append("Neutral news sentiment - monitor for changes")
            
            macro_indicators = news_analysis.data.get("macro_indicators", {})
            if macro_indicators:
                recommendations.append(f"Macro environment: GDP {macro_indicators.get('gdp_growth', 'N/A')}%, Inflation {macro_indicators.get('inflation_rate', 'N/A')}%")
        
        # Technical recommendations
        technical_analysis = analyst_results.get("technical")
        if technical_analysis and technical_analysis.success:
            signals = technical_analysis.data.get("signals", {})
            buy_signals = signals.get("buy_signals", [])
            sell_signals = signals.get("sell_signals", [])
            
            if buy_signals:
                recommendations.append(f"Technical buy signals: {', '.join(buy_signals[:3])}")
            if sell_signals:
                recommendations.append(f"Technical sell signals: {', '.join(sell_signals[:3])}")
            
            trend = technical_analysis.data.get("trend", {})
            if trend and not trend.get("error"):
                recommendations.append(f"Price trend: {trend.get('trend', 'unknown')}")
        
        # Basic technical recommendations
        indicators = market_data.get("indicators", {})
        rsi = indicators.get("rsi", 50)
        if rsi < 30:
            recommendations.append("RSI indicates oversold conditions - potential buying opportunity")
        elif rsi > 70:
            recommendations.append("RSI indicates overbought conditions - consider taking profits")
        
        summary = market_data.get("summary", {})
        trend = summary.get("trend", "neutral")
        if trend != "neutral":
            recommendations.append(f"Price trend is {trend} - align with trend direction")
        
        if not recommendations:
            recommendations.append("RAG analysis completed - consider market conditions")
        
        return recommendations
    
    def _get_data_sources(self, market_data: Dict[str, Any], analyst_results: Dict[str, Any]) -> Dict[str, str]:
        """Get information about data sources used."""
        sources = {
            "technical_data": "unavailable",
            "news_data": "unavailable",
            "vector_db": "unavailable"
        }
        
        # Check technical data availability
        if market_data.get("indicators"):
            sources["technical_data"] = "available"
        
        # Check news data availability
        news_analysis = analyst_results.get("news")
        if news_analysis and news_analysis.success:
            sources["news_data"] = news_analysis.data.get("news_source", "unknown")
        
        # Check technical analysis availability
        technical_analysis = analyst_results.get("technical")
        if technical_analysis and technical_analysis.success:
            sources["technical_data"] = "enhanced"
        
        # Check vector database status
        try:
            from .vector_service import get_collection_stats
            stats = get_collection_stats()
            if stats["trading_agents"]["status"] == "active" or stats["news"]["status"] == "active":
                sources["vector_db"] = "active"
        except:
            pass
        
        return sources
    
    async def create_trading_decision(self, symbol: str, action: str, size_pct: float) -> TradingDecision:
        """Create a standardized trading decision."""
        # Get analysis for confidence
        analysis_result = await self.analyze_symbol(symbol)
        confidence = analysis_result.get("summary", {}).get("confidence", 0.0)
        
        # Create citations from analysis
        citations = []
        if analysis_result.get("success"):
            citations.append({
                "source": f"rag://{symbol}/news",
                "confidence": confidence,
                "timestamp": datetime.now()
            })
            
            # Add technical citations if available
            analyst_results = analysis_result.get("analyst_results", {})
            if analyst_results.get("technical"):
                citations.append({
                    "source": f"technical://{symbol}/indicators",
                    "confidence": confidence,
                    "timestamp": datetime.now()
                })
            
            # Add technical citations if available
            market_data = analysis_result.get("market_data", {})
            if market_data.get("indicators"):
                citations.append({
                    "source": f"technical://{symbol}/indicators",
                    "confidence": confidence,
                    "timestamp": datetime.now()
                })
        
        return TradingDecision(
            symbol=symbol,
            action=action,
            size_pct=size_pct,
            entry={"type": "market", "price": None},
            confidence=confidence,
            citations=citations
        )
    
    async def assess_risk_for_decision(self, decision: TradingDecision) -> RiskAssessment:
        """Assess risk for a trading decision."""
        return await self.risk_manager.assess_risk(decision)
    
    async def check_constraints(self, decision: TradingDecision) -> Dict[str, Any]:
        """Check portfolio constraints for a decision."""
        return await self.risk_manager.check_portfolio_constraints(decision)
    
    async def get_portfolio_analysis(self, symbols: List[str] = None) -> Dict[str, Any]:
        """Get comprehensive portfolio analysis."""
        if symbols is None:
            symbols = list(self.portfolio_state["positions"].keys())
        
        portfolio_data = self.data_connector.get_portfolio_indicators(symbols)
        
        return {
            "portfolio_summary": await self.get_portfolio_summary(),
            "symbol_analysis": portfolio_data,
            "data_quality": {
                symbol: self.data_connector.validate_data_quality(symbol)
                for symbol in symbols
            }
        }
    
    async def update_portfolio_state(self, trade_execution: Dict[str, Any]) -> None:
        """Update portfolio state after trade execution."""
        if trade_execution.get("executed", False):
            self.portfolio_state["daily_trades"] += 1
            self.portfolio_state["last_updated"] = datetime.now().isoformat()
            
            symbol = trade_execution.get("symbol")
            if symbol:
                self.portfolio_state["positions"][symbol] = {
                    "quantity": trade_execution.get("quantity", 0),
                    "price": trade_execution.get("price", 0),
                    "timestamp": datetime.now().isoformat()
                }
    
    async def get_portfolio_summary(self) -> Dict[str, Any]:
        """Get portfolio summary."""
        return {
            "total_value": self.portfolio_state["total_value"],
            "cash_balance": self.portfolio_state["cash_balance"],
            "positions_value": self.portfolio_state["total_value"] - self.portfolio_state["cash_balance"],
            "num_positions": len(self.portfolio_state["positions"]),
            "daily_trades": self.portfolio_state["daily_trades"],
            "positions": self.portfolio_state["positions"],
            "last_updated": self.portfolio_state["last_updated"],
            "rag_system": "Active"
        }
    
    def get_agent_status(self) -> Dict[str, Any]:
        """Get status of RAG agents."""
        return {
            "news_analyst": self.news_analyst.get_agent_info(),
            "technical_analyst": self.technical_analyst.get_agent_info(),
            "data_connector": {
                "status": "active",
                "indicators_dir": self.data_connector.indicators_dir
            },
            "rag_system": {
                "status": "active",
                "agents_available": 2,
                "knowledge_base": "initialized"
            }
        }
