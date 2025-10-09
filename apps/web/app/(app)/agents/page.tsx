"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

import { ReportSchema, type Report } from "@/lib/report.schema";
import { cn } from "@/lib/utils";
import { ReportCard } from "@/components/report/ReportCard";

const analysisTypes = [
  { id: "combined", label: "Combined Analysis", description: "News + Technical + Portfolio" },
];

// Common stock symbols to detect from text
const STOCK_SYMBOLS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "BRK.B",
  "UNH", "JNJ", "V", "PG", "HD", "MA", "BAC", "ABBV", "PFE", "KO",
  "AVGO", "PEP", "TMO", "COST", "DHR", "MRK", "WMT", "ACN", "ABT",
  "LLY", "VZ", "TXN", "QCOM", "HON", "PM", "LOW", "UNP", "RTX",
  "SPY", "QQQ", "IWM", "GLD", "SLV", "TLT", "VNQ", "XLE", "XLF",
  "BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD", "DOGE-USD", "AMD"
];

// Function to detect stock symbol from text
function detectSymbolFromText(text: string): string | null {
  const upperText = text.toUpperCase();
  
  // Look for exact symbol matches
  for (const symbol of STOCK_SYMBOLS) {
    if (upperText.includes(symbol)) {
      return symbol;
    }
  }
  
  // Look for common company names and map to symbols
  const companyMappings: { [key: string]: string } = {
    "APPLE": "AAPL",
    "MICROSOFT": "MSFT",
    "GOOGLE": "GOOGL",
    "ALPHABET": "GOOGL",
    "AMAZON": "AMZN",
    "NVIDIA": "NVDA",
    "TESLA": "TSLA",
    "FACEBOOK": "META",
    "META": "META",
    "BERKSHIRE": "BRK.B",
    "UNITEDHEALTH": "UNH",
    "JOHNSON": "JNJ",
    "VISA": "V",
    "PROCTER": "PG",
    "HOME DEPOT": "HD",
    "MASTERCARD": "MA",
    "BANK OF AMERICA": "BAC",
    "ABBVIE": "ABBV",
    "PFIZER": "PFE",
    "COCA COLA": "KO",
    "BROADCOM": "AVGO",
    "PEPSI": "PEP",
    "THERMO FISHER": "TMO",
    "COSTCO": "COST",
    "DANAHER": "DHR",
    "MERCK": "MRK",
    "WALMART": "WMT",
    "ACCENTURE": "ACN",
    "ABBOTT": "ABT",
    "ELI LILLY": "LLY",
    "VERIZON": "VZ",
    "TEXAS INSTRUMENTS": "TXN",
    "QUALCOMM": "QCOM",
    "HONEYWELL": "HON",
    "PHILIP MORRIS": "PM",
    "LOWE": "LOW",
    "UNION PACIFIC": "UNP",
    "RAYTHEON": "RTX",
    "ADVANCED MICRO": "AMD",
    "AMD": "AMD"
  };
  
  for (const [company, symbol] of Object.entries(companyMappings)) {
    if (upperText.includes(company)) {
      return symbol;
    }
  }
  
  return null;
}

