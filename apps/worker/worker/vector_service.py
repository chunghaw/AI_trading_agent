"""Enhanced vector service for trading agents RAG capabilities and news data."""

import os
import uuid
import numpy as np
from typing import List, Dict, Any, Optional
from openai import OpenAI
from pymilvus import (
    connections,
    Collection,
    utility,
    CollectionSchema,
    FieldSchema,
    DataType,
)

# Configuration
MILVUS_URI = os.getenv("MILVUS_URI")
MILVUS_USER = os.getenv("MILVUS_USER")
MILVUS_PASSWORD = os.getenv("MILVUS_PASSWORD")
if not MILVUS_PASSWORD:
    raise ValueError("MILVUS_PASSWORD environment variable is required")

# Collection names
TRADING_AGENTS_COLLECTION = "trading_agents_knowledge_base"
NEWS_COLLECTION = "news_chunks"

# Embedding dimensions
TRADING_AGENTS_DIMENSION = 1536  # text-embedding-ada-002
NEWS_DIMENSION = 3072  # text-embedding-3-large

# In-memory fallback if Milvus is unreachable
fallback_embeddings: Dict[str, List[float]] = {}
fallback_texts: Dict[str, str] = {}
fallback_metadata: Dict[str, Dict[str, Any]] = {}
use_fallback = False


def connect_to_milvus():
    """Try to connect to Milvus; flip fallback flag on failure."""
    global use_fallback
    try:
        connections.connect(
            alias="default",
            uri=os.getenv("MILVUS_URI"),
            user=os.getenv("MILVUS_USER"),
            password=os.getenv("MILVUS_PASSWORD"),
            secure=True
        )
        print("✅ Connected to Milvus")
        use_fallback = False
    except Exception as e:
        print(f"⚠️ Milvus unreachable: {e}")
        print("→ Falling back to in-memory storage")
        use_fallback = True


def create_trading_agents_collection():
    """Create the trading agents knowledge base collection."""
    if utility.has_collection(TRADING_AGENTS_COLLECTION):
        return
    
    schema = CollectionSchema(
        fields=[
            FieldSchema("primary_key", DataType.VARCHAR, is_primary=True, max_length=36),
            FieldSchema("text", DataType.VARCHAR, max_length=65535),
            FieldSchema("embedding", DataType.FLOAT_VECTOR, dim=TRADING_AGENTS_DIMENSION),
        ],
        description="Trading Agents Knowledge Base",
    )
    coll = Collection(name=TRADING_AGENTS_COLLECTION, schema=schema)
    coll.create_index(
        field_name="embedding",
        index_params={
            "metric_type": "COSINE",
            "index_type": "IVF_FLAT",
            "params": {"nlist": 128},
        }
    )
    coll.load()
    print(f"✅ Created collection `{TRADING_AGENTS_COLLECTION}`")


def create_news_collection():
    """Create the news collection (if it doesn't exist from DAG)."""
    if utility.has_collection(NEWS_COLLECTION):
        return
    
    schema = CollectionSchema(
        fields=[
            FieldSchema("id", DataType.VARCHAR, is_primary=True, max_length=64),
            FieldSchema("ticker", DataType.VARCHAR, max_length=16),
            FieldSchema("published_utc", DataType.VARCHAR, max_length=32),
            FieldSchema("source", DataType.VARCHAR, max_length=64),
            FieldSchema("url", DataType.VARCHAR, max_length=512),
            FieldSchema("title", DataType.VARCHAR, max_length=512),
            FieldSchema("text", DataType.VARCHAR, max_length=32768),
            FieldSchema("embedding", DataType.FLOAT_VECTOR, dim=NEWS_DIMENSION),
        ],
        description="Polygon news chunks (embedded)",
    )
    coll = Collection(name=NEWS_COLLECTION, schema=schema)
    coll.create_index(
        field_name="embedding",
        index_params={
            "index_type": "HNSW",
            "metric_type": "COSINE",
            "params": {"M": 16, "efConstruction": 200}
        }
    )
    coll.load()
    print(f"✅ Created collection `{NEWS_COLLECTION}`")


def get_embedding(text: str, model: str = "text-embedding-ada-002") -> List[float]:
    """Embed text using OpenAI embeddings."""
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    resp = client.embeddings.create(model=model, input=[text])
    return resp.data[0].embedding


def initialize_milvus():
    """Call on startup to ensure collections exist (or fallback)."""
    connect_to_milvus()
    if not use_fallback:
        create_trading_agents_collection()
        create_news_collection()


def ingest_trading_knowledge(text: str, metadata: Optional[Dict[str, Any]] = None) -> None:
    """Insert trading knowledge into the agents collection."""
    emb = get_embedding(text, model="text-embedding-ada-002")
    rec_id = str(uuid.uuid4())

    if use_fallback:
        fallback_embeddings[rec_id] = emb
        fallback_texts[rec_id] = text
        fallback_metadata[rec_id] = metadata or {}
        print(f"📝 Ingested trading knowledge to fallback: {text[:50]}…")
        return

    connect_to_milvus()
    create_trading_agents_collection()
    coll = Collection(TRADING_AGENTS_COLLECTION)

    coll.insert([{
        "text": text,
        "embedding": emb
    }])
    coll.flush()
    print(f"📝 Ingested trading knowledge to Milvus: {text[:50]}…")


