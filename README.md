# AI Trading Agent

A modern, RAG-powered trading system with a Next.js frontend and Python FastAPI backend, featuring human-in-the-loop (HITL) approval workflows, comprehensive risk management, and automated data pipelines powered by Databricks DLT and Airflow.

## 🚀 Features

### Core System
- **RAG-Powered Analysis**: Retrieval-Augmented Generation using OpenAI GPT-4o and Milvus vector database
- **Multi-Agent Architecture**: Specialized AI agents for news analysis, risk assessment, and portfolio management
- **Human-in-the-Loop**: Manual approval workflow for trading proposals
- **Real-time Dashboard**: Modern Next.js interface with live market data and analytics
- **Risk Management**: Comprehensive risk assessment and portfolio constraints
- **Standardized APIs**: Pydantic models for consistent data validation

### Data Infrastructure
- **Databricks DLT for OHLCV Data**: Delta Live Tables for real-time market data processing and technical indicators
- **Airflow Milvus for News Data**: Automated pipeline for Polygon news ingestion, embedding, and vector storage
- **Multi-Source Integration**: Polygon (equities), Binance (crypto), NewsAPI integration
- **Technical Indicators**: RSI, MACD, Bollinger Bands, EMA, ATR computed in Databricks
- **Vector Search**: Semantic news search and context retrieval using Milvus

### Trading Capabilities
- **News Sentiment Analysis**: Real-time news monitoring and sentiment scoring
- **Technical Analysis**: Advanced indicators and pattern recognition
- **Risk Assessment**: Position, market, liquidity, and concentration risk evaluation
- **Portfolio Management**: Position sizing, diversification, and constraint enforcement
- **Proposal Workflow**: Create, review, approve/reject trading proposals

## 🏗️ Architecture

### System Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js Web   │    │  FastAPI Worker │    │   Vector DB     │
│   Frontend      │◄──►│   (Python)      │◄──►│   (Milvus)      │
│                 │    │                 │    │                 │
│ • Dashboard     │    │ • RAG Agents    │    │ • News Embeddings│
│ • HITL Approval │    │ • Risk Manager  │    │ • Knowledge Base│
│ • Real-time UI  │    │ • Proposals     │    │ • Context Search│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Webhook API   │    │   SQLite DB     │    │   OpenAI API    │
│   (Validation)  │    │   (Proposals)   │    │   (GPT-4o)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Airflow DAGs   │    │ Databricks DLT  │    │  Market Data    │
│ • News Pipeline │    │ • OHLCV Pipeline│    │ • Polygon       │
│ • Milvus Store  │    │ • Indicators    │    │ • Binance       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Pipeline Architecture

#### 1. Databricks DLT - OHLCV Data Pipeline
```
Polygon OHLCV API → Airflow DAG → Databricks DLT → Delta Lake → Trading System
```
- **Source**: Polygon.io OHLCV API
- **Pipeline**: `dags/trading/polygon_ohlcv_to_databricks.py`
- **Processing**: 
  - Real-time market data ingestion
  - Technical indicator computation (RSI, MACD, EMA, ATR, Bollinger Bands)
  - Data quality checks and validation
  - Delta Lake storage for ACID transactions
- **Output**: Processed OHLCV data with computed technical indicators
- **Benefits**: 
  - Real-time data processing with DLT
  - Automatic data quality monitoring
  - Scalable compute resources
  - Built-in data versioning and time travel

#### 2. Airflow Milvus - News Data Pipeline
```
Polygon News API → Airflow DAG → OpenAI Embeddings → Milvus Vector DB → RAG Analysis
```
- **Source**: Polygon.io News API
- **Pipeline**: `airflow-dbt-project/dags/news_rag/polygon_news_milvus_managed.py`
- **Processing**:
  - Automated news collection and filtering
  - OpenAI text embedding generation
  - Vector storage in Milvus for semantic search
  - Real-time indexing and retrieval
- **Output**: Vector embeddings for semantic search and RAG-powered analysis
- **Benefits**:
  - Automated pipeline orchestration
  - Scalable vector search capabilities
  - Real-time news context retrieval
  - Fault-tolerant data processing

#### 3. Analysis Pipeline
```
User Query → News Search (Milvus) → Technical Analysis (Databricks) → RAG Synthesis → Trading Recommendation
```
- **News Analysis**: Semantic search in Milvus for relevant news articles
- **Technical Analysis**: Indicator-based analysis using Databricks-computed data
- **RAG Synthesis**: OpenAI GPT-4o combines news and technical insights
- **Output**: Comprehensive trading analysis with separate News and Technical Analyst perspectives

## 🛠️ Installation

### Prerequisites
- Python 3.11+
- Node.js 20+
- OpenAI API key
- Polygon API key
- Databricks workspace (for DLT)
- Milvus instance (cloud or self-hosted)
- Airflow instance (for pipeline orchestration)

### 🔐 Environment Setup

