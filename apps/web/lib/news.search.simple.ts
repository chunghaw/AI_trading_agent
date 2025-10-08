// Simple news search using Python script
import { spawn } from 'child_process';

export async function searchAndRerankNewsStrict(symbol: string, query: string, since: string): Promise<any[]> {
  console.log(`🔍 News Search Debug - Symbol: ${symbol}, Query: ${query}, Since: ${since}`);
  
  // For now, return empty results to prevent timeout
  // TODO: Implement proper Milvus search for Vercel deployment
  console.log(`⚠️ News search temporarily disabled to prevent timeout`);
  return [];
}

