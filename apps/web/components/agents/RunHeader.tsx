"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Clock, Hash } from "lucide-react";
// import { cn, formatTime } from "@/lib/utils";
// import { RunState } from "@/lib/schemas";

// Temporary functions
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
const formatTime = (date: string) => new Date(date).toLocaleTimeString();
type RunState = 'idle' | 'running' | 'completed' | 'failed' | 'paused';

interface RunHeaderProps {
  runState?: RunState;
  onStartRun: (symbol: string, timeframe: string) => void;
  isLoading?: boolean;
}

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

export function RunHeader({ runState, onStartRun, isLoading = false }: RunHeaderProps) {
  const [symbol, setSymbol] = React.useState("NVDA");
  const [timeframe, setTimeframe] = React.useState("1h");

  const handleStartRun = () => {
    if (symbol.trim() && timeframe) {
      onStartRun(symbol.trim().toUpperCase(), timeframe);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleStartRun();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Hash className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Run ID:</span>
              {runState ? (
                <code className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">
                  {runState.run_id.slice(0, 8)}...
                </code>
              ) : (
                <span className="text-sm text-slate-500">No active run</span>
              )}
            </div>
            {runState && (
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">Updated:</span>
                <span className="text-sm text-slate-300">
                  {formatTime(new Date())}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {runState && (
              <Badge variant={runState.status.toLowerCase() as any}>
                {runState.status.replace("_", " ")}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4">
          <div className="flex-1 max-w-xs">
            <label className="text-xs font-medium text-slate-400 mb-1 block">
              Symbol
            </label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., NVDA"
              className="h-9"
            />
          </div>
          <div className="w-32">
            <label className="text-xs font-medium text-slate-400 mb-1 block">
              Timeframe
            </label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((tf) => (
                  <SelectItem key={tf} value={tf}>
                    {tf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="pt-6">
            <Button
              onClick={handleStartRun}
              disabled={isLoading || !symbol.trim()}
              className="h-9"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Run
            </Button>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Press ⌘+Enter to start run • A to approve • R to reject
        </div>
      </CardContent>
    </Card>
  );
}
