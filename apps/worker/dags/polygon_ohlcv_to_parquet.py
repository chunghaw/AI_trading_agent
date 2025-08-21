import os
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
import requests
import pandas as pd
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.models import Variable
import pyarrow as pa
import pyarrow.parquet as pq

# Environment variables
POLYGON_API_KEY = os.getenv('POLYGON_API_KEY')
OHLCV_PARQUET_ROOT = os.getenv('OHLCV_PARQUET_ROOT', '../data/ohlcv')
WATCHLIST = os.getenv('WATCHLIST', 'NVDA,MSFT,AAPL').split(',')
TF = os.getenv('TF', '1d')

logger = logging.getLogger(__name__)

def get_watermark(symbol: str, timeframe: str) -> str:
    """Get watermark for symbol/timeframe combination"""
    watermark_key = f"watermark_{symbol}_{timeframe}"
    try:
        return Variable.get(watermark_key)
    except:
        # Default to 30 days ago if no watermark exists
        return (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')

def set_watermark(symbol: str, timeframe: str, watermark: str):
    """Set watermark for symbol/timeframe combination"""
    watermark_key = f"watermark_{symbol}_{timeframe}"
    Variable.set(watermark_key, watermark)

def fetch_polygon_ohlcv(symbol: str, from_date: str, to_date: str, timeframe: str = '1d') -> List[Dict[str, Any]]:
    """Fetch OHLCV data from Polygon API"""
    url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/range/1/{timeframe}/{from_date}/{to_date}"
    
    params = {
        'apiKey': POLYGON_API_KEY,
        'adjusted': 'true',
        'sort': 'asc'
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'OK':
            return data['results']
        else:
            logger.error(f"Polygon API error for {symbol}: {data}")
            return []
            
    except Exception as e:
        logger.error(f"Failed to fetch data for {symbol}: {e}")
        return []

def normalize_ohlcv_data(raw_data: List[Dict], symbol: str, timeframe: str) -> pd.DataFrame:
    """Normalize OHLCV data to standard format"""
    if not raw_data:
        return pd.DataFrame()
    
    df = pd.DataFrame(raw_data)
    
    # Rename columns to standard format
    df = df.rename(columns={
        't': 'ts',
        'o': 'open',
        'h': 'high',
        'l': 'low',
        'c': 'close',
        'v': 'volume'
    })
    
    # Convert timestamp to datetime
    df['ts'] = pd.to_datetime(df['ts'], unit='ms')
    
    # Add symbol and timeframe columns
    df['symbol'] = symbol
    df['timeframe'] = timeframe
    
    # Select and order columns
    columns = ['ts', 'open', 'high', 'low', 'close', 'volume', 'symbol', 'timeframe']
    df = df[columns]
    
    return df

def write_parquet(df: pd.DataFrame, symbol: str, timeframe: str):
    """Write DataFrame to Parquet file"""
    if df.empty:
        logger.warning(f"No data to write for {symbol}")
        return
    
    # Create directory structure
    output_dir = f"{OHLCV_PARQUET_ROOT}/{symbol}"
    os.makedirs(output_dir, exist_ok=True)
    
    output_file = f"{output_dir}/{timeframe}.parquet"
    
    # Convert to Arrow table and write
    table = pa.Table.from_pandas(df)
    pq.write_table(table, output_file)
    
    logger.info(f"Written {len(df)} rows to {output_file}")

def process_symbol_ohlcv(symbol: str, timeframe: str = '1d'):
    """Process OHLCV data for a single symbol"""
    logger.info(f"Processing {symbol} {timeframe}")
    
    # Get watermark
    watermark = get_watermark(symbol, timeframe)
    from_date = watermark
    to_date = datetime.now().strftime('%Y-%m-%d')
    
    # Fetch data
    raw_data = fetch_polygon_ohlcv(symbol, from_date, to_date, timeframe)
    
    if not raw_data:
        logger.warning(f"No data fetched for {symbol}")
        return
    
    # Normalize data
    df = normalize_ohlcv_data(raw_data, symbol, timeframe)
    
    if df.empty:
        logger.warning(f"No data to process for {symbol}")
        return
    
    # Write to Parquet
    write_parquet(df, symbol, timeframe)
    
    # Update watermark
    latest_date = df['ts'].max().strftime('%Y-%m-%d')
    set_watermark(symbol, timeframe, latest_date)
    
    logger.info(f"Completed processing {symbol} {timeframe}")

def process_all_symbols():
    """Process all symbols in watchlist"""
    for symbol in WATCHLIST:
        try:
            process_symbol_ohlcv(symbol.strip(), TF)
        except Exception as e:
            logger.error(f"Failed to process {symbol}: {e}")
            continue

# DAG definition
default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'polygon_ohlcv_to_parquet',
    default_args=default_args,
    description='Fetch Polygon OHLCV data and write to Parquet',
    schedule_interval='0 * * * *',  # Every hour
    catchup=False,
    tags=['polygon', 'ohlcv', 'parquet'],
)

process_task = PythonOperator(
    task_id='process_ohlcv',
    python_callable=process_all_symbols,
    dag=dag,
)

process_task
