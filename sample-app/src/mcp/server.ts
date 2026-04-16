import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { toolDefinitions, handleToolCall } from './tools';
import {
  staticResources,
  resourceTemplates,
  handleResourceRead,
} from './resources';

// ---------------------------------------------------------------------------
// Create MCP server
// ---------------------------------------------------------------------------
const server = new McpServer({
  name: 'prism-d1-task-api',
  version: '1.0.0',
});

// ---------------------------------------------------------------------------
// Register tools — use the low-level server.server to set request handlers
// ---------------------------------------------------------------------------
server.server.setRequestHandler(
  { method: 'tools/list' } as any,
  async () => ({
    tools: toolDefinitions,
  }),
);

server.server.setRequestHandler(
  { method: 'tools/call' } as any,
  async (request: any) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args ?? {});
  },
);

// ---------------------------------------------------------------------------
// Register resources
// ---------------------------------------------------------------------------
server.server.setRequestHandler(
  { method: 'resources/list' } as any,
  async () => ({
    resources: staticResources,
  }),
);

server.server.setRequestHandler(
  { method: 'resources/templates/list' } as any,
  async () => ({
    resourceTemplates,
  }),
);

server.server.setRequestHandler(
  { method: 'resources/read' } as any,
  async (request: any) => {
    const { uri } = request.params;
    return handleResourceRead(uri);
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
