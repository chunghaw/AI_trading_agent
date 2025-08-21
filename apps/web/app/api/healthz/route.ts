import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check web app health
    const webHealth = {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
    
    // Check worker API health
    const workerBaseUrl = process.env.WORKER_BASE_URL || 'http://localhost:8000';
    let workerHealth = null;
    let workerError = null;
    
    try {
      const workerResponse = await fetch(`${workerBaseUrl}/healthz`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (workerResponse.ok) {
        workerHealth = await workerResponse.json();
      } else {
        workerError = `Worker API returned ${workerResponse.status}`;
      }
    } catch (error) {
      workerError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    const responseTime = Date.now() - startTime;
    
    // Determine overall health
    const overallStatus = workerHealth && !workerError ? 'healthy' : 'degraded';
    
    return NextResponse.json({
      status: overallStatus,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString(),
      components: {
        web: webHealth,
        worker: workerHealth || { status: 'unhealthy', error: workerError }
      }
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        response_time_ms: responseTime,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
