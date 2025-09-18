.PHONY: help web-dev worker-dev test format build clean

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

web-dev: ## Start Next.js development server
	@echo "Starting Next.js development server..."
	cd apps/web && npm run dev

worker-dev: ## Run Python worker in development mode
	@echo "Starting Python worker..."
	cd apps/worker && python -m worker

test: ## Run all tests (web typecheck + worker pytest)
	@echo "Running web typecheck..."
	cd apps/web && npm run typecheck
	@echo "Running worker tests..."
	cd apps/worker && python -m pytest tests/ -v

format: ## Format all codebases
	@echo "Formatting web code..."
	cd apps/web && npm run format
	@echo "Formatting worker code..."
	cd apps/worker && ruff format .
	@echo "Formatting shared packages..."
	cd packages/shared && npm run format

build: ## Build web for production
	@echo "Building web application..."
	cd apps/web && npm run build

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	cd apps/web && rm -rf .next
	cd apps/worker && find . -type d -name __pycache__ -delete
	cd apps/worker && find . -name "*.pyc" -delete

install: ## Install all dependencies
	@echo "Installing web dependencies..."
	cd apps/web && npm install
	@echo "Installing worker dependencies..."
	cd apps/worker && pip install -r requirements.txt
	@echo "Installing shared package dependencies..."
	cd packages/shared && npm install

lint: ## Lint all codebases
	@echo "Linting web code..."
	cd apps/web && npm run lint
	@echo "Linting worker code..."
	cd apps/worker && ruff check .

docker-build: ## Build worker Docker image
	@echo "Building worker Docker image..."
	cd apps/worker && docker build -t ai-trading-worker.
	
docker-run: ## Run worker in Docker
	@echo "Running worker in Docker..."
	docker run -it --rm ai-trading-worker 