"""LangGraph workflow for trading agent."""

import os
import uuid
from typing import Dict, Any
import structlog
from datetime import datetime
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from .schemas import State
from .nodes.technical import technical_node
from .nodes.news import news_node
from .nodes.risk import risk_node
from .nodes.trader import trader_node, trader_resume_node

logger = structlog.get_logger()

# Global state storage for debugging
_state_storage: Dict[str, State] = {}

import json
import tempfile
import os

# File-based storage for cross-process sharing
_STATE_FILE = os.path.join(tempfile.gettempdir(), "trading_agent_states.json")

def _load_states() -> Dict[str, State]:
    """Load states from file."""
    try:
        if os.path.exists(_STATE_FILE):
            with open(_STATE_FILE, 'r') as f:
                data = json.load(f)
                return {k: State(**v) for k, v in data.items()}
    except Exception as e:
        logger.warning("Failed to load states from file", error=str(e))
    return {}

def _save_states(states: Dict[str, State]):
    """Save states to file."""
    try:
        data = {k: v.model_dump() for k, v in states.items()}
        with open(_STATE_FILE, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        logger.warning("Failed to save states to file", error=str(e))

# Load existing states
_state_storage.update(_load_states())


def create_trading_graph() -> StateGraph:
    """
    Create the LangGraph workflow for trading decisions.
    
    Returns:
        Configured StateGraph
    """
    # Create the graph
    workflow = StateGraph(State)
    
    # Add nodes
    workflow.add_node("technical", technical_node)
    workflow.add_node("news", news_node)
    workflow.add_node("risk", risk_node)
    workflow.add_node("trader", trader_node)
    
    # Define the main flow
    workflow.set_entry_point("technical")
    workflow.add_edge("technical", "news")
    workflow.add_edge("news", "risk")
    workflow.add_edge("risk", "trader")
    workflow.add_edge("trader", END)
    
    # Add conditional edge for approval flow
    workflow.add_conditional_edges(
        "trader",
        _should_wait_for_approval,
        {
            "approval_required": END,
            "continue": END
        }
    )
    
    return workflow


def _should_wait_for_approval(state: State) -> str:
    """
    Determine if we should wait for approval.
    
    Args:
        state: Current state
    
    Returns:
        Next step in workflow
    """
    if state.needs_approval:
        return "approval_required"
    return "continue"


def create_resume_graph() -> StateGraph:
    """
    Create the LangGraph workflow for resuming after approval.
    
    Returns:
        Configured StateGraph
    """
    workflow = StateGraph(State)
    
    # Add resume node
    workflow.add_node("trader_resume", trader_resume_node)
    workflow.set_entry_point("trader_resume")
    workflow.add_edge("trader_resume", END)
    
    return workflow


def get_checkpointer() -> MemorySaver:
    """
    Get memory checkpointer for state persistence.
    
    Returns:
        Configured MemorySaver
    """
    return MemorySaver()


def create_run(symbol: str, timeframe: str) -> str:
    """
    Create a new trading run.
    
    Args:
        symbol: Trading symbol
        timeframe: Analysis timeframe
    
    Returns:
        Run ID
    """
    run_id = str(uuid.uuid4())
    
    # Create initial state
    initial_state = State(
        run_id=run_id,
        symbol=symbol.upper(),
        timeframe=timeframe,
        status="PENDING"
    )
    
    # Store initial state in global storage for debugging
    _state_storage[run_id] = initial_state
    _save_states(_state_storage)
    
    # Debug: verify storage
    logger.info("Stored state in global storage", 
               run_id=run_id, 
               storage_keys=list(_state_storage.keys()),
               state_status=initial_state.status)
    
    # Also try to store in checkpointer (for future use)
    try:
        checkpointer = get_checkpointer()
        config = {
            "configurable": {
                "thread_id": run_id,
                "checkpoint_ns": "trading_agent"
            }
        }
        # Convert State to dict and wrap in channel_values for LangGraph compatibility
        state_dict = {
            "id": run_id,
            "channel_values": initial_state.model_dump(),
            "channel_versions": {
                "run_id": 1,
                "symbol": 1,
                "timeframe": 1,
                "status": 1,
                "bars": 1,
                "news": 1,
                "opinions": 1,
                "decision": 1,
                "needs_approval": 1
            }
        }
        checkpointer.put(config, state_dict, metadata={}, new_versions={})
    except Exception as e:
        logger.warning("Failed to store state in checkpointer", run_id=run_id, error=str(e))
    
    logger.info("Created new trading run", 
               run_id=run_id, 
               symbol=symbol, 
               timeframe=timeframe)
    
    return run_id


def start_run(run_id: str) -> State:
    """
    Start a trading run.
    
    Args:
        run_id: Run identifier
    
    Returns:
        Final state
    """
    try:
        # Get the stored state from global storage
        if run_id not in _state_storage:
            raise ValueError(f"No state found for run {run_id}")
        
        state = _state_storage[run_id]
        
        logger.info("Starting trading run", run_id=run_id)
        
        # Mock workflow execution for now
        # In a real implementation, this would use LangGraph
        try:
            # Step 1: Technical analysis
            logger.info("Running technical analysis", run_id=run_id)
            from .nodes.technical import technical_node
            state = technical_node(state)
            
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
            
            # Update global storage
            _state_storage[run_id] = state
            _save_states(_state_storage)
            
            logger.info("Trading run completed", 
                       run_id=run_id, 
                       status=state.status)
            
            return state
            
        except Exception as e:
            logger.error("Workflow execution failed", run_id=run_id, error=str(e))
            state.status = "FAILED"
            state.error_message = str(e)
            _state_storage[run_id] = state
            _save_states(_state_storage)
            return state
        
    except Exception as e:
        logger.error("Failed to start run", run_id=run_id, error=str(e))
        raise


def resume_run(run_id: str, command: str) -> State:
    """
    Resume a trading run after approval/rejection.
    
    Args:
        run_id: Run identifier
        command: "approve" or "reject"
    
    Returns:
        Final state
    """
    try:
        # Get the resume graph and checkpointer
        graph = create_resume_graph()
        checkpointer = get_checkpointer()
        
        # Create app
        app = graph.compile(checkpointer=checkpointer)
        
        # Get current state
        config = {
            "configurable": {
                "thread_id": run_id,
                "checkpoint_ns": "trading_agent"
            }
        }
        current_state = app.get_state(config)
        
        if not current_state:
            raise ValueError(f"No state found for run {run_id}")
        
        # Resume with command
        logger.info("Resuming trading run", run_id=run_id, command=command)
        
        for event in app.stream(
            {"command": command}, 
            config=config
        ):
            node_name = list(event.keys())[0]
            if node_name != "__end__":
                logger.info("Resume node completed", run_id=run_id, node=node_name)
        
        # Get final state
        final_state = app.get_state(config)
        
        logger.info("Trading run resumed", 
                   run_id=run_id, 
                   command=command,
                   status=final_state["status"])
        
        return final_state
        
    except Exception as e:
        logger.error("Failed to resume run", run_id=run_id, error=str(e))
        raise


def get_run_state(run_id: str) -> State:
    """
    Get the current state of a run.
    
    Args:
        run_id: Run identifier
    
    Returns:
        Current state
    """
    try:
        # Reload states from file to get latest
        _state_storage.update(_load_states())
        
        # Debug: check what's in storage
        logger.info("Checking run state", 
                   run_id=run_id, 
                   storage_keys=list(_state_storage.keys()),
                   run_id_in_storage=run_id in _state_storage)
        
        # First try global storage
        if run_id in _state_storage:
            return _state_storage[run_id]
        
        # Fallback to checkpointer
        checkpointer = get_checkpointer()
        
        # Get state
        config = {
            "configurable": {
                "thread_id": run_id,
                "checkpoint_ns": "trading_agent"
            }
        }
        stored_data = checkpointer.get(config)
        
        if not stored_data:
            raise ValueError(f"No state found for run {run_id}")
        
        # Extract state from channel_values if present
        if isinstance(stored_data, dict) and "channel_values" in stored_data:
            state_data = stored_data["channel_values"]
            return State(**state_data)
        elif isinstance(stored_data, dict):
            # Direct state dict
            return State(**stored_data)
        else:
            return stored_data
        
    except Exception as e:
        logger.error("Failed to get run state", run_id=run_id, error=str(e))
        raise
