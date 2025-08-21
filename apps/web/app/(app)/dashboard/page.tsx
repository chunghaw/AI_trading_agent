"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPI } from "@/components/ui/kpi";
import { 
  TrendingUp, 
  TrendingDown,
  Activity,
  DollarSign,
  BarChart3,
  Clock,
  RefreshCw,
  Minus
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { 
  getDashboardMetrics, 
  getMarketSentiment, 
  getRecentActivity, 
  getPortfolioOverview,
  fetchDashboardData,
  type DashboardMetrics,
  type MarketSentiment,
  type RecentActivity
} from "../../../lib/dashboard-data";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [technicalAnalysis, setTechnicalAnalysis] = useState<any>(null);
  const [sectorPerformance, setSectorPerformance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    fetchDashboardDataLocal();
  }, []);

  const fetchDashboardDataLocal = async () => {
    try {
      setLoading(true);
      const data = await fetchDashboardData();
      
      if (data) {
        setMetrics(data.metrics);
        setSentiment(data.sentiment);
        setActivity(data.activity);
        setPortfolio(data.portfolio);
        setTechnicalAnalysis(data.technicalAnalysis);
        setSectorPerformance(data.sectorPerformance);
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        // Fallback to individual calls if the main API fails
        const [metricsData, sentimentData, activityData, portfolioData] = await Promise.all([
          getDashboardMetrics(),
          getMarketSentiment(),
          getRecentActivity(),
          getPortfolioOverview()
        ]);
        
        setMetrics(metricsData);
        setSentiment(sentimentData);
        setActivity(activityData);
        setPortfolio(portfolioData);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return <TrendingUp className="w-5 h-5 text-emerald-400" />;
      case 'bearish':
        return <TrendingDown className="w-5 h-5 text-red-400" />;
      default:
        return <Activity className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return 'text-emerald-400';
      case 'bearish':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  if (loading) {
    return (
      <div className="container max-w-[1200px] mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-[var(--text)] tracking-tight">Dashboard</h1>
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[var(--muted)]" />
            <span className="text-lg text-[var(--muted)]">Loading real market data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-[1200px] mx-auto px-4 py-8 space-y-8">
      {/* Page Title with Last Updated */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-[var(--text)] tracking-tight">Dashboard</h1>
        <p className="text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
          Live market metrics and trading insights
        </p>
        <div className="flex items-center justify-center space-x-2">
          <span className="text-sm text-[var(--muted)]">Last updated:</span>
          <span className="text-sm font-medium text-[var(--text)]">{lastUpdated}</span>
          <button 
            onClick={fetchDashboardDataLocal}
            className="ml-2 p-1 hover:bg-[var(--panel2)] rounded transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4 text-[var(--muted)]" />
          </button>
        </div>
      </div>

      {/* Portfolio Overview */}
      {portfolio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Portfolio Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--text)]">
                  ${portfolio.totalValue.toLocaleString()}
                </div>
                <div className="text-sm text-[var(--muted)]">Total Value</div>
              </div>
              <div className="text-center">
                <div className={cn(
                  "text-2xl font-bold",
                  portfolio.totalChange >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {portfolio.totalChange >= 0 ? "+" : ""}${Math.abs(portfolio.totalChange).toLocaleString()}
                </div>
                <div className="text-sm text-[var(--muted)]">Daily Change</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--text)]">
                  {portfolio.symbolCount}
                </div>
                <div className="text-sm text-[var(--muted)]">Active Symbols</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <KPI
            label="Market Breadth"
            value={`${metrics.marketBreadth}%`}
            delta={{ value: 5.2, isPositive: metrics.marketBreadth > 50 }}
          />
          <KPI
            label="Daily PnL"
            value={`$${Math.abs(metrics.dailyPnL).toLocaleString()}`}
            delta={{ value: Math.abs(metrics.dailyPnL), isPositive: metrics.dailyPnL > 0 }}
          />
          <KPI
            label="Exposure"
            value={`${metrics.exposure}%`}
            delta={{ value: -2.1, isPositive: false }}
          />
          <KPI
            label="Active Signals"
            value={metrics.activeSignals.toString()}
            delta={{ value: 1, isPositive: true }}
          />
          <KPI
            label="Win Rate"
            value={`${metrics.winRate}%`}
            delta={{ value: 3.2, isPositive: true }}
          />
          <KPI
            label="Avg Hold Time"
            value={`${metrics.avgHoldTime}h`}
            delta={{ value: -0.8, isPositive: false }}
          />
        </div>
      )}

      {/* Sentiment Widget */}
      {sentiment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Market Sentiment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-base text-[var(--muted)] font-medium">Overall Sentiment</span>
                <div className="flex items-center space-x-2">
                  {getSentimentIcon(sentiment.overallSentiment)}
                  <span className={cn("text-base font-medium", getSentimentColor(sentiment.overallSentiment))}>
                    {sentiment.overallSentiment.charAt(0).toUpperCase() + sentiment.overallSentiment.slice(1)}
                  </span>
                </div>
              </div>
              
              <div className="space-y-4">
                {sentiment.symbols.map((item) => (
                  <div key={item.symbol} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-base font-medium text-[var(--text)]">{item.symbol}</span>
                      <span className="text-sm text-[var(--muted)]">${item.close.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="w-32 bg-[var(--panel2)] rounded-full h-3 border border-white/10">
                        <div
                          className={cn(
                            "h-3 rounded-full transition-all duration-300",
                            item.sentiment > 0.6 ? "bg-emerald-400" : 
                            item.sentiment < 0.4 ? "bg-red-400" : "bg-yellow-400"
                          )}
                          style={{ width: `${item.sentiment * 100}%` }}
                        />
                      </div>
                      <span className={cn(
                        "text-sm font-medium px-2 py-1 rounded-lg",
                        item.change > 0 
                          ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20" 
                          : "text-red-400 bg-red-400/10 border border-red-400/20"
                      )}>
                        {item.change > 0 ? "+" : ""}{(item.change * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Major Stocks Performance */}
      {sentiment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              📈 Major Stocks Performance
              <span className="text-sm font-normal text-[var(--muted)]">Real-time Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sentiment.symbols.map((stock) => (
                <div key={stock.symbol} className="p-4 rounded-lg border border-[var(--border)] bg-[var(--panel)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-[var(--text)]">{stock.symbol}</span>
                    <span className="text-sm text-[var(--muted)]">${stock.close.toFixed(2)}</span>
                  </div>
                  
                  {/* Price Change */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[var(--muted)]">Daily Change</span>
                    <span className={cn(
                      "text-sm font-bold px-2 py-1 rounded",
                      stock.change > 0 
                        ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20" 
                        : "text-red-400 bg-red-400/10 border border-red-400/20"
                    )}>
                      {stock.change > 0 ? "+" : ""}{(stock.change * 100).toFixed(2)}%
                    </span>
                  </div>
                  
                  {/* Sentiment Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[var(--muted)]">Sentiment</span>
                      <span className="text-xs text-[var(--muted)]">{(stock.sentiment * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-[var(--panel2)] rounded-full h-2 border border-white/10">
                      <div
                        className={cn(
                          "h-2 rounded-full transition-all duration-300",
                          stock.sentiment > 0.6 ? "bg-emerald-400" : 
                          stock.sentiment < 0.4 ? "bg-red-400" : "bg-yellow-400"
                        )}
                        style={{ width: `${stock.sentiment * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Volume */}
                  <div className="text-xs text-[var(--muted)]">
                    Volume: {(stock.volume / 1000000).toFixed(1)}M
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Technical Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            📊 Technical Analysis Summary
              <span className="text-sm font-normal text-[var(--muted)]">Key Indicators</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* RSI Analysis */}
            <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--panel)]">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--text)] mb-2">RSI</div>
                <div className="text-sm text-[var(--muted)] mb-2">Relative Strength Index</div>
                <div className="w-16 h-16 mx-auto rounded-full border-4 border-[var(--border)] flex items-center justify-center">
                  <span className={cn(
                    "text-lg font-bold",
                    technicalAnalysis?.rsi > 70 ? "text-red-400" : 
                    technicalAnalysis?.rsi < 30 ? "text-emerald-400" : "text-[var(--accent)]"
                  )}>
                    {technicalAnalysis?.rsi || 48}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-2">
                  {technicalAnalysis?.rsiStatus || 'Neutral'}
                </div>
              </div>
            </div>
            
            {/* MACD Analysis */}
            <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--panel)]">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--text)] mb-2">MACD</div>
                <div className="text-sm text-[var(--muted)] mb-2">Moving Average Convergence</div>
                <div className="w-16 h-16 mx-auto rounded-full border-4 border-[var(--border)] flex items-center justify-center">
                  <span className={cn(
                    "text-lg font-bold",
                    technicalAnalysis?.macd > 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {technicalAnalysis?.macd?.toFixed(2) || '-2.65'}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-2">
                  {technicalAnalysis?.macdStatus || 'Bearish'}
                </div>
              </div>
            </div>
            
            {/* Moving Averages */}
            <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--panel)]">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--text)] mb-2">MA</div>
                <div className="text-sm text-[var(--muted)] mb-2">Moving Averages</div>
                <div className="w-16 h-16 mx-auto rounded-full border-4 border-[var(--border)] flex items-center justify-center">
                  <span className={cn(
                    "text-lg font-bold",
                    technicalAnalysis?.maTrend === 'Bullish' ? "text-emerald-400" : 
                    technicalAnalysis?.maTrend === 'Bearish' ? "text-red-400" : "text-yellow-400"
                  )}>
                    {technicalAnalysis?.maTrend || 'Mixed'}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-2">
                  {technicalAnalysis?.maStatus || 'Trend Unclear'}
                </div>
              </div>
            </div>
            
            {/* Volatility */}
            <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--panel)]">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--text)] mb-2">ATR</div>
                <div className="text-sm text-[var(--muted)] mb-2">Average True Range</div>
                <div className="w-16 h-16 mx-auto rounded-full border-4 border-[var(--border)] flex items-center justify-center">
                  <span className={cn(
                    "text-lg font-bold",
                    technicalAnalysis?.volatility === 'High' ? "text-red-400" : 
                    technicalAnalysis?.volatility === 'Low' ? "text-emerald-400" : "text-yellow-400"
                  )}>
                    {technicalAnalysis?.atr?.toFixed(1) || '12.4'}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-2">
                  {technicalAnalysis?.volatility || 'Moderate'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            🌍 Market Analysis
              <span className="text-sm font-normal text-[var(--muted)]">Sector & Trend Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Market Breadth Analysis */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-[var(--border)] bg-[var(--panel)]">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[var(--accent)]"></div>
                <span className="text-base font-medium text-[var(--text)]">Market Breadth</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[var(--text)]">{metrics?.marketBreadth}%</div>
                <div className="text-sm text-[var(--muted)]">
                  {metrics && metrics.marketBreadth > 50 ? 'Bullish' : 'Bearish'} Market
                </div>
              </div>
            </div>
            
            {/* Sector Performance */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sectorPerformance && Object.entries(sectorPerformance).slice(0, 3).map(([sector, data]: [string, any]) => (
                <div key={sector} className="p-4 rounded-lg border border-[var(--border)] bg-[var(--panel)]">
                  <div className="text-center">
                    <div className="text-lg font-bold text-[var(--text)] mb-2">{sector}</div>
                    <div className={cn(
                      "text-2xl font-bold mb-1",
                      data.change > 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {data.change > 0 ? "+" : ""}{data.change}%
                    </div>
                    <div className="text-sm text-[var(--muted)]">{data.status}</div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Trend Analysis */}
            <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--panel)]">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-[var(--text)]">Overall Trend</span>
                <div className="flex items-center gap-2">
                  {technicalAnalysis?.maTrend === 'Bearish' ? (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  ) : technicalAnalysis?.maTrend === 'Bullish' ? (
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Minus className="w-5 h-5 text-yellow-400" />
                  )}
                  <span className={cn(
                    "text-base font-medium",
                    technicalAnalysis?.maTrend === 'Bearish' ? "text-red-400" :
                    technicalAnalysis?.maTrend === 'Bullish' ? "text-emerald-400" : "text-yellow-400"
                  )}>
                    {technicalAnalysis?.maTrend === 'Bearish' ? 'Short-term Bearish' :
                     technicalAnalysis?.maTrend === 'Bullish' ? 'Short-term Bullish' : 'Mixed Signals'}
                  </span>
                </div>
              </div>
              <div className="mt-3 text-sm text-[var(--muted)]">
                Market breadth at {metrics?.marketBreadth}% with {technicalAnalysis?.rsiStatus.toLowerCase()} RSI conditions. 
                {technicalAnalysis?.maStatus} across major indices.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Change Highlights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            💰 Price Change Highlights
              <span className="text-sm font-normal text-[var(--muted)]">Top Movers</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Gainers */}
            <div>
              <h4 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Top Gainers
              </h4>
              <div className="space-y-3">
                {sentiment?.symbols
                  .filter(stock => stock.change > 0)
                  .sort((a, b) => b.change - a.change)
                  .slice(0, 3)
                  .map((stock) => (
                    <div key={stock.symbol} className="flex items-center justify-between p-3 rounded-lg bg-emerald-400/10 border border-emerald-400/20">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-[var(--text)]">{stock.symbol}</span>
                        <span className="text-sm text-[var(--muted)]">${stock.close.toFixed(2)}</span>
                      </div>
                      <span className="text-lg font-bold text-emerald-400">
                        +{(stock.change * 100).toFixed(2)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            
            {/* Top Losers */}
            <div>
              <h4 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                Top Losers
              </h4>
              <div className="space-y-3">
                {sentiment?.symbols
                  .filter(stock => stock.change < 0)
                  .sort((a, b) => a.change - b.change)
                  .slice(0, 3)
                  .map((stock) => (
                    <div key={stock.symbol} className="flex items-center justify-between p-3 rounded-lg bg-red-400/10 border border-red-400/20">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-[var(--text)]">{stock.symbol}</span>
                        <span className="text-sm text-[var(--muted)]">${stock.close.toFixed(2)}</span>
                      </div>
                      <span className="text-lg font-bold text-red-400">
                        {(stock.change * 100).toFixed(2)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OHLCV Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Price Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-[var(--panel2)] rounded-2xl flex items-center justify-center border border-white/10">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 text-[var(--muted)] mx-auto mb-4" />
              <p className="text-base text-[var(--muted)]">Chart component coming soon</p>
              <p className="text-sm text-[var(--muted)] mt-2">Will show OHLCV with EMA overlays</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Timeline */}
      {activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {activity.map((item, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    item.status === "completed" ? "bg-emerald-400" : 
                    item.status === "pending" ? "bg-yellow-400" : "bg-red-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-base text-[var(--text)] clamp-2">
                        {item.action} - {item.symbol}
                      </p>
                      <span className="text-sm text-[var(--muted)] ml-4">{item.time}</span>
                    </div>
                    <div className="flex items-center space-x-3 mt-2">
                      <span className="text-sm text-[var(--muted)]">
                        Confidence: {(item.confidence * 100).toFixed(0)}%
                      </span>
                      <div className="w-20 bg-[var(--panel2)] rounded-full h-2 border border-white/10">
                        <div
                          className="bg-[var(--accent)] h-2 rounded-full transition-all duration-300"
                          style={{ width: `${item.confidence * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
