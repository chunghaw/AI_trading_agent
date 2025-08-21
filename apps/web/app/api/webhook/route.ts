import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Webhook payload validation schema
const WebhookPayloadSchema = z.object({
  symbol: z.string().min(1).max(10),
  action: z.enum(['BUY', 'SELL', 'FLAT']),
  size_pct: z.number().min(0).max(1),
  idempotency_key: z.string().min(1),
  timestamp: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const validatedPayload = WebhookPayloadSchema.parse(body);
    
    // Add timestamp if not provided
    if (!validatedPayload.timestamp) {
      validatedPayload.timestamp = new Date().toISOString();
    }
    
    // Forward to worker API
    const workerBaseUrl = process.env.WORKER_BASE_URL || 'http://localhost:8000';
    const response = await fetch(`${workerBaseUrl}/proposals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validatedPayload),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { 
          success: false, 
          error: errorData.detail || 'Worker API error',
          status: response.status 
        },
        { status: response.status }
      );
    }
    
    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Webhook processed successfully'
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid payload format',
          details: error.errors 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}
