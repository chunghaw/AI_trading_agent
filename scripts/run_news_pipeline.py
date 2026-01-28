#!/usr/bin/env python3
"""Standalone News Pipeline - runs without Airflow"""
import os
import sys
import logging

dag_path = os.path.join(os.path.dirname(__file__), 'dags', 'news_rag')
sys.path.insert(0, dag_path)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_task_function(task):
    """Extract the underlying function from an Airflow task"""
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
    logging.info("🚀 Starting News Pipeline")
    try:
        from polygon_news_milvus_managed import polygon_news_milvus_managed
        dag = polygon_news_milvus_managed()
        tasks = dag.task_dict
        
        # Verify all required tasks exist
        required_tasks = ['cleanup_old_data', 'ingest_new_data', 'get_stats']
        missing = [t for t in required_tasks if t not in tasks]
        if missing:
            raise ValueError(f"Missing required tasks: {missing}. Available tasks: {list(tasks.keys())}")
        
        cleanup_fn = get_task_function(tasks['cleanup_old_data'])
        cleanup_fn()
        logging.info("✅ Old data cleaned")
        
        ingest_fn = get_task_function(tasks['ingest_new_data'])
        ingest_fn()
        logging.info("✅ News ingested to Milvus")
        
        stats_fn = get_task_function(tasks['get_stats'])
        stats = stats_fn()
        logging.info(f"✅ Stats: {stats}")
        
        logging.info("🎉 Pipeline completed!")
    except Exception as e:
        logging.error(f"❌ Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
