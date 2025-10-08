require('dotenv').config();
const { Pool } = require('pg');

async function testDatabaseComprehensive() {
  console.log('🔍 COMPREHENSIVE DATABASE TEST');
  console.log('================================');
  
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Test 1: Basic connection
    console.log('\n1️⃣ Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    
    // Test 2: Check if all required tables exist
    console.log('\n2️⃣ Checking required tables...');
    const tables = ['gold_ohlcv_daily_metrics', 'silver_ohlcv', 'company_info_cache'];
    const tableChecks = {};
    
    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      tableChecks[table] = result.rows[0].exists;
      console.log(`${table}: ${result.rows[0].exists ? '✅ EXISTS' : '❌ MISSING'}`);
    }
    
    // Test 3: Gold table data quality
    if (tableChecks.gold_ohlcv_daily_metrics) {
      console.log('\n3️⃣ Gold Table Analysis...');
      
      // Count total records
      const countResult = await pool.query('SELECT COUNT(*) FROM gold_ohlcv_daily_metrics');
      console.log(`Total records: ${countResult.rows[0].count}`);
      
      // Check symbols
      const symbolsResult = await pool.query(`
        SELECT symbol, COUNT(*) as count, MAX(date) as latest_date
        FROM gold_ohlcv_daily_metrics 
        GROUP BY symbol 
        ORDER BY count DESC 
        LIMIT 10
      `);
      console.log('\nTop 10 symbols:');
      symbolsResult.rows.forEach(row => {
        console.log(`  ${row.symbol}: ${row.count} records, latest: ${row.latest_date}`);
      });
      
      // Test specific symbols
      const testSymbols = ['NVDA', 'AAPL', 'GOOGL', 'MSFT', 'TSLA'];
      console.log('\nTesting specific symbols:');
      
      for (const symbol of testSymbols) {
        const result = await pool.query(`
          SELECT 
            symbol, date, close, volume,
            rsi_14, ma_20, ma_50, ma_200,
            ema_20, ema_50, ema_200,
            macd_line, macd_signal, macd_histogram,
            vwap, atr_14,
            company_name, market, stock_type
          FROM gold_ohlcv_daily_metrics 
          WHERE symbol = $1
          ORDER BY date DESC
          LIMIT 1
        `, [symbol]);
        
        if (result.rows.length > 0) {
          const data = result.rows[0];
          console.log(`\n📊 ${symbol}:`);
          console.log(`  Date: ${data.date}`);
          console.log(`  Close: ${data.close}`);
          console.log(`  RSI: ${data.rsi_14}`);
          console.log(`  EMA20: ${data.ema_20}`);
          console.log(`  EMA50: ${data.ema_50}`);
          console.log(`  EMA200: ${data.ema_200}`);
          console.log(`  MA20: ${data.ma_20}`);
          console.log(`  MA50: ${data.ma_50}`);
          console.log(`  MA200: ${data.ma_200}`);
          console.log(`  MACD: ${data.macd_line}`);
          console.log(`  VWAP: ${data.vwap}`);
          console.log(`  ATR: ${data.atr_14}`);
          console.log(`  Company: ${data.company_name}`);
          
          // Check for NULL values
          const nullFields = [];
          if (data.rsi_14 === null) nullFields.push('rsi_14');
          if (data.ema_20 === null) nullFields.push('ema_20');
          if (data.ema_50 === null) nullFields.push('ema_50');
          if (data.ema_200 === null) nullFields.push('ema_200');
          if (data.ma_20 === null) nullFields.push('ma_20');
          if (data.ma_50 === null) nullFields.push('ma_50');
          if (data.ma_200 === null) nullFields.push('ma_200');
          if (data.atr_14 === null) nullFields.push('atr_14');
          
          if (nullFields.length > 0) {
            console.log(`  ⚠️  NULL values: ${nullFields.join(', ')}`);
          } else {
            console.log(`  ✅ All indicators have values`);
          }
        } else {
          console.log(`❌ ${symbol}: No data found`);
        }
      }
      
      // Check data quality
      console.log('\n4️⃣ Data Quality Checks...');
      
      // Check for NULL indicators
      const nullCheck = await pool.query(`
        SELECT 
          symbol,
          CASE WHEN rsi_14 IS NULL THEN 'rsi_14' END as null_rsi,
          CASE WHEN ema_20 IS NULL THEN 'ema_20' END as null_ema20,
          CASE WHEN ema_50 IS NULL THEN 'ema_50' END as null_ema50,
          CASE WHEN ema_200 IS NULL THEN 'ema_200' END as null_ema200,
          CASE WHEN ma_20 IS NULL THEN 'ma_20' END as null_ma20,
          CASE WHEN ma_50 IS NULL THEN 'ma_50' END as null_ma50,
          CASE WHEN ma_200 IS NULL THEN 'ma_200' END as null_ma200,
          CASE WHEN atr_14 IS NULL THEN 'atr_14' END as null_atr
        FROM gold_ohlcv_daily_metrics 
        WHERE symbol IN ('NVDA', 'AAPL', 'GOOGL', 'MSFT', 'TSLA')
        ORDER BY symbol
      `);
      
      console.log('NULL indicator check:');
      nullCheck.rows.forEach(row => {
        const nulls = [];
        if (row.null_rsi) nulls.push('RSI');
        if (row.null_ema20) nulls.push('EMA20');
        if (row.null_ema50) nulls.push('EMA50');
        if (row.null_ema200) nulls.push('EMA200');
        if (row.null_ma20) nulls.push('MA20');
        if (row.null_ma50) nulls.push('MA50');
        if (row.null_ma200) nulls.push('MA200');
        if (row.null_atr) nulls.push('ATR');
        
        if (nulls.length > 0) {
          console.log(`  ❌ ${row.symbol}: Missing ${nulls.join(', ')}`);
        } else {
          console.log(`  ✅ ${row.symbol}: All indicators present`);
        }
      });
    }
    
    // Test 4: Silver table check
    if (tableChecks.silver_ohlcv) {
      console.log('\n5️⃣ Silver Table Analysis...');
      const silverCount = await pool.query('SELECT COUNT(*) FROM silver_ohlcv');
      console.log(`Silver table records: ${silverCount.rows[0].count}`);
      
      const silverSymbols = await pool.query(`
        SELECT symbol, COUNT(*) as count, MIN(date) as earliest, MAX(date) as latest
        FROM silver_ohlcv 
        GROUP BY symbol 
        ORDER BY count DESC 
        LIMIT 5
      `);
      
      console.log('Silver table symbols:');
      silverSymbols.rows.forEach(row => {
        console.log(`  ${row.symbol}: ${row.count} records (${row.earliest} to ${row.latest})`);
      });
    }
    
    // Test 5: Company info cache
    if (tableChecks.company_info_cache) {
      console.log('\n6️⃣ Company Info Cache Analysis...');
      const companyCount = await pool.query('SELECT COUNT(*) FROM company_info_cache');
      console.log(`Company records: ${companyCount.rows[0].count}`);
      
      const companySample = await pool.query(`
        SELECT symbol, name, market, type, exchange, currency, total_employees
        FROM company_info_cache 
        WHERE symbol IN ('NVDA', 'AAPL', 'GOOGL', 'MSFT', 'TSLA')
        ORDER BY symbol
      `);
      
      console.log('Company info sample:');
      companySample.rows.forEach(row => {
        console.log(`  ${row.symbol}: ${row.name} (${row.market}/${row.type}/${row.exchange})`);
      });
    }
    
    console.log('\n✅ Database test completed');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      hostname: error.hostname,
      port: error.port
    });
  } finally {
    await pool.end();
  }
}

testDatabaseComprehensive();
