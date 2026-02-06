import { Client } from "pg";
import { TechnicalFeatures } from "../screen.schemas";

const ETFS = new Set(["SPY", "QQQ", "IWM", "DIA", "GLD", "SLV", "ARKK", "SMH", "XLF", "XLE", "XLK", "VTI", "VOO", "VEA", "VWO", "EFA", "IEFA", "AGG", "BND", "IVV"]);

function determineSecurityType(ticker: string): string {
  const t = ticker.toUpperCase();
  if (t.includes("-") || t.includes("BTC") || t.includes("ETH")) return "Crypto";
  if (ETFS.has(t)) return "ETF";
  return "Stock";
}

/**
 * Compute technical features for a ticker from database row
 */
export function computeFeaturesFromRow(row: any, asOfDate: string): TechnicalFeatures {
  const safeParse = (val: any): number | null => {
    if (val === null || val === undefined || val === '') return null;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  };

  const price = safeParse(row.price) || 0;
  const sma50 = safeParse(row.sma50);
  const sma200 = safeParse(row.sma200);
  const macd = safeParse(row.macd);
  const macd_signal = safeParse(row.macd_signal);
  const macd_hist = safeParse(row.macd_hist);
  const rsi = safeParse(row.rsi);
  const atr = safeParse(row.atr);
  const vwap = safeParse(row.vwap);
  const volume = safeParse(row.volume);
  const dollar_volume = safeParse(row.dollar_volume);
  const rvol = safeParse(row.rvol);
  const atrp = safeParse(row.atrp);
  const prev_close = safeParse(row.prev_close);
  const prev_macd_hist = safeParse(row.prev_macd_hist);
  const high_20d = safeParse(row.high_20d);
  const high_50d = safeParse(row.high_50d);
  const market_cap = safeParse(row.market_cap);
  const company_name = row.company_name || "";
  const security_type = determineSecurityType(row.symbol || row.ticker || "");

  // Calculate dollar volume 1M (average over last 30 days)
  // This should be pre-calculated in the SQL, but we'll handle null case
  const dollar_volume_1m = safeParse(row.dollar_volume_1m);

  // Calculate Beta1Y (correlation with SPY over 252 trading days)
  // This requires historical data, so we'll calculate it separately
  const beta_1y = safeParse(row.beta_1y);

  // Determine flags
  const breakout_flag = determineBreakoutFlag(price, high_20d, high_50d, volume, rvol, atrp);
  const trend_flag = determineTrendFlag(price, sma50, sma200);
  const momentum_flag = determineMomentumFlag(macd, macd_signal, macd_hist, prev_macd_hist);
  const volume_flag = determineVolumeFlag(rvol, volume, dollar_volume);

  return {
    ticker: row.symbol,
    asof_date: asOfDate,
    price,
    sma50,
    sma200,
    macd,
    macd_signal,
    macd_hist,
    rsi,
    rvol,
    atrp,
    atr,
    vwap,
    volume,
    dollar_volume,
    beta_1y,
    dollar_volume_1m,
    breakout_flag,
    trend_flag,
    momentum_flag,
    volume_flag,
    high_20d,
    high_50d,
    prev_close,
    prev_macd_hist,
    market_cap,
    company_name,
    security_type,
  };
}

/**
 * Calculate Beta1Y for a ticker vs SPY
 * Beta = Covariance(ticker_returns, spy_returns) / Variance(spy_returns)
 */
