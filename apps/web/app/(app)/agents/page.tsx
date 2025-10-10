"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { ReportSchema, type Report } from "@/lib/report.schema";
import { cn } from "@/lib/utils";
import { ReportCard } from "@/components/report/ReportCard";


export default function AgentsPage() {
  const [prompt, setPrompt] = React.useState("");
  const [timeframe, setTimeframe] = React.useState("1d");
  const [isLoading, setIsLoading] = React.useState(false);
  const [response, setResponse] = React.useState<Report | null>(null);
  const [isMockData, setIsMockData] = React.useState(false);
  const [showModelDropdown, setShowModelDropdown] = React.useState(false);
  const [progressMessage, setProgressMessage] = React.useState("");

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
    setProgressMessage("🤖 Detecting stock symbol from your question...");

    try {
      // Simulate progress updates
      const progressSteps = [
        "📊 Loading OHLCV data from database...",
        "📰 Searching for relevant news articles...",
        "🔍 Analyzing technical indicators...",
        "🧠 Processing news sentiment analysis...",
        "📈 Computing technical analysis...",
        "🎯 Generating final investment recommendation..."
      ];

      let currentStep = 0;
      const progressInterval = setInterval(() => {
        if (currentStep < progressSteps.length) {
          setProgressMessage(progressSteps[currentStep]);
          currentStep++;
        }
      }, 2000);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: prompt,
          timeframe,
          since_days: 7
        }),
      });

      clearInterval(progressInterval);
      setProgressMessage("✅ Analysis complete! Processing results...");

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await res.json();
      console.log("🔍 Raw API Response:", data);
      
      try {
        const validatedData = ReportSchema.parse(data);
        console.log("✅ Schema validation passed:", validatedData);
        setResponse(validatedData);
      } catch (schemaError: any) {
        console.error("❌ Schema validation failed:", schemaError);
        console.error("❌ Raw data that failed validation:", data);
        
        // Try to set response anyway for debugging
        setResponse(data);
        
        // Show specific error
        alert(`Schema validation failed: ${schemaError.message}. Check console for details.`);
        return;
      }
      
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
      console.error("❌ Full error object:", error);
      console.error("❌ Error message:", error.message);
      console.error("❌ Error stack:", error.stack);
      console.error("❌ Error name:", error.name);
      
      // Handle specific error types
      if (error.message?.includes("SYMBOL_NOT_SUPPORTED")) {
        alert(`Symbol not supported. Only NVDA is currently supported with real data.`);
      } else if (error.message?.includes("not available yet")) {
        alert(`Real-time data for this symbol is not available yet. We're working on adding more symbols soon!`);
      } else if (error.message?.includes("DATA_NOT_AVAILABLE")) {
        alert(`Real-time data for this symbol is not available yet. We're working on adding more symbols soon!`);
      } else if (error.message?.includes("Schema validation failed")) {
        // Don't show alert again, we already showed it above
        console.log("Schema validation error handled above");
      } else {
        alert(`Failed to get analysis: ${error.message}. Check console for details.`);
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
          <ReportCard report={response} />
          
          {/* DEBUG: Show raw JSON as fallback */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-300">
              🔍 Debug: Show Raw Response
            </summary>
            <pre className="text-xs text-gray-300 bg-black/50 p-4 rounded-lg overflow-auto max-h-96 mt-2 whitespace-pre-wrap">
              {JSON.stringify(response, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
          <div className="text-[var(--text)] text-center">
            <div className="text-lg font-medium mb-2">AI Trading Analysis in Progress</div>
            <div className="text-sm text-[var(--muted)]">{progressMessage}</div>
          </div>
        </div>
      )}
    </div>
  );
}