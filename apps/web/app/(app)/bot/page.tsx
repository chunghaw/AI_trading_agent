"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Database,
  Zap,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusItem {
  id: string;
  name: string;
  description: string;
  status: "connected" | "disconnected" | "pending";
  lastCheck: string;
}

const statusItems: StatusItem[] = [
  {
    id: "binance",
    name: "Binance Testnet",
    description: "Exchange connection for order execution",
    status: "connected",
    lastCheck: "2 minutes ago"
  },
  {
    id: "milvus",
    name: "Milvus Vector DB",
    description: "Knowledge base for RAG queries",
    status: "connected",
    lastCheck: "1 minute ago"
  },
  {
    id: "polygon",
    name: "Polygon API",
    description: "Market data and OHLCV feeds",
    status: "disconnected",
    lastCheck: "5 minutes ago"
  },
  {
    id: "worker",
    name: "Worker Service",
    description: "LangGraph orchestration engine",
    status: "pending",
    lastCheck: "Never"
  }
];

export default function BotPage() {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="w-6 h-6 text-[var(--accent)]" />;
      case "disconnected":
        return <XCircle className="w-6 h-6 text-[var(--danger)]" />;
      case "pending":
        return <Clock className="w-6 h-6 text-[var(--muted)]" />;
      default:
        return <XCircle className="w-6 h-6 text-[var(--danger)]" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "disconnected":
        return "Disconnected";
      case "pending":
        return "Pending";
      default:
        return "Unknown";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "text-[var(--accent)]";
      case "disconnected":
        return "text-[var(--danger)]";
      case "pending":
        return "text-[var(--muted)]";
      default:
        return "text-[var(--danger)]";
    }
  };

  return (
    <div className="container max-w-[1200px] mx-auto px-4 py-8 space-y-8">
      {/* Page Title - Bigger and More Prominent */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-[var(--text)] tracking-tight">AI Trading Bot</h1>
        <p className="text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
          System status and configuration
        </p>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statusItems.map((item) => (
              <div key={item.id} className="bg-[var(--panel2)] border border-white/10 rounded-2xl p-6 shadow-sm backdrop-blur-sm">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(item.status)}
                    <div>
                      <h3 className="text-base font-medium text-[var(--text)]">{item.name}</h3>
                      <p className="text-sm text-[var(--muted)] mt-1">{item.description}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <span className={cn("text-sm font-medium", getStatusColor(item.status))}>
                    {getStatusText(item.status)}
                  </span>
                  <span className="text-sm text-[var(--muted)]">
                    {item.lastCheck}
                  </span>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-10 text-sm border-white/10 hover:bg-white/5 hover:border-white/20"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configure
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuration Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[
              {
                title: "Connect Exchange",
                description: "Set up Binance testnet API keys for order execution",
                completed: true,
                icon: <Zap className="w-5 h-5" />
              },
              {
                title: "Configure Risk Limits",
                description: "Set maximum exposure and daily loss limits",
                completed: false,
                icon: <Settings className="w-5 h-5" />
              },
              {
                title: "Enable Auto-Approval",
                description: "Allow automated execution without manual approval",
                completed: false,
                icon: <Bot className="w-5 h-5" />
              },
              {
                title: "Set Up Monitoring",
                description: "Configure alerts and performance tracking",
                completed: false,
                icon: <Database className="w-5 h-5" />
              }
            ].map((item, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2",
                  item.completed 
                    ? "border-[var(--accent)] bg-[var(--accent)]/20" 
                    : "border-white/20 bg-[var(--panel2)]"
                )}>
                  {item.completed ? (
                    <CheckCircle className="w-4 h-4 text-[var(--accent)]" />
                  ) : (
                    <span className="text-sm text-[var(--muted)]">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    {item.icon}
                    <h3 className={cn(
                      "text-base font-medium",
                      item.completed ? "text-[var(--text)]" : "text-[var(--muted)]"
                    )}>
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-sm text-[var(--muted)] mt-1">
                    {item.description}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-10 px-4 text-sm border-white/10 hover:bg-white/5 hover:border-white/20"
                  disabled={item.completed}
                >
                  {item.completed ? "Done" : "Configure"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Coming Soon */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Bot className="w-20 h-20 text-[var(--muted)] mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-[var(--text)] mb-4">
              AI Trading Bot
            </h3>
            <p className="text-base text-[var(--muted)] max-w-md mx-auto leading-relaxed">
              Automated trading with advanced AI agents, real-time market analysis, 
              and intelligent risk management. Coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
