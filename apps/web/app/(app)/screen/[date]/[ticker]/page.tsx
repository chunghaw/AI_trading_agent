"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { StockChart } from "@/components/StockChart";

interface TickerDetails {
  candidate: any;
  features: any;
  news: any[];
  summary: any;
  reasons: any[];
}

interface ChartData {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  ma_50: number | null;
  ma_200: number | null;
  ema_20: number | null;
  rsi: number | null;
  macd_line: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
}

export default function TickerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const date = params.date as string;
  const ticker = params.ticker as string;

  const [details, setDetails] = useState<TickerDetails | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDetails();
    fetchChartData();
  }, [date, ticker]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/screen/ticker/${date}/${ticker}`);
      const data = await response.json();

      if (data.success) {
        setDetails(data.data);
      } else {
        setError(data.error || "Failed to fetch details");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch details");
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    try {
      setChartLoading(true);
      const response = await fetch(`/api/chart/${ticker}?days=90`);
      const data = await response.json();

      if (data.success) {
        setChartData(data.data || []);
      }
    } catch (err: any) {
      console.error("Failed to fetch chart data:", err);
    } finally {
      setChartLoading(false);
    }
  };

  const formatScore = (score: number | undefined | null): string => {
    if (score === undefined || score === null || isNaN(score)) return "N/A";
    return score.toFixed(1);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 70) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Failed to load details"}</p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const { candidate, features, news, summary, reasons } = details;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">{ticker}</h1>
              <p className="text-gray-400">
                Screen Run: {date} | Detailed Analysis
              </p>
            </div>
          </div>
          <Link
            href={`https://www.tradingview.com/chart/?symbol=${ticker}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:text-[var(--accent-600)] flex items-center gap-2"
          >
            View on TradingView
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        {/* Price Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Price Chart (90 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
              </div>
            ) : (
              <StockChart data={chartData} ticker={ticker} height={300} />
            )}
          </CardContent>
        </Card>

        {/* Score Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-gray-400">Final Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getScoreColor(candidate.final_score)}`}>
                {formatScore(candidate.final_score)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-gray-400">Technical Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatScore(candidate.technical_score)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-gray-400">News Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${candidate.news_score > 0 ? "text-green-400" :
                  candidate.news_score < 0 ? "text-red-400" :
                    "text-gray-400"
                }`}>
                {candidate.news_score > 0 ? "+" : ""}{formatScore(candidate.news_score)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-gray-400">News Articles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {news.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Why Selected - Scoring Reasons */}
        {reasons && reasons.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Why Selected - Scoring Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reasons.map((reason, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/10"
                  >
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-white">{reason.rule}</span>
                        <span className="text-sm text-green-400">+{reason.points} pts</span>
                      </div>
                      <p className="text-sm text-gray-400">{reason.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Technical Features */}
        {features && (
          <Card>
            <CardHeader>
              <CardTitle>Technical Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">SMA50</div>
                  <div className="text-white font-medium">
                    {features.sma50 ? `$${parseFloat(features.sma50).toFixed(2)}` : "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">SMA200</div>
                  <div className="text-white font-medium">
                    {features.sma200 ? `$${parseFloat(features.sma200).toFixed(2)}` : "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">MACD</div>
                  <div className="text-white font-medium">
                    {features.macd ? parseFloat(features.macd).toFixed(4) : "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">MACD Signal</div>
                  <div className="text-white font-medium">
                    {features.macd_signal ? parseFloat(features.macd_signal).toFixed(4) : "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">MACD Histogram</div>
                  <div className={`font-medium ${features.macd_hist > 0 ? "text-green-400" : "text-red-400"
                    }`}>
                    {features.macd_hist ? parseFloat(features.macd_hist).toFixed(4) : "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">Relative Volume</div>
                  <div className="text-white font-medium">
                    {features.rvol ? `${parseFloat(features.rvol).toFixed(2)}x` : "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">ATR %</div>
                  <div className="text-white font-medium">
                    {features.atrp ? `${parseFloat(features.atrp).toFixed(2)}%` : "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">Beta 1Y</div>
                  <div className="text-white font-medium">
                    {features.beta_1y ? parseFloat(features.beta_1y).toFixed(2) : "N/A"}
                  </div>
                </div>
              </div>

              {/* Flags */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="text-sm text-gray-400 mb-3">Flags</div>
                <div className="flex flex-wrap gap-2">
                  {features.breakout_flag && (
                    <span className="px-3 py-1 bg-green-900/20 text-green-400 border border-green-700/30 rounded text-sm">
                      Breakout
                    </span>
                  )}
                  {features.trend_flag && (
                    <span className="px-3 py-1 bg-blue-900/20 text-blue-400 border border-blue-700/30 rounded text-sm">
                      Trend
                    </span>
                  )}
                  {features.momentum_flag && (
                    <span className="px-3 py-1 bg-purple-900/20 text-purple-400 border border-purple-700/30 rounded text-sm">
                      Momentum
                    </span>
                  )}
                  {features.volume_flag && (
                    <span className="px-3 py-1 bg-yellow-900/20 text-yellow-400 border border-yellow-700/30 rounded text-sm">
                      High Volume
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* News Summary */}
        {summary && summary.summary_json && (
          <Card>
            <CardHeader>
              <CardTitle>News Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Thesis */}
                <div>
                  <div className="text-sm text-gray-400 mb-2">One-Sentence Thesis</div>
                  <p className="text-white">{summary.summary_json.one_sentence_thesis}</p>
                </div>

                {/* Tone & Score */}
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Tone</div>
                    <span className={`px-3 py-1 rounded text-sm font-medium ${summary.summary_json.tone === "positive" ? "bg-green-900/20 text-green-400 border border-green-700/30" :
                        summary.summary_json.tone === "negative" ? "bg-red-900/20 text-red-400 border border-red-700/30" :
                          "bg-gray-900/20 text-gray-400 border border-gray-700/30"
                      }`}>
                      {summary.summary_json.tone.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">News Score</div>
                    <span className={`text-lg font-bold ${summary.summary_json.newsScore > 0 ? "text-green-400" :
                        summary.summary_json.newsScore < 0 ? "text-red-400" :
                          "text-gray-400"
                      }`}>
                      {summary.summary_json.newsScore > 0 ? "+" : ""}{summary.summary_json.newsScore}
                    </span>
                  </div>
                </div>

                {/* Catalysts */}
                {summary.summary_json.catalysts && summary.summary_json.catalysts.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Catalysts</div>
                    <div className="space-y-2">
                      {summary.summary_json.catalysts.map((cat: any, idx: number) => (
                        <div key={idx} className="p-3 bg-green-900/10 border border-green-700/20 rounded">
                          <div className="text-white text-sm mb-1">{cat.label}</div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {cat.evidence_urls?.map((url: string, urlIdx: number) => (
                              <a
                                key={urlIdx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"
                              >
                                Source {urlIdx + 1}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risks */}
                {summary.summary_json.risks && summary.summary_json.risks.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Risks</div>
                    <div className="space-y-2">
                      {summary.summary_json.risks.map((risk: any, idx: number) => (
                        <div key={idx} className="p-3 bg-red-900/10 border border-red-700/20 rounded">
                          <div className="text-white text-sm mb-1">{risk.label}</div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {risk.evidence_urls?.map((url: string, urlIdx: number) => (
                              <a
                                key={urlIdx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                              >
                                Source {urlIdx + 1}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Earnings/Events */}
                {summary.summary_json.earnings_or_events && summary.summary_json.earnings_or_events.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Upcoming Events</div>
                    <div className="space-y-2">
                      {summary.summary_json.earnings_or_events.map((event: any, idx: number) => (
                        <div key={idx} className="p-3 bg-blue-900/10 border border-blue-700/20 rounded">
                          <div className="text-white text-sm mb-1">
                            {event.label}
                            {event.date && <span className="text-gray-400 ml-2">({event.date})</span>}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {event.evidence_urls?.map((url: string, urlIdx: number) => (
                              <a
                                key={urlIdx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                              >
                                Source {urlIdx + 1}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* News Articles */}
        {news && news.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>News Articles ({news.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {news.map((article) => (
                  <div
                    key={article.id}
                    className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="text-white font-medium mb-1 hover:text-[var(--accent)]">
                            {article.title}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            {article.source && <span>{article.source}</span>}
                            {article.published_at && (
                              <span>{new Date(article.published_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                      </div>
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
