#!/usr/bin/env python3
"""
Test vector search for better news retrieval
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

def test_vector_search():
    print("🧪 Testing Vector Search for NVDA...")
    
    start_time = time.time()
    
    try:
        from pymilvus import MilvusClient
        import openai
        
        # Create Milvus client
        client = MilvusClient(
            uri=os.environ["MILVUS_URI"],
            user=os.environ["MILVUS_USER"],
            password=os.environ["MILVUS_PASSWORD"],
            secure=True
        )
        
        # Create OpenAI client
        openai_client = openai.OpenAI(api_key="sk-proj-4lZJ8KdP4WqZ7H3vR2mN6xT9cF1aB5eY8uI0oP3sL6wA9dC2fG5hJ8kM1nQ4rS7tU0vX3yZ6")
        
        print("✅ Clients created")
        
        # Generate embedding for the query
        query = "What's the technical outlook for NVDA?"
        print(f"🔍 Query: {query}")
        
        embedding_start = time.time()
        response = openai_client.embeddings.create(
            input=query,
            model="text-embedding-3-small"
        )
        query_embedding = response.data[0].embedding
        print(f"✅ Embedding generated in {time.time() - embedding_start:.2f}s")
        
        # Perform vector search
        search_start = time.time()
        search_params = {
            "metric_type": "COSINE",
            "params": {"nprobe": 10}
        }
        
        results = client.search(
            collection_name="polygon_news_data",
            data=[query_embedding],
            anns_field="embedding",
            param=search_params,
            limit=20,
            output_fields=["text", "url", "published_utc", "ticker", "source", "title"],
            expr='ticker == "NVDA"'  # Filter by ticker
        )
        
        print(f"✅ Vector search completed in {time.time() - search_start:.2f}s")
        
        # Process results
        hits = results[0]  # Get hits for the first query
        print(f"📊 Found {len(hits)} vector search results")
        
        # Show top results with scores
        print(f"\n📰 Top NVDA articles by relevance:")
        for i, hit in enumerate(hits[:10]):
            print(f"\n  Result {i+1} (Score: {hit.score:.4f}):")
            entity = hit.entity
            print(f"    Title: {entity.get('title', 'N/A')}")
            print(f"    Source: {entity.get('source', 'N/A')}")
            print(f"    Published: {entity.get('published_utc', 'N/A')}")
            print(f"    URL: {entity.get('url', 'N/A')}")
            print(f"    Text: {str(entity.get('text', ''))[:200]}...")
        
        # Compare with regular query
        print(f"\n🔍 Comparing with regular query (limit 20):")
        regular_results = client.query(
            collection_name="polygon_news_data",
            filter='ticker == "NVDA"',
            output_fields=["title", "published_utc", "source"],
            limit=20
        )
        print(f"📊 Regular query found {len(regular_results)} results")
        
        client.close()
        
        total_time = time.time() - start_time
        print(f"\n✅ Total execution time: {total_time:.2f}s")
        
        return hits
        
    except Exception as e:
        total_time = time.time() - start_time
        print(f"❌ Vector search failed after {total_time:.2f}s: {e}")
        import traceback
        traceback.print_exc()
        return []

if __name__ == "__main__":
    results = test_vector_search()
    print(f"\n🎯 Final vector search result count: {len(results)}")
