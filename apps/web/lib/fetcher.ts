export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    let errorDetails;

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
      errorDetails = errorData.details || errorData;
    } catch {
      // If we can't parse the error response, use the status text
      errorMessage = response.statusText || errorMessage;
    }

    throw new ApiError(response.status, errorMessage, errorDetails);
  }

  // Handle empty responses
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }

  return response.text() as T;
}

export function createFetcher<T>(baseUrl: string) {
  return (endpoint: string, options?: RequestInit) =>
    fetcher<T>(`${baseUrl}${endpoint}`, options);
}

// Mock data for when worker is not available
export const mockData = {
  marketMetrics: {
    kpis: {
      breadth: 65.2,
      vix: 18.5,
      daily_pnl: 1247.50,
      exposure: 23.8,
      active_runs: 3,
    },
    series: {
      timestamps: Array.from({ length: 24 }, (_, i) => 
        new Date(Date.now() - (23 - i) * 3600000).toISOString()
      ),
      prices: Array.from({ length: 24 }, () => 100 + Math.random() * 20),
      volumes: Array.from({ length: 24 }, () => 1000000 + Math.random() * 500000),
    },
  },
  sentimentMetrics: {
    overall: 0.68,
    tickers: [
      { symbol: "NVDA", score: 0.75 },
      { symbol: "AAPL", score: 0.62 },
      { symbol: "TSLA", score: 0.45 },
      { symbol: "MSFT", score: 0.82 },
      { symbol: "GOOGL", score: 0.58 },
    ],
  },
  recentSignals: [
    {
      id: "run_1",
      symbol: "NVDA",
      action: "BUY" as const,
      confidence: 0.85,
      ts: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: "run_2",
      symbol: "AAPL",
      action: "SELL" as const,
      confidence: 0.72,
      ts: new Date(Date.now() - 900000).toISOString(),
    },
    {
      id: "run_3",
      symbol: "TSLA",
      action: "FLAT" as const,
      confidence: 0.45,
      ts: new Date(Date.now() - 1800000).toISOString(),
    },
  ],
}; 