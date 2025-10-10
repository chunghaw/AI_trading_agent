"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Activity, AlertTriangle, BarChart3, Filter } from "lucide-react";

interface MarketIndicator {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  lastUpdated: string | null;
}

interface Stock {
  symbol: string;
  company: string;
  price: number | null;
  priceChange: number | null;
  priceChangePercent: number | null;
  volume: number | null;
  marketCap: number | null;
  technical: {
    rsi: number | null;
    macd: {
      line: number | null;
      signal: number | null;
      histogram: number | null;
    };
  };
  trends: {
    volumeTrend: string;
    dailyReturn: number | null;
  };
  lastUpdated: string;
}

interface MarketInsights {
  marketSentiment: {
    sentiment: 'bullish' | 'neutral' | 'bearish';
    bullishPercentage: number;
    bearishPercentage: number;
    neutralPercentage: number;
  };
  topRecommendations: Array<{
    rank: number;
    symbol: string;
    price: number | null;
    dailyReturn: number | null;
    rsi: number | null;
    confidence: number;
    reasoning: string;
  }>;
  breakoutDetection: {
    candidates: Array<{
      symbol: string;
      price: number | null;
      volume: number | null;
      dailyReturn: number | null;
    }>;
    totalDetected: number;
  };
  riskAlerts: Array<{
    symbol: string;
    price: number | null;
    severity: 'low' | 'medium' | 'high';
    type: string;
    rsi: number | null;
    dailyReturn: number | null;
    message: string;
  }>;
  marketOverview: {
    totalStocks: number;
    averagePrice: number | null;
    averageDailyReturn: number | null;
    averageRSI: number | null;
    overboughtStocks: number;
    oversoldStocks: number;
  };
}

