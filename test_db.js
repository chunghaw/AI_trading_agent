require("dotenv").config({ path: "apps/web/.env.local", override: false });
require("dotenv").config({ path: ".env", override: false });
const { Client } = require("pg");

async function run() {
    const url = process.env.POSTGRES_URL;
    if (!url) {
        console.error("No POSTGRES_URL found");
        return;
    }

    const client = new Client({
        connectionString: url,
        ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log("Connected to DB");

    const res = await client.query("SELECT COUNT(*) as cnt, MAX(date) as max_date, MIN(date) as min_date FROM gold_ohlcv_daily_metrics");
    console.log("Overall data:", res.rows[0]);

    const recent = await client.query("SELECT COUNT(*) as cnt FROM gold_ohlcv_daily_metrics WHERE date >= CURRENT_DATE - INTERVAL '60 days'");
    console.log("Recent data (last 60 days):", recent.rows[0]);

    // Check how many have ma_200
    const ma200 = await client.query("SELECT COUNT(*) as cnt FROM gold_ohlcv_daily_metrics WHERE ma_200 IS NOT NULL");
    console.log("Data with MA_200:", ma200.rows[0]);

    await client.end();
}

run().catch(console.error);
