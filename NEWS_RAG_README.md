# Production-Grade News RAG System

A robust, production-ready news RAG (Retrieval Augmented Generation) system for AI trading analysis with Airflow DAGs, Milvus vector search, and OpenAI integration.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Polygon API   │───▶│   Airflow DAG   │───▶│   Milvus DB     │
│   (News Data)   │    │  (Daily Ingest) │    │ (Vector Store)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │◀───│   OpenAI API    │◀───│   RAG Search    │
│   (Frontend)    │    │  (GPT-4o)       │    │  (Rerank)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Environment Setup

**Web App (Next.js):**
```bash
cd apps/web
cp env.example .env.local
# Edit .env.local with your API keys
```

**Worker (Airflow):**
```bash
cd apps/worker
cp env.template .env
# Edit .env with your API keys
```

### 2. Install Dependencies

**Web App:**
```bash
cd apps/web
npm install
```

**Worker:**
```bash
cd apps/worker
pip install -r requirements.txt
```

### 3. Start Services

**Web App:**
```bash
cd apps/web
npm run dev
```

**Airflow (Local):**
```bash
cd apps/worker
airflow db init
airflow users create --username admin --password admin --firstname Admin --lastname User --role Admin --email admin@example.com
airflow webserver --port 8080
airflow scheduler
```

## 📊 Data Flow

### 1. News Ingestion (Airflow DAG)

**Schedule:** Daily at 06:00 UTC
**Source:** Polygon API
**Destination:** Milvus `news_chunks` collection

**Features:**
- ✅ Deduplication by SHA1(url|published_utc|ticker)
- ✅ Monthly partitions (p_YYYY_MM)
- ✅ TTL cleanup (180 days)
- ✅ Watermark tracking per ticker
- ✅ HNSW index with COSINE similarity
- ✅ Text chunking (1500 chars max)

**Collection Schema:**
```sql
id (VARCHAR(64), PK)
text (VARCHAR)                # title + body
embedding (FLOAT_VECTOR, 1536)
title (VARCHAR)
url (VARCHAR)
source (VARCHAR)
ticker (VARCHAR)
published_utc (VARCHAR)       # ISO8601
```

### 2. News Search (RAG)

**Process:**
1. **Initial Search:** TOPK=48 with filters (ticker, date)
2. **Reranking:** Semantic score + recency + ticker match + domain quality
3. **Diversity:** Max 3 articles per source/domain
4. **Final Results:** FINAL_K=12 diverse, high-quality articles

**Reranking Factors:**
- Base semantic similarity (0-1)
- Recency boost (decay over 30 days)
- Ticker match boost (exact vs synonym)
- Domain quality boost (reputable sources)
- Query relevance boost (title matches)

### 3. Analysis (OpenAI)

**Model:** GPT-4o
**Input:** News docs + Technical indicators + Numeric candidates
**Output:** Strict JSON schema with rationale, action, confidence

## 🔧 Configuration

### Environment Variables

**Common:**
```bash
OPENAI_API_KEY=sk-...
MILVUS_ADDRESS=localhost:19530
MILVUS_SSL=false
MILVUS_USERNAME=
MILVUS_PASSWORD=
MILVUS_DB=
MILVUS_COLLECTION_NEWS=news_chunks
```

**Airflow Worker:**
```bash
POLYGON_API_KEY=...
NEWS_TICKERS=NVDA,GOOGL,MSFT,AMZN,TSLA,META
NEWS_TTL_DAYS=180
```

**Next.js App:**
```bash
NEWS_TOPK=48          # initial Milvus recall
NEWS_FINAL_K=12       # after rerank
```

### Airflow Variables

The DAG automatically manages these variables:
- `news_watermark_NVDA`: Latest processed timestamp for NVDA
- `news_watermark_GOOGL`: Latest processed timestamp for GOOGL
- etc.

## 📈 Monitoring

