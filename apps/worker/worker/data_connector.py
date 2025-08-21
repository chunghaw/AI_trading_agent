"""Data connector for integrating Airflow DAG outputs with the RAG system."""

import os
import json
import pandas as pd
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from pathlib import Path
from loguru import logger

from .vector_service import search_milvus, initialize_milvus
from .models import TradingDecision, RiskAssessment


class DataConnector:
    """Connector for integrating data pipeline outputs with the trading system."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logger.bind(component="DataConnector")
        
        # Data directories
        self.indicators_dir = config.get("indicators_dir", "/opt/airflow/data/indicators")
        self.news_collection = config.get("news_collection", "news_chunks")
        
        # Initialize vector database
        try:
            initialize_milvus()
            self.logger.info("Vector database initialized for data connector")
        except Exception as e:
            self.logger.warning(f"Vector database initialization failed: {e}")
    
    def get_latest_indicators(self, symbol: str, timeframe: str = "1h") -> Optional[pd.DataFrame]:
        """Get latest technical indicators for a symbol."""
        try:
            # Try to find the indicator file
            file_patterns = [
                f"equity_{symbol}_{timeframe}.parquet",
                f"crypto_{symbol}_{timeframe}.parquet"
            ]
            
            for pattern in file_patterns:
                file_path = Path(self.indicators_dir) / pattern
                if file_path.exists():
                    df = pd.read_parquet(file_path)
                    self.logger.info(f"Loaded indicators for {symbol}: {len(df)} rows")
                    return df
            
            self.logger.warning(f"No indicator file found for {symbol} with timeframe {timeframe}")
            return None
            
        except Exception as e:
            self.logger.error(f"Failed to load indicators for {symbol}: {e}")
            return None
    
    def get_news_context(self, symbol: str, query: str = "", limit: int = 5) -> List[Dict[str, Any]]:
        """Get relevant news context for a symbol from Milvus."""
        try:
            # Search for news related to the symbol
            search_query = f"{symbol} {query}".strip()
            context = search_milvus(search_query, top_k=limit)
            
            # Parse the context into structured format
            news_items = []
            if context and context != "No relevant info found. Please add more to the knowledge base.":
                # Simple parsing - in production, you'd want more sophisticated parsing
                news_items.append({
                    "symbol": symbol,
                    "content": context,
                    "source": "milvus_news",
                    "timestamp": datetime.now().isoformat()
                })
            
            self.logger.info(f"Retrieved {len(news_items)} news items for {symbol}")
            return news_items
            
        except Exception as e:
            self.logger.error(f"Failed to get news context for {symbol}: {e}")
            return []
    
    def get_market_data(self, symbol: str, timeframe: str = "1h") -> Dict[str, Any]:
        """Get comprehensive market data for a symbol."""
        try:
            # Get technical indicators
            indicators_df = self.get_latest_indicators(symbol, timeframe)
            
            # Get news context
            news_context = self.get_news_context(symbol)
            
            # Compile market data
            market_data = {
                "symbol": symbol,
                "timeframe": timeframe,
                "timestamp": datetime.now().isoformat(),
                "indicators": {},
                "news": news_context,
                "summary": {}
            }
            
            if indicators_df is not None and not indicators_df.empty:
                # Get latest values
                latest = indicators_df.iloc[-1]
                market_data["indicators"] = {
                    "close": float(latest.get("c", 0)),
                    "volume": float(latest.get("v", 0)),
                    "rsi": float(latest.get("rsi14", 50)),
                    "macd": float(latest.get("macd", 0)),
                    "macd_signal": float(latest.get("macd_signal", 0)),
                    "macd_histogram": float(latest.get("macd_hist", 0))
                }
                
                # Generate summary
                market_data["summary"] = self._generate_market_summary(indicators_df)
            
            return market_data
            
        except Exception as e:
            self.logger.error(f"Failed to get market data for {symbol}: {e}")
            return {
                "symbol": symbol,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def _generate_market_summary(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate market summary from indicators."""
        if df.empty:
            return {}
        
        try:
            latest = df.iloc[-1]
            prev = df.iloc[-2] if len(df) > 1 else latest
            
            # Calculate trends
            price_change = (latest["c"] - prev["c"]) / prev["c"] if prev["c"] > 0 else 0
            volume_change = (latest["v"] - prev["v"]) / prev["v"] if prev["v"] > 0 else 0
            
            # RSI analysis
            rsi = latest.get("rsi14", 50)
            rsi_trend = "oversold" if rsi < 30 else "overbought" if rsi > 70 else "neutral"
            
            # MACD analysis
            macd = latest.get("macd", 0)
            macd_signal = latest.get("macd_signal", 0)
            macd_hist = latest.get("macd_hist", 0)
            
            macd_signal_type = "bullish" if macd > macd_signal else "bearish"
            
            return {
                "price_change_pct": round(price_change * 100, 2),
                "volume_change_pct": round(volume_change * 100, 2),
                "rsi": round(rsi, 2),
                "rsi_trend": rsi_trend,
                "macd_signal": macd_signal_type,
                "macd_histogram": round(macd_hist, 4),
                "trend": "bullish" if price_change > 0 and macd > macd_signal else "bearish" if price_change < 0 and macd < macd_signal else "neutral"
            }
            
        except Exception as e:
            self.logger.error(f"Failed to generate market summary: {e}")
            return {}
    
    def get_portfolio_indicators(self, symbols: List[str], timeframe: str = "1h") -> Dict[str, Any]:
        """Get indicators for multiple symbols in a portfolio."""
        portfolio_data = {}
        
        for symbol in symbols:
            market_data = self.get_market_data(symbol, timeframe)
            portfolio_data[symbol] = market_data
        
        return portfolio_data
    
    def validate_data_quality(self, symbol: str) -> Dict[str, Any]:
        """Validate data quality for a symbol."""
        try:
            indicators_df = self.get_latest_indicators(symbol)
            news_context = self.get_news_context(symbol)
            
            quality_metrics = {
                "symbol": symbol,
                "timestamp": datetime.now().isoformat(),
                "indicators_available": indicators_df is not None and not indicators_df.empty,
                "news_available": len(news_context) > 0,
                "data_freshness": None,
                "completeness_score": 0.0
            }
            
            if indicators_df is not None and not indicators_df.empty:
                # Check data freshness
                latest_time = indicators_df.index[-1]
                time_diff = datetime.now() - latest_time.replace(tzinfo=None)
                quality_metrics["data_freshness"] = time_diff.total_seconds() / 3600  # hours
                
                # Check completeness
                completeness = 1.0
                required_columns = ["c", "v", "rsi14", "macd"]
                for col in required_columns:
                    if col not in indicators_df.columns or indicators_df[col].isna().sum() > 0:
                        completeness -= 0.25
                
                quality_metrics["completeness_score"] = max(0.0, completeness)
            
            return quality_metrics
            
        except Exception as e:
            self.logger.error(f"Failed to validate data quality for {symbol}: {e}")
            return {
                "symbol": symbol,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
