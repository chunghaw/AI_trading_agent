.PHONY: help web-dev worker-dev graph-dev test format build clean

help:
	@echo "Available commands:"
	@echo "  test        - Run all tests"
	@echo "  web-dev     - Start web development server"
	@echo "  worker-dev  - Start worker development server"
	@echo "  graph-dev   - Start LangGraph development server"
	@echo "  format      - Format code with black"
	@echo "  build       - Build web application"
	@echo "  clean       - Clean build artifacts"

test:
	@echo "Running web typecheck..."
	cd apps/web && npm run typecheck
	@echo "Running worker tests..."
	cd apps/worker && python -m pytest tests/ -v

web-dev:
	cd apps/web && npm run dev

worker-dev:
	cd apps/worker && python -c "from worker.api import app; import uvicorn; uvicorn.run(app, host='127.0.0.1', port=8001, log_level='info')"

graph-dev:
	cd apps/worker && uvicorn graph_app.api:app --reload --port 7070

format:
	cd apps/worker && black .
	cd apps/web && npm run format

build:
	cd apps/web && npm run build

clean:
	rm -rf apps/web/.next
	rm -rf apps/worker/__pycache__
	rm -rf apps/worker/*/__pycache__
	rm -rf apps/worker/.pytest_cache
	rm -rf apps/worker/.mypy_cache
