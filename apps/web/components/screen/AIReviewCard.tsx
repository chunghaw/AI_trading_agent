import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, TrendingUp, TrendingDown, AlignJustify, AlertTriangle, Zap, Calendar } from 'lucide-react';
import Link from 'next/link';

interface AIReviewCardProps {
    candidate: {
        ticker: string;
        final_score: number;
        technical_score: number;
        summary?: {
            recommendation?: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
            confidence?: "High" | "Medium" | "Low";
            one_sentence_thesis?: string;
            action_plan?: string;
            catalysts?: Array<{ label: string; evidence_urls: string[] }>;
            risks?: Array<{ label: string; evidence_urls: string[] }>;
        };
        tags_json: string[];
    };
}

export function AIReviewCard({ candidate }: AIReviewCardProps) {
    const { ticker, final_score, summary, tags_json } = candidate;

    const getRecColor = (rec?: string) => {
        switch (rec) {
            case "Strong Buy": return "bg-green-600 text-white";
            case "Buy": return "bg-green-500/20 text-green-400 border-green-500/50";
            case "Sell": return "bg-red-500/20 text-red-400 border-red-500/50";
            case "Strong Sell": return "bg-red-600 text-white";
            default: return "bg-gray-500/20 text-gray-400 border-gray-500/50";
        }
    };

    const getConfidenceColor = (conf?: string) => {
        switch (conf) {
            case "High": return "text-green-400";
            case "Medium": return "text-yellow-400";
            case "Low": return "text-gray-400";
            default: return "text-gray-400";
        }
    };

    return (
        <Card className="mb-6 border-white/10 bg-[#1e1e1e]">
            <CardHeader className="pb-3 border-b border-white/5">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">{ticker}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className={`border ${getRecColor(summary?.recommendation)}`}>
                                    {summary?.recommendation || "Pending"}
                                </Badge>
                                <span className="text-xs text-gray-400">
                                    Confidence: <span className={getConfidenceColor(summary?.confidence)}>{summary?.confidence || "?"}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold text-[var(--accent)]">{final_score.toFixed(0)}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Score</div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Thesis & Plan */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                        <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <AlignJustify className="w-4 h-4 text-[var(--accent)]" />
                            Investment Thesis
                        </h3>
                        <p className="text-gray-100 leading-relaxed text-sm">
                            {summary?.one_sentence_thesis || "No thesis available."}
                        </p>
                    </div>

                    <div className="bg-blue-900/10 rounded-lg p-4 border border-blue-500/20">
                        <h3 className="text-sm font-medium text-blue-300 mb-2 flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            Action Plan
                        </h3>
                        <p className="text-blue-100/80 text-sm italic">
                            "{summary?.action_plan || "Monitor."}"
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Catalysts */}
                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                Catalysts
                            </h4>
                            <ul className="space-y-1">
                                {summary?.catalysts?.length ? (
                                    summary.catalysts.map((c, i) => (
                                        <li key={i} className="text-xs text-green-300/80 bg-green-900/10 px-2 py-1 rounded">
                                            + {c.label}
                                        </li>
                                    ))
                                ) : (
                                    <span className="text-xs text-gray-600">None detected</span>
                                )}
                            </ul>
                        </div>
                        {/* Risks */}
                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                Risks
                            </h4>
                            <ul className="space-y-1">
                                {summary?.risks?.length ? (
                                    summary.risks.map((r, i) => (
                                        <li key={i} className="text-xs text-red-300/80 bg-red-900/10 px-2 py-1 rounded">
                                            - {r.label}
                                        </li>
                                    ))
                                ) : (
                                    <span className="text-xs text-gray-600">None detected</span>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Right Column: Tags & Technicals */}
                <div className="space-y-4">
                    <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Technical Tags</h4>
                        <div className="flex flex-wrap gap-2">
                            {tags_json.map(tag => (
                                <span key={tag} className="text-xs px-2 py-1 bg-white/5 border border-white/10 rounded text-gray-300">
                                    {tag.replace(/_/g, " ")}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <Link
                            href={`/chart/${ticker}`}
                            className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-white py-2 rounded text-sm font-medium transition-colors"
                        >
                            <TrendingUp className="w-4 h-4" />
                            View Interactive Chart
                        </Link>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
