import React from 'react';
// import { cn } from '@/lib/utils';

// Temporary cn function
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

import { ExternalLink } from 'lucide-react';

interface CitationsChipsProps {
  citations: string[];
  className?: string;
}

export function CitationsChips({ citations, className }: CitationsChipsProps) {
  const parseUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return {
        domain: urlObj.hostname.replace('www.', ''),
        fullUrl: url
      };
    } catch {
      return {
        domain: 'unknown',
        fullUrl: url
      };
    }
  };

  if (citations.length === 0) {
    return (
      <div className={cn("text-sm text-zinc-500", className)}>
        No citations available
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {citations.slice(0, 3).map((citation, index) => {
        const { domain, fullUrl } = parseUrl(citation);
        return (
          <a
            key={index}
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-zinc-900/60 border border-zinc-800 rounded-lg text-sm text-emerald-400 hover:text-emerald-300 hover:bg-zinc-900/80 transition-colors"
          >
            <span className="font-medium">{domain}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        );
      })}
    </div>
  );
}