export async function calculateBeta1Y(
  client: Client,
  ticker: string,
  asOfDate: string
): Promise<number | null> {
  try {
    // Get 252 trading days of returns for ticker and SPY
    const query = `
      WITH ticker_returns AS (
        SELECT 
          date,
          daily_return_pct as return_pct
        FROM gold_ohlcv_daily_metrics
        WHERE symbol = $1
          AND date <= $2
          AND daily_return_pct IS NOT NULL
        ORDER BY date DESC
        LIMIT 252
      ),
      spy_returns AS (
        SELECT 
          date,
          daily_return_pct as return_pct
        FROM gold_ohlcv_daily_metrics
        WHERE symbol = 'SPY'
          AND date <= $2
          AND daily_return_pct IS NOT NULL
        ORDER BY date DESC
        LIMIT 252
      ),
      joined_returns AS (
        SELECT 
          t.date,
          t.return_pct as ticker_return,
          s.return_pct as spy_return
        FROM ticker_returns t
        INNER JOIN spy_returns s ON t.date = s.date
      ),
      stats AS (
        SELECT 
          AVG(ticker_return) as avg_ticker_return,
          AVG(spy_return) as avg_spy_return,
          COUNT(*) as n
        FROM joined_returns
      ),
      covariance AS (
        SELECT 
          SUM((jr.ticker_return - s.avg_ticker_return) * (jr.spy_return - s.avg_spy_return)) / (s.n - 1) as cov
        FROM joined_returns jr
        CROSS JOIN stats s
      ),
      spy_variance AS (
        SELECT 
          SUM(POWER(jr.spy_return - s.avg_spy_return, 2)) / (s.n - 1) as var
        FROM joined_returns jr
        CROSS JOIN stats s
      )
      SELECT 
        CASE 
          WHEN sv.var > 0 THEN c.cov / sv.var
          ELSE NULL
        END as beta
      FROM covariance c
      CROSS JOIN spy_variance sv
      CROSS JOIN stats s
      WHERE s.n >= 60  -- Need at least 60 days of data
    `;

    const result = await client.query(query, [ticker, asOfDate]);

    if (result.rows.length > 0 && result.rows[0].beta !== null) {
      return parseFloat(result.rows[0].beta);
    }

    return null;
  } catch (error) {
    console.error(`Error calculating Beta1Y for ${ticker}:`, error);
    return null;
  }
}

/**
 * Calculate average dollar volume over last 30 days
 */
export async function calculateDollarVolume1M(
  client: Client,
  ticker: string,
  asOfDate: string
): Promise<number | null> {
  try {
    const query = `
      SELECT AVG(total_dollar_volume) as avg_dollar_volume_1m
      FROM gold_ohlcv_daily_metrics
      WHERE symbol = $1
        AND date >= $2::date - INTERVAL '30 days'
        AND date <= $2::date
        AND total_dollar_volume IS NOT NULL
        AND total_dollar_volume > 0
    `;

    const result = await client.query(query, [ticker, asOfDate]);

    if (result.rows.length > 0 && result.rows[0].avg_dollar_volume_1m !== null) {
      return parseFloat(result.rows[0].avg_dollar_volume_1m);
    }

    return null;
  } catch (error) {
    console.error(`Error calculating DollarVolume1M for ${ticker}:`, error);
    return null;
  }
}

// ============================================================================
// Helper Functions for Flag Determination
// ============================================================================

function determineBreakoutFlag(
  price: number,
  high_20d: number | null,
  high_50d: number | null,
  volume: number | null,
  rvol: number | null,
  atrp: number | null
): boolean {
  // Breakout: price closes above 20-day high with volume OR ATR compression
  if (!high_20d || price <= 0) return false;

  // Price breakout above 20-day high with volume confirmation
  if (price > high_20d && rvol && rvol > 1.2) {
    return true;
  }

  // ATR compression (low volatility before potential breakout)
  if (atrp && atrp < 2.0) { // ATR < 2% of price suggests compression
    return true;
  }

  return false;
}

function determineTrendFlag(
  price: number,
  sma50: number | null,
  sma200: number | null
): boolean {
  // Trend: price > sma50 > sma200
  if (!sma50 || !sma200 || price <= 0) return false;
  return price > sma50 && sma50 > sma200;
}

function determineMomentumFlag(
  macd: number | null,
  macd_signal: number | null,
  macd_hist: number | null,
  prev_macd_hist: number | null
): boolean {
  // Momentum: MACD line > signal AND histogram rising
  if (!macd || !macd_signal || macd_hist === null) return false;

  const macd_bullish = macd > macd_signal;
  const histogram_rising = prev_macd_hist !== null && macd_hist > prev_macd_hist;

  return macd_bullish && (histogram_rising || macd_hist > 0);
}

function determineVolumeFlag(
  rvol: number | null,
  volume: number | null,
  dollar_volume: number | null
): boolean {
  // Volume: relative volume > 1.5 OR high dollar volume
  if (rvol && rvol > 1.5) return true;

  // High dollar volume (> 50M daily)
  if (dollar_volume && dollar_volume > 50_000_000) return true;

  return false;
}
