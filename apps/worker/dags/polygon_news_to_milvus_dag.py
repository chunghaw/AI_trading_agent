# -*- coding: utf-8 -*-
"""
Airflow DAG: polygon_news_to_milvus_dag
Purpose:
  - Pull latest news from Polygon for a list of tickers
  - Chunk + embed with OpenAI embeddings
  - Upsert into Milvus (create collection + HNSW index if missing)
  - Maintain an incremental watermark per ticker using Airflow Variables

Airflow: 2.6+ (TaskFlow API)

ENV / Variables needed:
  POLYGON_API_KEY
  OPENAI_API_KEY
  MILVUS_HOST (e.g., "localhost")
  MILVUS_PORT (e.g., "19530")
  MILVUS_TOKEN (optional, for Zilliz/Milvus auth)
  NEWS_TICKERS (JSON string, e.g. ["NVDA","AMD","AAPL"])
  NEWS_LOOKBACK_DAYS (optional, default: 2)
"""

from __future__ import annotations

import os
import json
import time
import uuid
import math
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Iterable

import requests
from airflow import DAG
from airflow.decorators import task
from airflow.models import Variable
from airflow.utils.dates import days_ago

# --- Embeddings (OpenAI) ------------------------------------------------------

try:
    from openai import OpenAI
except Exception:
    OpenAI = None


def embed_texts(chunks: List[str], model: str = "text-embedding-3-large") -> List[List[float]]:
    if OpenAI is None:
        raise RuntimeError("openai package not installed. pip install openai")
    api_key = env_or_var("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not configured.")
    client = OpenAI(api_key=api_key)

    BATCH = 64
    vectors: List[List[float]] = []
    for i in range(0, len(chunks), BATCH):
        batch = chunks[i:i + BATCH]
        resp = client.embeddings.create(model=model, input=batch)
        vectors.extend([d.embedding for d in resp.data])
        time.sleep(0.2)  # small pacing
    return vectors


# --- Milvus utils -------------------------------------------------------------

from pymilvus import (
    connections, utility, FieldSchema, CollectionSchema, DataType, Collection
)


def ensure_milvus_connection() -> None:
    host = env_or_var("MILVUS_HOST", "localhost")
    port = env_or_var("MILVUS_PORT", "19530")
    token = env_or_var("MILVUS_TOKEN", "")
    connections.connect(alias="default", host=host, port=port, token=token or None)


COLLECTION_NAME = "news_chunks"


def ensure_collection(vector_dim: int = 3072) -> Collection:
    ensure_milvus_connection()
    if not utility.has_collection(COLLECTION_NAME):
        fields = [
            FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, auto_id=False, max_length=64),
            FieldSchema(name="ticker", dtype=DataType.VARCHAR, max_length=16),
            FieldSchema(name="published_utc", dtype=DataType.VARCHAR, max_length=32),
            FieldSchema(name="source", dtype=DataType.VARCHAR, max_length=64),
            FieldSchema(name="url", dtype=DataType.VARCHAR, max_length=512),
            FieldSchema(name="title", dtype=DataType.VARCHAR, max_length=512),
            FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=32768),
            FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=vector_dim),
        ]
        schema = CollectionSchema(fields, description="Polygon news chunks (embedded)")
        coll = Collection(name=COLLECTION_NAME, schema=schema)
        coll.create_index(
            field_name="embedding",
            index_params={"index_type": "HNSW", "metric_type": "COSINE", "params": {"M": 16, "efConstruction": 200}},
        )
        coll.load()
        return coll

    coll = Collection(COLLECTION_NAME)
    # Ensure an index exists for the embedding field
    if not any(getattr(idx, "field_name", "") == "embedding" for idx in getattr(coll, "indexes", [])):
        coll.create_index(
            field_name="embedding",
            index_params={"index_type": "HNSW", "metric_type": "COSINE", "params": {"M": 16, "efConstruction": 200}},
        )
    coll.load()
    return coll


def upsert_chunks(rows: List[Dict[str, Any]]) -> int:
    if not rows:
        return 0
    coll = ensure_collection(vector_dim=len(rows[0]["embedding"]))
    BATCH = 512
    n = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        data = [
            [r["id"] for r in batch],
            [r["ticker"] for r in batch],
            [r["published_utc"] for r in batch],
            [r["source"] for r in batch],
            [r["url"] for r in batch],
            [r["title"] for r in batch],
            [r["text"] for r in batch],
            [r["embedding"] for r in batch],
        ]
        coll.insert(data)
        n += len(batch)
    coll.flush()
    return n


# --- Helpers ------------------------------------------------------------------

def env_or_var(key: str, default: str | None = None) -> str | None:
    val = os.getenv(key)
    if val:
        return val
    try:
        return Variable.get(key)
    except Exception:
        return default


def rough_token_len(s: str) -> int:
    return math.ceil(len(s) / 4)  # cheap heuristic


