# Exercise 1: Build Your First Agent

**Time:** 20 minutes

## Objective

Create a task assistant agent using the Strands SDK that can manage tasks through natural language. By the end, you'll have an agent that understands "Create a task to fix the login bug" and calls the right API.

## Prerequisites

- sample-app running locally (`npm run dev` in `sample-app/`)
- Python 3.11+ installed
- AWS credentials configured (or use `--mock` flag for offline mode)

## Steps

### Step 1: Set up the Python environment

```bash
cd sample-app/agent

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Verify the installation:

```bash
python3 -c "from strands import Agent, tool; print('Strands SDK installed successfully')"
```

### Step 2: Read the agent spec

Before writing any code, read the spec that defines what this agent should do:

```bash
cat src/task_assistant/config.py
```

Pay attention to:
- **SYSTEM_PROMPT** -- This is the agent's personality and rules. It tells the model what tools are available and how to behave.
- **AgentConfig** -- Configuration for the model, API connection, and guardrails.
- **GuardrailConfig** -- Safety boundaries: max steps, timeout, max deletes per turn.

### Step 3: Understand the tool-use pattern

Open `src/task_assistant/tools.py` and read through the tool definitions. Each tool is a Python function decorated with `@tool`:

```python
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
```

The critical insight: **the docstring IS the tool description.** The model reads this text to decide when and how to call the tool. If the docstring is vague, the model makes bad tool choices. If the `Args:` section is unclear, the model passes wrong parameters.

The five tools are:
1. **list_tasks** -- List all tasks, optionally filtered by status
2. **create_task** -- Create a new task with title, description, status, tags
3. **update_task** -- Update an existing task by ID
4. **delete_task** -- Delete a task by ID
5. **search_tasks** -- Search tasks by keyword

### Step 4: Review the agent creation code

Open `src/task_assistant/agent.py`. The `create_agent` function is where everything comes together:

```python
def create_agent(config=None, mock=False):
    # 1. Configure the API base URL
    set_api_base(config.task_api_url)

    # 2. List the tools the agent can use
    tools = [list_tasks, create_task, update_task, delete_task, search_tasks]

    # 3. Create the agent with a system prompt, tools, and model
    agent = Agent(
        system_prompt=SYSTEM_PROMPT,
        tools=tools,
        model="bedrock/anthropic.claude-sonnet-4-20250514",
    )
    return agent
```

That's it. Three things define an agent:
1. **System prompt** -- What it knows and how it behaves
2. **Tools** -- What it can do
3. **Model** -- Which LLM powers the reasoning

### Step 5: Run the agent

Make sure the sample-app is running in another terminal:

```bash
# Terminal 1: Start the task API
cd sample-app
npm run dev
```

Now run the agent:

```bash
# Terminal 2: Run the agent
cd sample-app/agent
source .venv/bin/activate

# With Bedrock (requires AWS credentials)
python3 -m src.task_assistant.cli "List all my tasks"

# OR with mock mode (no AWS credentials needed)
python3 -m src.task_assistant.cli --mock "List all my tasks"
```

### Step 6: Test with natural language

Try these prompts and observe how the agent selects tools:

```bash
# Create a task
python3 -m src.task_assistant.cli "Create a task to fix the login bug tagged as critical"

# Search for it
python3 -m src.task_assistant.cli "Find all tasks related to bugs"

# Update it
python3 -m src.task_assistant.cli "Mark all bug tasks as in-progress"

# Complex request (watch the agent chain multiple tool calls)
python3 -m src.task_assistant.cli "Create three tasks: fix login bug, update user profile page, and add dark mode. Tag them all as sprint-7"
```

For the last prompt, observe the agent's behavior:
- It calls `create_task` three times in sequence
- Each call uses different parameters
- The model decided to make three separate calls -- you didn't tell it to

### Step 7: Examine the tool-use loop

Run with verbose output to see the full loop:

```bash
python3 -m src.task_assistant.cli --verbose "Create a task to fix the login bug tagged as critical"
```

You should see:
```
[Agent] Thinking...
[Agent] Tool call: create_task(title="Fix the login bug", status="todo", tags="critical")
[Agent] Tool result: {"data": {"id": "abc-123", "title": "Fix the login bug", ...}}
[Agent] Responding to user...
```

This is the agentic loop: think -> act -> observe -> respond.

## Verification

You've completed this exercise when:
- [ ] `python3 -c "from strands import Agent; print('OK')"` prints OK
- [ ] The agent responds to "Create a task to fix the login bug" by calling `create_task`
- [ ] You can see the created task via `curl http://localhost:3000/tasks`
- [ ] You've run at least 3 different natural language prompts and observed the tool selection
