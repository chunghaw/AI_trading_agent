import Link from "next/link";
import { Command, Settings } from "lucide-react";
import Navigation from "./Navigation";

// Temporary cn function to get build working
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-50 h-20 backdrop-blur-md bg-[#2a2a2a]/60 border-b border-white/10 shadow-lg">
        <div className="container max-w-[1200px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center space-x-12">
            <div className="text-2xl font-bold text-white">AI Trading</div>
            <Navigation />
          </div>
          <div className="flex items-center space-x-5">
            <div className="flex items-center space-x-3 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
              <div className="w-3 h-3 bg-[var(--accent)] rounded-full animate-pulse shadow-sm shadow-[var(--accent)]/50" />
              <span className="text-base text-[var(--text)] font-medium">Live</span>
            </div>
            <button
              className="h-11 w-11 p-0 hover:bg-white/5 border border-transparent hover:border-white/10 rounded-lg flex items-center justify-center"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="min-h-[calc(100vh-80px)]">
        {children}
      </main>
    </div>
  );
}
