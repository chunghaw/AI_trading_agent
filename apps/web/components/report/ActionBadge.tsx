import React from 'react';
// import { cn } from '../../lib/utils';

// Temporary cn function
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface ActionBadgeProps {
  action: 'BUY' | 'SELL' | 'FLAT';
  className?: string;
}

export function ActionBadge({ action, className }: ActionBadgeProps) {
  const colors = {
    BUY: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    SELL: 'bg-red-500/20 text-red-400 border-red-500/30',
    FLAT: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  };
  
  return (
    <span className={cn(
      "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border",
      colors[action],
      className
    )}>
      {action}
    </span>
  );
}
