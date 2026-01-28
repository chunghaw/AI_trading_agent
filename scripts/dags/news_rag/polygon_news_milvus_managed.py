from airflow.decorators import dag, task
from datetime import datetime, timedelta, timezone
import os, hashlib, requests
from pymilvus import connections, FieldSchema, CollectionSchema, DataType, Collection, utility
from openai import OpenAI
import psycopg2
from psycopg2.extras import RealDictCursor

# Hardcoded configuration (since no admin access for env vars)
EMB_MODEL = "text-embedding-3-small"
COLL = "polygon_news_data"  # New collection specifically for news data
RETENTION_DAYS = 90  # Keep 90 days of data for better coverage

# Popular stocks for news coverage
STOCK_TICKERS = [
    "NVDA", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "PLTR", "PDD", "IONQ", 
    "AAPL", "NFLX", "AMD", "INTC", "ORCL", "CRM", "ADBE", "PYPL", "QCOM", "MU",
    "JPM", "BAC", "GS", "WFC", "V", "MA", "JNJ", "PFE", "UNH", "XOM", "CVX"
]

# Popular ETFs for news coverage (market-moving ETFs that generate news)
ETF_TICKERS = [
    # Market Index ETFs (high news volume)
    "SPY", "QQQ", "IWM", "DIA", "VOO", "VTI", "IVV", "SPLG", "SPYI",
    # Sector ETFs (sector-specific news)
    "XLF", "XLK", "XLE", "XLV", "XLI", "XLY", "XLP",
    # International ETFs
    "VEU", "VXUS", "VAE", "VEQ",
    # Commodity & Bond ETFs (economic news)
    "GLD", "SLV", "TLT", "AGG", "USO",
    # Volatility ETFs (market sentiment news)
    "VXX", "VIXY",
    # Thematic ETFs (innovation & tech news)
    "ARKK", "ARKG", "ARKW", "ARKQ", "ICLN", "BOTZ", "CHAT", "SMH",
    # Dividend ETFs (income-focused news)
    "SCHD", "VYM", "VIG", "SDY", "NOBL",
    # Growth ETFs
    "VGT", "VTV", "QQQM", "QQQI",
    # Income ETFs
    "JEPI", "JEPQ",
    # Other Popular ETFs
    "VT", "QTUM", "MOAT", "SPMO", "RGTI", "BKLC", "VXF", "GPIX"
]

# Combine stocks and ETFs for comprehensive news coverage
BASE_TICKERS = STOCK_TICKERS + ETF_TICKERS

