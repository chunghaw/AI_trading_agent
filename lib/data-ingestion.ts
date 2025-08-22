import { MilvusService, createNewsDocument, createOHLCVDocument } from './milvus';
import { PolygonAPI, getDateRange } from './polygon';

export class DataIngestionService {
  private milvusService: MilvusService;
  private polygonAPI: PolygonAPI;

  constructor() {
    this.milvusService = new MilvusService();
    this.polygonAPI = new PolygonAPI();
  }

  async ingestTradingKnowledge() {
    try {
      console.log('Starting trading knowledge ingestion...');

      // Connect to Milvus
      await this.milvusService.connect();

      // Define symbols to ingest
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'ADBE', 'CRM'];
      
      // Get date range for the last 30 days
      const dateRange = getDateRange('1m');

      for (const symbol of symbols) {
        console.log(`Ingesting data for ${symbol}...`);
        
        try {
          // Fetch news data
          const newsData = await this.polygonAPI.getNews(symbol, dateRange.from, dateRange.to);
          
          // Ingest news articles
          for (const article of newsData.slice(0, 5)) { // Limit to 5 articles per symbol
            const document = createNewsDocument(article, symbol);
            await this.milvusService.insertDocument(document);
          }

          // Fetch OHLCV data
          const ohlcvData = await this.polygonAPI.getOHLCV(symbol, '1', dateRange.from, dateRange.to);
          
          // Ingest OHLCV data (last 10 days)
          for (const data of ohlcvData.slice(-10)) {
            const document = createOHLCVDocument(data, symbol);
            await this.milvusService.insertDocument(document);
          }

          console.log(`✅ Ingested ${newsData.length} news articles and ${ohlcvData.length} OHLCV records for ${symbol}`);
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`❌ Failed to ingest data for ${symbol}:`, error);
        }
      }

      // Ingest general trading knowledge
      await this.ingestGeneralTradingKnowledge();

      console.log('✅ Trading knowledge ingestion completed!');
      
    } catch (error) {
      console.error('❌ Data ingestion failed:', error);
      throw error;
    }
  }

  private async ingestGeneralTradingKnowledge() {
    const generalKnowledge = [
      {
        id: 'trading_basics_1',
        text: 'Technical analysis involves studying price charts and using statistical indicators to predict future price movements. Common indicators include RSI, MACD, moving averages, and Bollinger Bands.',
        metadata: {
          source: 'trading_education',
          type: 'technical',
          confidence: 0.95
        }
      },
      {
        id: 'trading_basics_2',
        text: 'Fundamental analysis evaluates a company\'s financial health, business model, competitive advantages, and market position to determine intrinsic value. Key metrics include P/E ratio, revenue growth, profit margins, and debt levels.',
        metadata: {
          source: 'trading_education',
          type: 'fundamental',
          confidence: 0.95
        }
      },
      {
        id: 'risk_management_1',
        text: 'Risk management is crucial in trading. Never risk more than 1-2% of your portfolio on a single trade. Use stop-loss orders to limit potential losses and diversify across different sectors and asset classes.',
        metadata: {
          source: 'risk_management',
          type: 'portfolio',
          confidence: 0.98
        }
      },
      {
        id: 'market_sentiment_1',
        text: 'Market sentiment reflects the overall attitude of investors toward a particular security or market. It can be bullish (positive), bearish (negative), or neutral. Sentiment indicators include the VIX fear index, put-call ratios, and social media sentiment analysis.',
        metadata: {
          source: 'market_analysis',
          type: 'market_data',
          confidence: 0.90
        }
      },
      {
        id: 'portfolio_diversification_1',
        text: 'Portfolio diversification reduces risk by spreading investments across different assets, sectors, and geographies. A well-diversified portfolio typically includes stocks, bonds, commodities, and alternative investments.',
        metadata: {
          source: 'portfolio_strategy',
          type: 'portfolio',
          confidence: 0.92
        }
      },
      {
        id: 'technical_indicators_1',
        text: 'RSI (Relative Strength Index) measures momentum on a scale of 0 to 100. Values above 70 indicate overbought conditions, while values below 30 indicate oversold conditions. MACD (Moving Average Convergence Divergence) shows the relationship between two moving averages.',
        metadata: {
          source: 'technical_analysis',
          type: 'technical',
          confidence: 0.88
        }
      },
      {
        id: 'earnings_analysis_1',
        text: 'Earnings reports are crucial for fundamental analysis. Key metrics include EPS (Earnings Per Share), revenue growth, profit margins, and forward guidance. Earnings beats or misses can significantly impact stock prices.',
        metadata: {
          source: 'fundamental_analysis',
          type: 'fundamental',
          confidence: 0.85
        }
      },
      {
        id: 'market_timing_1',
        text: 'Market timing involves attempting to predict market movements to buy low and sell high. However, timing the market is extremely difficult and most professional investors recommend a long-term buy-and-hold strategy.',
        metadata: {
          source: 'investment_strategy',
          type: 'portfolio',
          confidence: 0.87
        }
      }
    ];

    for (const knowledge of generalKnowledge) {
      await this.milvusService.insertDocument(knowledge);
    }

    console.log(`✅ Ingested ${generalKnowledge.length} general trading knowledge documents`);
  }
}

// API endpoint to trigger data ingestion
export async function triggerDataIngestion() {
  const ingestionService = new DataIngestionService();
  return await ingestionService.ingestTradingKnowledge();
}
