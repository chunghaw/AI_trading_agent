const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const POLYGON_BASE_URL = 'https://api.polygon.io';

export interface OHLCVData {
  c: number; // Close price
  h: number; // High price
  l: number; // Low price
  n: number; // Number of transactions
  o: number; // Open price
  t: number; // Timestamp
  v: number; // Volume
  vw: number; // Volume weighted average price
}

export interface NewsArticle {
  id: string;
  publisher: {
    name: string;
    homepage_url: string;
    logo_url: string;
    favicon_url: string;
  };
  title: string;
  author: string;
  published_utc: string;
  article_url: string;
  tickers: string[];
  image_url: string;
  description: string;
  keywords: string[];
}

export interface PolygonResponse<T> {
  results: T[];
  status: string;
  request_id: string;
  count: number;
  next_url?: string;
}

export class PolygonAPI {
  private apiKey: string;

  constructor() {
    if (!POLYGON_API_KEY) {
      throw new Error('POLYGON_API_KEY is not configured');
    }
    this.apiKey = POLYGON_API_KEY;
  }

  async getOHLCV(symbol: string, timeframe: string = '1', from: string, to: string): Promise<OHLCVData[]> {
    const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/range/${timeframe}/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${this.apiKey}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.status} ${response.statusText}`);
      }
      
      const data: PolygonResponse<OHLCVData> = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error fetching OHLCV data:', error);
      throw error;
    }
  }

  async getNews(symbol: string, from: string, to: string): Promise<NewsArticle[]> {
    const url = `${POLYGON_BASE_URL}/v2/reference/news?ticker=${symbol}&published_utc.gte=${from}&published_utc.lte=${to}&order=desc&sort=published_utc&limit=100&apiKey=${this.apiKey}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.status} ${response.statusText}`);
      }
      
      const data: PolygonResponse<NewsArticle> = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error fetching news data:', error);
      throw error;
    }
  }

  async getTickerDetails(symbol: string) {
    const url = `${POLYGON_BASE_URL}/v3/reference/tickers/${symbol}?apiKey=${this.apiKey}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching ticker details:', error);
      throw error;
    }
  }

  async getMarketStatus() {
    const url = `${POLYGON_BASE_URL}/v1/marketstatus/now?apiKey=${this.apiKey}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching market status:', error);
      throw error;
    }
  }
}

// Helper function to format dates for Polygon API
export function formatDateForPolygon(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper function to get date range for different timeframes
export function getDateRange(timeframe: string): { from: string; to: string } {
  const now = new Date();
  const to = formatDateForPolygon(now);
  
  let from: Date;
  
  switch (timeframe) {
    case '1d':
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '1w':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '1m':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '3m':
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '6m':
      from = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to 1 month
  }
  
  return {
    from: formatDateForPolygon(from),
    to
  };
}