export default function DashboardPage() {
  const [marketIndicators, setMarketIndicators] = useState<MarketIndicator[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [insights, setInsights] = useState<MarketInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all dashboard data in parallel
      const [indicatorsResponse, stocksResponse, insightsResponse] = await Promise.all([
        fetch('/api/dashboard/indicators'),
        fetch('/api/dashboard/stocks?limit=20'),
        fetch('/api/dashboard/insights')
      ]);

      if (!indicatorsResponse.ok || !stocksResponse.ok || !insightsResponse.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [indicatorsData, stocksData, insightsData] = await Promise.all([
        indicatorsResponse.json(),
        stocksResponse.json(),
        insightsResponse.json()
      ]);

      if (indicatorsData.success) {
        setMarketIndicators(indicatorsData.data.indices);
      }
      
      if (stocksData.success) {
        setStocks(stocksData.data.stocks);
      }
      
      if (insightsData.success) {
        setInsights(insightsData.data);
      }

    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number | null, decimals = 2): string => {
    if (num === null || num === undefined) return 'N/A';
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatMarketCap = (marketCap: number | null): string => {
    if (marketCap === null || marketCap === undefined) return 'N/A';
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(1)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(1)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(1)}M`;
    return `$${formatNumber(marketCap)}`;
  };

  const getChangeColor = (change: number | null): string => {
    if (change === null) return 'text-gray-400';
    return change >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'bullish': return 'text-green-400 bg-green-900/20 border-green-700/30';
      case 'bearish': return 'text-red-400 bg-red-900/20 border-red-700/30';
      default: return 'text-yellow-400 bg-yellow-900/20 border-yellow-700/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
          <p className="text-[var(--text)]">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={fetchDashboardData} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Market Dashboard</h1>
            <p className="text-gray-400">
              Real-time stock screening and AI-powered market insights
            </p>
          </div>
          <Button onClick={fetchDashboardData} variant="outline" size="sm">
            <Activity className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>
        </div>

        {/* Market Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {marketIndicators.map((indicator) => (
            <Card key={indicator.symbol} className="border-white/10 bg-[#2a2a2a] p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{indicator.symbol}</h3>
                  <p className="text-sm text-gray-400 truncate">{indicator.name}</p>
                </div>
                {indicator.changePercent && indicator.changePercent >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-white">
                  {indicator.price ? `$${formatNumber(indicator.price)}` : 'N/A'}
                </p>
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-medium ${getChangeColor(indicator.change)}`}>
                    {indicator.change && indicator.change >= 0 ? '+' : ''}
                    {formatNumber(indicator.change)}
                  </span>
                  <span className={`text-sm ${getChangeColor(indicator.changePercent)}`}>
                    ({indicator.changePercent && indicator.changePercent >= 0 ? '+' : ''}
                    {formatNumber(indicator.changePercent, 2)}%)
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* AI Market Insights */}
        {insights && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Market Sentiment */}
            <Card className="border-white/10 bg-[#2a2a2a] p-6">
              <div className="flex items-center space-x-2 mb-4">
                <BarChart3 className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-lg font-semibold text-white">Market Sentiment</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSentimentColor(insights.marketSentiment.sentiment)}`}>
                  {insights.marketSentiment.sentiment.toUpperCase()}
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Bullish</span>
                  <span className="text-sm text-green-400 font-medium">{insights.marketSentiment.bullishPercentage}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Bearish</span>
                  <span className="text-sm text-red-400 font-medium">{insights.marketSentiment.bearishPercentage}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Neutral</span>
                  <span className="text-sm text-yellow-400 font-medium">{insights.marketSentiment.neutralPercentage}%</span>
                </div>
              </div>
            </Card>

            {/* Top Recommendations */}
            <Card className="border-white/10 bg-[#2a2a2a] p-6">
              <div className="flex items-center space-x-2 mb-4">
                <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-lg font-semibold text-white">AI Recommendations</h3>
              </div>
              <div className="space-y-3">
                {insights.topRecommendations.map((rec) => (
                  <div key={rec.symbol} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-white">#{rec.rank}</span>
                        <span className="font-semibold text-white">{rec.symbol}</span>
                        <span className={`text-xs px-2 py-1 rounded ${rec.dailyReturn && rec.dailyReturn >= 0 ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                          {rec.dailyReturn && rec.dailyReturn >= 0 ? '+' : ''}{formatNumber(rec.dailyReturn, 2)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{rec.reasoning}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">${formatNumber(rec.price)}</p>
                      <p className="text-xs text-gray-400">{rec.confidence}% confidence</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Stock Screening Table */}
        <Card className="border-white/10 bg-[#2a2a2a]">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-lg font-semibold text-white">Stock Screener</h3>
                <span className="text-sm text-gray-400">({stocks.length} stocks)</span>
              </div>
              <Button variant="outline" size="sm">
                Advanced Filters
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Symbol</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Company</th>
                  <th className="text-right p-4 text-sm font-medium text-gray-400">Price</th>
                  <th className="text-right p-4 text-sm font-medium text-gray-400">Change</th>
                  <th className="text-right p-4 text-sm font-medium text-gray-400">RSI</th>
                  <th className="text-right p-4 text-sm font-medium text-gray-400">Market Cap</th>
                  <th className="text-right p-4 text-sm font-medium text-gray-400">Volume Trend</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock) => (
                  <tr key={stock.symbol} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <span className="font-semibold text-white">{stock.symbol}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-gray-300 truncate max-w-48 block">
                        {stock.company}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-medium text-white">
                        {stock.price ? `$${formatNumber(stock.price)}` : 'N/A'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {stock.priceChangePercent && stock.priceChangePercent >= 0 ? (
                          <TrendingUp className="w-3 h-3 text-green-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                        <span className={`text-sm font-medium ${getChangeColor(stock.priceChangePercent)}`}>
                          {stock.priceChangePercent && stock.priceChangePercent >= 0 ? '+' : ''}
                          {formatNumber(stock.priceChangePercent, 2)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className={`text-sm font-medium ${
                        stock.technical.rsi && stock.technical.rsi > 70 ? 'text-red-400' :
                        stock.technical.rsi && stock.technical.rsi < 30 ? 'text-green-400' :
                        'text-gray-300'
                      }`}>
                        {formatNumber(stock.technical.rsi, 1)}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm text-gray-300">
                        {formatMarketCap(stock.marketCap)}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className={`text-xs px-2 py-1 rounded ${
                        stock.trends.volumeTrend === 'rising' ? 'bg-green-900/20 text-green-400' :
                        stock.trends.volumeTrend === 'falling' ? 'bg-red-900/20 text-red-400' :
                        'bg-gray-900/20 text-gray-400'
                      }`}>
                        {stock.trends.volumeTrend}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Risk Alerts */}
        {insights && insights.riskAlerts.length > 0 && (
          <Card className="border-white/10 bg-[#2a2a2a] p-6">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-lg font-semibold text-white">Risk Alerts</h3>
              <span className="text-sm text-gray-400">({insights.riskAlerts.length} alerts)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {insights.riskAlerts.slice(0, 6).map((alert, index) => (
                <div key={index} className={`p-4 rounded-lg border ${
                  alert.severity === 'high' ? 'border-red-500/30 bg-red-900/10' :
                  alert.severity === 'medium' ? 'border-yellow-500/30 bg-yellow-900/10' :
                  'border-gray-500/30 bg-gray-900/10'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white">{alert.symbol}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      alert.severity === 'high' ? 'bg-red-900/20 text-red-400' :
                      alert.severity === 'medium' ? 'bg-yellow-900/20 text-yellow-400' :
                      'bg-gray-900/20 text-gray-400'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mb-2">{alert.message}</p>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>RSI: {formatNumber(alert.rsi, 1)}</span>
                    <span>{formatNumber(alert.dailyReturn, 2)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

