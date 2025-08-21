import React from 'react';
// import { cn } from '@/lib/utils';

// Temporary cn function
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface ConfidenceBarProps {
  value: number; // 0..1
  className?: string;
}

export function ConfidenceBar({ value, className }: ConfidenceBarProps) {
  const percentage = Math.round(value * 100);
  
  return (
    <div className={cn("flex items-center space-x-3", className)}>
      <div className="flex-1 bg-zinc-800 rounded-full h-2.5 overflow-hidden">
        <div 
          className="h-full bg-emerald-500 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium text-zinc-400 min-w-[3rem] text-right">
        {percentage}%
      </span>
    </div>
  );
}
