"""Vector service for trading agents RAG capabilities."""
import os
import uuid
import numpy as np
from typing import List, Dict, Optional
from openai import OpenAI
from pymilvus import connections, Collection, exceptions as milvus_exceptions

# Configuration - match your working setup
MILVUS_URI = os.getenv("MILVUS_URI", "https://in03-85d251bbc78827a.serverless.aws-eu-central-1.cloud.zilliz.com")
MILVUS_USER = os.getenv("MILVUS_USER", "db_85d251bbc78827a")
MILVUS_PASSWORD = os.getenv("MILVUS_PASSWORD")
if not MILVUS_PASSWORD:
    raise ValueError("MILVUS_PASSWORD environment variable is required")
MILVUS_COLLECTION = os.getenv("MILVUS_COLLECTION", "trading_agents_knowledge_base")
DIMENSION = 1536  # text-embedding-ada-002

# In-memory fallback if Milvus is unreachable
fallback_embeddings: Dict[str, List[float]] = {}
fallback_texts: Dict[str, str] = {}
use_fallback = False

def connect_to_milvus():
    """Connect to Milvus using your working approach."""
    global use_fallback
    try:
        connections.connect(uri=MILVUS_URI, user=MILVUS_USER, password=MILVUS_PASSWORD)
        print(f"✅ Connected to Milvus at {MILVUS_URI}")
        use_fallback = False
        return True
    except Exception as e:
        print(f"⚠️ Milvus unreachable: {e}")
        print("→ Falling back to in-memory storage")
        use_fallback = True
        return False

def get_embedding(text: str) -> List[float]:
    """Embed text using OpenAI's ada-002."""
    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        resp = client.embeddings.create(model="text-embedding-ada-002", input=[text])
        return resp.data[0].embedding
    except Exception as e:
        print(f"⚠️ OpenAI embedding failed: {e}")
        # Return zero vector as fallback
        return [0.0] * DIMENSION

def search_milvus(query: str, top_k: int = 3) -> str:
    """Search Milvus for relevant context - matches your working approach."""
    try:
        if use_fallback:
            return search_fallback(query, top_k)
        
        connections.connect(uri=MILVUS_URI, user=MILVUS_USER, password=MILVUS_PASSWORD)
        collection = Collection(MILVUS_COLLECTION)
        
        # Embed the query
        query_embedding = get_embedding(query)
        
        # Search
        results = collection.search(
            data=[query_embedding],
            anns_field="embedding",
            param={"metric_type": "COSINE", "params": {"nprobe": 10}},
            limit=top_k,
            output_fields=["text"]
        )
        
        # Extract text from results
        context = "\n".join([hit.entity.get("text", "") for hit in results[0]])
        return context
        
    except milvus_exceptions.MilvusException as e:
        print(f"⚠️ Milvus search error: {e}")
        return search_fallback(query, top_k)
    except Exception as e:
        print(f"⚠️ Search error: {e}")
        return search_fallback(query, top_k)

def search_fallback(query: str, top_k: int = 3) -> str:
    """Fallback search using in-memory storage."""
    if not fallback_texts:
        return "No knowledge base available."
    
    # Simple keyword matching as fallback
    query_lower = query.lower()
    matches = []
    
    for text_id, text in fallback_texts.items():
        if any(word in text.lower() for word in query_lower.split()):
            matches.append(text)
            if len(matches) >= top_k:
                break
    
    return "\n".join(matches) if matches else "No relevant context found."

def ingest_milvus(text: str, metadata: Optional[Dict] = None) -> None:
    """Insert text into Milvus or fallback store."""
    if not text.strip():
        return
    
    # Generate embedding
    embedding = get_embedding(text)
    rec_id = str(uuid.uuid4())
    
    # Fallback path
    if use_fallback:
        fallback_embeddings[rec_id] = embedding
        fallback_texts[rec_id] = text
        print(f"📝 Ingested to fallback: {text[:50]}…")
        return
    
    # Real Milvus path - simplified approach
    try:
        connections.connect(uri=MILVUS_URI, user=MILVUS_USER, password=MILVUS_PASSWORD)
        collection = Collection(MILVUS_COLLECTION)
        
        # Insert data
        collection.insert([
            [rec_id],
            [text],
            [embedding]
        ])
        
        print(f"📝 Ingested to Milvus: {text[:50]}…")
        
    except Exception as e:
        print(f"⚠️ Milvus ingestion failed: {e}")
        # Fallback to in-memory
        fallback_embeddings[rec_id] = embedding
        fallback_texts[rec_id] = text
        print(f"📝 Fallback ingestion: {text[:50]}…")

def initialize_milvus():
    """Initialize Milvus connection."""
    connect_to_milvus()

def get_collection_stats() -> Dict:
    """Get collection statistics."""
    try:
        if use_fallback:
            return {
                "trading_agents": {"status": "fallback", "count": len(fallback_texts)},
                "news": {"status": "fallback", "count": 0}
            }
        
        connections.connect(uri=MILVUS_URI, user=MILVUS_USER, password=MILVUS_PASSWORD)
        collection = Collection(MILVUS_COLLECTION)
        count = collection.num_entities
        
        return {
            "trading_agents": {"status": "active", "count": count},
            "news": {"status": "active", "count": 0}
        }
        
    except Exception as e:
        return {
            "trading_agents": {"status": "error", "error": str(e)},
            "news": {"status": "error", "error": str(e)}
        }

# Simplified functions for the trading system
def search_trading_knowledge(query: str, top_k: int = 3) -> str:
    """Search trading knowledge base."""
    return search_milvus(query, top_k)

def search_news(query: str, top_k: int = 3) -> str:
    """Search news knowledge base."""
    # For now, use the same collection
    return search_milvus(query, top_k)

def ingest_trading_knowledge(text: str, metadata: Optional[Dict] = None) -> None:
    """Ingest trading knowledge."""
    ingest_milvus(text, metadata)

def ingest_news(text: str, metadata: Optional[Dict] = None) -> None:
    """Ingest news knowledge."""
    ingest_milvus(text, metadata)
