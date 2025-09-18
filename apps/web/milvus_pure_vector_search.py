#!/usr/bin/env python3
"""
Pure Vector Search Implementation - No ticker filters, full content, proper reranking
"""
import os
import json
import sys
import time
from typing import List, Dict, Any
from datetime import datetime, timedelta

class MilvusPureVectorSearch:
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
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding using OpenAI API"""
        try:
            import openai
            
            openai_client = openai.OpenAI(apiKey=os.getenv("OPENAI_API_KEY"))
            
            response = openai_client.embeddings.create(
                input=text,
                model="text-embedding-3-small"
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"❌ Embedding generation failed: {e}")
            return []
    
    def search_news_pure_vector(self, query: str, since_iso: str, k: int = 25) -> List[Dict[str, Any]]:
        """
        Pure vector search - NO ticker filtering, NO content truncation
        Corporate-standard top-K reranking pipeline
        """
        if not self.client:
            if not self.connect():
                return []
        
        try:
            # Step 1: Generate embedding for the query
            query_embedding = self.generate_embedding(query)
            if not query_embedding:
                print("❌ Failed to generate embedding, falling back to text search")
                return self.search_news_text_fallback(query, since_iso, k)
            
            # Step 2: Pure vector search - NO ticker filtering
            search_params = {
                "metric_type": "COSINE",
                "params": {"nprobe": 10}
            }
            
            # Get top-K candidates (K=100 for reranking)
            results = self.client.search(
                collection_name=self.collection,
                data=[query_embedding],
                anns_field="embedding",
                param=search_params,
                limit=100,  # Get 100 candidates for reranking
                output_fields=["text", "url", "published_utc", "ticker", "source", "title", "sentiment", "keywords"]
                # NO expr filter - pure semantic search
            )
            
            print(f"📊 Vector search retrieved {len(results[0])} candidates")
            
            if not results[0]:
                print("❌ No vector search results found")
                return []
            
            # Step 3: Reranking pipeline
            reranked_results = self.rerank_results(results[0], query, since_iso)
            
            # Step 4: Deduplication
            deduplicated_results = self.deduplicate_results(reranked_results)
            
            # Step 5: Return top-K final results
            final_results = deduplicated_results[:k]
            
            print(f"📊 Final results: {len(final_results)} articles")
            return final_results
            
        except Exception as e:
            print(f"❌ Pure vector search failed: {e}")
            return self.search_news_text_fallback(query, since_iso, k)
    
    def rerank_results(self, candidates: List, query: str, since_iso: str) -> List[Dict[str, Any]]:
        """
        Corporate-standard reranking pipeline
        Combines vector similarity with business logic
        """
        query_lower = query.lower()
        query_words = set(query_lower.split())
        
        reranked = []
        for hit in candidates:
            entity = hit.entity
            
            # Get FULL article content - NO truncation
            full_text = entity.get("text", "")
            title = entity.get("title", "")
            source = entity.get("source", "")
            ticker = entity.get("ticker", "")
            published_utc = entity.get("published_utc", "")
            sentiment = entity.get("sentiment", "neutral")
            keywords = entity.get("keywords", "")
            
            # Base vector similarity score
            vector_score = float(hit.score)
            
            # Business logic scoring
            business_score = self.calculate_business_score(
                query_words, title, full_text, keywords, 
                source, ticker, published_utc, sentiment
            )
            
            # Combined score (weighted)
            final_score = (vector_score * 0.7) + (business_score * 0.3)
            
            reranked.append({
                "title": title,
                "url": entity.get("url", ""),
                "published_utc": published_utc,
                "snippet": full_text,  # FULL CONTENT - NO TRUNCATION
                "ticker": ticker,
                "score": final_score,
                "vector_score": vector_score,
                "business_score": business_score,
                "sentiment": sentiment,
                "keywords": keywords,
                "source": source
            })
        
        # Sort by final score
        reranked.sort(key=lambda x: x['score'], reverse=True)
        return reranked
    
    def calculate_business_score(self, query_words: set, title: str, full_text: str, 
                               keywords: str, source: str, ticker: str, 
                               published_utc: str, sentiment: str) -> float:
        """
        Calculate business logic score for reranking
        """
        score = 0.0
        
        # 1. Keyword relevance (title weighted higher)
        title_matches = sum(1 for word in query_words if word in title.lower()) * 3
        text_matches = sum(1 for word in query_words if word in full_text.lower()) * 1
        keyword_matches = sum(1 for word in query_words if word in keywords.lower()) * 2
        
        relevance_score = (title_matches + text_matches + keyword_matches) / max(len(query_words), 1)
        score += relevance_score * 0.4
        
        # 2. Recency score
        try:
            pub_date = datetime.fromisoformat(published_utc.replace('Z', '+00:00'))
            days_old = (datetime.now().replace(tzinfo=pub_date.tzinfo) - pub_date).days
            recency_score = max(0.1, 1 - (days_old / 30))  # Decay over 30 days
        except:
            recency_score = 0.5
        score += recency_score * 0.3
        
        # 3. Source quality
        quality_sources = ['reuters', 'bloomberg', 'cnbc', 'marketwatch', 'yahoo', 'fool', 'investing', 'benzinga']
        quality_score = 1.2 if any(qs in source.lower() for qs in quality_sources) else 1.0
        score += quality_score * 0.2
        
        # 4. Sentiment score
        sentiment_score = {'positive': 1.1, 'negative': 0.9, 'neutral': 1.0}.get(sentiment.lower(), 1.0)
        score += sentiment_score * 0.1
        
        return score
    
    def deduplicate_results(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Remove duplicate articles by URL and similar titles
        """
        seen_urls = set()
        seen_titles = set()
        deduplicated = []
        
        for result in results:
            url = result.get('url', '')
            title = result.get('title', '').lower()
            
            # Skip if URL or title already seen
            if url in seen_urls or title in seen_titles:
                continue
            
            seen_urls.add(url)
            seen_titles.add(title)
            deduplicated.append(result)
        
        return deduplicated
    
    def search_news_text_fallback(self, query: str, since_iso: str, k: int = 25) -> List[Dict[str, Any]]:
        """
        Fallback text search when vector search fails
        """
        try:
            # Get all articles (no ticker filter)
            results = self.client.query(
                collection_name=self.collection,
                output_fields=["text", "url", "published_utc", "ticker", "source", "title", "sentiment", "keywords"],
                limit=1000  # Get more for text matching
            )
            
            # Text-based scoring and ranking
            query_lower = query.lower()
            query_words = set(query_lower.split())
            
            scored_results = []
            for result in results:
                title = result.get("title", "").lower()
                full_text = result.get("text", "").lower()
                
                # Calculate text similarity score
                title_matches = sum(1 for word in query_words if word in title) * 3
                text_matches = sum(1 for word in query_words if word in full_text) * 1
                text_score = (title_matches + text_matches) / max(len(query_words), 1)
                
                scored_results.append({
                    "title": result.get("title", ""),
                    "url": result.get("url", ""),
                    "published_utc": result.get("published_utc", ""),
                    "snippet": result.get("text", ""),  # FULL CONTENT
                    "ticker": result.get("ticker", ""),
                    "score": text_score,
                    "vector_score": 0.0,
                    "business_score": text_score,
                    "sentiment": result.get("sentiment", "neutral"),
                    "keywords": result.get("keywords", ""),
                    "source": result.get("source", "")
                })
            
            # Sort and return top-K
            scored_results.sort(key=lambda x: x['score'], reverse=True)
            return scored_results[:k]
            
        except Exception as e:
            print(f"❌ Text fallback failed: {e}")
            return []
    
    def search_news(self, symbol: str, query: str, since_iso: str, k: int = 25) -> List[Dict[str, Any]]:
        """
        Main search function - Pure vector search approach
        """
        try:
            print(f"🔍 Pure vector search for: '{query}'")
            
            # Use pure vector search (ignore symbol parameter)
            results = self.search_news_pure_vector(query, since_iso, k)
            
            print(f"📊 Found {len(results)} results")
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
        print("Usage: python milvus_pure_vector_search.py <command> [args...]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "search":
        if len(sys.argv) < 4:
            print("Usage: python milvus_pure_vector_search.py search <query> <since_iso> [k]")
            sys.exit(1)
        
        query = sys.argv[2]
        since_iso = sys.argv[3]
        k = int(sys.argv[4]) if len(sys.argv) > 4 else 25
        
        client = MilvusPureVectorSearch()
        results = client.search_news("", query, since_iso, k)  # Ignore symbol
        print(json.dumps(results, indent=2, default=str))
        client.disconnect()
    
    elif command == "test":
        print("🧪 Testing pure vector search...")
        client = MilvusPureVectorSearch()
        
        # Test pure vector search
        results = client.search_news("", "What's the technical outlook for NVIDIA?", "2024-01-01T00:00:00Z", 25)
        print(f"\n📊 Found {len(results)} results")
        
        for i, result in enumerate(results[:10]):
            print(f"\nResult {i+1}:")
            print(f"  Title: {result['title']}")
            print(f"  Ticker: {result['ticker']}")
            print(f"  Score: {result['score']:.3f} (Vector: {result['vector_score']:.3f}, Business: {result['business_score']:.3f})")
            print(f"  Sentiment: {result['sentiment']}")
            print(f"  Published: {result['published_utc']}")
            print(f"  Source: {result['source']}")
            print(f"  Content length: {len(result['snippet'])} chars")
        
        client.disconnect()
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()
