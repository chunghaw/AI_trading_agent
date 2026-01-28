#!/bin/bash
# Setup script for local development
# Creates Python 3.11 virtual environment and installs dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="$SCRIPT_DIR/../venv311"

echo "🔧 Setting up Python 3.11 virtual environment..."

# Check if Python 3.11 is available
if ! command -v python3.11 &> /dev/null; then
    echo "❌ Python 3.11 not found!"
    echo "💡 Install Python 3.11:"
    echo "   - macOS: brew install python@3.11"
    echo "   - Or download from: https://www.python.org/downloads/"
    exit 1
fi

# Create venv if it doesn't exist
if [ ! -d "$VENV_PATH" ]; then
    echo "📦 Creating virtual environment..."
    python3.11 -m venv "$VENV_PATH"
fi

# Activate venv
echo "✅ Virtual environment ready at: $VENV_PATH"
echo ""
echo "To activate:"
echo "  source $VENV_PATH/bin/activate"
echo ""
echo "Then install dependencies:"
echo "  cd scripts && pip install -r requirements.txt apache-airflow==2.8.0"
