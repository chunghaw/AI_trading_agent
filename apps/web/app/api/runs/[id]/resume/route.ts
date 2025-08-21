import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Zod schema for resume request validation
const ResumeRequestSchema = z.object({
  command: z.enum(['approve', 'reject']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const runId = params.id;
    
    if (!runId) {
      return NextResponse.json(
        { error: 'Run ID is required' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    // Validate request body
    const validatedBody = ResumeRequestSchema.parse(body);
    
    const workerUrl = process.env.WORKER_BASE_URL || 'http://localhost:7070';
    
    // Forward idempotency header if present
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    const idempotencyKey = request.headers.get('x-idempotency-key');
    if (idempotencyKey) {
      headers['x-idempotency-key'] = idempotencyKey;
    }
    
    const response = await fetch(`${workerUrl}/runs/${runId}/resume`, {
      method: 'POST',
      headers,
      body: JSON.stringify(validatedBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { 
          error: 'Worker API error',
          details: errorData 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error.errors 
        },
        { status: 400 }
      );
    }
    
    console.error('Resume run API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
