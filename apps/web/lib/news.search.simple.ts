// Simple news search using Milvus REST API
import { searchAndRerankNewsStrict as searchNews } from './news.search';

export async function searchAndRerankNewsStrict(symbol: string, query: string, since: string): Promise<any[]> {
  console.log(`🔍 News Search Debug - Symbol: ${symbol}, Query: ${query}, Since: ${since}`);
  
  try {
    // Use the proper Milvus REST API implementation
    const results = await searchNews(symbol, query, since);
    console.log(`✅ Found ${results.length} news articles for ${symbol}`);
    return results;
  } catch (error) {
    console.error(`❌ News search failed for ${symbol}:`, error);
    // Return empty array instead of throwing to allow the app to continue
    return [];
  }
}

