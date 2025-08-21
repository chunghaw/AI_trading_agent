import React, { useMemo, useState } from 'react';
// import { cn } from '../../lib/utils';
import { Copy, Check, Printer, Database, AlertTriangle, ExternalLink, Link as LinkIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { ActionBadge } from './ActionBadge';
import { ConfidenceBar } from './ConfidenceBar';
import { IndicatorsRow } from './IndicatorsRow';
import { LevelsBlock } from './LevelsBlock';
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

// Temporary type
type Report = any;

export function ReportCard({ report, className, isMockData = false, dataSource = 'none' }: ReportCardProps) {
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const newsSummary = report.news?.summary ?? [];
  const newsCitations = report.news?.citations ?? [];
  const newsMetrics = report.news?.metrics;
  const techSummary = report.technical?.summary ?? [];

  const tpList = useMemo(() => {
    const tp = report.portfolio?.tp;
    if (!tp) return [];
    return Array.isArray(tp) ? tp : [tp];
  }, [report.portfolio?.tp]);

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
    lines.push(`${report.symbol} • ${String(report.timeframe || '1d').toUpperCase()}`);
    if (report.price) {
      lines.push(`Price: ${fmtMoney(report.price.current)} (${report.price.change >= 0 ? '+' : ''}${fmtMoney(report.price.change)} ${report.price.changePercent >= 0 ? '+' : ''}${report.price.changePercent.toFixed(2)}%)`);
    }
    lines.push(`Action: ${report.action} • Confidence: ${(report.confidence ?? 0).toFixed(2)}`);
    if (report.answer) lines.push(`\n${report.answer}`);
    if (newsSummary.length) {
      lines.push('\nNews Key Points:');
      newsSummary.forEach(s => lines.push(`• ${s}`));
    }
    if (techSummary.length) {
      lines.push('\nTechnical Key Points:');
      techSummary.forEach(s => lines.push(`• ${s}`));
    }
    if (report.finalAnswer) {
      lines.push('\nFinal Answer:');
      lines.push(report.finalAnswer);
      if (report.finalInsights && report.finalInsights.length > 0) {
        lines.push('\nKey Insights:');
        report.finalInsights.forEach(s => lines.push(`• ${s}`));
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

  return (
    <div className={cn('max-w-[880px] mx-auto px-4 md:px-6', className)}>
      <div className="panel p-5 md:p-6 space-y-6">

        {/* Header with Price Information */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-zinc-100">{report.symbol}</h2>
            <span className="text-sm text-zinc-400">{String(report.timeframe || '1d').toUpperCase()}</span>
            {dataSource === 'databricks' && (
              <span className="text-xs px-2 py-0.5 rounded-lg bg-sky-900/20 border border-sky-700/30 text-sky-300">
                Databricks snapshot
              </span>
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

        {/* Price Change Row */}
        {report.price && (
          <div className="flex items-center justify-between p-3 bg-zinc-900/40 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold text-zinc-100">{fmtMoney(report.price.current)}</span>
              <div className="flex items-center gap-2">
                {report.price.change >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <span className={`text-lg font-semibold ${report.price.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {report.price.change >= 0 ? '+' : ''}{fmtMoney(report.price.change)}
                </span>
                <span className={`text-sm ${report.price.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ({report.price.changePercent >= 0 ? '+' : ''}{report.price.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ActionBadge action={report.action} />
              <ConfidenceBar value={report.confidence ?? 0} />
            </div>
          </div>
        )}

        {/* Analyst Responses */}
        {report.answer && (
          <section aria-label="Analyst Responses">
            <AnalystResponses answer={report.answer} />
          </section>
        )}

        {/* Technical Key Points */}
        {techSummary.length > 0 && (
          <section aria-label="Technical Key Points">
            <h3 className="text-[17px] font-medium tracking-tight text-zinc-100 mb-3">Technical Key Points</h3>
            <div className="space-y-3">
              <IndicatorsRow indicators={report.indicators} />
              <ul className="space-y-2">
                {techSummary.map((point, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-1">•</span>
                    <span className="text-[15px] leading-snug text-zinc-300">{point}</span>
                  </li>
                ))}
              </ul>
              <LevelsBlock levels={report.levels} />
            </div>
          </section>
        )}

        {/* News Key Points */}
        {newsSummary.length > 0 && (
          <section aria-label="News Key Points">
            <h3 className="text-[17px] font-medium tracking-tight text-zinc-100 mb-3">News Key Points</h3>
            
            {/* Metrics row (if available) */}
            {newsMetrics && (
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-xs px-2 py-1 rounded bg-zinc-900/60 border border-zinc-800 text-zinc-300">
                  Docs: <span className="font-mono">{newsMetrics.docs}</span>
                </span>
                <span className="text-xs px-2 py-1 rounded bg-zinc-900/60 border border-zinc-800 text-zinc-300">
                  Sources: <span className="font-mono">{newsMetrics.sources}</span>
                </span>
                <span className="text-xs px-2 py-1 rounded bg-emerald-900/20 border border-emerald-700/30 text-emerald-300">
                  + {newsMetrics.pos}
                </span>
                <span className="text-xs px-2 py-1 rounded bg-amber-900/20 border border-amber-700/30 text-amber-300">
                  · {newsMetrics.neu}
                </span>
                <span className="text-xs px-2 py-1 rounded bg-rose-900/20 border border-rose-700/30 text-rose-300">
                  – {newsMetrics.neg}
                </span>
                <span className="text-xs px-2 py-1 rounded bg-zinc-900/60 border border-zinc-800 text-zinc-300">
                  Net: <span className="font-mono">{(newsMetrics.net_sentiment ?? 0).toFixed(2)}</span>
                </span>
              </div>
            )}

            <ul className="space-y-2 mb-3">
              {newsSummary.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span className="text-[15px] leading-snug text-zinc-300">{point}</span>
                </li>
              ))}
            </ul>

            {/* Citations */}
            {newsCitations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm text-zinc-400">Sources</span>
                </div>
                <CitationsChips citations={newsCitations} />
              </div>
            )}
          </section>
        )}

        {/* Portfolio & Risk */}
        <section aria-label="Portfolio & Risk">
          <h3 className="text-[17px] font-medium tracking-tight text-zinc-100 mb-3">Portfolio & Risk</h3>
          <div className="space-y-2 text-[15px] text-zinc-300">
            <p>
              Suggested position size:{' '}
              <span className="text-emerald-400 font-medium">
                {fmtPct(report.portfolio?.size_suggestion_pct, 0)}
              </span>
            </p>

            {tpList.length > 0 && (
              <p>
                Take profit:{' '}
                <span className="text-emerald-400 font-mono">
                  {tpList.map((v, i) => fmtMoney(v)).join(' / ')}
                </span>
              </p>
            )}

            {report.portfolio?.sl !== undefined && (
              <p>
                Stop loss:{' '}
                <span className="text-rose-400 font-mono">
                  {fmtMoney(report.portfolio?.sl)}
                </span>
              </p>
            )}
          </div>
        </section>

        {/* Final Answer */}
        {report.finalAnswer && (
          <section aria-label="Final Answer">
            <h3 className="text-[17px] font-medium tracking-tight text-zinc-100 mb-3">Final Answer</h3>
            <div className="space-y-3">
              <p className="text-[15px] leading-relaxed text-zinc-200 bg-zinc-900/40 border border-zinc-800 rounded-lg p-4">
                {report.finalAnswer}
              </p>
              
              {report.finalInsights && report.finalInsights.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-zinc-400">Key Insights</h4>
                  <ul className="space-y-1">
                    {report.finalInsights.map((insight, i) => (
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
}
