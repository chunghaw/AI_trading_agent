#!/usr/bin/env python3
"""
Initial Historical Data Load Script
Fetches 200 days of historical data for proper MACD/technical indicator calculation
Run this ONCE before regular pipeline runs
"""
import os
import sys
import logging
from datetime import datetime, date, timedelta, timezone
import requests
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from sqlalchemy import create_engine, text

# Try to load .env file
try:
    from dotenv import load_dotenv
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    env_files = [
        os.path.join(root_dir, '.env'),
        os.path.join(script_dir, '.env'),
        os.path.join(root_dir, 'apps', 'web', '.env.local')
    ]
    for env_file in env_files:
        if os.path.exists(env_file):
            load_dotenv(env_file, override=True)
            logging.debug(f"Loaded .env from: {env_file}")
except ImportError:
    logging.warning("python-dotenv not installed, using environment variables only")
    logging.warning("Install with: pip install python-dotenv")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

POSTGRES_URL = os.getenv("POSTGRES_URL")
POLYGON_API_KEY = os.getenv("POLYGON_API_KEY")
HISTORICAL_DAYS = 200  # 200 days for proper MACD calculation (needs 26+ days minimum)

def fetch_ticker_historical(symbol: str, start_date: str, end_date: str, api_key: str, max_retries=3):
    """Fetch historical OHLCV data from Polygon API with retry logic"""
    url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/range/1/day/{start_date}/{end_date}"
    params = {
        'adjusted': 'true',
        'sort': 'asc',
        'limit': 50000,
        'apiKey': api_key
    }
    
    for attempt in range(max_retries):
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            results = data.get('results', [])
            
            # Check for rate limiting
            if response.status_code == 429:
                wait_time = 60 * (attempt + 1)  # Exponential backoff
                logging.warning(f"Rate limited for {symbol}, waiting {wait_time}s...")
                import time
                time.sleep(wait_time)
                continue
            
            return results
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff
                logging.warning(f"Error fetching {symbol} (attempt {attempt + 1}/{max_retries}): {e}, retrying in {wait_time}s...")
                import time
                time.sleep(wait_time)
            else:
                logging.error(f"Error fetching {symbol} after {max_retries} attempts: {e}")
                return []
    
    return []

def load_to_bronze(conn, df: pd.DataFrame):
    """Load data into bronze_ohlcv table - commits after each load"""
    if df.empty:
        return
    
    cursor = conn.cursor()
    
    try:
        # Prepare data for insert (match DAG schema - volume is DECIMAL, not BIGINT)
        records = []
        for _, row in df.iterrows():
            # Ensure timestamp is valid - it's required (NOT NULL)
            if pd.isna(row['timestamp']):
                logging.warning(f"Skipping row with null timestamp for {row.get('symbol', 'unknown')}")
                continue
            
            # Convert timestamp to timezone-aware datetime
            try:
                if isinstance(row['timestamp'], pd.Timestamp):
                    ts = row['timestamp'].to_pydatetime()
                else:
                    ts = pd.to_datetime(row['timestamp']).to_pydatetime()
                
                # Ensure timezone-aware
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
            except Exception as ts_error:
                logging.warning(f"Skipping row with invalid timestamp for {row.get('symbol', 'unknown')}: {ts_error}")
                continue
            
            # Validate date
            if pd.isna(row['date']):
                logging.warning(f"Skipping row with null date for {row.get('symbol', 'unknown')}")
                continue
            
            records.append((
                str(row['symbol']),
                ts,  # timestamp (required, NOT NULL)
                row['date'],
                float(row['open']) if pd.notna(row['open']) else None,
                float(row['high']) if pd.notna(row['high']) else None,
                float(row['low']) if pd.notna(row['low']) else None,
                float(row['close']) if pd.notna(row['close']) else None,
                float(row['volume']) if pd.notna(row['volume']) else None,  # DECIMAL, not int
                float(row['vwap']) if pd.notna(row.get('vwap')) else None,
                int(row['transactions']) if pd.notna(row.get('transactions')) else None,
                datetime.now(timezone.utc)  # ingestion_time
            ))
        
        if not records:
            logging.warning("No valid records to insert after validation")
            return
        
        # Insert with ON CONFLICT to handle duplicates (match DAG schema)
        execute_values(
            cursor,
            """
            INSERT INTO bronze_ohlcv 
            (symbol, timestamp, date, open, high, low, close, volume, vwap, transactions, ingestion_time)
            VALUES %s
            ON CONFLICT (symbol, date) DO UPDATE SET
                timestamp = EXCLUDED.timestamp,
                open = EXCLUDED.open,
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                close = EXCLUDED.close,
                volume = EXCLUDED.volume,
                vwap = EXCLUDED.vwap,
                transactions = EXCLUDED.transactions,
                ingestion_time = EXCLUDED.ingestion_time
            """,
            records,
            page_size=1000
        )
        
        conn.commit()
        logging.info(f"✅ Loaded {len(records)} records to bronze_ohlcv")
        
        # Verify data was actually inserted
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM bronze_ohlcv WHERE symbol = %s", (records[0][0],))
        count = cursor.fetchone()[0]
        cursor.close()
        logging.info(f"   Verified: {records[0][0]} now has {count} total records in bronze")
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        if not cursor.closed:
            cursor.close()

