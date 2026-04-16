/**
 * MCP Tool Server — Reference solution for Exercise 2.
 *
 * This is the complete MCP server that exposes the task API as MCP tools.
 * Agents connect to this server via stdio and auto-discover available tools.
 *
 * Source: sample-app/src/mcp/server.ts + tools.ts + resources.ts
 *
 * Key concepts:
 *   - MCP server registers tools, resources, and resource templates
 *   - Tools are defined as JSON Schema objects (inputSchema)
 *   - The server runs over stdio transport (agent spawns it as a subprocess)
 *   - Tool calls are dispatched to handler functions that wrap the task store
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// In-memory task store (shared with the REST API in the real app)
// ---------------------------------------------------------------------------
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const taskStore = new Map<string, Task>();

// ---------------------------------------------------------------------------
// Tool definitions — JSON Schema format
//
// These are what the agent sees during tool discovery. The 'description'
// field is critical: the model uses it to decide when to call this tool.
// The 'inputSchema' tells the model what parameters to pass.
// ---------------------------------------------------------------------------
const toolDefinitions = [
  {
    name: 'list_tasks',
    description:
      'List all tasks. Optionally filter by status (todo, in-progress, done).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['todo', 'in-progress', 'done'],
          description: 'Filter tasks by status',
        },
      },
    },
  },
  {
    name: 'create_task',
    description:
      'Create a new task. Title is required. Description, status, and tags are optional.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Task title (required)' },
        description: { type: 'string', description: 'Task description' },
        status: {
          type: 'string',
          enum: ['todo', 'in-progress', 'done'],
          description: 'Task status (defaults to todo)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for the task',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description:
      'Update an existing task by ID. Any combination of title, description, status, and tags can be provided.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Task ID (required)' },
        title: { type: 'string', description: 'New title' },
        description: { type: 'string', description: 'New description' },
        status: {
          type: 'string',
          enum: ['todo', 'in-progress', 'done'],
          description: 'New status',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'New tags',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task by ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Task ID to delete (required)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_tasks',
    description:
      'Search tasks by keyword. Matches against title, description, and tags.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search keyword (required)',
        },
      },
      required: ['query'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool call handler — dispatches to the right implementation
// ---------------------------------------------------------------------------
function handleToolCall(
  name: string,
  args: Record<string, unknown>,
): { content: Array<{ type: 'text'; text: string }>; isError?: boolean } {
  switch (name) {
    case 'list_tasks': {
      let tasks = Array.from(taskStore.values());
      if (args.status) {
        tasks = tasks.filter((t) => t.status === args.status);
      }
      return jsonResult({ data: tasks, count: tasks.length });
    }

    case 'create_task': {
      const title = args.title as string;
      if (!title?.trim()) {
        return errorResult('title is required');
      }
      const now = new Date().toISOString();
      const task: Task = {
        id: uuidv4(),
        title: title.trim(),
        description: (args.description as string) ?? '',
        status: (args.status as Task['status']) ?? 'todo',
        tags: (args.tags as string[]) ?? [],
        createdAt: now,
        updatedAt: now,
      };
      taskStore.set(task.id, task);
      return jsonResult({ data: task });
    }

    case 'update_task': {
      const id = args.id as string;
      const task = taskStore.get(id);
      if (!task) return errorResult(`Task not found: ${id}`);
      const updated = {
        ...task,
        ...(args.title ? { title: (args.title as string).trim() } : {}),
        ...(args.description !== undefined
          ? { description: (args.description as string).trim() }
          : {}),
        ...(args.status ? { status: args.status as Task['status'] } : {}),
        ...(args.tags ? { tags: args.tags as string[] } : {}),
        updatedAt: new Date().toISOString(),
      };
      taskStore.set(id, updated);
      return jsonResult({ data: updated });
    }

    case 'delete_task': {
      const id = args.id as string;
      if (!taskStore.delete(id)) return errorResult(`Task not found: ${id}`);
      return jsonResult({ data: { deleted: id } });
    }

    case 'search_tasks': {
      const query = (args.query as string)?.toLowerCase().trim();
      if (!query) return errorResult('query is required');
      const matches = Array.from(taskStore.values()).filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query)),
      );
      return jsonResult({ data: matches, count: matches.length });
    }

    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// MCP Resources — read-only data accessible without tool calls
// ---------------------------------------------------------------------------
const staticResources = [
  {
    uri: 'task://list',
    name: 'All Tasks',
    description: 'Returns every task currently in the task store',
    mimeType: 'application/json',
  },
];

const resourceTemplates = [
  {
    uriTemplate: 'task://{id}',
    name: 'Task by ID',
    description: 'Returns a single task by its unique ID',
    mimeType: 'application/json',
  },
];

// ---------------------------------------------------------------------------
// Create and configure the MCP server
// ---------------------------------------------------------------------------
const server = new McpServer({
  name: 'prism-d1-task-api',
  version: '1.0.0',
});

// Register tool handlers
server.server.setRequestHandler(
  { method: 'tools/list' } as any,
  async () => ({ tools: toolDefinitions }),
);

server.server.setRequestHandler(
  { method: 'tools/call' } as any,
  async (request: any) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args ?? {});
  },
);

// Register resource handlers
server.server.setRequestHandler(
  { method: 'resources/list' } as any,
  async () => ({ resources: staticResources }),
);

server.server.setRequestHandler(
  { method: 'resources/templates/list' } as any,
  async () => ({ resourceTemplates }),
);

server.server.setRequestHandler(
  { method: 'resources/read' } as any,
  async (request: any) => {
    const { uri } = request.params;
    if (uri === 'task://list') {
      const tasks = Array.from(taskStore.values());
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ data: tasks, count: tasks.length }, null, 2),
          },
        ],
      };
    }
    const match = uri.match(/^task:\/\/(.+)$/);
    if (match) {
      const task = taskStore.get(match[1]);
      if (!task) throw new Error(`Task not found: ${match[1]}`);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ data: task }, null, 2),
          },
        ],
      };
    }
    throw new Error(`Unknown resource URI: ${uri}`);
  },
);

// ---------------------------------------------------------------------------
// Start server over stdio
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PRISM D1 Task API MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error starting MCP server:', err);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function jsonResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify({ error: message }) },
    ],
    isError: true,
  };
}
