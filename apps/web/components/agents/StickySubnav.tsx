import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Section {
  id: string;
  label: string;
}

interface StickySubnavProps {
  sections: Section[];
  className?: string;
}

export function StickySubnav({ sections, className }: StickySubnavProps) {
  const [activeSection, setActiveSection] = useState<string>('summary');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100; // Offset for header

      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className={cn(
      "sticky top-14 z-40 bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--border)]",
      className
    )}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-6">
        <div className="flex items-center space-x-1 py-3">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === section.id
                  ? "bg-[var(--accent)]/15 text-[var(--accent)] shadow-sm shadow-[var(--accent)]/10"
                  : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5"
              )}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
