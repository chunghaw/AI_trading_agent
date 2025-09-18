#!/usr/bin/env python3
"""
Debug script to identify timeout issues
"""
import os
import json
import time
import sys

def test_import_time():
    """Test how long imports take"""
    start_time = time.time()
    
    print("🧪 Testing import times...")
    
    # Test basic imports
    try:
        import os
        import json
        print(f"✅ Basic imports: {time.time() - start_time:.2f}s")
    except Exception as e:
        print(f"❌ Basic imports failed: {e}")
    
    # Test pymilvus import
    pymilvus_start = time.time()
    try:
        from pymilvus import MilvusClient
        print(f"✅ pymilvus import: {time.time() - pymilvus_start:.2f}s")
    except ImportError as e:
        print(f"❌ pymilvus import failed: {e}")
        # Try to install
        install_start = time.time()
        try:
            import subprocess
            subprocess.check_call([sys.executable, "-m", "pip", "install", "pymilvus"], 
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"✅ pymilvus install: {time.time() - install_start:.2f}s")
            
            # Try import again
            from pymilvus import MilvusClient
            print(f"✅ pymilvus import after install: {time.time() - pymilvus_start:.2f}s")
        except Exception as install_error:
            print(f"❌ pymilvus install failed: {install_error}")
            return False
    
    return True

def test_connection_time():
    """Test how long connection takes"""
    print("\n🧪 Testing connection time...")
    
    try:
        from pymilvus import MilvusClient
        
        # Get environment variables
        milvus_uri = os.getenv("MILVUS_URI")
        milvus_user = os.getenv("MILVUS_USER")
        milvus_password = os.getenv("MILVUS_PASSWORD")
        
        if not milvus_uri:
            print("❌ No Milvus URI configured")
            return False
        
        connection_start = time.time()
        
        # Create client
        client = MilvusClient(
            uri=milvus_uri,
            user=milvus_user,
            password=milvus_password,
            secure=True
        )
        print(f"✅ Client creation: {time.time() - connection_start:.2f}s")
        
        # Test connection
        list_start = time.time()
        collections = client.list_collections()
        print(f"✅ List collections: {time.time() - list_start:.2f}s")
        
        client.close()
        print(f"✅ Total connection time: {time.time() - connection_start:.2f}s")
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

def test_search_time():
    """Test how long search takes"""
    print("\n🧪 Testing search time...")
    
    try:
        from pymilvus import MilvusClient
        
        # Get environment variables
        milvus_uri = os.getenv("MILVUS_URI")
        milvus_user = os.getenv("MILVUS_USER")
        milvus_password = os.getenv("MILVUS_PASSWORD")
        milvus_collection = os.getenv("MILVUS_COLLECTION_NEWS", "polygon_news_data")
        
        search_start = time.time()
        
        # Create client
        client = MilvusClient(
            uri=milvus_uri,
            user=milvus_user,
            password=milvus_password,
            secure=True
        )
        
        # Test simple query
        query_start = time.time()
        results = client.query(
            collection_name=milvus_collection,
            expr="ticker == \"AAPL\"",
            output_fields=["text", "url", "published_utc", "ticker"],
            limit=5
        )
        print(f"✅ Query execution: {time.time() - query_start:.2f}s")
        print(f"✅ Found {len(results)} results")
        
        client.close()
        print(f"✅ Total search time: {time.time() - search_start:.2f}s")
        
        return True
        
    except Exception as e:
        print(f"❌ Search failed: {e}")
        return False

def main():
    """Main test function"""
    print("🔍 Milvus Timeout Debug Test")
    print("=" * 50)
    
    total_start = time.time()
    
    # Test imports
    if not test_import_time():
        print("❌ Import test failed")
        return False
    
    # Test connection
    if not test_connection_time():
        print("❌ Connection test failed")
        return False
    
    # Test search
    if not test_search_time():
        print("❌ Search test failed")
        return False
    
    total_time = time.time() - total_start
    print(f"\n✅ All tests passed in {total_time:.2f}s")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
