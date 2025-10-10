import { NextResponse } from "next/server";

// Market indices symbols - using available ETFs (VIXY instead of VIX since VIX is not available)
const MARKET_INDICES = ['SPY', 'QQQ', 'DIA', 'VIXY'];

// Helper function to safely parse numbers
const safeParseFloat = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

export async function GET() {
  try {
    // Get market indices data directly from database instead of making HTTP calls
    const { Client } = await import('pg');
    
    let client: any = null;
    
    try {
      console.log('Connecting to database...');
      client = new Client({
        connectionString: process.env.POSTGRES_URL || 'postgresql://neondb_owner:npg_GhSFKa2wf8vb@ep-billowing-waterfall-a76q5go4-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require',
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
      console.log('✅ Database connected');

      const indices = await Promise.all(
        MARKET_INDICES.map(async (symbol) => {
          try {
            // Get latest data for each index from database
            const query = `
              SELECT 
                close,
                last_close as prev_close,
                date,
                COALESCE(change_pct, 0) as change_percent,
                (close - last_close) as change
              FROM gold_ohlcv_daily_metrics
              WHERE symbol = $1
                AND date >= CURRENT_DATE - INTERVAL '30 days'
                AND close > 0
              ORDER BY date DESC
              LIMIT 1
            `;

            const result = await client.query(query, [symbol]);
            console.log(`${symbol} query result:`, result.rows.length, 'rows');
            
            if (result.rows.length > 0) {
              const row = result.rows[0];
              console.log(`${symbol} data:`, row);
              return {
                symbol,
                name: getIndexName(symbol),
                price: safeParseFloat(row.close),
                change: safeParseFloat(row.change),
                changePercent: safeParseFloat(row.change_percent),
                lastUpdated: row.date,
                description: getIndexDescription(symbol)
              };
            }
            
            // Fallback if no data found
            return {
              symbol,
              name: getIndexName(symbol),
              price: null,
              change: null,
              changePercent: null,
              lastUpdated: null,
              description: getIndexDescription(symbol)
            };
          } catch (error) {
            console.error(`Failed to fetch ${symbol} from database:`, error);
            return {
              symbol,
              name: getIndexName(symbol),
              price: null,
              change: null,
              changePercent: null,
              lastUpdated: null,
              description: getIndexDescription(symbol)
            };
          }
        })
      );

      // Calculate market summary
      const marketSummary = {
        totalIndices: indices.length,
        positiveIndices: indices.filter(idx => idx.changePercent && idx.changePercent > 0).length,
        negativeIndices: indices.filter(idx => idx.changePercent && idx.changePercent < 0).length,
        averageChange: indices.reduce((sum, idx) => sum + (idx.changePercent || 0), 0) / indices.length,
        lastUpdated: new Date().toISOString()
      };

      return NextResponse.json({
        success: true,
        data: {
          indices,
          summary: marketSummary
        }
      });

    } finally {
      if (client) {
        await client.end();
      }
    }

  } catch (error) {
    console.error('Dashboard indicators API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch market indicators',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function getIndexName(symbol: string): string {
  const names: Record<string, string> = {
    'SPY': 'SPDR S&P 500 ETF Trust',
    'QQQ': 'Invesco QQQ Trust',
    'DIA': 'SPDR Dow Jones Industrial Average ETF',
    'VIXY': 'ProShares VIX Short-Term Futures ETF'
  };
  return names[symbol] || symbol;
}

function getIndexDescription(symbol: string): string {
  const descriptions: Record<string, string> = {
    'SPY': 'Tracks the S&P 500 index, representing 500 largest US companies',
    'QQQ': 'Tracks the NASDAQ-100 index, focused on technology and growth stocks',
    'DIA': 'Tracks the Dow Jones Industrial Average, representing 30 blue-chip stocks',
    'VIXY': 'Tracks VIX futures, measures market volatility and investor fear'
  };
  return descriptions[symbol] || `Major market index: ${symbol}`;
}
