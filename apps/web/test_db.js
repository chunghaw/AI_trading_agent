require("dotenv").config({ path: ".env.local", override: false });
require("dotenv").config({ path: "../../.env", override: false });
const { Client } = require("pg");

async function run() {
    const client = new Client({
        connectionString: process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    try {
        const base = "SELECT COUNT(*) as cnt FROM gold_ohlcv_daily_metrics WHERE date >= CURRENT_DATE - INTERVAL '60 days'";

        const r1 = await client.query(base);
        console.log("Base count:", r1.rows[0].cnt);

        const r2 = await client.query(base + " AND close > 0");
        console.log("close > 0:", r2.rows[0].cnt);

        const r3 = await client.query(base + " AND total_volume > 0");
        console.log("total_volume > 0:", r3.rows[0].cnt);

        const r4 = await client.query(base + " AND rsi_14 IS NOT NULL");
        console.log("rsi_14 IS NOT NULL:", r4.rows[0].cnt);

        const r5 = await client.query(base + " AND (market IS NULL OR market = 'stocks' OR market = 'etf')");
        console.log("market filter:", r5.rows[0].cnt);

        // Check distribution of 'market' and 'market_cap'
        const markets = await client.query("SELECT market, COUNT(*) FROM gold_ohlcv_daily_metrics GROUP BY market");
        console.log("Markets:", markets.rows);

    } catch (e) { console.error(e); }
    await client.end();
}
run();