def search_trading_knowledge(query: str, top_k: int = 3) -> str:
    """Search trading agents knowledge base."""
    if use_fallback:
        return search_local(query, top_k, collection_type="trading")

    try:
        connect_to_milvus()
        coll = Collection(TRADING_AGENTS_COLLECTION)
        coll.load()
        q_emb = get_embedding(query, model="text-embedding-ada-002")
        results = coll.search(
            data=[q_emb],
            anns_field="embedding",
            param={"metric_type": "COSINE", "params": {"nprobe": 10}},
            limit=top_k,
            output_fields=["text"]
        )
        texts = []
        for hits in results:
            for hit in hits:
                texts.append(hit.entity.get("text", ""))
        if not texts:
            return "No relevant trading knowledge found."
        return "\n\n".join(texts)
    except Exception as e:
        print(f"⚠️ Trading knowledge search failed: {e}")
        return search_local(query, top_k, collection_type="trading")


def search_news(query: str, ticker: Optional[str] = None, top_k: int = 5) -> List[Dict[str, Any]]:
    """Search news collection with optional ticker filter."""
    if use_fallback:
        return search_local_news(query, top_k, ticker)

    try:
        connect_to_milvus()
        coll = Collection(NEWS_COLLECTION)
        coll.load()
        q_emb = get_embedding(query, model="text-embedding-3-large")
        
        # Build search expression
        search_expr = None
        if ticker:
            search_expr = f'ticker == "{ticker}"'
        
        results = coll.search(
            data=[q_emb],
            anns_field="embedding",
            param={"metric_type": "COSINE", "params": {"ef": 64}},
            limit=top_k,
            output_fields=["ticker", "published_utc", "source", "url", "title", "text"],
            expr=search_expr
        )
        
        news_items = []
        for hits in results:
            for hit in hits:
                news_items.append({
                    "ticker": hit.entity.get("ticker", ""),
                    "published_utc": hit.entity.get("published_utc", ""),
                    "source": hit.entity.get("source", ""),
                    "url": hit.entity.get("url", ""),
                    "title": hit.entity.get("title", ""),
                    "text": hit.entity.get("text", ""),
                    "score": hit.score
                })
        
        return news_items
    except Exception as e:
        print(f"⚠️ News search failed: {e}")
        return search_local_news(query, top_k, ticker)


def search_local(query: str, top_k: int = 3, collection_type: str = "trading") -> str:
    """Brute-force cosine search over in-memory embeddings."""
    if not fallback_embeddings:
        return "No data yet. Please add some text first."
    
    q_emb = np.array(get_embedding(query, model="text-embedding-ada-002"))
    sims = []
    
    for rid, emb in fallback_embeddings.items():
        e = np.array(emb)
        cos = float(np.dot(q_emb, e) / (np.linalg.norm(q_emb) * np.linalg.norm(e)))
        sims.append((rid, cos))
    
    sims.sort(key=lambda x: x[1], reverse=True)
    top = sims[:top_k]
    return "\n\n".join(fallback_texts[rid] for rid, _ in top)


def search_local_news(query: str, top_k: int = 5, ticker: Optional[str] = None) -> List[Dict[str, Any]]:
    """Local search for news (simplified fallback)."""
    # This is a simplified fallback - in production you'd want more sophisticated local storage
    return [{
        "ticker": ticker or "UNKNOWN",
        "published_utc": "2024-01-01T00:00:00Z",
        "source": "fallback",
        "url": "",
        "title": f"Fallback news for {query}",
        "text": f"Fallback news content for query: {query}",
        "score": 0.5
    }]


def get_collection_stats() -> Dict[str, Any]:
    """Get statistics about the collections."""
    stats = {
        "trading_agents": {"count": 0, "status": "unknown"},
        "news": {"count": 0, "status": "unknown"},
        "fallback_mode": use_fallback
    }
    
    if use_fallback:
        stats["trading_agents"]["count"] = len(fallback_embeddings)
        stats["trading_agents"]["status"] = "fallback"
        stats["news"]["status"] = "fallback"
        return stats
    
    try:
        connect_to_milvus()
        
        if utility.has_collection(TRADING_AGENTS_COLLECTION):
            coll = Collection(TRADING_AGENTS_COLLECTION)
            stats["trading_agents"]["count"] = coll.num_entities
            stats["trading_agents"]["status"] = "active"
        
        if utility.has_collection(NEWS_COLLECTION):
            coll = Collection(NEWS_COLLECTION)
            stats["news"]["count"] = coll.num_entities
            stats["news"]["status"] = "active"
    
    except Exception as e:
        print(f"⚠️ Failed to get collection stats: {e}")
    
    return stats


# Backward compatibility functions
def ingest_milvus(text: str) -> None:
    """Backward compatibility function."""
    ingest_trading_knowledge(text)


def search_milvus(query: str, top_k: int = 3) -> str:
    """Backward compatibility function."""
    return search_trading_knowledge(query, top_k)
