#!/usr/bin/env python3
"""
Python-based Milvus search functionality
"""
import os
import json
import sys
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class MilvusSearchClient:
    def __init__(self):
        self.uri = os.getenv("MILVUS_URI")
        self.user = os.getenv("MILVUS_USER")
        self.password = os.getenv("MILVUS_PASSWORD")
        self.collection = os.getenv("MILVUS_COLLECTION_NEWS", "polygon_news_data")
        self.client = None
        
    def connect(self):
        """Connect to Milvus"""
        try:
            from pymilvus import MilvusClient
            self.client = MilvusClient(
                uri=self.uri,
                user=self.user,
                password=self.password,
                secure=True
            )
            return True
        except Exception as e:
            print(f"❌ Failed to connect to Milvus: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from Milvus"""
        if self.client:
            self.client.close()
            self.client = None
    
    def search_news(self, symbol: str, query: str, since_iso: str, k: int = 12) -> List[Dict[str, Any]]:
        """Search for news using Milvus"""
        if not self.client:
            if not self.connect():
                return []
        
        try:
            # Build filter expression
            filter_expr = f'ticker == "{symbol.upper()}" && published_utc >= "{since_iso}"'
            
            # Get embedding for the query (this would need to be implemented)
            # For now, we'll use a simple text search
            search_params = {
                "collection_name": self.collection,
                "expr": filter_expr,
                "output_fields": ["text", "url", "published_utc", "ticker", "source", "title"],
                "limit": k
            }
            
            # Perform search
            results = self.client.query(**search_params)
            
            # Format results
            formatted_results = []
            for result in results:
                formatted_results.append({
                    "title": result.get("source", "News"),
                    "url": result.get("url", ""),
                    "published_utc": result.get("published_utc", ""),
                    "snippet": str(result.get("text", ""))[:500],
                    "ticker": result.get("ticker", symbol),
                    "score": 0.8  # Default score for non-vector search
                })
            
            return formatted_results
            
        except Exception as e:
            print(f"❌ Search failed: {e}")
            return []
    
    def test_connection(self) -> Dict[str, Any]:
        """Test Milvus connection and return status"""
        try:
            if not self.connect():
                return {
                    "success": False,
                    "error": "Failed to connect to Milvus",
                    "collections": [],
                    "has_target_collection": False
                }
            
            # List collections
            collections = self.client.list_collections()
            has_target = self.collection in collections
            
            # Get collection info if it exists
            collection_info = None
            if has_target:
                try:
                    collection_info = self.client.describe_collection(self.collection)
                except Exception as e:
                    print(f"Warning: Could not describe collection: {e}")
            
            return {
                "success": True,
                "collections": collections,
                "target_collection": self.collection,
                "has_target_collection": has_target,
                "collection_info": collection_info
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "collections": [],
                "has_target_collection": False
            }
        finally:
            self.disconnect()

def main():
    """Main function for testing"""
    if len(sys.argv) < 2:
        print("Usage: python milvus_search.py <command> [args...]")
        print("Commands:")
        print("  test - Test connection")
        print("  search <symbol> <query> <since_iso> [k] - Search news")
        sys.exit(1)
    
    client = MilvusSearchClient()
    command = sys.argv[1]
    
    if command == "test":
        result = client.test_connection()
        print(json.dumps(result, indent=2, default=str))
        sys.exit(0 if result["success"] else 1)
    
    elif command == "search":
        if len(sys.argv) < 5:
            print("Usage: python milvus_search.py search <symbol> <query> <since_iso> [k]")
            sys.exit(1)
        
        symbol = sys.argv[2]
        query = sys.argv[3]
        since_iso = sys.argv[4]
        k = int(sys.argv[5]) if len(sys.argv) > 5 else 12
        
        results = client.search_news(symbol, query, since_iso, k)
        print(json.dumps(results, indent=2, default=str))
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()
