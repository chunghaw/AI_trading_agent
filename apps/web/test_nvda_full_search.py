#!/usr/bin/env python3
"""
Test full NVDA search to see all available data
"""
import os
import json
import sys
import time

# Set environment variables for testing
os.environ["MILVUS_URI"] = "https://in03-85d251bbc78827a.serverless.aws-eu-central-1.cloud.zilliz.com"
os.environ["MILVUS_USER"] = "db_85d251bbc78827a"
os.environ["MILVUS_PASSWORD"] = "Sq4-)tA,N]RwXsSm"
os.environ["MILVUS_COLLECTION_NEWS"] = "polygon_news_data"

def test_full_nvda_search():
    print("🧪 Testing FULL NVDA search...")
    
    start_time = time.time()
    
    try:
        # Import pymilvus
        import_start = time.time()
        from pymilvus import MilvusClient
        print(f"✅ pymilvus import: {time.time() - import_start:.2f}s")
        
        # Create client
        client_start = time.time()
        client = MilvusClient(
            uri=os.environ["MILVUS_URI"],
            user=os.environ["MILVUS_USER"],
            password=os.environ["MILVUS_PASSWORD"],
            secure=True
        )
        print(f"✅ Client creation: {time.time() - client_start:.2f}s")
        
        # Test connection
        conn_start = time.time()
        collections = client.list_collections()
        print(f"✅ List collections: {time.time() - conn_start:.2f}s")
        print(f"📁 Collections: {collections}")
        
        # Get collection info
        collection_info = client.describe_collection("polygon_news_data")
        print(f"📊 Collection schema: {collection_info}")
        
        # Search for ALL NVDA news (no limit)
        search_start = time.time()
        print("🔍 Searching for ALL NVDA news...")
        results = client.query(
            collection_name="polygon_news_data",
            filter='ticker == "NVDA"',
            output_fields=["text", "url", "published_utc", "ticker", "source", "title"],
            limit=16384  # Max limit
        )
        print(f"✅ Search execution: {time.time() - search_start:.2f}s")
        print(f"📊 Found {len(results)} total NVDA results")
        
        # Group by date
        from collections import defaultdict
        by_date = defaultdict(list)
        for result in results:
            date = result.get('published_utc', 'Unknown')[:10]  # YYYY-MM-DD
            by_date[date].append(result)
        
        print(f"\n📅 NVDA news by date:")
        for date in sorted(by_date.keys(), reverse=True)[:10]:  # Last 10 days
            print(f"  {date}: {len(by_date[date])} articles")
        
        # Show sample results
        print(f"\n📰 Sample NVDA articles (first 5):")
        for i, result in enumerate(results[:5]):
            print(f"\n  Article {i+1}:")
            print(f"    Title: {result.get('title', 'N/A')}")
            print(f"    Source: {result.get('source', 'N/A')}")
            print(f"    Published: {result.get('published_utc', 'N/A')}")
            print(f"    URL: {result.get('url', 'N/A')}")
            print(f"    Text: {str(result.get('text', ''))[:100]}...")
        
        # Test with different limits
        print(f"\n🔍 Testing different search limits:")
        for limit in [1, 5, 10, 20, 50]:
            test_start = time.time()
            test_results = client.query(
                collection_name="polygon_news_data",
                filter='ticker == "NVDA"',
                output_fields=["title", "published_utc"],
                limit=limit
            )
            test_time = time.time() - test_start
            print(f"  Limit {limit:2d}: {len(test_results)} results in {test_time:.3f}s")
        
        client.close()
        
        total_time = time.time() - start_time
        print(f"\n✅ Total execution time: {total_time:.2f}s")
        
        return results
        
    except Exception as e:
        total_time = time.time() - start_time
        print(f"❌ Search failed after {total_time:.2f}s: {e}")
        import traceback
        traceback.print_exc()
        return []

if __name__ == "__main__":
    results = test_full_nvda_search()
    print(f"\n🎯 Final result count: {len(results)}")
