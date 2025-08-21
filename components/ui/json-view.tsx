"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
// import { cn } from "@/lib/utils";

// Temporary cn function
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface JSONViewProps {
  data: any;
  title?: string;
  className?: string;
}

export function JSONView({ data, title, className }: JSONViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={cn(
      "bg-[var(--panel)] border border-white/5 rounded-2xl shadow-sm backdrop-blur-sm",
      className
    )}>
      <div className="flex items-center justify-between px-6 py-4">
        <h4 className="text-sm font-medium text-[var(--text)]">
          {title || "JSON Data"}
        </h4>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 hover:bg-white/5 rounded-lg transition-colors duration-200 border border-transparent hover:border-white/10"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--muted)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--muted)]" />
          )}
        </button>
      </div>
      {isExpanded && (
        <div className="px-6 pb-6">
          <pre className="bg-black/20 rounded-xl p-4 max-h-72 overflow-auto text-xs font-mono text-[var(--text)] border border-white/5 backdrop-blur-sm">
            <code>{JSON.stringify(data, null, 2)}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
