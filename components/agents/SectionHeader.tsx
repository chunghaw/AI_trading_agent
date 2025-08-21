import React from 'react';
// import { cn } from '@/lib/utils';

// Temporary cn function
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface SectionHeaderProps {
  id: string;
  title: string;
  badge?: React.ReactNode;
  right?: React.ReactNode;
}

export function SectionHeader({ id, title, badge, right }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-3">
        <h2 
          id={id}
          className="text-[17px] font-medium tracking-tight text-[var(--text)] hover:text-[var(--accent)] transition-colors"
        >
          <a href={`#${id}`} className="hover:underline">
            {title}
          </a>
        </h2>
        {badge && (
          <div className="flex-shrink-0">
            {badge}
          </div>
        )}
      </div>
      {right && (
        <div className="flex-shrink-0">
          {right}
        </div>
      )}
    </div>
  );
}
