import { NextResponse } from "next/server";

// Market indices symbols
const MARKET_INDICES = ['SPY', 'QQQ', 'DIA', 'VIX'];

// Helper function to safely parse numbers
const safeParseFloat = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

export async function GET() {
  try {
    // For now, we'll use the existing database to get market indices data
    // In a full implementation, you might want to fetch real-time data from Polygon API
    
    const indices = await Promise.all(
      MARKET_INDICES.map(async (symbol) => {
        try {
          // Fetch latest data for each index from our database
          const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `Get latest market data for ${symbol}`,
              timeframe: '1d',
              since_days: 1
            })
          });

          if (response.ok) {
            const data = await response.json();
            const price = data.header?.price;
            
            return {
              symbol,
              name: getIndexName(symbol),
              price: price?.current || null,
              change: price?.change || null,
              changePercent: price?.changePercent || null,
              lastUpdated: price?.asOfDate || null,
              description: getIndexDescription(symbol)
            };
          }
          
          // Fallback to null if fetch fails
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
          console.error(`Failed to fetch ${symbol}:`, error);
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
    'VIX': 'CBOE Volatility Index'
  };
  return names[symbol] || symbol;
}

function getIndexDescription(symbol: string): string {
  const descriptions: Record<string, string> = {
    'SPY': 'Tracks the S&P 500 index, representing the performance of 500 large-cap U.S. companies',
    'QQQ': 'Tracks the NASDAQ-100 index, focusing on the 100 largest non-financial companies on NASDAQ',
    'DIA': 'Tracks the Dow Jones Industrial Average, representing 30 large-cap blue-chip U.S. companies',
    'VIX': 'Measures market volatility and investor fear, often called the "fear gauge"'
  };
  return descriptions[symbol] || `Market index for ${symbol}`;
}
