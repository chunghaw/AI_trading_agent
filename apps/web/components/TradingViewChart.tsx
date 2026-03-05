"use client";

import React, { useEffect, useRef } from "react";

interface TradingViewChartProps {
    ticker: string;
    theme?: "light" | "dark";
    height?: number | string;
    width?: number | string;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
    ticker,
    theme = "dark",
    height = "100%",
    width = "100%",
}) => {
    const containerId = "tv_chart_" + ticker.replace(/[^a-zA-Z0-9]/g, "");
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Find existing script and remove to avoid duplicates on re-render
        if (containerRef.current) {
            containerRef.current.innerHTML = "";
        }

        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = () => {
            if (typeof window !== "undefined" && (window as any).TradingView) {
                new (window as any).TradingView.widget({
                    autosize: true,
                    symbol: ticker,
                    interval: "D",
                    timezone: "Etc/UTC",
                    theme: theme,
                    style: "1",
                    locale: "en",
                    enable_publishing: false,
                    allow_symbol_change: true,
                    hide_side_toolbar: false,
                    container_id: containerId,
                    withdateranges: true,
                    show_events: true, // Enables Earnings and Dividend markers on chart axis
                    show_popup_button: true,
                    popup_width: "1000",
                    popup_height: "650",
                    studies: [
                        { id: "MAWeighted@tv-basicstudies", inputs: { length: 20 } }, // For Orange
                        { id: "MAExp@tv-basicstudies", inputs: { length: 50 } },      // For Blue
                        { id: "MASimple@tv-basicstudies", inputs: { length: 200 } },  // For Red
                        { id: "MACD@tv-basicstudies" }
                    ],
                    studies_overrides: {
                        "MAWeighted@tv-basicstudies.plot.color": "#FFEB3B", // Yellow MA 20
                        "MAExp@tv-basicstudies.plot.color": "#2196F3",      // Blue MA 50
                        "MASimple@tv-basicstudies.plot.color": "#F44336",   // Red MA 200
                        "MACD@tv-basicstudies.MACD.color": "#2196F3",
                        "MACD@tv-basicstudies.Signal.color": "#FFEB3B",
                    },
                });
            }
        };

        if (containerRef.current) {
            containerRef.current.appendChild(script);
        }

        return () => {
            if (containerRef.current) containerRef.current.innerHTML = "";
        };
    }, [ticker, theme, containerId]);

    return (
        <div style={{ height, width }}>
            <div id={containerId} ref={containerRef} style={{ height: "100%", width: "100%" }} />
        </div>
    );
};
