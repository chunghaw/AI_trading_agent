"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Play, Calendar, Filter, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";

import { ScreenCandidate } from "@/lib/screen.schemas"; // Use shared type

interface ScreenRun {
  id: number;
  run_date: string;
  universe_size: number;
  status: string;
  started_at: string;
  finished_at: string | null;
}

interface ScreenFilters {
  market: "us" | "all";
  minMarketCap: number;
  minBeta1Y: number;
  minPrice?: number;
  minDollarVolume1M: number;
  minRSI?: number;
  maxRSI?: number;
}

const FILTER_PRESETS = {
  conservative: { minMarketCap: 10_000_000_000, minBeta1Y: 1.2, minDollarVolume1M: 1_000_000_000 },
  moderate: { minMarketCap: 1_000_000_000, minBeta1Y: 1.0, minDollarVolume1M: 500_000_000 },
  aggressive: { minMarketCap: 100_000_000, minBeta1Y: 0.5, minDollarVolume1M: 50_000_000 },
  minimal: { minMarketCap: 0, minBeta1Y: 0, minDollarVolume1M: 0 },
};

const DEFAULT_FILTERS: ScreenFilters = {
  market: "us",
  ...FILTER_PRESETS.minimal, // Start with minimal to ensure tickers show
};

import { ScreenerDashboard } from "@/components/screen/ScreenerDashboard";

export default function ScreenPage() {
  const [runDate, setRunDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [candidates, setCandidates] = useState<ScreenCandidate[]>([]);
  const [run, setRun] = useState<ScreenRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ScreenFilters>(DEFAULT_FILTERS);
  // View mode state removed as dashboard unifies views

  useEffect(() => {
    fetchCandidates();
  }, [runDate]);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/screen/candidates?runDate=${runDate}&limit=100`);
      const data = await response.json();

      if (data.success) {
        setCandidates(data.candidates || []);
        setRun(data.run || null);
      } else {
        setError(data.error || "Failed to fetch candidates");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch candidates");
    } finally {
      setLoading(false);
    }
  };

  const runScreen = async () => {
    try {
      setRunning(true);
      setError(null);

      const response = await fetch("/api/screen/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runDate,
          topK: 30,
          filters,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Poll for completion
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max

        const pollStatus = async () => {
          const statusResponse = await fetch(`/api/screen/candidates?runDate=${runDate}`);
          const statusData = await statusResponse.json();

          if (statusData.run?.status === "completed") {
            setRunning(false);
            fetchCandidates();
          } else if (statusData.run?.status === "failed") {
            setRunning(false);
            setError(statusData.run.error || "Screen run failed");
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(pollStatus, 5000); // Poll every 5 seconds
          } else {
            setRunning(false);
            setError("Screen run timed out");
          }
        };

        setTimeout(pollStatus, 5000);
      } else {
        setRunning(false);
        setError(data.error || "Failed to start screen run");
      }
    } catch (err: any) {
      setRunning(false);
      setError(err.message || "Failed to start screen run");
    }
  };

  const formatScore = (score: number): string => {
    return score.toFixed(1);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 70) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  const getTagColor = (tag: string): string => {
    if (tag.includes("bullish") || tag.includes("high_score")) return "bg-green-900/20 text-green-400 border-green-700/30";
    if (tag.includes("bearish") || tag.includes("low_score")) return "bg-red-900/20 text-red-400 border-red-700/30";
    return "bg-gray-900/20 text-gray-400 border-gray-700/30";
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const applyPreset = (presetName: keyof typeof FILTER_PRESETS) => {
    setFilters({
      ...filters,
      ...FILTER_PRESETS[presetName],
    });
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">AI Stock Screener</h1>
            <p className="text-gray-400">
              Automated daily stock screening with technical scoring and news analysis
            </p>
          </div>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Screen Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <label className="text-sm text-gray-300">Run Date:</label>
                <input
                  type="date"
                  value={runDate}
                  onChange={(e) => setRunDate(e.target.value)}
                  className="px-3 py-2 bg-[#2a2a2a] border border-white/10 rounded text-white text-sm"
                  max={dayjs().format("YYYY-MM-DD")}
                />
              </div>

              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                size="sm"
              >
                <Filter className="w-4 h-4 mr-2" />
                {showFilters ? "Hide" : "Show"} Filters
                {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
              </Button>

              <Button
                onClick={runScreen}
                disabled={running || loading}
                className="bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white"
              >
                {running ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Screen
                  </>
                )}
              </Button>

              <Button
                onClick={fetchCandidates}
                disabled={loading || running}
                variant="outline"
                size="sm"
              >
                Refresh
              </Button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-900/20 border border-red-700/30 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            {run && (
              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded text-sm">
                <div className="text-blue-400">
                  <strong>Run Info:</strong> {run.universe_size} tickers screened |
                  Status: <span className="capitalize">{run.status}</span> |
                  {run.finished_at && ` Completed: ${dayjs(run.finished_at).format("MMM D, YYYY h:mm A")}`}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters Panel */}
        {showFilters && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Filter Settings</CardTitle>
                <Button onClick={resetFilters} variant="outline" size="sm">
                  Reset to Default
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-2">
                <Button onClick={() => applyPreset('minimal')} variant="outline" size="sm">
                  Minimal (All Tickers)
                </Button>
                <Button onClick={() => applyPreset('aggressive')} variant="outline" size="sm">
                  Aggressive
                </Button>
                <Button onClick={() => applyPreset('moderate')} variant="outline" size="sm">
                  Moderate
                </Button>
                <Button onClick={() => applyPreset('conservative')} variant="outline" size="sm">
                  Conservative
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Min Market Cap</label>
                  <input
                    type="number"
                    value={filters.minMarketCap}
                    onChange={(e) => setFilters({ ...filters, minMarketCap: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/10 rounded text-white text-sm"
                    step="100000000"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    ${(filters.minMarketCap / 1_000_000_000).toFixed(1)}B
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Min Beta 1Y</label>
                  <input
                    type="number"
                    value={filters.minBeta1Y}
                    onChange={(e) => setFilters({ ...filters, minBeta1Y: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/10 rounded text-white text-sm"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Min Dollar Volume 1M</label>
                  <input
                    type="number"
                    value={filters.minDollarVolume1M}
                    onChange={(e) => setFilters({ ...filters, minDollarVolume1M: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/10 rounded text-white text-sm"
                    step="100000000"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    ${(filters.minDollarVolume1M / 1_000_000_000).toFixed(1)}B
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Min Price (optional)</label>
                  <input
                    type="number"
                    value={filters.minPrice || ""}
                    onChange={(e) => setFilters({ ...filters, minPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/10 rounded text-white text-sm"
                    step="1"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Min RSI (optional)</label>
                  <input
                    type="number"
                    value={filters.minRSI || ""}
                    onChange={(e) => setFilters({ ...filters, minRSI: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/10 rounded text-white text-sm"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Max RSI (optional)</label>
                  <input
                    type="number"
                    value={filters.maxRSI || ""}
                    onChange={(e) => setFilters({ ...filters, maxRSI: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/10 rounded text-white text-sm"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dashboard Area */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)]"></div>
          </div>
        ) : (
          <ScreenerDashboard candidates={candidates} />
        )}
      </div>
    </div>
  );
}
