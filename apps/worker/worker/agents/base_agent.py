"""Base agent class for the multi-agent trading system with RAG capabilities."""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from loguru import logger
import os
from openai import OpenAI
from .vector_service import search_milvus, ingest_milvus, initialize_milvus

@dataclass
class AgentResponse:
    """Standard response format for all agents."""
    success: bool
    data: Dict[str, Any]
    message: str
    confidence: float = 0.0
    metadata: Optional[Dict[str, Any]] = None

class BaseAgent(ABC):
    """Base class for all trading agents with RAG capabilities."""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        self.name = name
        self.config = config
        self.logger = logger.bind(agent=name)
        
        # Initialize OpenAI client
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        # Initialize vector database
        try:
            initialize_milvus()
            self.logger.info("Vector database initialized successfully")
        except Exception as e:
            self.logger.warning(f"Vector database initialization failed: {e}")
        
        # Agent-specific knowledge base collection
        self.collection_name = f"{name.lower()}_knowledge_base"
        
    @abstractmethod
    async def analyze(self, symbol: str, data: Dict[str, Any]) -> AgentResponse:
        """Analyze the given data and return insights."""
        pass
    
    def get_context(self, query: str, top_k: int = 5) -> str:
        """Retrieve relevant context from the agent's knowledge base."""
        try:
            context = search_milvus(query, top_k=top_k)
            return context
        except Exception as e:
            self.logger.error(f"Failed to retrieve context: {e}")
            return ""
    
    def ingest_knowledge(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Ingest knowledge into the agent's knowledge base."""
        try:
            # Add metadata to text for better context
            if metadata:
                text_with_metadata = f"Metadata: {metadata}\n\nContent: {text}"
            else:
                text_with_metadata = text
                
            ingest_milvus(text_with_metadata)
            self.logger.info(f"Ingested knowledge: {text[:100]}...")
        except Exception as e:
            self.logger.error(f"Failed to ingest knowledge: {e}")
    
    def generate_response(self, system_prompt: str, user_prompt: str, 
                         temperature: float = 0.7, max_tokens: int = 1000) -> str:
        """Generate AI response using OpenAI with context-aware prompting."""
        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content
        except Exception as e:
            self.logger.error(f"Failed to generate AI response: {e}")
            return ""
    
    def log_analysis(self, symbol: str, message: str):
        """Log analysis completion with standardized format."""
        self.logger.info(f"Analysis completed for {symbol}: {message}")
    
    def get_agent_info(self) -> Dict[str, Any]:
        """Get agent information for status reporting."""
        return {
            "name": self.name,
            "type": self.__class__.__name__,
            "collection": self.collection_name,
            "config": self.config
        }
