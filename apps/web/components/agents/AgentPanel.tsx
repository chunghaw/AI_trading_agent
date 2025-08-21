"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Activity, 
  Target, 
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
// import { cn, getActionColor, formatPercentage } from "@/lib/utils";
// import { Opinion } from "@/lib/schemas";

// Temporary functions
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
const getActionColor = (action: string) => {
  switch (action.toLowerCase()) {
    case 'buy': return 'text-emerald-400';
    case 'sell': return 'text-red-400';
    case 'hold': return 'text-yellow-400';
    default: return 'text-gray-400';
  }
};
const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
type Opinion = any;

interface AgentPanelProps {
  title: string;
  icon: React.ReactNode;
  opinion?: Opinion;
  isLoading?: boolean;
  className?: string;
}

export function AgentPanel({
  title,
  icon,
  opinion,
  isLoading = false,
  className,
}: AgentPanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 bg-slate-600 rounded" />
            <div className="h-5 bg-slate-600 rounded w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 bg-slate-600 rounded w-3/4" />
            <div className="h-4 bg-slate-600 rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!opinion) {
    return (
      <Card className={cn("opacity-50", className)}>
        <CardHeader>
          <div className="flex items-center space-x-2">
            {icon}
            <CardTitle className="text-sm">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 text-sm">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <CardTitle className="text-sm">{title}</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge
              variant={opinion.action === "BUY" ? "success" : opinion.action === "SELL" ? "destructive" : "secondary"}
              className="text-xs"
            >
              {opinion.action}
            </Badge>
            <span className={cn("text-sm font-medium", getActionColor(opinion.action))}>
              {formatPercentage(opinion.score)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-slate-300 leading-relaxed">
            {opinion.rationale}
          </p>
        </div>

        {opinion.red_flags && opinion.red_flags.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-rose-400 uppercase tracking-wide">
              Red Flags
            </h4>
            <ul className="space-y-1">
              {opinion.red_flags.map((flag, index) => (
                <li key={index} className="text-xs text-rose-300 flex items-start space-x-2">
                  <span className="w-1 h-1 bg-rose-400 rounded-full mt-2 flex-shrink-0" />
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {opinion.citations && opinion.citations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Sources ({opinion.citations.length})
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 px-2"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </Button>
            </div>
            {isExpanded && (
              <div className="space-y-1">
                {opinion.citations.map((citation, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400">•</span>
                    <a
                      href={citation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                    >
                      <span className="truncate">{citation}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
            <TabsTrigger value="json" className="text-xs">JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="mt-2">
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Action:</span>
                  <span className={cn("ml-2 font-medium", getActionColor(opinion.action))}>
                    {opinion.action}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Confidence:</span>
                  <span className="ml-2 font-medium text-slate-200">
                    {formatPercentage(opinion.score)}
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="json" className="mt-2">
            <div className="bg-slate-800 rounded-lg p-3">
              <pre className="text-xs text-slate-300 overflow-auto">
                {JSON.stringify(opinion, null, 2)}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
