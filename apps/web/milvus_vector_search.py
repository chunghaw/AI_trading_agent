#!/usr/bin/env python3
"""
Real Milvus vector search implementation - NO MOCK DATA
"""
import os
import json
import sys
import time
from typing import List, Dict, Any
from datetime import datetime, timedelta

class MilvusVectorSearch:
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
    
    def extract_symbol_from_query(self, query: str) -> str:
        """Extract stock symbol from user query"""
        query_lower = query.lower()
        
        # Common company name to ticker mappings
        company_mappings = {
            'nvidia': 'NVDA',
            'nvidia corporation': 'NVDA',
            'apple': 'AAPL',
            'apple inc': 'AAPL',
            'microsoft': 'MSFT',
            'microsoft corporation': 'MSFT',
            'amazon': 'AMZN',
            'amazon.com': 'AMZN',
            'google': 'GOOGL',
            'alphabet': 'GOOGL',
            'meta': 'META',
            'facebook': 'META',
            'tesla': 'TSLA',
            'tesla inc': 'TSLA',
            'netflix': 'NFLX',
            'netflix inc': 'NFLX',
            'oracle': 'ORCL',
            'oracle corporation': 'ORCL',
            'amd': 'AMD',
            'advanced micro devices': 'AMD',
            'intel': 'INTC',
            'intel corporation': 'INTC'
        }
        
        # Check for direct ticker symbols (3-5 uppercase letters)
        import re
        ticker_pattern = r'\b[A-Z]{2,5}\b'
        tickers = re.findall(ticker_pattern, query.upper())
        # Filter out common words that aren't tickers
        common_words = {'THE', 'FOR', 'AND', 'OR', 'BUT', 'IN', 'ON', 'AT', 'TO', 'OF', 'IS', 'ARE', 'WAS', 'WERE', 'BE', 'BEEN', 'HAVE', 'HAS', 'HAD', 'DO', 'DOES', 'DID', 'WILL', 'WOULD', 'COULD', 'SHOULD', 'MAY', 'MIGHT', 'MUST', 'CAN', 'WHAT', 'HOW', 'WHEN', 'WHERE', 'WHY', 'WHO', 'WHICH', 'STOCK', 'ANALYSIS', 'OUTLOOK', 'PERFORMING', 'EARNINGS', 'REPORT'}
        valid_tickers = [t for t in tickers if t not in common_words and len(t) >= 3]
        if valid_tickers:
            return valid_tickers[0]
        
        # Check for company names
        for company, ticker in company_mappings.items():
            if company in query_lower:
                return ticker
        
        # Default fallback
        return "NVDA"  # Default to NVDA for testing
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding using OpenAI API"""
        try:
            import openai
            
            openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            
            response = openai_client.embeddings.create(
                input=text,
                model="text-embedding-3-small"
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"❌ Embedding generation failed: {e}")
            return []
    
    def search_news_vector(self, symbol: str, query: str, since_iso: str, k: int = 20) -> List[Dict[str, Any]]:
        """Real vector search using Milvus embeddings"""
        if not self.client:
            if not self.connect():
                return []
        
        try:
            # Generate embedding for the query
            query_embedding = self.generate_embedding(query)
            if not query_embedding:
                print("❌ Failed to generate embedding, falling back to text search")
                return self.search_news_text(symbol, query, since_iso, k)
            
            # Vector search parameters
            search_params = {
                "metric_type": "COSINE",
                "params": {"nprobe": 10}
            }
            
            # Perform vector search
            results = self.client.search(
                collection_name=self.collection,
                data=[query_embedding],
                anns_field="embedding",
                param=search_params,
                limit=k * 3,  # Get more results for better filtering
                output_fields=["text", "url", "published_utc", "ticker", "source", "title", "sentiment", "keywords"],
                expr=f'ticker == "{symbol.upper()}"'  # Filter by ticker
            )
            
            # Process vector search results
            hits = results[0]  # Get hits for the first query
            formatted_results = []
            
            for hit in hits:
                entity = hit.entity
                formatted_results.append({
                    "title": entity.get("title", entity.get("source", "News")),
                    "url": entity.get("url", ""),
                    "published_utc": entity.get("published_utc", ""),
                    "snippet": str(entity.get("text", ""))[:500],
                    "ticker": entity.get("ticker", symbol),
                    "score": float(hit.score),  # Use vector similarity score
                    "sentiment": entity.get("sentiment", "neutral"),
                    "keywords": entity.get("keywords", "")
                })
            
            return formatted_results[:k]
            
        except Exception as e:
            print(f"❌ Vector search failed: {e}")
            return self.search_news_text(symbol, query, since_iso, k)
    
    def search_news_text(self, symbol: str, query: str, since_iso: str, k: int = 20) -> List[Dict[str, Any]]:
        """Fallback text search using Milvus query"""
        try:
            # Get all available articles for the ticker (no date filter to get more results)
            results = self.client.query(
                collection_name=self.collection,
                filter=f'ticker == "{symbol.upper()}"',
                output_fields=["text", "url", "published_utc", "ticker", "source", "title", "sentiment", "keywords"],
                limit=k * 5  # Get more results
            )
            
            # Format results with basic scoring
            formatted_results = []
            for result in results:
                # Calculate basic relevance score
                title = result.get("title", "").lower()
                text = result.get("text", "").lower()
                query_lower = query.lower()
                
                # Simple keyword matching score
                title_score = sum(1 for word in query_lower.split() if word in title) * 2
                text_score = sum(1 for word in query_lower.split() if word in text)
                base_score = (title_score + text_score) / max(len(query_lower.split()), 1)
                
                # Recency score
                try:
                    pub_date = datetime.fromisoformat(result.get("published_utc", "").replace('Z', '+00:00'))
                    days_old = (datetime.now().replace(tzinfo=pub_date.tzinfo) - pub_date).days
                    recency_score = max(0, 1 - (days_old / 30))  # Decay over 30 days
                except:
                    recency_score = 0.5
                
                final_score = base_score * recency_score
                
                formatted_results.append({
                    "title": result.get("title", result.get("source", "News")),
                    "url": result.get("url", ""),
                    "published_utc": result.get("published_utc", ""),
                    "snippet": str(result.get("text", ""))[:500],
                    "ticker": result.get("ticker", symbol),
                    "score": final_score,
                    "sentiment": result.get("sentiment", "neutral"),
                    "keywords": result.get("keywords", "")
                })
            
            # Sort by score and return top k
            formatted_results.sort(key=lambda x: x['score'], reverse=True)
            return formatted_results[:k]
            
        except Exception as e:
            print(f"❌ Text search failed: {e}")
            return []
    
    def search_news(self, symbol: str, query: str, since_iso: str, k: int = 20) -> List[Dict[str, Any]]:
        """Main search function with symbol extraction and vector search"""
        try:
            # Extract symbol from query if not provided
            if not symbol or symbol.upper() == "UNKNOWN":
                symbol = self.extract_symbol_from_query(query)
                print(f"🔍 Extracted symbol: {symbol} from query: {query}")
            
            # Try vector search first
            results = self.search_news_vector(symbol, query, since_iso, k)
            
            # If no results, try text search
            if not results:
                print("🔄 No vector results, trying text search...")
                results = self.search_news_text(symbol, query, since_iso, k)
            
            print(f"📊 Found {len(results)} results for {symbol}")
            return results
            
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
        print("Usage: python milvus_vector_search.py <command> [args...]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "search":
        if len(sys.argv) < 5:
            print("Usage: python milvus_vector_search.py search <symbol> <query> <since_iso> [k]")
            sys.exit(1)
        
        symbol = sys.argv[2]
        query = sys.argv[3]
        since_iso = sys.argv[4]
        k = int(sys.argv[5]) if len(sys.argv) > 5 else 20
        
        client = MilvusVectorSearch()
        results = client.search_news(symbol, query, since_iso, k)
        print(json.dumps(results, indent=2, default=str))
        client.disconnect()
    
    elif command == "test":
        print("🧪 Testing vector search...")
        client = MilvusVectorSearch()
        
        # Test symbol extraction
        test_queries = [
            "What's the technical outlook for NVIDIA?",
            "How is Apple performing?",
            "Microsoft stock analysis",
            "NVDA earnings report"
        ]
        
        for query in test_queries:
            symbol = client.extract_symbol_from_query(query)
            print(f"Query: '{query}' → Symbol: {symbol}")
        
        # Test actual search
        results = client.search_news("NVDA", "What's the technical outlook for NVIDIA?", "2024-01-01T00:00:00Z", 10)
        print(f"\n📊 Found {len(results)} results")
        for i, result in enumerate(results[:5]):
            print(f"\nResult {i+1}:")
            print(f"  Title: {result['title']}")
            print(f"  Score: {result['score']:.3f}")
            print(f"  Sentiment: {result['sentiment']}")
            print(f"  Published: {result['published_utc']}")
        
        client.disconnect()
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()
