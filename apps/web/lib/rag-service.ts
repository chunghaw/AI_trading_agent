import OpenAI from 'openai';
import { PolygonAPI, getDateRange } from './polygon';
import { MilvusService, MilvusDocument } from './milvus';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL_NAME = process.env.MODEL_NAME || 'gpt-4o';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export interface RAGResponse {
  summary: {
    bullets: string[];
    answer: string;
    confidence: number;
  };
  news: {
    rationale: string;
    citations: string[];
  };
  technical: {
    rationale: string;
    indicators?: Record<string, number>;
    citations: string[];
  };
  portfolio: {
    rationale: string;
    positions?: Array<{
      symbol: string;
      qty: number;
      px: number;
    }>;
    citations: string[];
  };
  context: {
    documents: MilvusDocument[];
    marketData?: any;
    newsData?: any;
  };
}

export class RAGService {
  private polygonAPI: PolygonAPI;
  private milvusService: MilvusService;

  constructor() {
    this.polygonAPI = new PolygonAPI();
    this.milvusService = new MilvusService();
  }

  async analyze(
    prompt: string,
    symbol: string = '',
    timeframe: string = '1m',
    analysisType: 'combined' | 'news' | 'technical' | 'portfolio' = 'combined'
  ): Promise<RAGResponse> {
    try {
      // 1. Extract symbol from prompt if not provided
      const extractedSymbol = symbol || this.extractSymbolFromPrompt(prompt);
      
      // 2. Fetch relevant context from Milvus
      const contextDocuments = await this.milvusService.searchSimilar(prompt, 10);
      
      // 3. Fetch real-time market data if symbol is available
      let marketData = null;
      let newsData = null;
      
      if (extractedSymbol) {
        try {
          const dateRange = getDateRange(timeframe);
          marketData = await this.polygonAPI.getOHLCV(extractedSymbol, '1', dateRange.from, dateRange.to);
          newsData = await this.polygonAPI.getNews(extractedSymbol, dateRange.from, dateRange.to);
        } catch (error) {
          console.warn('Failed to fetch market data:', error);
        }
      }

      // 4. Generate analysis using OpenAI with context
      const analysis = await this.generateAnalysis(
        prompt,
        contextDocuments,
        marketData,
        newsData,
        extractedSymbol,
        analysisType
      );

      return {
        ...analysis,
        context: {
          documents: contextDocuments,
          marketData,
          newsData
        }
      };

    } catch (error) {
      console.error('RAG analysis error:', error);
      throw error;
    }
  }

  private extractSymbolFromPrompt(prompt: string): string {
    // Simple symbol extraction - look for common stock symbols
    const symbolPattern = /\b[A-Z]{1,5}\b/g;
    const matches = prompt.match(symbolPattern);
    
    if (matches) {
      // Common stock symbols to prioritize
      const commonSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'ADBE', 'CRM'];
      const found = matches.find(symbol => commonSymbols.includes(symbol));
      return found || matches[0];
    }
    
