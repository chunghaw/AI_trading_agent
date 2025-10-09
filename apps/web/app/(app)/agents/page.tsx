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

export default function AgentsPage() {
  const [prompt, setPrompt] = React.useState("");
  const [timeframe, setTimeframe] = React.useState("1d");
  const [isLoading, setIsLoading] = React.useState(false);
  const [response, setResponse] = React.useState<Report | null>(null);
  const [error, setError] = React.useState<string | null>(null);

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
          query: prompt,
          timeframe,
          since_days: 7
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Analysis failed");
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

  const handleRetry = () => {
    setError(null);
    if (prompt.trim()) {
      handleSubmit(new Event('submit') as any);
    }
  };

  const examplePrompts = [
    { prompt: "What's the technical outlook for NVDA?", symbol: "NVDA" },
    { prompt: "Should I buy AAPL based on recent news?", symbol: "AAPL" },
    { prompt: "Is TSLA a good investment right now?", symbol: "TSLA" }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Trading Analysis</h1>
          <p className="text-gray-600">Get comprehensive market analysis powered by AI</p>
        </div>

        {/* Analysis Type Selector */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-white rounded-lg border border-gray-200 p-1">
            {analysisTypes.map((type) => (
              <button
                key={type.id}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  "text-blue-600 bg-blue-50"
                )}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <Card className="mb-8">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                  Ask about any stock or market question
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Should I buy GOOGL based on recent news? What's the technical outlook for NVDA?"
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <label htmlFor="timeframe" className="block text-sm font-medium text-gray-700 mb-1">
                      Timeframe
                    </label>
                    <select
                      id="timeframe"
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isLoading}
                    >
                      <option value="1d">1 Day</option>
                      <option value="1w">1 Week</option>
                      <option value="1m">1 Month</option>
                    </select>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading || !prompt.trim()}
                  className="flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{isLoading ? "Analyzing..." : "Analyze"}</span>
                </Button>
              </div>
            </form>
          </div>
        </Card>

        {/* Example Prompts */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Try these examples:</h3>
          <div className="flex flex-wrap gap-2">
            {examplePrompts.map((example, index) => (
              <button
                key={index}
                onClick={() => setPrompt(example.prompt)}
                className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={isLoading}
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
            <ReportCard report={response} />
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-600">Analyzing market data...</div>
          </div>
        )}
      </div>
    </div>
  );
}