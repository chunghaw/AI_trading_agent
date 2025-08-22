import snowflake from 'snowflake-sdk';

// Snowflake configuration
const SNOWFLAKE_CONFIG = {
  account: process.env.SNOWFLAKE_ACCOUNT,
  username: process.env.SNOWFLAKE_USER,
  password: process.env.SNOWFLAKE_PASSWORD,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA,
  role: process.env.SNOWFLAKE_ROLE,
};

export interface OHLCVBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicators {
  rsi14?: number;
  macd?: number;
  macd_signal?: number;
  macd_hist?: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;
}

let connection: snowflake.Connection | null = null;

function connect(): Promise<snowflake.Connection> {
  return new Promise((resolve, reject) => {
    if (connection && connection.isUp()) {
      resolve(connection);
      return;
    }

    // Validate required environment variables
    const required = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD', 'SNOWFLAKE_WAREHOUSE', 'SNOWFLAKE_DATABASE', 'SNOWFLAKE_SCHEMA'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      reject(new Error(`Missing Snowflake environment variables: ${missing.join(', ')}`));
      return;
    }

    connection = snowflake.createConnection(SNOWFLAKE_CONFIG);
    
    connection.connect((err, conn) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(conn);
    });
  });
}

function executeQuery(query: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    connect().then(conn => {
      conn.execute({
        sqlText: query,
        complete: (err, stmt, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows || []);
        }
      });
    }).catch(reject);
  });
}

export async function getBars(symbol: string, timeframe: string, periods: number = 240): Promise<OHLCVBar[]> {
  try {
    // Map timeframe to Snowflake interval
    const intervalMap: Record<string, string> = {
      '1m': '1 MINUTE',
      '5m': '5 MINUTE',
      '15m': '15 MINUTE',
      '30m': '30 MINUTE',
      '1h': '1 HOUR',
      '4h': '4 HOUR',
      '1d': '1 DAY',
    };

    const interval = intervalMap[timeframe] || '1 HOUR';
    
    const query = `
      SELECT 
        timestamp,
        open,
        high,
        low,
        close,
        volume
      FROM OHLCV_BARS 
      WHERE symbol = '${symbol.toUpperCase()}'
        AND timeframe = '${interval}'
      ORDER BY timestamp DESC
      LIMIT ${periods}
    `;

    const rows = await executeQuery(query);
    
    return rows.map(row => ({
      timestamp: row.TIMESTAMP,
      open: parseFloat(row.OPEN),
      high: parseFloat(row.HIGH),
      low: parseFloat(row.LOW),
      close: parseFloat(row.CLOSE),
      volume: parseFloat(row.VOLUME),
    })).reverse(); // Reverse to get chronological order
    
  } catch (error) {
    console.error(`Failed to get bars for ${symbol}:`, error);
    return [];
  }
}

// Technical indicator calculations
export function calculateRSI(prices: number[], period: number = 14): number | undefined {
  if (prices.length < period + 1) return undefined;
  
  let gains = 0;
  let losses = 0;
  
  // Calculate initial average gain and loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // Calculate RSI for remaining periods
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function calculateEMA(prices: number[], period: number): number | undefined {
  if (prices.length < period) return undefined;
  
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
  }
  
  return ema;
}

export function calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): {
  macd: number;
  signal: number;
  histogram: number;
} | undefined {
  if (prices.length < Math.max(fastPeriod, slowPeriod) + signalPeriod) return undefined;
  
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  
  if (!fastEMA || !slowEMA) return undefined;
  
  const macd = fastEMA - slowEMA;
  
  // Calculate signal line (EMA of MACD)
  const macdValues = [];
  for (let i = 0; i < prices.length; i++) {
    const fastEMA = calculateEMA(prices.slice(0, i + 1), fastPeriod);
    const slowEMA = calculateEMA(prices.slice(0, i + 1), slowPeriod);
    if (fastEMA && slowEMA) {
      macdValues.push(fastEMA - slowEMA);
    }
  }
  
  const signal = calculateEMA(macdValues, signalPeriod);
  if (!signal) return undefined;
  
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

export async function computeIndicators(bars: OHLCVBar[]): Promise<Indicators> {
  if (bars.length < 50) {
    return {}; // Not enough data
  }
  
  const closes = bars.map(bar => bar.close);
  
  const indicators: Indicators = {};
  
  // Calculate RSI(14)
  if (closes.length >= 15) {
    indicators.rsi14 = calculateRSI(closes, 14);
  }
  
  // Calculate MACD(12,26,9)
  if (closes.length >= 35) {
    const macdResult = calculateMACD(closes, 12, 26, 9);
    if (macdResult) {
      indicators.macd = macdResult.macd;
      indicators.macd_signal = macdResult.signal;
      indicators.macd_hist = macdResult.histogram;
    }
  }
  
  // Calculate EMAs
  if (closes.length >= 20) {
    indicators.ema20 = calculateEMA(closes, 20);
  }
  
  if (closes.length >= 50) {
    indicators.ema50 = calculateEMA(closes, 50);
  }
  
  if (closes.length >= 200) {
    indicators.ema200 = calculateEMA(closes, 200);
  }
  
  return indicators;
}

export async function getBarsAndIndicators(symbol: string, timeframe: string): Promise<{
  bars: OHLCVBar[];
  indicators: Indicators;
}> {
  try {
    const bars = await getBars(symbol, timeframe);
    const indicators = await computeIndicators(bars);
    
    return { bars, indicators };
  } catch (error) {
    console.error(`Failed to get bars and indicators for ${symbol}:`, error);
    return { bars: [], indicators: {} };
  }
}
