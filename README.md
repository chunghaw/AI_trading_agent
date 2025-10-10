# AI Trading Agent 🚀

A sophisticated AI-powered trading analysis system that combines real-time market data, news sentiment analysis, and technical indicators to provide comprehensive investment insights. Built with Next.js, PostgreSQL, Milvus vector database, and OpenAI GPT-4o.

## ✨ Features

### 🎯 Core Capabilities
- **Real-time Market Analysis**: Live OHLCV data with technical indicators (RSI, MACD, EMA, ATR, VWAP)
- **AI-Powered News Analysis**: Semantic search and sentiment analysis using vector embeddings
- **Multi-Agent Architecture**: Specialized AI agents for news, technical, and synthesis analysis
- **TradingView-Style UI**: Professional trading interface with price indicators and sentiment badges
- **Comprehensive Reporting**: Detailed analysis with bullish/neutral/bearish sentiment indicators

### 🏗️ Architecture
- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes with PostgreSQL integration
- **AI**: OpenAI GPT-4o for analysis and synthesis
- **Vector Database**: Milvus for semantic news search
- **Data Pipeline**: Airflow DAGs for automated data ingestion
- **Database**: PostgreSQL with bronze/silver/gold data architecture

## 🚀 Live Demo

**Experience the system**: [AI Trading Agent Demo](https://ai-trading-agent-git-main-chunghaw.vercel.app/)

### Sample Queries
- "What is the technical analysis for NVDA?"
- "Should I buy GOOGL based on recent news?"
- "Analyze AAPL's portfolio positioning"
- "What's the market sentiment for TSLA?"

## 📊 Data Pipeline

### Bronze Layer
- Raw Polygon API data ingestion
- Minimal processing, direct API response storage
- Used for backup and reprocessing

### Silver Layer  
- Cleaned, validated OHLCV time series data
- Standardized formats and data types
- Historical data storage (3-year retention)
- Technical indicator calculations (RSI, MACD, EMA, ATR)

### Gold Layer
- Aggregated indicators and company information
- Latest row per ticker with pre-calculated technical indicators
- Company metadata integration
- Price change calculations (current vs previous close)

### News Layer
- Milvus vector database for semantic search
- Curated article list with embeddings
- Real-time news sentiment analysis

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Lucide icons
- **State Management**: React hooks and context

### Backend
- **API**: Next.js API routes
- **Database**: PostgreSQL (Neon Cloud)
- **Vector Database**: Milvus (Zilliz Cloud)
- **AI**: OpenAI GPT-4o-mini
- **Orchestration**: Apache Airflow

### Data Sources
- **Market Data**: Polygon.io API
- **News Data**: Polygon News API
- **Company Data**: Polygon Company API

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database
- OpenAI API key
- Polygon API key
- Milvus instance

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/chunghaw/AI_trading_agent.git
cd AI_trading_agent
```

2. **Install dependencies**
```bash
cd apps/web
npm install
```

3. **Set up environment variables**
```bash
# Create .env.local file
POSTGRES_URL=your_postgresql_connection_string
MILVUS_URI=your_milvus_uri
MILVUS_USER=your_milvus_user
MILVUS_PASSWORD=your_milvus_password
MILVUS_COLLECTION=polygon_news_data
OPENAI_API_KEY=your_openai_api_key
POLYGON_API_KEY=your_polygon_api_key
```

4. **Run the development server**
```bash
npm run dev
```

5. **Access the application**
- Open [http://localhost:3000](http://localhost:3000)
- Start analyzing stocks with AI-powered insights

## 📈 Usage Examples

### Web Interface
1. Navigate to the main page
2. Enter a stock analysis query (e.g., "What is the technical analysis for NVDA?")
3. View comprehensive analysis including:
   - Company information with price indicators
   - News sentiment analysis with sources
   - Technical indicators table
   - AI-generated insights and recommendations

### API Usage
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the technical analysis for NVDA?"}'
```

## 🎨 UI Features

### TradingView-Style Price Indicators
- Current price display with daily change
- Color-coded indicators (green for gains, red for losses)
- Change amount and percentage
- TrendingUp/TrendingDown icons

### Sentiment Analysis Badges
- **BULLISH**: Green badges for positive sentiment
- **NEUTRAL**: Yellow badges for neutral sentiment  
- **BEARISH**: Red badges for negative sentiment
- Applied to News Analysis, Technical Analysis, and Overall Analysis sections

### Professional Layout
- Dark theme optimized for trading interfaces
- Responsive design for all screen sizes
- Real-time data updates
- Comprehensive error handling

## 🔧 Configuration

### DAG Scheduling
- **OHLCV Data**: Twice daily (5am and 5pm SGT)
- **News Data**: Daily (5am SGT)
- **Scope**: Top 1000 US stocks by market cap

### Technical Indicators
- RSI (14-period)
- MACD (12, 26, 9)
- EMA (20, 50, 200)
- ATR (14-period)
- VWAP
- Volume trend analysis

## 🧪 Testing

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

## 🚀 Deployment

### Vercel Deployment
1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically on push

### Environment Variables for Production
```bash
POSTGRES_URL=your_production_postgres_url
MILVUS_URI=your_production_milvus_uri
MILVUS_USER=your_production_milvus_user
MILVUS_PASSWORD=your_production_milvus_password
MILVUS_COLLECTION=polygon_news_data
OPENAI_API_KEY=your_openai_api_key
POLYGON_API_KEY=your_polygon_api_key
```

## 📊 Performance

- **Response Time**: < 3 seconds for complete analysis
- **Data Freshness**: Real-time market data with 2x daily updates
- **News Coverage**: 20+ popular tickers with semantic search
- **Technical Indicators**: Pre-calculated for optimal performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

**This software is for educational and research purposes only. It is not intended for actual trading and should not be used with real money. Trading involves substantial risk of loss and is not suitable for all investors. Always consult with a qualified financial advisor before making any investment decisions.**

## 🆘 Support

- **Documentation**: See `/docs` directory
- **Issues**: [GitHub Issues](https://github.com/chunghaw/AI_trading_agent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/chunghaw/AI_trading_agent/discussions)

---

**Built with ❤️ using Next.js, PostgreSQL, Milvus, OpenAI, and Airflow**

**Connect with me on LinkedIn**: [Tan Chung Haw](https://linkedin.com/in/chunghaw)