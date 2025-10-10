import { NextResponse } from "next/server";

// Market indices symbols - using actual stocks that are likely in our database
const MARKET_INDICES = ['AAPL', 'GOOGL', 'MSFT', 'TSLA'];

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
      client = new Client({
        connectionString: process.env.POSTGRES_URL || 'postgresql://neondb_owner:npg_GhSFKa2wf8vb@ep-billowing-waterfall-a76q5go4-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require',
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();

      const indices = await Promise.all(
        MARKET_INDICES.map(async (symbol) => {
          try {
            // Get latest data for each index from database
            const query = `
              WITH latest_data AS (
                SELECT 
                  g.close, g.date,
                  LAG(g.close) OVER (PARTITION BY g.symbol ORDER BY g.date) as prev_close,
                  ROW_NUMBER() OVER (PARTITION BY g.symbol ORDER BY g.date DESC) as rn
                FROM gold_ohlcv_daily_metrics g
                WHERE g.symbol = $1
                  AND g.date >= CURRENT_DATE - INTERVAL '30 days'
                  AND g.close > 0
              )
              SELECT 
                close,
                prev_close,
                date,
                CASE 
                  WHEN prev_close > 0 THEN ((close - prev_close) / prev_close) * 100
                  ELSE NULL 
                END as change_percent,
                (close - prev_close) as change
              FROM latest_data
              WHERE rn = 1
            `;

            const result = await client.query(query, [symbol]);
            
            if (result.rows.length > 0) {
              const row = result.rows[0];
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
    'AAPL': 'Apple Inc.',
    'GOOGL': 'Alphabet Inc. (Google)',
    'MSFT': 'Microsoft Corporation',
    'TSLA': 'Tesla Inc.'
  };
  return names[symbol] || symbol;
}

function getIndexDescription(symbol: string): string {
  const descriptions: Record<string, string> = {
    'AAPL': 'Technology giant and iPhone maker, one of the world\'s most valuable companies',
    'GOOGL': 'Dominant search engine and cloud computing leader, parent company of Google',
    'MSFT': 'Software and cloud computing leader, maker of Windows and Office',
    'TSLA': 'Electric vehicle pioneer and renewable energy company led by Elon Musk'
  };
  return descriptions[symbol] || `Major stock for ${symbol}`;
}
