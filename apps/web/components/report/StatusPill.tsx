import React from 'react';

interface StatusPillProps {
  status: "Positive" | "Balanced" | "Adverse" | "Constructive" | "Neutral" | "Weak" | "Green" | "Amber" | "Red";
  className?: string;
}

export function StatusPill({ status, className = "" }: StatusPillProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "Positive":
      case "Constructive":
      case "Green":
        return {
          bgColor: "bg-green-900/30",
          borderColor: "border-green-500/50",
          textColor: "text-green-400",
          dotColor: "bg-green-500"
        };
      case "Balanced":
      case "Neutral":
      case "Amber":
        return {
          bgColor: "bg-amber-900/30",
          borderColor: "border-amber-500/50",
          textColor: "text-amber-400",
          dotColor: "bg-amber-500"
        };
      case "Adverse":
      case "Weak":
      case "Red":
        return {
          bgColor: "bg-red-900/30",
          borderColor: "border-red-500/50",
          textColor: "text-red-400",
          dotColor: "bg-red-500"
        };
      default:
        return {
          bgColor: "bg-zinc-900/30",
          borderColor: "border-zinc-500/50",
          textColor: "text-zinc-400",
          dotColor: "bg-zinc-500"
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.bgColor} ${config.borderColor} ${className}`}>
      <div className={`w-2 h-2 rounded-full ${config.dotColor}`}></div>
      <span className={`text-sm font-medium ${config.textColor}`}>
        {status}
      </span>
    </div>
  );
}
