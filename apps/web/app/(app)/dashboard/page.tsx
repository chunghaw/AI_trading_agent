"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="container max-w-[1200px] mx-auto px-4 py-8 space-y-8">
      {/* Page Title */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-[var(--text)] tracking-tight">Dashboard</h1>
        <p className="text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
          Live market metrics and trading insights
        </p>
      </div>

      {/* Simple Dashboard Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Market Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--text)]">
                $1,234,567
              </div>
              <div className="text-sm text-[var(--muted)]">Total Value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">
                +$12,345
              </div>
              <div className="text-sm text-[var(--muted)]">Daily Change</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--text)]">
                5
              </div>
              <div className="text-sm text-[var(--muted)]">Active Symbols</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coming Soon Message */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Advanced Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-lg text-[var(--muted)] mb-4">
              Advanced dashboard features coming soon!
            </p>
            <p className="text-sm text-[var(--muted)]">
              This will include real-time market data, technical indicators, and portfolio analytics.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}