#!/usr/bin/env python3
"""
Polygon Data Ingestion Script
Ingests market data and news from Polygon API into Milvus and Parquet files
"""

import os
import sys
import json
import logging
import requests
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import hashlib
import time

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import Milvus functions from the existing DAG
from dags.polygon_news_to_milvus import (
    connect_milvus, create_collection_if_not_exists, 
    generate_embedding, generate_id, chunk_text
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
POLYGON_API_KEY = os.getenv('POLYGON_API_KEY')
MILVUS_ADDRESS = os.getenv('MILVUS_ADDRESS', 'localhost:19530')
MILVUS_USERNAME = os.getenv('MILVUS_USERNAME', '')
MILVUS_PASSWORD = os.getenv('MILVUS_PASSWORD', '')
MILVUS_COLLECTION_NEWS = os.getenv('MILVUS_COLLECTION_NEWS', 'news_chunks')

# Data directories
OHLCV_DIR = os.getenv('OHLCV_LOCAL_DIR', '../data/ohlcv')
WATCHLIST = os.getenv('WATCHLIST', 'NVDA,MSFT,AAPL,AMD,TSLA,GOOGL').split(',')

def fetch_polygon_ohlcv(symbol: str, from_date: str, to_date: str, timeframe: str = '1d') -> List[Dict[str, Any]]:
    """Fetch OHLCV data from Polygon API"""
    url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/range/1/{timeframe}/{from_date}/{to_date}"
    
    params = {
        'apiKey': POLYGON_API_KEY,
        'adjusted': 'true',
        'sort': 'asc'
    }
    
    try:
        logger.info(f"Fetching OHLCV data for {symbol} from {from_date} to {to_date}")
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'OK':
            logger.info(f"Retrieved {len(data['results'])} OHLCV records for {symbol}")
            return data['results']
        else:
            logger.error(f"Polygon API error for {symbol}: {data}")
            return []
            
    except Exception as e:
        logger.error(f"Failed to fetch OHLCV data for {symbol}: {e}")
        return []

def fetch_polygon_news(symbol: str, from_date: str, to_date: str) -> List[Dict[str, Any]]:
    """Fetch news data from Polygon API"""
    url = f"https://api.polygon.io/v2/reference/news"
    
    params = {
        'apiKey': POLYGON_API_KEY,
        'ticker': symbol,
        'published_utc.gte': from_date,
        'published_utc.lte': to_date,
        'order': 'desc',
        'limit': 100
    }
    
    try:
        logger.info(f"Fetching news data for {symbol} from {from_date} to {to_date}")
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'OK':
            logger.info(f"Retrieved {len(data['results'])} news articles for {symbol}")
            return data['results']
        else:
            logger.error(f"Polygon API error for {symbol}: {data}")
            return []
            
    except Exception as e:
        logger.error(f"Failed to fetch news data for {symbol}: {e}")
        return []

def save_ohlcv_to_json(symbol: str, timeframe: str, data: List[Dict[str, Any]]):
    """Save OHLCV data to JSON file (easier for Next.js)"""
    if not data:
        logger.warning(f"No OHLCV data to save for {symbol}")
        return
    
    # Create directory structure
    output_dir = f"{OHLCV_DIR}/{symbol}"
    os.makedirs(output_dir, exist_ok=True)
    
    # Convert to DataFrame
    df = pd.DataFrame(data)
    
    # Rename columns to standard format
    df = df.rename(columns={
        't': 'ts',
        'o': 'open',
        'h': 'high',
        'l': 'low',
        'c': 'close',
        'v': 'volume'
    })
    
    # Convert timestamp to datetime string
    df['ts'] = pd.to_datetime(df['ts'], unit='ms').dt.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
    
    # Add symbol and timeframe columns
    df['symbol'] = symbol
    df['timeframe'] = timeframe
    
    # Select and order columns
    columns = ['ts', 'open', 'high', 'low', 'close', 'volume', 'symbol', 'timeframe']
    df = df[columns]
    
    # Save to JSON
    output_file = f"{output_dir}/{timeframe}.json"
    df.to_json(output_file, orient='records', indent=2)
    logger.info(f"Saved {len(df)} OHLCV records to {output_file}")

def ingest_news_to_milvus(symbol: str, news_data: List[Dict[str, Any]]):
    """Ingest news data into Milvus"""
    if not news_data:
        logger.warning(f"No news data to ingest for {symbol}")
        return
    
    try:
        # Connect to Milvus
        milvus = connect_milvus()
        collection = create_collection_if_not_exists()
        
        # Process each news article
        for article in news_data:
            try:
                # Extract article data
                title = article.get('title', '')
                description = article.get('description', '')
                content = f"{title}\n\n{description}"
                
                # Generate chunks
                chunks = chunk_text(content, max_tokens=800, overlap_tokens=120)
                
                for chunk in chunks:
                    # Generate embedding
                    embedding = generate_embedding(chunk)
                    
                    # Generate unique ID
                    article_id = generate_id(
                        url=article.get('article_url', ''),
                        title=title,
                        published_utc=article.get('published_utc', ''),
                        ticker=symbol
                    )
                    
                    # Prepare data for insertion
                    data = {
                        'id': article_id,
                        'text': chunk,
                        'url': article.get('article_url', ''),
                        'published_utc': article.get('published_utc', ''),
                        'ticker': symbol,
                        'source': article.get('publisher', {}).get('name', 'Polygon'),
                        'embedding': embedding
                    }
                    
                    # Insert into Milvus
                    collection.insert([data])
                
                logger.info(f"Processed news article: {title[:50]}...")
                
            except Exception as e:
                logger.error(f"Failed to process news article: {e}")
                continue
        
        # Flush collection
        collection.flush()
        logger.info(f"Successfully ingested news data for {symbol}")
        
    except Exception as e:
        logger.error(f"Failed to ingest news data for {symbol}: {e}")

def ingest_symbol_data(symbol: str, days_back: int = 30):
    """Ingest both OHLCV and news data for a symbol"""
    logger.info(f"Starting data ingestion for {symbol}")
    
    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days_back)
    
    from_date = start_date.strftime('%Y-%m-%d')
    to_date = end_date.strftime('%Y-%m-%d')
    
    # Fetch OHLCV data
    ohlcv_data = fetch_polygon_ohlcv(symbol, from_date, to_date, '1d')
    if ohlcv_data:
        save_ohlcv_to_json(symbol, '1d', ohlcv_data)
    
    # Fetch news data
    news_data = fetch_polygon_news(symbol, from_date, to_date)
    if news_data:
        ingest_news_to_milvus(symbol, news_data)
    
    logger.info(f"Completed data ingestion for {symbol}")

def main():
    """Main ingestion function"""
    if not POLYGON_API_KEY:
        logger.error("POLYGON_API_KEY environment variable is required")
        sys.exit(1)
    
    logger.info("Starting Polygon data ingestion...")
    logger.info(f"Watchlist: {WATCHLIST}")
    logger.info(f"OHLCV directory: {OHLCV_DIR}")
    logger.info(f"Milvus collection: {MILVUS_COLLECTION_NEWS}")
    
    # Create OHLCV directory
    os.makedirs(OHLCV_DIR, exist_ok=True)
    
    # Process each symbol
    for symbol in WATCHLIST:
        symbol = symbol.strip()
        if not symbol:
            continue
            
        try:
            ingest_symbol_data(symbol, days_back=30)
            # Add delay to avoid rate limiting
            time.sleep(1)
        except Exception as e:
            logger.error(f"Failed to ingest data for {symbol}: {e}")
            continue
    
    logger.info("Data ingestion completed!")

if __name__ == "__main__":
    main()
