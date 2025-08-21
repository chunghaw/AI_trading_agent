import React from 'react';
// import { cn } from '@/lib/utils';

// Temporary cn function
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface IndicatorGaugesProps {
  indicators?: Record<string, number>;
  className?: string;
}

export function IndicatorGauges({ indicators, className }: IndicatorGaugesProps) {
  if (!indicators || Object.keys(indicators).length === 0) {
    return (
      <div className={cn("text-[15px] text-[var(--muted)]", className)}>
        No technical indicators available
      </div>
    );
  }

  const getIndicatorColor = (key: string, value: number) => {
    if (key === 'rsi14') {
      if (value > 70) return 'text-red-400';
      if (value < 30) return 'text-green-400';
      return 'text-[var(--muted)]';
    }
    if (key === 'macd_hist') {
      return value > 0 ? 'text-green-400' : 'text-red-400';
    }
    return 'text-[var(--muted)]';
  };

  const getIndicatorArrow = (key: string, value: number) => {
    if (key === 'macd_hist') {
      return value > 0 ? '▲' : '▼';
    }
    return null;
  };

  const formatValue = (key: string, value: number) => {
    if (key === 'rsi14') return `${value.toFixed(1)}`;
    if (key.startsWith('ema')) return `${value.toFixed(0)}`;
    return value.toFixed(2);
  };

  const indicatorLabels: Record<string, string> = {
    rsi14: 'RSI',
    macd: 'MACD',
    macd_signal: 'Signal',
    macd_hist: 'Hist',
    ema20: 'EMA20',
    ema50: 'EMA50',
    ema200: 'EMA200'
  };

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3", className)}>
      {Object.entries(indicators).map(([key, value]) => (
        <div 
          key={key}
          className="bg-[var(--panel2)] rounded-lg p-3 border border-[var(--border)]"
        >
          <div className="text-xs font-medium text-[var(--muted)] mb-1">
            {indicatorLabels[key] || key}
          </div>
          <div className={cn(
            "text-sm font-semibold flex items-center space-x-1",
            getIndicatorColor(key, value)
          )}>
            <span>{formatValue(key, value)}</span>
            {getIndicatorArrow(key, value) && (
              <span className="text-xs">{getIndicatorArrow(key, value)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
