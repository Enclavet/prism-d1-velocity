"""Multi-Agent Orchestrator — Complete solution for Exercise 3.

This demonstrates the agents-as-tools pattern using Strands SDK:
  1. Planner agent — decomposes requests into steps (no tools, pure reasoning)
  2. Executor agent — runs each step using task API tools
  3. Reviewer agent — validates results with read-only access
  4. Orchestrator — coordinates the three agents using them as tools

Source: sample-app/agent/src/multi_agent/orchestrator.py (with added comments)
"""

from strands import Agent, tool

# ---------------------------------------------------------------------------
# Module-level flag for mock mode (set by create_orchestrator)
# When True, all sub-agents use mock models (no AWS credentials needed)
# ---------------------------------------------------------------------------
_MOCK_MODE = False


# ---------------------------------------------------------------------------
# Planner Agent
#
# The planner has NO tools. It's a pure reasoning agent that takes a complex
# request and outputs a structured plan (JSON array of steps).
#
# Why a separate agent? Because planning and execution require different
# capabilities. The planner doesn't need API access — it just needs to
# think clearly about decomposition.
# ---------------------------------------------------------------------------

PLANNER_PROMPT = """You are a task planning specialist. Your job is to break down complex
task management requests into a sequence of concrete steps.

For each step, output a JSON object with:
- "action": the tool to call (list_tasks, create_task, update_task, delete_task, search_tasks)
- "params": the parameters for the tool call
- "reason": why this step is needed

Output your plan as a JSON array of steps. Example:

[
  {"action": "search_tasks", "params": {"query": "bug"}, "reason": "Find all bug-related tasks"},
  {"action": "update_task", "params": {"id": "PLACEHOLDER", "status": "in-progress"}, "reason": "Move each bug task to in-progress"}
]

Rules:
- Be specific about which tools to use.
- Use PLACEHOLDER for IDs that will be resolved during execution.
- Order steps logically — search/list before update/delete.
- Never plan more than 10 steps.
- If the request is unclear, output a single step: {"action": "clarify", "params": {}, "reason": "Need more information"}.
"""


def create_planner(mock: bool = False) -> Agent:
    """Create the planner agent (reasoning only, no tools)."""
    return Agent(
        system_prompt=PLANNER_PROMPT,
        model="mock" if mock else "bedrock/anthropic.claude-sonnet-4-20250514",
    )


# ---------------------------------------------------------------------------
# Reviewer Agent
#
# The reviewer has ONE tool: list_tasks (read-only). It checks the current
# state of tasks against the original request and the plan.
#
# Uses Haiku instead of Sonnet because review is a simpler, more structured
# task. This saves cost and latency. In production, you'd measure whether
# Haiku's accuracy is sufficient via the eval gates from Module 04.
# ---------------------------------------------------------------------------

REVIEWER_PROMPT = """You are a quality reviewer for task management operations.

You will receive:
1. The original user request
2. The plan that was created
3. The execution results

Your job:
- Verify that the execution results match the plan and the original request.
- Check that all planned steps were completed.
- Check that no unintended side effects occurred.
- Report any discrepancies.

Output a JSON object:
{
  "status": "PASS" or "FAIL",
  "issues": ["list of issues found, if any"],
  "summary": "one-sentence summary of the review"
}

You have access to list_tasks to verify the current state of tasks.

Rules:
- Be strict — if any planned step was not executed, report FAIL.
- Be fair — minor formatting differences are acceptable.
- Always verify the current task state using list_tasks.
"""


def create_reviewer(mock: bool = False) -> Agent:
    """Create the reviewer agent (read-only tools)."""
    # Import here to avoid circular imports in the real codebase
    from task_assistant_agent import list_tasks as _list_tasks

    return Agent(
        system_prompt=REVIEWER_PROMPT,
        tools=[_list_tasks],
        model="mock" if mock else "bedrock/anthropic.claude-haiku-4-5-20251001",
    )


# ---------------------------------------------------------------------------
# Agents wrapped as tools
#
# This is the core pattern: each @tool function creates an agent, runs it,
# and returns the result as a string. The orchestrator sees these as regular
# tools — it doesn't know they're agents underneath.
#
# Why wrap agents as tools?
#   - The orchestrator can decide WHEN to call each agent
#   - The orchestrator can pass context between agents (plan -> execute -> review)
#   - You can swap agent implementations without changing the orchestrator
#   - Each agent has its own system prompt, tools, and model
# ---------------------------------------------------------------------------

@tool
def plan(request: str) -> str:
    """Break down a complex task management request into ordered steps.

    Args:
        request: The user's natural language request to decompose.
    """
    planner = create_planner(mock=_MOCK_MODE)
    result = planner(
        f"Break this request into concrete task management steps:\n\n{request}"
    )
    return str(result)


@tool
def execute(plan_json: str) -> str:
    """Execute a plan by running each step against the task API.

    Args:
        plan_json: JSON string containing the plan steps from the planner.
    """
    # The executor is the same task assistant agent from Exercise 1.
    # It has all 5 tools and can handle any task management operation.
    from task_assistant_agent import create_agent

    executor = create_agent(mock=_MOCK_MODE)
    result = executor(
        f"Execute the following plan step by step. Report the result of each step.\n\n"
        f"Plan:\n{plan_json}"
    )
    return str(result)


@tool
def review(original_request: str, plan_json: str, execution_result: str) -> str:
    """Review execution results against the original request and plan.

    Args:
        original_request: The user's original request.
        plan_json: The plan that was created.
        execution_result: The results from execution.
    """
    reviewer = create_reviewer(mock=_MOCK_MODE)
    result = reviewer(
        f"Review this execution:\n\n"
        f"Original request: {original_request}\n\n"
        f"Plan: {plan_json}\n\n"
        f"Execution result: {execution_result}\n\n"
        f"Verify the current task state and report PASS or FAIL."
    )
    return str(result)


# ---------------------------------------------------------------------------
# Orchestrator Agent
#
# The orchestrator's system prompt defines the workflow: plan -> execute -> review.
# It has three tools (which are actually three agents).
#
# The orchestrator itself is an agent — it reasons about which tool to call
# and when. The system prompt guides it to always follow the three-phase
# sequence, but the model makes the actual decisions.
# ---------------------------------------------------------------------------

ORCHESTRATOR_PROMPT = """You are a task management orchestrator. For complex requests,
you coordinate three phases:

1. PLAN: Use the 'plan' tool to break the request into steps.
2. EXECUTE: Use the 'execute' tool to carry out the plan.
3. REVIEW: Use the 'review' tool to verify the results.

Always follow this sequence: plan -> execute -> review.
If the review reports FAIL, retry the failed steps once using 'execute'.
After retry, report the final outcome to the user.

Be concise in your final response — summarize what was done and the review result.
"""


def create_orchestrator(mock: bool = False) -> Agent:
    """Create the multi-agent orchestrator.

    Args:
        mock: If True, all sub-agents use mock models (no AWS credentials needed).
    """
    global _MOCK_MODE
    _MOCK_MODE = mock

    return Agent(
        system_prompt=ORCHESTRATOR_PROMPT,
        tools=[plan, execute, review],
        model="mock" if mock else "bedrock/anthropic.claude-sonnet-4-20250514",
    )


# ---------------------------------------------------------------------------
# Main — run the orchestrator from the command line
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    prompt = " ".join(
        arg for arg in sys.argv[1:] if arg != "--mock"
    ) or "Organize my backlog by priority"

    orchestrator = create_orchestrator(mock="--mock" in sys.argv)
    result = orchestrator(prompt)
    print(result)
