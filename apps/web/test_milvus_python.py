#!/usr/bin/env python3
"""
Test Milvus connection using Python client
"""
import os
import sys
import json

def test_milvus_connection():
    print("🧪 Testing Milvus Connection with Python Client...")
    
    # Get environment variables
    milvus_uri = os.getenv("MILVUS_URI")
    milvus_user = os.getenv("MILVUS_USER")
    milvus_password = os.getenv("MILVUS_PASSWORD")
    milvus_collection = os.getenv("MILVUS_COLLECTION_NEWS", "polygon_news_data")
    
    print(f"🔧 Configuration:")
    print(f"  URI: {milvus_uri}")
    print(f"  User: {milvus_user}")
    print(f"  Password: {'***SET***' if milvus_password else 'NOT SET'}")
    print(f"  Collection: {milvus_collection}")
    
    if not milvus_uri:
        print("❌ No Milvus URI configured")
        return False
    
    try:
        # Try to import pymilvus
        try:
            from pymilvus import MilvusClient, Collection
            print("✅ Successfully imported pymilvus")
        except ImportError as e:
            print(f"❌ Failed to import pymilvus: {e}")
            print("Installing pymilvus...")
            os.system("pip install pymilvus")
            from pymilvus import MilvusClient, Collection
        
        # Create client
        print("🔗 Creating Milvus client...")
        client = MilvusClient(
            uri=milvus_uri,
            user=milvus_user,
            password=milvus_password,
            secure=True  # Use SSL for HTTPS URIs
        )
        print("✅ Milvus client created successfully")
        
        # Test connection
        print("🔍 Testing connection...")
        collections = client.list_collections()
        print(f"✅ Connection successful! Found {len(collections)} collections: {collections}")
        
        # Check if target collection exists
        if milvus_collection in collections:
            print(f"✅ Target collection '{milvus_collection}' found!")
            
            # Get collection info
            collection_info = client.describe_collection(milvus_collection)
            print(f"📊 Collection info: {json.dumps(collection_info, indent=2, default=str)}")
            
        else:
            print(f"❌ Target collection '{milvus_collection}' not found")
            print(f"Available collections: {collections}")
        
        client.close()
        print("🔒 Connection closed")
        return True
        
    except Exception as e:
        print(f"❌ Milvus connection failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_milvus_connection()
    sys.exit(0 if success else 1)
