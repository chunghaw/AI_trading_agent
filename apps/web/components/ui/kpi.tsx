"use client";

import * as React from "react"
// import { cn } from "@/lib/utils"

// Temporary cn function
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface KPIProps {
  label: string;
  value: string | number;
  delta?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function KPI({ label, value, delta, className }: KPIProps) {
  return (
    <div className={cn(
      "bg-[var(--panel)] border border-white/5 rounded-2xl shadow-sm backdrop-blur-sm",
      className
    )}>
      <div className="px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--muted)] font-medium">{label}</p>
            <p className="text-2xl font-bold text-[var(--text)] mt-1">{value}</p>
          </div>
          {delta && (
            <div className={cn(
              "flex items-center space-x-1 text-sm font-medium px-2 py-1 rounded-lg",
              delta.isPositive 
                ? "text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/20" 
                : "text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20"
            )}>
              {delta.isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{Math.abs(delta.value)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
