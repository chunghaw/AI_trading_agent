"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/brand/Logo";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1a1a1a]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/agents" className="flex items-center">
              <Logo size={24} />
            </Link>

            {/* Navigation */}
            <nav className="flex items-center space-x-1">
              <Link
                href="/agents"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/agents"
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Agents
              </Link>
              <Link
                href="/dashboard"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/dashboard"
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/screen"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname?.startsWith("/screen")
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Screener
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#1a1a1a] py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-gray-500">
          © 2025 AI Trading Agent. Built with OpenAI, Next.js & PostgreSQL.
        </div>
      </footer>
    </div>
  );
}

