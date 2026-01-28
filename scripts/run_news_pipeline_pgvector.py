#!/usr/bin/env python3
"""Standalone News Pipeline using pgvector (Postgres) instead of Milvus"""
import os
import sys
import logging
from datetime import datetime, timedelta, timezone
import hashlib
import requests
import psycopg2
from psycopg2.extras import execute_values
from openai import OpenAI

# Try to load .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    # Try multiple locations for .env file (later files override earlier ones)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    load_dotenv(os.path.join(root_dir, '.env'), override=False)  # Root .env
    load_dotenv(os.path.join(script_dir, '.env'), override=True)  # scripts/.env (override if exists)
    load_dotenv(os.path.join(root_dir, 'apps', 'web', '.env.local'), override=True)  # apps/web/.env.local (override)
except ImportError:
    pass  # dotenv not installed, use environment variables directly

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Configuration
EMB_MODEL = "text-embedding-3-small"
RETENTION_DAYS = 90

# Popular stocks and ETFs (same as original)
STOCK_TICKERS = [
    "NVDA", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "PLTR", "PDD", "IONQ", 
    "AAPL", "NFLX", "AMD", "INTC", "ORCL", "CRM", "ADBE", "PYPL", "QCOM", "MU",
    "JPM", "BAC", "GS", "WFC", "V", "MA", "JNJ", "PFE", "UNH", "XOM", "CVX"
]

ETF_TICKERS = [
    "SPY", "QQQ", "IWM", "DIA", "VOO", "VTI", "IVV", "SPLG", "SPYI",
    "XLF", "XLK", "XLE", "XLV", "XLI", "XLY", "XLP",
    "VEU", "VXUS", "VAE", "VEQ",
    "GLD", "SLV", "TLT", "AGG", "USO",
    "VXX", "VIXY",
    "ARKK", "ARKG", "ARKW", "ARKQ", "ICLN", "BOTZ", "CHAT", "SMH",
    "SCHD", "VYM", "VIG", "SDY", "NOBL",
    "VGT", "VTV", "QQQM", "QQQI",
    "JEPI", "JEPQ",
    "VT", "QTUM", "MOAT", "SPMO", "RGTI", "BKLC", "VXF", "GPIX"
]

BASE_TICKERS = STOCK_TICKERS + ETF_TICKERS

def get_custom_tickers_from_db():
    """Fetch user-added custom tickers from PostgreSQL database"""
    try:
        POSTGRES_URL = os.getenv("POSTGRES_URL")
        if not POSTGRES_URL:
            logging.warning("POSTGRES_URL not set, skipping custom tickers")
            return []
        
        conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT symbol 
            FROM custom_tickers 
            WHERE is_active = TRUE 
            AND polygon_verified = TRUE
            ORDER BY added_at DESC
        """)
        
        custom_tickers = [row[0] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        
        logging.info(f"Found {len(custom_tickers)} custom tickers: {custom_tickers}")
        return custom_tickers
    except Exception as e:
        logging.warning(f"Error fetching custom tickers: {e}")
        return []

def get_all_tickers():
    """Get combined list of base tickers and custom tickers"""
    custom_tickers = get_custom_tickers_from_db()
    all_tickers = list(set(BASE_TICKERS + custom_tickers))
    logging.info(f"Total tickers: {len(all_tickers)} ({len(BASE_TICKERS)} base + {len(custom_tickers)} custom)")
    return all_tickers

def _sha(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()

def stable_id(url: str, published_utc: str, ticker: str):
    base = f"{url}|{published_utc}|{ticker.upper()}"
    return _sha(base)

def poly_news(ticker: str, since_iso: str, api_key: str):
    """Fetch news from Polygon API"""
    url = "https://api.polygon.io/v2/reference/news"
    params = {
        "ticker": ticker,
        "order": "asc",
        "sort": "published_utc",
        "limit": 50,
        "published_utc.gte": since_iso,
        "apiKey": api_key
    }
    try:
        r = requests.get(url, params=params, timeout=20)
        r.raise_for_status()
        j = r.json()
        return j.get("results", [])
    except Exception as e:
        logging.error(f"Error fetching news for {ticker}: {e}")
        return []

def chunk_text(title: str, desc: str, max_chars=1500):
    """Simple text chunking"""
    txt = (title or "").strip() + "\n" + (desc or "").strip()
    txt = " ".join(txt.split())
    chunks = []
    for i in range(0, len(txt), max_chars):
        chunks.append(txt[i:i+max_chars])
    return chunks or [""]

def ensure_table_exists(conn):
    """Ensure news_articles table exists with pgvector"""
    cursor = conn.cursor()
    try:
        # Enable extension
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        conn.commit()
        
        # Create table (idempotent)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS news_articles (
                id VARCHAR(64) PRIMARY KEY,
                title VARCHAR(1000) NOT NULL,
                text TEXT NOT NULL,
                url VARCHAR(500) NOT NULL,
                source VARCHAR(200),
                ticker VARCHAR(10) NOT NULL,
                tickers VARCHAR(200),
                published_utc TIMESTAMP WITH TIME ZONE NOT NULL,
                sentiment VARCHAR(20),
                keywords VARCHAR(500),
                article_id VARCHAR(100),
                embedding vector(1536),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create indexes if not exist
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_news_ticker ON news_articles(ticker);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_utc DESC);")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_news_embedding 
            ON news_articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
        """)
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_news_unique ON news_articles(url, published_utc, ticker);")
        
        conn.commit()
        logging.info("✅ News table and indexes created/verified")
    except Exception as e:
        conn.rollback()
        logging.error(f"Error creating table: {e}")
        raise
    finally:
        cursor.close()

