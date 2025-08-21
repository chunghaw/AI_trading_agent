"""News Analyst Agent - monitors global news and macroeconomic indicators using RAG."""
import asyncio
from typing import Dict, Any, List
from datetime import datetime, timedelta
import requests
from .base_agent import BaseAgent, AgentResponse
import os

# Import the new vector service and data connector
from ..vector_service import search_news, search_trading_knowledge
from ..data_connector import DataConnector


class NewsAnalyst(BaseAgent):
    """News Analyst Agent with RAG capabilities for news sentiment and macroeconomic analysis."""
    
    def __init__(self, name: str = "NewsAnalyst", config: Dict[str, Any] = None):
        super().__init__(name, config or {})
        
        # Initialize data connector
        self.data_connector = DataConnector(config or {})
        
        # Initialize with some basic news knowledge
        self._initialize_knowledge_base()
    
    def _initialize_knowledge_base(self):
        """Initialize the knowledge base with basic news analysis patterns."""
        knowledge_base = [
            {
                "text": "Positive news typically includes: earnings beats, new product launches, positive analyst ratings, market expansion, regulatory approvals, strong financial results, and positive guidance.",
                "metadata": {"type": "sentiment_pattern", "category": "positive"}
            },
            {
                "text": "Negative news typically includes: earnings misses, regulatory issues, lawsuits, management changes, product recalls, market contraction, weak financial results, and negative guidance.",
                "metadata": {"type": "sentiment_pattern", "category": "negative"}
            },
            {
                "text": "Macroeconomic indicators to monitor: GDP growth, inflation rates, interest rates, unemployment rates, consumer confidence, manufacturing PMI, retail sales, and housing market data.",
                "metadata": {"type": "macro_indicators", "category": "economic"}
            },
            {
                "text": "Market volatility indicators: VIX index, market breadth, sector rotation, trading volume, and correlation between asset classes.",
                "metadata": {"type": "volatility", "category": "market"}
            }
        ]
        
        for item in knowledge_base:
            self.ingest_knowledge(item["text"], item["metadata"])
    
    async def fetch_news_data(self, symbol: str) -> Dict[str, Any]:
        """Fetch real news data for the symbol from multiple sources."""
        try:
            # First, try to get news from the Milvus collection (from DAG pipeline)
            milvus_news = search_news(f"{symbol} stock market", ticker=symbol, top_k=10)
            
            if milvus_news and len(milvus_news) > 0:
                self.logger.info(f"Found {len(milvus_news)} news items from Milvus for {symbol}")
                return self._format_milvus_news(milvus_news)
            
            # Fallback to NewsAPI if available
            news_api_key = os.getenv("NEWS_API_KEY")
            if news_api_key:
                return await self._fetch_from_newsapi(symbol, news_api_key)
            else:
                # Final fallback to simulated news data
                return await self._generate_simulated_news(symbol)
                
        except Exception as e:
            self.logger.error(f"Failed to fetch news data: {e}")
            return await self._generate_simulated_news(symbol)
    
    def _format_milvus_news(self, milvus_news: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Format Milvus news data into standard format."""
        articles = []
        for item in milvus_news:
            articles.append({
                "title": item.get("title", ""),
                "description": item.get("text", "")[:200] + "...",
                "publishedAt": item.get("published_utc", ""),
                "source": item.get("source", ""),
                "url": item.get("url", ""),
                "sentiment": "neutral"  # Will be analyzed by sentiment analysis
            })
        
        return {
            "articles": articles,
            "total_results": len(articles),
            "source": "milvus_pipeline"
        }
    
    async def _fetch_from_newsapi(self, symbol: str, api_key: str) -> Dict[str, Any]:
        """Fetch news from NewsAPI."""
        url = "https://newsapi.org/v2/everything"
        params = {
            "q": f"{symbol} stock",
            "apiKey": api_key,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": 10
        }
        
        response = requests.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            return {
                "articles": data.get("articles", []),
                "total_results": data.get("totalResults", 0),
                "source": "newsapi"
            }
        else:
            raise Exception(f"NewsAPI request failed: {response.status_code}")
    
    async def _generate_simulated_news(self, symbol: str) -> Dict[str, Any]:
        """Generate simulated news data for testing."""
        return {
            "articles": [
                {
                    "title": f"Positive outlook for {symbol} as earnings beat expectations",
                    "description": f"{symbol} reported strong quarterly results",
                    "publishedAt": datetime.now().isoformat(),
                    "sentiment": "positive"
                },
                {
                    "title": f"{symbol} announces new product launch",
                    "description": f"{symbol} expands product portfolio",
                    "publishedAt": datetime.now().isoformat(),
                    "sentiment": "positive"
                },
                {
                    "title": f"Market volatility affects {symbol} trading",
                    "description": f"{symbol} shares fluctuate with market conditions",
                    "publishedAt": datetime.now().isoformat(),
                    "sentiment": "neutral"
                }
            ],
            "total_results": 3,
            "source": "simulated"
        }
    
    async def analyze_sentiment(self, news_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze news sentiment using RAG and AI."""
        try:
            # Extract news content for analysis
            news_content = []
            for article in news_data.get("articles", []):
                news_content.append(f"Title: {article.get('title', '')}")
                news_content.append(f"Description: {article.get('description', '')}")
            
            news_text = "\n".join(news_content)
            
            # Get relevant context from trading knowledge base
            context = search_trading_knowledge(f"news sentiment analysis for {news_text[:200]}")
            
            # Generate AI analysis
            system_prompt = """You are an expert financial news analyst. Analyze the provided news content and return a JSON response with the following structure:
{
    "sentiment_score": float (between -1 and 1),
    "news_count": int,
    "positive_news": int,
    "negative_news": int,
    "neutral_news": int,
    "key_events": [list of important events],
    "confidence": float (between 0 and 1)
}

Focus on financial impact, market sentiment, and potential trading implications."""
            
            user_prompt = f"""CONTEXT FROM KNOWLEDGE BASE:
{context}

NEWS CONTENT TO ANALYZE:
{news_text}

Please analyze the sentiment and provide a JSON response."""
            
            ai_response = self.generate_response(system_prompt, user_prompt, temperature=0.3)
            
            # Parse AI response
            try:
                import json
                result = json.loads(ai_response)
                return result
            except:
                # Fallback to basic analysis
                return self._basic_sentiment_analysis(news_data)
                
        except Exception as e:
            self.logger.error(f"Sentiment analysis failed: {e}")
            return self._basic_sentiment_analysis(news_data)
    
    def _basic_sentiment_analysis(self, news_data: Dict[str, Any]) -> Dict[str, Any]:
        """Basic sentiment analysis as fallback."""
        articles = news_data.get("articles", [])
        positive_count = sum(1 for a in articles if a.get("sentiment") == "positive")
        negative_count = sum(1 for a in articles if a.get("sentiment") == "negative")
        neutral_count = len(articles) - positive_count - negative_count
        
        sentiment_score = (positive_count - negative_count) / max(len(articles), 1)
        
        return {
            "sentiment_score": sentiment_score,
            "news_count": len(articles),
            "positive_news": positive_count,
            "negative_news": negative_count,
            "neutral_news": neutral_count,
            "key_events": [a.get("title", "") for a in articles[:3]],
            "confidence": 0.7
        }
    
    async def get_macro_indicators(self) -> Dict[str, Any]:
        """Get macroeconomic indicators using RAG."""
        try:
            # Get relevant macroeconomic context from trading knowledge
            context = search_trading_knowledge("macroeconomic indicators GDP inflation interest rates unemployment")
            
            system_prompt = """You are an expert macroeconomic analyst. Based on the provided context and current market conditions, provide a JSON response with current macroeconomic indicators:
{
    "inflation_rate": float,
    "interest_rate": float,
    "gdp_growth": float,
    "unemployment_rate": float,
    "market_volatility": float,
    "confidence": float
}"""
            
            user_prompt = f"""CONTEXT:
{context}

Please provide current macroeconomic indicators in JSON format."""
            
            ai_response = self.generate_response(system_prompt, user_prompt, temperature=0.2)
            
            try:
                import json
                return json.loads(ai_response)
            except:
                # Fallback to reasonable defaults
                return {
                    "inflation_rate": 2.5,
                    "interest_rate": 5.25,
                    "gdp_growth": 2.1,
                    "unemployment_rate": 3.8,
                    "market_volatility": 0.15,
                    "confidence": 0.8
                }
                
        except Exception as e:
            self.logger.error(f"Macro indicators analysis failed: {e}")
            return {
                "inflation_rate": 2.5,
                "interest_rate": 5.25,
                "gdp_growth": 2.1,
                "unemployment_rate": 3.8,
                "market_volatility": 0.15,
                "confidence": 0.8
            }
    
    async def get_technical_context(self, symbol: str) -> Dict[str, Any]:
        """Get technical analysis context for the symbol."""
        try:
            # Get market data from the data connector
            market_data = self.data_connector.get_market_data(symbol)
            
            if market_data.get("indicators"):
                indicators = market_data["indicators"]
                summary = market_data.get("summary", {})
                
                return {
                    "rsi": indicators.get("rsi", 50),
                    "macd_signal": indicators.get("macd_signal", 0),
                    "price_trend": summary.get("trend", "neutral"),
                    "volume_change": summary.get("volume_change_pct", 0),
                    "data_quality": self.data_connector.validate_data_quality(symbol)
                }
            
            return {"data_available": False}
            
        except Exception as e:
            self.logger.error(f"Failed to get technical context for {symbol}: {e}")
            return {"data_available": False, "error": str(e)}
    
    async def analyze(self, symbol: str, data: Dict[str, Any]) -> AgentResponse:
        """Analyze news sentiment and macroeconomic indicators for the symbol."""
        try:
            # Fetch news data
            news_data = await self.fetch_news_data(symbol)
            
            # Analyze sentiment
            sentiment_analysis = await self.analyze_sentiment(news_data)
            
            # Get macroeconomic indicators
            macro_indicators = await self.get_macro_indicators()
            
            # Get technical context
            technical_context = await self.get_technical_context(symbol)
            
            # Combine results
            result_data = {
                "news_count": sentiment_analysis["news_count"],
                "sentiment_score": sentiment_analysis["sentiment_score"],
                "positive_news": sentiment_analysis["positive_news"],
                "negative_news": sentiment_analysis["negative_news"],
                "neutral_news": sentiment_analysis["neutral_news"],
                "macro_indicators": macro_indicators,
                "technical_context": technical_context,
                "key_events": sentiment_analysis["key_events"],
                "news_source": news_data.get("source", "unknown")
            }
            
            # Log analysis
            self.log_analysis(symbol, f"{sentiment_analysis['sentiment_score']:.2f} sentiment score")
            
            return AgentResponse(
                success=True,
                data=result_data,
                message=f"News analysis completed: {sentiment_analysis['sentiment_score']:.2f} sentiment score",
                confidence=sentiment_analysis.get("confidence", 0.7),
                metadata={
                    "symbol": symbol,
                    "timestamp": datetime.now().isoformat(),
                    "news_sources": news_data.get("source", "unknown"),
                    "technical_data_available": technical_context.get("data_available", False)
                }
            )
            
        except Exception as e:
            self.logger.error(f"News analysis failed for {symbol}: {e}")
            return AgentResponse(
                success=False,
                data={},
                message=f"News analysis failed: {str(e)}",
                confidence=0.0
            )
