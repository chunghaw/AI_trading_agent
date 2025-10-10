import { NextResponse } from "next/server";
import { Client } from "pg";

// Helper function to safely parse numbers
const safeParseFloat = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

export async function GET() {
  let client: Client | null = null;

  try {
    // Database connection
    client = new Client({
      connectionString: process.env.POSTGRES_URL || 'postgresql://neondb_owner:npg_GhSFKa2wf8vb@ep-billowing-waterfall-a76q5go4-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require',
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    // Get market overview data
    const marketOverviewQuery = `
      WITH latest_data AS (
        SELECT 
          g.*,
          ROW_NUMBER() OVER (PARTITION BY g.symbol ORDER BY g.date DESC) as rn
        FROM gold_ohlcv_daily_metrics g
        WHERE g.date >= CURRENT_DATE - INTERVAL '7 days'
      ),
      market_stats AS (
        SELECT 
          COUNT(DISTINCT symbol) as total_stocks,
          AVG(close) as avg_price,
          AVG(daily_return_pct) as avg_daily_return,
          AVG(rsi_14) as avg_rsi,
          COUNT(CASE WHEN daily_return_pct > 0 THEN 1 END) as positive_stocks,
          COUNT(CASE WHEN daily_return_pct < 0 THEN 1 END) as negative_stocks,
          COUNT(CASE WHEN rsi_14 > 70 THEN 1 END) as overbought_stocks,
          COUNT(CASE WHEN rsi_14 < 30 THEN 1 END) as oversold_stocks,
          AVG(total_volume) as avg_volume
        FROM latest_data 
        WHERE rn = 1
      ),
      avg_volume_subquery AS (
        SELECT AVG(total_volume) * 1.5 as threshold_volume
        FROM latest_data 
        WHERE rn = 1
      ),
      breakout_candidates AS (
        SELECT 
          symbol,
          close,
          total_volume,
          daily_return_pct,
          ROW_NUMBER() OVER (ORDER BY total_volume DESC) as volume_rank
        FROM latest_data, avg_volume_subquery
        WHERE rn = 1 
          AND daily_return_pct > 5.0
          AND total_volume > avg_volume_subquery.threshold_volume
        LIMIT 5
      )
      SELECT 
        (SELECT row_to_json(market_stats) FROM market_stats) as market_stats,
        (SELECT json_agg(
          json_build_object(
            'symbol', symbol,
            'price', close,
            'volume', total_volume,
            'dailyReturn', daily_return_pct
          )
        ) FROM breakout_candidates) as breakout_candidates
    `;

    const marketResult = await client.query(marketOverviewQuery);
    const marketData = marketResult.rows[0];

    // Calculate market sentiment
    const totalStocks = marketData.market_stats?.total_stocks || 0;
    const positiveStocks = marketData.market_stats?.positive_stocks || 0;
    const negativeStocks = marketData.market_stats?.negative_stocks || 0;
    
    let marketSentiment: 'bullish' | 'neutral' | 'bearish';
    const bullishRatio = positiveStocks / totalStocks;
    
    if (bullishRatio > 0.6) {
      marketSentiment = 'bullish';
    } else if (bullishRatio < 0.4) {
      marketSentiment = 'bearish';
    } else {
      marketSentiment = 'neutral';
    }

    // Generate AI insights (simplified for now - in Phase 3 we'll add full AI analysis)
    const insights = {
      marketSentiment: {
        sentiment: marketSentiment,
        bullishPercentage: Math.round((positiveStocks / totalStocks) * 100),
        bearishPercentage: Math.round((negativeStocks / totalStocks) * 100),
        neutralPercentage: Math.round(((totalStocks - positiveStocks - negativeStocks) / totalStocks) * 100)
      },
      
      topRecommendations: await generateTopRecommendations(client),
      
      breakoutDetection: {
        candidates: marketData.breakout_candidates || [],
        totalDetected: marketData.breakout_candidates?.length || 0
      },
      
      riskAlerts: await generateRiskAlerts(client),
      
      sectorRotation: await analyzeSectorRotation(client),
      
      marketOverview: {
        totalStocks: totalStocks,
        averagePrice: safeParseFloat(marketData.market_stats?.avg_price),
        averageDailyReturn: safeParseFloat(marketData.market_stats?.avg_daily_return),
        averageRSI: safeParseFloat(marketData.market_stats?.avg_rsi),
        overboughtStocks: marketData.market_stats?.overbought_stocks || 0,
        oversoldStocks: marketData.market_stats?.oversold_stocks || 0,
        averageVolume: safeParseFloat(marketData.market_stats?.avg_volume)
      }
    };

    return NextResponse.json({
      success: true,
      data: insights,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dashboard insights API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate market insights',
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

async function generateTopRecommendations(client: Client) {
  try {
    const query = `
      WITH latest_data AS (
        SELECT 
          g.*,
          ROW_NUMBER() OVER (PARTITION BY g.symbol ORDER BY g.date DESC) as rn
        FROM gold_ohlcv_daily_metrics g
        WHERE g.date >= CURRENT_DATE - INTERVAL '30 days'
      ),
      strong_performers AS (
        SELECT 
          symbol,
          close,
          daily_return_pct,
          rsi_14,
          macd_line,
          macd_signal,
          total_volume,
          market_cap,
          -- Scoring algorithm
          (
            CASE WHEN daily_return_pct > 0 THEN 1 ELSE 0 END * 0.3 +
            CASE WHEN rsi_14 BETWEEN 40 AND 70 THEN 1 ELSE 0 END * 0.2 +
            CASE WHEN macd_line > macd_signal THEN 1 ELSE 0 END * 0.3 +
            CASE WHEN total_volume > (SELECT AVG(total_volume) FROM latest_data WHERE rn = 1) THEN 1 ELSE 0 END * 0.2
          ) as score
        FROM latest_data 
        WHERE rn = 1 
          AND market_cap > 1000000000  -- Only large cap stocks
          AND close > 10  -- Minimum price
        ORDER BY score DESC, daily_return_pct DESC
        LIMIT 3
      )
      SELECT 
        symbol,
        close as price,
        daily_return_pct as dailyReturn,
        rsi_14 as rsi,
        score,
        market_cap as marketCap
      FROM strong_performers
    `;

    const result = await client.query(query);
    
    return result.rows.map((row, index) => ({
      rank: index + 1,
      symbol: row.symbol,
      price: safeParseFloat(row.price),
      dailyReturn: safeParseFloat(row.daily_return),
      rsi: safeParseFloat(row.rsi),
      confidence: Math.round((row.score || 0) * 100),
      marketCap: safeParseFloat(row.marketcap),
      reasoning: generateReasoning(row.symbol, row.score, row.daily_return, row.rsi)
    }));
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return [];
  }
}

async function generateRiskAlerts(client: Client) {
  try {
    const query = `
      WITH latest_data AS (
        SELECT 
          g.*,
          ROW_NUMBER() OVER (PARTITION BY g.symbol ORDER BY g.date DESC) as rn
        FROM gold_ohlcv_daily_metrics g
        WHERE g.date >= CURRENT_DATE - INTERVAL '7 days'
      )
      SELECT 
        symbol,
        close,
        rsi_14,
        atr_14,
        total_volume,
        daily_return_pct,
        market_cap
      FROM latest_data 
      WHERE rn = 1
        AND (
          rsi_14 > 80 OR  -- Overbought
          rsi_14 < 20 OR  -- Oversold
          ABS(daily_return_pct) > 10 OR  -- High volatility
          total_volume > (SELECT AVG(total_volume) * 3 FROM latest_data WHERE rn = 1)  -- Volume spike
        )
      ORDER BY ABS(daily_return_pct) DESC
      LIMIT 10
    `;

    const result = await client.query(query);
    
    return result.rows.map(row => ({
      symbol: row.symbol,
      price: safeParseFloat(row.close),
      severity: getRiskSeverity(row.rsi_14, row.daily_return_pct),
      type: getRiskType(row.rsi_14, row.daily_return_pct),
      rsi: safeParseFloat(row.rsi_14),
      dailyReturn: safeParseFloat(row.daily_return_pct),
      atr: safeParseFloat(row.atr_14),
      volume: safeParseFloat(row.total_volume),
      marketCap: safeParseFloat(row.market_cap),
      message: generateRiskMessage(row.symbol, row.rsi_14, row.daily_return_pct)
    }));
  } catch (error) {
    console.error('Error generating risk alerts:', error);
    return [];
  }
}

async function analyzeSectorRotation(client: Client) {
  try {
    // Simplified sector analysis - in a real implementation, you'd have sector data
    const query = `
      WITH latest_data AS (
        SELECT 
          g.*,
          ROW_NUMBER() OVER (PARTITION BY g.symbol ORDER BY g.date DESC) as rn
        FROM gold_ohlcv_daily_metrics g
        WHERE g.date >= CURRENT_DATE - INTERVAL '7 days'
      ),
      exchange_performance AS (
        SELECT 
          primary_exchange,
          COUNT(*) as stock_count,
          AVG(daily_return_pct) as avg_return,
          AVG(rsi_14) as avg_rsi
        FROM latest_data 
        WHERE rn = 1 AND primary_exchange IS NOT NULL
        GROUP BY primary_exchange
      )
      SELECT 
        primary_exchange as exchange,
        stock_count,
        avg_return,
        avg_rsi,
        CASE 
          WHEN avg_return > 2 THEN 'strong_buy'
          WHEN avg_return > 0 THEN 'buy'
          WHEN avg_return > -2 THEN 'hold'
          ELSE 'sell'
        END as signal
      FROM exchange_performance
      ORDER BY avg_return DESC
    `;

    const result = await client.query(query);
    
    return {
      exchanges: result.rows.map(row => ({
        exchange: row.exchange,
        stockCount: row.stock_count,
        averageReturn: safeParseFloat(row.avg_return),
        averageRSI: safeParseFloat(row.avg_rsi),
        signal: row.signal
      })),
      overallTrend: result.rows.length > 0 ? 
        (result.rows[0].avg_return > 0 ? 'positive' : 'negative') : 'neutral'
    };
  } catch (error) {
    console.error('Error analyzing sector rotation:', error);
    return { exchanges: [], overallTrend: 'neutral' };
  }
}

function generateReasoning(symbol: string, score: number, dailyReturn: number, rsi: number): string {
  const reasons = [];
  
  if (dailyReturn > 0) reasons.push('positive momentum');
  if (rsi && rsi > 40 && rsi < 70) reasons.push('healthy RSI levels');
  if (score > 0.7) reasons.push('strong technical indicators');
  
  return `${symbol} shows ${reasons.join(', ')} with ${Math.round((score || 0) * 100)}% confidence.`;
}

function getRiskSeverity(rsi: number, dailyReturn: number): 'low' | 'medium' | 'high' {
  if (Math.abs(dailyReturn) > 15 || rsi > 85 || rsi < 15) return 'high';
  if (Math.abs(dailyReturn) > 8 || rsi > 80 || rsi < 20) return 'medium';
  return 'low';
}

function getRiskType(rsi: number, dailyReturn: number): string {
  if (rsi > 80) return 'overbought';
  if (rsi < 20) return 'oversold';
  if (Math.abs(dailyReturn) > 10) return 'high_volatility';
  return 'volume_anomaly';
}

function generateRiskMessage(symbol: string, rsi: number, dailyReturn: number): string {
  if (rsi > 80) return `${symbol} is overbought (RSI: ${rsi.toFixed(1)}) - consider taking profits`;
  if (rsi < 20) return `${symbol} is oversold (RSI: ${rsi.toFixed(1)}) - potential buying opportunity`;
  if (Math.abs(dailyReturn) > 10) return `${symbol} showing extreme volatility (${dailyReturn.toFixed(1)}%)`;
  return `${symbol} showing unusual trading activity`;
}
