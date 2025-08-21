"use client";

import React from "react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Send } from "lucide-react";
// import { ReportSchema, type Report } from "../../../lib/report.schema";
// import { cn } from "../../../lib/utils";
// import { ReportCard } from "../../../components/report/ReportCard";

// Temporary functions
const ReportSchema = { parse: (data: any) => data };
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
type Report = any;

// Temporary ReportCard component
const ReportCard = ({ report, isMockData = false }: { report: any; isMockData?: boolean }) => (
  <Card className="p-6">
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-[var(--text)]">Analysis Results</h3>
      {isMockData && (
        <p className="text-sm text-[var(--muted)] mt-1">Using mock data for demonstration</p>
      )}
    </div>
    <div className="space-y-4">
      <pre className="bg-[var(--bg-secondary)] p-4 rounded-lg text-sm overflow-auto">
        {JSON.stringify(report, null, 2)}
      </pre>
    </div>
  </Card>
);

const analysisTypes = [
  { id: "combined", label: "Combined Analysis", description: "News + Technical + Portfolio" },
];





export default function AgentsPage() {
  const [prompt, setPrompt] = React.useState("");
  const [timeframe, setTimeframe] = React.useState("1d");
  const [isLoading, setIsLoading] = React.useState(false);
  const [response, setResponse] = React.useState<Report | null>(null);
  const [isMockData, setIsMockData] = React.useState(false);
  const [showModelDropdown, setShowModelDropdown] = React.useState(false);


  // Auto-detect symbol when prompt changes
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !isLoading) {
        handleSubmit(e as any);
      }
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    // Clear previous response immediately
    setResponse(null);
    setIsMockData(false);
    setIsLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          timeframe,
          since_days: 7,
          k: 12
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await res.json();
      const validatedData = ReportSchema.parse(data);
      setResponse(validatedData);
      
      // Set mock data to false since we're not using mock data anymore
      setIsMockData(false);
      

      
      // Log RAG data sources for debugging
      const metadata = (data as any)._metadata;
      if (metadata?.ragData) {
        console.log(`📊 RAG Analysis:`, {
          newsCount: metadata.ragData.newsCount,
          ohlcvSource: metadata.ragData.ohlcvSource,
          newsSource: metadata.ragData.newsSource
        });
      }
    } catch (error: any) {
      console.error("Error:", error);
      
      // Handle specific error types
      console.log("Full error:", error);
      console.log("Error message:", error.message);
      
      if (error.message?.includes("SYMBOL_NOT_SUPPORTED")) {
        alert(`Symbol not supported. Only NVDA is currently supported with real data.`);
      } else if (error.message?.includes("not available yet")) {
        alert(`Real-time data for this symbol is not available yet. We're working on adding more symbols soon!`);
      } else if (error.message?.includes("DATA_NOT_AVAILABLE")) {
        alert(`Real-time data for this symbol is not available yet. We're working on adding more symbols soon!`);
      } else {
        alert("Failed to get analysis. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (examplePrompt: string) => {
    setPrompt(examplePrompt);
    // Clear any existing response when selecting an example
    setResponse(null);
    setIsMockData(false);
  };



  const examplePrompts = [
    { prompt: "What's the technical outlook for NVDA?" },
    { prompt: "Should I buy GOOGL based on recent news?" },
    { prompt: "Analyze AAPL's portfolio positioning" },
    { prompt: "What's the market sentiment for TSLA?" },
    { prompt: "Should I sell my MSFT position?" },
    { prompt: "What's the risk profile for AMZN?" },
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
        <p className="text-sm text-[var(--muted)] max-w-2xl mx-auto">
          Currently supporting: <span className="text-green-400 font-medium">NVDA</span>, <span className="text-green-400 font-medium">GOOGL</span>, <span className="text-green-400 font-medium">AAPL</span>, <span className="text-green-400 font-medium">MSFT</span>, <span className="text-green-400 font-medium">TSLA</span> and other major stocks
        </p>
      </div>

      {/* Cursor-style Chat Input */}
      <div className="max-w-4xl mx-auto">
        <Card className="border rounded-2xl backdrop-blur-sm border-white/10 bg-[#3a3a3a] shadow-lg">
          <form onSubmit={handleSubmit} className="p-0">
            <div className="relative">
              <textarea
                placeholder="Ask Trading AI to analyze markets, optimize strategies, explore opportunities... (Press Enter to submit)"
                value={prompt}
                onChange={handlePromptChange}
                onKeyDown={handleKeyDown}
                className="w-full h-20 px-6 py-4 bg-transparent border-none text-[var(--text)] placeholder-[var(--muted)] resize-none focus:outline-none text-base leading-relaxed"
              />
              <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-[#2a2a2a]/50">
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <span>Press Enter to submit</span>
                  <span>•</span>
                  <span>Shift+Enter for new line</span>
                </div>
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
                  
                </div>
                <Button
                  type="submit"
                  disabled={isLoading || !prompt.trim()}
                  className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-black/20 disabled:pointer-events-none disabled:opacity-50 h-10 w-10 p-0 bg-green-700 hover:bg-green-600 text-black rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Send className="w-8 h-8 stroke-black fill-none" />
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
              onClick={() => handleExampleClick(example.prompt)}
              className="px-4 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 text-sm text-[var(--text)] transition-colors"
            >
              {example.prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Analysis Results */}
      {response && (
        <div className="mt-8">
          <ReportCard report={response} isMockData={isMockData} />
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
