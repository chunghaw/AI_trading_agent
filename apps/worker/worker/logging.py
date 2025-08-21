"""Logging configuration for the AI Trading Agent Worker."""

import sys
from loguru import logger


def setup_logging(level: str = "INFO") -> None:
    """Setup logging configuration."""
    
    # Remove default handler
    logger.remove()
    
    # Add console handler with custom format
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level=level,
        colorize=True,
    )
    
    # Add file handler for production
    if level == "DEBUG":
        logger.add(
            "logs/worker.log",
            format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
            level="DEBUG",
            rotation="1 day",
            retention="7 days",
        )
    
    # Intercept standard library logging
    logger.add(
        sys.stderr,
        format="<red>{time:YYYY-MM-DD HH:mm:ss}</red> | <level>{level: <8}</level> | <cyan>{name}</cyan> - <level>{message}</level>",
        level="WARNING",
        filter=lambda record: record["extra"].get("name") == "urllib3",
    )


def get_logger(name: str = None):
    """Get a logger instance."""
    return logger.bind(name=name or "worker") 