// Test script to verify database connection
const { Pool } = require('pg');

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  // Check environment variables
  console.log('Environment variables:');
  console.log('POSTGRES_URL:', process.env.POSTGRES_URL || 'NOT SET');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
  
  if (!process.env.POSTGRES_URL) {
    console.log('❌ POSTGRES_URL environment variable is not set');
    console.log('Please set it with your Vercel Postgres connection string');
    return;
  }
  
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    console.log('🔗 Attempting to connect to database...');
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    // Test query to check if silver_ohlcv table exists
    console.log('📊 Testing silver_ohlcv table...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'silver_ohlcv'
      );
    `);
    
    console.log('silver_ohlcv table exists:', tableCheck.rows[0].exists);
    
    if (tableCheck.rows[0].exists) {
      // Check if there's NVDA data
      console.log('🔍 Checking for NVDA data...');
      const nvdaData = await client.query(`
        SELECT COUNT(*) as count, 
               MIN(date) as earliest_date, 
               MAX(date) as latest_date
        FROM silver_ohlcv 
        WHERE symbol = 'NVDA'
      `);
      
      console.log('NVDA data:', nvdaData.rows[0]);
      
      // Get sample data
      const sampleData = await client.query(`
        SELECT date, open, high, low, close, volume 
        FROM silver_ohlcv 
        WHERE symbol = 'NVDA' 
        ORDER BY date DESC 
        LIMIT 5
      `);
      
      console.log('Sample NVDA data:');
      sampleData.rows.forEach(row => {
        console.log(`  ${row.date}: O:${row.open} H:${row.high} L:${row.low} C:${row.close} V:${row.volume}`);
      });
    }
    
    client.release();
    await pool.end();
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Error details:', error);
  }
}

testDatabaseConnection();
