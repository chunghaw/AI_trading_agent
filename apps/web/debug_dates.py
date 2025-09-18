#!/usr/bin/env python3
"""
Debug date ranges in Milvus database
"""
import os
import json
import sys
from datetime import datetime, timedelta

# Set environment variables for testing
os.environ["MILVUS_URI"] = "https://in03-85d251bbc78827a.serverless.aws-eu-central-1.cloud.zilliz.com"
os.environ["MILVUS_USER"] = "db_85d251bbc78827a"
os.environ["MILVUS_PASSWORD"] = "Sq4-)tA,N]RwXsSm"

def debug_dates():
    print("🧪 Debugging date ranges...")
    
    try:
        from pymilvus import MilvusClient
        
        client = MilvusClient(
            uri=os.environ["MILVUS_URI"],
            user=os.environ["MILVUS_USER"],
            password=os.environ["MILVUS_PASSWORD"],
            secure=True
        )
        
        # Get all NVDA articles with their dates
        results = client.query(
            collection_name="polygon_news_data",
            filter='ticker == "NVDA"',
            output_fields=["title", "published_utc"],
            limit=100
        )
        
        print(f"📊 Found {len(results)} NVDA articles")
        
        # Parse and sort dates
        dates = []
        for result in results:
            date_str = result.get('published_utc', '')
            try:
                # Handle different date formats
                if 'T' in date_str:
                    if date_str.endswith('Z'):
                        date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    else:
                        date_obj = datetime.fromisoformat(date_str)
                else:
                    date_obj = datetime.fromisoformat(date_str)
                
                dates.append((date_obj, date_str, result.get('title', '')))
            except Exception as e:
                print(f"❌ Failed to parse date: {date_str} - {e}")
        
        # Sort by date
        dates.sort(key=lambda x: x[0], reverse=True)
        
        print(f"\n📅 Date range analysis:")
        if dates:
            newest = dates[0]
            oldest = dates[-1]
            print(f"  Newest: {newest[0]} ({newest[1]})")
            print(f"  Oldest: {oldest[0]} ({oldest[1]})")
            
            # Show recent articles
            print(f"\n📰 Recent articles (last 10):")
            for i, (date_obj, date_str, title) in enumerate(dates[:10]):
                print(f"  {i+1}. {date_obj.strftime('%Y-%m-%d %H:%M')} - {title[:80]}...")
        
        # Test different date filters
        print(f"\n🔍 Testing date filters:")
        
        # Last 7 days
        week_ago = (datetime.now() - timedelta(days=7)).isoformat()
        week_results = client.query(
            collection_name="polygon_news_data",
            filter=f'ticker == "NVDA" && published_utc >= "{week_ago}"',
            output_fields=["title", "published_utc"],
            limit=50
        )
        print(f"  Last 7 days: {len(week_results)} articles")
        
        # Last 30 days
        month_ago = (datetime.now() - timedelta(days=30)).isoformat()
        month_results = client.query(
            collection_name="polygon_news_data",
            filter=f'ticker == "NVDA" && published_utc >= "{month_ago}"',
            output_fields=["title", "published_utc"],
            limit=50
        )
        print(f"  Last 30 days: {len(month_results)} articles")
        
        # Last year
        year_ago = (datetime.now() - timedelta(days=365)).isoformat()
        year_results = client.query(
            collection_name="polygon_news_data",
            filter=f'ticker == "NVDA" && published_utc >= "{year_ago}"',
            output_fields=["title", "published_utc"],
            limit=50
        )
        print(f"  Last year: {len(year_results)} articles")
        
        # No date filter
        all_results = client.query(
            collection_name="polygon_news_data",
            filter='ticker == "NVDA"',
            output_fields=["title", "published_utc"],
            limit=50
        )
        print(f"  All time: {len(all_results)} articles")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Debug failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_dates()