**Required Environment Variables:**
```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Polygon API
POLYGON_API_KEY=your_polygon_api_key_here

# Milvus Configuration
MILVUS_ADDRESS=your_milvus_host:19530
MILVUS_SSL=true
MILVUS_USERNAME=your_username
MILVUS_PASSWORD=your_password
MILVUS_DB=your_database
MILVUS_COLLECTION_NEWS=news_chunks

# Databricks Configuration
DATABRICKS_HOST=your_databricks_workspace_url
DATABRICKS_TOKEN=your_databricks_token
DATABRICKS_CATALOG=your_catalog
DATABRICKS_SCHEMA=your_schema

# News RAG Configuration
NEWS_TOPK=48
NEWS_FINAL_K=12

# OHLCV Data Sources
OHLCV_PARQUET_URI=s3://your-bucket/ohlcv/
# OR for local development
OHLCV_LOCAL_DIR=./data/ohlcv
```

### Quick Start

1. **Clone and setup**:
```bash
git clone <repository-url>
cd AI_trading_agent
```

2. **Setup Python environment**:
```bash
cd apps/worker
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. **Setup Node.js environment**:
```bash
cd apps/web
npm install
```

4. **Configure environment**:
```bash
# Copy example environment files
cp apps/worker/env.example apps/worker/.env
cp apps/web/env.example apps/web/.env.local

# Edit with your API keys and configuration
```

5. **Start the services**:
```bash
# Terminal 1: Start worker API
cd apps/worker
source venv/bin/activate
python -m worker

# Terminal 2: Start web frontend
cd apps/web
npm run dev
```

6. **Access the application**:
- Web Dashboard: http://localhost:3001
- Worker API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## 📊 Usage

### Web Dashboard
1. Navigate to http://localhost:3001
2. View real-time market data and analytics
3. Analyze stocks with AI-powered insights
4. Monitor portfolio performance and risk metrics

### API Usage
```bash
# Analyze a symbol
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the outlook for AAPL stock?",
    "symbol": "AAPL"
  }'

# Get market data
curl http://localhost:8000/market-data/AAPL

# Get system status
curl http://localhost:8000/health
```

### Data Pipeline Management

#### Databricks DLT Pipeline
```python
# The DLT pipeline automatically:
# 1. Ingests OHLCV data from Polygon
# 2. Computes technical indicators
# 3. Stores in Delta Lake with ACID guarantees
# 4. Provides real-time access to processed data
```

#### Airflow Milvus Pipeline
```python
# The Airflow pipeline automatically:
# 1. Collects news from Polygon News API
# 2. Generates embeddings using OpenAI
# 3. Stores vectors in Milvus
# 4. Enables semantic search for RAG
```

## 🔧 Configuration

### Databricks DLT Settings
```python
# DLT Pipeline Configuration
DLT_SETTINGS = {
    "catalog": "trading_data",
    "schema": "market_data",
    "table": "ohlcv_indicators",
    "compute": "trading_cluster",
    "data_quality": True,
    "expectations": {
        "volume_not_null": "volume IS NOT NULL",
        "price_positive": "close > 0"
    }
}
```

### Airflow Milvus Settings
```python
# Milvus Pipeline Configuration
MILVUS_SETTINGS = {
    "collection_name": "news_chunks",
    "dimension": 1536,  # OpenAI embedding dimension
    "metric_type": "COSINE",
    "index_type": "IVF_FLAT",
    "nlist": 1024
}
```

### Risk Management Settings
```python
RISK_SETTINGS = {
    "max_position_risk": 0.1,        # 10% max per position
    "max_market_risk": 0.2,          # 20% market risk limit
    "max_liquidity_risk": 0.15,      # 15% liquidity risk limit
    "max_concentration_risk": 0.25,  # 25% concentration limit
    "daily_loss_cap": 0.05,          # 5% daily loss cap
    "min_confidence_threshold": 0.7  # Minimum confidence for approval
}
```

## 🧪 Testing

### Run Tests
```bash
# Python tests
cd apps/worker
python -m pytest tests/ -v

# Web tests
cd apps/web
npm run test

# Build test
npm run build
```

## 📈 Monitoring

### Health Checks
- **Web Health**: `GET /api/healthz`
- **Worker Health**: `GET /health`
- **Database Status**: Automatic monitoring
- **RAG System**: Vector database connectivity
- **Data Pipelines**: Pipeline status and data quality

### Logging
- Structured logging with Loguru
- Request/response tracking
- Error monitoring and alerting
- Performance metrics

## 🚀 Deployment

### Vercel Deployment (Web Frontend)
```bash
# Navigate to web directory
cd apps/web

# Run deployment script
./deploy-vercel.sh

# Or deploy manually:
# 1. Push to GitHub
# 2. Connect to Vercel
# 3. Set environment variables
# 4. Deploy
```

### Production Considerations
- Use cloud-hosted Milvus (Zilliz Cloud)
- Set up Databricks Unity Catalog for data governance
- Configure Airflow for production DAGs
- Implement proper monitoring and alerting
- Use environment-specific configurations
- Set up SSL/TLS certificates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

**This software is for educational and research purposes only. It is not intended for actual trading and should not be used with real money. Trading involves substantial risk of loss and is not suitable for all investors. Always consult with a qualified financial advisor before making any investment decisions.**

## 🆘 Support

- **Documentation**: See `/docs` directory
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions

---

**Built with ❤️ using Next.js, FastAPI, OpenAI, Milvus, Databricks DLT, and Airflow** 