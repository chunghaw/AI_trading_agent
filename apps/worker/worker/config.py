"""Configuration management for the AI Trading Agent Worker."""

import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings


class Config(BaseSettings):
    """Configuration class with environment variable support."""
    
    # Logging
    log_level: str = "INFO"
    
    # API Configuration
    api_key: Optional[str] = None
    database_url: Optional[str] = None
    
    # External Services
    binance_api_key: Optional[str] = None
    binance_secret_key: Optional[str] = None
    polygon_api_key: Optional[str] = None
    
    # Trading Configuration
    max_position_size: float = 0.1  # 10% of portfolio
    stop_loss_pct: float = 0.02     # 2% stop loss
    take_profit_pct: float = 0.04   # 4% take profit
    
    # Risk Management
    max_daily_loss: float = 0.05    # 5% max daily loss
    max_open_positions: int = 5
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    def load_from_file(self, config_path: str) -> None:
        """Load configuration from a file."""
        config_file = Path(config_path)
        if config_file.exists():
            # In a real implementation, you would parse YAML/JSON
            print(f"Loading config from: {config_path}")
        else:
            print(f"Config file not found: {config_path}")
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return os.getenv("ENVIRONMENT", "development") == "production"
    
    @property
    def worker_id(self) -> str:
        """Get unique worker ID."""
        return os.getenv("WORKER_ID", "worker-1") 