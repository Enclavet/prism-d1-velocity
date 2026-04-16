# Exercise 3: Multi-Agent Orchestration

**Time:** 15 minutes

## Objective

Run a multi-agent system that coordinates three specialized agents -- a planner, an executor, and a reviewer -- to complete a complex task management request. Understand the agents-as-tools pattern.

## Prerequisites

- Exercise 1 complete (agent dependencies installed)
- sample-app running with some tasks already created (from Exercises 1 and 2)

## Background

A single agent with 5 tools works great for simple requests ("create a task"). But what about complex requests like "Organize my backlog by priority" or "Move all bug tasks to in-progress and create a summary task"? These require:

1. **Planning** -- Break the request into steps
2. **Execution** -- Run each step against the API
3. **Validation** -- Verify the results match the intent

You could build one agent with 5 tools and a really good system prompt. But that approach breaks down as complexity grows. Instead, you split the work across specialized agents and compose them with an orchestrator.

## Steps

### Step 1: Review the three agents

Open each file and understand its role:

**Planner** (`src/multi_agent/planner.py`):

```bash
cat sample-app/agent/src/multi_agent/planner.py
```

Key observations:
- Has NO tools -- it's a pure reasoning agent
- Its system prompt tells it to output a structured JSON plan
- Uses the same Bedrock model but with a focused prompt
- Each step in the plan specifies an action, params, and reason

**Reviewer** (`src/multi_agent/reviewer.py`):

```bash
cat sample-app/agent/src/multi_agent/reviewer.py
```

Key observations:
- Has ONE tool: `list_tasks` (read-only)
- Its job is to verify the current state matches expectations
- Uses Haiku (fast, cheap) because review is a simpler task
- Outputs PASS or FAIL with issues list

**Executor** -- This is the task assistant agent from Exercise 1. It has all 5 tools.

### Step 2: Understand agents-as-tools

Open the orchestrator (`src/multi_agent/orchestrator.py`):

```bash
cat sample-app/agent/src/multi_agent/orchestrator.py
```

The magic is in these three functions:

```python
@tool
def plan(request: str) -> str:
    """Break down a complex task management request into ordered steps."""
    planner = create_planner()
    result = planner(f"Break this request into concrete steps:\n\n{request}")
    return str(result)

@tool
def execute(plan_json: str) -> str:
    """Execute a plan by running each step against the task API."""
    executor = create_agent()
    result = executor(f"Execute this plan step by step:\n\n{plan_json}")
    return str(result)

@tool
def review(original_request, plan_json, execution_result) -> str:
    """Review execution results against the original request and plan."""
    reviewer = create_reviewer()
    result = reviewer(f"Review this execution:\n\n...")
    return str(result)
```

Each `@tool` function wraps an entire agent. The orchestrator sees three tools: `plan`, `execute`, `review`. It doesn't know or care that each tool spawns another agent. This is the **agents-as-tools** pattern.

The orchestrator's system prompt tells it to always follow the sequence: plan -> execute -> review. If review reports FAIL, retry once.

### Step 3: Seed some tasks

Before running the orchestrator, create a realistic backlog:

```bash
cd sample-app/agent
source .venv/bin/activate

# Create a mix of tasks
python3 -m src.task_assistant.cli "Create these tasks: \
  1. Fix login page CSS bug (tag: bug, frontend) \
  2. Add password reset feature (tag: feature, backend) \
  3. Update API documentation (tag: docs) \
  4. Fix database connection timeout (tag: bug, backend, critical) \
  5. Add dark mode support (tag: feature, frontend) \
  6. Write unit tests for auth module (tag: testing)"
```

Verify they exist:

```bash
python3 -m src.task_assistant.cli "List all tasks"
```

### Step 4: Run the orchestrator

Now run a complex request that requires multi-agent coordination:

```bash
python3 -m src.multi_agent.cli --verbose "Organize my backlog by priority: move all bug tasks to in-progress, keep features as todo, and mark docs tasks as done"
```

Watch the verbose output carefully. You should see three phases:

**Phase 1 -- Planning:**
```
[Orchestrator] Tool call: plan("Organize my backlog by priority...")
  [Planner] Thinking...
  [Planner] Output: [
    {"action": "search_tasks", "params": {"query": "bug"}, "reason": "Find all bug tasks"},
    {"action": "update_task", "params": {"status": "in-progress"}, "reason": "Move bugs to in-progress"},
    {"action": "search_tasks", "params": {"query": "docs"}, "reason": "Find docs tasks"},
    {"action": "update_task", "params": {"status": "done"}, "reason": "Mark docs as done"}
  ]
```

**Phase 2 -- Execution:**
```
[Orchestrator] Tool call: execute(plan_json)
  [Executor] Tool call: search_tasks("bug")
  [Executor] Tool result: 2 tasks found
  [Executor] Tool call: update_task(id="...", status="in-progress")
  [Executor] Tool call: update_task(id="...", status="in-progress")
  [Executor] Tool call: search_tasks("docs")
  [Executor] Tool result: 1 task found
  [Executor] Tool call: update_task(id="...", status="done")
```

**Phase 3 -- Review:**
```
[Orchestrator] Tool call: review(original_request, plan, execution_result)
  [Reviewer] Tool call: list_tasks()
  [Reviewer] Checking: bug tasks are in-progress? YES
  [Reviewer] Checking: feature tasks are todo? YES
  [Reviewer] Checking: docs tasks are done? YES
  [Reviewer] Output: {"status": "PASS", "summary": "All tasks organized correctly"}
```

### Step 5: Trace the agent interactions

Count what happened:
- **1 orchestrator** made 3 tool calls (plan, execute, review)
- **1 planner** reasoned about the request and output a structured plan (0 tool calls)
- **1 executor** made multiple tool calls against the task API (search + updates)
- **1 reviewer** made 1 tool call (list_tasks) to verify the final state

That's 4 agents collaborating on a single user request. The user said one sentence; the system coordinated multi-step execution and validation.

### Step 6: Try a failure scenario

Run a request that will cause the reviewer to report issues:

```bash
python3 -m src.multi_agent.cli --verbose "Delete all tasks tagged as 'nonexistent-tag'"
```

The planner should create a plan to search for tasks with that tag. The executor will find no matches. The reviewer should report that no tasks were deleted (which is correct -- there was nothing to delete). Watch how the orchestrator handles the "nothing to do" case.

### Step 7: Reflect on the pattern

Consider these questions:
- **Why not one big agent?** The planner doesn't need tools. The reviewer only needs read access. Separating them enforces the principle of least privilege and makes each agent simpler to test.
- **Why is the reviewer a different model (Haiku)?** Review is a simpler task than planning or execution. Using a smaller, faster model saves cost and latency. In production, you'd measure this with the metrics pipeline from Module 03.
- **What if the reviewer says FAIL?** The orchestrator's system prompt tells it to retry once. After that, it reports the failure to the user. This is a basic self-correction loop.

## Verification

You've completed this exercise when:
- [ ] You can trace the flow: orchestrator -> planner -> executor -> reviewer
- [ ] You've run a complex request and seen all 3 agents coordinate
- [ ] You understand why each agent has different tools and different models
- [ ] You can explain the agents-as-tools pattern to a colleague
