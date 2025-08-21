import os
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import requests
from pymilvus import connections, Collection, CollectionSchema, FieldSchema, DataType, utility
from openai import OpenAI
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.models import Variable
import tiktoken
from airflow.decorators import dag, task

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
POLYGON_API_KEY = os.getenv("POLYGON_API_KEY")
NEWS_TICKERS = os.getenv("NEWS_TICKERS", "NVDA,AMD,MSFT").split(",")
NEWS_TTL_DAYS = int(os.getenv("NEWS_TTL_DAYS", "120"))
MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
MILVUS_PORT = os.getenv("MILVUS_PORT", "19530")
MILVUS_SSL = os.getenv("MILVUS_SSL", "false").lower() == "true"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MILVUS_COLLECTION_NEWS = os.getenv("MILVUS_COLLECTION_NEWS", "news_chunks")

# Initialize OpenAI client
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Tokenizer for chunking
tokenizer = tiktoken.encoding_for_model("text-embedding-3-small")

EMB_MODEL = "text-embedding-3-small"
COLL = os.getenv("MILVUS_COLLECTION_NEWS", "news_chunks")
TTL_DAYS = int(os.getenv("NEWS_TTL_DAYS", "180"))
TICKERS = [t.strip().upper() for t in os.getenv("NEWS_TICKERS","NVDA").split(",")]

def _sha(s:str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()

def _connect():
    connections.connect(
        alias="default",
        host=(os.getenv("MILVUS_ADDRESS","localhost:19530").split(":")[0]),
        port=(os.getenv("MILVUS_ADDRESS","localhost:19530").split(":")[1]),
        secure=os.getenv("MILVUS_SSL","false")=="true",
        user=os.getenv("MILVUS_USERNAME",""),
        password=os.getenv("MILVUS_PASSWORD",""),
    )

def ensure_collection():
    if utility.has_collection(COLL):
        return Collection(COLL)
    fields = [
        FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=64, auto_id=False),
        FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=65535),
        FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1536),
        FieldSchema(name="title", dtype=DataType.VARCHAR, max_length=1024),
        FieldSchema(name="url", dtype=DataType.VARCHAR, max_length=1024),
        FieldSchema(name="source", dtype=DataType.VARCHAR, max_length=256),
        FieldSchema(name="ticker", dtype=DataType.VARCHAR, max_length=16),
        FieldSchema(name="published_utc", dtype=DataType.VARCHAR, max_length=64),
    ]
    schema = CollectionSchema(fields, description="Polygon news chunks")
    coll = Collection(COLL, schema=schema)
    coll.create_index("embedding", {"index_type":"HNSW","metric_type":"COSINE","params":{"M":16,"efConstruction":200}})
    return coll

def month_partition_name(dt: datetime):
    return f"p_{dt.strftime('%Y_%m')}"

def ensure_partition(coll: Collection, name: str):
    if name not in [p.name for p in coll.partitions]:
        coll.create_partition(name)

def stable_id(url:str, published_utc:str, ticker:str):
    base = f"{url}|{published_utc}|{ticker.upper()}"
    return _sha(base)

def poly_news(ticker:str, since_iso:str, api_key:str):
    url = "https://api.polygon.io/v2/reference/news"
    params = {
        "ticker": ticker,
        "order": "asc",
        "sort": "published_utc",
        "limit": 50,
        "published_utc.gte": since_iso,
        "apiKey": api_key
    }
    out = []
    while True:
        r = requests.get(url, params=params, timeout=20)
        r.raise_for_status()
        j = r.json()
        out.extend(j.get("results", []))
        if not j.get("next_url"): break
        url = j["next_url"]
        params = {}  # next_url already has params
    return out

def chunk_text(title:str, desc:str, max_chars=1500):
    txt = (title or "").strip() + "\n" + (desc or "").strip()
    txt = " ".join(txt.split())
    # simple fixed window (Polygon articles are short)
    chunks = []
    for i in range(0, len(txt), max_chars):
        chunks.append(txt[i:i+max_chars])
    return chunks or [""]

@dag(schedule="0 6 * * *", start_date=datetime(2025,1,1), catchup=False, default_args={"retries":1})
def polygon_news_to_milvus():
    @task
    def ingest():
        _connect()
        coll = ensure_collection()
        api_key = os.environ["POLYGON_API_KEY"]

        total_inserted = 0
        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

        for tk in TICKERS:
            wm_key = f"news_watermark_{tk}"
            from airflow.models import Variable
            since_iso = Variable.get(wm_key, default_var=(datetime.now(timezone.utc)-timedelta(days=TTL_DAYS)).isoformat(timespec="seconds").replace("+00:00","Z"))

            rows = poly_news(tk, since_iso, api_key)
            if not rows: continue

            part = month_partition_name(datetime.now(timezone.utc))
            ensure_partition(coll, part)

            to_insert = {"id":[],"text":[],"embedding":[],"title":[],"url":[],"source":[],"ticker":[],"published_utc":[]}
            latest_iso = since_iso

            for it in rows:
                title = it.get("title") or ""
                desc  = it.get("description") or ""
                url   = it.get("article_url") or it.get("url") or ""
                pub   = it.get("published_utc") or ""
                src   = (it.get("publisher") or {}).get("name") or "Polygon"
                tick  = (it.get("tickers") or [tk])[0]

                latest_iso = max(latest_iso, pub) if pub else latest_iso

                for chunk in chunk_text(title, desc):
                    sid = stable_id(url, pub, tick)
                    emb = client.embeddings.create(model=EMB_MODEL, input=chunk).data[0].embedding
                    to_insert["id"].append(sid)
                    to_insert["text"].append(chunk)
                    to_insert["embedding"].append(emb)
                    to_insert["title"].append(title[:1024])
                    to_insert["url"].append(url[:1024])
                    to_insert["source"].append(src[:256])
                    to_insert["ticker"].append(tick[:16])
                    to_insert["published_utc"].append(pub[:64])

            if to_insert["id"]:
                coll.insert(to_insert, partition_name=part)
                total_inserted += len(to_insert["id"])
                # watermark
                from airflow.models import Variable
                Variable.set(wm_key, latest_iso)

        # TTL prune + compact
        cutoff = (datetime.now(timezone.utc) - timedelta(days=TTL_DAYS)).isoformat(timespec="seconds").replace("+00:00","Z")
        coll.delete(expr=f'published_utc < "{cutoff}"')
        utility.compact(coll.name)
        return total_inserted

    ingest()

dag = polygon_news_to_milvus()
