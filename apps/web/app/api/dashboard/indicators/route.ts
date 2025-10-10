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
    // Temporary hardcoded data to test frontend
    const indices = [
      {
        symbol: 'SPY',
        name: 'SPDR S&P 500 ETF Trust',
        price: 671.16,
        change: -1.95,
        changePercent: -0.29,
        lastUpdated: '2025-10-09',
        description: 'Tracks the S&P 500 index, representing 500 largest US companies'
      },
      {
        symbol: 'QQQ',
        name: 'Invesco QQQ Trust',
        price: 610.70,
        change: -0.74,
        changePercent: -0.12,
        lastUpdated: '2025-10-09',
        description: 'Tracks the NASDAQ-100 index, focused on technology and growth stocks'
      },
      {
        symbol: 'DIA',
        name: 'SPDR Dow Jones Industrial Average ETF',
        price: 463.50,
        change: -2.57,
        changePercent: -0.55,
        lastUpdated: '2025-10-09',
        description: 'Tracks the Dow Jones Industrial Average, representing 30 blue-chip stocks'
      },
      {
        symbol: 'VIXY',
        name: 'ProShares VIX Short-Term Futures ETF',
        price: 33.25,
        change: 0.37,
        changePercent: 1.13,
        lastUpdated: '2025-09-23',
        description: 'Tracks VIX futures, measures market volatility and investor fear'
      }
    ];

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
