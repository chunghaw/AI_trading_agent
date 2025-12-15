"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, TrendingUp, Package, Coins, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Ticker {
  id: number;
  symbol: string;
  ticker_type: "stock" | "etf" | "crypto";
  added_by: string | null;
  added_at: string;
  is_active: boolean;
  polygon_verified: boolean;
  last_ingested_at: string | null;
  notes: string | null;
}

export function TickerManagement() {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "stock" | "etf" | "crypto">("all");

  useEffect(() => {
    fetchTickers();
  }, []);

  const fetchTickers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/tickers/add?active_only=true");
      const data = await response.json();
      if (data.success) {
        setTickers(data.tickers || []);
      }
    } catch (error) {
      console.error("Error fetching tickers:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = {
    total: tickers.length,
    stocks: tickers.filter(t => t.ticker_type === "stock").length,
    etfs: tickers.filter(t => t.ticker_type === "etf").length,
    crypto: tickers.filter(t => t.ticker_type === "crypto").length,
  };

  // Filter tickers
  const filteredTickers = tickers.filter(ticker => {
    const matchesSearch = ticker.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || ticker.ticker_type === filterType;
    return matchesSearch && matchesType;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-[#3a3a3a] border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--muted)] mb-1">Total Tickers</p>
              <p className="text-2xl font-bold text-[var(--text)]">{stats.total}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-[var(--accent)]" />
          </div>
        </Card>

        <Card className="p-4 bg-[#3a3a3a] border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--muted)] mb-1">Stocks</p>
              <p className="text-2xl font-bold text-[var(--text)]">{stats.stocks}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-400" />
          </div>
        </Card>

        <Card className="p-4 bg-[#3a3a3a] border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--muted)] mb-1">ETFs</p>
              <p className="text-2xl font-bold text-[var(--text)]">{stats.etfs}</p>
            </div>
            <Package className="w-8 h-8 text-green-400" />
          </div>
        </Card>

        <Card className="p-4 bg-[#3a3a3a] border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--muted)] mb-1">Crypto</p>
              <p className="text-2xl font-bold text-[var(--text)]">{stats.crypto}</p>
            </div>
            <Coins className="w-8 h-8 text-yellow-400" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 bg-[#3a3a3a] border-white/10">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <Input
              type="text"
              placeholder="Search tickers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#2a2a2a] border-white/10 text-[var(--text)]"
            />
          </div>

          {/* Type Filter */}
          <div className="flex gap-2">
            {(["all", "stock", "etf", "crypto"] as const).map((type) => (
              <Button
                key={type}
                onClick={() => setFilterType(type)}
                variant={filterType === type ? "default" : "outline"}
                className={cn(
                  "capitalize",
                  filterType === type
                    ? "bg-[var(--accent)] text-black hover:bg-[var(--accent-600)]"
                    : "bg-[#2a2a2a] border-white/10 text-[var(--text)] hover:bg-white/10"
                )}
              >
                {type === "all" ? "All" : type}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Tickers List */}
      <Card className="bg-[#3a3a3a] border-white/10">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-[var(--text)]">
            Available Tickers ({filteredTickers.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading tickers...</div>
        ) : filteredTickers.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            {searchTerm || filterType !== "all"
              ? "No tickers match your filters"
              : "No tickers added yet"}
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredTickers.map((ticker) => (
              <div
                key={ticker.id}
                className="p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-[var(--text)]">
                          {ticker.symbol}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded capitalize",
                            ticker.ticker_type === "stock" && "bg-blue-500/20 text-blue-400",
                            ticker.ticker_type === "etf" && "bg-green-500/20 text-green-400",
                            ticker.ticker_type === "crypto" && "bg-yellow-500/20 text-yellow-400"
                          )}
                        >
                          {ticker.ticker_type}
                        </span>
                        {ticker.polygon_verified && (
                          <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted)] space-y-0.5">
                        <p>Added: {formatDate(ticker.added_at)}</p>
                        {ticker.last_ingested_at && (
                          <p>Last ingested: {formatDate(ticker.last_ingested_at)}</p>
                        )}
                        {!ticker.last_ingested_at && (
                          <p className="text-yellow-400">
                            Pending: Will be ingested in next DAG run
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ticker.is_active ? (
                      <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded bg-gray-500/20 text-gray-400">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

