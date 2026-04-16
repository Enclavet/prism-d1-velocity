# Exercise 2: MCP Tool Server

**Time:** 20 minutes

## Objective

Connect the Strands agent to an MCP (Model Context Protocol) server so the agent discovers tools dynamically instead of having them hardcoded. This is how production agents work -- tools live with the services they wrap, and agents discover them at runtime.

## Prerequisites

- Exercise 1 complete (agent working, sample-app running)
- Node.js 20+ installed (for the MCP server)

## Background

In Exercise 1, you defined tools in Python using `@tool` decorators. That works, but it means:
- Tool definitions are duplicated (once in the API, once in the agent)
- Adding a new tool requires redeploying the agent
- Other agents can't reuse those tool definitions

MCP solves this. The task API exposes an MCP server that describes its own capabilities. Any agent can connect and auto-discover the available tools.

## Steps

### Step 1: Review the MCP server code

The MCP server lives alongside the task API in `sample-app/src/mcp/`. Open these three files:

**`server.ts`** -- The MCP server entry point:

```bash
cat sample-app/src/mcp/server.ts
```

Key observations:
- Uses `@modelcontextprotocol/sdk` -- the official MCP TypeScript SDK
- Registers request handlers for `tools/list`, `tools/call`, `resources/list`, and `resources/read`
- Runs over **stdio** transport (agent spawns the process and communicates via stdin/stdout)

**`tools.ts`** -- Tool definitions and implementations:

```bash
cat sample-app/src/mcp/tools.ts
```

Key observations:
- `toolDefinitions` is an array of JSON Schema objects -- this is what the agent receives during tool discovery
- `handleToolCall` dispatches tool calls to the right implementation
- The tools wrap the same `taskStore` the REST API uses -- they're not HTTP calls, they're direct access

**`resources.ts`** -- MCP resources (read-only data):

```bash
cat sample-app/src/mcp/resources.ts
```

Key observations:
- Resources expose data without requiring a tool call (the agent can read `task://list` directly)
- Resource templates support parameterized URIs (`task://{id}`)

### Step 2: Count the tools

Look at the `toolDefinitions` array in `tools.ts`. You should find 5 tools:

| Tool | Description |
|------|-------------|
| `list_tasks` | List all tasks, optionally filter by status |
| `create_task` | Create a new task |
| `update_task` | Update an existing task by ID |
| `delete_task` | Delete a task by ID |
| `search_tasks` | Search tasks by keyword |

These are the same 5 capabilities from Exercise 1, but now defined in TypeScript as JSON Schema instead of Python docstrings.

### Step 3: Start the MCP server standalone (optional verification)

You can test the MCP server independently:

```bash
cd sample-app

# Build the TypeScript first
npx tsc --noEmit src/mcp/server.ts 2>&1 || echo "Type check complete"

# Start it (it will wait for JSON-RPC messages on stdin)
npx ts-node src/mcp/server.ts
```

You'll see on stderr: `PRISM D1 Task API MCP server running on stdio`

The server is now waiting for MCP protocol messages on stdin. Press Ctrl+C to stop it -- the agent will manage the server process automatically.

### Step 4: Connect the agent via MCP

The agent's MCP client is in `sample-app/agent/src/mcp_client/`. When `use_mcp=True` in the config, the agent spawns the MCP server as a subprocess and communicates over stdio.

Run the agent in MCP mode:

```bash
cd sample-app/agent
source .venv/bin/activate

# Run with MCP enabled (this is the default when use_mcp=True in config)
python3 -m src.task_assistant.cli --mcp "What tools do you have available?"
```

The agent should respond by listing the tools it discovered from the MCP server. It didn't import them from Python -- it asked the MCP server "what can you do?" and got back JSON Schema tool definitions.

### Step 5: Observe tool discovery

Run with verbose output to see the MCP handshake:

```bash
python3 -m src.task_assistant.cli --mcp --verbose "List all tasks"
```

Watch for these log lines:

```
[MCP] Connecting to server: npx ts-node ../src/mcp/server.ts
[MCP] Tool discovery: found 5 tools
[MCP]   - list_tasks: List all tasks. Optionally filter by status.
[MCP]   - create_task: Create a new task. Title is required.
[MCP]   - update_task: Update an existing task by ID.
[MCP]   - delete_task: Delete a task by ID.
[MCP]   - search_tasks: Search tasks by keyword.
[Agent] Thinking...
[Agent] Tool call: list_tasks({})
[MCP] Forwarding tool call to MCP server...
[MCP] Tool result received (247 bytes)
[Agent] Responding to user...
```

The flow is:
1. Agent spawns MCP server process
2. Agent sends `tools/list` request
3. MCP server responds with 5 tool definitions
4. Agent includes these tools in the model context
5. Model calls tools as needed
6. Agent forwards tool calls to MCP server via `tools/call`
7. MCP server executes the tool and returns results

### Step 6: Use MCP resources

Resources are read-only data the agent can access without a tool call:

```bash
python3 -m src.task_assistant.cli --mcp --verbose "Read the task list resource"
```

The agent can read `task://list` to get all tasks, or `task://{id}` to get a specific task. Resources are useful for providing context without consuming a tool-call turn.

### Step 7: Compare direct mode vs MCP mode

Run the same prompt in both modes and compare:

```bash
# Direct mode (Python @tool functions calling HTTP API)
python3 -m src.task_assistant.cli "Create a task called 'Test direct mode'"

# MCP mode (tools discovered from MCP server)
python3 -m src.task_assistant.cli --mcp "Create a task called 'Test MCP mode'"
```

Both should produce the same result. The difference is architectural:
- **Direct mode:** Agent owns the tool definitions. Tight coupling.
- **MCP mode:** Service owns the tool definitions. Loose coupling. The agent is a generic tool-use loop that can connect to any MCP server.

## Verification

You've completed this exercise when:
- [ ] You can explain what each file in `sample-app/src/mcp/` does
- [ ] The agent in MCP mode discovers 5 tools from the MCP server
- [ ] You've run at least one tool call through the MCP path (create, list, or search)
- [ ] You understand the difference between MCP tools and MCP resources
- [ ] You can articulate why MCP is better than hardcoding tools for production agents
