#!/usr/bin/env python3
"""
Test NVDA search with hardcoded values
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

def test_nvda_search():
    print("🧪 Testing NVDA search...")
    
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
        
        # Search for NVDA news
        search_start = time.time()
        results = client.query(
            collection_name="polygon_news_data",
            filter='ticker == "NVDA"',
            output_fields=["text", "url", "published_utc", "ticker", "source", "title"],
            limit=5
        )
        print(f"✅ Search execution: {time.time() - search_start:.2f}s")
        print(f"📊 Found {len(results)} results")
        
        # Format and display results
        for i, result in enumerate(results):
            print(f"\n📰 Result {i+1}:")
            print(f"  Title: {result.get('title', 'N/A')}")
            print(f"  Source: {result.get('source', 'N/A')}")
            print(f"  Published: {result.get('published_utc', 'N/A')}")
            print(f"  URL: {result.get('url', 'N/A')}")
            print(f"  Text: {str(result.get('text', ''))[:200]}...")
        
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
    results = test_nvda_search()
    print(f"\n🎯 Final result count: {len(results)}")