### Airflow Dashboard
- **URL:** http://localhost:8080
- **Username:** admin
- **Password:** admin

### DAG Monitoring
- **Success Rate:** Track DAG runs and failures
- **Data Volume:** Monitor articles ingested per run
- **Watermarks:** Check latest processed timestamps
- **TTL Cleanup:** Verify old data removal

### Milvus Monitoring
- **Collection Stats:** Document count, partition info
- **Index Health:** HNSW index performance
- **Search Metrics:** Query latency, recall rates

## 🛠️ Development

### Adding New Tickers

1. **Update Environment:**
```bash
NEWS_TICKERS=NVDA,GOOGL,MSFT,AMZN,TSLA,META,NEW_TICKER
```

2. **Restart Airflow:**
```bash
airflow scheduler restart
```

### Modifying Search Logic

**File:** `apps/web/lib/milvus.ts`
- `calculateRerankScore()`: Adjust scoring weights
- `ensureDiversity()`: Change diversity rules
- `SYN()`: Add ticker synonyms

### Customizing Prompts

**File:** `apps/web/lib/report.prompts.ts`
- `buildCombinedPrompt()`: Modify analysis instructions
- Add new technical indicators
- Adjust confidence thresholds

## 🚨 Error Handling

### No Data Scenarios
- **Missing Collection:** Returns 4xx with clear error message
- **Empty Results:** Widens search window, then returns empty
- **API Failures:** Graceful degradation with error logging

### Data Quality Gates
- **OHLCV:** Minimum 200 bars, ascending order, non-constant
- **News:** Valid URLs, timestamps, ticker matches
- **Embeddings:** 1536 dimensions, normalized vectors

## 🔒 Security

### API Keys
- Store in environment variables
- Never commit to version control
- Rotate regularly

### Data Access
- Milvus authentication (username/password)
- SSL encryption for cloud deployments
- Network isolation for production

## 📊 Performance

### Optimization Tips
- **Batch Processing:** Process multiple tickers in parallel
- **Index Tuning:** Adjust HNSW parameters (M, efConstruction)
- **Caching:** Cache embeddings for repeated queries
- **Partitioning:** Use monthly partitions for faster queries

### Scaling
- **Horizontal:** Multiple Airflow workers
- **Vertical:** Increase Milvus resources
- **Caching:** Redis for frequent queries
- **CDN:** For static assets

## 🧪 Testing

### Unit Tests
```bash
cd apps/worker
pytest tests/test_airflow_dag.py
```

### Integration Tests
```bash
# Test Milvus connection
python -c "from lib.milvus import client; print('Connected')"

# Test OpenAI embedding
python -c "from lib.milvus import embed; print(len(embed('test')))"
```

### Load Testing
```bash
# Test search performance
ab -n 100 -c 10 http://localhost:3000/api/analyze
```

## 📚 API Reference

### Analyze Endpoint
```typescript
POST /api/analyze
{
  "prompt": "Analyze NVDA's recent performance",
  "symbol": "NVDA",
  "since_days": 7,
  "k": 12,
  "timeframe": "1d"
}
```

### Response Schema
```typescript
{
  symbol: string;
  timeframe: string;
  answer: string;
  action: "BUY" | "SELL" | "FLAT";
  confidence: number;
  bullets: string[];
  indicators: {
    rsi14: number;
    macd: number;
    macd_signal: number;
    macd_hist: number;
    ema20: number;
    ema50: number;
    ema200: number;
    atr14: number;
  };
  levels: {
    support: number[];
    resistance: number[];
    breakout_trigger: number;
  };
  news: {
    summary: string[];
    citations: string[];
  };
  technical: {
    summary: string[];
    chart_notes?: string;
  };
  portfolio: {
    size_suggestion_pct: number;
    tp: number[];
    sl: number;
  };
}
```

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch
3. **Implement** your changes
4. **Test** thoroughly
5. **Submit** a pull request

## 📄 License

MIT License - see LICENSE file for details.
