"use client";

import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

interface ChartDataPoint {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  ma_50: number | null;
  ma_200: number | null;
  ema_20: number | null;
  rsi: number | null;
  macd_line: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
}

interface StockChartProps {
  data: ChartDataPoint[];
  ticker: string;
  height?: number;
}

export function StockChart({ data, ticker, height = 400 }: StockChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No chart data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Price Chart with Moving Averages */}
      <div>
        <h3 className="text-sm text-gray-400 mb-2">Price & Moving Averages</h3>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="date" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '4px',
              }}
              labelStyle={{ color: '#9CA3AF' }}
              itemStyle={{ color: '#E5E7EB' }}
              formatter={(value: any) => {
                if (value === null) return 'N/A';
                return typeof value === 'number' ? value.toFixed(2) : value;
              }}
              labelFormatter={(label) => {
                return new Date(label).toLocaleDateString();
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="line"
            />
            
            {/* Price Line */}
            <Line
              type="monotone"
              dataKey="close"
              stroke="#10B981"
              strokeWidth={2}
              dot={false}
              name="Close"
              connectNulls
            />
            
            {/* Moving Averages */}
            <Line
              type="monotone"
              dataKey="ma_50"
              stroke="#3B82F6"
              strokeWidth={1.5}
              dot={false}
              name="MA50"
              connectNulls
              strokeDasharray="5 5"
            />
            <Line
              type="monotone"
              dataKey="ma_200"
              stroke="#F59E0B"
              strokeWidth={1.5}
              dot={false}
              name="MA200"
              connectNulls
              strokeDasharray="5 5"
            />
            <Line
              type="monotone"
              dataKey="ema_20"
              stroke="#8B5CF6"
              strokeWidth={1}
              dot={false}
              name="EMA20"
              connectNulls
              strokeDasharray="2 2"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Volume Chart */}
      <div>
        <h3 className="text-sm text-gray-400 mb-2">Volume</h3>
        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="date" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              tickFormatter={(value) => {
                if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
                if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
                return value.toString();
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '4px',
              }}
              labelStyle={{ color: '#9CA3AF' }}
              formatter={(value: any) => {
                if (value === null) return 'N/A';
                if (typeof value === 'number') {
                  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
                  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
                  return value.toFixed(0);
                }
                return value;
              }}
            />
            <Bar
              dataKey="volume"
              fill="url(#colorVolume)"
              name="Volume"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* RSI Chart */}
      <div>
        <h3 className="text-sm text-gray-400 mb-2">RSI (14)</h3>
        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="date" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '4px',
              }}
              formatter={(value: any) => {
                if (value === null) return 'N/A';
                return typeof value === 'number' ? value.toFixed(2) : value;
              }}
            />
            <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Overbought', fill: '#EF4444', fontSize: 10 }} />
            <ReferenceLine y={30} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Oversold', fill: '#10B981', fontSize: 10 }} />
            <Line
              type="monotone"
              dataKey="rsi"
              stroke="#A78BFA"
              strokeWidth={2}
              dot={false}
              name="RSI"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* MACD Chart */}
      <div>
        <h3 className="text-sm text-gray-400 mb-2">MACD</h3>
        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="date" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '4px',
              }}
              formatter={(value: any) => {
                if (value === null) return 'N/A';
                return typeof value === 'number' ? value.toFixed(4) : value;
              }}
            />
            <ReferenceLine y={0} stroke="#6B7280" />
            <Line
              type="monotone"
              dataKey="macd_line"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              name="MACD"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="macd_signal"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={false}
              name="Signal"
              connectNulls
            />
            <Bar
              dataKey="macd_histogram"
              fill="#8B5CF6"
              name="Histogram"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Mini sparkline chart for screener table
interface MiniChartProps {
  data: { date: string; close: number }[];
  width?: number;
  height?: number;
}

export function MiniPriceChart({ data, width = 100, height = 40 }: MiniChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <ResponsiveContainer width={width} height={height}>
      <ComposedChart data={data}>
        <Line
          type="monotone"
          dataKey="close"
          stroke="#10B981"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