def cleanup_old_data(conn):
    """Remove news older than retention period"""
    try:
        cursor = conn.cursor()
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
        
        cursor.execute("""
            DELETE FROM news_articles 
            WHERE published_utc < %s
        """, (cutoff_date,))
        
        deleted = cursor.rowcount
        conn.commit()
        cursor.close()
        
        logging.info(f"✅ Cleaned up {deleted} old news articles")
        return deleted
    except Exception as e:
        logging.error(f"Error cleaning up old data: {e}")
        conn.rollback()
        return 0

def ingest_new_data(conn, client):
    """Ingest new news articles into Postgres"""
    POSTGRES_URL = os.getenv("POSTGRES_URL")
    POLYGON_API_KEY = os.getenv("POLYGON_API_KEY")
    
    if not POLYGON_API_KEY:
        raise ValueError("POLYGON_API_KEY not set")
    
    all_tickers = get_all_tickers()
    logging.info(f"Processing {len(all_tickers)} tickers")
    
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=7)
    since_iso = cutoff_date.isoformat(timespec="seconds").replace("+00:00", "Z")
    
    total_inserted = 0
    cursor = conn.cursor()
    
    for ticker in all_tickers:
        try:
            articles = poly_news(ticker, since_iso, POLYGON_API_KEY)
            if not articles:
                continue
            
            records = []
            for article in articles:
                chunks = chunk_text(article.get("title", ""), article.get("description", ""))
                
                for chunk in chunks:
                    if not chunk.strip():
                        continue
                    
                    try:
                        # Generate embedding
                        response = client.embeddings.create(
                            model=EMB_MODEL,
                            input=chunk
                        )
                        embedding = response.data[0].embedding
                    except Exception as embed_error:
                        # If API key error, stop processing this ticker and log clearly
                        if "401" in str(embed_error) or "invalid_api_key" in str(embed_error).lower():
                            logging.error(f"❌ OpenAI API key error for {ticker}. Stopping processing.")
                            logging.error(f"💡 Please check your OPENAI_API_KEY in .env file")
                            raise  # Re-raise to stop the whole pipeline
                        else:
                            logging.error(f"Error generating embedding for {ticker}: {embed_error}")
                            continue
                    
                    # Get sentiment
                    sentiment = "neutral"
                    for insight in article.get("insights", []):
                        if insight.get("ticker") == ticker:
                            sentiment = insight.get("sentiment", "neutral")
                            break
                    
                    rec_id = stable_id(
                        article.get("article_url", ""),
                        article.get("published_utc", ""),
                        ticker
                    )
                    
                    # Parse published_utc to timestamp
                    pub_utc = article.get("published_utc", "")
                    try:
                        pub_timestamp = datetime.fromisoformat(pub_utc.replace("Z", "+00:00"))
                    except:
                        pub_timestamp = datetime.now(timezone.utc)
                    
                    # Convert embedding to pgvector format string
                    embedding_str = "[" + ",".join(map(str, embedding)) + "]"
                    
                    records.append((
                        rec_id,
                        article.get("title", "")[:1000],
                        chunk,
                        article.get("article_url", "")[:500],
                        article.get("publisher", {}).get("name", "")[:200] if article.get("publisher") else None,
                        ticker,
                        ",".join(article.get("tickers", []))[:200] if article.get("tickers") else None,
                        pub_timestamp,
                        sentiment[:20] if sentiment else None,
                        ",".join(article.get("keywords", []))[:500] if article.get("keywords") else None,
                        str(article.get("id", ""))[:100] if article.get("id") else None,
                        embedding_str  # pgvector format: '[0.1, 0.2, ...]'
                    ))
                except Exception as e:
                    logging.error(f"Error processing chunk for {ticker}: {e}")
                    continue
            
            if records:
                # Insert records one by one to handle vector type properly
                for record in records:
                    try:
                        cursor.execute("""
                            INSERT INTO news_articles 
                            (id, title, text, url, source, ticker, tickers, published_utc, sentiment, keywords, article_id, embedding)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::vector)
                            ON CONFLICT (id) DO UPDATE SET
                                updated_at = CURRENT_TIMESTAMP
                        """, record)
                        total_inserted += 1
                    except Exception as insert_error:
                        logging.error(f"Error inserting record for {ticker}: {insert_error}")
                        continue
                
                # Commit after each ticker to avoid long transactions
                conn.commit()
                logging.info(f"✅ {ticker}: Inserted {len(records)} news chunks")
            
        except Exception as e:
            logging.error(f"Error processing {ticker}: {e}")
            conn.rollback()  # Rollback on error
            continue
    
    cursor.close()
    logging.info(f"✅ Total inserted: {total_inserted} news chunks")
    return total_inserted

