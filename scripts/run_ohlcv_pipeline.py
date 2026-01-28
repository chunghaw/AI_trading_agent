#!/usr/bin/env python3
"""Standalone OHLCV Pipeline - runs without Airflow"""
import os
import sys
import logging

dag_path = os.path.join(os.path.dirname(__file__), 'dags', 'trading')
sys.path.insert(0, dag_path)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_task_function(task):
    """Extract the underlying function from an Airflow task"""
    # Try different attributes that might contain the function
    if hasattr(task, 'function'):
        return task.function
    elif hasattr(task, 'python_callable'):
        return task.python_callable
    elif hasattr(task, '_python_callable'):
        return task._python_callable
    elif callable(task):
        return task
    else:
        raise AttributeError(f"Cannot extract function from task {task}")

def main():
    logging.info("🚀 Starting OHLCV Pipeline")
    try:
        from polygon_ohlcv_dag import polygon_ohlcv_dag
        dag = polygon_ohlcv_dag()
        tasks = dag.task_dict
        
        # Verify all required tasks exist
        required_tasks = [
            'get_all_tickers', 'fetch_ohlcv_data', 'fetch_company_info',
            'merge_company_info_and_calculate_market_cap', 'create_postgres_tables',
            'load_bronze_data', 'process_and_enrich_data', 'load_silver_data',
            'recalculate_technical_indicators', 'calculate_gold_metrics', 'cleanup_old_data'
        ]
        missing = [t for t in required_tasks if t not in tasks]
        if missing:
            raise ValueError(f"Missing required tasks: {missing}. Available tasks: {list(tasks.keys())}")
        
        # Get tickers
        get_tickers_fn = get_task_function(tasks['get_all_tickers'])
        tickers = get_tickers_fn()
        logging.info(f"✅ Got {len(tickers)} tickers")
        
        # Fetch OHLCV data
        fetch_ohlcv_fn = get_task_function(tasks['fetch_ohlcv_data'])
        ohlcv_result = fetch_ohlcv_fn(tickers)
        logging.info(f"✅ Fetched {ohlcv_result.get('total_records', 0)} records")
        
        # Fetch company info
        fetch_company_fn = get_task_function(tasks['fetch_company_info'])
        company_info = fetch_company_fn(ohlcv_result)
        logging.info("✅ Company info fetched")
        
        # Merge data
        merge_fn = get_task_function(tasks['merge_company_info_and_calculate_market_cap'])
        merged_data = merge_fn(ohlcv_result, company_info)
        logging.info("✅ Data merged")
        
        # Create tables
        create_tables_fn = get_task_function(tasks['create_postgres_tables'])
        create_tables_fn()
        logging.info("✅ Tables created")
        
        # Load bronze
        load_bronze_fn = get_task_function(tasks['load_bronze_data'])
        load_bronze_fn(merged_data)
        logging.info("✅ Bronze loaded")
        
        # Process silver
        process_silver_fn = get_task_function(tasks['process_and_enrich_data'])
        silver_result = process_silver_fn(merged_data)
        logging.info("✅ Silver processed")
        
        # Load silver
        load_silver_fn = get_task_function(tasks['load_silver_data'])
        load_silver_fn(silver_result)
        logging.info("✅ Silver loaded")
        
        # Recalculate indicators
        recalc_fn = get_task_function(tasks['recalculate_technical_indicators'])
        recalc_fn()
        logging.info("✅ Indicators recalculated")
        
        # Calculate gold metrics
        gold_fn = get_task_function(tasks['calculate_gold_metrics'])
        gold_fn()
        logging.info("✅ Gold metrics calculated")
        
        # Cleanup
        cleanup_fn = get_task_function(tasks['cleanup_old_data'])
        cleanup_fn()
        logging.info("✅ Cleanup completed")
        
        logging.info("🎉 Pipeline completed!")
    except Exception as e:
        logging.error(f"❌ Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
