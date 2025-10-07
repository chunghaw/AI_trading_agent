import React from 'react';
// import { cn } from '../../lib/utils';

import { cn } from "../../lib/utils";

interface IndicatorsRowProps {
  indicators: {
    rsi14: number | null;
    macd: number | null;
    macd_signal: number | null;
    macd_hist: number | null;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
    fibonacci_support: number[] | null;
    fibonacci_resistance: number[] | null;
    vwap: number | null;
    atr: number | null;
    volume_trend: string | null;
    volume_price_relationship: string | null;
  };
  className?: string;
}

export function IndicatorsRow({ indicators, className }: IndicatorsRowProps) {
  const getIndicatorColor = (key: string, value: number | string) => {
    if (key === 'rsi14') {
      const numValue = Number(value);
      if (numValue > 70) return 'text-rose-400';
      if (numValue < 30) return 'text-emerald-400';
      return 'text-zinc-300';
    }
    if (key === 'macd_hist') {
      return Number(value) > 0 ? 'text-emerald-400' : 'text-rose-400';
    }
    if (key === 'volume_trend') {
      if (value === 'increasing') return 'text-emerald-400';
      if (value === 'decreasing') return 'text-rose-400';
      return 'text-zinc-300';
    }
    if (key === 'volume_price_relationship') {
      if (value === 'bullish') return 'text-emerald-400';
      if (value === 'bearish') return 'text-rose-400';
      return 'text-zinc-300';
    }
    return 'text-zinc-300';
  };

  const formatValue = (key: string, value: number | string | number[] | null) => {
    if (value === null || value === undefined) return '—';
    
    if (key === 'rsi14') return `${Number(value).toFixed(1)}`;
    if (key.startsWith('ema')) return `${Number(value).toFixed(0)}`;
    if (key === 'atr') return `${Number(value).toFixed(2)}`;
    if (key === 'vwap') return `${Number(value).toFixed(2)}`;
    if (key === 'fibonacci_support' || key === 'fibonacci_resistance') {
      const arr = Array.isArray(value) ? value : [];
      return arr.length > 0 ? `${arr[0].toFixed(0)}` : '—';
    }
    if (key === 'volume_trend' || key === 'volume_price_relationship') {
      return String(value).replace('_', ' ').toUpperCase();
    }
    return Number(value).toFixed(3);
  };

  const indicatorLabels: Record<string, string> = {
    rsi14: 'RSI',
    macd: 'MACD',
    macd_signal: 'Signal',
    macd_hist: 'Hist',
    ema20: 'EMA20',
    ema50: 'EMA50',
    ema200: 'EMA200',
    fibonacci_support: 'FIB SUP',
    fibonacci_resistance: 'FIB RES',
    vwap: 'VWAP',
    atr: 'ATR',
    volume_trend: 'VOL TREND',
    volume_price_relationship: 'VOL-PRICE'
  };

  // Filter out indicators with null values
  const validIndicators = Object.entries(indicators).filter(([key, value]) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value !== 'insufficient_data';
    return true;
  });

  return (
    <div className={cn("grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2", className)}>
      {validIndicators.map(([key, value]) => (
        <div 
          key={key}
          className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-2.5 py-1.5"
        >
          <div className="text-xs font-medium text-zinc-400 mb-1">
            {indicatorLabels[key]}
          </div>
          <div className={cn(
            "text-sm font-semibold",
            getIndicatorColor(key, Array.isArray(value) ? value[0] || 0 : (value as number | string))
          )}>
            {formatValue(key, value)}
          </div>
        </div>
      ))}
    </div>
  );
}
