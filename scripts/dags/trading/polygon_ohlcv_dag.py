"""
AI Trading Pipeline - Polygon OHLCV Data Ingestion DAG

This DAG ingests market data (stocks + ETFs) from Polygon API and refreshes it to Vercel Postgres.
Covers top 1000 US stocks by market cap + ~60 popular ETFs (market indices, sectors, bonds, commodities, volatility).
Similar to Databricks DLT pipeline but adapted for Airflow and PostgreSQL.
"""

import os
import time
import requests
import pandas as pd
import numpy as np
from datetime import datetime, date, timedelta, timezone
import json
import hashlib
from tenacity import retry, stop_after_attempt, wait_exponential
from typing import List, Dict, Any
import psycopg2
from psycopg2.extras import execute_values
from sqlalchemy import create_engine, text
import logging

from airflow import DAG
from airflow.decorators import task, dag
from airflow.models import Variable
from airflow.utils.dates import days_ago

# Configuration
POLYGON_API_KEY = os.environ.get('POLYGON_API_KEY', 'Em7xrXc5QX01uQqD29xxTrVZXfrrjC6Q')
POSTGRES_URL = os.environ.get('POSTGRES_URL', 'postgresql://neondb_owner:npg_GhSFKa2wf8vb@ep-billowing-waterfall-a76q5go4-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require')

# Data configuration
RETENTION_DAYS = 1095  # 3 years retention for historical data accumulation
BATCH_SIZE = 100  # Process symbols in batches
TOP_STOCKS_COUNT = 1000  # Focus on top 1000 US stocks by market cap + popular ETFs

