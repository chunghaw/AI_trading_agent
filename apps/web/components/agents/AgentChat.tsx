"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Send, 
  Bot, 
  User, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Database,
  FileText,
  BarChart3,
  Activity,
  Target,
  Zap,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';
// import { cn, formatPercentage } from "@/lib/utils";
// import { AgentAnswer, ChatRequest } from "@/lib/schemas";
// import { fetcher } from "@/lib/fetcher";
import useSWR from "swr";

// Temporary functions
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
type AgentAnswer = any;
type ChatRequest = any;
const fetcher = async (url: string) => fetch(url).then(res => res.json());

export default function AgentChat() {
  const [message, setMessage] = React.useState("");
  const [symbol, setSymbol] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [chatHistory, setChatHistory] = React.useState<Array<{
    request: ChatRequest;
    response: AgentAnswer;
    timestamp: Date;
  }>>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsLoading(true);
    const request: ChatRequest = {
      message: message.trim(),
      symbol: symbol.trim() || undefined,
    };

    try {
      const response = await fetcher<AgentAnswer>("/api/agent/chat", {
        method: "POST",
        body: JSON.stringify(request),
      });

      setChatHistory(prev => [...prev, {
        request,
        response,
        timestamp: new Date(),
      }]);

      setMessage("");
      setSymbol("");
    } catch (error: any) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const latestResponse = chatHistory[chatHistory.length - 1]?.response;

  return (
    <div className="space-y-6">
      {/* Chat Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ask the AI Trading Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex space-x-3">
              <div className="flex-1">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g., What's your view on NVDA today?"
                  className="h-10"
                  disabled={isLoading}
                />
              </div>
              <div className="w-32">
                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="Symbol (optional)"
                  className="h-10"
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" disabled={isLoading || !message.trim()}>
                <Send className="w-4 h-4 mr-2" />
                Ask
              </Button>
            </div>
            <div className="text-xs text-slate-400">
              Ask about market analysis, technical indicators, news sentiment, or portfolio insights
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Chat Response */}
      {latestResponse && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">AI Response</CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant="success" className="text-xs">
                  {formatPercentage(latestResponse.summary.confidence)}
                </Badge>
                <span className="text-xs text-slate-400">
                  {chatHistory[chatHistory.length - 1]?.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
                <TabsTrigger value="news" className="text-xs">News</TabsTrigger>
                <TabsTrigger value="technical" className="text-xs">Technical</TabsTrigger>
                <TabsTrigger value="portfolio" className="text-xs">Portfolio</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4 space-y-4">
                <div className="space-y-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-emerald-400">Confidence</h4>
                      <span className="text-lg font-bold text-emerald-400">
                        {formatPercentage(latestResponse.summary.confidence)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${latestResponse.summary.confidence * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-slate-200 mb-2">Key Points</h4>
                    <ul className="space-y-2">
                      {latestResponse.summary.bullets.map((bullet, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 flex-shrink-0" />
                          <span className="text-sm text-slate-300">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-slate-200 mb-2">Summary</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {latestResponse.summary.answer}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="news" className="mt-4 space-y-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-slate-200 mb-2">News Analysis</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {latestResponse.news.rationale}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-slate-200 mb-2">Sources</h4>
                    <div className="space-y-2">
                      {latestResponse.news.citations.map((citation, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <span className="text-xs text-slate-400">•</span>
                          <a
                            href={citation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                          >
                            <span className="truncate">{citation}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="technical" className="mt-4 space-y-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-slate-200 mb-2">Technical Analysis</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {latestResponse.technical.rationale}
                    </p>
                  </div>

                  {latestResponse.technical.indicators && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-200 mb-2">Indicators</h4>
                      <div className="bg-slate-800 rounded-lg p-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {Object.entries(latestResponse.technical.indicators).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-slate-400 uppercase">{key}</span>
                              <span className="text-slate-200 font-mono">{value.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium text-slate-200 mb-2">Sources</h4>
                    <div className="space-y-2">
                      {latestResponse.technical.citations.map((citation, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <span className="text-xs text-slate-400">•</span>
                          <a
                            href={citation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                          >
                            <span className="truncate">{citation}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="portfolio" className="mt-4 space-y-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-slate-200 mb-2">Portfolio Analysis</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {latestResponse.portfolio.rationale}
                    </p>
                  </div>

                  {latestResponse.portfolio.positions && latestResponse.portfolio.positions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-200 mb-2">Current Positions</h4>
                      <div className="bg-slate-800 rounded-lg p-3">
                        <div className="space-y-2">
                          {latestResponse.portfolio.positions.map((position, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span className="text-slate-300 font-medium">{position.symbol}</span>
                              <div className="flex items-center space-x-4">
                                <span className="text-slate-400">{position.qty} shares</span>
                                <span className="text-slate-200">${position.px.toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium text-slate-200 mb-2">Sources</h4>
                    <div className="space-y-2">
                      {latestResponse.portfolio.citations.map((citation, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <span className="text-xs text-slate-400">•</span>
                          <a
                            href={citation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                          >
                            <span className="truncate">{citation}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Chat History */}
      {chatHistory.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Chat History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {chatHistory.slice(0, -1).reverse().map((chat, index) => (
                <div key={index} className="border-b border-slate-700 pb-3 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">
                      {chat.timestamp.toLocaleTimeString()}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {formatPercentage(chat.response.summary.confidence)}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-300 mb-2">
                    <span className="text-slate-500">Q:</span> {chat.request.message}
                  </p>
                  <p className="text-sm text-slate-300 line-clamp-2">
                    <span className="text-slate-500">A:</span> {chat.response.summary.answer}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
