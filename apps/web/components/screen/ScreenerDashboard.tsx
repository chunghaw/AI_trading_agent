import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TradingViewChart } from "@/components/TradingViewChart";
import { ExternalLink, TrendingUp, AlertTriangle, Zap, CheckCircle, Info } from "lucide-react";
import Link from "next/link";
import { ScreenCandidate } from "@/lib/screen.schemas";

interface ScreenerDashboardProps {
    candidates: ScreenCandidate[];
}

export function ScreenerDashboard({ candidates }: ScreenerDashboardProps) {
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

    // Set first candidate as selected by default when candidates load
    useEffect(() => {
        if (candidates.length > 0 && !selectedTicker) {
            setSelectedTicker(candidates[0].ticker);
        }
    }, [candidates, selectedTicker]);

    // State for toggling between Stocks, ETFs, and Sectors
    const [viewMode, setViewMode] = useState<"Stocks" | "ETFs" | "Sectors">("Stocks");

    // Filter candidates based on current view mode
    const filteredCandidates = candidates.filter((c) => {
        if (viewMode === "Sectors") return false; // Handled separately
        const isETF = c.features?.security_type === "ETF";
        return viewMode === "ETFs" ? isETF : !isETF;
    });

    // Sector Rotation calculation
    const sectorStats = React.useMemo(() => {
        const stats: Record<string, { totalScore: number; count: number; bestTicker: string; bestScore: number }> = {};

        candidates.forEach(c => {
            const ind = c.summary?.industry || "Unknown";
            if (c.features?.security_type === "ETF") return; // Only stocks for sector rotation

            if (!stats[ind]) {
                stats[ind] = { totalScore: 0, count: 0, bestTicker: c.ticker, bestScore: c.final_score };
            }
            stats[ind].totalScore += c.final_score;
            stats[ind].count += 1;

            if (c.final_score > stats[ind].bestScore) {
                stats[ind].bestScore = c.final_score;
                stats[ind].bestTicker = c.ticker;
            }
        });

        return Object.entries(stats)
            .map(([industry, data]) => ({
                industry,
                avgScore: data.totalScore / data.count,
                count: data.count,
                bestTicker: data.bestTicker
            }))
            .sort((a, b) => b.avgScore - a.avgScore);
    }, [candidates]);

    // Keyboard navigation based on *filtered* candidates
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const currentIndex = filteredCandidates.findIndex(c => c.ticker === selectedTicker);
                if (currentIndex === -1) return;

                if (e.key === 'ArrowUp' && currentIndex > 0) {
                    setSelectedTicker(filteredCandidates[currentIndex - 1].ticker);
                } else if (e.key === 'ArrowDown' && currentIndex < filteredCandidates.length - 1) {
                    setSelectedTicker(filteredCandidates[currentIndex + 1].ticker);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredCandidates, selectedTicker]);

    const selectedCandidate = candidates.find((c) => c.ticker === selectedTicker);

    // Helpers for scoring & colors
    const getScoreColor = (score: number) => {
        if (score >= 70) return "text-green-400";
        if (score >= 50) return "text-yellow-400";
        return "text-red-400";
    };

    const getRecColor = (rec?: string) => {
        switch (rec) {
            case "Strong Buy": return "bg-green-600/20 text-green-400 border-green-600/50";
            case "Buy": return "bg-green-500/20 text-green-400 border-green-500/50";
            case "Sell": return "bg-red-500/20 text-red-400 border-red-500/50";
            case "Strong Sell": return "bg-red-600/20 text-red-400 border-red-600/50";
            default: return "bg-gray-500/20 text-gray-400 border-gray-500/50";
        }
    };

    const getSecurityColor = (type?: string) => {
        switch (type) {
            case "Crypto": return "text-purple-400";
            case "ETF": return "text-blue-400";
            default: return "text-gray-500";
        }
    };

    const formatCurrency = (val?: number | null) => {
        if (val === undefined || val === null || val === 0) return "N/A";
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 1 }).format(val);
    };

    // Extract Top Picks for Carousel
    const topPicks = candidates
        .filter(c => c.summary?.recommendation === "Strong Buy" || c.summary?.recommendation === "Buy")
        .sort((a, b) => b.final_score - a.final_score)
        .slice(0, 5);

    // Extract Market Indices for Header
    const indexTickers = ["SPY", "QQQ", "DIA", "IWM"];
    const marketIndices = candidates.filter(c => indexTickers.includes(c.ticker));

    // Extract Watchlist Alerts (e.g. MACD Crossover or Volatility Breakout)
    const activeAlerts = candidates
        .filter(c => c.features?.macd_hist && c.features.macd_hist > 0 && c.summary?.recommendation === 'Strong Buy')
        .slice(0, 4);

    return (
        <div className="flex flex-col space-y-6">

            {/* TOP ROW: Market Context & Alerts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="md:col-span-2 border-white/10 bg-[#1e1e1e] flex flex-col justify-center p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Market Context
                    </h3>
                    <div className="flex gap-6 overflow-x-auto pb-1">
                        {marketIndices.map(idx => {
                            const retPct = (idx.features?.price && idx.features?.prev_close)
                                ? ((idx.features.price - idx.features.prev_close) / idx.features.prev_close) * 100
                                : 0;
                            return (
                                <div key={idx.ticker} className="flex flex-col min-w-[100px]">
                                    <span className="font-bold text-white tracking-wide">{idx.ticker}</span>
                                    <span className={`text-sm ${retPct >= 0 ? "text-green-400" : "text-red-400"}`}>
                                        {retPct.toFixed(2)}%
                                    </span>
                                </div>
                            );
                        })}
                        {marketIndices.length === 0 && <span className="text-sm text-gray-500">Awaiting index data...</span>}
                    </div>
                </Card>

                <Card className="border-white/10 bg-[#1e1e1e] flex flex-col p-4">
                    <h3 className="text-xs font-semibold text-blue-500 uppercase mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-blue-400" /> Watchlist Alerts
                    </h3>
                    <div className="flex flex-col gap-2">
                        {activeAlerts.map(alert => (
                            <div key={alert.ticker} className="text-xs flex justify-between items-center text-gray-300 bg-white/5 p-2 rounded">
                                <span className="font-bold text-white">{alert.ticker}</span>
                                <span className="text-blue-400 text-[10px] uppercase">MACD Bullish</span>
                            </div>
                        ))}
                        {activeAlerts.length === 0 && <span className="text-xs text-gray-500">No active alerts.</span>}
                    </div>
                </Card>
            </div>

            {/* TOP PICKS CAROUSEL */}
            {topPicks.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" /> Today's Top AI Picks
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {topPicks.map(pick => (
                            <Card
                                key={pick.ticker}
                                className="border-white/10 bg-[#1e1e1e] hover:bg-white/5 transition-all cursor-pointer overflow-hidden group"
                                onClick={() => setSelectedTicker(pick.ticker)}
                            >
                                <div className="p-3 border-b border-white/5 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-lg text-white group-hover:text-[var(--accent)] transition-colors">{pick.ticker}</span>
                                        <span className="text-[10px] uppercase text-gray-500 font-semibold">{pick.features?.security_type || "STK"}</span>
                                    </div>
                                    <Badge variant="outline" className={`${getRecColor(pick.summary?.recommendation)} px-2 py-0 text-[10px]`}>
                                        {pick.summary?.recommendation}
                                    </Badge>
                                </div>
                                <div className="p-3 bg-black/20">
                                    <p className="text-xs text-gray-400 line-clamp-3 italic leading-relaxed">
                                        "{pick.summary?.one_sentence_thesis || pick.summary?.company_description || "Strong technicals and AI conviction."}"
                                    </p>
                                    <div className="mt-3 flex justify-between items-end">
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase mb-0.5">Final Score</div>
                                            <div className={`font-bold text-lg leading-none ${getScoreColor(pick.final_score)}`}>
                                                {pick.final_score.toFixed(1)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Existing Dashboard Layout */}
            <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-350px)] min-h-[700px]">

                {/* LEFT PANEL: Chart & Analysis (Flexible Width) */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    {/* Top Section: TradingView Chart */}
                    <Card className="flex-1 min-h-[400px] border-white/10 bg-[#1e1e1e] overflow-hidden flex flex-col">
                        {selectedTicker ? (
                            <TradingViewChart ticker={selectedTicker} height="100%" />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                Select a ticker to view chart
                            </div>
                        )}
                    </Card>

                    {/* Bottom Section: AI Analysis */}
                    <Card className="h-[350px] border-white/10 bg-[#1e1e1e] flex flex-col">
                        <CardHeader className="py-3 px-4 border-b border-white/5 bg-white/5">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-white">AI Analysis</h3>
                                    {selectedCandidate?.summary?.recommendation && (
                                        <Badge variant="outline" className={getRecColor(selectedCandidate.summary.recommendation)}>
                                            {selectedCandidate.summary.recommendation}
                                        </Badge>
                                    )}
                                </div>
                                {selectedCandidate?.summary?.confidence && (
                                    <span className="text-xs text-gray-400">
                                        Confidence: <span className="text-white">{selectedCandidate.summary.confidence}</span>
                                    </span>
                                )}
                            </div>
                        </CardHeader>
                        <ScrollArea className="flex-1">
                            <CardContent className="p-4 space-y-4">
                                {selectedCandidate ? (
                                    <>
                                        {/* Company Info */}
                                        {(selectedCandidate.summary?.company_description || selectedCandidate.summary?.industry) && (
                                            <div className="bg-[#1e1e1e] border-l-2 border-blue-500 pl-3 py-1 mb-4">
                                                {selectedCandidate.summary?.industry && (
                                                    <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
                                                        {selectedCandidate.summary.industry}
                                                    </span>
                                                )}
                                                {selectedCandidate.summary?.company_description && (
                                                    <p className="text-xs text-gray-400 mt-1 italic">
                                                        {selectedCandidate.summary.company_description}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Thesis */}
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
                                                <Info className="w-3 h-3" /> Thesis
                                            </h4>
                                            <div className="text-sm text-gray-200 leading-relaxed space-y-2">
                                                {selectedCandidate.summary?.detailed_thesis ? (
                                                    selectedCandidate.summary.detailed_thesis.split('\n\n').map((paragraph, idx) => (
                                                        <p key={idx}>{paragraph}</p>
                                                    ))
                                                ) : (
                                                    <p>{selectedCandidate.summary?.one_sentence_thesis || "No thesis available."}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Plan */}
                                        <div className="bg-blue-900/10 border border-blue-500/20 p-3 rounded-md">
                                            <h4 className="text-xs font-semibold text-blue-400 uppercase mb-1 flex items-center gap-1">
                                                <Zap className="w-3 h-3" /> Action Plan
                                            </h4>
                                            <p className="text-sm text-blue-100 italic">
                                                "{selectedCandidate.summary?.action_plan || "Monitor price action."}"
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Catalysts */}
                                            <div>
                                                <h4 className="text-xs font-semibold text-green-500/80 uppercase mb-2">Catalysts</h4>
                                                <ul className="space-y-1">
                                                    {selectedCandidate.summary?.catalysts?.slice(0, 3).map((c, i) => (
                                                        <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                                                            <span className="text-green-500 mt-0.5">+</span> {c.label}
                                                        </li>
                                                    ))}
                                                    {!selectedCandidate.summary?.catalysts?.length && <li className="text-xs text-gray-500">None detected</li>}
                                                </ul>
                                            </div>
                                            {/* Risks */}
                                            <div>
                                                <h4 className="text-xs font-semibold text-red-500/80 uppercase mb-2">Risks</h4>
                                                <ul className="space-y-1">
                                                    {selectedCandidate.summary?.risks?.slice(0, 3).map((r, i) => (
                                                        <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                                                            <span className="text-red-500 mt-0.5">-</span> {r.label}
                                                        </li>
                                                    ))}
                                                    {!selectedCandidate.summary?.risks?.length && <li className="text-xs text-gray-500">None detected</li>}
                                                </ul>
                                            </div>

                                            {/* Events / Earnings */}
                                            {selectedCandidate.summary?.earnings_or_events && selectedCandidate.summary.earnings_or_events.length > 0 && (
                                                <div className="col-span-2 mt-2 border-t border-white/5 pt-3">
                                                    <h4 className="text-xs font-semibold text-yellow-500/80 uppercase mb-2">Earnings & Events</h4>
                                                    <ul className="space-y-1">
                                                        {selectedCandidate.summary.earnings_or_events.map((e, i) => (
                                                            <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                                                                <span className="text-yellow-500">📅</span> {e.date && <span className="text-gray-400">[{e.date}]</span>} {e.label}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-gray-500 text-sm text-center py-8">Select a candidate to view analysis</div>
                                )}
                            </CardContent>
                        </ScrollArea>
                    </Card>
                </div>

                {/* RIGHT PANEL: Screener List (Fixed Width) */}
                <Card className="w-full lg:w-[350px] border-white/10 bg-[#1e1e1e] flex flex-col h-full">
                    <CardHeader className="py-3 px-4 border-b border-white/5 flex flex-col gap-3">
                        <CardTitle className="text-sm font-medium text-gray-300">
                            Results
                        </CardTitle>
                        <div className="flex bg-black/50 p-1 rounded-md">
                            <button
                                className={`flex-1 text-xs py-1.5 rounded-sm transition-colors ${viewMode === 'Stocks' ? 'bg-white/10 text-white font-medium shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                                onClick={() => setViewMode('Stocks')}
                            >
                                <span className="hidden sm:inline">Top</span> Stocks
                            </button>
                            <button
                                className={`flex-1 text-xs py-1.5 rounded-sm transition-colors ${viewMode === 'ETFs' ? 'bg-white/10 text-white font-medium shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                                onClick={() => setViewMode('ETFs')}
                            >
                                <span className="hidden sm:inline">Top</span> ETFs
                            </button>
                            <button
                                className={`flex-1 text-xs py-1.5 rounded-sm transition-colors ${viewMode === 'Sectors' ? 'bg-blue-600/30 text-blue-200 font-medium shadow-sm border border-blue-500/20' : 'text-gray-400 hover:text-gray-200'}`}
                                onClick={() => setViewMode('Sectors')}
                            >
                                Sectors
                            </button>
                        </div>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                        <div className="divide-y divide-white/5">
                            {viewMode === "Sectors" ? (
                                sectorStats.map((sector, idx) => (
                                    <div key={idx} className="p-3 border-l-2 border-transparent hover:bg-white/5 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1 pr-2">
                                                <span className="font-bold text-white text-sm block leading-tight">{sector.industry}</span>
                                                <span className="text-[10px] text-gray-500 mt-1 block">
                                                    {sector.count} scanned
                                                </span>
                                            </div>
                                            <div className="text-right flex flex-col items-end shrink-0">
                                                <div className={`font-bold ${getScoreColor(sector.avgScore)}`}>
                                                    {sector.avgScore.toFixed(1)}
                                                </div>
                                                <div className="text-[9px] text-gray-500 uppercase mt-0.5">Avg Score</div>
                                            </div>
                                        </div>
                                        <div className="flex bg-white/5 rounded px-2 py-1 items-center justify-between mt-1">
                                            <span className="text-[10px] text-gray-400">Top Pick</span>
                                            <span
                                                className="text-xs font-bold text-[var(--accent)] hover:text-white cursor-pointer transition-colors"
                                                onClick={() => {
                                                    setSelectedTicker(sector.bestTicker);
                                                }}
                                            >
                                                {sector.bestTicker}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                filteredCandidates.map((candidate) => (
                                    <div
                                        key={candidate.id}
                                        onClick={() => setSelectedTicker(candidate.ticker)}
                                        className={`p-3 cursor-pointer hover:bg-white/5 transition-colors ${selectedTicker === candidate.ticker ? "bg-white/10 border-l-2 border-[var(--accent)]" : "border-l-2 border-transparent"}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div>
                                                <span className="font-bold text-white text-base">{candidate.ticker}</span>
                                                <span className={`text-xs ml-2 ${getSecurityColor(candidate.features?.security_type)}`}>
                                                    {candidate.features?.security_type || "Stock"}
                                                </span>
                                                {(candidate.features?.market_cap ?? 0) > 0 && (
                                                    <span className="text-xs text-gray-500 ml-2 block sm:inline">
                                                        {formatCurrency(candidate.features!.market_cap)} Mkt Cap
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <div className={`font-bold ${getScoreColor(candidate.final_score)}`} title={`Technical: ${candidate.technical_score.toFixed(1)} | News: ${candidate.news_score.toFixed(1)}`}>
                                                    {candidate.final_score.toFixed(1)}
                                                </div>
                                                <div className="text-[10px] text-gray-500 uppercase">Score</div>
                                                <div className="text-[9px] text-gray-600 mt-0.5" title="Technical / News Score Breakdown">
                                                    {candidate.technical_score.toFixed(0)} T / {candidate.news_score.toFixed(0)} N
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {candidate.summary?.recommendation && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRecColor(candidate.summary.recommendation)}`}>
                                                    {candidate.summary.recommendation}
                                                </span>
                                            )}
                                            {candidate.features?.trend_flag && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Trend</span>
                                            )}
                                            {candidate.tags_json?.includes("VCP") && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold flex items-center gap-1">
                                                    <Zap className="w-2 h-2" /> VCP
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                            {viewMode !== "Sectors" && filteredCandidates.length === 0 && (
                                <div className="p-8 text-center text-gray-500 text-sm">
                                    No candidates found for {viewMode}.
                                </div>
                            )}
                            {viewMode === "Sectors" && sectorStats.length === 0 && (
                                <div className="p-8 text-center text-gray-500 text-sm">
                                    No sector data available.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </Card>
            </div>
        </div>
    );
}
