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

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-200px)] min-h-[800px]">

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
                                    {/* Thesis */}
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
                                            <Info className="w-3 h-3" /> Thesis
                                        </h4>
                                        <p className="text-sm text-gray-200 leading-relaxed">
                                            {selectedCandidate.summary?.one_sentence_thesis || "No thesis available."}
                                        </p>
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
                <CardHeader className="py-3 px-4 border-b border-white/5">
                    <CardTitle className="text-sm font-medium text-gray-300">
                        Results ({candidates.length})
                    </CardTitle>
                </CardHeader>
                <ScrollArea className="flex-1">
                    <div className="divide-y divide-white/5">
                        {candidates.map((candidate) => (
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
                                            <span className="text-xs text-gray-500 ml-2">
                                                {formatCurrency(candidate.features!.market_cap)} Mkt Cap
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-bold ${getScoreColor(candidate.final_score)}`}>
                                            {candidate.final_score.toFixed(1)}
                                        </div>
                                        <div className="text-[10px] text-gray-500 uppercase">Score</div>
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
                                </div>
                            </div>
                        ))}
                        {candidates.length === 0 && (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                No candidates found.
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </Card>
        </div>
    );
}
