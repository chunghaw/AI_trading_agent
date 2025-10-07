#!/usr/bin/env python3

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

try:
    from pymilvus import connections, utility, Collection
    print("✅ pymilvus imported successfully")
except ImportError as e:
    print(f"❌ Failed to import pymilvus: {e}")
    print("Install with: pip install pymilvus")
    sys.exit(1)

def test_milvus_connection():
    print("🧪 Testing Milvus Connection...\n")
    
    # Check environment variables
    config = {
        'uri': os.getenv('MILVUS_URI', 'not set'),
        'address': os.getenv('MILVUS_ADDRESS', 'not set'),
        'user': os.getenv('MILVUS_USER', 'not set'),
        'username': os.getenv('MILVUS_USERNAME', 'not set'),
        'ssl': os.getenv('MILVUS_SSL', 'not set'),
        'collection': os.getenv('MILVUS_COLLECTION_NEWS', 'polygon_news_data')
    }
    
    print("🔧 Configuration:")
    for key, value in config.items():
        print(f"  {key}: {value}")
    print()
    
    if not config['uri'] and not config['address']:
        print("❌ No Milvus URI configured")
        return
    
    # Determine connection parameters
    uri = config['uri'] if config['uri'] != 'not set' else config['address']
    user = config['user'] if config['user'] != 'not set' else config['username']
    password = os.getenv('MILVUS_PASSWORD', '')
    ssl = config['ssl'].lower() == 'true' if config['ssl'] != 'not set' else False
    
    try:
        print("🔗 Connecting to Milvus...")
        connections.connect(
            alias="default",
            uri=uri,
            user=user,
            password=password,
            secure=ssl
        )
        print("✅ Connected successfully!")
        
        # List collections
        collections = utility.list_collections()
        print(f"📁 Found {len(collections)} collections: {collections}")
        
        target_collection = config['collection']
        if target_collection in collections:
            print(f"🎯 Target collection '{target_collection}': ✅ Found")
            
            try:
                # Get collection info
                collection = Collection(target_collection)
                print(f"📊 Collection '{target_collection}' info:")
                print(f"  - Schema: {collection.schema}")
                print(f"  - Indexes: {collection.indexes}")
                print(f"  - Number of entities: {collection.num_entities}")
                
                # Test search if collection has data
                if collection.num_entities > 0:
                    print("🔍 Testing search capability...")
                    # Create a dummy vector (assuming 1536 dimensions for text-embedding-3-small)
                    dummy_vector = [[0.1] * 1536]
                    search_results = collection.search(
                        data=dummy_vector,
                        anns_field="embedding",  # Adjust field name as needed
                        param={"metric_type": "COSINE", "params": {"nprobe": 10}},
                        limit=1,
                        output_fields=["*"]
                    )
                    print("✅ Search test successful!")
                else:
                    print("⚠️ Collection is empty, skipping search test")
                    
            except Exception as collection_error:
                print(f"❌ Collection test failed: {collection_error}")
                
        else:
            print(f"❌ Target collection '{target_collection}': Not found")
            
    except Exception as error:
        print(f"❌ Connection failed: {error}")
        print(f"Error type: {type(error).__name__}")
        
    finally:
        try:
            connections.disconnect("default")
            print("🔒 Connection closed")
        except:
            pass

if __name__ == "__main__":
    test_milvus_connection()

