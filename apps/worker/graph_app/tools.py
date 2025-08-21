"""Tools for LangGraph trading agent."""

import os
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import structlog
from worker.agents.vector_service import search_milvus

logger = structlog.get_logger()


def get_bars(symbol: str, timeframe: str) -> pd.DataFrame:
    """
    Get OHLCV data for a symbol.
    
    Args:
        symbol: Trading symbol (e.g., 'AAPL')
        timeframe: Timeframe (e.g., '1h', '1d')
    
    Returns:
        DataFrame with OHLCV data
    """
    try:
        # Try to read from Parquet first
        data_dir = os.getenv("DATA_DIR", "./data")
        parquet_path = f"{data_dir}/{symbol}_{timeframe}.parquet"
        
        if os.path.exists(parquet_path):
            logger.info("Loading data from Parquet", symbol=symbol, timeframe=timeframe, path=parquet_path)
            df = pd.read_parquet(parquet_path)
            return df
        
        # Fallback to live fetch if API keys available
        polygon_key = os.getenv("POLYGON_API_KEY")
        if polygon_key:
            logger.info("Fetching live data from Polygon", symbol=symbol, timeframe=timeframe)
            return _fetch_polygon_data(symbol, timeframe, polygon_key)
        
        # Mock data for testing
        logger.warning("No data source available, using mock data", symbol=symbol)
        return _generate_mock_data(symbol, timeframe)
        
    except Exception as e:
        logger.error("Failed to get bars", symbol=symbol, timeframe=timeframe, error=str(e))
        raise


def _fetch_polygon_data(symbol: str, timeframe: str, api_key: str) -> pd.DataFrame:
    """Fetch data from Polygon API."""
    import requests
    
    # Convert timeframe to Polygon format
    timespan_map = {
        "1m": "minute",
        "5m": "minute",
        "15m": "minute", 
        "30m": "minute",
        "1h": "hour",
        "1d": "day"
    }
    
    timespan = timespan_map.get(timeframe, "day")
    multiplier = 1 if timeframe in ["1m", "1h", "1d"] else int(timeframe[:-1])
    
    url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/range/{multiplier}/{timespan}/2024-01-01/2024-12-31"
    
    response = requests.get(url, params={"apiKey": api_key})
    response.raise_for_status()
    
    data = response.json()["results"]
    df = pd.DataFrame(data)
    df.columns = ['o', 'h', 'l', 'c', 'v', 'vw', 'n', 't']
    df['t'] = pd.to_datetime(df['t'], unit='ms')
    df.set_index('t', inplace=True)
    
    return df


def _generate_mock_data(symbol: str, timeframe: str) -> pd.DataFrame:
    """Generate mock OHLCV data for testing."""
    import numpy as np
    
    # Generate 100 bars of mock data
    dates = pd.date_range(start='2024-01-01', periods=100, freq='D')
    
    # Generate realistic price movements
    base_price = 100.0
    returns = np.random.normal(0, 0.02, 100)  # 2% daily volatility
    prices = [base_price]
    
    for ret in returns[1:]:
        prices.append(prices[-1] * (1 + ret))
    
    # Generate OHLCV
    data = []
    for i, (date, close) in enumerate(zip(dates, prices)):
        high = close * (1 + abs(np.random.normal(0, 0.01)))
        low = close * (1 - abs(np.random.normal(0, 0.01)))
        open_price = prices[i-1] if i > 0 else close
        volume = np.random.randint(1000000, 10000000)
        
        data.append({
            'o': open_price,
            'h': high,
            'l': low,
            'c': close,
            'v': volume,
            't': date
        })
    
    df = pd.DataFrame(data)
    df.set_index('t', inplace=True)
    return df


def news_search(ticker: str, since_days: int = 7) -> List[Dict[str, Any]]:
    """
    Search news using existing vector service.
    
    Args:
        ticker: Stock ticker symbol
        since_days: Days to look back
    
    Returns:
        List of news documents with metadata
    """
    try:
        # Use existing vector service
        query = f"news about {ticker} stock"
        result = search_milvus(query, top_k=5)
        
        if result and result != "No knowledge base available.":
            # Convert to our format
            news_items = [
                {
                    "text": result,
                    "url": "milvus://trading_agents_knowledge_base",
                    "published_utc": datetime.utcnow().isoformat(),
                    "score": 0.8
                }
            ]
            
            logger.info("Retrieved news", ticker=ticker, count=len(news_items))
            return news_items
        else:
            # Return mock news for testing
            return [
                {
                    "text": f"Positive news about {ticker} earnings",
                    "url": "https://example.com/news1",
                    "published_utc": datetime.utcnow().isoformat(),
                    "score": 0.8
                },
                {
                    "text": f"Analyst upgrades {ticker} price target",
                    "url": "https://example.com/news2", 
                    "published_utc": datetime.utcnow().isoformat(),
                    "score": 0.7
                }
            ]
        
    except Exception as e:
        logger.error("Failed to search news", ticker=ticker, error=str(e))
        # Return mock news for testing
        return [
            {
                "text": f"Positive news about {ticker} earnings",
                "url": "https://example.com/news1",
                "published_utc": datetime.utcnow().isoformat(),
                "score": 0.8
            },
            {
                "text": f"Analyst upgrades {ticker} price target",
                "url": "https://example.com/news2", 
                "published_utc": datetime.utcnow().isoformat(),
                "score": 0.7
            }
        ]


