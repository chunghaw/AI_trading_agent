import React from 'react';
import { AgentReport } from '../../lib/agent.schema';
import { StatusPill } from './StatusPill';
import { IndicatorsRow } from './IndicatorsRow';
import { Copy, Check, Printer, Database, AlertTriangle, ExternalLink } from 'lucide-react';

interface AgentReportCardProps {
  report: AgentReport;
  className?: string;
}

export function AgentReportCard({ report, className = "" }: AgentReportCardProps) {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className={`bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="border-b border-zinc-800 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white mb-2">{report.header.name}</h1>
            <div className="flex items-center gap-4 text-sm text-zinc-400 mb-3">
              <span>{report.header.market}</span>
              <span>•</span>
              <span>{report.header.type}</span>
              <span>•</span>
              <span>{report.header.exchange}</span>
              <span>•</span>
              <span>{report.header.currency.toUpperCase()}</span>
              {report.header.employees && (
                <>
                  <span>•</span>
                  <span>{report.header.employees.toLocaleString()} employees</span>
                </>
              )}
            </div>
            <p className="text-zinc-300 text-sm leading-relaxed max-w-2xl">
              {report.header.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Copy report"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
            </button>
            <button
              onClick={printReport}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Print report"
            >
              <Printer className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>
      </div>

      {/* News Analysis */}
      <section className="border-b border-zinc-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold text-white">News Analysis</h2>
          <StatusPill status={report.news.status} />
        </div>
        
        {!report.news.no_data ? (
          <div className="space-y-4">
            {/* Key Points */}
            {report.news.key_points.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Key Points</h3>
                <ul className="space-y-2">
                  {report.news.key_points.map((point, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">•</span>
                      <span className="text-sm text-zinc-300">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Analysis */}
            <div>
              <p className="text-sm text-zinc-300 leading-relaxed">{report.news.analysis}</p>
            </div>
            
            {/* Sources */}
            {report.news.sources.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Sources</h3>
                <div className="flex flex-wrap gap-2">
                  {report.news.sources.map((source, i) => (
                    <a
                      key={i}
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {new URL(source).hostname}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">No recent news found for {report.meta.ticker}</span>
          </div>
        )}
      </section>

      {/* Technical Analysis */}
      <section className="border-b border-zinc-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold text-white">Technical Analysis</h2>
          <StatusPill status={report.technical.status} />
        </div>
        
        <div className="space-y-4">
          {/* Indicators Table */}
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Indicators</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-1">RSI</div>
                <div className="text-lg font-mono text-white">{report.technical.indicators.rsi.toFixed(2)}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-1">MACD</div>
                <div className="text-lg font-mono text-white">{report.technical.indicators.macd_line.toFixed(3)}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-1">Signal</div>
                <div className="text-lg font-mono text-white">{report.technical.indicators.macd_signal.toFixed(3)}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-1">Hist</div>
                <div className="text-lg font-mono text-white">{report.technical.indicators.macd_hist.toFixed(3)}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-1">EMA20</div>
                <div className="text-lg font-mono text-white">{report.technical.indicators.ema20.toFixed(2)}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-1">EMA50</div>
                <div className="text-lg font-mono text-white">{report.technical.indicators.ema50.toFixed(2)}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-1">EMA200</div>
                <div className="text-lg font-mono text-white">{report.technical.indicators.ema200.toFixed(2)}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-1">VWAP</div>
                <div className="text-lg font-mono text-white">{report.technical.indicators.vwap.toFixed(2)}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-1">ATR</div>
                <div className="text-lg font-mono text-white">{report.technical.indicators.atr.toFixed(2)}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-1">Vol Trend</div>
                <div className="text-sm font-medium text-white capitalize">{report.technical.indicators.volume_trend}</div>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-1">Vol-Price</div>
                <div className="text-sm font-medium text-white capitalize">{report.technical.indicators.vol_price_relation}</div>
              </div>
            </div>
          </div>
          
          {/* Analysis */}
          <div>
            <p className="text-sm text-zinc-300 leading-relaxed">{report.technical.analysis}</p>
          </div>
        </div>
      </section>

      {/* Final Answer */}
      <section className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold text-white">Final Answer</h2>
          <StatusPill status={report.final_answer.overall_status} />
        </div>
        
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-4">
          <p className="text-sm text-zinc-200 leading-relaxed mb-4">{report.final_answer.summary}</p>
          
          {/* Key Insights */}
          {report.final_answer.key_insights && report.final_answer.key_insights.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Key Insights</h3>
              <ul className="space-y-1">
                {report.final_answer.key_insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-1">•</span>
                    <span className="text-sm text-zinc-300">{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Meta Info */}
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>Ticker: {report.meta.ticker}</span>
            <span>•</span>
            <span>Horizon: {report.meta.horizon}</span>
            <span>•</span>
            <span>As of: {new Date(report.meta.as_of).toLocaleString()}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
