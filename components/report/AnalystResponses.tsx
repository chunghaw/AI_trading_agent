import React from "react";
import { TrendingUp, TrendingDown, Minus, Newspaper, BarChart3, PieChart, AlertTriangle } from "lucide-react";

interface AnalystResponsesProps {
  answer: string;
}

interface AnalystResponse {
  type: "News Analyst" | "Technical Analyst" | "Portfolio Analyst";
  content: string;
  recommendation: string;
  confidence: "strong" | "weak" | "neutral";
}

export default function AnalystResponses({ answer }: AnalystResponsesProps) {
  // Parse the analyst responses from the answer
  const parseAnalystResponses = (answer: string): AnalystResponse[] => {
    const responses: AnalystResponse[] = [];
    
    // Debug: Log the answer to see what we're parsing
    console.log("🔍 AnalystResponses parsing answer:", answer);
    
    // Extract News Analyst response - be more flexible with the pattern
    let newsMatch = answer.match(/News Analyst:\s*(.*?)(?=\n\s*Technical Analyst:|Technical Analyst:|Portfolio Analyst:|$)/i);
    if (!newsMatch) {
      // Fallback: try to find News Analyst anywhere in the text
      newsMatch = answer.match(/News Analyst:\s*(.*?)(?=Technical Analyst:|$)/i);
    }
    if (newsMatch) {
      const content = newsMatch[1].trim();
      console.log("📰 Found News Analyst content:", content);
      const recommendation = extractRecommendation(content);
      responses.push({
        type: "News Analyst",
        content,
        recommendation: recommendation.recommendation,
        confidence: recommendation.confidence
      });
    } else {
      console.log("❌ No News Analyst match found");
    }
    
    // Extract Technical Analyst response - be more flexible with the pattern
    let technicalMatch = answer.match(/Technical Analyst:\s*(.*?)(?=\n\s*News Analyst:|News Analyst:|Portfolio Analyst:|$)/i);
    if (!technicalMatch) {
      // Fallback: try to find Technical Analyst anywhere in the text
      technicalMatch = answer.match(/Technical Analyst:\s*(.*?)(?=News Analyst:|$)/i);
    }
    if (technicalMatch) {
      const content = technicalMatch[1].trim();
      console.log("📊 Found Technical Analyst content:", content);
      const recommendation = extractRecommendation(content);
      responses.push({
        type: "Technical Analyst",
        content,
        recommendation: recommendation.recommendation,
        confidence: recommendation.confidence
      });
    } else {
      console.log("❌ No Technical Analyst match found");
    }
    
    // Extract Portfolio Analyst response
    const portfolioMatch = answer.match(/Portfolio Analyst:\s*(.*?)(?=\n\s*News Analyst:|News Analyst:|Technical Analyst:|$)/i);
    if (portfolioMatch) {
      const content = portfolioMatch[1].trim();
      const recommendation = extractRecommendation(content);
      responses.push({
        type: "Portfolio Analyst",
        content,
        recommendation: recommendation.recommendation,
        confidence: recommendation.confidence
      });
    }
    
    console.log("🔍 Parsed responses:", responses.map(r => ({ type: r.type, contentLength: r.content.length })));
    return responses;
  };
  
  const extractRecommendation = (content: string): { recommendation: string; confidence: "strong" | "weak" | "neutral" } => {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes("strong buy")) {
      return { recommendation: "Strong Buy", confidence: "strong" };
    } else if (lowerContent.includes("buy") || lowerContent.includes("bullish")) {
      return { recommendation: "Buy", confidence: "weak" };
    } else if (lowerContent.includes("strong sell")) {
      return { recommendation: "Strong Sell", confidence: "strong" };
    } else if (lowerContent.includes("sell") || lowerContent.includes("bearish")) {
      return { recommendation: "Sell", confidence: "weak" };
    } else if (lowerContent.includes("hold") || lowerContent.includes("neutral")) {
      return { recommendation: "Hold", confidence: "neutral" };
    }
    
    return { recommendation: "Neutral", confidence: "neutral" };
  };
  
  const getAnalystIcon = (type: string) => {
    switch (type) {
      case "News Analyst": return <Newspaper className="w-5 h-5" />;
      case "Technical Analyst": return <BarChart3 className="w-5 h-5" />;
      case "Portfolio Analyst": return <PieChart className="w-5 h-5" />;
      default: return <Minus className="w-5 h-5" />;
    }
  };
  
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "strong": return "text-emerald-400 bg-emerald-900/20 border-emerald-500/30";
      case "weak": return "text-amber-400 bg-amber-900/20 border-amber-500/30";
      case "neutral": return "text-yellow-400 bg-yellow-900/20 border-yellow-500/30";
      default: return "text-gray-400 bg-gray-900/20 border-gray-500/30";
    }
  };
  
  const getRecommendationColor = (recommendation: string) => {
    const lowerRec = recommendation.toLowerCase();
    
    // Buy recommendations - Green
    if (lowerRec.includes("strong buy") || lowerRec.includes("buy")) {
      return "text-emerald-400";
    }
    
    // Sell recommendations - Red
    if (lowerRec.includes("strong sell") || lowerRec.includes("sell")) {
      return "text-red-400";
    }
    
    // Hold/Neutral recommendations - Yellow
    if (lowerRec.includes("hold") || lowerRec.includes("neutral")) {
      return "text-yellow-400";
    }
    
    // Default fallback
    return "text-gray-400";
  };
  
  const getRecommendationBackgroundColor = (recommendation: string) => {
    const lowerRec = recommendation.toLowerCase();
    
    // Buy recommendations - Green background
    if (lowerRec.includes("strong buy") || lowerRec.includes("buy")) {
      return "bg-emerald-900/20 border-emerald-500/30";
    }
    
    // Sell recommendations - Red background
    if (lowerRec.includes("strong sell") || lowerRec.includes("sell")) {
      return "bg-red-900/20 border-red-500/30";
    }
    
    // Hold/Neutral recommendations - Yellow background
    if (lowerRec.includes("hold") || lowerRec.includes("neutral")) {
      return "bg-yellow-900/20 border-yellow-500/30";
    }
    
    // Default fallback
    return "bg-gray-900/20 border-gray-500/30";
  };
  
  const responses = parseAnalystResponses(answer);
  
  // Debug: Log the parsing results
  console.log("🔍 AnalystResponses parsing:", {
    answerLength: answer.length,
    responsesFound: responses.length,
    responses: responses.map(r => ({ type: r.type, contentLength: r.content.length }))
  });
  
  if (responses.length === 0) {
    // Fallback to original answer if parsing fails
    return (
      <div className="p-4 bg-gray-900/30 rounded-lg border border-gray-700/50">
        <p className="text-[var(--text)] leading-relaxed">{answer}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-[var(--muted)] mb-3">Analyst Perspectives</h3>
      
      <div className="space-y-4">
        {responses.map((response, index) => (
          <div 
            key={index} 
            className={`p-4 rounded-lg border ${getRecommendationBackgroundColor(response.recommendation)}`}
          >
            <div className="flex items-center gap-3 mb-3">
              {getAnalystIcon(response.type)}
              <div className="flex-1">
                <span className="text-sm font-semibold text-gray-200">{response.type}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm font-bold ${getRecommendationColor(response.recommendation)}`}>
                    {response.recommendation}
                  </span>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(response.confidence)}`}>
                    {response.confidence === "strong" ? "🔥 Strong" : 
                     response.confidence === "weak" ? "⚡ Weak" : "➡️ Neutral"}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-3">
              <p className="text-sm text-gray-200 leading-relaxed">
                {response.content}
              </p>
            </div>
            
            {/* Show warning for no news scenario */}
            {response.type === "News Analyst" && response.content.toLowerCase().includes("no recent news") && (
              <div className="flex items-center gap-2 p-2 bg-amber-900/20 border border-amber-700/30 rounded text-xs text-amber-300">
                <AlertTriangle className="w-3 h-3" />
                <span>Limited news data available - analysis based on technical indicators</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
