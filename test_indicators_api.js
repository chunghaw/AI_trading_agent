// Simple test script to debug the indicators API
const { Client } = require('pg');

async function testIndicators() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL || 'postgresql://neondb_owner:npg_GhSFKa2wf8vb@ep-billowing-waterfall-a76q5go4-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const symbols = ['SPY', 'QQQ', 'DIA', 'VIXY'];
    
    for (const symbol of symbols) {
      const query = `
        SELECT 
          close,
          last_close as prev_close,
          date,
          COALESCE(change_pct, 0) as change_percent,
          (close - last_close) as change
        FROM gold_ohlcv_daily_metrics
        WHERE symbol = $1
          AND date >= CURRENT_DATE - INTERVAL '30 days'
          AND close > 0
        ORDER BY date DESC
        LIMIT 1
      `;

      const result = await client.query(query, [symbol]);
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        console.log(`${symbol}: Close=$${row.close}, Last=$${row.prev_close}, Change=${row.change_percent}%`);
      } else {
        console.log(`${symbol}: No data found`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testIndicators();
