# Data Ingestion Guide

## ✅ **Current Status**

The system is now working with:
- ✅ **Fixed DuckDB build error** - Replaced with JSON-based data reading
- ✅ **Working API endpoint** - `/api/analyze` returns proper JSON
- ✅ **Mock data generation** - System works without real data
- ✅ **Technical indicators** - All KPIs calculated correctly

## 🚀 **To Ingest Real Data from Polygon**

### **1. Set Up Environment Variables**

Create `apps/worker/.env`:
```bash
# Polygon API
POLYGON_API_KEY=your_polygon_api_key_here

# Milvus Configuration
MILVUS_ADDRESS=localhost:19530
MILVUS_SSL=false
MILVUS_USERNAME=
MILVUS_PASSWORD=
MILVUS_COLLECTION_NEWS=news_chunks

# Data directories
OHLCV_LOCAL_DIR=../data/ohlcv
WATCHLIST=NVDA,MSFT,AAPL,AMD,TSLA,GOOGL
```

### **2. Install Python Dependencies**

```bash
cd apps/worker
pip install requests pandas openai pymilvus tiktoken
```

### **3. Run Data Ingestion**

```bash
cd apps/worker
python ingest_polygon_data.py
```

This will:
- Fetch 30 days of OHLCV data for each symbol
- Save to JSON files in `../data/ohlcv/{symbol}/1d.json`
- Fetch news articles and ingest into Milvus
- Generate embeddings for semantic search

### **4. Verify Data Ingestion**

Check the created files:
```bash
ls -la ../data/ohlcv/
# Should show directories for each symbol

ls -la ../data/ohlcv/NVDA/
# Should show 1d.json file
```

### **5. Test with Real Data**

Once data is ingested, the API will automatically use real data instead of mock data.

## 📊 **Data Structure**

### **OHLCV JSON Files**
```json
[
  {
    "ts": "2024-01-15T00:00:00.000000Z",
    "open": 850.25,
    "high": 865.50,
    "low": 845.75,
    "close": 860.00,
    "volume": 25000000,
    "symbol": "NVDA",
    "timeframe": "1d"
  }
]
```

### **Milvus Collection Schema**
- `id`: Unique article ID
- `text`: News content chunk
- `url`: Article URL
- `published_utc`: Publication timestamp
- `ticker`: Stock symbol
- `source`: News source
- `embedding`: 1536-dimensional vector

## 🔄 **Automated Ingestion**

### **Option 1: Airflow DAG**
The existing DAG at `apps/worker/dags/polygon_ohlcv_to_parquet.py` can be used for automated ingestion.

### **Option 2: Cron Job**
```bash
# Add to crontab
0 */6 * * * cd /path/to/ai_trading_agent/apps/worker && python ingest_polygon_data.py
```

### **Option 3: Manual Updates**
Run the ingestion script whenever you need fresh data:
```bash
cd apps/worker
python ingest_polygon_data.py
```

## 🛠 **Troubleshooting**

### **Polygon API Issues**
- Check API key is valid
- Verify rate limits (5 requests/second for free tier)
- Ensure symbols are valid tickers

### **Milvus Connection Issues**
- Verify Milvus is running: `docker ps | grep milvus`
- Check connection parameters in `.env`
- Ensure collection exists and is indexed

### **File Permission Issues**
- Ensure write permissions to `../data/ohlcv/`
- Create directories manually if needed

## 📈 **Current Implementation**

The system now works with:
1. **Mock data** when no real data is available
2. **Real OHLCV data** from JSON files when available
3. **Real news data** from Milvus when available
4. **Graceful degradation** when data sources are unavailable

## 🎯 **Next Steps**

1. **Set up Polygon API key** and run ingestion
2. **Configure Milvus** for news storage
3. **Test with real data** to verify accuracy
4. **Set up automated ingestion** for continuous updates

---

**Status**: ✅ **Ready for Data Ingestion**
**Next Action**: Run `python ingest_polygon_data.py` with valid Polygon API key
