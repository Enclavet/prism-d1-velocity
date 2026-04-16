"""Task Assistant Agent — Complete solution for Exercise 1.

This is the reference implementation of a Strands SDK agent for task management.
It demonstrates:
  1. Agent creation with system prompt, tools, and model
  2. Tool definitions using the @tool decorator
  3. The tool-use loop (agent reasons, calls tools, observes results)
  4. Metrics emission for PRISM dashboard integration

Source: sample-app/agent/src/task_assistant/agent.py (with added comments)
"""

import json
from typing import Any

import requests
from strands import Agent, tool

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# The base URL for the task REST API. The agent's tools call this API
# to perform CRUD operations on tasks.
API_BASE = "http://localhost:3000"

# The system prompt defines the agent's personality, available tools,
# and behavioral rules. The model reads this on every invocation.
# KEY INSIGHT: This prompt is the primary lever for controlling agent behavior.
# If the agent does something wrong, the fix is usually here.
SYSTEM_PROMPT = """You are a task management assistant. You help users manage their tasks using natural language.

You have access to the following tools:
- list_tasks: List all tasks, optionally filtered by status (todo, in-progress, done)
- create_task: Create a new task with a title, description, status, and tags
- update_task: Update an existing task's fields by ID
- delete_task: Delete a task by ID
- search_tasks: Search tasks by keyword across title, description, and tags

Rules:
- Always confirm what you did after completing operations.
- Never delete more than 3 tasks in a single turn.
- If the user's request is ambiguous, ask for clarification before acting.
- When creating tasks, default to status "todo" unless specified otherwise.
- Include task IDs in your responses so users can reference them.
- Be concise but informative in your responses.
"""


# ---------------------------------------------------------------------------
# Helper: HTTP requests to the task API
# ---------------------------------------------------------------------------

def _request(method: str, path: str, body: dict | None = None) -> dict:
    """Make an HTTP request to the task API.

    All tools use this helper. It handles JSON serialization/deserialization
    and error formatting.
    """
    url = f"{API_BASE}{path}"
    resp = requests.request(method, url, json=body, timeout=10)
    data = resp.json()
    if resp.status_code >= 400:
        return {"error": data.get("error", f"HTTP {resp.status_code}")}
    return data


# ---------------------------------------------------------------------------
# Tool definitions
#
# Each @tool function becomes a tool the agent can call. The model sees:
#   - The function name (used to identify the tool)
#   - The docstring (used to decide WHEN to call the tool)
#   - The Args section (used to decide WHAT parameters to pass)
#
# IMPORTANT: Docstring quality directly determines tool selection accuracy.
# Vague docstrings = wrong tool calls. Be specific and explicit.
# ---------------------------------------------------------------------------

@tool
def list_tasks(status: str = "") -> str:
    """List all tasks, optionally filtered by status.

    Args:
        status: Filter by task status. One of: todo, in-progress, done. Leave empty for all.
    """
    result = _request("GET", "/tasks")
    tasks = result.get("data", [])
    if status:
        tasks = [t for t in tasks if t.get("status") == status]
    return json.dumps({"data": tasks, "count": len(tasks)}, indent=2)


@tool
def create_task(
    title: str,
    description: str = "",
    status: str = "todo",
    tags: str = "",
) -> str:
    """Create a new task.

    Args:
        title: The task title (required).
        description: A longer description of the task.
        status: Initial status -- one of: todo, in-progress, done. Defaults to todo.
        tags: Comma-separated tags, e.g. "bug,critical,backend".
    """
    body: dict[str, Any] = {"title": title}
    if description:
        body["description"] = description
    if status:
        body["status"] = status
    if tags:
        body["tags"] = [t.strip() for t in tags.split(",") if t.strip()]
    return json.dumps(_request("POST", "/tasks", body), indent=2)


@tool
def update_task(
    id: str,
    title: str = "",
    description: str = "",
    status: str = "",
    tags: str = "",
) -> str:
    """Update an existing task by ID.

    Args:
        id: The task ID to update (required).
        title: New title (leave empty to keep current).
        description: New description (leave empty to keep current).
        status: New status -- one of: todo, in-progress, done (leave empty to keep current).
        tags: New comma-separated tags (leave empty to keep current).
    """
    body: dict[str, Any] = {}
    if title:
        body["title"] = title
    if description:
        body["description"] = description
    if status:
        body["status"] = status
    if tags:
        body["tags"] = [t.strip() for t in tags.split(",") if t.strip()]
    if not body:
        return json.dumps({"error": "No fields to update"})
    return json.dumps(_request("PUT", f"/tasks/{id}", body), indent=2)


@tool
def delete_task(id: str) -> str:
    """Delete a task by ID.

    Args:
        id: The task ID to delete (required).
    """
    return json.dumps(_request("DELETE", f"/tasks/{id}"), indent=2)


@tool
def search_tasks(query: str) -> str:
    """Search tasks by keyword across title, description, and tags.

    Args:
        query: The search keyword (required).
    """
    result = _request("GET", "/tasks")
    tasks = result.get("data", [])
    query_lower = query.lower()
    matches = [
        t
        for t in tasks
        if query_lower in t.get("title", "").lower()
        or query_lower in t.get("description", "").lower()
        or any(query_lower in tag.lower() for tag in t.get("tags", []))
    ]
    return json.dumps({"data": matches, "count": len(matches)}, indent=2)


# ---------------------------------------------------------------------------
# Agent creation
#
# Three things define an agent:
#   1. System prompt -- what it knows and how it behaves
#   2. Tools -- what it can do
#   3. Model -- which LLM powers the reasoning
# ---------------------------------------------------------------------------

def create_agent(mock: bool = False) -> Agent:
    """Create and configure the task assistant agent.

    Args:
        mock: If True, use a mock model (no AWS credentials needed).
              Useful for testing and offline workshops.
    """
    tools = [list_tasks, create_task, update_task, delete_task, search_tasks]

    agent = Agent(
        system_prompt=SYSTEM_PROMPT,
        tools=tools,
        # "bedrock/<model-id>" tells Strands to use Amazon Bedrock for inference.
        # The mock model returns echo responses for testing.
        model="mock" if mock else "bedrock/anthropic.claude-sonnet-4-20250514",
    )
    return agent


# ---------------------------------------------------------------------------
# Main — run the agent from the command line
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    prompt = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "List all tasks"
    agent = create_agent(mock="--mock" in sys.argv)
    result = agent(prompt)
    print(result)
