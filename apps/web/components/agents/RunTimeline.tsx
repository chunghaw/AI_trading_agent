"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle, XCircle, AlertCircle, Play } from "lucide-react";
// import { cn } from "@/lib/utils";

// Temporary cn function
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface TimelineStep {
  id: string;
  name: string;
  status: "completed" | "current" | "pending" | "failed";
  timestamp?: string;
  duration?: string;
  error?: string;
}

interface RunTimelineProps {
  steps: TimelineStep[];
  title?: string;
}

const getStatusIcon = (status: TimelineStep["status"]) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="w-4 h-4 text-[var(--accent)]" />;
    case "current":
      return <Clock className="w-4 h-4 text-[var(--muted)] animate-pulse" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-[var(--danger)]" />;
    case "pending":
      return <Play className="w-4 h-4 text-[var(--muted)]" />;
    default:
      return <AlertCircle className="w-4 h-4 text-[var(--muted)]" />;
  }
};

const getStatusColor = (status: TimelineStep["status"]) => {
  switch (status) {
    case "completed":
      return "border-[var(--accent)]/30 bg-[var(--accent)]/20 text-[var(--accent)]";
    case "current":
      return "border-[var(--muted)]/30 bg-[var(--muted)]/20 text-[var(--muted)]";
    case "failed":
      return "border-[var(--danger)]/30 bg-[var(--danger)]/20 text-[var(--danger)]";
    case "pending":
      return "border-[var(--muted)]/30 bg-[var(--muted)]/20 text-[var(--muted)]";
    default:
      return "border-[var(--muted)]/30 bg-[var(--muted)]/20 text-[var(--muted)]";
  }
};

export default function RunTimeline({ steps, title = "Workflow Timeline" }: RunTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start space-x-4">
              {/* Status Icon */}
              <div className="flex-shrink-0 mt-1">
                {getStatusIcon(step.status)}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-[var(--text)]">
                    {step.name}
                  </h4>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      getStatusColor(step.status)
                    )}
                  >
                    {step.status}
                  </Badge>
                </div>
                
                {/* Timestamp and Duration */}
                {(step.timestamp || step.duration) && (
                  <div className="flex items-center space-x-4 mt-1">
                    {step.timestamp && (
                      <span className="text-xs text-[var(--muted)]">
                        {step.timestamp}
                      </span>
                    )}
                    {step.duration && (
                      <span className="text-xs text-[var(--muted)]">
                        {step.duration}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Error Message */}
                {step.error && (
                  <p className="text-xs text-[var(--danger)] mt-1">
                    {step.error}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