def get_stats(conn):
    """Get collection statistics"""
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM news_articles")
    count = cursor.fetchone()[0]
    cursor.close()
    logging.info(f"📊 Total news articles: {count}")
    return {"total_records": count}

def main():
    logging.info("🚀 Starting News Pipeline (pgvector)")
    
    POSTGRES_URL = os.getenv("POSTGRES_URL")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    POLYGON_API_KEY = os.getenv("POLYGON_API_KEY")
    
    # Debug: Show which POSTGRES_URL is being used (mask password)
    if POSTGRES_URL:
        masked_url = POSTGRES_URL.split('@')[1] if '@' in POSTGRES_URL else POSTGRES_URL[:50]
        logging.info(f"🔍 Using POSTGRES_URL: ...@{masked_url}")
    else:
        logging.error("❌ POSTGRES_URL not found in environment")
        logging.info("💡 Check if .env file exists and contains POSTGRES_URL")
        logging.info("💡 Or export POSTGRES_URL in your shell")
    
    if not POSTGRES_URL:
        raise ValueError("POSTGRES_URL not set")
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not set")
    if not POLYGON_API_KEY:
        raise ValueError("POLYGON_API_KEY not set")
    
    # Test OpenAI API key before starting
    logging.info("🔍 Validating OpenAI API key...")
    try:
        test_client = OpenAI(api_key=OPENAI_API_KEY)
        test_response = test_client.embeddings.create(
            model=EMB_MODEL,
            input="test"
        )
        logging.info("✅ OpenAI API key is valid")
    except Exception as e:
        logging.error(f"❌ OpenAI API key validation failed: {e}")
        logging.error("💡 Please update OPENAI_API_KEY in your .env file")
        logging.error("💡 Get a new key from: https://platform.openai.com/account/api-keys")
        raise ValueError(f"Invalid OpenAI API key: {e}")
    
    try:
        conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
        client = OpenAI(api_key=OPENAI_API_KEY)
        
        # Ensure table exists
        ensure_table_exists(conn)
        
        # Cleanup old data
        cleanup_old_data(conn)
        
        # Ingest new data
        ingest_new_data(conn, client)
        conn.close()  # Close connection after ingestion
        
        # Get stats with fresh connection (connection may have timed out)
        stats_conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
        try:
            get_stats(stats_conn)
        finally:
            stats_conn.close()
        
        logging.info("🎉 Pipeline completed!")
    except Exception as e:
        logging.error(f"❌ Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
