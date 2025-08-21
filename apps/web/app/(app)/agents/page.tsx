"use client";

import React from "react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Send } from "lucide-react";
// import { ReportSchema, type Report } from "../../../lib/report.schema";
// import { cn } from "../../../lib/utils";
// import { ReportCard } from "../../../components/report/ReportCard";

// Temporary cn function
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

// Temporary types
type Report = any;

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
      // const validatedData = ReportSchema.parse(data);
      setResponse(data);
      
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
        alert(`Error: ${error.message || "Something went wrong"}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-[1200px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text)] mb-2">AI Trading Agents</h1>
        <p className="text-[var(--muted)]">Get AI-powered trading analysis and insights</p>
      </div>

      <div className="grid gap-6">
        <Card className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[var(--text)] mb-2">Ask Your Trading Agent</h2>
            <p className="text-[var(--muted)]">Ask questions about stocks, get technical analysis, and receive trading recommendations</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-[var(--text)] mb-2">
                What would you like to know?
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={handlePromptChange}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Analyze NVDA's performance and give me a trading recommendation"
                className="w-full h-32 p-4 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-none"
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 text-sm text-[var(--text)]">
                  <span>Timeframe:</span>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="px-3 py-1 border border-[var(--border)] rounded bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    disabled={isLoading}
                  >
                    <option value="1d">1 Day</option>
                    <option value="5d">5 Days</option>
                    <option value="1mo">1 Month</option>
                    <option value="3mo">3 Months</option>
                    <option value="6mo">6 Months</option>
                    <option value="1y">1 Year</option>
                  </select>
                </label>
              </div>

              <Button
                type="submit"
                disabled={!prompt.trim() || isLoading}
                className={cn(
                  "flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200",
                  !prompt.trim() || isLoading
                    ? "bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed"
                    : "bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
                )}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Get Analysis</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        {response && (
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[var(--text)]">Analysis Results</h3>
              {isMockData && (
                <p className="text-sm text-[var(--muted)] mt-1">Using mock data for demonstration</p>
              )}
            </div>
            
            <div className="space-y-4">
              <pre className="bg-[var(--bg-secondary)] p-4 rounded-lg text-sm overflow-auto">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
