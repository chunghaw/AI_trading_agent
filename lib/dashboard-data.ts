export interface DashboardMetrics {
  marketBreadth: number;
  dailyPnL: number;
  exposure: number;
  activeSignals: number;
  winRate: number;
  avgHoldTime: number;
}

export interface MarketSentiment {
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  symbols: Array<{
    symbol: string;
    sentiment: number;
    change: number;
    close: number;
    volume: number;
  }>;
}

export interface RecentActivity {
  time: string;
  action: string;
  symbol: string;
  confidence: number;
  status: 'pending' | 'completed' | 'failed';
}

export interface DashboardData {
  summary: any;
  metrics: DashboardMetrics;
  sentiment: MarketSentiment;
  activity: RecentActivity[];
  portfolio: any;
  technicalAnalysis: any;
  sectorPerformance: any;
}

// Fetch all dashboard data from the API
export async function fetchDashboardData(): Promise<DashboardData | null> {
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error || 'Failed to fetch dashboard data');
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return null;
  }
}

// Individual data fetching functions that use the API
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const data = await fetchDashboardData();
  return data?.metrics || getDefaultMetrics();
}

export async function getMarketSentiment(): Promise<MarketSentiment> {
  const data = await fetchDashboardData();
  return data?.sentiment || getDefaultSentiment();
}

export async function getRecentActivity(): Promise<RecentActivity[]> {
  const data = await fetchDashboardData();
  return data?.activity || getDefaultActivity();
}

export async function getPortfolioOverview() {
  const data = await fetchDashboardData();
  return data?.portfolio || null;
}

// Default fallback data
function getDefaultMetrics(): DashboardMetrics {
  return {
    marketBreadth: 68,
    dailyPnL: 2847,
    exposure: 23.5,
    activeSignals: 7,
    winRate: 73,
    avgHoldTime: 4.2
  };
}

function getDefaultSentiment(): MarketSentiment {
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

function getDefaultActivity(): RecentActivity[] {
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