def get_custom_tickers_from_db():
    """Fetch user-added custom tickers from PostgreSQL database"""
    try:
        POSTGRES_URL = os.getenv("POSTGRES_URL")
        if not POSTGRES_URL:
            print("⚠️ POSTGRES_URL not set, skipping custom tickers")
            return []
        
        conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT symbol, ticker_type 
            FROM custom_tickers 
            WHERE is_active = TRUE 
            AND polygon_verified = TRUE
            ORDER BY added_at DESC
        """)
        
        custom_tickers = [row['symbol'] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        
        print(f"📊 Found {len(custom_tickers)} custom tickers in database: {custom_tickers}")
        return custom_tickers
    except Exception as e:
        print(f"⚠️ Error fetching custom tickers from database: {e}")
        print("   Continuing with base tickers only")
        return []

# Get all tickers (base + custom from database)
def get_all_tickers():
    """Get combined list of base tickers and custom tickers from database"""
    custom_tickers = get_custom_tickers_from_db()
    all_tickers = list(set(BASE_TICKERS + custom_tickers))  # Remove duplicates
    print(f"📊 Total tickers to process: {len(all_tickers)} ({len(BASE_TICKERS)} base + {len(custom_tickers)} custom)")
    return all_tickers

TICKERS = BASE_TICKERS  # Default to base tickers, will be updated in task

# API Keys - Replace with your actual keys
import os

# Load API keys from environment variables
POLYGON_API_KEY = os.getenv("POLYGON_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Milvus Configuration - Using environment variables
MILVUS_URI = os.getenv("MILVUS_URI")
MILVUS_USER = os.getenv("MILVUS_USER")
MILVUS_PASSWORD = os.getenv("MILVUS_PASSWORD")

# Validate required environment variables (only during task execution, not during parsing)
def validate_env_vars():
    """Validate that all required environment variables are set"""
    missing_vars = []
    if not POLYGON_API_KEY:
        missing_vars.append("POLYGON_API_KEY")
    if not OPENAI_API_KEY:
        missing_vars.append("OPENAI_API_KEY")
    if not MILVUS_URI:
        missing_vars.append("MILVUS_URI")
    if not MILVUS_USER:
        missing_vars.append("MILVUS_USER")
    if not MILVUS_PASSWORD:
        missing_vars.append("MILVUS_PASSWORD")
    
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

def _sha(s:str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()

def _connect():
    """Try multiple connection methods to Milvus"""
    print(f"🔗 Attempting to connect to Milvus: {MILVUS_URI}")
    
    # Disconnect any existing connections
    try:
        connections.disconnect("default")
    except:
        pass
    
    # Method 1: Try with URI format (like your working week1/week2 code)
    try:
        print("🔄 Trying Method 1: URI format with secure=True")
        connections.connect(
            alias="default",
            uri=MILVUS_URI,
            user=MILVUS_USER,
            password=MILVUS_PASSWORD,
            secure=True,
            timeout=60
        )
        print("✅ Successfully connected to Milvus (Method 1)")
        return
    except Exception as e1:
        print(f"❌ Method 1 failed: {e1}")
    
    # Method 2: Try without secure flag
    try:
        print("🔄 Trying Method 2: URI format with secure=False")
        connections.connect(
            alias="default",
            uri=MILVUS_URI,
            user=MILVUS_USER,
            password=MILVUS_PASSWORD,
            secure=False,
            timeout=60
        )
        print("✅ Successfully connected to Milvus (Method 2)")
        return
    except Exception as e2:
        print(f"❌ Method 2 failed: {e2}")
    
    # If all methods fail, raise the last error
    raise Exception(f"All connection methods failed. Last error: {e2}")

def get_collection():
    """Get or create the news collection"""
    if utility.has_collection(COLL):
        print(f"✅ Using existing collection: {COLL}")
        return Collection(COLL)
    else:
        print(f"🆕 Creating new collection: {COLL}")
        # Define schema for news data
        fields = [
            FieldSchema(name="id", dtype=DataType.VARCHAR, max_length=64, is_primary=True),
            FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=65535),
            FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1536),
            FieldSchema(name="title", dtype=DataType.VARCHAR, max_length=1000),
            FieldSchema(name="url", dtype=DataType.VARCHAR, max_length=500),
            FieldSchema(name="source", dtype=DataType.VARCHAR, max_length=200),
            FieldSchema(name="ticker", dtype=DataType.VARCHAR, max_length=10),
            FieldSchema(name="published_utc", dtype=DataType.VARCHAR, max_length=30),
            FieldSchema(name="tickers", dtype=DataType.VARCHAR, max_length=200),
            FieldSchema(name="sentiment", dtype=DataType.VARCHAR, max_length=20),
            FieldSchema(name="keywords", dtype=DataType.VARCHAR, max_length=500),
            FieldSchema(name="article_id", dtype=DataType.VARCHAR, max_length=100)
        ]
        schema = CollectionSchema(fields, description="Polygon news articles with embeddings")
        collection = Collection(COLL, schema)
        
        # Create index for vector search
        index_params = {
            "metric_type": "COSINE",
            "index_type": "IVF_FLAT",
            "params": {"nlist": 128}
        }
        collection.create_index("embedding", index_params)
        print(f"✅ Created collection {COLL} with index")
        return collection

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
    try:
        r = requests.get(url, params=params, timeout=20)
        r.raise_for_status()
        j = r.json()
        out.extend(j.get("results", []))
        # Don't paginate for now to avoid hitting limits
        return out
    except Exception as e:
        print(f"❌ Error fetching news for {ticker}: {e}")
        return []

def chunk_text(title:str, desc:str, max_chars=1500):
    txt = (title or "").strip() + "\n" + (desc or "").strip()
    txt = " ".join(txt.split())
    # simple fixed window (Polygon articles are short)
    chunks = []
    for i in range(0, len(txt), max_chars):
        chunks.append(txt[i:i+max_chars])
    return chunks or [""]

@dag(
    schedule="0 5 * * *", 
    start_date=datetime(2025,1,1), 
    catchup=False, 
    default_args={"retries":3, "retry_delay":timedelta(minutes=5)},
    description="Daily news ingestion for stocks + ETFs from Polygon API to Milvus vector database",
    tags=['trading', 'news', 'polygon', 'milvus', 'rag', 'stocks', 'etfs']
)
def polygon_news_milvus_managed():
    
    @task
    def cleanup_old_data():
        """Conditional cleanup - only clean if collection has 10,000+ records, retain 90 days"""
        try:
            # Validate environment variables first
            validate_env_vars()
            
            print(f"🧹 Starting conditional cleanup check...")
            
            _connect()
            coll = get_collection()
            coll.load()
            
            # Get current count before cleanup
            current_count = coll.num_entities
            print(f"📊 Current collection size: {current_count} records")
            
            # Only run cleanup if we have 10,000+ records to ensure smooth operation
            if current_count < 10000:
                print(f"✅ Collection has {current_count} records - skipping cleanup to preserve data")
                return f"Cleanup skipped - collection size: {current_count} (< 10,000 threshold)"
            
            print(f"🧹 Collection has {current_count} records - running cleanup to retain {RETENTION_DAYS} days")
            
            # Calculate cutoff date for 90-day retention
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
            cutoff_iso = cutoff_date.isoformat(timespec="seconds").replace("+00:00","Z")
            
            print(f"📅 Deleting data older than: {cutoff_iso} ({RETENTION_DAYS} days retention)")
            
            # Delete old records
            try:
                # Use expression to delete old records
                expr = f'published_utc < "{cutoff_iso}"'
                result = coll.delete(expr)
                coll.flush()
                
                # Get count after cleanup
                new_count = coll.num_entities
                deleted_count = current_count - new_count
                print(f"✅ Cleanup completed: deleted {deleted_count} records, remaining: {new_count}")
                
                return f"Cleanup completed - deleted {deleted_count} records, remaining: {new_count}"
                
            except Exception as e:
                print(f"❌ Error during cleanup: {e}")
                print("⚠️ Continuing with ingestion despite cleanup failure")
                # Don't raise error - let ingestion continue
                return f"Cleanup failed but continuing: {str(e)}"
            
        except ValueError as e:
            print(f"❌ Environment variable error: {e}")
            print("Please check your environment variables configuration")
            raise e
        except Exception as e:
            print(f"❌ Unexpected error during cleanup: {e}")
            print("⚠️ Continuing with ingestion despite cleanup failure")
            # Don't raise error - let ingestion continue
            return f"Cleanup failed but continuing: {str(e)}"
    
    @task
    def ingest_new_data():
        """
        Ingest new news data using UPSERT to prevent duplicates.
        
        Strategy:
        - Fetch last 7 days of news (ensures coverage even if DAG misses a day)
        - Use UPSERT instead of INSERT to handle overlapping data idempotently
        - Primary key is stable_id(url|published_utc|ticker) for deterministic deduplication
        - Continues processing even if individual tickers fail
        """
        # Validate environment variables first
        validate_env_vars()
        
        print("🚀 Starting news ingestion with UPSERT strategy...")
        
        # Get all tickers (base + custom from database)
        all_tickers = get_all_tickers()
        print(f"📊 Total tickers to process: {len(all_tickers)} ({len(STOCK_TICKERS)} base stocks + {len(ETF_TICKERS)} base ETFs + {len(all_tickers) - len(BASE_TICKERS)} custom)")
        print(f"🔍 DEBUG: Environment check - POLYGON_API_KEY: {'✅ Set' if POLYGON_API_KEY else '❌ Missing'}")
        print(f"🔍 DEBUG: Environment check - OPENAI_API_KEY: {'✅ Set' if OPENAI_API_KEY else '❌ Missing'}")
        print(f"🔍 DEBUG: Environment check - MILVUS_URI: {'✅ Set' if MILVUS_URI else '❌ Missing'}")
        
        _connect()
        coll = get_collection()
        api_key = POLYGON_API_KEY
        client = OpenAI(api_key=OPENAI_API_KEY)
        print(f"🔍 DEBUG: OpenAI client initialized successfully")

        total_upserted = 0
        date_range_tracker = {}  # Track dates of articles ingested
        ticker_summary = {}  # Track per-ticker statistics
        # Increased to 7-day lookback to ensure we catch all news even if DAG misses a day
        # UPSERT strategy handles duplicates idempotently, so wider window is safe
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=7)
        since_iso = cutoff_date.isoformat(timespec="seconds").replace("+00:00","Z")
        print(f"📅 Fetching news from: {since_iso} (last 7 days)")
        print(f"📅 Current UTC time: {datetime.now(timezone.utc).isoformat()}")
        print(f"📅 Date range: {cutoff_date.date()} to {datetime.now(timezone.utc).date()}")

        for tk in all_tickers:
            ticker_summary[tk] = {"articles_found": 0, "chunks_upserted": 0, "status": "pending"}
            print(f"📰 Processing ticker: {tk}")
            
            try:
                print(f"🔍 DEBUG: Fetching news from Polygon for {tk}...")
                rows = poly_news(tk, since_iso, api_key)
                ticker_summary[tk]["articles_found"] = len(rows)
                print(f"🔍 DEBUG: Polygon API returned {len(rows)} articles for {tk}")
                
                if not rows: 
                    print(f"⚠️ No articles found for {tk} (Polygon API returned empty)")
                    ticker_summary[tk]["status"] = "no_articles"
                    continue

                print(f"✅ Found {len(rows)} articles for {tk}")
                # Log sample article dates
                if rows:
                    sample_dates = [r.get("published_utc", "")[:10] for r in rows[:3] if r.get("published_utc")]
                    print(f"🔍 DEBUG: Sample article dates for {tk}: {sample_dates}")

                to_insert = {
                    "id":[], "text":[], "embedding":[], "title":[], "url":[], 
                    "source":[], "ticker":[], "published_utc":[], "tickers":[], 
                    "sentiment":[], "keywords":[], "article_id":[]
                }

                for article in rows:
                    # Track article dates
                    pub_date = article.get("published_utc", "")
                    if pub_date:
                        date_key = pub_date[:10]  # YYYY-MM-DD
                        date_range_tracker[date_key] = date_range_tracker.get(date_key, 0) + 1
                    
                    chunks = chunk_text(article.get("title", ""), article.get("description", ""))
                    
                    for chunk in chunks:
                        if not chunk.strip(): continue
                        
                        try:
                            # Debug: Log embedding generation
                            chunk_preview = chunk[:50] + "..." if len(chunk) > 50 else chunk
                            print(f"🔍 DEBUG: Generating embedding for {tk} chunk: {chunk_preview}")
                            
                            response = client.embeddings.create(
                                model=EMB_MODEL,
                                input=chunk
                            )
                            embedding = response.data[0].embedding
                            print(f"🔍 DEBUG: Embedding generated successfully (dim={len(embedding)})")
                            
                            # Get sentiment for this specific ticker
                            sentiment = "neutral"
                            for insight in article.get("insights", []):
                                if insight.get("ticker") == tk:
                                    sentiment = insight.get("sentiment", "neutral")
                                    break
                            
                            rec_id = stable_id(article.get("article_url", ""), article.get("published_utc", ""), tk)
                            
                            to_insert["id"].append(str(rec_id))
                            to_insert["text"].append(str(chunk))
                            to_insert["embedding"].append(embedding)
                            to_insert["title"].append(str(article.get("title", "") or ""))
                            to_insert["url"].append(str(article.get("article_url", "") or ""))
                            to_insert["source"].append(str(article.get("publisher", {}).get("name", "") or ""))
                            to_insert["ticker"].append(str(tk))
                            to_insert["published_utc"].append(str(article.get("published_utc", "") or ""))
                            # Truncate tickers to max 200 chars to match Milvus schema
                            tickers_str = ",".join(article.get("tickers", []) or [])
                            to_insert["tickers"].append(str(tickers_str[:200]))
                            to_insert["sentiment"].append(str(sentiment))
                            to_insert["keywords"].append(str(",".join(article.get("keywords", []) or [])))
                            to_insert["article_id"].append(str(article.get("id", "") or ""))
                            
                            total_upserted += 1
                            
                        except Exception as e:
                            print(f"❌ Error processing chunk for {tk}: {e}")
                            print(f"🔍 DEBUG: Chunk error details - {type(e).__name__}: {str(e)}")
                            import traceback
                            print(f"🔍 DEBUG: Stack trace:\n{traceback.format_exc()}")
                            continue

                if to_insert["id"]:
                    try:
                        # Convert to working format
                        records = []
                        for i in range(len(to_insert["id"])):
                            record = {
                                "id": to_insert["id"][i],
                                "text": to_insert["text"][i],
                                "embedding": to_insert["embedding"][i],
                                "title": to_insert["title"][i],
                                "url": to_insert["url"][i],
                                "source": to_insert["source"][i],
                                "ticker": to_insert["ticker"][i],
                                "published_utc": to_insert["published_utc"][i],
                                "tickers": to_insert["tickers"][i],
                                "sentiment": to_insert["sentiment"][i],
                                "keywords": to_insert["keywords"][i],
                                "article_id": to_insert["article_id"][i]
                            }
                            records.append(record)
                        
                        print(f"💾 Upserting {len(records)} records for {tk}...")
                        print(f"🔍 DEBUG: Record sample for {tk} - First record ID: {records[0]['id'] if records else 'N/A'}")
                        print(f"🔍 DEBUG: Record sample - Ticker: {records[0].get('ticker', 'N/A') if records else 'N/A'}")
                        print(f"🔍 DEBUG: Record sample - Published: {records[0].get('published_utc', 'N/A')[:10] if records and records[0].get('published_utc') else 'N/A'}")
                        
                        coll.upsert(records)
                        print(f"🔍 DEBUG: Upsert call completed for {tk}, flushing...")
                        coll.flush()
                        print(f"🔍 DEBUG: Flush completed for {tk}")
                        
                        upserted_count = len(records)
                        print(f"✅ Successfully upserted {upserted_count} records for {tk}")
                        ticker_summary[tk]["chunks_upserted"] = upserted_count
                        ticker_summary[tk]["status"] = "success"
                        
                    except Exception as insert_error:
                        print(f"❌ Failed to insert records for {tk}: {insert_error}")
                        print(f"   Attempted to insert {len(to_insert['id'])} records")
                        print(f"🔍 DEBUG: Insert error type: {type(insert_error).__name__}")
                        print(f"🔍 DEBUG: Insert error details: {str(insert_error)}")
                        import traceback
                        print(f"🔍 DEBUG: Insert error stack trace:\n{traceback.format_exc()}")
                        ticker_summary[tk]["status"] = "insert_failed"
                        ticker_summary[tk]["error_message"] = str(insert_error)
                        # Continue with other tickers instead of failing completely
                        continue
                else:
                    print(f"⚠️ No data to insert for {tk}")
                    ticker_summary[tk]["status"] = "no_data"

            except Exception as e:
                print(f"❌ Error processing ticker {tk}: {e}")
                print(f"🔍 DEBUG: Ticker error type: {type(e).__name__}")
                print(f"🔍 DEBUG: Ticker error details: {str(e)}")
                import traceback
                print(f"🔍 DEBUG: Ticker error stack trace:\n{traceback.format_exc()}")
                ticker_summary[tk]["status"] = "error"
                ticker_summary[tk]["error_message"] = str(e)
                continue

        print(f"🎉 Ingestion complete! Total records upserted: {total_upserted}")
        
        # Print per-ticker summary
        print(f"\n📊 Per-Ticker Summary:")
        success_count = sum(1 for s in ticker_summary.values() if s["status"] == "success")
        error_count = sum(1 for s in ticker_summary.values() if s["status"] in ["error", "insert_failed"])
        no_articles_count = sum(1 for s in ticker_summary.values() if s["status"] == "no_articles")
        
        print(f"   ✅ Success: {success_count} tickers")
        print(f"   ⚠️  No articles: {no_articles_count} tickers")
        print(f"   ❌ Errors: {error_count} tickers")
        
        # Show top tickers by article count
        top_tickers = sorted(
            [(tk, stats) for tk, stats in ticker_summary.items() if stats["articles_found"] > 0],
            key=lambda x: x[1]["articles_found"],
            reverse=True
        )[:10]
        
        if top_tickers:
            print(f"\n📈 Top tickers by article count:")
            for tk, stats in top_tickers:
                print(f"   {tk}: {stats['articles_found']} articles, {stats['chunks_upserted']} chunks")
        
        # Show tickers with errors
        error_tickers = [(tk, stats) for tk, stats in ticker_summary.items() if stats["status"] in ["error", "insert_failed"]]
        if error_tickers:
            print(f"\n❌ Tickers with errors:")
            for tk, stats in error_tickers:
                error_msg = stats.get("error_message", "Unknown error")
                print(f"   {tk}: {stats['status']} - {error_msg}")
        
        # Detailed per-ticker breakdown
        print(f"\n📋 Detailed Per-Ticker Breakdown:")
        for tk in sorted(ticker_summary.keys()):
            stats = ticker_summary[tk]
            status_icon = "✅" if stats["status"] == "success" else "⚠️" if stats["status"] == "no_articles" else "❌"
            print(f"   {status_icon} {tk}: {stats['articles_found']} articles found, {stats['chunks_upserted']} chunks upserted, status: {stats['status']}")
        
        # Print date distribution summary
        if date_range_tracker:
            sorted_dates = sorted(date_range_tracker.keys(), reverse=True)
            print(f"\n📅 Articles ingested by date:")
            for date in sorted_dates[:10]:  # Show top 10 dates
                print(f"   {date}: {date_range_tracker[date]} articles")
            if len(sorted_dates) > 10:
                print(f"   ... and {len(sorted_dates) - 10} more dates")
            print(f"\n📅 Latest article date: {sorted_dates[0]}")
            print(f"📅 Oldest article date: {sorted_dates[-1]}")
        else:
            print("⚠️  No articles were ingested - check API responses and date filters")
        
        return f"Successfully processed {total_upserted} news records (upsert mode)"
    
    @task
    def get_stats():
        """Get collection statistics"""
        # Validate environment variables first
        validate_env_vars()
        
        print("📊 Getting collection statistics...")
        
        _connect()
        coll = get_collection()
        coll.load()
        
        try:
            # Get total count
            total_count = coll.num_entities
            print(f"📈 Total records in collection: {total_count}")
            
            return {"total_records": total_count}
            
        except Exception as e:
            print(f"❌ Error getting stats: {e}")
            return {"error": str(e)}

    # Task dependencies
    cleanup_task = cleanup_old_data()
    ingest_task = ingest_new_data()
    stats_task = get_stats()
    
    # Run cleanup first, then ingest, then get stats
    cleanup_task >> ingest_task >> stats_task

dag = polygon_news_milvus_managed()
