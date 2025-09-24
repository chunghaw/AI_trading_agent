import React from 'react';
// import { cn } from '../../lib/utils';

// Temporary cn function
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface IndicatorsRowProps {
  indicators: {
    rsi14: number;
    macd: number;
    macd_signal: number;
    macd_hist: number;
    ema20: number;
    ema50: number;
    ema200: number;
    fibonacci_support: number[];
    fibonacci_resistance: number[];
    vwap: number;
    atr: number;
    volume_trend: string;
    volume_price_relationship: string;
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

  const formatValue = (key: string, value: number | string | number[]) => {
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

  return (
    <div className={cn("grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2", className)}>
      {Object.entries(indicators).map(([key, value]) => (
        <div 
          key={key}
          className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-2.5 py-1.5"
        >
          <div className="text-xs font-medium text-zinc-400 mb-1">
            {indicatorLabels[key]}
          </div>
          <div className={cn(
            "text-sm font-semibold",
            getIndicatorColor(key, Array.isArray(value) ? value[0] || 0 : value)
          )}>
            {formatValue(key, value)}
          </div>
        </div>
      ))}
    </div>
  );
}
