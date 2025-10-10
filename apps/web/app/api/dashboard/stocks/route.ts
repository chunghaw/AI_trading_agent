import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

// Helper function to safely parse numbers
const safeParseFloat = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Parse query parameters
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Max 100 per page
  const offset = (page - 1) * limit;
  
  // Filter parameters
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const minPrice = safeParseFloat(searchParams.get('minPrice'));
  const maxPrice = safeParseFloat(searchParams.get('maxPrice'));
  const minMarketCap = safeParseFloat(searchParams.get('minMarketCap'));
  const maxMarketCap = safeParseFloat(searchParams.get('maxMarketCap'));
  const minRsi = safeParseFloat(searchParams.get('minRsi'));
  const maxRsi = safeParseFloat(searchParams.get('maxRsi'));
  const macdSignal = searchParams.get('macdSignal'); // 'bullish', 'bearish', 'neutral'
  const volumeTrend = searchParams.get('volumeTrend'); // 'rising', 'falling', 'flat'
  const exchange = searchParams.get('exchange');
  
  // Sort parameters
  const sortBy = searchParams.get('sortBy') || 'market_cap';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  let client: Client | null = null;

  try {
    // Database connection
    client = new Client({
      connectionString: process.env.POSTGRES_URL || 'postgresql://neondb_owner:npg_GhSFKa2wf8vb@ep-billowing-waterfall-a76q5go4-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require',
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    // Build dynamic WHERE clause
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Symbol filter
    if (symbol) {
      whereConditions.push(`g.symbol ILIKE $${paramIndex}`);
      queryParams.push(`%${symbol}%`);
      paramIndex++;
    }

    // Price range filter
    if (minPrice !== null) {
      whereConditions.push(`g.close >= $${paramIndex}`);
      queryParams.push(minPrice);
      paramIndex++;
    }
    if (maxPrice !== null) {
      whereConditions.push(`g.close <= $${paramIndex}`);
      queryParams.push(maxPrice);
      paramIndex++;
    }

    // Market cap range filter
    if (minMarketCap !== null) {
      whereConditions.push(`g.market_cap >= $${paramIndex}`);
      queryParams.push(minMarketCap);
      paramIndex++;
    }
    if (maxMarketCap !== null) {
      whereConditions.push(`g.market_cap <= $${paramIndex}`);
      queryParams.push(maxMarketCap);
      paramIndex++;
    }

    // RSI range filter
    if (minRsi !== null) {
      whereConditions.push(`g.rsi_14 >= $${paramIndex}`);
      queryParams.push(minRsi);
      paramIndex++;
    }
    if (maxRsi !== null) {
      whereConditions.push(`g.rsi_14 <= $${paramIndex}`);
      queryParams.push(maxRsi);
      paramIndex++;
    }

    // MACD signal filter
    if (macdSignal === 'bullish') {
      whereConditions.push(`g.macd_line > g.macd_signal`);
    } else if (macdSignal === 'bearish') {
      whereConditions.push(`g.macd_line < g.macd_signal`);
    } else if (macdSignal === 'neutral') {
      whereConditions.push(`g.macd_line = g.macd_signal`);
    }

    // Volume trend filter
    if (volumeTrend) {
      whereConditions.push(`g.volume_trend = $${paramIndex}`);
      queryParams.push(volumeTrend);
      paramIndex++;
    }

    // Exchange filter
    if (exchange) {
      whereConditions.push(`g.primary_exchange = $${paramIndex}`);
      queryParams.push(exchange);
      paramIndex++;
    }

    // Only get latest data for each symbol
    whereConditions.push(`g.date = (SELECT MAX(date) FROM gold_ohlcv_daily_metrics WHERE symbol = g.symbol)`);

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Build ORDER BY clause
    const validSortColumns = ['symbol', 'close', 'market_cap', 'rsi_14', 'macd_line', 'volume', 'total_volume', 'daily_return_pct'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'market_cap';
    const orderDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Main query to get stocks with latest data
    const stocksQuery = `
      WITH latest_data AS (
        SELECT 
          g.symbol, g.date, g.open, g.high, g.low, g.close, g.total_volume, g.market_cap,
          g.rsi_14, g.macd_line, g.macd_signal, g.macd_histogram, g.ema_20, g.ema_50, g.ema_200,
          g.ma_5, g.ma_20, g.ma_50, g.ma_200, g.atr_14, g.vwap, g.volume_trend, g.volume_price_relationship,
          g.daily_return_pct, g.company_name, g.market, g.stock_type, g.primary_exchange, g.currency,
          g.total_employees, g.description,
          COALESCE(c.name, g.company_name) as final_company_name,
          COALESCE(c.market, g.market) as final_market,
          COALESCE(c.type, g.stock_type) as final_stock_type,
          COALESCE(c.primary_exchange, g.primary_exchange) as final_primary_exchange,
          COALESCE(c.currency_name, g.currency) as final_currency,
          COALESCE(c.total_employees, g.total_employees) as final_total_employees,
          COALESCE(c.description, g.description) as final_description,
          -- Calculate price change from previous day
          LAG(g.close) OVER (PARTITION BY g.symbol ORDER BY g.date) as prev_close,
          ROW_NUMBER() OVER (PARTITION BY g.symbol ORDER BY g.date DESC) as rn
        FROM gold_ohlcv_daily_metrics g
        LEFT JOIN company_info_cache c ON g.symbol = c.symbol
        WHERE g.close > 0 AND g.date >= CURRENT_DATE - INTERVAL '30 days'
        ${whereClause ? whereClause.replace('WHERE', 'AND') : ''}
      )
      SELECT 
        symbol,
        final_company_name as company_name,
        final_market as market,
        final_stock_type as stock_type,
        final_primary_exchange as primary_exchange,
        final_currency as currency,
        close as price,
        prev_close,
        CASE 
          WHEN prev_close > 0 THEN ((close - prev_close) / prev_close) * 100
          ELSE NULL 
        END as price_change_percent,
        (close - prev_close) as price_change,
        total_volume as volume,
        market_cap,
        rsi_14 as rsi,
        macd_line,
        macd_signal,
        macd_histogram,
        ema_20,
        ema_50,
        ema_200,
        ma_5,
        ma_20,
        ma_50,
        ma_200,
        atr_14 as atr,
        vwap,
        volume_trend,
        volume_price_relationship,
        daily_return_pct,
        date as last_updated
      FROM latest_data
      WHERE rn = 1
      ORDER BY ${sortColumn} ${orderDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const stocksResult = await client.query(stocksQuery, queryParams);
    const stocks = stocksResult.rows.map(row => {
      const rsi = safeParseFloat(row.rsi);
      const volumeTrend = row.volume_trend || 'flat';
      
      return {
        symbol: row.symbol,
        company: row.company_name || `${row.symbol} Inc.`,
        market: row.market || 'stocks',
        type: row.stock_type || 'CS',
        exchange: row.primary_exchange || 'XNAS',
        currency: row.currency || 'USD',
        price: safeParseFloat(row.price),
        priceChange: safeParseFloat(row.price_change),
        priceChangePercent: safeParseFloat(row.price_change_percent),
        volume: safeParseFloat(row.volume),
        marketCap: safeParseFloat(row.market_cap),
        technical: {
          rsi: rsi && rsi >= 0 && rsi <= 100 ? rsi : null,
          macd: {
            line: safeParseFloat(row.macd_line),
            signal: safeParseFloat(row.macd_signal),
            histogram: safeParseFloat(row.macd_histogram)
          },
          ema: {
            ema20: safeParseFloat(row.ema_20),
            ema50: safeParseFloat(row.ema_50),
            ema200: safeParseFloat(row.ema_200)
          },
          ma: {
            ma5: safeParseFloat(row.ma_5),
            ma20: safeParseFloat(row.ma_20),
            ma50: safeParseFloat(row.ma_50),
            ma200: safeParseFloat(row.ma_200)
          },
          atr: safeParseFloat(row.atr),
          vwap: safeParseFloat(row.vwap)
        },
        trends: {
          volumeTrend: volumeTrend,
          volumePriceRelation: row.volume_price_relationship || 'neutral',
          dailyReturn: safeParseFloat(row.daily_return_pct)
        },
        lastUpdated: row.last_updated
      };
    });

    // Get total count for pagination
    const countQuery = `
      WITH latest_data AS (
        SELECT g.*,
          ROW_NUMBER() OVER (PARTITION BY g.symbol ORDER BY g.date DESC) as rn
        FROM gold_ohlcv_daily_metrics g
        LEFT JOIN company_info_cache c ON g.symbol = c.symbol
        ${whereClause}
      )
      SELECT COUNT(*) as total
      FROM latest_data
      WHERE rn = 1
    `;

    const countResult = await client.query(countQuery, queryParams.slice(0, -2)); // Remove limit and offset
    const total = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      success: true,
      data: {
        stocks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        },
        filters: {
          symbol,
          priceRange: { min: minPrice, max: maxPrice },
          marketCapRange: { min: minMarketCap, max: maxMarketCap },
          rsiRange: { min: minRsi, max: maxRsi },
          macdSignal,
          volumeTrend,
          exchange
        },
        sort: {
          by: sortColumn,
          order: orderDirection
        }
      }
    });

  } catch (error) {
    console.error('Dashboard stocks API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch stocks data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.end();
    }
  }
}
