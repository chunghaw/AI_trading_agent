"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPI } from "@/components/ui/kpi";
import { 
  TrendingUp, 
  TrendingDown,
  Activity,
  DollarSign,
  BarChart3,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  return (
    <div className="container max-w-[1200px] mx-auto px-4 py-8 space-y-8">
      {/* Page Title - Bigger and More Prominent */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-[var(--text)] tracking-tight">Dashboard</h1>
        <p className="text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
          Live market metrics and trading insights
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <KPI
          label="Market Breadth"
          value="68%"
          delta={{ value: 5.2, isPositive: true }}
        />
        <KPI
          label="Daily PnL"
          value="$2,847"
          delta={{ value: 12.3, isPositive: true }}
        />
        <KPI
          label="Exposure"
          value="23.5%"
          delta={{ value: -2.1, isPositive: false }}
        />
        <KPI
          label="Active Signals"
          value="7"
          delta={{ value: 1, isPositive: true }}
        />
        <KPI
          label="Win Rate"
          value="73%"
          delta={{ value: 3.2, isPositive: true }}
        />
        <KPI
          label="Avg Hold Time"
          value="4.2h"
          delta={{ value: -0.8, isPositive: false }}
        />
      </div>

      {/* Sentiment Widget */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Market Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-base text-[var(--muted)] font-medium">Overall Sentiment</span>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
                <span className="text-base font-medium text-[var(--accent)]">Bullish</span>
              </div>
            </div>
            
            <div className="space-y-4">
              {[
                { symbol: "NVDA", sentiment: 0.78, change: 0.05 },
                { symbol: "TSLA", sentiment: 0.65, change: -0.02 },
                { symbol: "AAPL", sentiment: 0.72, change: 0.03 },
                { symbol: "MSFT", sentiment: 0.81, change: 0.08 },
                { symbol: "GOOGL", sentiment: 0.69, change: -0.01 }
              ].map((item) => (
                <div key={item.symbol} className="flex items-center justify-between">
                  <span className="text-base font-medium text-[var(--text)]">{item.symbol}</span>
                  <div className="flex items-center space-x-4">
                    <div className="w-32 bg-[var(--panel2)] rounded-full h-3 border border-white/10">
                      <div
                        className="bg-[var(--accent)] h-3 rounded-full transition-all duration-300"
                        style={{ width: `${item.sentiment * 100}%` }}
                      />
                    </div>
                    <span className={cn(
                      "text-sm font-medium px-2 py-1 rounded-lg",
                      item.change > 0 
                        ? "text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/20" 
                        : "text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20"
                    )}>
                      {item.change > 0 ? "+" : ""}{item.change.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[
              {
                time: "2 min ago",
                action: "BUY signal generated",
                symbol: "NVDA",
                confidence: 0.78,
                status: "pending"
              },
              {
                time: "15 min ago",
                action: "SELL order executed",
                symbol: "TSLA",
                confidence: 0.82,
                status: "completed"
              },
              {
                time: "1 hour ago",
                action: "Risk check passed",
                symbol: "AAPL",
                confidence: 0.91,
                status: "completed"
              },
              {
                time: "2 hours ago",
                action: "Technical analysis completed",
                symbol: "MSFT",
                confidence: 0.75,
                status: "completed"
              }
            ].map((item, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  item.status === "completed" ? "bg-[var(--accent)]" : "bg-[var(--muted)]"
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
    </div>
  );
}
