import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface NewsListProps {
  citations: string[];
  limit?: number;
  rationale?: string;
  className?: string;
}

export function NewsList({ citations, limit = 6, rationale, className }: NewsListProps) {
  const [showFullRationale, setShowFullRationale] = useState(false);

  const parseUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return {
        domain: urlObj.hostname.replace('www.', ''),
        path: urlObj.pathname.slice(1).split('/').slice(0, 2).join('/'),
        fullUrl: url
      };
    } catch {
      return {
        domain: 'unknown',
        path: url.length > 30 ? url.slice(0, 30) + '...' : url,
        fullUrl: url
      };
    }
  };

  const displayedCitations = citations.slice(0, limit);

  return (
    <div className={cn("space-y-4", className)}>
      {displayedCitations.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {displayedCitations.map((citation, index) => {
            const { domain, path, fullUrl } = parseUrl(citation);
            return (
              <a
                key={index}
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-[var(--panel2)] hover:bg-[var(--accent)]/10 border border-[var(--border)] hover:border-[var(--accent)]/30 rounded-full text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors"
              >
                <span className="font-medium">{domain}</span>
                {path && (
                  <>
                    <span className="text-[var(--muted)]">/</span>
                    <span className="text-[var(--muted)] truncate max-w-[100px]">{path}</span>
                  </>
                )}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            );
          })}
        </div>
      ) : (
        <div className="text-[15px] text-[var(--muted)]">
          No news citations available
        </div>
      )}

      {rationale && (
        <div className="text-[15px] leading-snug text-[var(--text)]">
          <div className={cn(
            "text-[15px] leading-snug text-[var(--text)]",
            !showFullRationale && "line-clamp-3"
          )}>
            {rationale}
          </div>
          {rationale.length > 150 && (
            <button
              onClick={() => setShowFullRationale(!showFullRationale)}
              className="mt-2 text-sm text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors"
            >
              {showFullRationale ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
