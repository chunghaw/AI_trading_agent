import React from 'react';
import { cn } from '@/lib/utils';

interface Position {
  symbol: string;
  qty: number;
  px: number;
}

interface PositionsListProps {
  positions?: Position[];
  className?: string;
}

export function PositionsList({ positions, className }: PositionsListProps) {
  if (!positions || positions.length === 0) {
    return (
      <div className={cn("text-[15px] text-[var(--muted)]", className)}>
        No open positions
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {positions.map((position, index) => (
        <div
          key={index}
          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-[var(--panel2)] border border-[var(--border)] rounded-full text-sm"
        >
          <span className="font-medium text-[var(--text)]">{position.symbol}</span>
          <span className="text-[var(--muted)]">·</span>
          <span className="text-[var(--text)]">{position.qty.toLocaleString()}</span>
          <span className="text-[var(--muted)]">@</span>
          <span className="text-[var(--text)]">${position.px.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
