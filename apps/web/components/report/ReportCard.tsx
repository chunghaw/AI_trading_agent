import React, { useMemo, useState } from 'react';
// import { cn } from '../../lib/utils';
import { Copy, Check, Printer, Database, AlertTriangle, ExternalLink, Link as LinkIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { ActionBadge } from './ActionBadge';
import { ConfidenceBar } from './ConfidenceBar';
import { IndicatorsRow } from './IndicatorsRow';
// LevelsBlock removed - user explicitly requested no support/resistance levels
import { CitationsChips } from './CitationsChips';
import AnalystResponses from './AnalystResponses';
// import type { Report } from '../../lib/report.schema';

interface ReportCardProps {
  report: Report;
  className?: string;
  isMockData?: boolean;
  dataSource?: 'databricks' | 'none';
}

function fmtPct(v?: number | null, digits = 0) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return `${(Number(v) * 100).toFixed(digits)}%`;
}

function fmtMoney(v?: number | string, digits = 2) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  return `$${Number(v).toFixed(digits)}`;
}

function host(url?: string) {
  try { return url ? new URL(url).hostname.replace(/^www\./, '') : ''; }
  catch { return ''; }
}

// Temporary cn function
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

// Type matching Agent.md specification
type Report = {
  header: {
    name: string;
    market: string;
    type: string;
    exchange: string;
    currency: string;
    employees: number | null;
    description: string;
    price?: {
      current: number | null;
      change: number | null;
      change_percent: number | null;
      as_of_date: string | null;
    };
  };
  news: {
    sentiment: "bullish" | "neutral" | "bearish";
    key_points: string[];
    analysis: string;
    sources: string[];
    status: "Positive" | "Balanced" | "Adverse";
    no_data: boolean;
  };
  technical: {
    indicators: {
      rsi: number | null;
      macd_line: number | null;
      macd_signal: number | null;
      macd_hist: number | null;
      ema20: number | null;
      ema50: number | null;
      ema200: number | null;
      vwap: number | null;
      atr: number | null;
      volume_trend: "rising" | "falling" | "flat";
      vol_price_relation: "accumulation" | "distribution" | "neutral";
    };
    analysis: string;
    sentiment: "bullish" | "neutral" | "bearish";
    status: "Constructive" | "Neutral" | "Weak";
  };
  final_answer: {
    summary: string;
    key_insights: string[];
    overall_status: "bullish" | "neutral" | "bearish";
    answer: string;
  };
  meta: {
    ticker: string;
    as_of: string;
    horizon: "intraday" | "1–3 days" | "1 week";
    user_question?: string;
  };
};

