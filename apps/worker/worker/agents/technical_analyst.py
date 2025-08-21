"""Technical Analyst Agent - analyzes price action and technical indicators using RAG."""

import pandas as pd
import ta
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import numpy as np

from .base_agent import BaseAgent, AgentResponse
from ..data_connector import DataConnector
from ..vector_service import search_trading_knowledge


class TechnicalAnalyst(BaseAgent):
    """Technical Analyst Agent with RAG capabilities for technical analysis."""
    
    def __init__(self, name: str = "TechnicalAnalyst", config: Dict[str, Any] = None):
        super().__init__(name, config or {})
        
        # Initialize data connector for technical data
        self.data_connector = DataConnector(config or {})
        
        # Initialize with technical analysis knowledge
        self._initialize_knowledge_base()
    
    def _initialize_knowledge_base(self):
        """Initialize the knowledge base with technical analysis patterns."""
        knowledge_base = [
            {
                "text": "RSI (Relative Strength Index) interpretation: RSI above 70 indicates overbought conditions, RSI below 30 indicates oversold conditions. RSI divergence can signal trend reversals.",
                "metadata": {"type": "indicator", "category": "momentum", "indicator": "rsi"}
            },
            {
                "text": "MACD (Moving Average Convergence Divergence) signals: When MACD line crosses above signal line, it's a bullish signal. When MACD line crosses below signal line, it's a bearish signal. MACD histogram shows momentum strength.",
                "metadata": {"type": "indicator", "category": "trend", "indicator": "macd"}
            },
            {
                "text": "Support and resistance levels: Support is where price tends to bounce up, resistance is where price tends to bounce down. Breakouts above resistance are bullish, breakdowns below support are bearish.",
                "metadata": {"type": "pattern", "category": "levels"}
            },
            {
                "text": "Volume analysis: High volume confirms price movements. Low volume suggests weak moves. Volume divergence can signal trend reversals.",
                "metadata": {"type": "indicator", "category": "volume"}
            },
            {
                "text": "Trend analysis: Uptrends have higher highs and higher lows. Downtrends have lower highs and lower lows. Sideways trends have no clear direction.",
                "metadata": {"type": "pattern", "category": "trend"}
            }
        ]
        
        for item in knowledge_base:
            self.ingest_knowledge(item["text"], item["metadata"])
    
    def compute_indicators(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Compute technical indicators using pandas-ta."""
        if df.empty:
            return {}
        
        try:
            # Ensure we have required columns
            required_cols = ['o', 'h', 'l', 'c', 'v']
            if not all(col in df.columns for col in required_cols):
                return {"error": "Missing required OHLCV columns"}
            
            # Compute RSI
            rsi = ta.momentum.RSIIndicator(df['c'], window=14).rsi()
            
            # Compute MACD
            macd_indicator = ta.trend.MACD(df['c'], window_slow=26, window_fast=12, window_sign=9)
            macd = macd_indicator.macd()
            macd_signal = macd_indicator.macd_signal()
            macd_histogram = macd_indicator.macd_diff()
            
            # Compute Bollinger Bands
            bb_indicator = ta.volatility.BollingerBands(df['c'], window=20, window_dev=2)
            bb_upper = bb_indicator.bollinger_hband()
            bb_middle = bb_indicator.bollinger_mavg()
            bb_lower = bb_indicator.bollinger_lband()
            
            # Compute Stochastic
            stoch_indicator = ta.momentum.StochasticOscillator(df['h'], df['l'], df['c'], window=14, smooth_window=3)
            stoch_k = stoch_indicator.stoch()
            stoch_d = stoch_indicator.stoch_signal()
            
            # Compute Moving Averages
            sma_20 = ta.trend.SMAIndicator(df['c'], window=20).sma_indicator()
            sma_50 = ta.trend.SMAIndicator(df['c'], window=50).sma_indicator()
            ema_12 = ta.trend.EMAIndicator(df['c'], window=12).ema_indicator()
            ema_26 = ta.trend.EMAIndicator(df['c'], window=26).ema_indicator()
            
            # Compute Volume indicators
            volume_sma = ta.trend.SMAIndicator(df['v'], window=20).sma_indicator()
            volume_ratio = df['v'] / volume_sma
            
            # Get latest values
            latest = {
                "close": float(df['c'].iloc[-1]),
                "volume": float(df['v'].iloc[-1]),
                "rsi": float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50,
                "macd": float(macd.iloc[-1]) if not pd.isna(macd.iloc[-1]) else 0,
                "macd_signal": float(macd_signal.iloc[-1]) if not pd.isna(macd_signal.iloc[-1]) else 0,
                "macd_histogram": float(macd_histogram.iloc[-1]) if not pd.isna(macd_histogram.iloc[-1]) else 0,
                "bb_upper": float(bb_upper.iloc[-1]) if not pd.isna(bb_upper.iloc[-1]) else 0,
                "bb_middle": float(bb_middle.iloc[-1]) if not pd.isna(bb_middle.iloc[-1]) else 0,
                "bb_lower": float(bb_lower.iloc[-1]) if not pd.isna(bb_lower.iloc[-1]) else 0,
                "stoch_k": float(stoch_k.iloc[-1]) if not pd.isna(stoch_k.iloc[-1]) else 50,
                "stoch_d": float(stoch_d.iloc[-1]) if not pd.isna(stoch_d.iloc[-1]) else 50,
                "sma_20": float(sma_20.iloc[-1]) if not pd.isna(sma_20.iloc[-1]) else 0,
                "sma_50": float(sma_50.iloc[-1]) if not pd.isna(sma_50.iloc[-1]) else 0,
                "ema_12": float(ema_12.iloc[-1]) if not pd.isna(ema_12.iloc[-1]) else 0,
                "ema_26": float(ema_26.iloc[-1]) if not pd.isna(ema_26.iloc[-1]) else 0,
                "volume_ratio": float(volume_ratio.iloc[-1]) if not pd.isna(volume_ratio.iloc[-1]) else 1.0
            }
            
            return latest
            
        except Exception as e:
            self.logger.error(f"Failed to compute indicators: {e}")
            return {"error": str(e)}
    
    def analyze_support_resistance(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze support and resistance levels."""
        if df.empty or len(df) < 20:
            return {"error": "Insufficient data for support/resistance analysis"}
        
        try:
            highs = df['h'].rolling(window=20).max()
            lows = df['l'].rolling(window=20).min()
            
            current_price = df['c'].iloc[-1]
            
            # Find recent resistance levels
            recent_highs = highs.tail(50).dropna()
            resistance_levels = recent_highs[recent_highs > current_price].unique()
            resistance_levels = sorted(resistance_levels)[:3]  # Top 3
            
            # Find recent support levels
            recent_lows = lows.tail(50).dropna()
            support_levels = recent_lows[recent_lows < current_price].unique()
            support_levels = sorted(support_levels, reverse=True)[:3]  # Top 3
            
            return {
                "current_price": float(current_price),
                "resistance_levels": [float(x) for x in resistance_levels],
                "support_levels": [float(x) for x in support_levels],
                "nearest_resistance": float(resistance_levels[0]) if resistance_levels else None,
                "nearest_support": float(support_levels[0]) if support_levels else None
            }
            
        except Exception as e:
            self.logger.error(f"Failed to analyze support/resistance: {e}")
            return {"error": str(e)}
    
    def analyze_trend(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze price trend."""
        if df.empty or len(df) < 50:
            return {"error": "Insufficient data for trend analysis"}
        
        try:
            # Calculate moving averages
            sma_20 = ta.trend.SMAIndicator(df['c'], window=20).sma_indicator()
            sma_50 = ta.trend.SMAIndicator(df['c'], window=50).sma_indicator()
            
            current_price = df['c'].iloc[-1]
            current_sma_20 = sma_20.iloc[-1]
            current_sma_50 = sma_50.iloc[-1]
            
            # Determine trend
            if current_price > current_sma_20 > current_sma_50:
                trend = "strong_uptrend"
                trend_strength = 0.8
            elif current_price > current_sma_20:
                trend = "uptrend"
                trend_strength = 0.6
            elif current_price < current_sma_20 < current_sma_50:
                trend = "strong_downtrend"
                trend_strength = -0.8
            elif current_price < current_sma_20:
                trend = "downtrend"
                trend_strength = -0.6
            else:
                trend = "sideways"
                trend_strength = 0.0
            
            # Calculate trend duration
            trend_changes = 0
            for i in range(1, len(sma_20)):
                if (sma_20.iloc[i] > sma_50.iloc[i]) != (sma_20.iloc[i-1] > sma_50.iloc[i-1]):
                    trend_changes += 1
            
            return {
                "trend": trend,
                "trend_strength": trend_strength,
                "trend_changes": trend_changes,
                "current_price": float(current_price),
                "sma_20": float(current_sma_20),
                "sma_50": float(current_sma_50),
                "price_vs_sma20": float(current_price - current_sma_20),
                "price_vs_sma50": float(current_price - current_sma_50)
            }
            
        except Exception as e:
            self.logger.error(f"Failed to analyze trend: {e}")
            return {"error": str(e)}
    
    def generate_signals(self, indicators: Dict[str, Any], trend: Dict[str, Any]) -> Dict[str, Any]:
        """Generate trading signals based on technical analysis."""
        signals = {
            "buy_signals": [],
            "sell_signals": [],
            "neutral_signals": [],
            "overall_signal": "NEUTRAL",
            "confidence": 0.5
        }
        
        try:
            # RSI signals
            rsi = indicators.get("rsi", 50)
            if rsi < 30:
                signals["buy_signals"].append(f"RSI oversold ({rsi:.1f})")
            elif rsi > 70:
                signals["sell_signals"].append(f"RSI overbought ({rsi:.1f})")
            
            # MACD signals
            macd = indicators.get("macd", 0)
            macd_signal = indicators.get("macd_signal", 0)
            macd_hist = indicators.get("macd_histogram", 0)
            
            if macd > macd_signal and macd_hist > 0:
                signals["buy_signals"].append("MACD bullish crossover")
            elif macd < macd_signal and macd_hist < 0:
                signals["sell_signals"].append("MACD bearish crossover")
            
            # Bollinger Bands signals
            close = indicators.get("close", 0)
            bb_upper = indicators.get("bb_upper", 0)
            bb_lower = indicators.get("bb_lower", 0)
            
            if close < bb_lower:
                signals["buy_signals"].append("Price below lower Bollinger Band")
            elif close > bb_upper:
                signals["sell_signals"].append("Price above upper Bollinger Band")
            
            # Stochastic signals
            stoch_k = indicators.get("stoch_k", 50)
            stoch_d = indicators.get("stoch_d", 50)
            
            if stoch_k < 20 and stoch_d < 20:
                signals["buy_signals"].append("Stochastic oversold")
            elif stoch_k > 80 and stoch_d > 80:
                signals["sell_signals"].append("Stochastic overbought")
            
            # Moving average signals
            sma_20 = indicators.get("sma_20", 0)
            sma_50 = indicators.get("sma_50", 0)
            
            if close > sma_20 > sma_50:
                signals["buy_signals"].append("Price above moving averages")
            elif close < sma_20 < sma_50:
                signals["sell_signals"].append("Price below moving averages")
            
            # Volume signals
            volume_ratio = indicators.get("volume_ratio", 1.0)
            if volume_ratio > 1.5:
                signals["neutral_signals"].append("High volume - confirm price action")
            elif volume_ratio < 0.5:
                signals["neutral_signals"].append("Low volume - weak move")
            
            # Determine overall signal
            buy_count = len(signals["buy_signals"])
            sell_count = len(signals["sell_signals"])
            
            if buy_count > sell_count and buy_count >= 2:
                signals["overall_signal"] = "BUY"
                signals["confidence"] = min(0.5 + (buy_count * 0.1), 0.9)
            elif sell_count > buy_count and sell_count >= 2:
                signals["overall_signal"] = "SELL"
                signals["confidence"] = min(0.5 + (sell_count * 0.1), 0.9)
            else:
                signals["overall_signal"] = "NEUTRAL"
                signals["confidence"] = 0.5
            
            # Adjust confidence based on trend
            trend_strength = trend.get("trend_strength", 0)
            if abs(trend_strength) > 0.5:
                if (signals["overall_signal"] == "BUY" and trend_strength > 0) or \
                   (signals["overall_signal"] == "SELL" and trend_strength < 0):
                    signals["confidence"] = min(signals["confidence"] + 0.1, 0.95)
                else:
                    signals["confidence"] = max(signals["confidence"] - 0.1, 0.3)
            
            return signals
            
        except Exception as e:
            self.logger.error(f"Failed to generate signals: {e}")
            return signals
    
    async def analyze(self, symbol: str, data: Dict[str, Any]) -> AgentResponse:
        """Analyze technical indicators for the symbol."""
        try:
            # Get market data from data connector
            market_data = self.data_connector.get_market_data(symbol)
            
            if not market_data.get("indicators"):
                return AgentResponse(
                    success=False,
                    data={},
                    message="No technical data available",
                    confidence=0.0
                )
            
            # Get historical data for analysis
            df = self.data_connector.get_latest_indicators(symbol)
            
            if df is None or df.empty:
                return AgentResponse(
                    success=False,
                    data={},
                    message="No historical data available",
                    confidence=0.0
                )
            
            # Compute indicators
            indicators = self.compute_indicators(df)
            
            if "error" in indicators:
                return AgentResponse(
                    success=False,
                    data={},
                    message=f"Failed to compute indicators: {indicators['error']}",
                    confidence=0.0
                )
            
            # Analyze support/resistance
            support_resistance = self.analyze_support_resistance(df)
            
            # Analyze trend
            trend = self.analyze_trend(df)
            
            # Generate signals
            signals = self.generate_signals(indicators, trend)
            
            # Get technical analysis context from knowledge base
            context = search_trading_knowledge(f"technical analysis {symbol} indicators")
            
            # Compile results
            result_data = {
                "symbol": symbol,
                "indicators": indicators,
                "support_resistance": support_resistance,
                "trend": trend,
                "signals": signals,
                "analysis_context": context[:500] + "..." if len(context) > 500 else context,
                "timestamp": datetime.now().isoformat()
            }
            
            # Log analysis
            self.log_analysis(symbol, f"{signals['overall_signal']} signal with {signals['confidence']:.2f} confidence")
            
            return AgentResponse(
                success=True,
                data=result_data,
                message=f"Technical analysis completed: {signals['overall_signal']} signal",
                confidence=signals["confidence"],
                metadata={
                    "symbol": symbol,
                    "timestamp": datetime.now().isoformat(),
                    "signal_count": len(signals["buy_signals"]) + len(signals["sell_signals"]),
                    "trend": trend.get("trend", "unknown")
                }
            )
            
        except Exception as e:
            self.logger.error(f"Technical analysis failed for {symbol}: {e}")
            return AgentResponse(
                success=False,
                data={},
                message=f"Technical analysis failed: {str(e)}",
                confidence=0.0
            )
