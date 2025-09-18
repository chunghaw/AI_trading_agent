#!/usr/bin/env python3
"""
Optimized Milvus search for Vercel deployment
"""
import os
import json
import sys
from typing import List, Dict, Any

class OptimizedMilvusSearch:
    def __init__(self):
        self.uri = os.getenv("MILVUS_URI")
        self.user = os.getenv("MILVUS_USER")
        self.password = os.getenv("MILVUS_PASSWORD")
        self.collection = os.getenv("MILVUS_COLLECTION_NEWS", "polygon_news_data")
        self.client = None
        
    def connect(self):
        """Connect to Milvus with optimized error handling"""
        try:
            # Try to import pymilvus (assume it's pre-installed in Vercel)
            from pymilvus import MilvusClient
            
            self.client = MilvusClient(
                uri=self.uri,
                user=self.user,
                password=self.password,
                secure=True
            )
            return True
        except ImportError:
            print("❌ pymilvus not available - skipping search")
            return False
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            return False
    
    def search_news(self, symbol: str, query: str, since_iso: str, k: int = 12) -> List[Dict[str, Any]]:
        """Search for news using Milvus"""
        if not self.client:
            if not self.connect():
                return []
        
        try:
            # Build filter expression
            filter_expr = f'ticker == "{symbol.upper()}"'
            
            # Perform query
            results = self.client.query(
                collection_name=self.collection,
                filter=filter_expr,
                output_fields=["text", "url", "published_utc", "ticker", "source", "title"],
                limit=k
            )
            
            # Format results
            formatted_results = []
            for result in results:
                formatted_results.append({
                    "title": result.get("title", result.get("source", "News")),
                    "url": result.get("url", ""),
                    "published_utc": result.get("published_utc", ""),
                    "snippet": str(result.get("text", ""))[:500],
                    "ticker": result.get("ticker", symbol),
                    "score": 0.8
                })
            
            return formatted_results
            
        except Exception as e:
            print(f"❌ Search failed: {e}")
            return []
    
    def disconnect(self):
        """Disconnect from Milvus"""
        if self.client:
            self.client.close()
            self.client = None

def main():
    """Main function for testing"""
    if len(sys.argv) < 2:
        print("Usage: python milvus_search_optimized.py <command> [args...]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "search":
        if len(sys.argv) < 5:
            print("Usage: python milvus_search_optimized.py search <symbol> <query> <since_iso> [k]")
            sys.exit(1)
        
        symbol = sys.argv[2]
        query = sys.argv[3]
        since_iso = sys.argv[4]
        k = int(sys.argv[5]) if len(sys.argv) > 5 else 12
        
        client = OptimizedMilvusSearch()
        results = client.search_news(symbol, query, since_iso, k)
        print(json.dumps(results, indent=2, default=str))
        client.disconnect()
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()
