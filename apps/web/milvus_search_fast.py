#!/usr/bin/env python3
"""
Fast Milvus search without external dependencies - optimized for Vercel
"""
import os
import json
import sys
import time
from typing import List, Dict, Any

class FastMilvusSearch:
    def __init__(self):
        self.uri = os.getenv("MILVUS_URI")
        self.user = os.getenv("MILVUS_USER")
        self.password = os.getenv("MILVUS_PASSWORD")
        self.collection = os.getenv("MILVUS_COLLECTION_NEWS", "polygon_news_data")
        self.client = None
        
    def connect(self):
        """Connect to Milvus with timeout handling"""
        try:
            from pymilvus import MilvusClient
            
            self.client = MilvusClient(
                uri=self.uri,
                user=self.user,
                password=self.password,
                secure=True
            )
            return True
        except ImportError:
            print("❌ pymilvus not available")
            return False
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            return False
    
    def search_news(self, symbol: str, query: str, since_iso: str, k: int = 20) -> List[Dict[str, Any]]:
        """Search for news using Milvus with smart date handling"""
        if not self.client:
            if not self.connect():
                return []
        
        try:
            # Strategy 1: Try the requested date range first
            recent_results = self.client.query(
                collection_name=self.collection,
                filter=f'ticker == "{symbol.upper()}" && published_utc >= "{since_iso}"',
                output_fields=["text", "url", "published_utc", "ticker", "source", "title", "sentiment"],
                limit=k * 2  # Get more to ensure we have enough
            )
            
            # Strategy 2: If not enough results, try last 90 days (more generous)
            if len(recent_results) < k:
                from datetime import datetime, timedelta
                ninety_days_ago = (datetime.now() - timedelta(days=90)).isoformat()
                
                older_results = self.client.query(
                    collection_name=self.collection,
                    filter=f'ticker == "{symbol.upper()}" && published_utc >= "{ninety_days_ago}"',
                    output_fields=["text", "url", "published_utc", "ticker", "source", "title", "sentiment"],
                    limit=k * 3
                )
                
                # Strategy 3: If still not enough, get all available articles for this ticker
                if len(older_results) < k:
                    all_results = self.client.query(
                        collection_name=self.collection,
                        filter=f'ticker == "{symbol.upper()}"',
                        output_fields=["text", "url", "published_utc", "ticker", "source", "title", "sentiment"],
                        limit=k * 5
                    )
                    older_results = all_results
                
                # Combine and deduplicate
                seen_urls = set()
                combined_results = []
                
                # Add recent results first
                for result in recent_results:
                    if result.get('url') not in seen_urls:
                        combined_results.append(result)
                        seen_urls.add(result.get('url'))
                
                # Add older results if needed
                for result in older_results:
                    if len(combined_results) >= k:
                        break
                    if result.get('url') not in seen_urls:
                        combined_results.append(result)
                        seen_urls.add(result.get('url'))
                
                recent_results = combined_results
            
            # Format results with better scoring
            formatted_results = []
            for result in recent_results:
                # Calculate relevance score based on recency and sentiment
                published = result.get('published_utc', '')
                sentiment = result.get('sentiment', 'neutral')
                
                # Recency score (newer = higher)
                try:
                    from datetime import datetime
                    pub_date = datetime.fromisoformat(published.replace('Z', '+00:00'))
                    days_old = (datetime.now().replace(tzinfo=pub_date.tzinfo) - pub_date).days
                    recency_score = max(0, 1 - (days_old / 30))  # Decay over 30 days
                except:
                    recency_score = 0.5
                
                # Sentiment score
                sentiment_score = {
                    'positive': 1.2,
                    'negative': 0.8,
                    'neutral': 1.0
                }.get(sentiment.lower(), 1.0)
                
                final_score = recency_score * sentiment_score
                
                formatted_results.append({
                    "title": result.get("title", result.get("source", "News")),
                    "url": result.get("url", ""),
                    "published_utc": result.get("published_utc", ""),
                    "snippet": str(result.get("text", ""))[:500],
                    "ticker": result.get("ticker", symbol),
                    "score": final_score,
                    "sentiment": sentiment
                })
            
            # Sort by score and return top k
            formatted_results.sort(key=lambda x: x['score'], reverse=True)
            return formatted_results[:k]
            
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
        print("Usage: python milvus_search_fast.py <command> [args...]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "search":
        if len(sys.argv) < 5:
            print("Usage: python milvus_search_fast.py search <symbol> <query> <since_iso> [k]")
            sys.exit(1)
        
        symbol = sys.argv[2]
        query = sys.argv[3]
        since_iso = sys.argv[4]
        k = int(sys.argv[5]) if len(sys.argv) > 5 else 20
        
        client = FastMilvusSearch()
        results = client.search_news(symbol, query, since_iso, k)
        print(json.dumps(results, indent=2, default=str))
        client.disconnect()
    
    elif command == "test":
        # Test with hardcoded values
        os.environ["MILVUS_URI"] = "https://in03-85d251bbc78827a.serverless.aws-eu-central-1.cloud.zilliz.com"
        os.environ["MILVUS_USER"] = "db_85d251bbc78827a"
        os.environ["MILVUS_PASSWORD"] = "Sq4-)tA,N]RwXsSm"
        
        print("🧪 Testing fast search...")
        client = FastMilvusSearch()
        results = client.search_news("NVDA", "technical outlook", "2024-01-01T00:00:00Z", 10)
        print(f"📊 Found {len(results)} results")
        for i, result in enumerate(results[:3]):
            print(f"\nResult {i+1}:")
            print(f"  Title: {result['title']}")
            print(f"  Score: {result['score']:.3f}")
            print(f"  Sentiment: {result['sentiment']}")
        client.disconnect()
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()