export function ReportCard({ report, className, isMockData = false, dataSource = 'none' }: ReportCardProps) {
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  
  // DEBUG: Log the report data
  console.log("🔍 ReportCard received report:", report);
  console.log("🔍 ReportCard report type:", typeof report);
  console.log("🔍 ReportCard report keys:", report ? Object.keys(report) : "null");
  
  // Error boundary for rendering
  if (renderError) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-500 rounded-lg">
        <h3 className="text-red-400 font-bold mb-2">ReportCard Render Error</h3>
        <p className="text-red-300 text-sm mb-4">{renderError}</p>
        <pre className="text-xs text-red-200 bg-black/50 p-3 rounded overflow-auto">
          {JSON.stringify(report, null, 2)}
        </pre>
        <button 
          onClick={() => setRenderError(null)}
          className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // DEBUG: Safe data extraction with error handling - Updated for Agent.md format
  let newsKeyPoints: string[] = [];
  let newsSources: string[] = [];
  let newsAnalysis = null;
  let technicalAnalysis = null;
  let finalAnswer = null;
  let keyInsights: string[] = [];
  
  try {
    newsKeyPoints = report?.news?.key_points ?? [];
    newsSources = report?.news?.sources ?? [];
    newsAnalysis = report?.news?.analysis;
    technicalAnalysis = report?.technical?.analysis;
    finalAnswer = report?.final_answer?.answer;
    keyInsights = report?.final_answer?.key_insights ?? [];
    
    console.log("🔍 Extracted Agent.md data:", {
      newsKeyPoints: newsKeyPoints.length,
      newsSources: newsSources.length,
      hasNewsAnalysis: !!newsAnalysis,
      hasTechnicalAnalysis: !!technicalAnalysis,
      hasFinalAnswer: !!finalAnswer,
      keyInsights: keyInsights.length
    });
  } catch (error) {
    console.error("❌ Error extracting report data:", error);
    console.error("❌ Report structure:", report);
  }


  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 1600);
    } catch (err) {
      console.error('Copy JSON failed:', err);
    }
  };

  const copySummary = async () => {
    const lines: string[] = [];
    lines.push(`${report.meta?.ticker || 'Unknown'} • ${String(report.meta?.horizon || '1d').toUpperCase()}`);
    if (report.header) {
      lines.push(`Company: ${report.header.name}`);
    }
    if (newsAnalysis) {
      lines.push('\nNews Analysis:');
      lines.push(newsAnalysis);
    }
    if (newsKeyPoints.length) {
      lines.push('\nNews Key Points:');
      newsKeyPoints.forEach((s: string) => lines.push(`• ${s}`));
    }
    if (technicalAnalysis) {
      lines.push('\nTechnical Analysis:');
      lines.push(technicalAnalysis);
    }
    if (report.final_answer) {
      lines.push('\nFinal Summary:');
      lines.push(report.final_answer.summary);
      if (finalAnswer) {
        lines.push('\nDirect Answer:');
        lines.push(finalAnswer);
      }
      if (keyInsights.length > 0) {
        lines.push('\nKey Insights:');
        keyInsights.forEach((s: string) => lines.push(`• ${s}`));
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 1600);
    } catch (err) {
      console.error('Copy summary failed:', err);
    }
  };

  const handlePrint = () => window.print();

  // Wrap the entire render in error handling
  try {
    return (
    <div className={cn('max-w-[880px] mx-auto px-4 md:px-6', className)}>
      <div className="panel p-5 md:p-6 space-y-6">

        {/* Header with Price Information */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-zinc-100">{report.meta?.ticker || 'Unknown'}</h2>
              {/* TradingView-style price indicator */}
              {report.header?.price && (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-zinc-100">
                    ${report.header.price.current?.toFixed(2)}
                  </span>
                  {report.header.price.change !== null && report.header.price.change_percent !== null && (
                    <div className="flex items-center gap-1">
                      {report.header.price.change >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                      <span className={`text-sm font-medium ${
                        report.header.price.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {report.header.price.change >= 0 ? '+' : ''}{report.header.price.change?.toFixed(2)}
                      </span>
                      <span className={`text-sm ${
                        report.header.price.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        ({report.header.price.change >= 0 ? '+' : ''}{report.header.price.change_percent?.toFixed(2)}%)
                      </span>
                    </div>
                  )}
                </div>
              )}
              {dataSource === 'databricks' && (
                <span className="text-xs px-2 py-0.5 rounded-lg bg-sky-900/20 border border-sky-700/30 text-sky-300">
                  Databricks snapshot
                </span>
              )}
            </div>
            {/* Company Information */}
            {report.header && (
              <div className="flex flex-col gap-1 text-xs text-zinc-400">
                <div className="flex items-center gap-4">
                  <span className="font-medium text-zinc-300">{report.header.name}</span>
                  <span>{report.header.market}</span>
                  <span>{report.header.type}</span>
                  <span>{report.header.exchange}</span>
                  {report.header.employees && <span>{report.header.employees.toLocaleString()} employees</span>}
                </div>
                {report.header.description && (
                  <p className="text-zinc-500 max-w-2xl leading-relaxed">
                    {report.header.description.length > 200 
                      ? `${report.header.description.substring(0, 200)}...` 
                      : report.header.description}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isMockData ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-900/20 border border-amber-700/30 rounded-lg">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-amber-400 font-medium">Mock Data</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-900/20 border border-emerald-700/30 rounded-lg">
                <Database className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">Live Data</span>
              </div>
            )}
          </div>
        </div>


        {/* News Analysis */}
        {(newsKeyPoints.length > 0 || newsAnalysis) && (
          <section aria-label="News Analysis">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-[17px] font-medium tracking-tight text-zinc-100">News Analysis</h3>
              {report.news?.sentiment && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  report.news.sentiment === 'bullish' ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-700/30' :
                  report.news.sentiment === 'bearish' ? 'bg-red-900/20 text-red-400 border border-red-700/30' :
                  'bg-yellow-900/20 text-yellow-400 border border-yellow-700/30'
                }`}>
                  {report.news.sentiment.toUpperCase()}
                </span>
              )}
            </div>

            {/* Display analysis if available, otherwise show key points */}
            {newsAnalysis ? (
              <div className="mb-3">
                <p className="text-[15px] leading-snug text-zinc-300">{newsAnalysis}</p>
              </div>
            ) : (
              <ul className="space-y-2 mb-3">
                {newsKeyPoints.map((point: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span className="text-[15px] leading-snug text-zinc-300">{point}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Citations */}
            {newsSources.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm text-zinc-400">Sources</span>
                </div>
                <CitationsChips citations={newsSources} />
              </div>
            )}
          </section>
        )}

        {/* Technical Analysis */}
        {report.technical && (
          <section aria-label="Technical Analysis">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-[17px] font-medium tracking-tight text-zinc-100">Technical Analysis</h3>
              {report.technical?.sentiment && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  report.technical.sentiment === 'bullish' ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-700/30' :
                  report.technical.sentiment === 'bearish' ? 'bg-red-900/20 text-red-400 border border-red-700/30' :
                  'bg-yellow-900/20 text-yellow-400 border border-yellow-700/30'
                }`}>
                  {report.technical.sentiment.toUpperCase()}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {report.technical.indicators ? (
                <IndicatorsRow indicators={{
                  rsi14: report.technical.indicators.rsi || 0,
                  macd: report.technical.indicators.macd_line || 0,
                  macd_signal: report.technical.indicators.macd_signal || 0,
                  macd_hist: report.technical.indicators.macd_hist || 0,
                  ema20: report.technical.indicators.ema20 || 0,
                  ema50: report.technical.indicators.ema50 || 0,
                  ema200: report.technical.indicators.ema200 || 0,
                  fibonacci_support: [],
                  fibonacci_resistance: [],
                  vwap: report.technical.indicators.vwap || 0,
                  atr: report.technical.indicators.atr || 0,
                  volume_trend: report.technical.indicators.volume_trend || "insufficient_data",
                  volume_price_relationship: report.technical.indicators.vol_price_relation || "insufficient_data"
                }} />
              ) : (
                <div className="text-red-400">❌ No indicators data available</div>
              )}
              
              {/* Display AI technical analysis */}
              {technicalAnalysis && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">AI Technical Analysis</h4>
                  <p className="text-[15px] leading-snug text-zinc-300">{technicalAnalysis}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Overall Analysis */}
        {report.final_answer && (
          <section aria-label="Overall Analysis">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-[17px] font-medium tracking-tight text-zinc-100">Overall Analysis</h3>
              {report.final_answer?.overall_status && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  report.final_answer.overall_status === 'bullish' ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-700/30' :
                  report.final_answer.overall_status === 'bearish' ? 'bg-red-900/20 text-red-400 border border-red-700/30' :
                  'bg-yellow-900/20 text-yellow-400 border border-yellow-700/30'
                }`}>
                  {report.final_answer.overall_status.toUpperCase()}
                </span>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-[15px] leading-relaxed text-zinc-200 bg-zinc-900/40 border border-zinc-800 rounded-lg p-4">
                {report.final_answer.summary}
              </p>
              
              {finalAnswer && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">
                    {report.meta?.user_question ? `"${report.meta.user_question}"` : "Direct Answer"}
                  </h4>
                  <p className="text-[15px] leading-relaxed text-zinc-300 bg-zinc-900/40 border border-zinc-800 rounded-lg p-4">
                    {finalAnswer}
                  </p>
                </div>
              )}
              
              {keyInsights.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-zinc-400">Key Insights</h4>
                  <ul className="space-y-1">
                    {keyInsights.map((insight: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-1">•</span>
                        <span className="text-[14px] text-zinc-300">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-zinc-800">
          <button
            onClick={copySummary}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900/60 hover:bg-zinc-900/80 border border-zinc-800 rounded-lg text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
            aria-label="Copy Summary"
          >
            {copiedSummary ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedSummary ? 'Summary Copied!' : 'Copy Summary'}</span>
          </button>

          <button
            onClick={copyJson}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900/60 hover:bg-zinc-900/80 border border-zinc-800 rounded-lg text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
            aria-label="Copy JSON"
          >
            {copiedJson ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedJson ? 'JSON Copied!' : 'Copy JSON'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900/60 hover:bg-zinc-900/80 border border-zinc-800 rounded-lg text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
            aria-label="Print"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </div>
    </div>
  );
  } catch (error: any) {
    console.error("❌ ReportCard render error:", error);
    setRenderError(error.message || "Unknown render error");
    return null;
  }
}
