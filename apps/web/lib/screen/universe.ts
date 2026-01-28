import { ScreenFilters } from "../screen.schemas";

/**
 * Build SQL query to fetch eligible tickers based on filters
 * Returns universe of tickers that pass hard filters
 */
export function buildUniverseSQL(filters: ScreenFilters, asOfDate?: string): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Base query: Get latest data per symbol from gold table
  // We need to calculate Beta1Y and DollarVolume1M on the fly
  
  // Date filter - use latest available date (don't filter by exact date in WHERE clause)
  // We'll get the latest row per symbol in the CTE, which handles missing dates gracefully
  // The asOfDate is just for reference, we'll use the latest available data

  // Market filter: US stocks only (exclude ETFs)
  if (filters.market === "us") {
    // Match dashboard query behavior - don't filter by market/stock_type (they may be NULL)
    // ETFs typically have 3-4 letter symbols, but so do some stocks
    // Better approach: Filter by exchange if available, otherwise allow all
    // For now, just exclude if market column explicitly says it's not stocks
    // (Most rows will have NULL market, so this won't exclude them)
    conditions.push(`(g.market IS NULL OR g.market = 'stocks' OR g.market != 'etf')`);
  }

  // Market cap filter (allow NULL - will filter in app layer if needed)
  if (filters.minMarketCap > 0) {
    conditions.push(`(g.market_cap IS NULL OR g.market_cap >= $${paramIndex})`);
    params.push(filters.minMarketCap);
    paramIndex++;
  }

  // Price filter (if specified)
  if (filters.minPrice && filters.minPrice > 0) {
    conditions.push(`g.close >= $${paramIndex}`);
    params.push(filters.minPrice);
    paramIndex++;
  }

  // Price > SMA200 gate (hard requirement)
  // Note: If this is too restrictive, we can make it optional or use a percentage threshold
  conditions.push(`g.close > g.ma_200`);
  conditions.push(`g.ma_200 IS NOT NULL`);
  conditions.push(`g.ma_200 > 0`);
  
  // Also ensure we have the required technical indicators
  conditions.push(`g.ma_50 IS NOT NULL`);

  // DollarVolume1M filter - calculate as average over last 30 days
  // Note: We'll calculate the 30-day average in the app layer for accuracy
  // For SQL filter, use a lower threshold to avoid being too restrictive
  if (filters.minDollarVolume1M > 0) {
    // Use a lower threshold (divide by 30 days) - we'll recalculate properly in app layer
    const minDailyDollarVolume = filters.minDollarVolume1M / 30; // More lenient
    // Allow NULL (will filter in app layer)
    conditions.push(`(g.total_dollar_volume IS NULL OR g.total_dollar_volume >= $${paramIndex})`);
    params.push(minDailyDollarVolume);
    paramIndex++;
  }

  // Beta1Y filter - calculate from correlation with SPY over 252 trading days
  // For MVP, we'll calculate this in the application layer after fetching data
  // But we can add a placeholder condition here
  // Note: Beta calculation requires historical data, so we'll do it in computeFeatures

  // Optional technical filters
  if (filters.minRSI !== undefined) {
    conditions.push(`g.rsi_14 >= $${paramIndex}`);
    params.push(filters.minRSI);
    paramIndex++;
  }

  if (filters.maxRSI !== undefined) {
    conditions.push(`g.rsi_14 <= $${paramIndex}`);
    params.push(filters.maxRSI);
    paramIndex++;
  }

  if (filters.macdSignal === "bullish") {
    conditions.push(`g.macd_line > g.macd_signal`);
  } else if (filters.macdSignal === "bearish") {
    conditions.push(`g.macd_line < g.macd_signal`);
  } else if (filters.macdSignal === "neutral") {
    conditions.push(`g.macd_line = g.macd_signal`);
  }

  if (filters.volumeTrend) {
    conditions.push(`g.volume_trend = $${paramIndex}`);
    params.push(filters.volumeTrend);
    paramIndex++;
  }

  // Exchange filter
  if (filters.exchanges && filters.exchanges.length > 0) {
    conditions.push(`g.primary_exchange = ANY($${paramIndex})`);
    params.push(filters.exchanges);
    paramIndex++;
  }

  // Additional data quality filters
  conditions.push(`g.close > 0`);
  conditions.push(`g.total_volume > 0`);
  conditions.push(`g.rsi_14 IS NOT NULL`);
  conditions.push(`g.macd_line IS NOT NULL`);
  
  // Only use recent data (last 30 days) to avoid stale data
  if (asOfDate) {
    conditions.push(`g.date >= $${paramIndex}::date - INTERVAL '30 days'`);
    conditions.push(`g.date <= $${paramIndex}::date`);
    params.push(asOfDate);
    paramIndex++;
  } else {
    conditions.push(`g.date >= CURRENT_DATE - INTERVAL '30 days'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Main query: Get latest row per symbol with all required fields
  const sql = `
    WITH latest_data AS (
      SELECT 
        g.symbol,
        g.date,
        g.close as price,
        g.open,
        g.high,
        g.low,
        g.total_volume as volume,
        g.total_dollar_volume as dollar_volume,
        g.ma_50 as sma50,
        g.ma_200 as sma200,
        g.macd_line as macd,
        g.macd_signal,
        g.macd_histogram as macd_hist,
        g.rsi_14 as rsi,
        g.atr_14 as atr,
        g.vwap,
        g.volume_trend,
        g.market_cap,
        g.primary_exchange,
        g.company_name,
        -- Calculate relative volume (current / 20-day average)
        (
          SELECT AVG(total_volume)
          FROM gold_ohlcv_daily_metrics
          WHERE symbol = g.symbol
            AND date >= g.date - INTERVAL '20 days'
            AND date < g.date
            AND total_volume > 0
        ) as avg_volume_20d,
        -- Calculate ATR percentage
        CASE 
          WHEN g.close > 0 THEN (g.atr_14 / g.close) * 100
          ELSE NULL
        END as atrp,
        -- Get previous day's close for change calculations
        LAG(g.close) OVER (PARTITION BY g.symbol ORDER BY g.date) as prev_close,
        -- Get previous MACD histogram for momentum detection
        LAG(g.macd_histogram) OVER (PARTITION BY g.symbol ORDER BY g.date) as prev_macd_hist,
        -- Get 20-day high for breakout detection
        MAX(g.high) OVER (
          PARTITION BY g.symbol 
          ORDER BY g.date 
          ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
        ) as high_20d,
        -- Get 50-day high
        MAX(g.high) OVER (
          PARTITION BY g.symbol 
          ORDER BY g.date 
          ROWS BETWEEN 49 PRECEDING AND CURRENT ROW
        ) as high_50d,
        ROW_NUMBER() OVER (PARTITION BY g.symbol ORDER BY g.date DESC) as rn
      FROM gold_ohlcv_daily_metrics g
      ${whereClause}
    )
    SELECT 
      symbol,
      date,
      price,
      open,
      high,
      low,
      volume,
      dollar_volume,
      sma50,
      sma200,
      macd,
      macd_signal,
      macd_hist,
      rsi,
      atr,
      vwap,
      volume_trend,
      market_cap,
      primary_exchange,
      company_name,
      avg_volume_20d,
      atrp,
      prev_close,
      prev_macd_hist,
      high_20d,
      high_50d,
      -- Calculate relative volume
      CASE 
        WHEN avg_volume_20d > 0 THEN volume / avg_volume_20d
        ELSE NULL
      END as rvol
    FROM latest_data
    WHERE rn = 1
    ORDER BY market_cap DESC NULLS LAST
  `;

  return { sql, params };
}

/**
 * Get count of eligible tickers (for progress tracking)
 */
export function buildUniverseCountSQL(filters: ScreenFilters, asOfDate?: string): { sql: string; params: any[] } {
  const { sql: mainSQL, params } = buildUniverseSQL(filters, asOfDate);
  const countSQL = `SELECT COUNT(*) as total FROM (${mainSQL}) as universe`;
  return { sql: countSQL, params };
}
