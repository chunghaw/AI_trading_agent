"""FastAPI endpoints for LangGraph trading agent."""

import os
import uuid
from typing import Dict, Any
import structlog
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from .schemas import RunRequest, ResumeRequest, RunResponse, ErrorResponse, State
from .graph import create_run, start_run, resume_run, get_run_state

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Create FastAPI app
app = FastAPI(
    title="LangGraph Trading Agent API",
    description="AI-powered trading agent with human-in-the-loop approval",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/runs", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
async def create_trading_run(request: RunRequest) -> RunResponse:
    """
    Create and start a new trading run.
    
    Args:
        request: Run request with symbol and timeframe
    
    Returns:
        Run response with ID and initial state
    """
    try:
        logger.info("Creating trading run", symbol=request.symbol, timeframe=request.timeframe)
        
        # Create a simple run ID
        run_id = str(uuid.uuid4())
        
        # Create initial state directly
        from .schemas import State
        initial_state = State(
            run_id=run_id,
            symbol=request.symbol.upper(),
            timeframe=request.timeframe,
            status="PENDING"
        )
        
        logger.info("Created initial state", run_id=run_id, symbol=request.symbol)
        
        # Run the workflow directly
        try:
            # Step 1: Technical analysis
            logger.info("Running technical analysis", run_id=run_id)
            from .nodes.technical import technical_node
            state = technical_node(initial_state)
            
            # Step 2: News analysis
            logger.info("Running news analysis", run_id=run_id)
            from .nodes.news import news_node
            state = news_node(state)
            
            # Step 3: Risk assessment
            logger.info("Running risk assessment", run_id=run_id)
            from .nodes.risk import risk_node
            state = risk_node(state)
            
            # Step 4: Trader decision
            logger.info("Running trader decision", run_id=run_id)
            from .nodes.trader import trader_node
            state = trader_node(state)
            
            logger.info("Trading run completed", run_id=run_id, status=state.status)
            
        except Exception as e:
            logger.error("Workflow execution failed", run_id=run_id, error=str(e))
            state.status = "FAILED"
            state.error_message = str(e)
        
        # Convert state to response format
        response = RunResponse(
            run_id=run_id,
            state=state,
            message=f"Trading run created and started for {request.symbol}"
        )
        
        logger.info("Trading run created successfully", 
                   run_id=run_id, 
                   status=state.status)
        
        return response
        
    except Exception as e:
        logger.error("Failed to create trading run", 
                    symbol=request.symbol, 
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create trading run: {str(e)}"
        )


@app.post("/runs/{run_id}/resume", response_model=RunResponse)
async def resume_trading_run(run_id: str, request: ResumeRequest) -> RunResponse:
    """
    Resume a trading run after human approval/rejection.
    
    Args:
        run_id: Run identifier
        request: Resume request with command
    
    Returns:
        Updated run response
    """
    try:
        logger.info("Resuming trading run", run_id=run_id, command=request.command)
        
        # Resume the run
        state = resume_run(run_id, request.command)
        
        # Convert state to response format
        response = RunResponse(
            run_id=run_id,
            state=state,
            message=f"Trading run {request.command}ed successfully"
        )
        
        logger.info("Trading run resumed successfully", 
                   run_id=run_id, 
                   command=request.command,
                   status=state.status)
        
        return response
        
    except ValueError as e:
        logger.error("Invalid resume request", run_id=run_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Failed to resume trading run", run_id=run_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resume trading run: {str(e)}"
        )


@app.get("/runs/{run_id}", response_model=RunResponse)
async def get_trading_run(run_id: str) -> RunResponse:
    """
    Get the current state of a trading run.
    
    Args:
        run_id: Run identifier
    
    Returns:
        Current run state
    """
    try:
        logger.info("Getting trading run state", run_id=run_id)
        
        # Get the state
        state = get_run_state(run_id)
        
        # Convert state to response format
        response = RunResponse(
            run_id=run_id,
            state=state,
            message=f"Current state: {state.status}"
        )
        
        return response
        
    except ValueError as e:
        logger.error("Run not found", run_id=run_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Failed to get trading run", run_id=run_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get trading run: {str(e)}"
        )


@app.get("/healthz")
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint.
    
    Returns:
        Health status
    """
    try:
        # Check environment variables
        required_vars = ["OPENAI_API_KEY", "MILVUS_URI", "MILVUS_USER", "MILVUS_PASSWORD"]
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        
        if missing_vars:
            return {
                "status": "unhealthy",
                "missing_variables": missing_vars,
                "message": "Missing required environment variables"
            }
        
        return {
            "status": "healthy",
            "message": "LangGraph trading agent is operational",
            "version": "1.0.0"
        }
        
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return {
            "status": "unhealthy",
            "error": str(e),
            "message": "Health check failed"
        }


@app.get("/")
async def root() -> Dict[str, Any]:
    """
    Root endpoint with API information.
    
    Returns:
        API information
    """
    return {
        "name": "LangGraph Trading Agent API",
        "version": "1.0.0",
        "description": "AI-powered trading agent with human-in-the-loop approval",
        "endpoints": {
            "POST /runs": "Create and start a new trading run",
            "POST /runs/{run_id}/resume": "Resume a trading run after approval/rejection",
            "GET /runs/{run_id}": "Get the current state of a trading run",
            "GET /healthz": "Health check"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7070)
