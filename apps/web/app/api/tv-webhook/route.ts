import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Zod schema for TradingView webhook payload
const TradingViewWebhookSchema = z.object({
  symbol: z.string().min(1).max(10),
  action: z.enum(['BUY', 'SELL', 'FLAT']),
  size_pct: z.number().min(0.01).max(1.0),
  price: z.number().optional(),
  strategy: z.string().optional(),
  timeframe: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  timestamp: z.number().optional(),
  idempotency_key: z.string().min(1).max(100),
});

type TradingViewWebhookPayload = z.infer<typeof TradingViewWebhookSchema>;

// HMAC validation function
function validateHMAC(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return true; // Skip if not configured
  
  try {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('HMAC validation error:', error);
    return false;
  }
}

// In-memory idempotency store (use Redis in production)
const processedKeys = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    // Check Bearer token
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.TV_WEBHOOK_SECRET;
    
    if (!expectedSecret) {
      console.warn('TV_WEBHOOK_SECRET not configured, skipping auth');
    } else if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    } else {
      const token = authHeader.substring(7);
      if (token !== expectedSecret) {
        return NextResponse.json(
          { error: 'Invalid authorization token' },
          { status: 401 }
        );
      }
    }

    // Get raw body for HMAC validation
    const rawBody = await request.text();
    
    // Check HMAC signature if configured
    const hmacSecret = process.env.TV_HMAC_SECRET;
    const hmacSignature = request.headers.get('x-tv-signature');
    
    if (hmacSecret && hmacSignature) {
      if (!validateHMAC(rawBody, hmacSignature, hmacSecret)) {
        return NextResponse.json(
          { error: 'Invalid HMAC signature' },
          { status: 401 }
        );
      }
    }

    // Parse and validate payload
    let payload: TradingViewWebhookPayload;
    try {
      payload = TradingViewWebhookSchema.parse(JSON.parse(rawBody));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: 'Invalid payload format',
            details: error.errors 
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Check idempotency
    if (processedKeys.has(payload.idempotency_key)) {
      return NextResponse.json(
        { 
          error: 'Duplicate request',
          idempotency_key: payload.idempotency_key 
        },
        { status: 409 }
      );
    }

    // Add to processed keys (in production, use Redis with TTL)
    processedKeys.add(payload.idempotency_key);

    // Forward to worker API
    const workerUrl = process.env.WORKER_BASE_URL || 'http://localhost:8000';
    const workerResponse = await fetch(`${workerUrl}/proposals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol: payload.symbol,
        action: payload.action,
        size_pct: payload.size_pct,
        idempotency_key: payload.idempotency_key,
        metadata: {
          source: 'tradingview',
          strategy: payload.strategy,
          timeframe: payload.timeframe,
          confidence: payload.confidence,
          price: payload.price,
          timestamp: payload.timestamp,
        }
      }),
    });

    if (!workerResponse.ok) {
      const errorData = await workerResponse.json().catch(() => ({}));
      return NextResponse.json(
        { 
          error: 'Worker API error',
          details: errorData 
        },
        { status: workerResponse.status }
      );
    }

    const result = await workerResponse.json();
    
    return NextResponse.json({
      success: true,
      message: 'TradingView webhook processed successfully',
      proposal_id: result.proposal_id,
      status: result.status,
    });

  } catch (error) {
    console.error('TradingView webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'TradingView webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
