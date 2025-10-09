require('dotenv').config();
const { Pool } = require('pg');

async function testDataRetention() {
  console.log('🔍 DATA RETENTION TEST');
  console.log('======================');
  
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    
    // Check Silver table data retention
    console.log('\n📊 SILVER TABLE DATA RETENTION:');
    const silverStats = await pool.query(`
      SELECT 
        symbol,
        COUNT(*) as total_days,
        MIN(date) as earliest_date,
        MAX(date) as latest_date,
        (MAX(date) - MIN(date)) as date_range_days
      FROM silver_ohlcv 
      GROUP BY symbol 
      ORDER BY total_days DESC 
      LIMIT 10
    `);
    
    console.log('Top 10 symbols in Silver table:');
    silverStats.rows.forEach(row => {
      console.log(`  ${row.symbol}: ${row.total_days} days (${row.earliest_date} to ${row.latest_date}) - Range: ${row.date_range_days} days`);
    });
    
    // Check Gold table data retention
    console.log('\n📊 GOLD TABLE DATA RETENTION:');
    const goldStats = await pool.query(`
      SELECT 
        symbol,
        COUNT(*) as total_records,
        MIN(date) as earliest_date,
        MAX(date) as latest_date,
        (MAX(date) - MIN(date)) as date_range_days
      FROM gold_ohlcv_daily_metrics 
      GROUP BY symbol 
      ORDER BY total_records DESC 
      LIMIT 10
    `);
    
    console.log('Top 10 symbols in Gold table:');
    goldStats.rows.forEach(row => {
      console.log(`  ${row.symbol}: ${row.total_records} records (${row.earliest_date} to ${row.latest_date}) - Range: ${row.date_range_days} days`);
    });
    
    // Check specific symbols for 300+ days requirement
    console.log('\n🎯 300+ DAYS REQUIREMENT CHECK:');
    const testSymbols = ['NVDA', 'AAPL', 'GOOGL', 'MSFT', 'TSLA'];
    
    for (const symbol of testSymbols) {
      // Silver table check
      const silverCheck = await pool.query(`
        SELECT COUNT(*) as days, MIN(date) as start, MAX(date) as end
        FROM silver_ohlcv 
        WHERE symbol = $1
      `, [symbol]);
      
      // Gold table check  
      const goldCheck = await pool.query(`
        SELECT COUNT(*) as records, MIN(date) as start, MAX(date) as end
        FROM gold_ohlcv_daily_metrics 
        WHERE symbol = $1
      `, [symbol]);
      
      const silverDays = parseInt(silverCheck.rows[0].days);
      const goldRecords = parseInt(goldCheck.rows[0].records);
      
      console.log(`\n${symbol}:`);
      console.log(`  Silver: ${silverDays} days (${silverCheck.rows[0].start} to ${silverCheck.rows[0].end})`);
      console.log(`  Gold: ${goldRecords} records (${goldCheck.rows[0].start} to ${goldCheck.rows[0].end})`);
      
      if (silverDays >= 300) {
        console.log(`  ✅ Silver: Meets 300+ days requirement`);
      } else {
        console.log(`  ❌ Silver: Only ${silverDays} days (need 300+)`);
      }
      
      if (goldRecords >= 1) {
        console.log(`  ✅ Gold: Has latest aggregated data`);
      } else {
        console.log(`  ❌ Gold: No data found`);
      }
    }
    
    // Overall summary
    console.log('\n📈 SUMMARY:');
    const totalSilver = await pool.query('SELECT COUNT(DISTINCT symbol) FROM silver_ohlcv');
    const totalGold = await pool.query('SELECT COUNT(DISTINCT symbol) FROM gold_ohlcv_daily_metrics');
    
    console.log(`Total symbols in Silver: ${totalSilver.rows[0].count}`);
    console.log(`Total symbols in Gold: ${totalGold.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      syscall: error.syscall
    });
  } finally {
    await pool.end();
  }
}

testDataRetention();

