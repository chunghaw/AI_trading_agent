"use client";

import { cn } from "../../lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Command, Settings } from "lucide-react";
import Logo from "../../components/brand/Logo";

const navigation = [
  {
    name: "Agents",
    href: "/agents",
    icon: (props: any) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
        <path d="M16 3.128a4 4 0 0 1 0 7.744"></path>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
        <circle cx="9" cy="7" r="4"></circle>
      </svg>
    ),
  },
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: (props: any) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M3 3v16a2 2 0 0 0 2 2h16"></path>
        <path d="M18 17V9"></path>
        <path d="M13 17V5"></path>
        <path d="M8 17v-3"></path>
      </svg>
    ),
  },
  {
    name: "Bot",
    href: "/bot",
    icon: (props: any) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 8V4H8"></path>
        <rect width="16" height="12" x="4" y="8" rx="2"></rect>
        <path d="M2 14h2"></path>
        <path d="M20 14h2"></path>
        <path d="M15 13v2"></path>
        <path d="M9 13v2"></path>
      </svg>
    ),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-50 h-20 backdrop-blur-md bg-[#2a2a2a]/60 border-b border-white/10 shadow-lg">
        <div className="container max-w-[1200px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center space-x-12">
            <Logo size={36} />
            <nav className="flex items-center space-x-3">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-3 px-5 py-3 rounded-xl text-base font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-black/20",
                      isActive
                        ? "bg-[var(--accent)]/15 text-[var(--accent)] shadow-sm shadow-[var(--accent)]/10"
                        : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5 border border-transparent hover:border-white/10"
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center space-x-5">
            <div className="flex items-center space-x-3 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
              <div className="w-3 h-3 bg-[var(--accent)] rounded-full animate-pulse shadow-sm shadow-[var(--accent)]/50" />
              <span className="text-base text-[var(--text)] font-medium">Live</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-11 w-11 p-0 hover:bg-white/5 border border-transparent hover:border-white/10"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>
      <main className="min-h-[calc(100vh-80px)]">
        {children}
      </main>
    </div>
  );
}
