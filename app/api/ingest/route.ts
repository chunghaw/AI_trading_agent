import { NextRequest, NextResponse } from "next/server";
// import { triggerDataIngestion } from "@/lib/data-ingestion";

// Temporary functions
const triggerDataIngestion = async () => ({ success: true });

export async function POST(request: NextRequest) {
  try {
    console.log('Starting data ingestion process...');
    
    // Trigger the data ingestion
    await triggerDataIngestion();
    
    return NextResponse.json({
      success: true,
      message: "Data ingestion completed successfully",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Data ingestion error:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to ingest data",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Data ingestion endpoint. Use POST to trigger ingestion.",
    timestamp: new Date().toISOString()
  });
}