# Default arguments
default_args = {
    'owner': 'dataexpert',
    'depends_on_past': False,
    'start_date': datetime(2025, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

@dag(
    schedule_interval='0 21,9 * * *',  # Run at 5am SGT (21:00 UTC) and 5pm SGT (09:00 UTC) daily
    start_date=datetime(2025, 1, 1),
    catchup=False,
    default_args=default_args,
    description='Twice-daily Polygon OHLCV data ingestion - stocks + ETFs, 10 days data, 3 years retention, merge strategy, run at 5am and 5pm SGT',
    tags=['trading', 'polygon', 'ohlcv', 'postgres', 'stocks', 'etfs', 'volume-ranking'],
    is_paused_upon_creation=False  # Auto-activate DAG on deploy
    
)
def polygon_ohlcv_dag():
    
    @task
    def get_all_tickers():
        """Get top 1000 US stocks + popular ETFs by volume using Polygon's grouped aggregates endpoint"""
        try:
            # Define popular ETFs to always include
            POPULAR_ETFS = [
                # Market Index ETFs
                'SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI', 'IVV', 'SPLG', 'SPYI',
                # Sector ETFs
                'XLF', 'XLK', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLRE', 'XLC', 'XLB',
                # International ETFs
                'EFA', 'EEM', 'VEA', 'VWO', 'IEFA', 'IEMG', 'VEU', 'VXUS', 'VAE', 'VEQ',
                # Bond ETFs
                'TLT', 'AGG', 'BND', 'LQD', 'HYG', 'TIP', 'SHY', 'IEF',
                # Commodity ETFs
                'GLD', 'SLV', 'USO', 'UNG', 'DBC', 'IAU',
                # Volatility ETFs
                'VXX', 'VIXY', 'UVXY',
                # Leveraged/Inverse ETFs (popular for trading)
                'TQQQ', 'SQQQ', 'UPRO', 'SPXU', 'TNA', 'TZA',
                # Thematic ETFs
                'ARK', 'ARKK', 'ARKG', 'ARKW', 'ARKF', 'ARKQ', 'ICLN', 'TAN', 'LIT', 'BOTZ', 'HACK', 'CHAT', 'SMH',
                # Dividend ETFs
                'SCHD', 'VYM', 'VIG', 'SDY', 'NOBL',
                # Growth ETFs
                'VGT', 'VTV', 'QQQM', 'QQQI',
                # Income ETFs
                'JEPI', 'JEPQ',
                # Other Popular ETFs
                'VT', 'QTUM', 'MOAT', 'SPMO', 'RGTI', 'BKLC', 'VXF', 'GPIX'
            ]
            
            logging.info(f"Fetching top US stocks + ETFs by volume from Polygon grouped aggregates...")
            
            # Use grouped aggregates endpoint to get stocks ranked by volume
            from datetime import date, timedelta
            yesterday = date.today() - timedelta(days=1)
            date_str = yesterday.strftime('%Y-%m-%d')
            
            url = f"https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/{date_str}"
            params = {
                'apiKey': POLYGON_API_KEY,
                'adjusted': 'true',
                'limit': 10000  # Get up to 10K stocks to rank from
            }
            
            logging.info(f"Date: {date_str}")
            
            response = requests.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                
                logging.info(f"Got {len(results)} stocks from grouped aggregates")
                
                if results:
                    # Sort by volume (descending) - volume is a good proxy for market cap
                    results_sorted = sorted(results, key=lambda x: x.get('v', 0), reverse=True)
                    
                    # Extract symbols and take top stocks (leave room for ETFs)
                    # Since we have ~60 popular ETFs, get top 940 stocks to stay under 1000 total
                    top_symbols = []
                    for stock in results_sorted[:940]:  # Reduced from 1000 to make room for ETFs
                        symbol = stock.get('T', '')
                        if symbol and len(symbol) <= 10:  # Reasonable symbol length
                            top_symbols.append(symbol)
                    
                    # Get custom tickers from database
                    custom_tickers = []
                    try:
                        conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
                        cursor = conn.cursor()
                        cursor.execute("""
                            SELECT symbol 
                            FROM custom_tickers 
                            WHERE is_active = TRUE 
                            AND polygon_verified = TRUE
                        """)
                        custom_tickers = [row[0] for row in cursor.fetchall()]
                        cursor.close()
                        conn.close()
                        logging.info(f"📊 Found {len(custom_tickers)} custom tickers in database: {custom_tickers}")
                    except Exception as e:
                        logging.warning(f"⚠️ Error fetching custom tickers from database: {e}")
                        logging.warning("   Continuing with base tickers only")
                    
                    # Add popular ETFs and custom tickers (these may already be in the list, we'll deduplicate)
                    all_symbols = list(set(top_symbols + POPULAR_ETFS + custom_tickers))
                    
                    logging.info(f"Selected top {len(top_symbols)} stocks by volume")
                    logging.info(f"Added {len(POPULAR_ETFS)} popular ETFs")
                    logging.info(f"Total symbols after deduplication: {len(all_symbols)}")
                    logging.info(f"Top 20 symbols: {all_symbols[:20]}")
                    
                    # Verify major stocks and ETFs are included
                    major_stocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'BRK.B']
                    major_etfs = ['SPY', 'QQQ', 'IWM', 'DIA', 'GLD', 'TLT', 'XLF', 'XLK']
                    found_major_stocks = [stock for stock in major_stocks if stock in all_symbols]
                    found_major_etfs = [etf for etf in major_etfs if etf in all_symbols]
                    logging.info(f"Major stocks included: {found_major_stocks}")
                    logging.info(f"Major ETFs included: {found_major_etfs}")
                    
                    return all_symbols
                else:
                    logging.warning("No results from grouped aggregates")
                    raise Exception("No stock data available")
            else:
                logging.error(f"Grouped aggregates API error: {response.status_code}")
                logging.error(response.text)
                raise Exception(f"API error: {response.status_code}")
                
        except Exception as e:
            logging.error(f"Error getting top stocks by volume: {e}")
            # Fallback to curated major stocks + ETFs list
            fallback_tickers = [
                # FAANG + major tech
                'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'NFLX',
                # Financial
                'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'BRK.B', 'BRK.A',
                # Healthcare
                'JNJ', 'PFE', 'UNH', 'ABBV', 'MRK', 'TMO',
                # Consumer
                'PG', 'KO', 'PEP', 'WMT', 'HD', 'MCD', 'NKE',
                # Industrial
                'BA', 'CAT', 'GE', 'HON', 'MMM',
                # Energy
                'XOM', 'CVX', 'COP',
                # Other major stocks
                'V', 'MA', 'ADBE', 'CRM', 'ORCL', 'INTC', 'AMD', 'QCOM', 'AVGO',
                'DIS', 'VZ', 'T', 'CMCSA', 'COST', 'ABT', 'ACN', 'NEE', 'DHR',
                'TXN', 'LIN', 'PM', 'UNP', 'LOW', 'SPGI', 'RTX', 'HCA', 'UPS', 'IBM',
                # Popular ETFs
                'SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI',
                'XLF', 'XLK', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP',
                'GLD', 'SLV', 'TLT', 'AGG', 'BND',
                'VXX', 'VIXY', 'EFA', 'EEM'
            ]
            logging.info(f"Using fallback curated list: {len(fallback_tickers)} major stocks + ETFs")
            return fallback_tickers
    
    @task
    def debug_tickers(tickers: List[str]):
        """Debug task to verify tickers are passed correctly"""
        logging.info(f"=== DEBUG TICKERS ===")
        logging.info(f"Number of tickers received: {len(tickers)}")
        logging.info(f"First 10 tickers: {tickers[:10]}")
        logging.info(f"Last 10 tickers: {tickers[-10:]}")
        return tickers


    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=60))
    def fetch_ticker_data_with_retry(symbol: str, start_date: str, end_date: str):
        """Fetch data for a single ticker with retry logic"""
        url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/range/1/day/{start_date}/{end_date}"
        params = {
            'apiKey': POLYGON_API_KEY,
            'adjusted': 'true',
            'limit': 20  # Limit to 20 records (10 days + buffer)
        }
        
        logging.info(f"DEBUG: Fetching data for {symbol} from {url}")
        
        response = requests.get(url, params=params)
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 429:  # Rate limited
            logging.warning(f"Rate limited for {symbol}, retrying...")
            raise Exception("Rate limited")
        else:
            logging.error(f"HTTP {response.status_code} for {symbol}")
            raise Exception(f"HTTP {response.status_code}")
    
    @task
    def fetch_ohlcv_data(tickers: List[str]):
        """Fetch 10 days of OHLCV data for all tickers"""
        all_data = []
        failed_tickers = []
        
        # Calculate date range (10 days)
        end_date = date.today() - timedelta(days=1)
        start_date = end_date - timedelta(days=10)  # 10 days of data
        
        logging.info(f"Date range: {start_date} to {end_date} (10 days)")
        
        logging.info(f"=== DEBUG: Starting fetch_ohlcv_data ===")
        logging.info(f"Number of tickers to process: {len(tickers)}")
        logging.info(f"Date range: {start_date} to {end_date}")
        logging.info(f"All tickers: {tickers}")
        
        # Process in optimized batches for better performance
        batch_size = 1000  # Process 1000 tickers at a time (optimized for speed)
        total_batches = (len(tickers) + batch_size - 1) // batch_size
        
        # Progress tracking
        progress_file = "/tmp/polygon_progress.json"
        start_batch = 0
        
        # Load progress if exists
        if os.path.exists(progress_file):
            try:
                with open(progress_file, 'r') as f:
                    progress = json.load(f)
                    start_batch = progress.get('last_batch', 0)
                    logging.info(f"Resuming from batch {start_batch}")
            except:
                logging.warning("Could not load progress file, starting from beginning")
        
        logging.info(f"Processing {len(tickers)} tickers in {total_batches} batches of {batch_size}")
        
        for batch_start in range(start_batch * batch_size, len(tickers), batch_size):
            batch_tickers = tickers[batch_start:batch_start + batch_size]
            batch_num = batch_start // batch_size + 1
            
            logging.info(f"Processing batch {batch_num}/{total_batches}: {len(batch_tickers)} tickers")
            logging.info(f"Batch tickers: {batch_tickers}")
            
            for i, symbol in enumerate(batch_tickers):
                try:
                    # Debug every ticker in small batches
                    logging.info(f"Processing ticker {i+1}/{len(batch_tickers)} in batch: {symbol}")
                    
                    # Fetch data with retry logic
                    data = fetch_ticker_data_with_retry(symbol, start_date, end_date)
                    
                    logging.info(f"DEBUG: Response data keys for {symbol}: {list(data.keys())}")
                    
                    if data.get('results'):
                        df = pd.DataFrame(data['results'])
                        df['symbol'] = symbol
                        df['timestamp'] = pd.to_datetime(df['t'], unit='ms')
                        df['date'] = df['timestamp'].dt.date
                        df['ingestion_time'] = datetime.now(timezone.utc)
                        
                        # Rename columns to standard OHLCV format
                        df = df.rename(columns={
                            'o': 'open',
                            'h': 'high',
                            'l': 'low',
                            'c': 'close',
                            'v': 'volume',
                            'vw': 'vwap',
                            'n': 'transactions'
                        })
                        
                        # Select and clean relevant columns
                        df = df[['symbol', 'timestamp', 'date', 'open', 'high', 'low', 'close', 'volume', 'vwap', 'transactions', 'ingestion_time']]
                        
                        # Data quality checks
                        df = df.dropna(subset=['open', 'high', 'low', 'close'])
                        df = df[(df['open'] > 0) & (df['high'] > 0) & (df['low'] > 0) & (df['close'] > 0)]
                        
                        if not df.empty:
                            all_data.append(df)
                            logging.info(f"✓ {symbol}: {len(df)} records")
                        else:
                            logging.warning(f"⚠ {symbol}: No valid data after cleaning")
                    else:
                        logging.warning(f"⚠ {symbol}: No data returned")
                        
                except Exception as e:
                    logging.error(f"❌ {symbol}: Error - {e}")
                    failed_tickers.append(symbol)
                    continue
            
            # Add delay after each ticker to prevent API rate limiting
            time.sleep(0.01)  # 0.01 seconds per ticker (optimized for speed)
        
            # Log batch completion and memory usage
            batch_data_count = len([df for df in all_data if not df.empty])
            logging.info(f"Batch {batch_num} completed. Total dataframes in memory: {batch_data_count}")
            
            # Save progress
            try:
                with open(progress_file, 'w') as f:
                    json.dump({'last_batch': batch_num}, f)
                logging.info(f"Progress saved: batch {batch_num}")
            except Exception as e:
                logging.warning(f"Could not save progress: {e}")
            
            # Add delay between batches to prevent API rate limiting
            if batch_num < total_batches:  # Don't delay after last batch
                time.sleep(0.05)  # 0.05 seconds between batches (optimized)
            
            # Clear memory after each batch to prevent OOM
            if batch_num % 5 == 0:  # Every 5 batches, log memory status
                logging.info(f"Processed {batch_num} batches, {len(all_data)} dataframes collected so far")
                
                # Force garbage collection
                import gc
                gc.collect()
        
        if all_data:
            combined_df = pd.concat(all_data, ignore_index=True)
            logging.info(f"✅ Total records fetched: {len(combined_df)}")
            logging.info(f"❌ Failed tickers: {len(failed_tickers)}")
            
            return {
                'data': combined_df,
                'failed_tickers': failed_tickers,
                'total_records': len(combined_df)
            }
        else:
            logging.error("❌ No data was fetched")
            return {
                'data': pd.DataFrame(),
                'failed_tickers': failed_tickers,
                'total_records': 0
            }
    
    @task
    def fetch_company_info(ticker_info: Dict[str, Any]):
        """Fetch company information and market cap for all selected tickers"""
        try:
            all_tickers = ticker_info.get('all_tickers', [])
            logging.info(f"Fetching company info for {len(all_tickers)} tickers...")
            
            company_info = {}
            failed_tickers = []
            
            # Process in batches to avoid rate limiting
            batch_size = 100
            total_batches = (len(all_tickers) + batch_size - 1) // batch_size
            
            for batch_num in range(total_batches):
                start_idx = batch_num * batch_size
                end_idx = min((batch_num + 1) * batch_size, len(all_tickers))
                batch_tickers = all_tickers[start_idx:end_idx]
                
                logging.info(f"Processing company info batch {batch_num + 1}/{total_batches}: {len(batch_tickers)} tickers")
                
                for symbol in batch_tickers:
                    try:
                        url = f"https://api.polygon.io/v3/reference/tickers/{symbol}"
                        params = {'apiKey': POLYGON_API_KEY}
                        
                        response = requests.get(url, params=params)
                        
                        if response.status_code == 200:
                            data = response.json()
                            if data.get('results'):
                                result = data['results']
                                
                                # Extract company information
                                company_info[symbol] = {
                                    'company_name': result.get('name', ''),
                                    'market': result.get('market', ''),
                                    'stock_type': result.get('type', ''),
                                    'primary_exchange': result.get('primary_exchange', ''),
                                    'currency': result.get('currency_name', ''),
                                    'locale': result.get('locale', ''),
                                    'list_date': result.get('list_date', ''),
                                    'total_employees': result.get('total_employees', 0),
                                    'description': result.get('description', ''),
                                    'shares_outstanding': result.get('share_class_shares_outstanding', 0),
                                    'weighted_shares': result.get('weighted_shares_outstanding', 0)
                                }
                                
                                logging.info(f"✓ {symbol}: {result.get('name', 'N/A')}")
                            else:
                                logging.warning(f"⚠ {symbol}: No company data")
                                company_info[symbol] = {
                                    'company_name': '',
                                    'market': '',
                                    'stock_type': '',
                                    'primary_exchange': '',
                                    'currency': '',
                                    'locale': '',
                                    'list_date': '',
                                    'total_employees': 0,
                                    'description': '',
                                    'shares_outstanding': 0,
                                    'weighted_shares': 0
                                }
                        else:
                            logging.error(f"❌ {symbol}: HTTP {response.status_code}")
                            failed_tickers.append(symbol)
                            company_info[symbol] = {
                                'company_name': '',
                                'market': '',
                                'stock_type': '',
                                'primary_exchange': '',
                                'currency': '',
                                'locale': '',
                                'list_date': '',
                                'total_employees': 0,
                                'description': '',
                                'shares_outstanding': 0,
                                'weighted_shares': 0
                            }
                        
                        time.sleep(0.01)  # Rate limiting (optimized)
                        
                    except Exception as e:
                        logging.error(f"❌ {symbol}: Error - {e}")
                        failed_tickers.append(symbol)
                        company_info[symbol] = {
                            'company_name': '',
                            'market': '',
                            'stock_type': '',
                            'currency': '',
                            'locale': '',
                            'list_date': '',
                            'total_employees': 0,
                            'description': '',
                            'shares_outstanding': 0,
                            'weighted_shares': 0
                        }
                
                # Add delay between batches
                if batch_num < total_batches - 1:
                    time.sleep(0.05)  # Optimized delay  # Optimized delay
            
            logging.info(f"✅ Company info fetched for {len(company_info)} tickers")
            logging.info(f"❌ Failed tickers: {len(failed_tickers)}")
            
            return {
                'company_info': company_info,
                'failed_tickers': failed_tickers,
                'total_fetched': len(company_info)
            }
            
        except Exception as e:
            logging.error(f"Error fetching company info: {e}")
            return {
                'company_info': {},
                'failed_tickers': all_tickers,
                'total_fetched': 0
            }

    @task
    def fetch_full_historical_data(selected_symbols: List[str]):
        """Fetch full historical data only for selected top tickers"""
        all_data = []
        failed_tickers = []
        
        # Calculate date range (full historical data)
        end_date = date.today()
        start_date = end_date - timedelta(days=RETENTION_DAYS)
        
        logging.info(f"=== Fetching full historical data for {len(selected_symbols)} selected tickers ===")
        logging.info(f"Date range: {start_date} to {end_date}")
        logging.info(f"Selected symbols: {selected_symbols[:20]}...")  # Show first 20
        
        # Process in optimized batches
        batch_size = 100
        total_batches = (len(selected_symbols) + batch_size - 1) // batch_size
        
        for batch_num in range(total_batches):
            start_idx = batch_num * batch_size
            end_idx = min((batch_num + 1) * batch_size, len(selected_symbols))
            batch_tickers = selected_symbols[start_idx:end_idx]
            
            logging.info(f"Processing batch {batch_num + 1}/{total_batches}: {len(batch_tickers)} tickers")
            
            for i, symbol in enumerate(batch_tickers):
                try:
                    logging.info(f"Processing ticker {i+1}/{len(batch_tickers)}: {symbol}")
                    
                    # Fetch data with retry logic
                    data = fetch_ticker_data_with_retry(symbol, start_date, end_date)
                    
                    if data.get('results'):
                        df = pd.DataFrame(data['results'])
                        df['symbol'] = symbol
                        df['timestamp'] = pd.to_datetime(df['t'], unit='ms')
                        df['date'] = df['timestamp'].dt.date
                        df['ingestion_time'] = datetime.now(timezone.utc)
                        
                        # Rename columns to standard OHLCV format
                        df = df.rename(columns={
                            'o': 'open',
                            'h': 'high',
                            'l': 'low',
                            'c': 'close',
                            'v': 'volume',
                            'vw': 'vwap',
                            'n': 'transactions'
                        })
                        
                        # Select and clean relevant columns
                        df = df[['symbol', 'timestamp', 'date', 'open', 'high', 'low', 'close', 'volume', 'vwap', 'transactions', 'ingestion_time']]
                        
                        # Data quality checks
                        df = df.dropna(subset=['open', 'high', 'low', 'close'])
                        df = df[(df['open'] > 0) & (df['high'] > 0) & (df['low'] > 0) & (df['close'] > 0)]
                        
                        if not df.empty:
                            all_data.append(df)
                            logging.info(f"✓ {symbol}: {len(df)} records")
                        else:
                            logging.warning(f"⚠ {symbol}: No valid data after cleaning")
                    else:
                        logging.warning(f"⚠ {symbol}: No data returned")
                        
                except Exception as e:
                    logging.error(f"❌ {symbol}: Error - {e}")
                    failed_tickers.append(symbol)
                    continue
                
                # Add delay after each ticker to prevent API rate limiting
                time.sleep(0.05)  # Optimized delay
            
            # Add delay between batches
            if batch_num < total_batches - 1:
                time.sleep(0.5)  # Optimized delay
        
        if all_data:
            combined_df = pd.concat(all_data, ignore_index=True)
            logging.info(f"✅ Total historical records fetched: {len(combined_df)}")
            logging.info(f"❌ Failed tickers: {len(failed_tickers)}")
            
            return {
                'data': combined_df,
                'failed_tickers': failed_tickers,
                'total_records': len(combined_df)
            }
        else:
            logging.error("❌ No historical data was fetched")
            return {
                'data': pd.DataFrame(),
                'failed_tickers': failed_tickers,
                'total_records': 0
            }

    @task
    def apply_market_cap_ranking(data_result: Dict[str, Any], ticker_info: Dict[str, Any]):
        """Apply market cap-based ranking to get top 1000 US stocks"""
        try:
            df = data_result['data']
            
            if df.empty:
                logging.warning("No data to rank")
                return data_result
            
            logging.info(f"Applying volume-based ranking to {len(df)} records...")
            
            # Get the most recent data for each symbol (for volume ranking)
            latest_data = df.groupby('symbol').last().reset_index()
            
            # Focus on US stocks only (no crypto)
            us_stocks = ticker_info.get('us_stocks', [])
            
            # Filter data to US stocks only
            us_stock_data = latest_data[latest_data['symbol'].isin(us_stocks)]
            
            logging.info(f"US stocks data: {len(us_stock_data)}")
            
            # Rank US stocks by market cap (if available) or volume as fallback
            if not us_stock_data.empty:
                # Try to use market cap if available, otherwise use volume
                if 'market_cap' in us_stock_data.columns and not us_stock_data['market_cap'].isna().all():
                    # Rank by market cap (descending)
                    us_stock_data = us_stock_data.sort_values('market_cap', ascending=False, na_position='last')
                    logging.info("Ranking by market cap")
                else:
                    # Fallback to volume ranking
                    us_stock_data = us_stock_data.sort_values('volume', ascending=False)
                    logging.info("Ranking by volume (market cap not available)")
                
                # Take top 1000 US stocks
                top_us_stocks = us_stock_data.head(TOP_STOCKS_COUNT)
                selected_symbols = set(top_us_stocks['symbol'].tolist())
                logging.info(f"Selected top {len(top_us_stocks)} US stocks")
            else:
                selected_symbols = set()
                logging.warning("No US stock data available for ranking")
            
            # Filter the original data to only include selected symbols
            filtered_df = df[df['symbol'].isin(selected_symbols)]
            
            logging.info(f"Market cap ranking complete:")
            logging.info(f"  - Original records: {len(df)}")
            logging.info(f"  - Filtered records: {len(filtered_df)}")
            logging.info(f"  - Selected symbols: {len(selected_symbols)}")
            logging.info(f"  - Top {TOP_STOCKS_COUNT} US stocks by market cap")
            
            # Update the data result
            data_result['data'] = filtered_df
            data_result['total_records'] = len(filtered_df)
            data_result['selected_symbols'] = list(selected_symbols)
            data_result['us_stock_count'] = len(selected_symbols)
            
            return data_result
            
        except Exception as e:
            logging.error(f"Error in volume ranking: {e}")
            return data_result
    
    @task
    def merge_company_info_and_calculate_market_cap(data_result: Dict[str, Any], company_info_result: Dict[str, Any]):
        """Merge company info with OHLCV data and calculate market cap"""
        try:
            df = data_result['data']
            company_info = company_info_result['company_info']
            
            if df.empty:
                logging.warning("No data to merge with company info")
                return data_result
            
            logging.info(f"Merging company info with {len(df)} records...")
            
            # Add company info columns to the dataframe
            df['company_name'] = df['symbol'].map(lambda x: company_info.get(x, {}).get('company_name', ''))
            df['market'] = df['symbol'].map(lambda x: company_info.get(x, {}).get('market', ''))
            df['stock_type'] = df['symbol'].map(lambda x: company_info.get(x, {}).get('stock_type', ''))
            df['primary_exchange'] = df['symbol'].map(lambda x: company_info.get(x, {}).get('primary_exchange', ''))
            df['currency'] = df['symbol'].map(lambda x: company_info.get(x, {}).get('currency', ''))
            df['locale'] = df['symbol'].map(lambda x: company_info.get(x, {}).get('locale', ''))
            df['list_date'] = df['symbol'].map(lambda x: company_info.get(x, {}).get('list_date', ''))
            df['total_employees'] = df['symbol'].map(lambda x: company_info.get(x, {}).get('total_employees', 0))
            df['description'] = df['symbol'].map(lambda x: company_info.get(x, {}).get('description', ''))
            df['shares_outstanding'] = df['symbol'].map(lambda x: company_info.get(x, {}).get('shares_outstanding', 0))
            
            # Calculate market cap = current_price * shares_outstanding
            # Only calculate if shares_outstanding is valid (> 0)
            df['market_cap'] = np.where(
                (df['shares_outstanding'] > 0) & (df['close'] > 0),
                df['close'] * df['shares_outstanding'],
                0  # Set to 0 if no valid shares data
            )
            
            # Convert list_date to proper date format
            df['list_date'] = pd.to_datetime(df['list_date'], errors='coerce').dt.date
            
            logging.info(f"✅ Company info merged successfully")
            logging.info(f"  - Records with company name: {df['company_name'].notna().sum()}")
            logging.info(f"  - Records with shares outstanding > 0: {(df['shares_outstanding'] > 0).sum()}")
            logging.info(f"  - Records with market cap > 0: {(df['market_cap'] > 0).sum()}")
            logging.info(f"  - Average market cap: ${df['market_cap'].mean():,.0f}")
            
            # Log some examples for debugging
            sample_data = df[df['market_cap'] > 0].head(3)[['symbol', 'close', 'shares_outstanding', 'market_cap']]
            if not sample_data.empty:
                logging.info(f"  - Sample market cap calculations:")
                for _, row in sample_data.iterrows():
                    logging.info(f"    {row['symbol']}: ${row['close']:.2f} × {row['shares_outstanding']:,.0f} = ${row['market_cap']:,.0f}")
            
            # Update the data result
            data_result['data'] = df
            data_result['company_info_merged'] = True
            
            return data_result
            
        except Exception as e:
            logging.error(f"Error merging company info: {e}")
            return data_result

    @task
    def process_and_enrich_data(data_result: Dict[str, Any]):
        """Process and enrich the OHLCV data with memory optimization"""
        df = data_result['data']
        
        if df.empty:
            logging.warning("No data to process")
            return data_result
        
        logging.info(f"Processing {len(df)} records with memory optimization...")
        
        # Process in chunks for efficiency
        chunk_size = 10000  # Process 10000 records at a time
        total_chunks = (len(df) + chunk_size - 1) // chunk_size
        processed_chunks = []
        
        for chunk_num in range(total_chunks):
            start_idx = chunk_num * chunk_size
            end_idx = min((chunk_num + 1) * chunk_size, len(df))
            chunk_df = df.iloc[start_idx:end_idx].copy()
            
            logging.info(f"Processing chunk {chunk_num + 1}/{total_chunks}: {len(chunk_df)} records")
            
            # Add calculated fields
            chunk_df['daily_range'] = chunk_df['high'] - chunk_df['low']
            chunk_df['daily_change'] = chunk_df['close'] - chunk_df['open']
            chunk_df['daily_return_pct'] = (chunk_df['close'] / chunk_df['open']) - 1
            chunk_df['dollar_volume'] = chunk_df['volume'] * chunk_df['vwap']
            
            # Add technical indicators (simplified for memory efficiency)
            chunk_df = chunk_df.sort_values(['symbol', 'date'])
            
            # Calculate moving averages (proper calculation with sufficient data)
            chunk_df['ma_5'] = chunk_df.groupby('symbol')['close'].rolling(window=5, min_periods=5).mean().reset_index(0, drop=True)
            chunk_df['ma_20'] = chunk_df.groupby('symbol')['close'].rolling(window=20, min_periods=20).mean().reset_index(0, drop=True)
            chunk_df['ma_50'] = chunk_df.groupby('symbol')['close'].rolling(window=50, min_periods=50).mean().reset_index(0, drop=True)
            chunk_df['ma_200'] = chunk_df.groupby('symbol')['close'].rolling(window=200, min_periods=200).mean().reset_index(0, drop=True)
            
            # Calculate EMAs (Exponential Moving Averages)
            chunk_df['ema_20'] = chunk_df.groupby('symbol')['close'].ewm(span=20, adjust=False, min_periods=20).mean().reset_index(0, drop=True)
            chunk_df['ema_50'] = chunk_df.groupby('symbol')['close'].ewm(span=50, adjust=False, min_periods=50).mean().reset_index(0, drop=True)
            chunk_df['ema_200'] = chunk_df.groupby('symbol')['close'].ewm(span=200, adjust=False, min_periods=200).mean().reset_index(0, drop=True)
            
            # Calculate MACD (12-day EMA - 26-day EMA)
            ema_12 = chunk_df.groupby('symbol')['close'].ewm(span=12, adjust=False, min_periods=12).mean().reset_index(0, drop=True)
            ema_26 = chunk_df.groupby('symbol')['close'].ewm(span=26, adjust=False, min_periods=26).mean().reset_index(0, drop=True)
            chunk_df['macd_line'] = ema_12 - ema_26
            chunk_df['macd_signal'] = chunk_df.groupby('symbol')['macd_line'].ewm(span=9, adjust=False, min_periods=9).mean().reset_index(0, drop=True)
            chunk_df['macd_histogram'] = chunk_df['macd_line'] - chunk_df['macd_signal']
            
            # Calculate True Range and ATR
            chunk_df['high_low'] = chunk_df['high'] - chunk_df['low']
            chunk_df['high_prev_close'] = abs(chunk_df['high'] - chunk_df.groupby('symbol')['close'].shift(1))
            chunk_df['low_prev_close'] = abs(chunk_df['low'] - chunk_df.groupby('symbol')['close'].shift(1))
            chunk_df['true_range'] = chunk_df[['high_low', 'high_prev_close', 'low_prev_close']].max(axis=1)
            chunk_df['atr'] = chunk_df.groupby('symbol')['true_range'].rolling(window=14, min_periods=14).mean().reset_index(0, drop=True)
            
            # Drop intermediate ATR calculation columns
            chunk_df = chunk_df.drop(columns=['high_low', 'high_prev_close', 'low_prev_close', 'true_range'], errors='ignore')
            
            # Calculate volatility (proper calculation with sufficient data)
            chunk_df['volatility_20'] = chunk_df.groupby('symbol')['daily_return_pct'].rolling(window=20, min_periods=20).std().reset_index(0, drop=True)
            
            processed_chunks.append(chunk_df)
            
            # Clear memory
            del chunk_df
        
        # Combine all processed chunks
        df = pd.concat(processed_chunks, ignore_index=True)
        logging.info(f"Completed processing {len(df)} records")
        
        # Calculate RSI (proper calculation with sufficient data)
        delta = df.groupby('symbol')['close'].diff()
        gain = (delta.where(delta > 0, 0)).groupby(df['symbol']).rolling(window=14, min_periods=14).mean().reset_index(0, drop=True)
        loss = (-delta.where(delta < 0, 0)).groupby(df['symbol']).rolling(window=14, min_periods=14).mean().reset_index(0, drop=True)
        
        # Avoid division by zero - only calculate RSI when we have sufficient data
        rs = gain / loss
        rs = rs.replace([np.inf, -np.inf], np.nan)  # Replace infinity with NaN
        df['rsi'] = 100 - (100 / (1 + rs))
        
        # Add data quality flags
        df['is_valid'] = (
            (df['open'] > 0) & 
            (df['high'] > 0) & 
            (df['low'] > 0) & 
            (df['close'] > 0) &
            (df['high'] >= df['low']) &
            (df['high'] >= df['open']) &
            (df['high'] >= df['close']) &
            (df['low'] <= df['open']) &
            (df['low'] <= df['close'])
        )
        
        logging.info(f"✅ Processed {len(df)} records with enriched data")
        
        return {
            'data': df,
            'failed_tickers': data_result['failed_tickers'],
            'total_records': len(df)
        }
    
    @task
    def create_postgres_tables():
        """Create PostgreSQL tables if they don't exist"""
        try:
            engine = create_engine(POSTGRES_URL)
            
            with engine.begin() as conn:
                # Create bronze_ohlcv table
                conn.execute(text("""
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
                        -- Company information
                        company_name VARCHAR(255),
                        market VARCHAR(50),
                        stock_type VARCHAR(10),
                        primary_exchange VARCHAR(50),
                        currency VARCHAR(10),
                        locale VARCHAR(10),
                        list_date DATE,
                        total_employees INTEGER,
                        description TEXT,
                        shares_outstanding BIGINT,
                        market_cap BIGINT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(symbol, date)
                    );
                """))
                
                # Create silver_ohlcv table
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS silver_ohlcv (
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
                        daily_range DECIMAL(20, 8),
                        daily_change DECIMAL(20, 8),
                        daily_return_pct DECIMAL(20, 8),
                        dollar_volume DECIMAL(20, 8),
                        ma_5 DECIMAL(20, 8),
                        ma_20 DECIMAL(20, 8),
                        ma_50 DECIMAL(20, 8),
                        ma_200 DECIMAL(20, 8),
                        ema_20 DECIMAL(20, 8),
                        ema_50 DECIMAL(20, 8),
                        ema_200 DECIMAL(20, 8),
                        macd_line DECIMAL(20, 8),
                        macd_signal DECIMAL(20, 8),
                        macd_histogram DECIMAL(20, 8),
                        atr DECIMAL(20, 8),
                        volatility_20 DECIMAL(20, 8),
                        rsi DECIMAL(10, 6),
                        is_valid BOOLEAN,
                        ingestion_time TIMESTAMP WITH TIME ZONE,
                        -- Company information
                        company_name VARCHAR(255),
                        market VARCHAR(50),
                        stock_type VARCHAR(10),
                        primary_exchange VARCHAR(50),
                        currency VARCHAR(10),
                        locale VARCHAR(10),
                        list_date DATE,
                        total_employees INTEGER,
                        description TEXT,
                        shares_outstanding BIGINT,
                        market_cap BIGINT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(symbol, date)
                    );
                """))
                
                # Create gold_ohlcv_daily_metrics table
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS gold_ohlcv_daily_metrics (
                        id SERIAL PRIMARY KEY,
                        symbol VARCHAR(20) NOT NULL,
                        date DATE NOT NULL,
                        open DECIMAL(20, 8),
                        high DECIMAL(20, 8),
                        low DECIMAL(20, 8),
                        close DECIMAL(20, 8),
                        last_close DECIMAL(20, 8),
                        change_pct DECIMAL(10, 6),
                        total_volume DECIMAL(20, 8),
                        avg_vwap DECIMAL(20, 8),
                        total_dollar_volume DECIMAL(20, 8),
                        max_range DECIMAL(20, 8),
                        daily_return_pct DECIMAL(10, 6),
                        intraday_range DECIMAL(20, 8),
                        total_transactions INTEGER,
                        last_updated TIMESTAMP WITH TIME ZONE,
                        -- Technical Indicators
                        rsi_14 DECIMAL(10, 6),
                        macd_line DECIMAL(20, 8),
                        macd_signal DECIMAL(20, 8),
                        macd_histogram DECIMAL(20, 8),
                        ema_20 DECIMAL(20, 8),
                        ema_50 DECIMAL(20, 8),
                        ema_200 DECIMAL(20, 8),
                        ma_5 DECIMAL(20, 8),
                        ma_20 DECIMAL(20, 8),
                        ma_50 DECIMAL(20, 8),
                        ma_200 DECIMAL(20, 8),
                        atr_14 DECIMAL(20, 8),
                        vwap DECIMAL(20, 8),
                        fibonacci_support_1 DECIMAL(20, 8),
                        fibonacci_support_2 DECIMAL(20, 8),
                        fibonacci_support_3 DECIMAL(20, 8),
                        fibonacci_resistance_1 DECIMAL(20, 8),
                        fibonacci_resistance_2 DECIMAL(20, 8),
                        fibonacci_resistance_3 DECIMAL(20, 8),
                        volume_trend VARCHAR(50),
                        volume_price_relationship VARCHAR(50),
                        -- Company information
                        company_name VARCHAR(255),
                        market VARCHAR(50),
                        stock_type VARCHAR(10),
                        primary_exchange VARCHAR(50),
                        currency VARCHAR(10),
                        locale VARCHAR(10),
                        list_date DATE,
                        total_employees INTEGER,
                        description TEXT,
                        shares_outstanding BIGINT,
                        market_cap BIGINT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(symbol, date)
                    );
                """))
                
                # Create indexes for better performance
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_bronze_ohlcv_symbol_date 
                    ON bronze_ohlcv(symbol, date);
                """))
                
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_silver_ohlcv_symbol_date 
                    ON silver_ohlcv(symbol, date);
                """))
                
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_gold_ohlcv_symbol_date 
                    ON gold_ohlcv_daily_metrics(symbol, date);
                """))
                
                # Widen numeric columns on existing tables to avoid ATR/indicator overflow (DECIMAL(10,6) max ~9999)
                for col in ['atr', 'macd_line', 'macd_signal', 'macd_histogram', 'volatility_20', 'daily_return_pct']:
                    try:
                        conn.execute(text(f"ALTER TABLE silver_ohlcv ALTER COLUMN {col} TYPE DECIMAL(20, 8)"))
                    except Exception:
                        pass  # Column may not exist or already correct
                try:
                    conn.execute(text("ALTER TABLE gold_ohlcv_daily_metrics ALTER COLUMN atr_14 TYPE DECIMAL(20, 8)"))
                except Exception:
                    pass
                for col in ['macd_line', 'macd_signal', 'macd_histogram']:
                    try:
                        conn.execute(text(f"ALTER TABLE gold_ohlcv_daily_metrics ALTER COLUMN {col} TYPE DECIMAL(20, 8)"))
                    except Exception:
                        pass
                
            logging.info("✅ PostgreSQL tables created successfully")
            return "Tables created successfully"
            
        except Exception as e:
            logging.error(f"❌ Error creating tables: {e}")
            raise e
    
    @task
    def load_bronze_data(processed_result: Dict[str, Any]):
        """Load raw data into bronze_ohlcv table with chunked processing"""
        df = processed_result['data']
        
        if df.empty:
            logging.warning("No data to load into bronze table")
            return "No data loaded"
        
        try:
            engine = create_engine(POSTGRES_URL)
            
            # Prepare data for insertion
            bronze_columns = [
                'symbol', 'timestamp', 'date', 'open', 'high', 'low', 'close', 'volume', 'vwap', 'transactions', 'ingestion_time',
                'company_name', 'market', 'stock_type', 'primary_exchange', 'currency', 'locale', 'list_date', 
                'total_employees', 'description', 'shares_outstanding', 'market_cap'
            ]
            
            # Only include columns that exist in the dataframe
            available_columns = [col for col in bronze_columns if col in df.columns]
            bronze_data = df[available_columns].copy()
            
            logging.info(f"Loading {len(bronze_data)} records into bronze table in chunks...")
            
            # Process in chunks for efficiency
            chunk_size = 5000  # Process 5000 records at a time
            total_chunks = (len(bronze_data) + chunk_size - 1) // chunk_size
            
            # Use psycopg2 directly for reliable bulk insert
            conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
            try:
                cursor = conn.cursor()
                
                # Clear temp table first
                cursor.execute("DROP TABLE IF EXISTS bronze_ohlcv_temp")
                
                # Create temp table with same structure as bronze_ohlcv
                cursor.execute("""
                    CREATE TABLE bronze_ohlcv_temp (
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
                        company_name TEXT,
                        market VARCHAR(50),
                        stock_type VARCHAR(50),
                        primary_exchange VARCHAR(50),
                        currency VARCHAR(10),
                        locale VARCHAR(10),
                        list_date DATE,
                        total_employees INTEGER,
                        description TEXT,
                        shares_outstanding BIGINT,
                        market_cap BIGINT
                    )
                """)
                conn.commit()
                
                # Prepare data for bulk insert
                for chunk_num in range(total_chunks):
                    start_idx = chunk_num * chunk_size
                    end_idx = min((chunk_num + 1) * chunk_size, len(bronze_data))
                    chunk_df = bronze_data.iloc[start_idx:end_idx]
                    
                    logging.info(f"Processing chunk {chunk_num + 1}/{total_chunks}: {len(chunk_df)} records")
                    
                    # Convert DataFrame to list of tuples for execute_values
                    records = []
                    for _, row in chunk_df.iterrows():
                        records.append((
                            str(row.get('symbol', '')),
                            pd.Timestamp(row.get('timestamp')) if pd.notna(row.get('timestamp')) else None,
                            pd.Timestamp(row.get('date')).date() if pd.notna(row.get('date')) else None,
                            float(row.get('open', 0)) if pd.notna(row.get('open')) else None,
                            float(row.get('high', 0)) if pd.notna(row.get('high')) else None,
                            float(row.get('low', 0)) if pd.notna(row.get('low')) else None,
                            float(row.get('close', 0)) if pd.notna(row.get('close')) else None,
                            float(row.get('volume', 0)) if pd.notna(row.get('volume')) else None,
                            float(row.get('vwap', 0)) if pd.notna(row.get('vwap')) else None,
                            int(row.get('transactions', 0)) if pd.notna(row.get('transactions')) else None,
                            pd.Timestamp(row.get('ingestion_time')) if pd.notna(row.get('ingestion_time')) else None,
                            str(row.get('company_name', '')) if pd.notna(row.get('company_name')) else None,
                            str(row.get('market', '')) if pd.notna(row.get('market')) else None,
                            str(row.get('stock_type', '')) if pd.notna(row.get('stock_type')) else None,
                            str(row.get('primary_exchange', '')) if pd.notna(row.get('primary_exchange')) else None,
                            str(row.get('currency', '')) if pd.notna(row.get('currency')) else None,
                            str(row.get('locale', '')) if pd.notna(row.get('locale')) else None,
                            pd.Timestamp(row.get('list_date')).date() if pd.notna(row.get('list_date')) else None,
                            int(row.get('total_employees', 0)) if pd.notna(row.get('total_employees')) else None,
                            str(row.get('description', '')) if pd.notna(row.get('description')) else None,
                            int(row.get('shares_outstanding', 0)) if pd.notna(row.get('shares_outstanding')) else None,
                            int(row.get('market_cap', 0)) if pd.notna(row.get('market_cap')) else None,
                        ))
                    
                    # Bulk insert using execute_values
                    execute_values(
                        cursor,
                        """INSERT INTO bronze_ohlcv_temp 
                        (symbol, timestamp, date, open, high, low, close, volume, vwap, transactions, ingestion_time,
                         company_name, market, stock_type, primary_exchange, currency, locale, list_date, 
                         total_employees, description, shares_outstanding, market_cap)
                        VALUES %s""",
                        records,
                        page_size=1000
                    )
                    conn.commit()
                
                # Merge data using SQL
                cursor.execute("""
                    INSERT INTO bronze_ohlcv (symbol, timestamp, date, open, high, low, close, volume, vwap, transactions, ingestion_time,
                                            company_name, market, stock_type, primary_exchange, currency, locale, list_date, 
                                            total_employees, description, shares_outstanding, market_cap)
                    SELECT symbol, timestamp, date, open, high, low, close, volume, vwap, transactions, ingestion_time,
                           company_name, market, stock_type, primary_exchange, currency, locale, list_date, 
                           total_employees, description, shares_outstanding, market_cap
                    FROM bronze_ohlcv_temp
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
                        ingestion_time = EXCLUDED.ingestion_time,
                        company_name = EXCLUDED.company_name,
                        market = EXCLUDED.market,
                        stock_type = EXCLUDED.stock_type,
                        primary_exchange = EXCLUDED.primary_exchange,
                        currency = EXCLUDED.currency,
                        locale = EXCLUDED.locale,
                        list_date = EXCLUDED.list_date,
                        total_employees = EXCLUDED.total_employees,
                        description = EXCLUDED.description,
                        shares_outstanding = EXCLUDED.shares_outstanding,
                        market_cap = EXCLUDED.market_cap,
                        created_at = CURRENT_TIMESTAMP
                """)
                
                # Drop temp table
                cursor.execute("DROP TABLE IF EXISTS bronze_ohlcv_temp")
                conn.commit()
                cursor.close()
            finally:
                conn.close()
            
            logging.info(f"✅ Loaded {len(bronze_data)} records into bronze_ohlcv")
            return f"Loaded {len(bronze_data)} bronze records"
            
        except Exception as e:
            logging.error(f"❌ Error loading bronze data: {e}")
            raise e
    
    @task
    def load_silver_data(processed_result: Dict[str, Any]):
        """Load processed data into silver_ohlcv table"""
        df = processed_result['data']
        
        if df.empty:
            logging.warning("No data to load into silver table")
            return "No data loaded"
        
        try:
            # Prepare data for insertion
            silver_columns = [
                'symbol', 'timestamp', 'date', 'open', 'high', 'low', 'close', 'volume', 'vwap', 'transactions',
                'daily_range', 'daily_change', 'daily_return_pct', 'dollar_volume', 'ma_5', 'ma_20', 'ma_50', 'ma_200',
                'ema_20', 'ema_50', 'ema_200', 'macd_line', 'macd_signal', 'macd_histogram', 'atr',
                'volatility_20', 'rsi', 'is_valid', 'ingestion_time',
                'company_name', 'market', 'stock_type', 'primary_exchange', 'currency', 'locale', 'list_date', 
                'total_employees', 'description', 'shares_outstanding', 'market_cap'
            ]
            
            # Only include columns that exist in the dataframe
            available_columns = [col for col in silver_columns if col in df.columns]
            silver_data = df[available_columns].copy()
            
            # Use psycopg2 directly for reliable bulk insert
            conn = psycopg2.connect(POSTGRES_URL, sslmode="require")
            try:
                cursor = conn.cursor()
                
                # Clear temp table first
                cursor.execute("DROP TABLE IF EXISTS silver_ohlcv_temp")
                
                # Create temp table with same structure as silver_ohlcv
                cursor.execute("""
                    CREATE TABLE silver_ohlcv_temp (
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
                        daily_range DECIMAL(20, 8),
                        daily_change DECIMAL(20, 8),
                        daily_return_pct DECIMAL(20, 8),
                        dollar_volume DECIMAL(20, 8),
                        ma_5 DECIMAL(20, 8),
                        ma_20 DECIMAL(20, 8),
                        ma_50 DECIMAL(20, 8),
                        ma_200 DECIMAL(20, 8),
                        ema_20 DECIMAL(20, 8),
                        ema_50 DECIMAL(20, 8),
                        ema_200 DECIMAL(20, 8),
                        macd_line DECIMAL(20, 8),
                        macd_signal DECIMAL(20, 8),
                        macd_histogram DECIMAL(20, 8),
                        atr DECIMAL(20, 8),
                        volatility_20 DECIMAL(20, 8),
                        rsi DECIMAL(20, 8),
                        is_valid BOOLEAN,
                        ingestion_time TIMESTAMP WITH TIME ZONE,
                        company_name TEXT,
                        market VARCHAR(50),
                        stock_type VARCHAR(50),
                        primary_exchange VARCHAR(50),
                        currency VARCHAR(10),
                        locale VARCHAR(10),
                        list_date DATE,
                        total_employees INTEGER,
                        description TEXT,
                        shares_outstanding BIGINT,
                        market_cap BIGINT
                    )
                """)
                conn.commit()
                
                # Convert DataFrame to list of tuples for execute_values
                records = []
                for _, row in silver_data.iterrows():
                    records.append((
                        str(row.get('symbol', '')),
                        pd.Timestamp(row.get('timestamp')) if pd.notna(row.get('timestamp')) else None,
                        pd.Timestamp(row.get('date')).date() if pd.notna(row.get('date')) else None,
                        float(row.get('open', 0)) if pd.notna(row.get('open')) else None,
                        float(row.get('high', 0)) if pd.notna(row.get('high')) else None,
                        float(row.get('low', 0)) if pd.notna(row.get('low')) else None,
                        float(row.get('close', 0)) if pd.notna(row.get('close')) else None,
                        float(row.get('volume', 0)) if pd.notna(row.get('volume')) else None,
                        float(row.get('vwap', 0)) if pd.notna(row.get('vwap')) else None,
                        int(row.get('transactions', 0)) if pd.notna(row.get('transactions')) else None,
                        float(row.get('daily_range', 0)) if pd.notna(row.get('daily_range')) else None,
                        float(row.get('daily_change', 0)) if pd.notna(row.get('daily_change')) else None,
                        float(row.get('daily_return_pct', 0)) if pd.notna(row.get('daily_return_pct')) else None,
                        float(row.get('dollar_volume', 0)) if pd.notna(row.get('dollar_volume')) else None,
                        float(row.get('ma_5', 0)) if pd.notna(row.get('ma_5')) else None,
                        float(row.get('ma_20', 0)) if pd.notna(row.get('ma_20')) else None,
                        float(row.get('ma_50', 0)) if pd.notna(row.get('ma_50')) else None,
                        float(row.get('ma_200', 0)) if pd.notna(row.get('ma_200')) else None,
                        float(row.get('ema_20', 0)) if pd.notna(row.get('ema_20')) else None,
                        float(row.get('ema_50', 0)) if pd.notna(row.get('ema_50')) else None,
                        float(row.get('ema_200', 0)) if pd.notna(row.get('ema_200')) else None,
                        float(row.get('macd_line', 0)) if pd.notna(row.get('macd_line')) else None,
                        float(row.get('macd_signal', 0)) if pd.notna(row.get('macd_signal')) else None,
                        float(row.get('macd_histogram', 0)) if pd.notna(row.get('macd_histogram')) else None,
                        float(row.get('atr', 0)) if pd.notna(row.get('atr')) else None,
                        float(row.get('volatility_20', 0)) if pd.notna(row.get('volatility_20')) else None,
                        float(row.get('rsi', 0)) if pd.notna(row.get('rsi')) else None,
                        bool(row.get('is_valid', False)) if pd.notna(row.get('is_valid')) else None,
                        pd.Timestamp(row.get('ingestion_time')) if pd.notna(row.get('ingestion_time')) else None,
                        str(row.get('company_name', '')) if pd.notna(row.get('company_name')) else None,
                        str(row.get('market', '')) if pd.notna(row.get('market')) else None,
                        str(row.get('stock_type', '')) if pd.notna(row.get('stock_type')) else None,
                        str(row.get('primary_exchange', '')) if pd.notna(row.get('primary_exchange')) else None,
                        str(row.get('currency', '')) if pd.notna(row.get('currency')) else None,
                        str(row.get('locale', '')) if pd.notna(row.get('locale')) else None,
                        pd.Timestamp(row.get('list_date')).date() if pd.notna(row.get('list_date')) else None,
                        int(row.get('total_employees', 0)) if pd.notna(row.get('total_employees')) else None,
                        str(row.get('description', '')) if pd.notna(row.get('description')) else None,
                        int(row.get('shares_outstanding', 0)) if pd.notna(row.get('shares_outstanding')) else None,
                        int(row.get('market_cap', 0)) if pd.notna(row.get('market_cap')) else None,
                    ))
                
                # Bulk insert using execute_values
                execute_values(
                    cursor,
                    """INSERT INTO silver_ohlcv_temp 
                    (symbol, timestamp, date, open, high, low, close, volume, vwap, transactions,
                     daily_range, daily_change, daily_return_pct, dollar_volume, ma_5, ma_20, ma_50, ma_200,
                     ema_20, ema_50, ema_200, macd_line, macd_signal, macd_histogram, atr,
                     volatility_20, rsi, is_valid, ingestion_time,
                     company_name, market, stock_type, primary_exchange, currency, locale, list_date, 
                     total_employees, description, shares_outstanding, market_cap)
                    VALUES %s""",
                    records,
                    page_size=1000
                )
                conn.commit()
                
                # Merge data using SQL
                cursor.execute("""
                    INSERT INTO silver_ohlcv (symbol, timestamp, date, open, high, low, close, volume, vwap, transactions,
                                            daily_range, daily_change, daily_return_pct, dollar_volume, ma_5, ma_20, ma_50, ma_200,
                                            ema_20, ema_50, ema_200, macd_line, macd_signal, macd_histogram, atr,
                                            volatility_20, rsi, is_valid, ingestion_time,
                                            company_name, market, stock_type, primary_exchange, currency, locale, list_date, 
                                            total_employees, description, shares_outstanding, market_cap)
                    SELECT symbol, timestamp, date, open, high, low, close, volume, vwap, transactions,
                           daily_range, daily_change, daily_return_pct, dollar_volume, ma_5, ma_20, ma_50, ma_200,
                           ema_20, ema_50, ema_200, macd_line, macd_signal, macd_histogram, atr,
                           volatility_20, rsi, is_valid, ingestion_time,
                           company_name, market, stock_type, primary_exchange, currency, locale, list_date, 
                           total_employees, description, shares_outstanding, market_cap
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
                        ma_5 = EXCLUDED.ma_5,
                        ma_20 = EXCLUDED.ma_20,
                        ma_50 = EXCLUDED.ma_50,
                        ma_200 = EXCLUDED.ma_200,
                        ema_20 = EXCLUDED.ema_20,
                        ema_50 = EXCLUDED.ema_50,
                        ema_200 = EXCLUDED.ema_200,
                        macd_line = EXCLUDED.macd_line,
                        macd_signal = EXCLUDED.macd_signal,
                        macd_histogram = EXCLUDED.macd_histogram,
                        atr = EXCLUDED.atr,
                        volatility_20 = EXCLUDED.volatility_20,
                        rsi = EXCLUDED.rsi,
                        is_valid = EXCLUDED.is_valid,
                        ingestion_time = EXCLUDED.ingestion_time,
                        company_name = EXCLUDED.company_name,
                        market = EXCLUDED.market,
                        stock_type = EXCLUDED.stock_type,
                        primary_exchange = EXCLUDED.primary_exchange,
                        currency = EXCLUDED.currency,
                        locale = EXCLUDED.locale,
                        list_date = EXCLUDED.list_date,
                        total_employees = EXCLUDED.total_employees,
                        description = EXCLUDED.description,
                        shares_outstanding = EXCLUDED.shares_outstanding,
                        market_cap = EXCLUDED.market_cap,
                        updated_at = CURRENT_TIMESTAMP
                """)
                
                # Drop temp table
                cursor.execute("DROP TABLE IF EXISTS silver_ohlcv_temp")
                conn.commit()
                cursor.close()
            finally:
                conn.close()
            
            logging.info(f"✅ Loaded {len(silver_data)} records into silver_ohlcv")
            return f"Loaded {len(silver_data)} silver records"
            
        except Exception as e:
            logging.error(f"❌ Error loading silver data: {e}")
            raise e
    
    @task
    def recalculate_technical_indicators():
        """Recalculate technical indicators using SQL on existing silver data"""
        try:
            engine = create_engine(POSTGRES_URL)
            
            # Widen numeric columns in separate transactions (avoid transaction abort on error)
            logging.info("🔧 Ensuring silver_ohlcv columns are wide enough...")
            for col in ['atr', 'macd_line', 'macd_signal', 'macd_histogram', 'volatility_20', 'daily_return_pct']:
                try:
                    with engine.begin() as alter_conn:
                        alter_conn.execute(text(f"ALTER TABLE silver_ohlcv ALTER COLUMN {col} TYPE DECIMAL(20, 8) USING {col}::DECIMAL(20, 8)"))
                        logging.info(f"   Widened silver_ohlcv.{col} to DECIMAL(20, 8)")
                except Exception as e:
                    # Silently continue if ALTER fails (column may already be correct or doesn't exist)
                    pass
            
            with engine.begin() as conn:
                logging.info("🚀 Recalculating technical indicators using SQL window functions")
                
                # Update EMA20, EMA50, EMA200 using recursive calculation
                logging.info("📊 Calculating EMAs (20, 50, 200)...")
                conn.execute(text("""
                    WITH ema_calc AS (
                        SELECT 
                            symbol,
                            date,
                            close,
                            -- EMA20: Use MA20 as seed, then calculate recursively
                            CASE 
                                WHEN ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date) >= 20
                                THEN AVG(close) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW)
                                ELSE NULL
                            END as seed_ema_20,
                            -- EMA50
                            CASE 
                                WHEN ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date) >= 50
                                THEN AVG(close) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 49 PRECEDING AND CURRENT ROW)
                                ELSE NULL
                            END as seed_ema_50,
                            -- EMA200
                            CASE 
                                WHEN ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date) >= 200
                                THEN AVG(close) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 199 PRECEDING AND CURRENT ROW)
                                ELSE NULL
                            END as seed_ema_200
                        FROM silver_ohlcv
                        WHERE date >= CURRENT_DATE - INTERVAL '400 days'
                    )
                    UPDATE silver_ohlcv s
                    SET 
                        ema_20 = e.seed_ema_20,
                        ema_50 = e.seed_ema_50,
                        ema_200 = e.seed_ema_200
                    FROM ema_calc e
                    WHERE s.symbol = e.symbol AND s.date = e.date
                      AND s.date >= CURRENT_DATE - INTERVAL '60 days';
                """))
                
                # Update MACD (12-day EMA - 26-day EMA, with 9-day signal)
                logging.info("📊 Calculating MACD...")
                conn.execute(text("""
                    WITH macd_base AS (
                        SELECT 
                            symbol,
                            date,
                            close,
                            -- 12-day EMA approximation
                            CASE 
                                WHEN ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date) >= 12
                                THEN AVG(close) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 11 PRECEDING AND CURRENT ROW)
                                ELSE NULL
                            END as ema_12,
                            -- 26-day EMA approximation  
                            CASE 
                                WHEN ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date) >= 26
                                THEN AVG(close) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 25 PRECEDING AND CURRENT ROW)
                                ELSE NULL
                            END as ema_26
                        FROM silver_ohlcv
                        WHERE date >= CURRENT_DATE - INTERVAL '60 days'
                    ),
                    macd_with_signal AS (
                        SELECT 
                            symbol,
                            date,
                            (ema_12 - ema_26) as macd_line,
                            -- 9-day EMA of MACD line (signal)
                            AVG(ema_12 - ema_26) OVER (
                                PARTITION BY symbol 
                                ORDER BY date 
                                ROWS BETWEEN 8 PRECEDING AND CURRENT ROW
                            ) as macd_signal
                        FROM macd_base
                        WHERE ema_12 IS NOT NULL AND ema_26 IS NOT NULL
                    )
                    UPDATE silver_ohlcv s
                    SET 
                        macd_line = m.macd_line,
                        macd_signal = m.macd_signal,
                        macd_histogram = m.macd_line - m.macd_signal
                    FROM macd_with_signal m
                    WHERE s.symbol = m.symbol AND s.date = m.date;
                """))
                
                # Update ATR (Average True Range)
                logging.info("📊 Calculating ATR...")
                conn.execute(text("""
                    WITH true_range AS (
                        SELECT 
                            symbol,
                            date,
                            GREATEST(
                                high - low,
                                ABS(high - LAG(close, 1) OVER (PARTITION BY symbol ORDER BY date)),
                                ABS(low - LAG(close, 1) OVER (PARTITION BY symbol ORDER BY date))
                            ) as tr
                        FROM silver_ohlcv
                        WHERE date >= CURRENT_DATE - INTERVAL '60 days'
                    ),
                    atr_calc AS (
                        SELECT 
                            symbol,
                            date,
                            AVG(tr) OVER (
                                PARTITION BY symbol 
                                ORDER BY date 
                                ROWS BETWEEN 13 PRECEDING AND CURRENT ROW
                            ) as atr_14
                        FROM true_range
                        WHERE tr IS NOT NULL
                    )
                    UPDATE silver_ohlcv s
                    SET atr = a.atr_14
                    FROM atr_calc a
                    WHERE s.symbol = a.symbol AND s.date = a.date;
                """))
                
                # Update RSI (Relative Strength Index)
                logging.info("📊 Calculating RSI...")
                conn.execute(text("""
                    WITH price_changes AS (
                        SELECT 
                            symbol,
                            date,
                            close - LAG(close, 1) OVER (PARTITION BY symbol ORDER BY date) as price_change
                        FROM silver_ohlcv
                        WHERE date >= CURRENT_DATE - INTERVAL '60 days'
                    ),
                    gains_losses AS (
                        SELECT 
                            symbol,
                            date,
                            CASE WHEN price_change > 0 THEN price_change ELSE 0 END as gain,
                            CASE WHEN price_change < 0 THEN ABS(price_change) ELSE 0 END as loss
                        FROM price_changes
                    ),
                    avg_gains_losses AS (
                        SELECT 
                            symbol,
                            date,
                            AVG(gain) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 13 PRECEDING AND CURRENT ROW) as avg_gain,
                            AVG(loss) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 13 PRECEDING AND CURRENT ROW) as avg_loss
                        FROM gains_losses
                    ),
                    rsi_calc AS (
                        SELECT 
                            symbol,
                            date,
                            CASE 
                                WHEN avg_loss = 0 THEN 100
                                WHEN avg_gain = 0 THEN 0
                                ELSE 100 - (100 / (1 + (avg_gain / NULLIF(avg_loss, 0))))
                            END as rsi_value
                        FROM avg_gains_losses
                        WHERE avg_gain IS NOT NULL AND avg_loss IS NOT NULL
                    )
                    UPDATE silver_ohlcv s
                    SET rsi = r.rsi_value
                    FROM rsi_calc r
                    WHERE s.symbol = r.symbol AND s.date = r.date;
                """))
                
                # Get count of updated records
                result = conn.execute(text("""
                    SELECT COUNT(*) 
                    FROM silver_ohlcv 
                    WHERE date >= CURRENT_DATE - INTERVAL '60 days'
                      AND (ema_20 IS NOT NULL OR macd_line IS NOT NULL OR atr IS NOT NULL OR rsi IS NOT NULL)
                """))
                updated_count = result.fetchone()[0]
                
                logging.info(f"✅ Technical indicators recalculated for {updated_count} records")
                logging.info("✅ All indicators: EMA20/50/200, MACD, ATR, RSI")
            
            return f"Technical indicators recalculated - {updated_count} records updated"
            
        except Exception as e:
            logging.error(f"❌ Error recalculating technical indicators: {e}")
            raise e
    
    @task
    def calculate_gold_metrics():
        """Calculate gold layer metrics - 1 record per symbol with best technical indicator coverage"""
        try:
            engine = create_engine(POSTGRES_URL)
            
            with engine.begin() as conn:
                logging.info("🚀 Calculating gold metrics - 1 record per symbol with best indicators")
                
                # Step 1: Clear existing gold table
                conn.execute(text("DELETE FROM gold_ohlcv_daily_metrics"))
                logging.info("🗑️  Cleared existing gold table")
                
                # Step 2: Insert latest record per symbol with COALESCE for technical indicators
                # Strategy: Use latest date's price data, but fill NULL indicators from most recent valid values
                conn.execute(text("""
                    WITH latest_prices AS (
                        -- Get the absolute latest record per symbol (for price data)
                        SELECT DISTINCT ON (symbol)
                            symbol,
                            date,
                            open,
                            high,
                            low,
                            close,
                            volume as total_volume,
                            vwap as avg_vwap,
                            dollar_volume as total_dollar_volume,
                            daily_range as max_range,
                            daily_return_pct,
                            daily_range as intraday_range,
                            transactions as total_transactions,
                            ingestion_time as last_updated,
                            company_name,
                            market,
                            stock_type,
                            primary_exchange,
                            currency,
                            locale,
                            list_date,
                            total_employees,
                            description,
                            shares_outstanding,
                            market_cap
                        FROM silver_ohlcv
                        WHERE is_valid = true
                          AND date >= CURRENT_DATE - INTERVAL '30 days'
                        ORDER BY symbol, date DESC
                    ),
                    latest_indicators AS (
                        -- Get the most recent non-NULL value for each technical indicator per symbol
                        SELECT DISTINCT ON (symbol)
                            symbol,
                            (SELECT rsi FROM silver_ohlcv WHERE symbol = s.symbol AND rsi IS NOT NULL ORDER BY date DESC LIMIT 1) as rsi_14,
                            (SELECT ma_5 FROM silver_ohlcv WHERE symbol = s.symbol AND ma_5 IS NOT NULL ORDER BY date DESC LIMIT 1) as ma_5,
                            (SELECT ma_20 FROM silver_ohlcv WHERE symbol = s.symbol AND ma_20 IS NOT NULL ORDER BY date DESC LIMIT 1) as ma_20,
                            (SELECT ma_50 FROM silver_ohlcv WHERE symbol = s.symbol AND ma_50 IS NOT NULL ORDER BY date DESC LIMIT 1) as ma_50,
                            (SELECT ma_200 FROM silver_ohlcv WHERE symbol = s.symbol AND ma_200 IS NOT NULL ORDER BY date DESC LIMIT 1) as ma_200,
                            (SELECT ema_20 FROM silver_ohlcv WHERE symbol = s.symbol AND ema_20 IS NOT NULL ORDER BY date DESC LIMIT 1) as ema_20,
                            (SELECT ema_50 FROM silver_ohlcv WHERE symbol = s.symbol AND ema_50 IS NOT NULL ORDER BY date DESC LIMIT 1) as ema_50,
                            (SELECT ema_200 FROM silver_ohlcv WHERE symbol = s.symbol AND ema_200 IS NOT NULL ORDER BY date DESC LIMIT 1) as ema_200,
                            (SELECT macd_line FROM silver_ohlcv WHERE symbol = s.symbol AND macd_line IS NOT NULL ORDER BY date DESC LIMIT 1) as macd_line,
                            (SELECT macd_signal FROM silver_ohlcv WHERE symbol = s.symbol AND macd_signal IS NOT NULL ORDER BY date DESC LIMIT 1) as macd_signal,
                            (SELECT macd_histogram FROM silver_ohlcv WHERE symbol = s.symbol AND macd_histogram IS NOT NULL ORDER BY date DESC LIMIT 1) as macd_histogram,
                            (SELECT atr FROM silver_ohlcv WHERE symbol = s.symbol AND atr IS NOT NULL ORDER BY date DESC LIMIT 1) as atr_14,
                            (SELECT vwap FROM silver_ohlcv WHERE symbol = s.symbol AND vwap IS NOT NULL ORDER BY date DESC LIMIT 1) as vwap
                        FROM silver_ohlcv s
                        WHERE is_valid = true
                          AND date >= CURRENT_DATE - INTERVAL '30 days'
                        GROUP BY symbol
                    )
                    INSERT INTO gold_ohlcv_daily_metrics (
                        symbol, date, open, high, low, close, last_close, change_pct, total_volume, avg_vwap,
                        total_dollar_volume, max_range, daily_return_pct, intraday_range,
                        total_transactions, last_updated,
                        rsi_14, ma_5, ma_20, ma_50, ma_200,
                        ema_20, ema_50, ema_200,
                        macd_line, macd_signal, macd_histogram,
                        atr_14, vwap,
                        company_name, market, stock_type, primary_exchange,
                        currency, locale, list_date, total_employees,
                        description, shares_outstanding, market_cap
                    )
                    SELECT 
                        lp.symbol, lp.date, lp.open, lp.high, lp.low, lp.close,
                        LAG(lp.close) OVER (PARTITION BY lp.symbol ORDER BY lp.date) as last_close,
                        CASE 
                            WHEN LAG(lp.close) OVER (PARTITION BY lp.symbol ORDER BY lp.date) > 0 
                            THEN ROUND(((lp.close - LAG(lp.close) OVER (PARTITION BY lp.symbol ORDER BY lp.date)) / LAG(lp.close) OVER (PARTITION BY lp.symbol ORDER BY lp.date)) * 100, 2)
                            ELSE NULL 
                        END as change_pct,
                        lp.total_volume, lp.avg_vwap, lp.total_dollar_volume, lp.max_range, 
                        lp.daily_return_pct, lp.intraday_range, lp.total_transactions, lp.last_updated,
                        li.rsi_14, li.ma_5, li.ma_20, li.ma_50, li.ma_200,
                        li.ema_20, li.ema_50, li.ema_200,
                        li.macd_line, li.macd_signal, li.macd_histogram,
                        li.atr_14, li.vwap,
                        lp.company_name, lp.market, lp.stock_type, lp.primary_exchange,
                        lp.currency, lp.locale, lp.list_date, lp.total_employees,
                        lp.description, lp.shares_outstanding, lp.market_cap
                    FROM latest_prices lp
                    LEFT JOIN latest_indicators li ON lp.symbol = li.symbol;
                """))
                
                # Get counts for logging
                result = conn.execute(text("SELECT COUNT(*) FROM gold_ohlcv_daily_metrics"))
                gold_count = result.fetchone()[0]
                
                logging.info(f"✅ Gold layer populated with {gold_count} records (1 per symbol)")
                logging.info("✅ Each record has LATEST price data + most recent valid technical indicators")
            
            return f"Gold metrics calculated successfully - {gold_count} symbols"
            
        except Exception as e:
            logging.error(f"❌ Error calculating gold metrics: {e}")
            raise e
    
    @task
    def cleanup_old_data():
        """Clean up old data beyond retention period"""
        try:
            engine = create_engine(POSTGRES_URL)
            cutoff_date = date.today() - timedelta(days=RETENTION_DAYS)
            
            with engine.begin() as conn:
                # Clean up old data from all tables
                for table in ['bronze_ohlcv', 'silver_ohlcv', 'gold_ohlcv_daily_metrics']:
                    result = conn.execute(text(f"""
                        DELETE FROM {table} 
                        WHERE date < :cutoff_date
                    """), {'cutoff_date': cutoff_date})
                    
                    deleted_rows = result.rowcount
                    logging.info(f"Cleaned {deleted_rows} old records from {table}")
            
            logging.info(f"✅ Cleanup completed for data older than {cutoff_date}")
            return f"Cleanup completed for data older than {cutoff_date}"
            
        except Exception as e:
            logging.error(f"❌ Error during cleanup: {e}")
            raise e
    
    # Define task dependencies - simplified flow
    tickers = get_all_tickers()
    
    # Fetch 10 days of OHLCV data for all tickers
    ohlcv_data = fetch_ohlcv_data(tickers)
    
    # No additional ranking needed - get_all_tickers() already returns top 1000 by volume
    ranked_data = ohlcv_data
    
    # Fetch company information for selected tickers only
    company_info_result = fetch_company_info(ranked_data)
    
    # Merge company info with OHLCV data and calculate market cap
    merged_data = merge_company_info_and_calculate_market_cap(ranked_data, company_info_result)
    
    # Create tables first
    create_tables = create_postgres_tables()
    
    # Load bronze data (depends on table creation and merged data)
    bronze_load = load_bronze_data(merged_data)
    bronze_load.set_upstream([create_tables, merged_data])
    
    # Process and enrich data (creates silver data with technical indicators)
    silver_processed = process_and_enrich_data(merged_data)
    silver_processed.set_upstream(bronze_load)
    
    # Load silver data (with technical indicators) - using MERGE strategy
    silver_load = load_silver_data(silver_processed)
    silver_load.set_upstream(silver_processed)
    
    # Recalculate technical indicators using SQL (ensures accurate calculations with full history)
    recalc_indicators = recalculate_technical_indicators()
    recalc_indicators.set_upstream(silver_load)
    
    # Calculate gold metrics (depends on silver data with recalculated indicators)
    gold_metrics = calculate_gold_metrics()
    gold_metrics.set_upstream(recalc_indicators)
    
    # Cleanup old data
    cleanup = cleanup_old_data()
    cleanup.set_upstream([bronze_load, silver_load, gold_metrics])

# Create the DAG instance
polygon_ohlcv_dag = polygon_ohlcv_dag()

