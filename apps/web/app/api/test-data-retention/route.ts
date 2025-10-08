import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    console.log("🔍 DATA RETENTION TEST");
    
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {}
    };
    
    try {
      // Test connection
      await pool.query('SELECT 1');
      results.tests.connection = { status: 'SUCCESS', message: 'Database connection successful' };
      
      // Check Silver table data retention
      console.log("📊 Checking Silver table data retention...");
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
      
      results.tests.silverTable = {
        status: 'SUCCESS',
        topSymbols: silverStats.rows,
        summary: {
          symbolsWithData: silverStats.rows.length,
          symbolsWith300PlusDays: silverStats.rows.filter((r: any) => parseInt(r.total_days) >= 300).length
        }
      };
      
      // Check Gold table data retention
      console.log("📊 Checking Gold table data retention...");
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
      
      results.tests.goldTable = {
        status: 'SUCCESS',
        topSymbols: goldStats.rows,
        summary: {
          symbolsWithData: goldStats.rows.length,
          symbolsWithLatestData: goldStats.rows.filter((r: any) => parseInt(r.total_records) >= 1).length
        }
      };
      
      // Check specific symbols for 300+ days requirement
      console.log("🎯 Testing 300+ days requirement...");
      const testSymbols = ['NVDA', 'AAPL', 'GOOGL', 'MSFT', 'TSLA'];
      const symbolTests: any = {};
      
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
        
        symbolTests[symbol] = {
          silver: {
            days: silverDays,
            startDate: silverCheck.rows[0].start,
            endDate: silverCheck.rows[0].end,
            meets300DaysRequirement: silverDays >= 300
          },
          gold: {
            records: goldRecords,
            startDate: goldCheck.rows[0].start,
            endDate: goldCheck.rows[0].end,
            hasLatestData: goldRecords >= 1
          }
        };
      }
      
      results.tests.symbolTests = symbolTests;
      
      // Overall summary
      console.log("📈 Getting overall summary...");
      const totalSilver = await pool.query('SELECT COUNT(DISTINCT symbol) as count FROM silver_ohlcv');
      const totalGold = await pool.query('SELECT COUNT(DISTINCT symbol) as count FROM gold_ohlcv_daily_metrics');
      
      results.tests.summary = {
        totalSilverSymbols: parseInt(totalSilver.rows[0].count),
        totalGoldSymbols: parseInt(totalGold.rows[0].count),
        symbolsMeeting300DaysRequirement: Object.values(symbolTests).filter((s: any) => s.silver.meets300DaysRequirement).length
      };
      
      await pool.end();
      
      return NextResponse.json({
        success: true,
        ...results
      });
      
    } catch (error: any) {
      await pool.end();
      throw error;
    }
    
  } catch (error: any) {
    console.error("❌ Data retention test failed:", error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      errorCode: error.code,
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'NOT SET',
        POSTGRES_URL_SET: !!process.env.POSTGRES_URL
      }
    }, { status: 500 });
  }
}
