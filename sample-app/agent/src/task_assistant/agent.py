"""Task Assistant Agent — Strands SDK-based agent for task management.

This is the main agent entry point. It can operate in two modes:
1. Direct tools mode: Uses HTTP calls to the task API via @tool functions
2. MCP mode: Discovers tools via MCP protocol from the TypeScript MCP server

Usage:
    from task_assistant.agent import create_agent
    agent = create_agent()
    result = agent("Create a task to fix the login bug tagged as critical")
"""

from strands import Agent
from strands.models.bedrock import BedrockModel

from .config import AgentConfig, SYSTEM_PROMPT
from .mock_model import MockModel
from .metrics import AgentMetrics
from .tools import (
    list_tasks,
    create_task,
    update_task,
    delete_task,
    set_api_base,
)


def create_agent(
    config: AgentConfig | None = None,
    mock: bool = False,
) -> Agent:
    """Create and configure the task assistant agent.

    Args:
        config: Agent configuration. Uses defaults if not provided.
        mock: If True, use a mock model provider (no AWS credentials needed).
    """
    if config is None:
        config = AgentConfig()

    # Configure tool API base URL
    set_api_base(config.task_api_url)

    # Build tool list
    tools = [list_tasks, create_task, update_task, delete_task]

    # Create agent with Strands SDK
    agent_kwargs = {
        "system_prompt": SYSTEM_PROMPT,
        "tools": tools,
    }

    if mock:
        # Mock mode — no AWS credentials needed
        # Uses pattern-matched responses to demonstrate tool flow
        agent_kwargs["model"] = MockModel()
    else:
        # Production mode — use Bedrock
        agent_kwargs["model"] = BedrockModel(
            model_id=config.model_id,
            region_name=config.aws_region,
        )

    agent = Agent(**agent_kwargs)
    return agent


def run_with_metrics(
    agent: Agent,
    prompt: str,
    config: AgentConfig | None = None,
) -> str:
    """Run the agent with metrics collection and emission.

    Args:
        agent: The Strands agent instance.
        prompt: The user's natural language request.
        config: Agent configuration for metrics emission.

    Returns:
        The agent's response as a string.
    """
    if config is None:
        config = AgentConfig()

    metrics = AgentMetrics(config)
    metrics.start()

    try:
        result = agent(prompt)
        response = str(result)

        # Estimate metrics from result
        # In production, Strands SDK provides callback hooks for step/tool tracking
        metrics.record_step()

        return response

    except Exception as exc:
        metrics.record_failure()
        raise

    finally:
        metrics.emit()
