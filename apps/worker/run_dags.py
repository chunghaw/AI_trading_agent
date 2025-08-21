#!/usr/bin/env python3
"""
Local DAG runner for testing and development.
This script allows you to run the Airflow DAGs locally without setting up a full Airflow instance.
"""

import os
import sys
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any

# Add the current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

def run_ohlcv_pipeline():
    """Run the OHLCV indicators pipeline locally."""
    print("🔄 Running OHLCV Indicators Pipeline...")
    
    try:
        # Import the DAG functions
        from dags.ohlcv_indicators_pipeline_dag import config_window, fetch_and_compute
        
        # Set up environment variables for testing
        os.environ.setdefault("POLYGON_API_KEY", "test_key")
        os.environ.setdefault("EQUITY_TICKERS", '["AAPL","GOOGL"]')
        os.environ.setdefault("CRYPTO_SYMBOLS", '["BTCUSDT"]')
        os.environ.setdefault("OHLCV_TIMEFRAME", "1h")
        os.environ.setdefault("OHLCV_LOOKBACK_DAYS", "7")
        os.environ.setdefault("DATA_DIR", "./data/indicators")
        
        # Create data directory
        data_dir = Path("./data/indicators")
        data_dir.mkdir(parents=True, exist_ok=True)
        
        # Run the pipeline
        cfg = config_window()
        print(f"📊 Configuration: {cfg}")
        
        outputs = fetch_and_compute(cfg)
        print(f"✅ OHLCV Pipeline completed: {outputs}")
        
        return outputs
        
    except Exception as e:
        print(f"❌ OHLCV Pipeline failed: {e}")
        return None


def run_news_pipeline():
    """Run the news to Milvus pipeline locally."""
    print("🔄 Running News to Milvus Pipeline...")
    
    try:
        # Import the DAG functions
        from dags.polygon_news_to_milvus_dag import prepare_run_window, fetch_news, chunk_and_embed, refresh_index
        
        # Set up environment variables for testing
        os.environ.setdefault("POLYGON_API_KEY", "test_key")
        os.environ.setdefault("OPENAI_API_KEY", "test_key")
        os.environ.setdefault("MILVUS_HOST", "localhost")
        os.environ.setdefault("MILVUS_PORT", "19530")
        os.environ.setdefault("NEWS_TICKERS", '["AAPL","GOOGL"]')
        os.environ.setdefault("NEWS_LOOKBACK_DAYS", "1")
        
        # Run the pipeline
        window = prepare_run_window()
        print(f"📰 Window: {window}")
        
        fetched = fetch_news(window)
        print(f"📰 Fetched news: {len(fetched)} tickers")
        
        cnt = chunk_and_embed(fetched)
        print(f"📝 Embedded {cnt} chunks")
        
        status = refresh_index(cnt)
        print(f"✅ News Pipeline completed: {status}")
        
        return cnt
        
    except Exception as e:
        print(f"❌ News Pipeline failed: {e}")
        return None


def test_data_connector():
    """Test the data connector with the generated data."""
    print("🔄 Testing Data Connector...")
    
    try:
        from worker.data_connector import DataConnector
        
        # Initialize data connector
        config = {
            "indicators_dir": "./data/indicators",
            "news_collection": "news_chunks"
        }
        connector = DataConnector(config)
        
        # Test getting market data
        symbols = ["AAPL", "GOOGL"]
        for symbol in symbols:
            market_data = connector.get_market_data(symbol)
            print(f"📊 Market data for {symbol}: {market_data.get('indicators', 'No data')}")
            
            # Test data quality
            quality = connector.validate_data_quality(symbol)
            print(f"🔍 Data quality for {symbol}: {quality}")
        
        return True
        
    except Exception as e:
        print(f"❌ Data Connector test failed: {e}")
        return False


def test_vector_service():
    """Test the vector service."""
    print("🔄 Testing Vector Service...")
    
    try:
        from worker.vector_service import get_collection_stats, search_trading_knowledge
        
        # Get collection stats
        stats = get_collection_stats()
        print(f"📊 Vector DB Stats: {stats}")
        
        # Test search
        result = search_trading_knowledge("trading sentiment analysis")
        print(f"🔍 Search result: {result[:100]}...")
        
        return True
        
    except Exception as e:
        print(f"❌ Vector Service test failed: {e}")
        return False


def main():
    """Main function to run all tests."""
    print("🚀 Starting Local DAG Runner...")
    print("=" * 50)
    
    # Run OHLCV pipeline
    ohlcv_result = run_ohlcv_pipeline()
    print()
    
    # Run news pipeline
    news_result = run_news_pipeline()
    print()
    
    # Test data connector
    connector_result = test_data_connector()
    print()
    
    # Test vector service
    vector_result = test_vector_service()
    print()
    
    # Summary
    print("=" * 50)
    print("📋 Test Summary:")
    print(f"  OHLCV Pipeline: {'✅' if ohlcv_result else '❌'}")
    print(f"  News Pipeline: {'✅' if news_result else '❌'}")
    print(f"  Data Connector: {'✅' if connector_result else '❌'}")
    print(f"  Vector Service: {'✅' if vector_result else '❌'}")
    
    if all([ohlcv_result, news_result, connector_result, vector_result]):
        print("\n🎉 All tests passed! The system is ready.")
    else:
        print("\n⚠️ Some tests failed. Check the output above for details.")


if __name__ == "__main__":
    main()
