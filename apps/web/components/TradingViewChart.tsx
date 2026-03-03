import React from "react";
import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";

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
    return (
        <div style={{ height: height, width: width }}>
            <AdvancedRealTimeChart
                symbol={ticker}
                theme={theme}
                autosize
                hide_side_toolbar={false}
                allow_symbol_change={true}
                interval="D"
                timezone="Etc/UTC"
                style="1"
                locale="en"
                enable_publishing={false}
                withdateranges={true}
                studies={[
                    "MASimple@tv-basicstudies",
                    "MASimple@tv-basicstudies",
                    "MASimple@tv-basicstudies",
                    "MACD@tv-basicstudies"
                ]}
                show_popup_button={true}
                popup_width="1000"
                popup_height="650"
            />
        </div>
    );
};
