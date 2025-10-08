#!/usr/bin/env python3
"""
Simple data loading script - runs the core DAG functions without Airflow
"""

import sys
import os
import pandas as pd
import requests
from datetime import datetime, date, timedelta
import psycopg2
from sqlalchemy import create_engine, text

# Set up environment
POSTGRES_URL = "postgresql://neondb_owner:npg_GhSFKa2wf8vb@ep-billowing-waterfall-a76q5go4-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require"
POLYGON_API_KEY = "Em7xrXc5QX01uQqD29xxTrVZXfrrjC6Q"

def get_top_tickers():
    """Get top 50 tickers for quick loading"""
    # Use a curated list for faster loading
    return [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'AVGO', 'JPM',
        'V', 'PG', 'UNH', 'JNJ', 'HD', 'MA', 'DIS', 'PYPL', 'ADBE', 'CRM',
        'ABBV', 'PFE', 'KO', 'PEP', 'TMO', 'COST', 'MRK', 'ACN', 'ABT', 'NEE',
        'DHR', 'TXN', 'LIN', 'NKE', 'PM', 'UNP', 'LOW', 'SPGI', 'RTX', 'HCA',
        'UPS', 'IBM', 'QCOM', 'T', 'INTC', 'AMD', 'CVX', 'WMT', 'XOM', 'BA'
    ]

def fetch_ticker_data(symbol, start_date, end_date):
    """Fetch data for a single ticker"""
    url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/range/1/day/{start_date}/{end_date}"
    params = {
        'apiKey': POLYGON_API_KEY,
        'adjusted': 'true',
        'limit': 20
    }
    
    try:
        response = requests.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            if data.get('results'):
                df = pd.DataFrame(data['results'])
                df['symbol'] = symbol
                df['timestamp'] = pd.to_datetime(df['t'], unit='ms')
                df['date'] = df['timestamp'].dt.date
                df['ingestion_time'] = datetime.now()
                
                # Rename columns
                df = df.rename(columns={
                    'o': 'open', 'h': 'high', 'l': 'low', 'c': 'close',
                    'v': 'volume', 'vw': 'vwap', 'n': 'transactions'
                })
                
                # Select relevant columns
                df = df[['symbol', 'timestamp', 'date', 'open', 'high', 'low', 'close', 'volume', 'vwap', 'transactions', 'ingestion_time']]
                
                # Data quality checks
                df = df.dropna(subset=['open', 'high', 'low', 'close'])
                df = df[(df['open'] > 0) & (df['high'] > 0) & (df['low'] > 0) & (df['close'] > 0)]
                
                return df
    except Exception as e:
        print(f"Error fetching {symbol}: {e}")
    
    return pd.DataFrame()

def load_data_to_silver(df):
    """Load data directly to silver table with basic calculations"""
    if df.empty:
        return
    
    engine = create_engine(POSTGRES_URL)
    
    # Add basic calculated fields
    df['daily_range'] = df['high'] - df['low']
    df['daily_change'] = df['close'] - df['open']
    df['daily_return_pct'] = (df['close'] / df['open']) - 1
    df['dollar_volume'] = df['volume'] * df['vwap']
    
    # Add basic moving averages
    df = df.sort_values(['symbol', 'date'])
    df['ma_20'] = df.groupby('symbol')['close'].rolling(window=20, min_periods=1).mean().reset_index(0, drop=True)
    df['ma_50'] = df.groupby('symbol')['close'].rolling(window=50, min_periods=1).mean().reset_index(0, drop=True)
    df['ma_200'] = df.groupby('symbol')['close'].rolling(window=200, min_periods=1).mean().reset_index(0, drop=True)
    
    # Add data quality flag
    df['is_valid'] = True
    
    # Prepare columns for silver table
    silver_columns = [
        'symbol', 'timestamp', 'date', 'open', 'high', 'low', 'close', 'volume', 'vwap', 'transactions',
        'daily_range', 'daily_change', 'daily_return_pct', 'dollar_volume', 'ma_20', 'ma_50', 'ma_200',
        'is_valid', 'ingestion_time'
    ]
    
    # Only include columns that exist
    available_columns = [col for col in silver_columns if col in df.columns]
    silver_data = df[available_columns].copy()
    
    try:
        with engine.begin() as conn:
            # Load into temp table
            silver_data.to_sql('silver_ohlcv_temp', conn, if_exists='replace', index=False, method='multi')
            
            # Merge into silver table
            conn.execute(text("""
                INSERT INTO silver_ohlcv (symbol, timestamp, date, open, high, low, close, volume, vwap, transactions,
                                        daily_range, daily_change, daily_return_pct, dollar_volume, ma_20, ma_50, ma_200,
                                        is_valid, ingestion_time)
                SELECT symbol, timestamp, date, open, high, low, close, volume, vwap, transactions,
                       daily_range, daily_change, daily_return_pct, dollar_volume, ma_20, ma_50, ma_200,
                       is_valid, ingestion_time
                FROM silver_ohlcv_temp
                ON CONFLICT (symbol, date) 
                DO UPDATE SET
                    timestamp = EXCLUDED.timestamp,
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume,
                    vwap = EXCLUDED.vwap,
                    transactions = EXCLUDED.transactions,
                    daily_range = EXCLUDED.daily_range,
                    daily_change = EXCLUDED.daily_change,
                    daily_return_pct = EXCLUDED.daily_return_pct,
                    dollar_volume = EXCLUDED.dollar_volume,
                    ma_20 = EXCLUDED.ma_20,
                    ma_50 = EXCLUDED.ma_50,
                    ma_200 = EXCLUDED.ma_200,
                    is_valid = EXCLUDED.is_valid,
                    ingestion_time = EXCLUDED.ingestion_time,
                    updated_at = CURRENT_TIMESTAMP;
            """))
            
            # Drop temp table
            conn.execute(text("DROP TABLE IF EXISTS silver_ohlcv_temp;"))
            
        print(f"✅ Loaded {len(silver_data)} records to silver table")
        
    except Exception as e:
        print(f"❌ Error loading to silver: {e}")

def run_quick_data_load():
    """Run quick data load for top tickers"""
    print("🚀 Running quick data load...")
    
    # Get date range (last 30 days)
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=30)
    
    print(f"📅 Date range: {start_date} to {end_date}")
    
    # Get top tickers
    tickers = get_top_tickers()
    print(f"📊 Loading data for {len(tickers)} top tickers")
    
    all_data = []
    
    # Fetch data for each ticker
    for i, symbol in enumerate(tickers):
        print(f"📈 Fetching {symbol} ({i+1}/{len(tickers)})...")
        
        df = fetch_ticker_data(symbol, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
        
        if not df.empty:
            all_data.append(df)
            print(f"  ✅ {len(df)} records")
        else:
            print(f"  ⚠️ No data")
    
    if all_data:
        # Combine all data
        combined_df = pd.concat(all_data, ignore_index=True)
        print(f"\n📊 Total records: {len(combined_df)}")
        
        # Load to silver table
        print("\n💾 Loading to silver table...")
        load_data_to_silver(combined_df)
        
        print("\n" + "="*60)
        print("🎉 Quick data load completed!")
        print("✅ Data is now available for the UI")
        print("="*60)
    else:
        print("❌ No data was fetched")

if __name__ == "__main__":
    run_quick_data_load()
