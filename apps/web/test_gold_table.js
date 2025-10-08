require('dotenv').config();
const { Pool } = require('pg');

async function testGoldTable() {
  console.log('Testing Gold Table Data...');
  console.log('POSTGRES_URL:', process.env.POSTGRES_URL ? 'SET' : 'NOT SET');
  
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Test connection
    console.log('Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful!');
    
    // Check if gold table exists
    console.log('Checking if gold_ohlcv_daily_metrics table exists...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'gold_ohlcv_daily_metrics'
      );
    `);
    console.log('Gold table exists:', tableCheck.rows[0].exists);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Gold table does not exist!');
      return;
    }
    
    // Check total records in gold table
    const countResult = await pool.query('SELECT COUNT(*) FROM gold_ohlcv_daily_metrics');
    console.log('Total records in gold table:', countResult.rows[0].count);
    
    // Check symbols in gold table
    const symbolsResult = await pool.query(`
      SELECT symbol, COUNT(*) as count 
      FROM gold_ohlcv_daily_metrics 
      GROUP BY symbol 
      ORDER BY count DESC 
      LIMIT 10
    `);
    console.log('Top 10 symbols in gold table:');
    symbolsResult.rows.forEach(row => {
      console.log(`  ${row.symbol}: ${row.count} records`);
    });
    
    // Check NVDA specifically
    console.log('Checking NVDA data...');
    const nvdaResult = await pool.query(`
      SELECT 
        symbol, date, close, volume,
        rsi_14, ma_20, ma_50, ma_200,
        ema_20, ema_50, ema_200,
        macd_line, macd_signal, macd_histogram,
        vwap, atr_14,
        company_name, market, stock_type
      FROM gold_ohlcv_daily_metrics 
      WHERE symbol = 'NVDA'
      ORDER BY date DESC
      LIMIT 1
    `);
    
    if (nvdaResult.rows.length > 0) {
      console.log('✅ NVDA data found:');
      console.log(JSON.stringify(nvdaResult.rows[0], null, 2));
    } else {
      console.log('❌ No NVDA data found in gold table!');
      
      // Check if there are similar symbols
      const similarResult = await pool.query(`
        SELECT DISTINCT symbol 
        FROM gold_ohlcv_daily_metrics 
        WHERE symbol ILIKE '%NVDA%' OR symbol ILIKE '%NVIDIA%'
      `);
      console.log('Similar symbols found:', similarResult.rows.map(r => r.symbol));
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

testGoldTable();
