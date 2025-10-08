#!/usr/bin/env python3
"""
Run Polygon OHLCV DAG locally to load data into database
"""

import sys
import os
sys.path.append('/Users/chunghaw/Documents/AI Bootcamp 2025/airflow-dbt-project')

from dags.trading.polygon_ohlcv_dag import (
    get_all_tickers, 
    fetch_ohlcv_data, 
    fetch_company_info,
    merge_company_info_and_calculate_market_cap,
    process_and_enrich_data,
    create_postgres_tables,
    load_bronze_data,
    load_silver_data,
    recalculate_technical_indicators,
    calculate_gold_metrics
)

def run_dag_locally():
    """Run the DAG steps locally"""
    print("🚀 Running Polygon OHLCV DAG locally...")
    
    try:
        # Step 1: Get tickers
        print("\n📊 Step 1: Getting tickers...")
        tickers = get_all_tickers()
        print(f"✅ Got {len(tickers)} tickers")
        
        # Step 2: Fetch OHLCV data
        print("\n📊 Step 2: Fetching OHLCV data...")
        ohlcv_data = fetch_ohlcv_data(tickers)
        print(f"✅ Fetched {ohlcv_data['total_records']} records")
        
        # Step 3: Fetch company info
        print("\n📊 Step 3: Fetching company info...")
        company_info_result = fetch_company_info(ohlcv_data)
        print(f"✅ Got company info for {company_info_result['total_fetched']} companies")
        
        # Step 4: Merge data
        print("\n📊 Step 4: Merging company info...")
        merged_data = merge_company_info_and_calculate_market_cap(ohlcv_data, company_info_result)
        print("✅ Data merged successfully")
        
        # Step 5: Create tables
        print("\n📊 Step 5: Creating tables...")
        create_tables()
        print("✅ Tables created")
        
        # Step 6: Process and enrich data
        print("\n📊 Step 6: Processing and enriching data...")
        processed_data = process_and_enrich_data(merged_data)
        print(f"✅ Processed {processed_data['total_records']} records")
        
        # Step 7: Load bronze data
        print("\n📊 Step 7: Loading bronze data...")
        bronze_result = load_bronze_data(processed_data)
        print(f"✅ {bronze_result}")
        
        # Step 8: Load silver data
        print("\n📊 Step 8: Loading silver data...")
        silver_result = load_silver_data(processed_data)
        print(f"✅ {silver_result}")
        
        # Step 9: Recalculate technical indicators
        print("\n📊 Step 9: Recalculating technical indicators...")
        indicators_result = recalculate_technical_indicators()
        print(f"✅ {indicators_result}")
        
        # Step 10: Calculate gold metrics
        print("\n📊 Step 10: Calculating gold metrics...")
        gold_result = calculate_gold_metrics()
        print(f"✅ {gold_result}")
        
        print("\n" + "="*80)
        print("🎉 DAG completed successfully!")
        print("✅ Data is now loaded and ready for the UI")
        print("="*80)
        
    except Exception as e:
        print(f"❌ Error running DAG: {e}")
        raise

if __name__ == "__main__":
    run_dag_locally()
