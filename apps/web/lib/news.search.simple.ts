// Simple news search using Python script
import { spawn } from 'child_process';

export async function searchAndRerankNewsStrict(symbol: string, query: string, since: string): Promise<any[]> {
  console.log(`🔍 News Search Debug - Symbol: ${symbol}, Query: ${query}, Since: ${since}`);
  
  try {
    // Use Python script to query Milvus
    const python = spawn('python3', [
      '/Users/chunghaw/Documents/AI Bootcamp 2025/airflow-dbt-project/milvus_simple_query.py',
      symbol,
      '10'  // Limit to 10 articles
    ]);

    return new Promise((resolve) => {
      let dataString = '';
      let errorString = '';

      python.stdout.on('data', (data: any) => {
        dataString += data.toString();
      });

      python.stderr.on('data', (data: any) => {
        errorString += data.toString();
      });

      python.on('close', (code: number) => {
        if (code === 0) {
          try {
            const results = JSON.parse(dataString);
            console.log(`✅ Found ${results.length} news articles for ${symbol}`);
            
            const formattedResults = results.map((item: any) => ({
              text: item.text || item.title || "",
              url: item.url || "",
              title: item.title || "",
              published_utc: item.published_utc || "",
              ticker: item.ticker || "",
              source: item.source || "",
              sentiment: item.sentiment || "",
              score: 1.0 // Default score for query results
            }));
            
            resolve(formattedResults);
          } catch (parseError) {
            console.error('❌ Failed to parse Milvus results:', parseError);
            resolve([]);
          }
        } else {
          console.error(`❌ Milvus Python script failed with code ${code}:`, errorString);
          resolve([]);
        }
      });
    });
    
  } catch (error: any) {
    console.error("❌ News search failed:", error);
    return [];
  }
}
