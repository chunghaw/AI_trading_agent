import fs from 'fs';
import path from 'path';

interface OHLCVData {
  symbol: string;
  timestamp: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  transactions: number;
  daily_range?: number;
  daily_change?: number;
  daily_return_pct?: number;
  dollar_volume?: number;
}

interface SymbolSummary {
  symbol: string;
  close: number;
  volume: number;
  daily_return_pct: number;
  daily_range: number;
  latest_date: string;
  last_updated: string;
}

export async function readOHLCVFromJSON(symbol: string, timeframe: string = "1d"): Promise<{
  ts: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  dataSource: 'databricks' | 'none';
}> {
  try {
    // Try local export directory first (where you'll download Databricks files)
    const localExportPath = path.join(process.cwd(), 'data', 'export', `ohlcv_${symbol}.json`);
    
    console.log(`🔍 Checking local export path: ${localExportPath}`);
    console.log(`🔍 Current working directory: ${process.cwd()}`);
    
    if (fs.existsSync(localExportPath)) {
      console.log(`📊 Found local export OHLCV data for ${symbol}`);
      const fileContent = fs.readFileSync(localExportPath, 'utf-8');
      const data: OHLCVData[] = JSON.parse(fileContent);
      
      console.log(`📈 Extracted data for ${symbol}:`);
      console.log(`   Records: ${data.length}`);
      console.log(`   Date range: ${data[0]?.timestamp} to ${data[data.length-1]?.timestamp}`);
      console.log(`   Price range: $${Math.min(...data.map(d => d.low))} - $${Math.max(...data.map(d => d.high))}`);
      console.log(`   Latest close: $${data[data.length-1]?.close}`);
      console.log(`   Sample data: ${JSON.stringify(data.slice(0, 3), null, 2)}`);
      
      if (data.length > 0) {
        return {
          ts: data.map(d => new Date(d.timestamp).getTime()),
          open: data.map(d => d.open),
          high: data.map(d => d.high),
          low: data.map(d => d.low),
          close: data.map(d => d.close),
          volume: data.map(d => d.volume),
          dataSource: 'databricks'
        };
      }
    } else {
      console.log(`❌ Local export path not found: ${localExportPath}`);
    }

    // Try local development paths as fallback
    const localPaths = [
      path.join(process.cwd(), '../data/ohlcv', symbol, `${timeframe}.json`),
      path.join(process.cwd(), 'data/ohlcv', symbol, `${timeframe}.json`),
    ];

    for (const filePath of localPaths) {
      console.log(`🔍 Checking local path: ${filePath}`);
      if (fs.existsSync(filePath)) {
        console.log(`📊 Found local OHLCV data for ${symbol} at ${filePath}`);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data: OHLCVData[] = JSON.parse(fileContent);
        
        console.log(`📈 Extracted data for ${symbol}:`);
        console.log(`   Records: ${data.length}`);
        console.log(`   Sample data: ${JSON.stringify(data.slice(0, 3), null, 2)}`);
        
        return {
          ts: data.map(d => new Date(d.timestamp).getTime()),
          open: data.map(d => d.open),
          high: data.map(d => d.high),
          low: data.map(d => d.low),
          close: data.map(d => d.close),
          volume: data.map(d => d.volume),
          dataSource: 'databricks'
        };
      } else {
        console.log(`❌ Local path not found: ${filePath}`);
      }
    }
    
    // No data found
    console.log(`❌ No OHLCV data found for ${symbol}`);
    return {
      ts: [],
      open: [],
      high: [],
      low: [],
      close: [],
      volume: [],
      dataSource: 'none'
    };
    
  } catch (error) {
    console.warn(`❌ Error reading OHLCV data for ${symbol}:`, error);
    return {
      ts: [],
      open: [],
      high: [],
      low: [],
      close: [],
      volume: [],
      dataSource: 'none'
    };
  }
}

export async function getSymbolSummary(): Promise<{
  last_updated: string;
  symbols: SymbolSummary[];
  dataSource: 'databricks' | 'none';
} | null> {
  try {
    // Try to read symbol summary from local export directory
    const localSummaryPath = path.join(process.cwd(), 'data', 'export', 'symbol_summary.json');
    
    console.log(`🔍 Checking local summary path: ${localSummaryPath}`);
    
    if (fs.existsSync(localSummaryPath)) {
      console.log('📊 Found local export symbol summary');
      const fileContent = fs.readFileSync(localSummaryPath, 'utf-8');
      const data = JSON.parse(fileContent);
      
      console.log(`📋 Extracted symbol summary:`);
      console.log(`   Last updated: ${data.last_updated}`);
      console.log(`   Symbols count: ${data.symbols?.length || 0}`);
      console.log(`   Sample symbols: ${JSON.stringify(data.symbols?.slice(0, 3), null, 2)}`);
      
      return {
        ...data,
        dataSource: 'databricks'
      };
    }
    
    // No data found
    console.log('❌ No symbol summary found');
    return null;
  } catch (error) {
    console.warn('❌ Error reading symbol summary:', error);
    return null;
  }
}

export async function getSymbolData(symbol: string): Promise<{
  ohlcv: any;
  summary: any;
  dataSource: 'databricks' | 'none';
}> {
  const [ohlcv, summary] = await Promise.all([
    readOHLCVFromJSON(symbol),
    getSymbolSummary()
  ]);

  const symbolSummary = summary?.symbols?.find((s: any) => s.symbol === symbol);
  
  return {
    ohlcv,
    summary: symbolSummary,
    dataSource: ohlcv.dataSource === 'databricks' && summary?.dataSource === 'databricks' ? 'databricks' : 'none'
  };
}