def main():
    logging.info(f"🚀 Starting Historical Data Load ({HISTORICAL_DAYS} days)")
    
    # Debug: Show which env vars are loaded
    logging.info(f"🔍 POSTGRES_URL: {'✅ Set' if POSTGRES_URL else '❌ Not set'}")
    logging.info(f"🔍 POLYGON_API_KEY: {'✅ Set' if POLYGON_API_KEY else '❌ Not set'}")
    
    if not POSTGRES_URL:
        logging.error("💡 Set POSTGRES_URL in .env file or export it")
        raise ValueError("POSTGRES_URL not set")
    if not POLYGON_API_KEY:
        logging.error("💡 Set POLYGON_API_KEY in .env file or export it")
        logging.error("💡 Checked locations: .env (root), scripts/.env, apps/web/.env.local")
        raise ValueError("POLYGON_API_KEY not set")
    
    # Calculate date range
    end_date = date.today() - timedelta(days=1)  # Yesterday
    start_date = end_date - timedelta(days=HISTORICAL_DAYS)
    
    logging.info(f"📅 Date range: {start_date} to {end_date} ({HISTORICAL_DAYS} days)")
    
    # Get tickers (same as regular pipeline)
    dag_path = os.path.join(os.path.dirname(__file__), 'dags', 'trading')
    sys.path.insert(0, dag_path)
    
    try:
        from polygon_ohlcv_dag import polygon_ohlcv_dag
        
        # Get DAG instance
        if hasattr(polygon_ohlcv_dag, 'task_dict'):
            dag = polygon_ohlcv_dag
        else:
            dag = polygon_ohlcv_dag()
        
        # Get tickers
        get_tickers_task = dag.task_dict.get('get_all_tickers')
        if not get_tickers_task:
            raise ValueError("get_all_tickers task not found")
        
        # Extract function
        if hasattr(get_tickers_task, 'function'):
            get_tickers_fn = get_tickers_task.function
        elif hasattr(get_tickers_task, 'python_callable'):
            get_tickers_fn = get_tickers_task.python_callable
        else:
            raise ValueError("Cannot extract get_all_tickers function")
        
        tickers = get_tickers_fn()
        logging.info(f"📊 Processing {len(tickers)} tickers")
        
        # Connect to database - use separate connection per ticker to avoid transaction issues
        engine = create_engine(POSTGRES_URL)
        
        # Ensure bronze table exists (match DAG schema exactly)
        with engine.begin() as db_conn:
            db_conn.execute(text("""
                CREATE TABLE IF NOT EXISTS bronze_ohlcv (
                    id SERIAL PRIMARY KEY,
                    symbol VARCHAR(20) NOT NULL,
                    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
                    date DATE NOT NULL,
                    open DECIMAL(20, 8),
                    high DECIMAL(20, 8),
                    low DECIMAL(20, 8),
                    close DECIMAL(20, 8),
                    volume DECIMAL(20, 8),
                    vwap DECIMAL(20, 8),
                    transactions INTEGER,
                    ingestion_time TIMESTAMP WITH TIME ZONE,
                    UNIQUE(symbol, date)
                );
            """))
            logging.info("✅ Bronze table verified")
        
        # Fetch and load data for each ticker
        total_loaded = 0
        failed = []
        
        for i, ticker in enumerate(tickers, 1):
            try:
                logging.info(f"[{i}/{len(tickers)}] Fetching {ticker}...")
                
                # Fetch data
                results = fetch_ticker_historical(
                    ticker,
                    start_date.strftime('%Y-%m-%d'),
                    end_date.strftime('%Y-%m-%d'),
                    POLYGON_API_KEY
                )
                
                if not results:
                    logging.warning(f"⚠️  No data for {ticker}")
                    failed.append(ticker)
                    continue
                
                # Debug: Show how many results we got
                logging.info(f"   API returned {len(results)} days for {ticker}")
                
                # Convert to DataFrame
                df = pd.DataFrame(results)
                if df.empty:
                    logging.warning(f"⚠️  {ticker}: Empty DataFrame from API")
                    failed.append(ticker)
                    continue
                
                df['symbol'] = ticker
                
                # Convert timestamp from milliseconds to datetime (Polygon API uses 't' field)
                if 't' in df.columns:
                    df['timestamp'] = pd.to_datetime(df['t'], unit='ms', errors='coerce')
                else:
                    logging.warning(f"⚠️  {ticker}: No 't' field in API response")
                    failed.append(ticker)
                    continue
                
                # Extract date from timestamp
                df['date'] = df['timestamp'].dt.date
                df['ingestion_time'] = datetime.now(timezone.utc)
                
                # Rename columns
                df = df.rename(columns={
                    'o': 'open',
                    'h': 'high',
                    'l': 'low',
                    'c': 'close',
                    'v': 'volume',
                    'vw': 'vwap',
                    'n': 'transactions'
                })
                
                # Select and clean (include timestamp for schema)
                df = df[['symbol', 'timestamp', 'date', 'open', 'high', 'low', 'close', 'volume', 'vwap', 'transactions', 'ingestion_time']]
                
                # Remove rows with null timestamp (required field)
                df = df.dropna(subset=['timestamp', 'open', 'high', 'low', 'close'])
                df = df[(df['open'] > 0) & (df['high'] > 0) & (df['low'] > 0) & (df['close'] > 0)]
                
                if not df.empty:
                    # Use a fresh connection for each ticker to avoid transaction issues
                    ticker_conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
                    try:
                        load_to_bronze(ticker_conn, df)
                        total_loaded += len(df)
                        logging.info(f"✅ {ticker}: {len(df)} days loaded")
                    finally:
                        ticker_conn.close()
                else:
                    logging.warning(f"⚠️  {ticker}: No valid data after cleaning")
                    failed.append(ticker)
                
                # Rate limiting
                import time
                time.sleep(0.1)  # 100ms delay between tickers
                
            except Exception as e:
                import traceback
                error_details = traceback.format_exc()
                logging.error(f"❌ Error processing {ticker}: {e}")
                logging.debug(f"Full error: {error_details}")
                failed.append(ticker)
                continue
        
        logging.info("=" * 60)
        logging.info(f"🎉 Historical load completed!")
        logging.info(f"   Total records loaded: {total_loaded}")
        logging.info(f"   Successful tickers: {len(tickers) - len(failed)}")
        logging.info(f"   Failed tickers: {len(failed)}")
        if failed:
            logging.info(f"   Failed: {failed[:10]}...")  # Show first 10
        logging.info("=" * 60)
        logging.info("")
        logging.info("📝 Next steps:")
        logging.info("   1. Run the regular pipeline to process bronze → silver → gold")
        logging.info("   2. Technical indicators will be calculated with proper history")
        logging.info("   3. MACD requires 26+ days, now you have 200 days")
        
    except Exception as e:
        logging.error(f"❌ Historical load failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