def paper_execute(decision: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute paper trade order.
    
    Args:
        decision: Trading decision dictionary
    
    Returns:
        Execution result
    """
    try:
        # Simulate order execution
        import uuid
        import random
        
        order_id = str(uuid.uuid4())
        current_price = 100.0  # Mock current price
        
        # Simulate fill price with some slippage
        if decision["entry"]["type"] == "market":
            slippage = random.uniform(-0.01, 0.01)  # ±1% slippage
            filled_price = current_price * (1 + slippage)
        else:
            filled_price = decision["entry"]["price"]
        
        execution_result = {
            "order_id": order_id,
            "filled_px": filled_price,
            "ts": datetime.utcnow().isoformat(),
            "symbol": decision["symbol"],
            "action": decision["action"],
            "size_pct": decision["size_pct"],
            "status": "FILLED"
        }
        
        logger.info("Paper trade executed", **execution_result)
        return execution_result
        
    except Exception as e:
        logger.error("Failed to execute paper trade", error=str(e))
        raise


def risk_limits() -> Dict[str, Any]:
    """
    Get risk management configuration from environment.
    
    Returns:
        Risk limits configuration
    """
    return {
        "max_exposure_pct": float(os.getenv("MAX_EXPOSURE_PCT", "0.25")),
        "max_daily_loss_pct": float(os.getenv("MAX_DAILY_LOSS_PCT", "0.05")),
        "embargo_minutes_after_news": int(os.getenv("EMBARGO_MINUTES_AFTER_NEWS", "30")),
        "max_position_size_pct": float(os.getenv("MAX_POSITION_SIZE_PCT", "0.1")),
        "min_confidence": float(os.getenv("MIN_CONFIDENCE", "0.7"))
    }


def compute_indicators(df: pd.DataFrame) -> Dict[str, float]:
    """
    Compute technical indicators using pandas-ta.
    
    Args:
        df: OHLCV DataFrame
    
    Returns:
        Dictionary of indicator values
    """
    try:
        import pandas_ta as ta
        
        if df.empty:
            return {}
        
        # Ensure required columns exist
        required_cols = ['o', 'h', 'l', 'c', 'v']
        if not all(col in df.columns for col in required_cols):
            return {}
        
        # Compute indicators
        indicators = {}
        
        # RSI
        rsi = ta.rsi(df['c'], length=14)
        indicators['rsi'] = float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50.0
        
        # MACD
        macd = ta.macd(df['c'])
        indicators['macd'] = float(macd['MACD_12_26_9'].iloc[-1]) if not pd.isna(macd['MACD_12_26_9'].iloc[-1]) else 0.0
        indicators['macd_signal'] = float(macd['MACDs_12_26_9'].iloc[-1]) if not pd.isna(macd['MACDs_12_26_9'].iloc[-1]) else 0.0
        
        # Bollinger Bands
        bb = ta.bbands(df['c'], length=20)
        indicators['bb_upper'] = float(bb['BBU_20_2.0'].iloc[-1]) if not pd.isna(bb['BBU_20_2.0'].iloc[-1]) else 0.0
        indicators['bb_lower'] = float(bb['BBL_20_2.0'].iloc[-1]) if not pd.isna(bb['BBL_20_2.0'].iloc[-1]) else 0.0
        
        # Moving averages
        sma_20 = ta.sma(df['c'], length=20)
        sma_50 = ta.sma(df['c'], length=50)
        indicators['sma_20'] = float(sma_20.iloc[-1]) if not pd.isna(sma_20.iloc[-1]) else 0.0
        indicators['sma_50'] = float(sma_50.iloc[-1]) if not pd.isna(sma_50.iloc[-1]) else 0.0
        
        # Current price
        indicators['current_price'] = float(df['c'].iloc[-1])
        
        return indicators
        
    except Exception as e:
        logger.error("Failed to compute indicators", error=str(e))
        return {}
