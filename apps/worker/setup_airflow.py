#!/usr/bin/env python3
"""
Setup script for Airflow local development
"""

import os
import subprocess
import sys
from pathlib import Path

def run_command(command, cwd=None):
    """Run a shell command and return the result"""
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=True
        )
        print(f"✅ {command}")
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"❌ {command}")
        print(f"Error: {e.stderr}")
        return None

def setup_airflow():
    """Set up Airflow environment"""
    print("🚀 Setting up Airflow...")
    
    # Set Airflow home
    airflow_home = Path(__file__).parent / "airflow_home"
    airflow_home.mkdir(exist_ok=True)
    os.environ['AIRFLOW_HOME'] = str(airflow_home)
    
    print(f"📁 Airflow home: {airflow_home}")
    
    # Initialize Airflow database
    print("🗄️ Initializing Airflow database...")
    run_command("airflow db init")
    
    # Create admin user
    print("👤 Creating admin user...")
    run_command("airflow users create --username admin --firstname Admin --lastname User --role Admin --email admin@example.com --password admin")
    
    # Set up connections (if needed)
    print("🔗 Setting up connections...")
    
    # Copy DAGs to Airflow DAGs folder
    dags_folder = airflow_home / "dags"
    dags_folder.mkdir(exist_ok=True)
    
    # Copy our DAGs
    source_dags = Path(__file__).parent / "dags"
    if source_dags.exists():
        for dag_file in source_dags.glob("*.py"):
            import shutil
            shutil.copy2(dag_file, dags_folder)
            print(f"📋 Copied DAG: {dag_file.name}")
    
    print("✅ Airflow setup completed!")

def start_airflow():
    """Start Airflow services"""
    print("🚀 Starting Airflow services...")
    
    # Start webserver
    print("🌐 Starting Airflow webserver...")
    webserver_cmd = "airflow webserver --port 8080 --daemon"
    run_command(webserver_cmd)
    
    # Start scheduler
    print("⏰ Starting Airflow scheduler...")
    scheduler_cmd = "airflow scheduler --daemon"
    run_command(scheduler_cmd)
    
    print("✅ Airflow services started!")
    print("🌐 Web UI: http://localhost:8080")
    print("👤 Username: admin")
    print("🔑 Password: admin")

def stop_airflow():
    """Stop Airflow services"""
    print("🛑 Stopping Airflow services...")
    
    run_command("airflow scheduler stop")
    run_command("airflow webserver stop")
    
    print("✅ Airflow services stopped!")

def check_airflow_status():
    """Check if Airflow is running"""
    print("🔍 Checking Airflow status...")
    
    # Check if processes are running
    result = run_command("ps aux | grep airflow | grep -v grep")
    if result:
        print("✅ Airflow processes are running")
        print(result)
    else:
        print("❌ No Airflow processes found")

def test_dag():
    """Test the DAG manually"""
    print("🧪 Testing DAG manually...")
    
    # Set environment variables
    os.environ['POLYGON_API_KEY'] = 'test_key'
    os.environ['OPENAI_API_KEY'] = 'test_openai_key'
    os.environ['MILVUS_HOST'] = 'localhost'
    os.environ['MILVUS_PORT'] = '19530'
    os.environ['MILVUS_SSL'] = 'false'
    os.environ['MILVUS_COLLECTION_NEWS'] = 'test_news_chunks'
    os.environ['NEWS_TICKERS'] = 'NVDA,AMD'
    os.environ['NEWS_TTL_DAYS'] = '120'
    
    # Test DAG
    result = run_command("airflow dags test polygon_news_to_milvus $(date +%Y-%m-%d)")
    if result:
        print("✅ DAG test completed successfully!")
    else:
        print("❌ DAG test failed!")

def main():
    """Main function"""
    if len(sys.argv) < 2:
        print("Usage: python setup_airflow.py [setup|start|stop|status|test]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "setup":
        setup_airflow()
    elif command == "start":
        start_airflow()
    elif command == "stop":
        stop_airflow()
    elif command == "status":
        check_airflow_status()
    elif command == "test":
        test_dag()
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()
