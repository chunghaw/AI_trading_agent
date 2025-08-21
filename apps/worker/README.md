# LangGraph Trading Agent

A production-grade AI-powered trading agent built with LangGraph, featuring human-in-the-loop approval and strict risk management.

## Architecture

The trading agent uses a **LangGraph workflow** to orchestrate multiple AI agents:

```
Technical Analysis → News Analysis → Risk Assessment → Trader Decision → [Human Approval] → Execution
```

### Components

- **Technical Node**: Computes RSI, MACD, Bollinger Bands, and moving averages
- **News Node**: Searches Milvus for relevant news and analyzes sentiment
- **Risk Node**: Evaluates exposure limits, confidence thresholds, and embargo rules
- **Trader Node**: Synthesizes opinions into final decisions and handles execution

## Features

✅ **Strict Pydantic Validation**: All data structures validated with Pydantic v2
✅ **Human-in-the-Loop**: Optional approval workflow for trading decisions
✅ **Risk Management**: Configurable limits for position size, daily loss, and confidence
✅ **State Persistence**: SQLite checkpointing for workflow state
✅ **Structured Logging**: JSON logs with run_id tracking
✅ **Fallback Mechanisms**: Graceful degradation when LLM responses fail
✅ **Production Ready**: Error handling, retries, and health checks

## Quick Start

### 1. Install Dependencies

```bash
cd apps/worker
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

Copy and configure the environment variables:

```bash
cp env.example .env
# Edit .env with your API keys
```

Required variables:
- `OPENAI_API_KEY`: Your OpenAI API key
- `MILVUS_URI`, `MILVUS_USER`, `MILVUS_PASSWORD`: Milvus connection
- `MILVUS_COLLECTION`: Collection name (default: trading_agents_knowledge_base)

### 3. Start the LangGraph API

```bash
make graph-dev
```

This starts the FastAPI server on `http://localhost:7070`

### 4. Test the System

```bash
# Create a trading run
curl -X POST http://localhost:7070/runs \
  -H "Content-Type: application/json" \
  -d '{"symbol": "NVDA", "timeframe": "1h"}'

# Check run status
curl http://localhost:7070/runs/{run_id}

# Approve/reject decision
curl -X POST http://localhost:7070/runs/{run_id}/resume \
  -H "Content-Type: application/json" \
  -d '{"command": "approve"}'
```

## API Endpoints

### POST /runs
Create and start a new trading run.

**Request:**
```json
{
  "symbol": "NVDA",
  "timeframe": "1h"
}
```

**Response:**
```json
{
  "run_id": "uuid",
  "state": {
    "run_id": "uuid",
    "symbol": "NVDA",
    "timeframe": "1h",
    "status": "WAITING_APPROVAL",
    "decision": {
      "action": "BUY",
      "size_pct": 0.1,
      "confidence": 0.85,
      "entry": {"type": "market", "price": null},
      "sl": 450.0,
      "tp": [500.0, 550.0],
      "citations": ["technical_analysis", "news_sentiment"]
    }
  },
  "message": "Trading run created and started for NVDA"
}
```

### POST /runs/{run_id}/resume
Resume a trading run after human approval/rejection.

**Request:**
```json
{
  "command": "approve"  // or "reject"
}
```

### GET /runs/{run_id}
Get the current state of a trading run.

### GET /healthz
Health check endpoint.

## Configuration

### Risk Management

```bash
WORKER_APPROVAL_REQUIRED=true      # Require human approval
MAX_EXPOSURE_PCT=0.25             # Max portfolio exposure
MAX_DAILY_LOSS_PCT=0.05           # Max daily loss
EMBARGO_MINUTES_AFTER_NEWS=30     # Wait after news
MAX_POSITION_SIZE_PCT=0.1         # Max position size
MIN_CONFIDENCE=0.7                # Min confidence threshold
```

### Data Sources

The agent can use multiple data sources:

1. **Parquet Files**: Pre-computed OHLCV data from Airflow DAGs
2. **Polygon API**: Live market data (requires API key)
3. **Mock Data**: Generated for testing

### Milvus Integration

The news analysis uses your existing Milvus collection:
- Collection: `trading_agents_knowledge_base`
- Uses LangChain Milvus retriever
- Searches for news articles about the trading symbol

## Development

### Running Tests

```bash
make test
```

### Code Formatting

```bash
make format
```

### Development Server

```bash
make graph-dev  # LangGraph API on :7070
make worker-dev  # Legacy worker API on :8001
make web-dev     # Next.js frontend on :3000
```

## Workflow States

- **PENDING**: Initial state, workflow running
- **WAITING_APPROVAL**: Decision made, waiting for human approval
- **EXECUTED**: Trade executed (approved or auto-executed)
- **REJECTED**: Decision rejected by human
- **FAILED**: Workflow failed with error

## Error Handling

The system includes robust error handling:

1. **LLM Response Parsing**: Falls back to simple averaging if JSON parsing fails
2. **Data Source Failures**: Uses mock data if live sources unavailable
3. **Milvus Connection**: Graceful degradation with in-memory fallback
4. **Risk Violations**: Automatically sets decision to FLAT

## Production Deployment

### Environment Variables

Ensure all required environment variables are set:

```bash
# Required
OPENAI_API_KEY=sk-...
MILVUS_URI=https://...
MILVUS_USER=...
MILVUS_PASSWORD=...

# Optional (for live data)
POLYGON_API_KEY=...
BINANCE_API_KEY=...
BINANCE_SECRET_KEY=...

# Configuration
WORKER_APPROVAL_REQUIRED=true
MODEL_NAME=gpt-4o
DATA_DIR=/opt/data/ohlcv
```

### Health Monitoring

The `/healthz` endpoint checks:
- Required environment variables
- API connectivity
- System status

### Logging

Structured JSON logs include:
- Run ID for correlation
- Node completion events
- Error details with context
- Performance metrics

## Integration

### Frontend Integration

The web frontend can integrate with the LangGraph API:

```typescript
// Create trading run
const response = await fetch('http://localhost:7070/runs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ symbol: 'NVDA', timeframe: '1h' })
});

// Poll for status
const state = await fetch(`http://localhost:7070/runs/${runId}`);
```

### Legacy Compatibility

The original worker API remains available on port 8001 for backward compatibility.

## Troubleshooting

### Common Issues

1. **Milvus Connection Failed**
   - Check `MILVUS_URI`, `MILVUS_USER`, `MILVUS_PASSWORD`
   - Verify collection exists: `trading_agents_knowledge_base`

2. **LLM Response Parsing Errors**
   - Check `OPENAI_API_KEY` is valid
   - Verify `MODEL_NAME` is supported

3. **State Persistence Issues**
   - Ensure `state/` directory is writable
   - Check SQLite permissions

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=DEBUG
make graph-dev
```

## License

MIT License - see LICENSE file for details.
