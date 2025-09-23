#!/usr/bin/env python3
"""
Milvus Python SDK search - can query data unlike REST API
"""
import os
import sys
import json
from pymilvus import MilvusClient

# Milvus configuration
MILVUS_URI = os.getenv('MILVUS_URI', 'https://in03-85d251bbc78827a.serverless.aws-eu-central-1.cloud.zilliz.com')
MILVUS_USER = os.getenv('MILVUS_USER', 'db_85d251bbc78827a')
MILVUS_PASSWORD = os.getenv('MILVUS_PASSWORD', 'Sq4-)tA,N]RwXsSm')
COLLECTION_NAME = os.getenv('MILVUS_COLLECTION_NEWS', 'polygon_news_data')

def search_news_by_ticker(ticker_symbol, limit=20):
    """Search news by ticker symbol using Milvus Python SDK"""
    try:
        # Connect to Milvus
        client = MilvusClient(
            uri=MILVUS_URI,
            token=f"{MILVUS_USER}:{MILVUS_PASSWORD}"
        )
        
        print(f"🔍 Searching news for ticker: {ticker_symbol}")
        
        # Query by ticker symbol
        results = client.query(
            collection_name=COLLECTION_NAME,
            filter=f'ticker == "{ticker_symbol}"',
            limit=limit,
            output_fields=["*"]
        )
        
        print(f"✅ Found {len(results)} news articles for {ticker_symbol}")
        
        # Transform results
        transformed_results = []
        for i, article in enumerate(results):
            transformed_results.append({
                "id": article.get("id", f"news_{i}"),
                "title": article.get("title", ""),
                "text": article.get("text", ""),
                "url": article.get("url", ""),
                "source": article.get("source", ""),
                "ticker": article.get("ticker", ticker_symbol),
                "published_utc": article.get("published_utc", ""),
                "sentiment": article.get("sentiment", "neutral"),
                "keywords": article.get("keywords", ""),
                "score": 0.8 - (i * 0.05),
                "relevance": 0.8 - (i * 0.05)
            })
        
        return transformed_results
        
    except Exception as e:
        print(f"❌ Error searching news: {e}")
        return []

def main():
    """Test the search function"""
    if len(sys.argv) > 1:
        ticker = sys.argv[1]
    else:
        ticker = "NVDA"
    
    results = search_news_by_ticker(ticker)
    print(f"\n📊 Results for {ticker}:")
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
