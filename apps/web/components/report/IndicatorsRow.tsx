import React from 'react';
import { cn } from '@/lib/utils';

interface IndicatorsRowProps {
  indicators: {
    rsi14: number;
    macd: number;
    macd_signal: number;
    macd_hist: number;
    ema20: number;
    ema50: number;
    ema200: number;
    atr14: number;
  };
  className?: string;
}

export function IndicatorsRow({ indicators, className }: IndicatorsRowProps) {
  const getIndicatorColor = (key: string, value: number) => {
    if (key === 'rsi14') {
      if (value > 70) return 'text-rose-400';
      if (value < 30) return 'text-emerald-400';
      return 'text-zinc-300';
    }
    if (key === 'macd_hist') {
      return value > 0 ? 'text-emerald-400' : 'text-rose-400';
    }
    return 'text-zinc-300';
  };

  const formatValue = (key: string, value: number) => {
    if (key === 'rsi14') return `${value.toFixed(1)}`;
    if (key.startsWith('ema')) return `${value.toFixed(0)}`;
    if (key === 'atr14') return `${value.toFixed(2)}`;
    return value.toFixed(3);
  };

  const indicatorLabels: Record<string, string> = {
    rsi14: 'RSI',
    macd: 'MACD',
    macd_signal: 'Signal',
    macd_hist: 'Hist',
    ema20: 'EMA20',
    ema50: 'EMA50',
    ema200: 'EMA200',
    atr14: 'ATR'
  };

  return (
    <div className={cn("grid grid-cols-4 md:grid-cols-8 gap-2", className)}>
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
            getIndicatorColor(key, value)
          )}>
            {formatValue(key, value)}
          </div>
        </div>
      ))}
    </div>
  );
}
