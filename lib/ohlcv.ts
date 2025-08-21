import type { Bars } from "./indicators";
import fs from "fs";
import path from "path";

// Path to your exported JSON data
const JSON_PATH = path.join(process.cwd(), "data", "sample_exploration.json");

interface DataRow {
  symbol: string;
  timestamp: string;
  date: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  vwap: string;
  transactions: string;
  ingestion_time: string;
  daily_range: string;
  daily_change: string;
  daily_return_pct: string;
  dollar_volume: string;
  export_timestamp: string;
  export_type: string;
}

export async function getBars(symbol: string, timeframe="1d", periods=260): Promise<Bars> {
  console.log(`🚨 REAL DATA: getBars called for ${symbol}`);
  
  if (symbol === "NVDA") {
    // REAL NVDA DATA from your CSV (latest 250 records)
    try {
      const jsonContent = fs.readFileSync(JSON_PATH, 'utf-8');
      const rows: DataRow[] = JSON.parse(jsonContent);
      const nvdaData = rows.filter(row => row.symbol === "NVDA");
      
      if (nvdaData.length > 0) {
        // Sort by date (oldest first)
        nvdaData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Take the last N periods
        const recentData = nvdaData.slice(-Math.min(periods, nvdaData.length));
        
        const bars: Bars = {
          open: recentData.map(row => parseFloat(row.open)),
          high: recentData.map(row => parseFloat(row.high)),
          low: recentData.map(row => parseFloat(row.low)),
          close: recentData.map(row => parseFloat(row.close)),
          volume: recentData.map(row => parseFloat(row.volume)),
          date: recentData.map(row => row.date)
        };
        
        console.log(`✅ REAL DATA: Loaded ${bars.close.length} NVDA bars, latest close: $${bars.close[bars.close.length - 1]}`);
        return bars;
      }
    } catch (error) {
      console.error("Error loading real NVDA data:", error);
    }
  }
  
  // No mock data - only real data supported
  throw new Error(`Symbol ${symbol} is not supported. Only NVDA has real data available.`);
}

export function barsQualityOk(b: Bars): boolean {
  return b.close.length >= 200 && 
         b.close.every(price => price > 0) && 
         b.volume.every(vol => vol > 0);
}
