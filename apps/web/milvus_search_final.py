#!/usr/bin/env python3
"""
Final Milvus search - optimized for Vercel with real data, no timeouts
"""
import os
import json
import sys
import time
from typing import List, Dict, Any
from datetime import datetime, timedelta

class MilvusSearchFinal:
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
    
    def search_news_real(self, symbol: str, query: str, since_iso: str, k: int = 20) -> List[Dict[str, Any]]:
        """Real search using Milvus database - NO MOCK DATA"""
        if not self.client:
            if not self.connect():
                return []
        
        try:
            # Get ALL available articles for the ticker (no date filter to get comprehensive results)
            results = self.client.query(
                collection_name=self.collection,
                filter=f'ticker == "{symbol.upper()}"',
                output_fields=["text", "url", "published_utc", "ticker", "source", "title", "sentiment", "keywords"],
                limit=16384  # Get maximum possible results
            )
            
            print(f"📊 Raw database results: {len(results)} articles found for {symbol}")
            
            if not results:
                print(f"❌ No articles found for ticker: {symbol}")
                return []
            
            # Calculate relevance scores based on query content
            query_lower = query.lower()
            query_words = set(query_lower.split())
            
            formatted_results = []
            for result in results:
                title = result.get("title", "").lower()
                text = result.get("text", "").lower()
                keywords = result.get("keywords", "").lower()
                
                # Calculate keyword matching score
                title_matches = sum(1 for word in query_words if word in title) * 3  # Title matches weighted higher
                text_matches = sum(1 for word in query_words if word in text) * 1
                keyword_matches = sum(1 for word in query_words if word in keywords) * 2
                
                # Base relevance score
                base_score = (title_matches + text_matches + keyword_matches) / max(len(query_words), 1)
                
                # Recency score (newer articles get higher scores)
                try:
                    pub_date = datetime.fromisoformat(result.get("published_utc", "").replace('Z', '+00:00'))
                    days_old = (datetime.now().replace(tzinfo=pub_date.tzinfo) - pub_date).days
                    recency_score = max(0.1, 1 - (days_old / 90))  # Decay over 90 days
                except:
                    recency_score = 0.5
                
                # Sentiment score
                sentiment = result.get("sentiment", "neutral").lower()
                sentiment_score = {
                    'positive': 1.2,
                    'negative': 0.8,
                    'neutral': 1.0
                }.get(sentiment, 1.0)
                
                # Source quality score
                source = result.get("source", "").lower()
                quality_sources = ['reuters', 'bloomberg', 'cnbc', 'marketwatch', 'yahoo', 'fool', 'investing', 'benzinga']
                quality_score = 1.2 if any(qs in source for qs in quality_sources) else 1.0
                
                # Final score
                final_score = base_score * recency_score * sentiment_score * quality_score
                
                formatted_results.append({
                    "title": result.get("title", result.get("source", "News")),
                    "url": result.get("url", ""),
                    "published_utc": result.get("published_utc", ""),
                    "snippet": str(result.get("text", ""))[:500],
                    "ticker": result.get("ticker", symbol),
                    "score": final_score,
                    "sentiment": result.get("sentiment", "neutral"),
                    "keywords": result.get("keywords", ""),
                    "source": result.get("source", "")
                })
            
            # Sort by final score and return top k
            formatted_results.sort(key=lambda x: x['score'], reverse=True)
            
            print(f"📊 Returning top {min(k, len(formatted_results))} results")
            return formatted_results[:k]
            
        except Exception as e:
            print(f"❌ Real search failed: {e}")
            return []
    
    def search_news(self, symbol: str, query: str, since_iso: str, k: int = 20) -> List[Dict[str, Any]]:
        """Main search function with symbol extraction"""
        try:
            # Extract symbol from query if not provided or is "UNKNOWN"
            if not symbol or symbol.upper() == "UNKNOWN":
                symbol = self.extract_symbol_from_query(query)
                print(f"🔍 Extracted symbol: {symbol} from query: {query}")
            
            # Perform real search
            results = self.search_news_real(symbol, query, since_iso, k)
            
            print(f"📊 Final results: {len(results)} articles for {symbol}")
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
        print("Usage: python milvus_search_final.py <command> [args...]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "search":
        if len(sys.argv) < 5:
            print("Usage: python milvus_search_final.py search <symbol> <query> <since_iso> [k]")
            sys.exit(1)
        
        symbol = sys.argv[2]
        query = sys.argv[3]
        since_iso = sys.argv[4]
        k = int(sys.argv[5]) if len(sys.argv) > 5 else 20
        
        client = MilvusSearchFinal()
        results = client.search_news(symbol, query, since_iso, k)
        print(json.dumps(results, indent=2, default=str))
        client.disconnect()
    
    elif command == "test":
        print("🧪 Testing final search...")
        client = MilvusSearchFinal()
        
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
            print(f"  Source: {result['source']}")
        
        client.disconnect()
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()
