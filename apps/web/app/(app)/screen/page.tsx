"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Play, Calendar, Filter, ExternalLink } from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";

interface ScreenCandidate {
  id: number;
  ticker: string;
  final_score: number;
  technical_score: number;
  news_score: number;
  tags_json: string[];
  news_count: number;
  has_summary: boolean;
}

interface ScreenRun {
  id: number;
  run_date: string;
  universe_size: number;
  status: string;
  started_at: string;
  finished_at: string | null;
}

export default function ScreenPage() {
  const [runDate, setRunDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [candidates, setCandidates] = useState<ScreenCandidate[]>([]);
  const [run, setRun] = useState<ScreenRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

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
          topK: 200,
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
            <div className="flex items-center gap-4">
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

        {/* Candidates Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Screen Candidates ({candidates.length})</CardTitle>
              <div className="text-sm text-gray-400">
                Sorted by Final Score
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                {run ? "No candidates found for this run." : "Run a screen to see candidates."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-white/10">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-gray-400">Rank</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-400">Ticker</th>
                      <th className="text-right p-4 text-sm font-medium text-gray-400">Final Score</th>
                      <th className="text-right p-4 text-sm font-medium text-gray-400">Technical</th>
                      <th className="text-right p-4 text-sm font-medium text-gray-400">News</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-400">Tags</th>
                      <th className="text-center p-4 text-sm font-medium text-gray-400">News</th>
                      <th className="text-center p-4 text-sm font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((candidate, index) => (
                      <tr
                        key={candidate.id}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="p-4">
                          <span className="text-sm text-gray-300">#{index + 1}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-semibold text-white">{candidate.ticker}</span>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`text-lg font-bold ${getScoreColor(candidate.final_score)}`}>
                            {formatScore(candidate.final_score)}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-sm text-gray-300">
                            {formatScore(candidate.technical_score)}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`text-sm ${
                            candidate.news_score > 0 ? "text-green-400" :
                            candidate.news_score < 0 ? "text-red-400" :
                            "text-gray-400"
                          }`}>
                            {candidate.news_score > 0 ? "+" : ""}{formatScore(candidate.news_score)}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {candidate.tags_json.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className={`px-2 py-1 rounded text-xs border ${getTagColor(tag)}`}
                              >
                                {tag}
                              </span>
                            ))}
                            {candidate.tags_json.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{candidate.tags_json.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-sm text-gray-300">
                            {candidate.news_count}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <Link
                            href={`/screen/${runDate}/${candidate.ticker}`}
                            className="text-[var(--accent)] hover:text-[var(--accent-600)] text-sm flex items-center justify-center gap-1"
                          >
                            View
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
