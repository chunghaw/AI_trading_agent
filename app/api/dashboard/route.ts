import { NextRequest, NextResponse } from "next/server";
// import { getSymbolSummary, getSymbolData } from "@/lib/data-reader";

// Temporary functions
const getSymbolSummary = async () => ({ 
  symbols: [
    { symbol: 'NVDA', daily_return_pct: 0.05, close: 500, volume: 1000000, daily_range: 10 }
  ],
  last_updated: new Date().toISOString()
});
const getSymbolData = async () => [
  { symbol: 'NVDA', close: 500, volume: 1000000 }
];

export async function GET(req: NextRequest) {
  try {
    // Get all dashboard data
    const [summary, metrics, sentiment, activity, portfolio, technicalAnalysis, sectorPerformance] = await Promise.all([
      getSymbolSummary(),
      getDashboardMetrics(),
      getMarketSentiment(),
      getRecentActivity(),
      getPortfolioOverview(),
      getTechnicalAnalysis(),
      getSectorPerformance()
    ]);

    return NextResponse.json({
      success: true,
      data: {
        summary,
        metrics,
        sentiment,
        activity,
        portfolio,
        technicalAnalysis,
        sectorPerformance
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Dashboard metrics calculation
async function getDashboardMetrics() {
  try {
    const summary = await getSymbolSummary();
    
    if (!summary || !summary.symbols) {
      return getDefaultMetrics();
    }

    const symbols = summary.symbols;
    const totalSymbols = symbols.length;
    const positiveReturns = symbols.filter(s => s.daily_return_pct > 0).length;
    const marketBreadth = (positiveReturns / totalSymbols) * 100;
    
    // Calculate portfolio metrics based on realistic positions
    const portfolioPositions = symbols.slice(0, 10).map((symbol, index) => {
      const shares = Math.floor(Math.random() * 100) + 10; // 10-110 shares
      const positionValue = shares * symbol.close;
      const dailyChange = positionValue * symbol.daily_return_pct;
      return { positionValue, dailyChange };
    });
    
    const totalValue = portfolioPositions.reduce((sum, pos) => sum + pos.positionValue, 0);
    const totalChange = portfolioPositions.reduce((sum, pos) => sum + pos.dailyChange, 0);
    const dailyPnL = totalChange;
    
    // Simulate exposure based on volume
    const totalVolume = symbols.reduce((sum, s) => sum + s.volume, 0);
    const avgVolume = totalVolume / totalSymbols;
    const exposure = Math.min(100, (avgVolume / 100000000) * 10); // Scale to reasonable percentage
    
    return {
      marketBreadth: Math.round(marketBreadth * 10) / 10,
      dailyPnL: Math.round(dailyPnL * 100) / 100,
      exposure: Math.round(exposure * 10) / 10,
      activeSignals: Math.floor(Math.random() * 5) + 5, // Simulate 5-10 active signals
      winRate: Math.floor(Math.random() * 20) + 65, // Simulate 65-85% win rate
      avgHoldTime: Math.floor(Math.random() * 3) + 3 // Simulate 3-6 hours
    };
  } catch (error) {
    console.error('Error calculating dashboard metrics:', error);
    return getDefaultMetrics();
  }
}

// Market sentiment calculation
async function getMarketSentiment() {
  try {
    const summary = await getSymbolSummary();
    
    if (!summary || !summary.symbols) {
      return getDefaultSentiment();
    }

    const symbols = summary.symbols.slice(0, 5); // Top 5 symbols
    
    // Calculate sentiment based on daily returns and volume
    const symbolSentiments = symbols.map(symbol => {
      const sentiment = Math.max(0, Math.min(1, 0.5 + (symbol.daily_return_pct * 10))); // Scale return to 0-1
      const change = symbol.daily_return_pct;
      
      return {
        symbol: symbol.symbol,
        sentiment,
        change,
        close: symbol.close,
        volume: symbol.volume
      };
    });

    // Calculate overall sentiment
    const avgSentiment = symbolSentiments.reduce((sum, s) => sum + s.sentiment, 0) / symbolSentiments.length;
    let overallSentiment: 'bullish' | 'bearish' | 'neutral';
    
    if (avgSentiment > 0.6) overallSentiment = 'bullish';
    else if (avgSentiment < 0.4) overallSentiment = 'bearish';
    else overallSentiment = 'neutral';

    return {
      overallSentiment,
      symbols: symbolSentiments
    };
  } catch (error) {
    console.error('Error calculating market sentiment:', error);
    return getDefaultSentiment();
  }
}

// Recent activity calculation
async function getRecentActivity() {
  try {
    const summary = await getSymbolSummary();
    
    if (!summary || !summary.symbols) {
      return getDefaultActivity();
    }

    const symbols = summary.symbols.slice(0, 4); // Top 4 symbols
    const actions = ['BUY signal generated', 'SELL order executed', 'Risk check passed', 'Technical analysis completed'];
    const statuses: Array<'pending' | 'completed' | 'failed'> = ['pending', 'completed', 'completed', 'completed'];
    
    const activities = symbols.map((symbol, index) => {
      const timeAgo = index === 0 ? '2 min ago' : 
                     index === 1 ? '15 min ago' : 
                     index === 2 ? '1 hour ago' : '2 hours ago';
      
      const action = actions[index % actions.length];
      const status = statuses[index % statuses.length];
      const confidence = 0.7 + (Math.random() * 0.2); // 0.7-0.9 confidence
      
      return {
        time: timeAgo,
        action,
        symbol: symbol.symbol,
        confidence,
        status
      };
    });

    return activities;
  } catch (error) {
    console.error('Error calculating recent activity:', error);
    return getDefaultActivity();
  }
}

// Portfolio overview calculation
async function getPortfolioOverview() {
  try {
    const summary = await getSymbolSummary();
    
    if (!summary || !summary.symbols) {
      return null;
    }

    // Simulate a realistic portfolio with position sizes
    const portfolioPositions = summary.symbols.slice(0, 10).map((symbol, index) => {
      // Simulate different position sizes (shares * price)
      const shares = Math.floor(Math.random() * 100) + 10; // 10-110 shares
      const positionValue = shares * symbol.close;
      const dailyChange = positionValue * symbol.daily_return_pct;
      
      return {
        symbol: symbol.symbol,
        shares,
        price: symbol.close,
        positionValue,
        dailyChange
      };
    });

    const totalValue = portfolioPositions.reduce((sum, pos) => sum + pos.positionValue, 0);
    const totalChange = portfolioPositions.reduce((sum, pos) => sum + pos.dailyChange, 0);
    const totalChangePercent = totalChange / (totalValue - totalChange) * 100;
    
    return {
      totalValue: Math.round(totalValue * 100) / 100,
      totalChange: Math.round(totalChange * 100) / 100,
      totalChangePercent: Math.round(totalChangePercent * 100) / 100,
      symbolCount: portfolioPositions.length,
      lastUpdated: summary.last_updated,
      positions: portfolioPositions
    };
  } catch (error) {
    console.error('Error calculating portfolio overview:', error);
    return null;
  }
}

// Technical analysis data
async function getTechnicalAnalysis() {
  try {
    const summary = await getSymbolSummary();
    
    if (!summary || !summary.symbols) {
      return getDefaultTechnicalAnalysis();
    }

    // Calculate aggregate technical indicators from available data
    const symbols = summary.symbols.slice(0, 10); // Top 10 symbols
    
    // Calculate average daily range as volatility proxy
    const avgDailyRange = symbols.reduce((sum, s) => sum + s.daily_range, 0) / symbols.length;
    
    // Calculate RSI-like metric based on positive vs negative returns
    const positiveReturns = symbols.filter(s => s.daily_return_pct > 0).length;
    const rsi = (positiveReturns / symbols.length) * 100;
    
    // Calculate MACD-like metric based on return momentum
    const avgReturn = symbols.reduce((sum, s) => sum + s.daily_return_pct, 0) / symbols.length;
    const macd = avgReturn * 100; // Scale to reasonable range
    
    // Determine moving average trend
    const aboveAvg = symbols.filter(s => s.close > 200).length; // Simple threshold
    const maTrend = aboveAvg > symbols.length / 2 ? 'Bullish' : 'Bearish';
    
    return {
      rsi: Math.round(rsi),
      rsiStatus: rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral',
      macd: Math.round(macd * 100) / 100,
      macdStatus: macd > 0 ? 'Bullish' : 'Bearish',
      maTrend,
      maStatus: maTrend === 'Bullish' ? 'Above Averages' : 'Below Averages',
      atr: Math.round(avgDailyRange * 100) / 100,
      volatility: avgDailyRange > 10 ? 'High' : avgDailyRange > 5 ? 'Moderate' : 'Low'
    };
  } catch (error) {
    console.error('Error calculating technical analysis:', error);
    return getDefaultTechnicalAnalysis();
  }
}

// Sector performance data
async function getSectorPerformance() {
  try {
    const summary = await getSymbolSummary();
    
    if (!summary || !summary.symbols) {
      return getDefaultSectorPerformance();
    }

    // Group symbols by sector (simplified mapping)
    const sectorMapping: Record<string, string[]> = {
      'Technology': ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META', 'TSLA'],
      'Healthcare': ['JNJ', 'UNH', 'ABBV', 'PFE', 'ABT', 'LLY'],
      'Financials': ['BRK.B', 'BAC', 'JPM', 'V', 'MA', 'WFC'],
      'Consumer': ['AMZN', 'HD', 'MCD', 'KO', 'PG', 'WMT'],
      'Industrial': ['HON', 'UNP', 'RTX', 'LOW', 'CAT', 'BA']
    };

    const sectorPerformance: Record<string, any> = {};
    
    for (const [sector, symbols] of Object.entries(sectorMapping)) {
      const sectorSymbols = summary.symbols.filter(s => symbols.includes(s.symbol));
      if (sectorSymbols.length > 0) {
        const avgReturn = sectorSymbols.reduce((sum, s) => sum + s.daily_return_pct, 0) / sectorSymbols.length;
        const totalVolume = sectorSymbols.reduce((sum, s) => sum + s.volume, 0);
        
        sectorPerformance[sector] = {
          change: Math.round(avgReturn * 10000) / 100, // Convert to percentage
          volume: totalVolume,
          status: avgReturn > 0.01 ? 'Leading' : avgReturn < -0.01 ? 'Under Pressure' : 'Mixed Signals',
          symbolCount: sectorSymbols.length
        };
      }
    }

    return sectorPerformance;
  } catch (error) {
    console.error('Error calculating sector performance:', error);
    return getDefaultSectorPerformance();
  }
}

// Default fallback data
function getDefaultMetrics() {
  return {
    marketBreadth: 68,
    dailyPnL: 2847,
    exposure: 23.5,
    activeSignals: 7,
    winRate: 73,
    avgHoldTime: 4.2
  };
}

function getDefaultSentiment() {
  return {
    overallSentiment: 'bullish',
    symbols: [
      { symbol: 'NVDA', sentiment: 0.78, change: 0.05, close: 180.45, volume: 156602161 },
      { symbol: 'TSLA', sentiment: 0.65, change: -0.02, close: 330.56, volume: 74319792 },
      { symbol: 'AAPL', sentiment: 0.72, change: 0.03, close: 231.59, volume: 56038657 },
      { symbol: 'MSFT', sentiment: 0.81, change: 0.08, close: 520.17, volume: 25213272 },
      { symbol: 'GOOGL', sentiment: 0.69, change: -0.01, close: 203.9, volume: 34931422 }
    ]
  };
}

function getDefaultActivity() {
  return [
    {
      time: '2 min ago',
      action: 'BUY signal generated',
      symbol: 'NVDA',
      confidence: 0.78,
      status: 'pending'
    },
    {
      time: '15 min ago',
      action: 'SELL order executed',
      symbol: 'TSLA',
      confidence: 0.82,
      status: 'completed'
    },
    {
      time: '1 hour ago',
      action: 'Risk check passed',
      symbol: 'AAPL',
      confidence: 0.91,
      status: 'completed'
    },
    {
      time: '2 hours ago',
      action: 'Technical analysis completed',
      symbol: 'MSFT',
      confidence: 0.75,
      status: 'completed'
    }
  ];
}

// Default technical analysis data
function getDefaultTechnicalAnalysis() {
  return {
    rsi: 48,
    rsiStatus: 'Neutral',
    macd: -2.65,
    macdStatus: 'Bearish',
    maTrend: 'Mixed',
    maStatus: 'Trend Unclear',
    atr: 12.4,
    volatility: 'Moderate'
  };
}

// Default sector performance data
function getDefaultSectorPerformance() {
  return {
    'Technology': { change: 2.3, volume: 1000000000, status: 'Leading', symbolCount: 6 },
    'Healthcare': { change: -1.2, volume: 800000000, status: 'Under Pressure', symbolCount: 6 },
    'Financials': { change: 0.5, volume: 600000000, status: 'Mixed Signals', symbolCount: 6 }
  };
}
