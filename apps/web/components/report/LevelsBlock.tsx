import React from 'react';
// import { cn } from '@/lib/utils';

// Temporary cn function
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface LevelsBlockProps {
  levels: {
    support: (number | string)[];
    resistance: (number | string)[];
    breakout_trigger?: number | string;
  };
  className?: string;
}

export function LevelsBlock({ levels, className }: LevelsBlockProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-2">Support Levels</h4>
          <div className="space-y-1">
            {levels.support.length > 0 ? (
              levels.support.map((level, index) => (
                <div key={index} className="text-sm text-emerald-400 font-mono">
                  ${Number(level).toFixed(2)}
                </div>
              ))
            ) : (
              <div className="text-sm text-zinc-500">No support levels identified</div>
            )}
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-2">Resistance Levels</h4>
          <div className="space-y-1">
            {levels.resistance.length > 0 ? (
              levels.resistance.map((level, index) => (
                <div key={index} className="text-sm text-rose-400 font-mono">
                  ${Number(level).toFixed(2)}
                </div>
              ))
            ) : (
              <div className="text-sm text-zinc-500">No resistance levels identified</div>
            )}
          </div>
        </div>
      </div>
      
      {levels.breakout_trigger && (
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-1">Breakout Trigger</h4>
          <div className="text-sm text-emerald-400 font-mono">
            ${Number(levels.breakout_trigger).toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}
