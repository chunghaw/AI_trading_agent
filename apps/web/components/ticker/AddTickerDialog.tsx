"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddTickerDialogProps {
  onTickerAdded?: (ticker: string) => void;
}

// Helper function to calculate next DAG run time
function getNextDagRunTime(): string {
  const now = new Date();
  const utcHour = now.getUTCHours();
  
  // News DAG runs at 5 AM UTC daily
  // OHLCV DAG runs at 5 AM UTC (21:00 UTC previous day) and 5 PM SGT (09:00 UTC)
  
  let nextRun = new Date(now);
  nextRun.setUTCHours(5, 0, 0, 0);
  
  // If it's past 5 AM UTC today, next run is tomorrow
  if (utcHour >= 5) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }
  
  // Format: "Dec 15, 5:00 AM UTC" or "Today, 5:00 AM UTC" if within 24 hours
  const isToday = nextRun.getUTCDate() === now.getUTCDate() && 
                  nextRun.getUTCMonth() === now.getUTCMonth();
  
  if (isToday) {
    return `Today at ${nextRun.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZone: 'UTC',
      hour12: true 
    })} UTC`;
  } else {
    return nextRun.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
      hour12: true
    }) + ' UTC';
  }
}

export function AddTickerDialog({ onTickerAdded }: AddTickerDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [tickerType, setTickerType] = useState<"stock" | "etf" | "crypto">("stock");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/tickers/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          ticker_type: tickerType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle ticker already exists case
        if (data.code === "TICKER_EXISTS" && data.ticker) {
          const addedDate = new Date(data.ticker.added_at);
          const nextDagRun = getNextDagRunTime();
          setError(
            `Ticker ${data.ticker.symbol} was already requested on ${addedDate.toLocaleDateString()} at ${addedDate.toLocaleTimeString()}. ` +
            `It will be processed in the next DAG run (${nextDagRun}).`
          );
          return;
        }
        throw new Error(data.error || "Failed to add ticker");
      }

      const nextDagRun = getNextDagRunTime();
      setSuccess(
        `Ticker ${data.ticker.symbol} added successfully! ` +
        `Data will be available after next DAG run (${nextDagRun}).`
      );
      setSymbol("");
      
      if (onTickerAdded) {
        onTickerAdded(data.ticker.symbol);
      }

      // Auto-close after 2 seconds
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to add ticker");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-black rounded-lg font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Ticker
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md border border-white/10 bg-[#3a3a3a] shadow-xl">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[var(--text)]">Add New Ticker</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsOpen(false);
                setSymbol("");
                setError(null);
                setSuccess(null);
              }}
              className="h-8 w-8 p-0 hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Symbol Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text)]">
                Ticker Symbol
              </label>
              <Input
                type="text"
                value={symbol}
                onChange={(e) => {
                  setSymbol(e.target.value.toUpperCase());
                  setError(null);
                }}
                placeholder="e.g., AAPL, SPY, BTC"
                className="bg-[#2a2a2a] border-white/10 text-[var(--text)] placeholder:text-[var(--muted)]"
                maxLength={10}
                autoFocus
              />
              <p className="text-xs text-[var(--muted)]">
                Enter a stock, ETF, or crypto ticker symbol
              </p>
            </div>

            {/* Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text)]">
                Type
              </label>
              <div className="flex gap-2">
                {(["stock", "etf", "crypto"] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    onClick={() => setTickerType(type)}
                    variant={tickerType === type ? "default" : "outline"}
                    className={cn(
                      "flex-1 capitalize",
                      tickerType === type
                        ? "bg-[var(--accent)] text-black hover:bg-[var(--accent-600)]"
                        : "bg-[#2a2a2a] border-white/10 text-[var(--text)] hover:bg-white/10"
                    )}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 space-y-1">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">Ticker Already Exists</span>
                </div>
                <p className="text-xs text-red-300/80 pl-6">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400 space-y-1">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">Success!</span>
                </div>
                <p className="text-xs text-green-300/80 pl-6">{success}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsOpen(false);
                  setSymbol("");
                  setError(null);
                  setSuccess(null);
                }}
                className="flex-1 bg-[#2a2a2a] border-white/10 text-[var(--text)] hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !symbol.trim()}
                className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-black disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Ticker
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Info */}
          <div className="pt-2 border-t border-white/10">
            <p className="text-xs text-[var(--muted)]">
              The ticker will be verified on Polygon API and added to the data pipeline. 
              Historical and news data will be available after the next DAG run.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