export default function AgentsPage() {
  const [prompt, setPrompt] = React.useState("");
  const [symbol, setSymbol] = React.useState("NVDA");
  const [timeframe, setTimeframe] = React.useState("1d");
  const [sinceDays, setSinceDays] = React.useState(7);

  const [isLoading, setIsLoading] = React.useState(false);
  const [response, setResponse] = React.useState<Report | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [symbolAutoDetected, setSymbolAutoDetected] = React.useState(false);

  // Auto-detect symbol when prompt changes
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setPrompt(newPrompt);
    
    // Auto-detect symbol from prompt
    const detectedSymbol = detectSymbolFromText(newPrompt);
    if (detectedSymbol && detectedSymbol !== symbol) {
      setSymbol(detectedSymbol);
      setSymbolAutoDetected(true);
      // Clear the auto-detected flag after 3 seconds
      setTimeout(() => setSymbolAutoDetected(false), 3000);
    }
  };

  const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSymbol(e.target.value.toUpperCase());
    setSymbolAutoDetected(false); // Clear auto-detected flag when manually changed
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    // Clear previous response and error
    setResponse(null);
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          query: prompt,
          timeframe,
          since_days: sinceDays
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle specific error cases
        if (res.status === 422) {
          if (data.code === "NO_NEWS_DATA") {
            setError(`No news data available for ${symbol}. The Airflow DAG may need to be run to ingest recent news.`);
          } else if (data.code === "INSUFFICIENT_OHLCV") {
            setError("Insufficient OHLCV data. Please ensure proper data sources are configured.");
          } else {
            setError(data.error || "Data validation failed");
          }
        } else {
          setError(data.error || "Analysis failed");
        }
        return;
      }

      const validatedData = ReportSchema.parse(data);
      setResponse(validatedData);
      
    } catch (error: any) {
      console.error("Error:", error);
      setError("Failed to get analysis. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (examplePrompt: string, exampleSymbol: string) => {
    setPrompt(examplePrompt);
    setSymbol(exampleSymbol);
    setSymbolAutoDetected(false);
    // Clear any existing response when selecting an example
    setResponse(null);
    setError(null);
  };

  const handleRetry = () => {
    setError(null);
    if (prompt.trim()) {
      handleSubmit(new Event('submit') as any);
    }
  };

  const examplePrompts = [
    { prompt: "What's the technical outlook for NVDA?", symbol: "NVDA" },
    { prompt: "Should I buy AMD based on recent news?", symbol: "AMD" },
    { prompt: "Analyze MSFT's portfolio positioning", symbol: "MSFT" },
    { prompt: "What's the market sentiment for TSLA?", symbol: "TSLA" },
    { prompt: "Should I sell my AAPL position?", symbol: "AAPL" },
    { prompt: "What's the risk profile for META?", symbol: "META" },
  ];

  return (
    <div className="container max-w-[1200px] mx-auto px-4 py-8 space-y-8">
      {/* Page Title */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-[var(--text)] tracking-tight">
          AI Trading Agents
        </h1>
        <p className="text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
          Ask questions about market analysis, technical indicators, news sentiment, or portfolio insights
        </p>
      </div>

      {/* Cursor-style Chat Input */}
      <div className="max-w-4xl mx-auto">
        <Card className="border rounded-2xl backdrop-blur-sm border-white/10 bg-[#3a3a3a] shadow-lg">
          <form onSubmit={handleSubmit} className="p-0">
            <div className="relative">
              <textarea
                placeholder="Ask Trading AI to analyze markets, optimize strategies, explore opportunities..."
                value={prompt}
                onChange={handlePromptChange}
                className="w-full h-20 px-6 py-4 bg-transparent border-none text-[var(--text)] placeholder-[var(--muted)] resize-none focus:outline-none text-base leading-relaxed"
              />

              <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-[#2a2a2a]/50">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex items-center space-x-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <span className="text-sm text-[var(--text)] font-medium">
                        Combined Analysis
                      </span>
                    </Button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <input
                        placeholder="NVDA"
                        value={symbol}
                        onChange={handleSymbolChange}
                        className={cn(
                          "px-3 py-1.5 bg-white/5 rounded-lg border text-sm text-[var(--text)] placeholder-[var(--muted)] w-20 transition-all duration-200",
                          symbolAutoDetected
                            ? "border-emerald-500/50 bg-emerald-900/20" 
                            : "border-white/10"
                        )}
                      />
                      {symbolAutoDetected && (
                        <div className="absolute -top-6 left-0 text-xs text-emerald-400 font-medium">
                          Auto-detected
                        </div>
                      )}
                    </div>

                    <select
                      value={sinceDays}
                      onChange={(e) => setSinceDays(Number(e.target.value))}
                      className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-sm text-[var(--text)]"
                    >
                      <option value={3}>3d</option>
                      <option value={7}>7d</option>
                      <option value={14}>14d</option>
                      <option value={30}>30d</option>
                    </select>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !prompt.trim()}
                  className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-black/20 disabled:pointer-events-none disabled:opacity-50 h-10 w-10 p-0 bg-[var(--accent)] hover:bg-[var(--accent-600)] text-black rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>

      {/* Example Prompts */}
      <div className="text-center mb-8">
        <p className="text-base text-[var(--muted)] mb-6">
          Try these trading examples to get started
        </p>
        <div className="flex items-center justify-center space-x-4">
          {examplePrompts.map((example, index) => (
            <button
              key={index}
              onClick={() => handleExampleClick(example.prompt, example.symbol)}
              className="px-4 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 text-sm text-[var(--text)] transition-colors"
            >
              {example.prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <div className="text-red-600 font-semibold">Error</div>
          </div>
          <p className="text-red-700 mb-3">{error}</p>
          <div className="text-sm text-red-600">
            <p className="font-medium mb-1">Troubleshooting steps:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Check if the Airflow DAG is running to ingest news data</li>
              <li>Verify the symbol exists in our data sources</li>
              <li>Try a different time window or symbol</li>
            </ul>
          </div>
          <button
            onClick={handleRetry}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Analysis Results */}
      {response && (
        <div className="mt-8">
          <div className="mb-4 text-center text-sm text-[var(--muted)]">
            News window: {sinceDays}d • Final K: {process.env.NEWS_FINAL_K || 12}
          </div>
          <ReportCard report={response} />
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-[var(--text)]">Analyzing market data...</div>
        </div>
      )}
    </div>
  );
}