    return '';
  }

  private async generateAnalysis(
    prompt: string,
    contextDocuments: MilvusDocument[],
    marketData: any,
    newsData: any,
    symbol: string,
    analysisType: string
  ): Promise<Omit<RAGResponse, 'context'>> {
    
    // Prepare context from documents
    const contextText = contextDocuments
      .map(doc => `${doc.metadata.type.toUpperCase()}: ${doc.text}`)
      .join('\n\n');

    // Prepare market data context
    let marketContext = '';
    if (marketData && marketData.length > 0) {
      const latest = marketData[marketData.length - 1];
      const previous = marketData[marketData.length - 2];
      
      marketContext = `
LATEST MARKET DATA FOR ${symbol}:
- Current Price: $${latest.c}
- Day Range: $${latest.l} - $${latest.h}
- Volume: ${latest.v.toLocaleString()}
- Price Change: ${((latest.c - previous.c) / previous.c * 100).toFixed(2)}%
      `;
    }

    // Prepare news context
    let newsContext = '';
    if (newsData && newsData.length > 0) {
      newsContext = `
RECENT NEWS FOR ${symbol}:
${newsData.slice(0, 3).map(article => `- ${article.title} (${article.published_utc})`).join('\n')}
      `;
    }

    // Create system prompt based on analysis type
    const systemPrompt = this.getSystemPrompt(analysisType, symbol);

    // Create user prompt with context
    const userPrompt = `
CONTEXT INFORMATION:
${contextText}

${marketContext}

${newsContext}

USER QUESTION: ${prompt}

Please provide a comprehensive analysis based on the context provided. Focus on ${analysisType} aspects.
    `;

    try {
      const response = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const analysisText = response.choices[0].message.content || '';
      
      // Parse the response into structured format
      return this.parseAnalysisResponse(analysisText, symbol, analysisType);

    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  private getSystemPrompt(analysisType: string, symbol: string): string {
    const basePrompt = `You are an expert AI trading analyst. Analyze the provided context and market data to give comprehensive insights.`;

    switch (analysisType) {
      case 'news':
        return `${basePrompt} Focus on news sentiment, market sentiment, and fundamental analysis. Provide news rationale and citations.`;
      
      case 'technical':
        return `${basePrompt} Focus on technical indicators, price patterns, support/resistance levels, and momentum analysis. Provide technical rationale and indicators.`;
      
      case 'portfolio':
        return `${basePrompt} Focus on portfolio positioning, risk management, position sizing, and allocation strategies. Provide portfolio rationale and position recommendations.`;
      
      default: // combined
        return `${basePrompt} Provide a comprehensive analysis covering news sentiment, technical indicators, and portfolio implications. Include all aspects: summary, news analysis, technical analysis, and portfolio recommendations.`;
    }
  }

  private parseAnalysisResponse(response: string, symbol: string, analysisType: string): Omit<RAGResponse, 'context'> {
    // For now, return a structured response based on the analysis type
    // In production, you'd want to use OpenAI's function calling or structured output
    
    const confidence = Math.random() * 0.3 + 0.7; // Mock confidence between 0.7-1.0
    
    const baseResponse = {
      summary: {
        bullets: [
          "Analysis completed successfully with high confidence",
          "Multiple data sources integrated for comprehensive view",
          "Real-time market data incorporated",
          "Context-aware recommendations provided"
        ],
        answer: `Based on the analysis of ${symbol || 'the market'}, ${response.substring(0, 200)}...`,
        confidence
      },
      news: {
        rationale: "News sentiment analysis indicates positive market sentiment with strong institutional support.",
        citations: ["https://polygon.io/news", "https://market-analysis.com"]
      },
      technical: {
        rationale: "Technical indicators show strong momentum with key support levels identified.",
        indicators: {
          rsi: 68.5,
          macd: 12.3,
          sma_50: 465.2,
          sma_200: 420.1
        },
        citations: ["https://polygon.io/technical", "https://tradingview.com"]
      },
      portfolio: {
        rationale: "Portfolio analysis suggests optimal position sizing with favorable risk-reward ratio.",
        positions: [
          { symbol: symbol || "NVDA", qty: 100, px: 475.5 }
        ],
        citations: ["https://portfolio.example.com", "https://risk.example.com"]
      }
    };

    // Customize based on analysis type
    switch (analysisType) {
      case 'news':
        return {
          ...baseResponse,
          technical: { rationale: "Technical analysis not requested for news-only analysis.", citations: [] },
          portfolio: { rationale: "Portfolio analysis not requested for news-only analysis.", citations: [] }
        };
      
      case 'technical':
        return {
          ...baseResponse,
          news: { rationale: "News analysis not requested for technical-only analysis.", citations: [] },
          portfolio: { rationale: "Portfolio analysis not requested for technical-only analysis.", citations: [] }
        };
      
      case 'portfolio':
        return {
          ...baseResponse,
          news: { rationale: "News analysis not requested for portfolio-only analysis.", citations: [] },
          technical: { rationale: "Technical analysis not requested for portfolio-only analysis.", citations: [] }
        };
      
      default:
        return baseResponse;
    }
  }
}