def chunk_text(text: str, max_tokens: int = 900, overlap_tokens: int = 120) -> List[str]:
    words = text.split()
    chunks = []
    cur, cur_tokens = [], 0
    for w in words:
        tok = rough_token_len(w) + 1
        if cur_tokens + tok > max_tokens and cur:
            chunks.append(" ".join(cur))
            overlap_words = max(1, overlap_tokens // 3)
            cur = cur[-overlap_words:]
            cur_tokens = sum(rough_token_len(x) + 1 for x in cur)
        cur.append(w)
        cur_tokens += tok
    if cur:
        chunks.append(" ".join(cur))
    return chunks


def polygon_news(ticker: str, published_gte: str, published_lte: str | None = None, limit: int = 50):
    api_key = env_or_var("POLYGON_API_KEY")
    if not api_key:
        raise RuntimeError("POLYGON_API_KEY not set")
    url = "https://api.polygon.io/v2/reference/news"
    params = {
        "ticker": ticker,
        "limit": limit,
        "order": "asc",
        "sort": "published_utc",
        "published_utc.gte": published_gte,
        "apiKey": api_key,
    }
    if published_lte:
        params["published_utc.lte"] = published_lte

    while True:
        r = requests.get(url, params=params)
        r.raise_for_status()
        data = r.json()
        results = data.get("results", [])
        for item in results:
            yield item
        next_url = data.get("next_url")
        if not next_url:
            break
        r = requests.get(next_url, params={"apiKey": api_key})
        r.raise_for_status()
        data = r.json()
        results = data.get("results", [])
        for item in results:
            yield item
        if not data.get("next_url"):
            break


# --- DAG ----------------------------------------------------------------------

default_args = {
    "owner": "ai_trading_agent",
    "retries": 2,
    "retry_delay": timedelta(minutes=2),
}

with DAG(
    dag_id="polygon_news_to_milvus_dag",
    default_args=default_args,
    start_date=days_ago(1),
    schedule_interval="*/30 * * * *",
    catchup=False,
    max_active_runs=1,
    tags=["news", "milvus", "rag", "polygon"],
) as dag:

    @task
    def prepare_run_window() -> Dict[str, Any]:
        lookback_days = int(env_or_var("NEWS_LOOKBACK_DAYS", "2"))
        now = datetime.now(timezone.utc)
        start_dt = now - timedelta(days=lookback_days)
        tickers_raw = env_or_var("NEWS_TICKERS", '["NVDA","AMD","AAPL"]')
        try:
            tickers = json.loads(tickers_raw)
        except Exception:
            tickers = ["NVDA", "AMD", "AAPL"]
        return {
            "start_iso": start_dt.isoformat(timespec="seconds").replace("+00:00", "Z"),
            "end_iso": now.isoformat(timespec="seconds").replace("+00:00", "Z"),
            "tickers": tickers,
        }

    @task
    def fetch_news(window: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        start_iso = window["start_iso"]
        end_iso = window["end_iso"]
        tickers = window["tickers"]
        out: Dict[str, List[Dict[str, Any]]] = {}
        for t in tickers:
            wm_key = f"news_watermark_{t}"
            wm = env_or_var(wm_key, start_iso)
            items = list(polygon_news(ticker=t, published_gte=wm, published_lte=end_iso, limit=50))
            out[t] = items
            if items:
                last_ts = items[-1].get("published_utc")
                if last_ts:
                    Variable.set(wm_key, last_ts)
            time.sleep(0.1)
        return out

    @task
    def chunk_and_embed(all_news: Dict[str, List[Dict[str, Any]]]) -> int:
        rows_for_milvus = []
        for ticker, items in all_news.items():
            for it in items:
                title = it.get("title") or ""
                source = it.get("publisher", {}).get("name") or it.get("source", "") or ""
                url = it.get("article_url") or it.get("url") or ""
                published_utc = it.get("published_utc") or ""
                # Prefer description + body if available; fall back to title
                text = (it.get("description") or "").strip()
                if not text:
                    text = title
                chunks = chunk_text(text, max_tokens=900, overlap_tokens=120)
                if not chunks:
                    continue
                embeddings = embed_texts(chunks, model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-large"))
                for chunk, vec in zip(chunks, embeddings):
                    rows_for_milvus.append({
                        "id": str(uuid.uuid4()),
                        "ticker": ticker,
                        "published_utc": published_utc,
                        "source": source[:60],
                        "url": url[:500],
                        "title": title[:500],
                        "text": chunk[:20000],
                        "embedding": vec,
                    })
        inserted = upsert_chunks(rows_for_milvus)
        return inserted

    @task
    def refresh_index(inserted_count: int) -> str:
        ensure_milvus_connection()
        coll = Collection(COLLECTION_NAME)
        coll.load()
        return f"Collection loaded. Inserted {inserted_count} chunks."

    w = prepare_run_window()
    fetched = fetch_news(w)
    cnt = chunk_and_embed(fetched)
    _ = refresh_index(cnt)