import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(date));
}

export function formatTime(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(date));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatPercentage(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function getStatusColor(status: string) {
  switch (status) {
    case "PENDING":
      return "text-amber-400";
    case "WAITING_APPROVAL":
      return "text-blue-400";
    case "EXECUTED":
      return "text-emerald-400";
    case "REJECTED":
      return "text-rose-400";
    case "FAILED":
      return "text-slate-400";
    default:
      return "text-slate-400";
  }
}

export function getActionColor(action: string) {
  switch (action) {
    case "BUY":
      return "text-emerald-400";
    case "SELL":
      return "text-rose-400";
    case "FLAT":
      return "text-slate-400";
    default:
      return "text-slate-400";
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
